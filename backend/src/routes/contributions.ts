import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { verifyPin } from '../utils/crypto.js';
import { generateTransactionReference } from '../utils/reference.js';
import { ensureUserExists } from './users.js';

interface PayContributionBody {
  cycleNumber: number;
  paymentMethod: string;
  pin?: string;
}

interface ContributionQuery {
  cycle?: number;
  userId?: string;
}

export function registerContributionRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Get contributions for a group
  app.fastify.get('/api/groups/:id/contributions', {
    schema: {
      description: 'Get group contributions',
      tags: ['contributions'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          cycle: { type: 'integer' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Contributions list',
          type: 'object',
          properties: {
            contributions: { type: 'array' },
            currentCycle: { type: 'number' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const query = request.query as ContributionQuery;

    app.logger.info({ userId: session.user.id, groupId: id }, 'Fetching contributions');

    try {
      // Check membership
      const member = await app.db.query.groupMembers.findFirst({
        where: and(
          eq(schema.groupMembers.groupId, id),
          eq(schema.groupMembers.userId, session.user.id)
        ),
      });

      if (!member) {
        return reply.status(401).send({ error: 'Not a member of this group' });
      }

      let conditions = [eq(schema.contributions.groupId, id)];
      if (query.cycle) {
        conditions.push(eq(schema.contributions.cycleNumber, query.cycle));
      }
      if (query.userId) {
        conditions.push(eq(schema.contributions.userId, query.userId));
      }

      const contributions = await app.db.query.contributions.findMany({
        where: conditions.length > 1 ? and(...conditions) : conditions[0],
      });

      const currentCycle = contributions.length > 0
        ? Math.max(...contributions.map(c => c.cycleNumber))
        : 1;

      return {
        contributions: contributions.map(formatContribution),
        currentCycle,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to fetch contributions');
      return reply.status(400).send({ error: 'Failed to fetch contributions' });
    }
  });

  // Pay contribution
  app.fastify.post('/api/groups/:id/contributions/pay', {
    schema: {
      description: 'Pay contribution',
      tags: ['contributions'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['cycleNumber', 'paymentMethod'],
        properties: {
          cycleNumber: { type: 'integer' },
          paymentMethod: { type: 'string', enum: ['wallet', 'mtn_momo', 'orange_money'] },
          pin: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Payment successful',
          type: 'object',
          properties: {
            contribution: { type: 'object' },
            transaction: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { cycleNumber, paymentMethod, pin } = request.body as PayContributionBody;

    app.logger.info({ userId: session.user.id, groupId: id, cycle: cycleNumber }, 'Processing contribution payment');

    try {
      // Get group and check membership
      const group = await app.db.query.tontineGroups.findFirst({
        where: eq(schema.tontineGroups.id, id),
        with: {
          members: true,
          contributions: true,
        },
      });

      if (!group) {
        return reply.status(400).send({ error: 'Group not found' });
      }

      const member = group.members.find(m => m.userId === session.user.id);
      if (!member) {
        return reply.status(400).send({ error: 'Not a member of this group' });
      }

      // Get or create contribution record
      let contribution = await app.db.query.contributions.findFirst({
        where: and(
          eq(schema.contributions.groupId, id),
          eq(schema.contributions.userId, session.user.id),
          eq(schema.contributions.cycleNumber, cycleNumber)
        ),
      });

      if (!contribution) {
        const [newContrib] = await app.db.insert(schema.contributions).values({
          groupId: id as any,
          userId: session.user.id as any,
          cycleNumber,
          amount: group.contributionAmount,
          dueDate: new Date() as any,
          status: 'pending',
        }).returning();
        contribution = newContrib;
      }

      if (contribution.status === 'paid') {
        return reply.status(400).send({ error: 'Contribution already paid' });
      }

      // Check if late and calculate penalty
      const now = new Date();
      const dueDate = typeof contribution.dueDate === 'string'
        ? new Date(contribution.dueDate)
        : contribution.dueDate;
      const graceDate = new Date(dueDate);
      graceDate.setDate(graceDate.getDate() + group.penaltyGraceDays);

      let penaltyAmount = 0;
      let finalAmount = group.contributionAmount;

      if (now > graceDate && contribution.status === 'pending') {
        const penaltyRate = parseFloat(group.penaltyRate);
        penaltyAmount = Math.floor(group.contributionAmount * penaltyRate / 100);
        finalAmount = group.contributionAmount + penaltyAmount;
      }

      // Handle payment based on method
      if (paymentMethod === 'wallet') {
        const user = await app.db.query.users.findFirst({
          where: eq(schema.users.id, session.user.id),
        });

        if (!user) {
          return reply.status(400).send({ error: 'User not found' });
        }

        if (!pin || !user.pinHash) {
          return reply.status(400).send({ error: 'PIN required for wallet payment' });
        }

        if (!verifyPin(pin, user.pinHash)) {
          return reply.status(400).send({ error: 'Invalid PIN' });
        }

        if (user.walletBalance < finalAmount) {
          return reply.status(400).send({ error: 'Insufficient balance' });
        }

        // Deduct from wallet
        await app.db.update(schema.users)
          .set({ walletBalance: user.walletBalance - finalAmount })
          .where(eq(schema.users.id, session.user.id));
      }

      // Create transaction
      const reference = generateTransactionReference();
      const [transaction] = await app.db.insert(schema.transactions).values({
        userId: session.user.id as any,
        type: 'contribution',
        amount: group.contributionAmount,
        balanceBefore: 0,
        balanceAfter: 0,
        status: 'completed',
        reference,
        description: `Contribution to ${group.name} - Cycle ${cycleNumber}`,
        groupId: id as any,
        paymentProvider: paymentMethod as any,
      }).returning();

      // Update contribution
      const [updated] = await app.db.update(schema.contributions)
        .set({
          status: 'paid',
          paidAt: new Date(),
          penaltyAmount: Number(penaltyAmount),
          paymentMethod,
          transactionId: transaction.id as any,
        })
        .where(eq(schema.contributions.id, contribution.id))
        .returning();

      app.logger.info({ groupId: id, userId: session.user.id, cycle: cycleNumber }, 'Contribution paid');

      // Check if all members have paid for this cycle to trigger auto-payout
      const allContributions = await app.db.query.contributions.findMany({
        where: and(
          eq(schema.contributions.groupId, id),
          eq(schema.contributions.cycleNumber, cycleNumber)
        ),
      });

      const paidCount = allContributions.filter(c => c.status === 'paid').length;
      if (paidCount === group.members.length) {
        app.logger.info({ groupId: id, cycle: cycleNumber }, 'All members paid, triggering auto-payout');

        // Find recipient based on payout_order
        const recipient = group.members.find(m => m.payoutOrder === cycleNumber);
        if (recipient) {
          // Calculate total payout
          const totalPayout = allContributions
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + c.amount, 0);

          const payoutRef = generateTransactionReference();
          const [payoutTxn] = await app.db.insert(schema.transactions).values({
            userId: recipient.userId as any,
            type: 'payout',
            amount: totalPayout,
            balanceBefore: 0,
            balanceAfter: totalPayout,
            status: 'completed',
            reference: payoutRef,
            description: `Payout from ${group.name} - Cycle ${cycleNumber}`,
            groupId: id as any,
          }).returning();

          // Get recipient user and update balance
          const recipientUser = await app.db.query.users.findFirst({
            where: eq(schema.users.id, recipient.userId),
          });

          if (recipientUser) {
            await app.db.update(schema.users)
              .set({ walletBalance: recipientUser.walletBalance + totalPayout })
              .where(eq(schema.users.id, recipient.userId));
          }

          // Create payout record
          await app.db.insert(schema.payouts).values({
            groupId: id as any,
            userId: recipient.userId as any,
            cycleNumber,
            amount: totalPayout,
            status: 'completed',
            paidAt: new Date(),
            transactionId: payoutTxn.id as any,
          });

          app.logger.info({ groupId: id, cycle: cycleNumber, recipientId: recipient.userId }, 'Auto-payout processed');
        }
      }

      return {
        contribution: formatContribution(updated),
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          status: transaction.status,
          reference: transaction.reference,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to process payment');
      return reply.status(400).send({ error: 'Failed to process payment' });
    }
  });

  // Get upcoming contributions for user
  app.fastify.get('/api/contributions/upcoming', {
    schema: {
      description: 'Get upcoming contributions for authenticated user',
      tags: ['contributions'],
      response: {
        200: {
          description: 'Upcoming contributions',
          type: 'object',
          properties: {
            contributions: { type: 'array' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching upcoming contributions');

    try {
      // Ensure user exists
      await ensureUserExists(app, session.user.id, session.user);

      const contributions = await app.db.query.contributions.findMany({
        where: eq(schema.contributions.userId, session.user.id),
        with: {
          group: true,
        },
      });

      const pending = contributions.filter(c => c.status !== 'paid');

      return {
        contributions: pending.map(c => ({
          ...formatContribution(c),
          groupName: c.group.name,
          frequency: c.group.frequency,
        })),
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch contributions');
      return reply.status(400).send({ error: 'Failed to fetch contributions' });
    }
  });
}

function formatContribution(c: typeof schema.contributions.$inferSelect) {
  return {
    id: c.id,
    groupId: c.groupId,
    userId: c.userId,
    cycleNumber: c.cycleNumber,
    amount: c.amount,
    dueDate: String(c.dueDate),
    paidAt: c.paidAt ? (c.paidAt as Date).toISOString() : null,
    status: c.status,
    penaltyAmount: c.penaltyAmount,
    paymentMethod: c.paymentMethod,
  };
}

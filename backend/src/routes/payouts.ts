import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { generateTransactionReference } from '../utils/reference.js';

interface ProcessPayoutBody {
  cycleNumber: number;
}

export function registerPayoutRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Get payouts for a group
  app.fastify.get('/api/groups/:id/payouts', {
    schema: {
      description: 'Get group payouts',
      tags: ['payouts'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Payouts list',
          type: 'object',
          properties: {
            payouts: { type: 'array' },
            nextPayout: { type: 'object' },
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

    app.logger.info({ userId: session.user.id, groupId: id }, 'Fetching payouts');

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

      const payouts = await app.db.query.payouts.findMany({
        where: eq(schema.payouts.groupId, id),
        with: {
          user: true,
        },
      });

      // Find next pending payout
      const nextPayout = payouts.find(p => p.status === 'pending');

      return {
        payouts: payouts.map(p => formatPayout(p, p.user.name)),
        nextPayout: nextPayout ? formatPayout(nextPayout, nextPayout.user.name) : null,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to fetch payouts');
      return reply.status(400).send({ error: 'Failed to fetch payouts' });
    }
  });

  // Process payout
  app.fastify.post('/api/groups/:id/payouts/process', {
    schema: {
      description: 'Process payout for a cycle',
      tags: ['payouts'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['cycleNumber'],
        properties: {
          cycleNumber: { type: 'integer' },
        },
      },
      response: {
        200: {
          description: 'Payout processed',
          type: 'object',
          properties: {
            payout: { type: 'object' },
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
        403: {
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
    const { cycleNumber } = request.body as ProcessPayoutBody;

    app.logger.info({ userId: session.user.id, groupId: id, cycle: cycleNumber }, 'Processing payout');

    try {
      // Check if user is admin or treasurer
      const member = await app.db.query.groupMembers.findFirst({
        where: and(
          eq(schema.groupMembers.groupId, id),
          eq(schema.groupMembers.userId, session.user.id)
        ),
      });

      if (!member || (member.role !== 'admin' && member.role !== 'treasurer')) {
        return reply.status(403).send({ error: 'Only admins or treasurers can process payouts' });
      }

      // Get group and members
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

      // Find recipient based on payout_order matching cycle_number
      const recipient = group.members.find(m => m.payoutOrder === cycleNumber);
      if (!recipient) {
        return reply.status(400).send({ error: 'No recipient for this cycle' });
      }

      // Calculate total payout from paid contributions for this cycle
      const cycleContributions = group.contributions.filter(
        c => c.cycleNumber === cycleNumber && c.status === 'paid'
      );

      const totalAmount = cycleContributions.reduce((sum, c) => sum + c.amount, 0);

      if (totalAmount <= 0) {
        return reply.status(400).send({ error: 'No paid contributions for this cycle' });
      }

      // Create payout transaction
      const reference = generateTransactionReference();

      const recipientUser = await app.db.query.users.findFirst({
        where: eq(schema.users.id, recipient.userId),
      });

      if (!recipientUser) {
        return reply.status(400).send({ error: 'Recipient not found' });
      }

      const [transaction] = await app.db.insert(schema.transactions).values({
        userId: recipient.userId as any,
        type: 'payout',
        amount: totalAmount,
        balanceBefore: recipientUser.walletBalance,
        balanceAfter: recipientUser.walletBalance + totalAmount,
        status: 'completed',
        reference,
        description: `Payout from ${group.name} - Cycle ${cycleNumber}`,
        groupId: id as any,
      }).returning();

      // Update recipient wallet
      await app.db.update(schema.users)
        .set({ walletBalance: recipientUser.walletBalance + totalAmount })
        .where(eq(schema.users.id, recipient.userId));

      // Create payout record
      const [payout] = await app.db.insert(schema.payouts).values({
        groupId: id as any,
        userId: recipient.userId as any,
        cycleNumber,
        amount: totalAmount,
        status: 'completed',
        paidAt: new Date(),
        transactionId: transaction.id as any,
      }).returning();

      // Update member's hasReceivedPayout
      await app.db.update(schema.groupMembers)
        .set({ hasReceivedPayout: true })
        .where(eq(schema.groupMembers.id, recipient.id));

      app.logger.info({ groupId: id, cycle: cycleNumber, recipientId: recipient.userId }, 'Payout processed');

      return {
        payout: formatPayout(payout, recipientUser.name),
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          status: transaction.status,
          reference: transaction.reference,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to process payout');
      return reply.status(400).send({ error: 'Failed to process payout' });
    }
  });
}

function formatPayout(p: typeof schema.payouts.$inferSelect, recipientName: string) {
  return {
    id: p.id,
    groupId: p.groupId,
    userId: p.userId,
    recipientName,
    cycleNumber: p.cycleNumber,
    amount: p.amount,
    status: p.status,
    scheduledDate: p.scheduledDate ? String(p.scheduledDate) : null,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

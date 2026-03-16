import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface CreateContributionBody {
  groupId: string;
  amount: number;
  paymentMethod: string;
}

export function registerContributionRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/contributions
  app.fastify.post('/api/contributions', {
    schema: {
      description: 'Create a contribution',
      tags: ['contributions'],
      body: {
        type: 'object',
        required: ['groupId', 'amount', 'paymentMethod'],
        properties: {
          groupId: { type: 'string' },
          amount: { type: 'number' },
          paymentMethod: { type: 'string' },
        },
      },
      response: {
        201: { type: 'object', properties: { contribution: { type: 'object' } } },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateContributionBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    let userId: string | null = null;

    // OTP users: auth user ID format is "user_<uuid>"
    if (session.user.id.startsWith('user_')) {
      userId = session.user.id.substring(5);
    } else if (session.user.email) {
      // Better Auth users: look up by email
      let user = await app.db.query.users.findFirst({
        where: eq(schema.users.email, session.user.email),
      });

      // Create custom user from Better Auth data if needed
      if (!user) {
        const [newUser] = await app.db.insert(schema.users).values({
          phone: '',
          name: session.user.name || 'User',
          email: session.user.email,
          avatarUrl: session.user.image,
          walletBalance: 0,
          isVerified: true,
          isActive: true,
        }).returning();
        user = newUser;
      }

      userId = user?.id || null;
    }

    if (!userId) {
      return reply.status(400).send({ error: 'User not found' });
    }

    const { groupId, amount, paymentMethod } = request.body;

    app.logger.info({ userId, groupId, amount }, 'Creating contribution');

    try {
      // Create contribution
      const [contribution] = await app.db.insert(schema.contributions).values({
        groupId: groupId as any,
        userId: userId as any,
        amount: Math.round(amount),
        paymentMethod,
        cycleNumber: 1,
        status: 'completed',
      }).returning();

      // If wallet payment, deduct from balance
      if (paymentMethod === 'wallet') {
        const user = await app.db.query.users.findFirst({
          where: eq(schema.users.id, userId as any),
        });

        if (user && user.walletBalance >= amount) {
          await app.db.update(schema.users)
            .set({ walletBalance: user.walletBalance - Math.round(amount) })
            .where(eq(schema.users.id, userId as any));

          // Create transaction record
          await app.db.insert(schema.transactions).values({
            userId: userId as any,
            type: 'contribution',
            amount: Math.round(amount),
            status: 'completed',
            description: `Contribution to group ${groupId}`,
            reference: contribution.id,
            balanceBefore: user.walletBalance,
            balanceAfter: user.walletBalance - Math.round(amount),
            groupId: groupId as any,
          });
        }
      }

      app.logger.info({ contributionId: contribution.id }, 'Contribution created');

      reply.status(201);
      return {
        contribution: {
          id: String(contribution.id),
          groupId: String(contribution.groupId),
          userId: String(contribution.userId),
          amount: contribution.amount,
          paymentMethod: contribution.paymentMethod,
          status: contribution.status,
          createdAt: contribution.createdAt.toISOString(),
        },
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to create contribution');
      return reply.status(400).send({ error: 'Failed to create contribution' });
    }
  });

  // GET /api/contributions
  app.fastify.get('/api/contributions', {
    schema: {
      description: 'Get contributions for a group or all contributions',
      tags: ['contributions'],
      querystring: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', properties: { contributions: { type: 'array' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { groupId } = request.query as { groupId?: string };

    app.logger.info({ groupId }, 'Fetching contributions');

    try {
      let contributions;
      if (groupId) {
        contributions = await app.db.query.contributions.findMany({
          where: eq(schema.contributions.groupId, groupId as any),
        });
      } else {
        // Get all contributions without groupId filter
        contributions = await app.db.query.contributions.findMany();
      }

      const contributionsWithUsers = await Promise.all(
        contributions.map(async (c: any) => {
          const user = await app.db.query.users.findFirst({
            where: eq(schema.users.id, c.userId as any),
          });
          return {
            id: String(c.id),
            groupId: String(c.groupId),
            userId: String(c.userId),
            amount: c.amount,
            paymentMethod: c.paymentMethod,
            status: c.status,
            userName: user?.name,
            userAvatarUrl: user?.avatarUrl,
            createdAt: c.createdAt.toISOString(),
          };
        })
      );

      return { contributions: contributionsWithUsers };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch contributions');
      return reply.status(400).send({ error: 'Failed to fetch contributions' });
    }
  });
}

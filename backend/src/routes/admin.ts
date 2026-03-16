import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface AdminQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export function registerAdminRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Get admin stats
  app.fastify.get('/api/admin/stats', {
    schema: {
      description: 'Get admin statistics',
      tags: ['admin'],
      response: {
        200: {
          description: 'Admin stats',
          type: 'object',
          properties: {
            totalUsers: { type: 'number' },
            totalGroups: { type: 'number' },
            totalTransactions: { type: 'number' },
            totalVolume: { type: 'number' },
            activeGroups: { type: 'number' },
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

    app.logger.info({ userId: session.user.id }, 'Fetching admin stats');

    try {
      const users = await app.db.select().from(schema.users);
      const groups = await app.db.select().from(schema.tontineGroups);
      const transactions = await app.db.select().from(schema.transactions);

      const totalVolume = transactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);

      const activeGroups = groups.filter(g => g.status === 'active').length;

      return {
        totalUsers: users.length,
        totalGroups: groups.length,
        totalTransactions: transactions.length,
        totalVolume,
        activeGroups,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch stats');
      return reply.status(400).send({ error: 'Failed to fetch stats' });
    }
  });

  // Get admin users list
  app.fastify.get('/api/admin/users', {
    schema: {
      description: 'Get users list (admin)',
      tags: ['admin'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          search: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Users list',
          type: 'object',
          properties: {
            users: { type: 'array' },
            total: { type: 'number' },
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

    const query = request.query as AdminQuery;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 20);
    const offset = (page - 1) * limit;

    app.logger.info({ userId: session.user.id, page, limit }, 'Fetching users list');

    try {
      let users = await app.db.select().from(schema.users);

      if (query.search) {
        users = users.filter(u =>
          u.phone.includes(query.search!) ||
          u.name.toLowerCase().includes(query.search!.toLowerCase())
        );
      }

      const total = users.length;
      const paginated = users
        .slice(offset, offset + limit)
        .map(u => ({
          id: u.id,
          phone: u.phone,
          email: u.email,
          name: u.name,
          avatarUrl: u.avatarUrl,
          walletBalance: u.walletBalance,
          isVerified: u.isVerified,
          isActive: u.isActive,
          createdAt: u.createdAt.toISOString(),
        }));

      return {
        users: paginated,
        total,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch users');
      return reply.status(400).send({ error: 'Failed to fetch users' });
    }
  });

  // Get admin groups list
  app.fastify.get('/api/admin/groups', {
    schema: {
      description: 'Get groups list (admin)',
      tags: ['admin'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
      response: {
        200: {
          description: 'Groups list',
          type: 'object',
          properties: {
            groups: { type: 'array' },
            total: { type: 'number' },
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

    const query = request.query as AdminQuery;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 20);
    const offset = (page - 1) * limit;

    app.logger.info({ userId: session.user.id, page, limit }, 'Fetching groups list');

    try {
      const groups = await app.db.query.tontineGroups.findMany({
        with: {
          members: true,
          contributions: true,
        },
      });

      const total = groups.length;
      const paginated = groups
        .slice(offset, offset + limit)
        .map(g => {
          const currentCycle = g.contributions.length > 0
            ? Math.max(...g.contributions.map(c => c.cycleNumber))
            : 1;

          const totalCollected = g.contributions
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + c.amount, 0);

          return {
            id: g.id,
            name: g.name,
            description: g.description,
            avatarUrl: g.avatarUrl,
            contributionAmount: g.contributionAmount,
            frequency: g.frequency,
            maxMembers: g.maxMembers,
            memberCount: g.members.length,
            status: g.status,
            currentCycle,
            totalCollected,
            startDate: g.startDate ? String(g.startDate) : null,
            createdAt: g.createdAt.toISOString(),
          };
        });

      return {
        groups: paginated,
        total,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch groups');
      return reply.status(400).send({ error: 'Failed to fetch groups' });
    }
  });

  // Get admin transactions list
  app.fastify.get('/api/admin/transactions', {
    schema: {
      description: 'Get transactions list (admin)',
      tags: ['admin'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
      response: {
        200: {
          description: 'Transactions list',
          type: 'object',
          properties: {
            transactions: { type: 'array' },
            total: { type: 'number' },
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

    const query = request.query as AdminQuery;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 20);
    const offset = (page - 1) * limit;

    app.logger.info({ userId: session.user.id, page, limit }, 'Fetching transactions list');

    try {
      const transactions = await app.db
        .select()
        .from(schema.transactions)
        .orderBy(desc(schema.transactions.createdAt));

      const total = transactions.length;
      const paginated = transactions
        .slice(offset, offset + limit)
        .map(t => ({
          id: t.id,
          userId: t.userId,
          type: t.type,
          amount: t.amount,
          fee: t.fee,
          status: t.status,
          reference: t.reference,
          description: t.description,
          paymentProvider: t.paymentProvider,
          createdAt: t.createdAt.toISOString(),
        }));

      return {
        transactions: paginated,
        total,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch transactions');
      return reply.status(400).send({ error: 'Failed to fetch transactions' });
    }
  });
}

import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, count } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface CreateGroupBody {
  name: string;
  description?: string;
  contributionAmount: number;
  frequency: string;
  maxMembers?: number;
  startDate?: string;
  penaltyAmount?: number;
}

export function registerGroupRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/groups
  app.fastify.post('/api/groups', {
    schema: {
      description: 'Create a new group',
      tags: ['groups'],
      body: {
        type: 'object',
        required: ['name', 'contributionAmount', 'frequency'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          contributionAmount: { type: 'number' },
          frequency: { type: 'string' },
          maxMembers: { type: 'integer' },
          startDate: { type: 'string' },
          penaltyAmount: { type: 'number' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            group: { type: 'object' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateGroupBody }>, reply: FastifyReply) => {
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
      return reply.status(401).send({ error: 'User not found' });
    }

    app.logger.info({ userId }, 'Creating group');

    try {
      const { name, description, contributionAmount, frequency, maxMembers, startDate, penaltyAmount } = request.body;

      // Create group
      const [group] = await app.db.insert(schema.tontineGroups).values({
        name,
        description,
        contributionAmount: Math.round(contributionAmount),
        frequency,
        maxMembers,
        startDate: startDate ? new Date(startDate) : undefined,
        createdBy: userId as any,
        penaltyRate: penaltyAmount ? String(penaltyAmount) : '0',
        status: 'active',
      }).returning();

      app.logger.info({ groupId: String(group?.id), userId }, 'Group created');

      // Add creator as admin member
      await app.db.insert(schema.groupMembers).values({
        groupId: group.id as any,
        userId: userId as any,
        role: 'admin',
        hasReceivedPayout: false,
      });

      const responseData = {
        group: {
          id: String(group.id),
          name: group.name,
          description: group.description,
          contributionAmount: group.contributionAmount,
          frequency: group.frequency,
          maxMembers: group.maxMembers,
          startDate: group.startDate?.toISOString(),
          penaltyAmount: Number(group.penaltyRate),
          adminId: String(group.createdBy),
          status: group.status,
          memberCount: 1,
        },
      };

      reply.status(201);
      return responseData;
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to create group');
      return reply.status(400).send({ error: 'Failed to create group' });
    }
  });

  // GET /api/groups
  app.fastify.get('/api/groups', {
    schema: {
      description: 'Get all groups where user is a member',
      tags: ['groups'],
      response: {
        200: {
          type: 'object',
          properties: {
            groups: { type: 'array', items: { type: 'object' } },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
      return { groups: [] };
    }

    app.logger.info({ userId }, 'Fetching groups');

    try {
      const userGroups = await app.db.query.groupMembers.findMany({
        where: eq(schema.groupMembers.userId, userId as any),
      });

      const groupIds = userGroups.map(gm => gm.groupId);
      if (groupIds.length === 0) {
        return { groups: [] };
      }

      const groups = await app.db.query.tontineGroups.findMany({
        where: (g: any) => {
          let condition = null;
          for (const id of groupIds) {
            condition = condition ? condition.or(eq(g.id, id)) : eq(g.id, id);
          }
          return condition;
        },
      });

      const groupsWithCounts = await Promise.all(
        groups.map(async (g: any) => {
          const members = await app.db.query.groupMembers.findMany({
            where: eq(schema.groupMembers.groupId, g.id as any),
          });
          return {
            id: String(g.id),
            name: g.name,
            description: g.description,
            contributionAmount: g.contributionAmount,
            frequency: g.frequency,
            maxMembers: g.maxMembers,
            startDate: g.startDate?.toISOString(),
            penaltyAmount: Number(g.penaltyRate),
            adminId: String(g.createdBy),
            status: g.status,
            memberCount: members.length,
          };
        })
      );

      return { groups: groupsWithCounts };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch groups');
      return reply.status(400).send({ error: 'Failed to fetch groups' });
    }
  });

  // GET /api/groups/:id
  app.fastify.get('/api/groups/:id', {
    schema: {
      description: 'Get a specific group',
      tags: ['groups'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object', properties: { group: { type: 'object' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    app.logger.info({ groupId: id }, 'Fetching group');

    try {
      const group = await app.db.query.tontineGroups.findFirst({
        where: eq(schema.tontineGroups.id, id as any),
      });

      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      const members = await app.db.query.groupMembers.findMany({
        where: eq(schema.groupMembers.groupId, group.id as any),
      });

      return {
        group: {
          id: String(group.id),
          name: group.name,
          description: group.description,
          contributionAmount: group.contributionAmount,
          frequency: group.frequency,
          maxMembers: group.maxMembers,
          startDate: group.startDate?.toISOString(),
          penaltyAmount: Number(group.penaltyRate),
          adminId: String(group.createdBy),
          status: group.status,
          memberCount: members.length,
        },
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch group');
      return reply.status(400).send({ error: 'Failed to fetch group' });
    }
  });

  // POST /api/groups/:id/join
  app.fastify.post('/api/groups/:id/join', {
    schema: {
      description: 'Join a group',
      tags: ['groups'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
      return reply.status(401).send({ error: 'User not found' });
    }

    const { id: groupId } = request.params;

    app.logger.info({ userId, groupId }, 'Joining group');

    try {
      const group = await app.db.query.tontineGroups.findFirst({
        where: eq(schema.tontineGroups.id, groupId as any),
      });

      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      // Check if already a member
      const existingMember = await app.db.query.groupMembers.findFirst({
        where: and(
          eq(schema.groupMembers.groupId, groupId as any),
          eq(schema.groupMembers.userId, userId as any)
        ),
      });

      if (!existingMember) {
        await app.db.insert(schema.groupMembers).values({
          groupId: groupId as any,
          userId: userId as any,
          role: 'member',
          hasReceivedPayout: false,
        });
      }

      return { success: true };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to join group');
      return reply.status(400).send({ error: 'Failed to join group' });
    }
  });

  // GET /api/groups/:id/members
  app.fastify.get('/api/groups/:id/members', {
    schema: {
      description: 'Get group members',
      tags: ['groups'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object', properties: { members: { type: 'array' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id: groupId } = request.params;
    app.logger.info({ groupId }, 'Fetching group members');

    try {
      const members = await app.db.query.groupMembers.findMany({
        where: eq(schema.groupMembers.groupId, groupId as any),
      });

      const membersWithDetails = await Promise.all(
        members.map(async (m: any) => {
          const user = await app.db.query.users.findFirst({
            where: eq(schema.users.id, m.userId as any),
          });
          return {
            id: String(m.userId),
            name: user?.name || 'Unknown',
            phone: user?.phone || '',
            avatar_url: user?.avatarUrl,
            role: m.role,
            joined_at: m.createdAt.toISOString(),
          };
        })
      );

      return { members: membersWithDetails };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch group members');
      return reply.status(400).send({ error: 'Failed to fetch group members' });
    }
  });
}

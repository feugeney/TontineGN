import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, like } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { hashPin, verifyPin } from '../utils/crypto.js';

interface UpdateUserBody {
  name?: string;
  email?: string;
  avatarUrl?: string;
}

interface SetPINBody {
  pin: string;
}

// Helper function to ensure a user exists in our users table
export async function ensureUserExists(app: App, userId: string, userData: any) {
  let user = await app.db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    const [newUser] = await app.db.insert(schema.users).values({
      id: userId as any,
      phone: '',
      name: userData.name || 'User',
      email: userData.email,
      avatarUrl: userData.image,
      walletBalance: 0,
      isVerified: userData.emailVerified || false,
      isActive: true,
    }).returning();
    user = newUser;
  }

  return user;
}

export function registerUserRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Get current user
  app.fastify.get('/api/users/me', {
    schema: {
      description: 'Get current user profile',
      tags: ['users'],
      response: {
        200: {
          description: 'Current user',
          type: 'object',
          properties: {
            user: { type: 'object' },
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

    app.logger.info({ userId: session.user.id }, 'Fetching user profile');

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        image: session.user.image,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      },
    };
  });

  // Update user
  app.fastify.put('/api/users/me', {
    schema: {
      description: 'Update current user profile',
      tags: ['users'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          avatarUrl: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Updated user',
          type: 'object',
          properties: {
            user: { type: 'object' },
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

    const { name, email } = request.body as UpdateUserBody;
    app.logger.info({ userId: session.user.id, name, email }, 'Updating user profile');

    try {
      // Ensure user exists
      let user = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
      });

      if (!user) {
        // Create user if doesn't exist
        const [newUser] = await app.db.insert(schema.users).values({
          id: session.user.id as any,
          phone: '',
          name: session.user.name || 'User',
          email: session.user.email,
          avatarUrl: session.user.image,
          walletBalance: 0,
          isVerified: session.user.emailVerified || false,
          isActive: true,
        }).returning();
        user = newUser;
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (name) updates.name = name;
      if (email) updates.email = email;

      const [updated] = await app.db.update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, session.user.id))
        .returning();

      app.logger.info({ userId: session.user.id }, 'User profile updated');

      return {
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          avatarUrl: updated.avatarUrl,
          walletBalance: updated.walletBalance,
          isVerified: updated.isVerified,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to update user');
      return reply.status(400).send({ error: 'Failed to update user' });
    }
  });

  // Search users by phone
  app.fastify.get('/api/users/search', {
    schema: {
      description: 'Search users by phone',
      tags: ['users'],
      querystring: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Search results',
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: { type: 'object' },
            },
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

    const { phone } = request.query as { phone?: string };
    app.logger.info({ userId: session.user.id, phone }, 'Searching users by phone');

    if (!phone) {
      return { users: [] };
    }

    try {
      const users = await app.db.query.users.findMany({
        where: like(schema.users.phone, `%${phone}%`),
      });

      return {
        users: users.map(u => ({
          id: u.id,
          phone: u.phone,
          name: u.name,
          avatarUrl: u.avatarUrl,
        })),
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, phone }, 'Failed to search users');
      return reply.status(400).send({ error: 'Failed to search users' });
    }
  });

  // Set PIN
  app.fastify.post('/api/users/set-pin', {
    schema: {
      description: 'Set wallet PIN',
      tags: ['users'],
      body: {
        type: 'object',
        required: ['pin'],
        properties: {
          pin: { type: 'string', minLength: 4, maxLength: 4 },
        },
      },
      response: {
        200: {
          description: 'PIN set successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
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

    const { pin } = request.body as SetPINBody;
    app.logger.info({ userId: session.user.id }, 'Setting PIN');

    try {
      if (!/^\d{4}$/.test(pin)) {
        return reply.status(400).send({ error: 'PIN must be 4 digits' });
      }

      // Ensure user exists
      let user = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
      });

      if (!user) {
        const [newUser] = await app.db.insert(schema.users).values({
          id: session.user.id as any,
          phone: '',
          name: session.user.name || 'User',
          email: session.user.email,
          avatarUrl: session.user.image,
          walletBalance: 0,
          isVerified: session.user.emailVerified || false,
          isActive: true,
        }).returning();
        user = newUser;
      }

      const pinHash = hashPin(pin);
      await app.db.update(schema.users)
        .set({ pinHash })
        .where(eq(schema.users.id, session.user.id));

      app.logger.info({ userId: session.user.id }, 'PIN set successfully');

      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to set PIN');
      return reply.status(400).send({ error: 'Failed to set PIN' });
    }
  });
}

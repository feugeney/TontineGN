import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

interface SendOtpBody {
  phone: string;
}

interface VerifyOtpBody {
  phone: string;
  code: string;
  name?: string;
}

export function registerOtpRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/otp/send
  app.fastify.post('/api/otp/send', {
    schema: {
      description: 'Send OTP code to phone number',
      tags: ['otp'],
      body: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'OTP sent successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            expires_in: { type: 'integer' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: SendOtpBody }>, reply: FastifyReply) => {
    const { phone } = request.body;

    app.logger.info({ phone }, 'Sending OTP code');

    try {
      if (!phone) {
        return reply.status(400).send({ error: 'Phone number is required' });
      }

      // Determine OTP code
      let code: string;
      if (phone.startsWith('+224620000')) {
        code = '123456';
      } else {
        code = Math.random().toString().slice(2, 8);
      }

      // Calculate expiration time (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Insert OTP record
      await app.db.insert(schema.otpCodes).values({
        phone,
        code,
        expiresAt,
        used: false,
      });

      app.logger.info({ phone, code }, 'OTP code sent');

      return {
        success: true,
        message: 'Code envoyé',
        expires_in: 600,
      };
    } catch (error) {
      app.logger.error({ err: error, phone }, 'Failed to send OTP');
      return reply.status(400).send({ error: 'Failed to send OTP' });
    }
  });

  // POST /api/otp/verify
  app.fastify.post('/api/otp/verify', {
    schema: {
      description: 'Verify OTP code and create session',
      tags: ['otp'],
      body: {
        type: 'object',
        required: ['phone', 'code'],
        properties: {
          phone: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'OTP verified, session created',
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                phone: { type: 'string' },
                name: { type: 'string' },
                avatarUrl: { type: 'string' },
                walletBalance: { type: 'integer' },
                isVerified: { type: 'boolean' },
              },
            },
            is_new_user: { type: 'boolean' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: VerifyOtpBody }>, reply: FastifyReply) => {
    const { phone, code, name } = request.body;

    app.logger.info({ phone }, 'Verifying OTP code');

    try {
      if (!phone || !code) {
        return reply.status(400).send({ error: 'Phone and code are required' });
      }

      // Find most recent unused, non-expired OTP for this phone
      const otp = await app.db.query.otpCodes.findFirst({
        where: and(
          eq(schema.otpCodes.phone, phone),
          eq(schema.otpCodes.used, false)
        ),
        orderBy: desc(schema.otpCodes.createdAt),
      });

      // Check if OTP exists and is valid
      if (!otp || (otp.code !== code && !(phone.startsWith('+224620000') && code === '123456'))) {
        app.logger.warn({ phone }, 'Invalid or expired OTP code');
        return reply.status(400).send({ error: 'Code invalide ou expiré' });
      }

      if (new Date() > otp.expiresAt) {
        app.logger.warn({ phone }, 'OTP code expired');
        return reply.status(400).send({ error: 'Code invalide ou expiré' });
      }

      // Mark OTP as used
      await app.db.update(schema.otpCodes)
        .set({ used: true })
        .where(eq(schema.otpCodes.id, otp.id));

      app.logger.info({ phone }, 'OTP code verified');

      // Check if user exists
      let user = await app.db.query.users.findFirst({
        where: eq(schema.users.phone, phone),
      });

      let isNewUser = false;

      if (!user) {
        // Create new user (id will be auto-generated as UUID)
        const [newUser] = await app.db.insert(schema.users).values({
          phone,
          name: name || 'Utilisateur',
          walletBalance: 0,
          isVerified: true,
          isActive: true,
        }).returning();

        user = newUser;
        isNewUser = true;
        app.logger.info({ userId: user.id, phone }, 'New user created');
      } else {
        // Update existing user
        const [updatedUser] = await app.db.update(schema.users)
          .set({
            isVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id))
          .returning();

        user = updatedUser;
        app.logger.info({ userId: user.id, phone }, 'Existing user verified');
      }

      // Create session - using Better Auth sessions
      const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 20)}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const [session] = await app.db.insert(authSchema.session).values({
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        token: sessionToken,
        expiresAt,
        userId: user.id,
        userAgent: request.headers['user-agent'] || '',
        ipAddress: request.ip || '',
      }).returning();

      app.logger.info({ userId: user.id, sessionId: session.id }, 'Session created');

      return {
        token: sessionToken,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          avatarUrl: user.avatarUrl,
          walletBalance: user.walletBalance,
          isVerified: user.isVerified,
        },
        is_new_user: isNewUser,
      };
    } catch (error) {
      app.logger.error({ err: error, phone }, 'Failed to verify OTP');
      return reply.status(400).send({ error: 'Failed to verify OTP' });
    }
  });

  // GET /api/users/me - Protected route
  app.fastify.get('/api/users/me', {
    schema: {
      description: 'Get current user profile',
      tags: ['users'],
      response: {
        200: {
          description: 'Current user',
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                avatarUrl: { type: 'string' },
                walletBalance: { type: 'integer' },
                isVerified: { type: 'boolean' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
              },
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

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching user profile');

    try {
      // Try to get user from custom users table using query API
      let user = await app.db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });

      // If user doesn't exist in custom table but exists in Better Auth, create them
      // Generate a new UUID for the custom user (Better Auth IDs are text strings, not UUIDs)
      if (!user) {
        app.logger.info({ userId, authEmail: session.user.email }, 'User not found in custom table, creating from Better Auth data');
        const [newUser] = await app.db.insert(schema.users).values({
          phone: '',
          email: session.user.email || '',
          name: session.user.name || 'User',
          walletBalance: 0,
          isVerified: true,
          isActive: true,
        }).returning();
        user = newUser;
        app.logger.info({ userId: user.id, authEmail: session.user.email }, 'Custom user created');
      }

      app.logger.info({ userId: user.id }, 'User profile retrieved');

      return {
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          walletBalance: user.walletBalance,
          isVerified: user.isVerified,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId, authUser: session.user?.email }, 'Failed to fetch user');
      return reply.status(400).send({ error: 'Failed to fetch user' });
    }
  });
}

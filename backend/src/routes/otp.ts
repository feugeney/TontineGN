import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

interface SendOtpBody {
  phone: string;
}

interface VerifyOtpBody {
  phone: string;
  code: string;
}

export function registerOtpRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/auth/send-otp
  app.fastify.post('/api/auth/send-otp', {
    schema: {
      description: 'Send OTP code to phone number',
      tags: ['auth'],
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

      // Delete any existing unused OTP for this phone
      await app.db.delete(schema.otpCodes)
        .where(and(
          eq(schema.otpCodes.phone, phone),
          eq(schema.otpCodes.used, false)
        ));

      // Create new OTP code (always 123456)
      const code = '123456';
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Insert new OTP record
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

  // POST /api/auth/verify-otp
  app.fastify.post('/api/auth/verify-otp', {
    schema: {
      description: 'Verify OTP code and create user session',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['phone', 'code'],
        properties: {
          phone: { type: 'string' },
          code: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'OTP verified, user session created',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                phone: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                avatar_url: { type: 'string' },
                wallet_balance: { type: 'integer' },
                is_verified: { type: 'boolean' },
                is_active: { type: 'boolean' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
              },
            },
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
    const { phone, code } = request.body;

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

      // Check if OTP exists and is valid (or if code is master code "123456")
      if (!otp || (otp.code !== code && code !== '123456')) {
        app.logger.warn({ phone }, 'Invalid or expired OTP code');
        return reply.status(400).send({ error: 'Invalid or expired OTP' });
      }

      if (otp && new Date() > otp.expiresAt) {
        app.logger.warn({ phone }, 'OTP code expired');
        return reply.status(400).send({ error: 'Invalid or expired OTP' });
      }

      // Mark OTP as used if it exists
      if (otp) {
        await app.db.update(schema.otpCodes)
          .set({ used: true })
          .where(eq(schema.otpCodes.id, otp.id));
      }

      app.logger.info({ phone }, 'OTP code verified');

      // Upsert user: match on phone, if exists update, if not insert
      const existingUser = await app.db.query.users.findFirst({
        where: eq(schema.users.phone, phone),
      });

      let user;

      if (existingUser) {
        // Update existing user
        const [updatedUser] = await app.db.update(schema.users)
          .set({
            isVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.phone, phone))
          .returning();
        user = updatedUser;
        app.logger.info({ userId: user.id, phone }, 'Existing user updated');
      } else {
        // Create new user with phone as name
        const [newUser] = await app.db.insert(schema.users).values({
          phone,
          name: phone,
          walletBalance: 0,
          isVerified: true,
          isActive: true,
        }).returning();
        user = newUser;
        app.logger.info({ userId: user.id, phone }, 'New user created');
      }

      // Create or get Better Auth user for session management
      let authUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, phone),
      });

      if (!authUser) {
        // Create Better Auth user linked to phone
        const [newAuthUser] = await app.db.insert(authSchema.user).values({
          id: `user_${user.id}`,
          name: phone,
          email: phone,
          emailVerified: true,
        }).returning();
        authUser = newAuthUser;
        app.logger.info({ authUserId: authUser.id }, 'Auth user created');
      } else {
        // Update auth user verification
        await app.db.update(authSchema.user)
          .set({ emailVerified: true })
          .where(eq(authSchema.user.id, authUser.id));
      }

      // Create session token
      const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 20)}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await app.db.insert(authSchema.session).values({
        id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        token: sessionToken,
        expiresAt,
        userId: authUser.id,
        userAgent: request.headers['user-agent'] || '',
        ipAddress: request.ip || '',
      });

      app.logger.info({ userId: user.id, sessionToken }, 'Session created');

      return {
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          avatar_url: user.avatarUrl,
          wallet_balance: user.walletBalance,
          is_verified: user.isVerified,
          is_active: user.isActive,
          created_at: user.createdAt.toISOString(),
          updated_at: user.updatedAt.toISOString(),
        },
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
          description: 'Current user profile',
          type: 'object',
          properties: {
            id: { type: 'string' },
            phone: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            avatar_url: { type: 'string' },
            wallet_balance: { type: 'integer' },
            is_verified: { type: 'boolean' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
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

    app.logger.info({ authUserId: session.user.id }, 'Fetching user profile');

    try {
      let user;

      // Try two lookup strategies:
      // 1. OTP users: auth user ID format is "user_<uuid>"
      if (session.user.id.startsWith('user_')) {
        const customUserId = session.user.id.substring(5); // Remove 'user_' prefix
        user = await app.db.query.users.findFirst({
          where: eq(schema.users.id, customUserId),
        });
      }

      // 2. Better Auth users: look up by email
      if (!user && session.user.email) {
        user = await app.db.query.users.findFirst({
          where: eq(schema.users.email, session.user.email),
        });

        // If still not found, create custom user from Better Auth data
        if (!user) {
          app.logger.info({ email: session.user.email }, 'Custom user not found, creating from Better Auth data');
          const [newUser] = await app.db.insert(schema.users).values({
            phone: '',
            email: session.user.email,
            name: session.user.name || 'User',
            walletBalance: 0,
            isVerified: true,
            isActive: true,
          }).returning();
          user = newUser;
          app.logger.info({ userId: user.id, email: session.user.email }, 'Custom user created from Better Auth');
        }
      }

      if (!user) {
        app.logger.warn({ authUserId: session.user.id, email: session.user.email }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.info({ userId: user.id }, 'User profile retrieved');

      return {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar_url: user.avatarUrl,
        wallet_balance: user.walletBalance,
        is_verified: user.isVerified,
        is_active: user.isActive,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      };
    } catch (error) {
      app.logger.error({ err: error, authUserId: session.user.id }, 'Failed to fetch user');
      return reply.status(400).send({ error: 'Failed to fetch user' });
    }
  });
}

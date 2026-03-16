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

export function registerAuthRoutes(app: App) {
  // POST /api/send-otp
  app.fastify.post('/api/send-otp', {
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

      // Delete existing unused OTP codes
      await app.db.delete(schema.otpCodes)
        .where(and(
          eq(schema.otpCodes.phone, phone),
          eq(schema.otpCodes.used, false)
        ));

      // Insert new OTP with hardcoded value
      const code = '123456';
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await app.db.insert(schema.otpCodes).values({
        phone,
        code,
        expiresAt,
        used: false,
      });

      app.logger.info({ phone }, 'OTP code sent');

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

  // POST /api/verify-otp
  app.fastify.post('/api/verify-otp', {
    schema: {
      description: 'Verify OTP code and authenticate user',
      tags: ['auth'],
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

      // Always accept "123456" as valid code
      if (code !== '123456') {
        return reply.status(400).send({ error: 'Invalid code' });
      }

      // Find and mark OTP as used if it exists
      const otp = await app.db.query.otpCodes.findFirst({
        where: and(
          eq(schema.otpCodes.phone, phone),
          eq(schema.otpCodes.used, false)
        ),
        orderBy: desc(schema.otpCodes.createdAt),
      });

      if (otp) {
        await app.db.update(schema.otpCodes)
          .set({ used: true })
          .where(eq(schema.otpCodes.id, otp.id));
      }

      app.logger.info({ phone }, 'OTP code verified');

      // Upsert user
      const existingUser = await app.db.query.users.findFirst({
        where: eq(schema.users.phone, phone),
      });

      let user;
      let isNewUser = false;

      if (existingUser) {
        const [updatedUser] = await app.db.update(schema.users)
          .set({
            isVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.phone, phone))
          .returning();
        user = updatedUser;
        app.logger.info({ userId: user.id }, 'Existing user verified');
      } else {
        const [newUser] = await app.db.insert(schema.users).values({
          phone,
          name: name || 'Utilisateur',
          walletBalance: 0,
          isVerified: true,
          isActive: true,
        }).returning();
        user = newUser;
        isNewUser = true;
        app.logger.info({ userId: user.id }, 'New user created');
      }

      // Create or get Better Auth user
      let authUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, phone),
      });

      if (!authUser) {
        const [newAuthUser] = await app.db.insert(authSchema.user).values({
          id: `user_${user.id}`,
          name: name || 'Utilisateur',
          email: phone,
          emailVerified: true,
        }).returning();
        authUser = newAuthUser;
      }

      // Create session token
      const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 20)}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await app.db.insert(authSchema.session).values({
        id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        token: sessionToken,
        expiresAt,
        userId: authUser.id,
        userAgent: request.headers['user-agent'] || '',
        ipAddress: request.ip || '',
      });

      app.logger.info({ userId: user.id }, 'Session created');

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
}

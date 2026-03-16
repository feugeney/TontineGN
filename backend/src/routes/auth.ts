import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

interface SendOtpBody {
  phone?: string;
  email?: string;
}

interface VerifyOtpBody {
  phone?: string;
  email?: string;
  code: string;
  name?: string;
}

export function registerAuthRoutes(app: App) {
  // POST /api/otp-auth/send-otp
  app.fastify.post('/api/otp-auth/send-otp', {
    schema: {
      description: 'Send OTP code to phone or email',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
          email: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            otp_code: { type: 'string' },
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
    const { phone, email } = request.body;
    app.logger.info({ phone, email }, 'Sending OTP code');

    try {
      if (!phone && !email) {
        return reply.status(400).send({ error: 'Phone or email is required' });
      }

      // Generate 6-digit OTP code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Delete existing unused OTP codes
      if (phone) {
        await app.db.delete(schema.otpCodes)
          .where(and(
            eq(schema.otpCodes.phone, phone),
            eq(schema.otpCodes.used, false)
          ));
      }
      if (email) {
        await app.db.delete(schema.otpCodes)
          .where(and(
            eq(schema.otpCodes.email, email),
            eq(schema.otpCodes.used, false)
          ));
      }

      // Insert new OTP
      await app.db.insert(schema.otpCodes).values({
        phone: phone || null,
        email: email || null,
        code,
        expiresAt,
        used: false,
      });

      app.logger.info({ phone, email }, 'OTP code sent');

      return {
        success: true,
        message: 'Code envoyé',
        otp_code: code,
      };
    } catch (error) {
      app.logger.error({ err: error, phone, email }, 'Failed to send OTP');
      return reply.status(400).send({ error: 'Failed to send OTP' });
    }
  });

  // POST /api/otp-auth/verify-otp
  app.fastify.post('/api/otp-auth/verify-otp', {
    schema: {
      description: 'Verify OTP code and authenticate user',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          phone: { type: 'string' },
          email: { type: 'string' },
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
    const { phone, email, code, name } = request.body;
    app.logger.info({ phone, email }, 'Verifying OTP code');

    try {
      if (!phone && !email || !code) {
        return reply.status(400).send({ error: 'Phone or email and code are required' });
      }

      // Verify OTP code
      const otp = await app.db.query.otpCodes.findFirst({
        where: and(
          phone ? eq(schema.otpCodes.phone, phone) : eq(schema.otpCodes.email, email!),
          eq(schema.otpCodes.code, code),
          eq(schema.otpCodes.used, false)
        ),
        orderBy: desc(schema.otpCodes.createdAt),
      });

      if (!otp || otp.expiresAt < new Date()) {
        return reply.status(400).send({ error: 'OTP invalide ou expiré' });
      }

      // Mark OTP as used
      await app.db.update(schema.otpCodes)
        .set({ used: true })
        .where(eq(schema.otpCodes.id, otp.id));

      app.logger.info({ phone, email }, 'OTP code verified');

      // Find or create user
      let user;
      let isNewUser = false;

      if (phone) {
        const existingUser = await app.db.query.users.findFirst({
          where: eq(schema.users.phone, phone),
        });

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
      } else if (email) {
        const existingUser = await app.db.query.users.findFirst({
          where: eq(schema.users.email, email),
        });

        if (existingUser) {
          const [updatedUser] = await app.db.update(schema.users)
            .set({
              isVerified: true,
              updatedAt: new Date(),
            })
            .where(eq(schema.users.email, email))
            .returning();
          user = updatedUser;
          app.logger.info({ userId: user.id }, 'Existing user verified');
        } else {
          const [newUser] = await app.db.insert(schema.users).values({
            email,
            phone: '',
            name: name || 'Utilisateur',
            walletBalance: 0,
            isVerified: true,
            isActive: true,
          }).returning();
          user = newUser;
          isNewUser = true;
          app.logger.info({ userId: user.id }, 'New user created');
        }
      }

      // Create or get Better Auth user
      const authEmail = email || phone || user.email;
      let authUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, authEmail),
      });

      if (!authUser) {
        const [newAuthUser] = await app.db.insert(authSchema.user).values({
          id: `user_${user.id}`,
          name: name || 'Utilisateur',
          email: authEmail,
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
        success: true,
        user: {
          id: String(user.id),
          phone: user.phone,
          email: user.email,
          name: user.name,
          avatar_url: user.avatarUrl,
          wallet_balance: user.walletBalance,
          is_verified: user.isVerified,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, phone, email }, 'Failed to verify OTP');
      return reply.status(400).send({ error: 'Failed to verify OTP' });
    }
  });
}

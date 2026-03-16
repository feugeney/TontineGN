import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerNotificationRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/notifications
  app.fastify.get('/api/notifications', {
    schema: {
      description: 'Get all notifications for current user',
      tags: ['notifications'],
      response: {
        200: {
          type: 'object',
          properties: {
            notifications: { type: 'array', items: { type: 'object' } },
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
      const user = await app.db.query.users.findFirst({
        where: eq(schema.users.email, session.user.email),
      });
      userId = user?.id || null;
    }

    if (!userId) {
      return { notifications: [] };
    }

    app.logger.info({ userId }, 'Fetching notifications');

    try {
      const notifications = await app.db.query.notifications.findMany({
        where: eq(schema.notifications.userId, userId as any),
        orderBy: desc(schema.notifications.createdAt),
      });

      return {
        notifications: notifications.map((n: any) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          type: n.type,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch notifications');
      return reply.status(400).send({ error: 'Failed to fetch notifications' });
    }
  });

  // POST /api/notifications/:id/read
  app.fastify.post('/api/notifications/:id/read', {
    schema: {
      description: 'Mark notification as read',
      tags: ['notifications'],
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

    const userId = session.user.id.startsWith('user_')
      ? session.user.id.substring(5)
      : session.user.id;

    const { id } = request.params;

    app.logger.info({ userId, notificationId: id }, 'Marking notification as read');

    try {
      const notification = await app.db.query.notifications.findFirst({
        where: eq(schema.notifications.id, id as any),
      });

      if (!notification) {
        return reply.status(404).send({ error: 'Notification not found' });
      }

      if (notification.userId !== userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      await app.db.update(schema.notifications)
        .set({ isRead: true })
        .where(eq(schema.notifications.id, id as any));

      return { success: true };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to mark notification as read');
      return reply.status(400).send({ error: 'Failed to mark notification as read' });
    }
  });
}

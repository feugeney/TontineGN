import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { ensureUserExists } from './users.js';

interface NotificationQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export function registerNotificationRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Get notifications
  app.fastify.get('/api/notifications', {
    schema: {
      description: 'Get notifications for authenticated user',
      tags: ['notifications'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          unreadOnly: { type: 'boolean' },
        },
      },
      response: {
        200: {
          description: 'Notifications list',
          type: 'object',
          properties: {
            notifications: { type: 'array' },
            unreadCount: { type: 'number' },
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

    const query = request.query as NotificationQuery;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 20);
    const offset = (page - 1) * limit;

    app.logger.info({ userId: session.user.id, page, limit }, 'Fetching notifications');

    try {
      // Ensure user exists
      await ensureUserExists(app, session.user.id, session.user);

      let allNotifications = await app.db.query.notifications.findMany({
        where: eq(schema.notifications.userId, session.user.id),
      });

      if (query.unreadOnly) {
        allNotifications = allNotifications.filter(n => !n.isRead);
      }

      const total = allNotifications.length;

      const notifications = allNotifications
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(offset, offset + limit);

      // Count unread
      const unreadCount = allNotifications.filter(n => !n.isRead).length;

      return {
        notifications: notifications.map(formatNotification),
        unreadCount,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch notifications');
      return reply.status(400).send({ error: 'Failed to fetch notifications' });
    }
  });

  // Mark notification as read
  app.fastify.put('/api/notifications/:id/read', {
    schema: {
      description: 'Mark notification as read',
      tags: ['notifications'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Notification marked as read',
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

    const { id } = request.params as { id: string };
    app.logger.info({ userId: session.user.id, notificationId: id }, 'Marking notification as read');

    try {
      const notification = await app.db.query.notifications.findFirst({
        where: eq(schema.notifications.id, id),
      });

      if (!notification) {
        return reply.status(404).send({ error: 'Notification not found' });
      }

      if (notification.userId !== session.user.id) {
        return reply.status(404).send({ error: 'Notification not found' });
      }

      await app.db.update(schema.notifications)
        .set({ isRead: true })
        .where(eq(schema.notifications.id, id));

      app.logger.info({ notificationId: id }, 'Notification marked as read');

      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, notificationId: id }, 'Failed to mark as read');
      return reply.status(400).send({ error: 'Failed to mark as read' });
    }
  });

  // Mark all notifications as read
  app.fastify.put('/api/notifications/read-all', {
    schema: {
      description: 'Mark all notifications as read',
      tags: ['notifications'],
      response: {
        200: {
          description: 'All notifications marked as read',
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

    app.logger.info({ userId: session.user.id }, 'Marking all notifications as read');

    try {
      // Ensure user exists
      await ensureUserExists(app, session.user.id, session.user);

      await app.db.update(schema.notifications)
        .set({ isRead: true })
        .where(eq(schema.notifications.userId, session.user.id));

      app.logger.info({ userId: session.user.id }, 'All notifications marked as read');

      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to mark all as read');
      return reply.status(400).send({ error: 'Failed to mark all as read' });
    }
  });
}

function formatNotification(n: typeof schema.notifications.$inferSelect) {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    body: n.body,
    type: n.type,
    isRead: n.isRead,
    data: n.data,
    createdAt: n.createdAt.toISOString(),
  };
}

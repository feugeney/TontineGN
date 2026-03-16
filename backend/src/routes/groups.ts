import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { ensureUserExists } from './users.js';

interface CreateGroupBody {
  name: string;
  description?: string;
  contributionAmount: number;
  frequency: string;
  maxMembers?: number;
  startDate?: string;
  penaltyRate?: number;
  penaltyGraceDays?: number;
}

interface UpdateGroupBody {
  name?: string;
  description?: string;
  status?: string;
}

interface InviteBody {
  phone: string;
}

interface JoinBody {
  token: string;
}

interface UpdateMemberRoleBody {
  role: string;
}

function generateInvitationToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function registerGroupRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Get groups for authenticated user
  app.fastify.get('/api/groups', {
    schema: {
      description: 'Get groups where user is a member',
      tags: ['groups'],
      response: {
        200: {
          description: 'Groups list',
          type: 'object',
          properties: {
            groups: { type: 'array' },
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

    app.logger.info({ userId: session.user.id }, 'Fetching user groups');

    try {
      const groups = await app.db.query.tontineGroups.findMany({
        where: (g, { eq }) => eq(g.createdBy, session.user.id),
        with: {
          members: true,
        },
      });

      // Also get groups where user is a member
      const memberGroups = await app.db.query.groupMembers.findMany({
        where: (gm, { eq }) => eq(gm.userId, session.user.id),
        with: {
          group: {
            with: {
              members: true,
            },
          },
        },
      });

      const allGroups = [
        ...groups,
        ...memberGroups.map(mg => mg.group),
      ];

      // Remove duplicates
      const uniqueGroups = Array.from(
        new Map(allGroups.map(g => [g.id, g])).values()
      );

      const formatted = uniqueGroups.map(group => {
        const member = group.members.find(m => m.userId === session.user.id);
        return formatGroupSummary(group, group.members.length, member?.role || 'member');
      });

      return { groups: formatted };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch groups');
      return reply.status(400).send({ error: 'Failed to fetch groups' });
    }
  });

  // Create group
  app.fastify.post('/api/groups', {
    schema: {
      description: 'Create a new tontine group',
      tags: ['groups'],
      body: {
        type: 'object',
        required: ['name', 'contributionAmount', 'frequency'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          contributionAmount: { type: 'number' },
          frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
          maxMembers: { type: 'integer' },
          startDate: { type: 'string' },
          penaltyRate: { type: 'number' },
          penaltyGraceDays: { type: 'integer' },
        },
      },
      response: {
        201: {
          description: 'Group created',
          type: 'object',
          properties: {
            group: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
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

    const body = request.body as CreateGroupBody;
    app.logger.info({ userId: session.user.id, groupName: body.name }, 'Creating group');

    try {
      const [group] = await app.db.insert(schema.tontineGroups).values({
        name: body.name,
        description: body.description,
        contributionAmount: Math.floor(body.contributionAmount),
        frequency: body.frequency,
        maxMembers: body.maxMembers || 12,
        startDate: body.startDate ? new Date(body.startDate).toISOString().split('T')[0] as any : undefined,
        penaltyRate: body.penaltyRate ? String(body.penaltyRate) : '5.00',
        penaltyGraceDays: body.penaltyGraceDays || 3,
        createdBy: session.user.id as any,
      }).returning();

      // Add creator as admin member with payout_order 1
      const [member] = await app.db.insert(schema.groupMembers).values({
        groupId: group.id,
        userId: session.user.id as any,
        role: 'admin',
        payoutOrder: 1,
      }).returning();

      app.logger.info({ groupId: group.id, userId: session.user.id }, 'Group created successfully');

      return reply.status(201).send({
        group: formatGroup(group),
      });
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupName: body.name }, 'Failed to create group');
      return reply.status(400).send({ error: 'Failed to create group' });
    }
  });

  // Get group details
  app.fastify.get('/api/groups/:id', {
    schema: {
      description: 'Get group details',
      tags: ['groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Group details',
          type: 'object',
          properties: {
            group: { type: 'object' },
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
    app.logger.info({ userId: session.user.id, groupId: id }, 'Fetching group details');

    try {
      const group = await app.db.query.tontineGroups.findFirst({
        where: eq(schema.tontineGroups.id, id),
        with: {
          members: {
            with: {
              user: true,
            },
          },
          contributions: true,
        },
      });

      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      // Check if user is a member
      const isMember = group.members.some(m => m.userId === session.user.id);
      if (!isMember) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      // Calculate details
      const currentCycle = group.contributions.length > 0
        ? Math.max(...group.contributions.map(c => c.cycleNumber))
        : 1;

      const totalCollected = group.contributions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0);

      const userContribution = group.contributions.find(
        c => c.userId === session.user.id && c.cycleNumber === currentCycle
      );

      // Calculate next due date based on frequency and start date
      const startDate = new Date(group.startDate || new Date());
      let nextDueDate = new Date(startDate);
      if (group.frequency === 'daily') {
        nextDueDate.setDate(nextDueDate.getDate() + currentCycle);
      } else if (group.frequency === 'weekly') {
        nextDueDate.setDate(nextDueDate.getDate() + currentCycle * 7);
      } else if (group.frequency === 'monthly') {
        nextDueDate.setMonth(nextDueDate.getMonth() + currentCycle);
      }

      const memberUser = group.members.find(m => m.userId === session.user.id);

      return {
        group: {
          ...formatGroup(group),
          members: group.members.map(m => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            phone: m.user.phone,
            avatarUrl: m.user.avatarUrl,
            role: m.role,
            payoutOrder: m.payoutOrder,
            hasReceivedPayout: m.hasReceivedPayout,
            joinedAt: m.joinedAt.toISOString(),
          })),
          currentCycle,
          nextDueDate: nextDueDate.toISOString().split('T')[0],
          totalCollected,
          myRole: memberUser?.role || 'member',
          myContributionStatus: userContribution?.status || 'pending',
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to fetch group');
      return reply.status(400).send({ error: 'Failed to fetch group' });
    }
  });

  // Update group
  app.fastify.put('/api/groups/:id', {
    schema: {
      description: 'Update group',
      tags: ['groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Group updated',
          type: 'object',
          properties: {
            group: { type: 'object' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        403: {
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
    const body = request.body as UpdateGroupBody;
    app.logger.info({ userId: session.user.id, groupId: id }, 'Updating group');

    try {
      const group = await app.db.query.tontineGroups.findFirst({
        where: eq(schema.tontineGroups.id, id),
        with: {
          members: true,
        },
      });

      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      const member = group.members.find(m => m.userId === session.user.id);
      if (!member || member.role !== 'admin') {
        return reply.status(403).send({ error: 'Only admins can update group' });
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (body.name) updates.name = body.name;
      if (body.description) updates.description = body.description;
      if (body.status) updates.status = body.status;

      const [updated] = await app.db.update(schema.tontineGroups)
        .set(updates)
        .where(eq(schema.tontineGroups.id, id))
        .returning();

      app.logger.info({ groupId: id, userId: session.user.id }, 'Group updated');

      return {
        group: formatGroup(updated),
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to update group');
      return reply.status(400).send({ error: 'Failed to update group' });
    }
  });

  // Delete group
  app.fastify.delete('/api/groups/:id', {
    schema: {
      description: 'Delete group',
      tags: ['groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Group deleted',
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
        403: {
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
    app.logger.info({ userId: session.user.id, groupId: id }, 'Deleting group');

    try {
      const group = await app.db.query.tontineGroups.findFirst({
        where: eq(schema.tontineGroups.id, id),
        with: {
          members: true,
        },
      });

      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      const member = group.members.find(m => m.userId === session.user.id);
      if (!member || member.role !== 'admin') {
        return reply.status(403).send({ error: 'Only admins can delete group' });
      }

      await app.db.delete(schema.tontineGroups).where(eq(schema.tontineGroups.id, id));

      app.logger.info({ groupId: id, userId: session.user.id }, 'Group deleted');

      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to delete group');
      return reply.status(400).send({ error: 'Failed to delete group' });
    }
  });

  // Get group members
  app.fastify.get('/api/groups/:id/members', {
    schema: {
      description: 'Get group members',
      tags: ['groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Members list',
          type: 'object',
          properties: {
            members: { type: 'array' },
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

    try {
      const members = await app.db.query.groupMembers.findMany({
        where: eq(schema.groupMembers.groupId, id),
        with: {
          user: true,
        },
      });

      if (members.length === 0) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      // Check if user is a member
      const isMember = members.some(m => m.userId === session.user.id);
      if (!isMember) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      return {
        members: members.map(m => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          phone: m.user.phone,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          payoutOrder: m.payoutOrder,
          hasReceivedPayout: m.hasReceivedPayout,
          joinedAt: m.joinedAt.toISOString(),
        })),
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to fetch members');
      return reply.status(400).send({ error: 'Failed to fetch members' });
    }
  });

  // Invite to group
  app.fastify.post('/api/groups/:id/invite', {
    schema: {
      description: 'Invite user to group',
      tags: ['groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string' },
        },
      },
      response: {
        201: {
          description: 'Invitation created',
          type: 'object',
          properties: {
            invitation: { type: 'object' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        403: {
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
    const { phone } = request.body as InviteBody;
    app.logger.info({ userId: session.user.id, groupId: id, phone }, 'Inviting user to group');

    try {
      const member = await app.db.query.groupMembers.findFirst({
        where: and(
          eq(schema.groupMembers.groupId, id),
          eq(schema.groupMembers.userId, session.user.id)
        ),
      });

      if (!member || (member.role !== 'admin' && member.role !== 'treasurer')) {
        return reply.status(403).send({ error: 'Only admins or treasurers can invite' });
      }

      const token = generateInvitationToken();
      const expiresAt = addDays(new Date(), 7);

      const [invitation] = await app.db.insert(schema.invitations).values({
        groupId: id,
        invitedBy: session.user.id as any,
        phone,
        token,
        expiresAt,
      }).returning();

      app.logger.info({ invitationId: invitation.id, groupId: id, phone }, 'Invitation created');

      return reply.status(201).send({
        invitation: {
          id: invitation.id,
          groupId: invitation.groupId,
          phone: invitation.phone,
          status: invitation.status,
          token: invitation.token,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
        },
      });
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to create invitation');
      return reply.status(400).send({ error: 'Failed to create invitation' });
    }
  });

  // Join group
  app.fastify.post('/api/groups/:id/join', {
    schema: {
      description: 'Join group via invitation token',
      tags: ['groups'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Joined group',
          type: 'object',
          properties: {
            member: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
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

    const { id } = request.params as { id: string };
    const { token } = request.body as JoinBody;
    app.logger.info({ userId: session.user.id, groupId: id }, 'Joining group via invitation');

    try {
      const invitation = await app.db.query.invitations.findFirst({
        where: eq(schema.invitations.token, token),
      });

      if (!invitation || invitation.groupId !== id) {
        return reply.status(400).send({ error: 'Invalid invitation token' });
      }

      if (invitation.expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Invitation expired' });
      }

      if (invitation.status !== 'pending') {
        return reply.status(400).send({ error: 'Invitation already used' });
      }

      // Get next payout order
      const members = await app.db.query.groupMembers.findMany({
        where: eq(schema.groupMembers.groupId, id),
      });

      const maxPayoutOrder = Math.max(
        0,
        ...members.map(m => m.payoutOrder || 0)
      );

      const [newMember] = await app.db.insert(schema.groupMembers).values({
        groupId: id,
        userId: session.user.id as any,
        role: 'member',
        payoutOrder: maxPayoutOrder + 1,
      }).returning();

      // Mark invitation as accepted
      await app.db.update(schema.invitations)
        .set({ status: 'accepted' })
        .where(eq(schema.invitations.id, invitation.id));

      app.logger.info({ memberId: newMember.id, groupId: id, userId: session.user.id }, 'Joined group');

      return {
        member: {
          id: newMember.id,
          userId: newMember.userId,
          groupId: newMember.groupId,
          role: newMember.role,
          payoutOrder: newMember.payoutOrder,
          hasReceivedPayout: newMember.hasReceivedPayout,
          joinedAt: newMember.joinedAt.toISOString(),
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to join group');
      return reply.status(400).send({ error: 'Failed to join group' });
    }
  });

  // Update member role
  app.fastify.put('/api/groups/:id/members/:userId/role', {
    schema: {
      description: 'Update member role',
      tags: ['groups'],
      params: {
        type: 'object',
        required: ['id', 'userId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['admin', 'treasurer', 'member'] },
        },
      },
      response: {
        200: {
          description: 'Role updated',
          type: 'object',
          properties: {
            member: { type: 'object' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        403: {
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

    const { id, userId } = request.params as { id: string; userId: string };
    const { role } = request.body as UpdateMemberRoleBody;
    app.logger.info({ userId: session.user.id, groupId: id, targetUserId: userId }, 'Updating member role');

    try {
      const member = await app.db.query.groupMembers.findFirst({
        where: and(
          eq(schema.groupMembers.groupId, id),
          eq(schema.groupMembers.userId, session.user.id)
        ),
      });

      if (!member || member.role !== 'admin') {
        return reply.status(403).send({ error: 'Only admins can update roles' });
      }

      const [updated] = await app.db.update(schema.groupMembers)
        .set({ role })
        .where(and(
          eq(schema.groupMembers.groupId, id),
          eq(schema.groupMembers.userId, userId)
        ))
        .returning();

      app.logger.info({ groupId: id, memberId: updated.id }, 'Member role updated');

      return {
        member: {
          id: updated.id,
          userId: updated.userId,
          role: updated.role,
          payoutOrder: updated.payoutOrder,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to update role');
      return reply.status(400).send({ error: 'Failed to update role' });
    }
  });

  // Delete member
  app.fastify.delete('/api/groups/:id/members/:userId', {
    schema: {
      description: 'Remove member from group',
      tags: ['groups'],
      params: {
        type: 'object',
        required: ['id', 'userId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Member removed',
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
        403: {
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

    const { id, userId } = request.params as { id: string; userId: string };
    app.logger.info({ userId: session.user.id, groupId: id, targetUserId: userId }, 'Removing member');

    try {
      const member = await app.db.query.groupMembers.findFirst({
        where: and(
          eq(schema.groupMembers.groupId, id),
          eq(schema.groupMembers.userId, session.user.id)
        ),
      });

      if (!member || member.role !== 'admin') {
        return reply.status(403).send({ error: 'Only admins can remove members' });
      }

      await app.db.delete(schema.groupMembers).where(and(
        eq(schema.groupMembers.groupId, id),
        eq(schema.groupMembers.userId, userId)
      ));

      app.logger.info({ groupId: id, userId }, 'Member removed');

      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, groupId: id }, 'Failed to remove member');
      return reply.status(400).send({ error: 'Failed to remove member' });
    }
  });
}

function formatGroup(group: typeof schema.tontineGroups.$inferSelect) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    avatarUrl: group.avatarUrl,
    contributionAmount: group.contributionAmount,
    frequency: group.frequency,
    maxMembers: group.maxMembers,
    status: group.status,
    startDate: group.startDate ? String(group.startDate) : null,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

function formatGroupSummary(group: typeof schema.tontineGroups.$inferSelect, memberCount: number, myRole: string) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    avatarUrl: group.avatarUrl,
    contributionAmount: group.contributionAmount,
    frequency: group.frequency,
    maxMembers: group.maxMembers,
    memberCount,
    status: group.status,
    myRole,
    startDate: group.startDate ? String(group.startDate) : null,
    createdAt: group.createdAt.toISOString(),
  };
}

import { pgTable, text, timestamp, uuid, boolean, integer, numeric, json } from 'drizzle-orm/pg-core';

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone'),
  email: text('email'),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  email: text('email'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  walletBalance: integer('wallet_balance').notNull().default(0),
  isVerified: boolean('is_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  pinHash: text('pin_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tontineGroups = pgTable('tontine_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  contributionAmount: integer('contribution_amount').notNull(),
  frequency: text('frequency').notNull(),
  maxMembers: integer('max_members'),
  status: text('status').notNull().default('pending'),
  startDate: timestamp('start_date', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  penaltyRate: numeric('penalty_rate'),
  penaltyGraceDays: integer('penalty_grace_days'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable('group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => tontineGroups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  payoutOrder: integer('payout_order'),
  hasReceivedPayout: boolean('has_received_payout').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contributions = pgTable('contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => tontineGroups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cycleNumber: integer('cycle_number').notNull(),
  amount: integer('amount').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: text('status').notNull().default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  penaltyAmount: integer('penalty_amount').default(0),
  paymentMethod: text('payment_method'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  balanceBefore: integer('balance_before'),
  balanceAfter: integer('balance_after'),
  status: text('status').notNull().default('pending'),
  reference: text('reference'),
  description: text('description'),
  paymentProvider: text('payment_provider'),
  providerReference: text('provider_reference'),
  groupId: uuid('group_id').references(() => tontineGroups.id, { onDelete: 'set null' }),
  relatedUserId: uuid('related_user_id').references(() => users.id, { onDelete: 'set null' }),
  fee: integer('fee').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: text('type'),
  data: json('data'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => tontineGroups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cycleNumber: integer('cycle_number').notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => tontineGroups.id, { onDelete: 'cascade' }),
  invitedUserId: uuid('invited_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  token: text('token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

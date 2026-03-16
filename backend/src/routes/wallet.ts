import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { verifyPin } from '../utils/crypto.js';
import { generateTransactionReference, generateProviderReference } from '../utils/reference.js';
import { ensureUserExists } from './users.js';

interface DepositBody {
  amount: number;
  paymentMethod: string;
  phoneNumber: string;
}

interface WithdrawBody {
  amount: number;
  paymentMethod: string;
  phoneNumber: string;
  pin: string;
}

interface SendBody {
  recipientPhone: string;
  amount: number;
  pin: string;
  note?: string;
}

interface TransactionQuery {
  page?: number;
  limit?: number;
  type?: string;
}

export function registerWalletRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Get wallet balance
  app.fastify.get('/api/wallet/balance', {
    schema: {
      description: 'Get wallet balance',
      tags: ['wallet'],
      response: {
        200: {
          description: 'Wallet balance',
          type: 'object',
          properties: {
            balance: { type: 'number' },
            currency: { type: 'string' },
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

    app.logger.info({ userId: session.user.id }, 'Fetching wallet balance');

    try {
      const user = await ensureUserExists(app, session.user.id, session.user);

      return {
        balance: user.walletBalance || 0,
        currency: 'GNF',
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch balance');
      return reply.status(400).send({ error: 'Failed to fetch balance' });
    }
  });

  // Deposit
  app.fastify.post('/api/wallet/deposit', {
    schema: {
      description: 'Deposit money to wallet',
      tags: ['wallet'],
      body: {
        type: 'object',
        required: ['amount', 'paymentMethod', 'phoneNumber'],
        properties: {
          amount: { type: 'number' },
          paymentMethod: { type: 'string', enum: ['mtn_momo', 'orange_money'] },
          phoneNumber: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Deposit successful',
          type: 'object',
          properties: {
            transaction: { type: 'object' },
            message: { type: 'string' },
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

    const { amount, paymentMethod, phoneNumber } = request.body as DepositBody;
    app.logger.info({ userId: session.user.id, amount, paymentMethod }, 'Processing deposit');

    try {
      if (amount <= 0) {
        return reply.status(400).send({ error: 'Amount must be positive' });
      }

      const user = await ensureUserExists(app, session.user.id, session.user);

      // Simulate payment completion
      const reference = generateTransactionReference();
      const providerReference = generateProviderReference(paymentMethod);

      // Create transaction atomically
      const [transaction] = await app.db.insert(schema.transactions).values({
        userId: session.user.id as any,
        type: 'deposit',
        amount: Math.floor(amount),
        balanceBefore: user.walletBalance,
        balanceAfter: user.walletBalance + Math.floor(amount),
        status: 'completed',
        reference,
        description: `Deposit via ${paymentMethod}`,
        paymentProvider: paymentMethod,
        providerReference,
      }).returning();

      // Update wallet balance
      const [updatedUser] = await app.db.update(schema.users)
        .set({ walletBalance: user.walletBalance + Math.floor(amount) })
        .where(eq(schema.users.id, session.user.id))
        .returning();

      app.logger.info({ userId: session.user.id, transactionId: transaction.id, amount }, 'Deposit completed');

      return {
        transaction: formatTransaction(transaction),
        message: 'Deposit successful',
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, amount }, 'Deposit failed');
      return reply.status(400).send({ error: 'Deposit failed' });
    }
  });

  // Withdraw
  app.fastify.post('/api/wallet/withdraw', {
    schema: {
      description: 'Withdraw money from wallet',
      tags: ['wallet'],
      body: {
        type: 'object',
        required: ['amount', 'paymentMethod', 'phoneNumber', 'pin'],
        properties: {
          amount: { type: 'number' },
          paymentMethod: { type: 'string', enum: ['mtn_momo', 'orange_money'] },
          phoneNumber: { type: 'string' },
          pin: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Withdrawal successful',
          type: 'object',
          properties: {
            transaction: { type: 'object' },
            message: { type: 'string' },
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

    const { amount, paymentMethod, phoneNumber, pin } = request.body as WithdrawBody;
    app.logger.info({ userId: session.user.id, amount, paymentMethod }, 'Processing withdrawal');

    try {
      if (amount <= 0) {
        return reply.status(400).send({ error: 'Amount must be positive' });
      }

      const user = await ensureUserExists(app, session.user.id, session.user);

      if (!user.pinHash || !verifyPin(pin, user.pinHash)) {
        return reply.status(400).send({ error: 'Invalid PIN' });
      }

      const withdrawAmount = Math.floor(amount);
      if (user.walletBalance < withdrawAmount) {
        return reply.status(400).send({ error: 'Insufficient balance' });
      }

      // Create transaction
      const reference = generateTransactionReference();
      const providerReference = generateProviderReference(paymentMethod);

      const [transaction] = await app.db.insert(schema.transactions).values({
        userId: session.user.id as any,
        type: 'withdrawal',
        amount: withdrawAmount,
        balanceBefore: user.walletBalance,
        balanceAfter: user.walletBalance - withdrawAmount,
        status: 'completed',
        reference,
        description: `Withdrawal via ${paymentMethod}`,
        paymentProvider: paymentMethod,
        providerReference,
      }).returning();

      // Update wallet balance
      const [updatedUser] = await app.db.update(schema.users)
        .set({ walletBalance: user.walletBalance - withdrawAmount })
        .where(eq(schema.users.id, session.user.id))
        .returning();

      app.logger.info({ userId: session.user.id, transactionId: transaction.id, amount }, 'Withdrawal completed');

      return {
        transaction: formatTransaction(transaction),
        message: 'Withdrawal successful',
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, amount }, 'Withdrawal failed');
      return reply.status(400).send({ error: 'Withdrawal failed' });
    }
  });

  // Send money
  app.fastify.post('/api/wallet/send', {
    schema: {
      description: 'Send money to another user',
      tags: ['wallet'],
      body: {
        type: 'object',
        required: ['recipientPhone', 'amount', 'pin'],
        properties: {
          recipientPhone: { type: 'string' },
          amount: { type: 'number' },
          pin: { type: 'string' },
          note: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Transfer successful',
          type: 'object',
          properties: {
            transaction: { type: 'object' },
            message: { type: 'string' },
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

    const { recipientPhone, amount, pin, note } = request.body as SendBody;
    app.logger.info({ userId: session.user.id, recipientPhone, amount }, 'Processing transfer');

    try {
      if (amount <= 0) {
        return reply.status(400).send({ error: 'Amount must be positive' });
      }

      const user = await ensureUserExists(app, session.user.id, session.user);

      if (!user.pinHash || !verifyPin(pin, user.pinHash)) {
        return reply.status(400).send({ error: 'Invalid PIN' });
      }

      // Find recipient
      const recipient = await app.db.query.users.findFirst({
        where: eq(schema.users.phone, recipientPhone),
      });

      if (!recipient) {
        return reply.status(400).send({ error: 'Recipient not found' });
      }

      if (recipient.id === session.user.id) {
        return reply.status(400).send({ error: 'Cannot send to yourself' });
      }

      const sendAmount = Math.floor(amount);
      if (user.walletBalance < sendAmount) {
        return reply.status(400).send({ error: 'Insufficient balance' });
      }

      // Create send and receive transactions in transaction
      const reference = generateTransactionReference();

      const [sendTxn] = await app.db.insert(schema.transactions).values({
        userId: session.user.id as any,
        type: 'send',
        amount: sendAmount,
        balanceBefore: user.walletBalance,
        balanceAfter: user.walletBalance - sendAmount,
        status: 'completed',
        reference,
        description: note || `Transfer to ${recipient.name}`,
        relatedUserId: recipient.id as any,
      }).returning();

      const [receiveTxn] = await app.db.insert(schema.transactions).values({
        userId: recipient.id as any,
        type: 'receive',
        amount: sendAmount,
        balanceBefore: recipient.walletBalance,
        balanceAfter: recipient.walletBalance + sendAmount,
        status: 'completed',
        reference,
        description: note || `Transfer from ${user.name}`,
        relatedUserId: session.user.id as any,
      }).returning();

      // Update both users' balances
      await app.db.update(schema.users)
        .set({ walletBalance: user.walletBalance - sendAmount })
        .where(eq(schema.users.id, session.user.id));

      await app.db.update(schema.users)
        .set({ walletBalance: recipient.walletBalance + sendAmount })
        .where(eq(schema.users.id, recipient.id));

      app.logger.info({ userId: session.user.id, recipientId: recipient.id, amount }, 'Transfer completed');

      return {
        transaction: formatTransaction(sendTxn),
        message: 'Transfer successful',
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, recipientPhone, amount }, 'Transfer failed');
      return reply.status(400).send({ error: 'Transfer failed' });
    }
  });

  // Get transactions
  app.fastify.get('/api/wallet/transactions', {
    schema: {
      description: 'Get wallet transactions',
      tags: ['wallet'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          type: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Transactions list',
          type: 'object',
          properties: {
            transactions: { type: 'array' },
            total: { type: 'number' },
            page: { type: 'number' },
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

    const query = request.query as TransactionQuery;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 20);
    const offset = (page - 1) * limit;

    app.logger.info({ userId: session.user.id, page, limit }, 'Fetching transactions');

    try {
      let conditions = [eq(schema.transactions.userId, session.user.id)];
      if (query.type) {
        conditions.push(eq(schema.transactions.type, query.type));
      }

      const allTransactions = await app.db
        .select()
        .from(schema.transactions)
        .where(and(...conditions));

      const total = allTransactions.length;

      const transactions = allTransactions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(offset, offset + limit);

      return {
        transactions: transactions.map(formatTransaction),
        total,
        page,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch transactions');
      return reply.status(400).send({ error: 'Failed to fetch transactions' });
    }
  });
}

function formatTransaction(txn: typeof schema.transactions.$inferSelect) {
  return {
    id: txn.id,
    userId: txn.userId,
    type: txn.type,
    amount: txn.amount,
    fee: txn.fee,
    balanceBefore: txn.balanceBefore,
    balanceAfter: txn.balanceAfter,
    status: txn.status,
    reference: txn.reference,
    description: txn.description,
    paymentProvider: txn.paymentProvider,
    createdAt: txn.createdAt.toISOString(),
  };
}

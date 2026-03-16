import crypto from 'crypto';

export function generateTransactionReference(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

export function generateProviderReference(provider: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  const prefix = provider === 'mtn_momo' ? 'MOMO' : 'OM';
  return `${prefix}-${timestamp}-${random}`;
}

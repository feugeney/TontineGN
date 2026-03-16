import { createApplication } from '@specific-dev/framework';
import * as schema from './schema/schema.js';

const app = await createApplication(schema);

async function seed() {
  app.logger.info('Starting seed...');

  // Clear existing data
  await app.db.delete(schema.otpCodes);
  await app.db.delete(schema.invitations);
  await app.db.delete(schema.notifications);
  await app.db.delete(schema.payouts);
  await app.db.delete(schema.contributions);
  await app.db.delete(schema.transactions);
  await app.db.delete(schema.groupMembers);
  await app.db.delete(schema.tontineGroups);
  await app.db.delete(schema.users);

  // Create users
  const users = await app.db.insert(schema.users).values([
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      phone: '+224620000001',
      name: 'Mamadou Diallo',
      avatarUrl: 'https://i.pravatar.cc/150?img=1',
      walletBalance: 250000,
      isVerified: true,
      isActive: true,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      phone: '+224620000002',
      name: 'Fatoumata Bah',
      avatarUrl: 'https://i.pravatar.cc/150?img=2',
      walletBalance: 180000,
      isVerified: true,
      isActive: true,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      phone: '+224620000003',
      name: 'Ibrahima Sow',
      avatarUrl: 'https://i.pravatar.cc/150?img=3',
      walletBalance: 500000,
      isVerified: true,
      isActive: true,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      phone: '+224620000004',
      name: 'Mariama Camara',
      avatarUrl: 'https://i.pravatar.cc/150?img=4',
      walletBalance: 75000,
      isVerified: true,
      isActive: true,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      phone: '+224620000005',
      name: 'Oumar Barry',
      avatarUrl: 'https://i.pravatar.cc/150?img=5',
      walletBalance: 320000,
      isVerified: true,
      isActive: true,
    },
  ]).returning();

  const [mamadou, fatoumata, ibrahima, mariama, oumar] = users;

  app.logger.info('Users created');

  // Create groups
  const groups = await app.db.insert(schema.tontineGroups).values([
    {
      name: 'Tontine Famille Diallo',
      description: 'Tontine mensuelle de la famille Diallo',
      contributionAmount: 50000,
      frequency: 'monthly',
      maxMembers: 6,
      status: 'active',
      startDate: new Date('2024-01-01') as any,
      createdBy: mamadou.id,
      penaltyRate: '5.00',
      penaltyGraceDays: 3,
    },
    {
      name: 'Épargne Quartier Madina',
      description: 'Épargne hebdomadaire du quartier Madina',
      contributionAmount: 25000,
      frequency: 'weekly',
      maxMembers: 8,
      status: 'active',
      startDate: new Date('2024-01-08') as any,
      createdBy: fatoumata.id,
      penaltyRate: '5.00',
      penaltyGraceDays: 3,
    },
    {
      name: 'Association Femmes Conakry',
      description: 'Association d\'épargne des femmes de Conakry',
      contributionAmount: 100000,
      frequency: 'monthly',
      maxMembers: 10,
      status: 'pending',
      startDate: new Date('2024-03-01') as any,
      createdBy: mariama.id,
      penaltyRate: '5.00',
      penaltyGraceDays: 3,
    },
  ]).returning();

  const [group1, group2, group3] = groups;

  app.logger.info('Groups created');

  // Create group members
  await app.db.insert(schema.groupMembers).values([
    // Group 1: Tontine Famille Diallo
    {
      groupId: group1.id,
      userId: mamadou.id,
      role: 'admin',
      payoutOrder: 1,
    },
    {
      groupId: group1.id,
      userId: fatoumata.id,
      role: 'member',
      payoutOrder: 2,
    },
    {
      groupId: group1.id,
      userId: ibrahima.id,
      role: 'treasurer',
      payoutOrder: 3,
    },
    // Group 2: Épargne Quartier Madina
    {
      groupId: group2.id,
      userId: fatoumata.id,
      role: 'admin',
      payoutOrder: 1,
    },
    {
      groupId: group2.id,
      userId: mariama.id,
      role: 'member',
      payoutOrder: 2,
    },
    {
      groupId: group2.id,
      userId: oumar.id,
      role: 'member',
      payoutOrder: 3,
    },
    // Group 3: Association Femmes Conakry
    {
      groupId: group3.id,
      userId: mariama.id,
      role: 'admin',
      payoutOrder: 1,
    },
    {
      groupId: group3.id,
      userId: fatoumata.id,
      role: 'member',
      payoutOrder: 2,
    },
    {
      groupId: group3.id,
      userId: ibrahima.id,
      role: 'member',
      payoutOrder: 3,
    },
    {
      groupId: group3.id,
      userId: oumar.id,
      role: 'member',
      payoutOrder: 4,
    },
  ]);

  app.logger.info('Group members created');

  // Create contributions
  const contributions = await app.db.insert(schema.contributions).values([
    // Group 1, cycle 1
    {
      groupId: group1.id,
      userId: mamadou.id,
      cycleNumber: 1,
      amount: 50000,
      dueDate: new Date('2024-01-31') as any,
      status: 'paid',
      paidAt: new Date('2024-01-15'),
    },
    {
      groupId: group1.id,
      userId: fatoumata.id,
      cycleNumber: 1,
      amount: 50000,
      dueDate: new Date('2024-01-31') as any,
      status: 'paid',
      paidAt: new Date('2024-01-20'),
    },
    {
      groupId: group1.id,
      userId: ibrahima.id,
      cycleNumber: 1,
      amount: 50000,
      dueDate: new Date('2024-01-31') as any,
      status: 'pending',
    },
    // Group 1, cycle 2
    {
      groupId: group1.id,
      userId: mamadou.id,
      cycleNumber: 2,
      amount: 50000,
      dueDate: new Date('2024-02-28') as any,
      status: 'pending',
    },
    {
      groupId: group1.id,
      userId: fatoumata.id,
      cycleNumber: 2,
      amount: 50000,
      dueDate: new Date('2024-02-28') as any,
      status: 'late',
    },
    // Group 2, cycle 1
    {
      groupId: group2.id,
      userId: fatoumata.id,
      cycleNumber: 1,
      amount: 25000,
      dueDate: new Date('2024-01-17') as any,
      status: 'paid',
      paidAt: new Date('2024-01-10'),
    },
    {
      groupId: group2.id,
      userId: mariama.id,
      cycleNumber: 1,
      amount: 25000,
      dueDate: new Date('2024-01-17') as any,
      status: 'paid',
      paidAt: new Date('2024-01-12'),
    },
    // Group 2, cycle 2
    {
      groupId: group2.id,
      userId: fatoumata.id,
      cycleNumber: 2,
      amount: 25000,
      dueDate: new Date('2024-01-24') as any,
      status: 'pending',
    },
    {
      groupId: group2.id,
      userId: oumar.id,
      cycleNumber: 2,
      amount: 25000,
      dueDate: new Date('2024-01-24') as any,
      status: 'pending',
    },
    // Group 2, cycle 1 - Oumar late
    {
      groupId: group2.id,
      userId: oumar.id,
      cycleNumber: 1,
      amount: 25000,
      dueDate: new Date('2024-01-17') as any,
      status: 'late',
    },
  ]).returning();

  app.logger.info('Contributions created');

  // Create transactions
  const transactions = await app.db.insert(schema.transactions).values([
    {
      userId: mamadou.id,
      type: 'deposit',
      amount: 200000,
      balanceBefore: 50000,
      balanceAfter: 250000,
      status: 'completed',
      reference: 'TXN-1704067200000-ABC123',
      description: 'Deposit via mtn_momo',
      paymentProvider: 'mtn_momo',
      providerReference: 'MOMO-1704067200000-XYZ789',
    },
    {
      userId: fatoumata.id,
      type: 'deposit',
      amount: 150000,
      balanceBefore: 30000,
      balanceAfter: 180000,
      status: 'completed',
      reference: 'TXN-1704153600000-DEF456',
      description: 'Deposit via orange_money',
      paymentProvider: 'orange_money',
      providerReference: 'OM-1704153600000-QRS456',
    },
    {
      userId: ibrahima.id,
      type: 'contribution',
      amount: 50000,
      balanceBefore: 500000,
      balanceAfter: 500000,
      status: 'completed',
      reference: 'TXN-1704240000000-GHI789',
      description: 'Contribution to Tontine Famille Diallo - Cycle 1',
      groupId: group1.id,
    },
    {
      userId: mamadou.id,
      type: 'send',
      amount: 50000,
      balanceBefore: 250000,
      balanceAfter: 200000,
      status: 'completed',
      reference: 'TXN-1704326400000-JKL012',
      description: 'Transfer to Fatoumata Bah',
      relatedUserId: fatoumata.id,
    },
    {
      userId: fatoumata.id,
      type: 'receive',
      amount: 50000,
      balanceBefore: 180000,
      balanceAfter: 230000,
      status: 'completed',
      reference: 'TXN-1704326400000-JKL012',
      description: 'Transfer from Mamadou Diallo',
      relatedUserId: mamadou.id,
    },
  ]).returning();

  app.logger.info('Transactions created');

  // Create notifications
  await app.db.insert(schema.notifications).values([
    // Mamadou notifications
    {
      userId: mamadou.id,
      title: 'Rappel de cotisation',
      body: 'Votre contribution à Tontine Famille Diallo est due',
      type: 'payment_reminder',
      data: { groupId: group1.id, cycleNumber: 2 },
    },
    {
      userId: mamadou.id,
      title: 'Paiement reçu',
      body: 'Vous avez reçu un versement de Tontine Famille Diallo',
      type: 'payout_alert',
      data: { groupId: group1.id, amount: 150000 },
    },
    {
      userId: mamadou.id,
      title: 'Mise à jour du groupe',
      body: 'Le statut de Tontine Famille Diallo a changé en actif',
      type: 'group_update',
      data: { groupId: group1.id },
    },
    // Fatoumata notifications
    {
      userId: fatoumata.id,
      title: 'Rappel de cotisation',
      body: 'Votre contribution à Épargne Quartier Madina est due',
      type: 'payment_reminder',
      data: { groupId: group2.id, cycleNumber: 2 },
    },
    {
      userId: fatoumata.id,
      title: 'Paiement reçu',
      body: 'Vous avez reçu un versement d\'Épargne Quartier Madina',
      type: 'payout_alert',
      data: { groupId: group2.id, amount: 75000 },
    },
    {
      userId: fatoumata.id,
      title: 'Mise à jour du groupe',
      body: 'Le statut d\'Épargne Quartier Madina a changé en actif',
      type: 'group_update',
      data: { groupId: group2.id },
    },
    // Ibrahima notifications
    {
      userId: ibrahima.id,
      title: 'Rappel de cotisation',
      body: 'Votre contribution à Tontine Famille Diallo est due',
      type: 'payment_reminder',
      data: { groupId: group1.id, cycleNumber: 1 },
    },
    {
      userId: ibrahima.id,
      title: 'Paiement reçu',
      body: 'Vous avez reçu un versement de Tontine Famille Diallo',
      type: 'payout_alert',
      data: { groupId: group1.id, amount: 150000 },
    },
    {
      userId: ibrahima.id,
      title: 'Mise à jour du groupe',
      body: 'Une nouvelle cotisation est requise pour Tontine Famille Diallo',
      type: 'group_update',
      data: { groupId: group1.id },
    },
    // Mariama notifications
    {
      userId: mariama.id,
      title: 'Rappel de cotisation',
      body: 'Votre contribution à Association Femmes Conakry est due',
      type: 'payment_reminder',
      data: { groupId: group3.id, cycleNumber: 1 },
    },
    {
      userId: mariama.id,
      title: 'Paiement reçu',
      body: 'Vous avez reçu un versement d\'Association Femmes Conakry',
      type: 'payout_alert',
      data: { groupId: group3.id, amount: 400000 },
    },
    {
      userId: mariama.id,
      title: 'Mise à jour du groupe',
      body: 'Association Femmes Conakry est maintenant active',
      type: 'group_update',
      data: { groupId: group3.id },
    },
    // Oumar notifications
    {
      userId: oumar.id,
      title: 'Rappel de cotisation',
      body: 'Votre contribution à Épargne Quartier Madina est due',
      type: 'payment_reminder',
      data: { groupId: group2.id, cycleNumber: 1 },
    },
    {
      userId: oumar.id,
      title: 'Paiement reçu',
      body: 'Vous avez reçu un versement d\'Épargne Quartier Madina',
      type: 'payout_alert',
      data: { groupId: group2.id, amount: 75000 },
    },
    {
      userId: oumar.id,
      title: 'Mise à jour du groupe',
      body: 'Association Femmes Conakry vous a invité à rejoindre',
      type: 'group_update',
      data: { groupId: group3.id },
    },
  ]);

  app.logger.info('Notifications created');

  app.logger.info('Seed completed successfully');
  process.exit(0);
}

seed().catch((error) => {
  app.logger.error({ err: error }, 'Seed failed');
  process.exit(1);
});

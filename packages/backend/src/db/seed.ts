import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test users
  const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      id: uuidv4(),
      username: 'alice',
      displayName: 'Alice Smith',
      email: 'alice@example.com',
      passwordHash,
      isVerified: true,
      status: 'OFFLINE',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      id: uuidv4(),
      username: 'bob',
      displayName: 'Bob Johnson',
      email: 'bob@example.com',
      passwordHash,
      isVerified: true,
      status: 'OFFLINE',
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      id: uuidv4(),
      username: 'charlie',
      displayName: 'Charlie Brown',
      email: 'charlie@example.com',
      passwordHash,
      isVerified: true,
      status: 'OFFLINE',
    },
  });

  // Create contacts
  await prisma.contact.createMany({
    data: [
      { userId: alice.id, contactId: bob.id },
      { userId: alice.id, contactId: charlie.id },
      { userId: bob.id, contactId: alice.id },
      { userId: charlie.id, contactId: alice.id },
    ],
    skipDuplicates: true,
  });

  // Create a private chat between Alice and Bob
  const privateChat = await prisma.chat.create({
    data: {
      id: uuidv4(),
      type: 'PRIVATE',
      members: {
        create: [
          { id: uuidv4(), userId: alice.id, role: 'MEMBER' },
          { id: uuidv4(), userId: bob.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // Add some messages
  await prisma.message.createMany({
    data: [
      {
        id: uuidv4(),
        chatId: privateChat.id,
        senderId: alice.id,
        type: 'TEXT',
        content: 'Hey Bob! Welcome to Messngr 👋',
        sentAt: new Date(Date.now() - 3600000),
      },
      {
        id: uuidv4(),
        chatId: privateChat.id,
        senderId: bob.id,
        type: 'TEXT',
        content: 'Hi Alice! This is amazing! 🚀',
        sentAt: new Date(Date.now() - 3500000),
      },
      {
        id: uuidv4(),
        chatId: privateChat.id,
        senderId: alice.id,
        type: 'TEXT',
        content: 'It has E2E encryption, voice messages, video calls... everything! 🔐',
        sentAt: new Date(Date.now() - 3400000),
      },
    ],
  });

  // Create a group chat
  const groupChat = await prisma.chat.create({
    data: {
      id: uuidv4(),
      type: 'GROUP',
      name: 'Messngr Team 🚀',
      description: 'Welcome to our awesome messenger!',
      members: {
        create: [
          { id: uuidv4(), userId: alice.id, role: 'OWNER' },
          { id: uuidv4(), userId: bob.id, role: 'ADMIN' },
          { id: uuidv4(), userId: charlie.id, role: 'MEMBER' },
        ],
      },
    },
  });

  await prisma.message.create({
    data: {
      id: uuidv4(),
      chatId: groupChat.id,
      senderId: alice.id,
      type: 'TEXT',
      content: 'Welcome to Messngr Team chat! 🎉',
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('📧 Test users:');
  console.log('   alice@example.com / password123');
  console.log('   bob@example.com / password123');
  console.log('   charlie@example.com / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

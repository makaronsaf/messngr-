import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

export default async function encryptionRoutes(app: FastifyInstance) {
  // Register key bundle (X3DH)
  app.post('/keys/register', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { registrationId, identityKey, signedPreKey, oneTimePreKeys } = request.body as {
      registrationId: number;
      identityKey: string;
      signedPreKey: { keyId: number; publicKey: string; signature: string };
      oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
    };

    const bundle = await prisma.keyBundle.upsert({
      where: { userId: currentUser.id },
      update: {
        registrationId,
        identityKey,
        signedPreKey,
        oneTimePreKeys,
      },
      create: {
        id: uuidv4(),
        userId: currentUser.id,
        registrationId,
        identityKey,
        signedPreKey,
        oneTimePreKeys,
      },
    });

    // Also update user's public identity key
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { identityPublicKey: identityKey },
    });

    return { success: true, bundleId: bundle.id };
  });

  // Get key bundle for a user (for initiating E2E session)
  app.get('/keys/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const bundle = await prisma.keyBundle.findUnique({
      where: { userId },
    });

    if (!bundle) {
      return reply.status(404).send({ error: 'Key bundle not found - user has no E2E keys' });
    }

    // Pop one one-time pre-key
    let oneTimePreKey: any = null;
    if (bundle.oneTimePreKeys.length > 0) {
      oneTimePreKey = bundle.oneTimePreKeys[0];
      await prisma.keyBundle.update({
        where: { userId },
        data: {
          oneTimePreKeys: bundle.oneTimePreKeys.slice(1),
        },
      });
    }

    return {
      registrationId: bundle.registrationId,
      identityKey: bundle.identityKey,
      signedPreKey: bundle.signedPreKey,
      oneTimePreKey,
    };
  });

  // Upload additional one-time pre-keys
  app.post('/keys/one-time', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { oneTimePreKeys } = request.body as {
      oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
    };

    const bundle = await prisma.keyBundle.findUnique({ where: { userId: currentUser.id } });
    if (!bundle) return reply.status(404).send({ error: 'No key bundle registered' });

    await prisma.keyBundle.update({
      where: { userId: currentUser.id },
      data: {
        oneTimePreKeys: [...(bundle.oneTimePreKeys as any[]), ...oneTimePreKeys],
      },
    });

    return { success: true };
  });

  // Store E2E session state
  app.post('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { recipientId, sessionData } = request.body as {
      recipientId: string;
      sessionData: string;
    };

    const session = await prisma.e2ESession.upsert({
      where: {
        senderId_recipientId: { senderId: currentUser.id, recipientId },
      },
      update: { sessionData },
      create: {
        id: uuidv4(),
        senderId: currentUser.id,
        recipientId,
        sessionData,
      },
    });

    return { session };
  });

  // Get E2E session state
  app.get('/sessions/:recipientId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { recipientId } = request.params as { recipientId: string };

    const session = await prisma.e2ESession.findUnique({
      where: {
        senderId_recipientId: { senderId: currentUser.id, recipientId },
      },
    });

    if (!session) return reply.status(404).send({ error: 'No session found' });
    return { session };
  });

  // Check key bundle status
  app.get('/keys/status', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;

    const bundle = await prisma.keyBundle.findUnique({
      where: { userId: currentUser.id },
      select: {
        registrationId: true,
        updatedAt: true,
        oneTimePreKeys: true,
      },
    });

    return {
      hasKeyBundle: !!bundle,
      oneTimePreKeysCount: bundle ? (bundle.oneTimePreKeys as any[]).length : 0,
      updatedAt: bundle?.updatedAt,
    };
  });
}

import { logger } from '../utils/logger';

/**
 * Push Notification Service
 *
 * Supports:
 *  - FCM (Firebase Cloud Messaging) for Android and Web
 *  - APNs (Apple Push Notification Service) for iOS
 *
 * Set env vars:
 *  FCM_SERVER_KEY  — legacy FCM server key (or use FCM_PROJECT_ID + service account for v1 API)
 *  APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_PATH — for APNs
 */

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

// ─── FCM ──────────────────────────────────────────────────────────────────────

export async function sendFCM(token: string, payload: PushPayload): Promise<boolean> {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    logger.warn('FCM_SERVER_KEY not set — skipping FCM push');
    return false;
  }

  try {
    const body = {
      to: token,
      notification: {
        title: payload.title,
        body: payload.body,
        image: payload.imageUrl,
      },
      data: payload.data || {},
      priority: 'high',
    };

    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      logger.error(`FCM error ${res.status}: ${await res.text()}`);
      return false;
    }

    const json = await res.json() as any;
    if (json.failure > 0) {
      logger.warn('FCM partial failure:', json.results);
      return false;
    }

    return true;
  } catch (err) {
    logger.error('FCM send error:', err);
    return false;
  }
}

// ─── APNs ─────────────────────────────────────────────────────────────────────

export async function sendAPNs(deviceToken: string, payload: PushPayload): Promise<boolean> {
  const keyId    = process.env.APNS_KEY_ID;
  const teamId   = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const keyPath  = process.env.APNS_KEY_PATH;

  if (!keyId || !teamId || !bundleId || !keyPath) {
    logger.warn('APNs env vars not fully set — skipping APNs push');
    return false;
  }

  try {
    const fs = await import('fs');
    const jwt = await import('jsonwebtoken');

    const privateKey = fs.readFileSync(keyPath).toString();

    const jwtToken = jwt.default.sign({}, privateKey, {
      algorithm: 'ES256',
      keyid: keyId,
      issuer: teamId,
      expiresIn: '1h',
    });

    const apnsPayload = {
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: 'default',
        badge: 1,
        'content-available': 1,
      },
      ...payload.data,
    };

    const isProduction = process.env.NODE_ENV === 'production';
    const host = isProduction
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';

    const res = await fetch(`${host}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `bearer ${jwtToken}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      body: JSON.stringify(apnsPayload),
    });

    if (res.status !== 200) {
      const reason = await res.json() as any;
      logger.error('APNs error:', reason);
      return false;
    }

    return true;
  } catch (err) {
    logger.error('APNs send error:', err);
    return false;
  }
}

// ─── Unified sender ───────────────────────────────────────────────────────────

export async function sendPushToUser(
  user: { fcmToken?: string | null; apnsToken?: string | null },
  payload: PushPayload
): Promise<void> {
  const tasks: Promise<boolean>[] = [];

  if (user.fcmToken)  tasks.push(sendFCM(user.fcmToken, payload));
  if (user.apnsToken) tasks.push(sendAPNs(user.apnsToken, payload));

  if (tasks.length > 0) await Promise.allSettled(tasks);
}

import admin from 'firebase-admin';
import { createRequire } from 'module';
import logger from './logger.js';

const require = createRequire(import.meta.url);

if (!admin.apps.length) {
  const serviceAccount = require('../config/firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export const sendPushToUsers = async (userIds, title, body, data = {}) => {
  if (!userIds?.length) return;
  try {
    const User = (await import('../models/users.model.js')).default;
    const users = await User.find({ userId: { $in: userIds }, isdeleted: false, fcmTokens: { $exists: true, $ne: [] } }, { fcmTokens: 1 }).lean();

    const tokens = users.flatMap((u) => u.fcmTokens.map((t) => t.token)).filter(Boolean);
    if (!tokens.length) return;

    const message = {
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Prune invalid tokens
    const invalidTokens = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && (r.error?.code === 'messaging/invalid-registration-token' || r.error?.code === 'messaging/registration-token-not-registered')) {
        invalidTokens.push(tokens[idx]);
      }
    });
    if (invalidTokens.length) {
      await User.updateMany({ userId: { $in: userIds } }, { $pull: { fcmTokens: { token: { $in: invalidTokens } } } });
    }
    logger.info(`[FCM] sent to ${response.successCount}/${tokens.length} tokens`);
  } catch (err) {
    logger.error('[FCM] sendPushToUsers error:', err?.message || err);
  }
};

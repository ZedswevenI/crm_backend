import { sendPushToUsers } from './firebase.helper.js';
import logger from './logger.js';
import User from '../models/users.model.js';

const ALLOWED_ROLES = ['L1', 'L4'];

// Resolve staffIds (UUID) → userIds, filtered to L1/L4 only
export const getUserIdsByStaffIds = async (tenantId, staffIds) => {
  if (!staffIds?.length) return [];
  const users = await User.find(
    {
      tenantId,
      staffId: { $in: staffIds },
      roleLevel: { $in: ALLOWED_ROLES },
      status: 'Active',
      isdeleted: false
    },
    { userId: 1 }
  ).lean();
  return users.map((u) => u.userId);
};

export const notifyStaff = async ({ tenantId, staffIds, title, body, data = {} }) => {
  try {
    const userIds = await getUserIdsByStaffIds(tenantId, staffIds);
    if (!userIds.length) return;
    await sendPushToUsers(userIds, title, body, data);
  } catch (err) {
    logger.error('[PushNotification] notifyStaff error:', err?.message || err);
  }
};

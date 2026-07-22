import { sendPushToUsers } from './firebase.helper.js';
import logger from './logger.js';
import User from '../models/users.model.js';
import Notification from '../models/notification.model.js';

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

// Resolve users by centerId + roleLevel(s) — e.g. all L1 users mapped to a center
export const getUserIdsByCenterAndRole = async (tenantId, centerId, roleLevels) => {
  if (!centerId || !roleLevels?.length) return [];
  const users = await User.find(
    {
      tenantId,
      'centers.centerId': centerId,
      roleLevel: { $in: roleLevels },
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

// Unified notify helper — logs an in-app Notification row for each recipient
// (shown via the frontend's header bell icon) AND still sends mobile push (FCM).
// Accepts either staffIds (resolved to userIds, L1/L4 only) or userIds directly.
export const notifyUsers = async ({ tenantId, userIds = [], staffIds = [], title, body, type = 'GENERAL', data = {}, sourceModule = null, sourceRefId = null, createdBy = null }) => {
  try {
    const resolvedFromStaff = staffIds?.length ? await getUserIdsByStaffIds(tenantId, staffIds) : [];
    const allUserIds = [...new Set([...(userIds || []), ...resolvedFromStaff].map((id) => String(id || '').trim()).filter(Boolean))];
    if (!allUserIds.length) return;

    const docs = allUserIds.map((userId) => ({
      tenantId,
      userId,
      title,
      body: body || null,
      type,
      sourceModule,
      sourceRefId,
      data,
      createdBy
    }));
    await Notification.insertMany(docs);

    await sendPushToUsers(allUserIds, title, body, data);
  } catch (err) {
    logger.error('[PushNotification] notifyUsers error:', err?.message || err);
  }
};

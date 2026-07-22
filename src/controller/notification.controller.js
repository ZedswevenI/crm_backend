import Notification from '../models/notification.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || req?.query?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const listNotifications = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.query?.userId);
    if (!tenantId || !userId) return res.status(400).json({ status: false, message: 'tenantId and userId are required' });

    const page = Math.max(parseInt(req.body?.page || req.query?.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.body?.limit || req.query?.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const isReadRaw = req.body?.isRead ?? req.query?.isRead;
    const type = safeTrim(req.body?.type || req.query?.type);

    const query = { tenantId, userId, isdeleted: false };
    if (isReadRaw !== undefined && isReadRaw !== '') query.isRead = isReadRaw === true || isReadRaw === 'true';
    if (type) query.type = type;

    const [rows, count, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ tenantId, userId, isdeleted: false, isRead: false })
    ]);

    return res.status(200).json({
      status: true,
      data: rows,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0,
      unreadCount
    });
  } catch (err) {
    return next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.query?.userId);
    if (!tenantId || !userId) return res.status(400).json({ status: false, message: 'tenantId and userId are required' });
    const unreadCount = await Notification.countDocuments({ tenantId, userId, isdeleted: false, isRead: false });
    return res.status(200).json({ status: true, unreadCount });
  } catch (err) {
    return next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const notificationId = safeTrim(req.body?.notificationId);
    const notificationIds = Array.isArray(req.body?.notificationIds) ? req.body.notificationIds.map(safeTrim).filter(Boolean) : [];
    if (!tenantId || !userId) return res.status(400).json({ status: false, message: 'tenantId and userId are required' });
    const ids = notificationIds.length ? notificationIds : notificationId ? [notificationId] : [];
    if (!ids.length) return res.status(400).json({ status: false, message: 'notificationId or notificationIds[] is required' });

    const result = await Notification.updateMany({ tenantId, userId, notificationId: { $in: ids }, isdeleted: false, isRead: false }, { $set: { isRead: true, readAt: Date.now() } });
    return res.status(200).json({ status: true, message: 'Notification(s) marked as read', modifiedCount: result.modifiedCount });
  } catch (err) {
    return next(err);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !userId) return res.status(400).json({ status: false, message: 'tenantId and userId are required' });
    const result = await Notification.updateMany({ tenantId, userId, isdeleted: false, isRead: false }, { $set: { isRead: true, readAt: Date.now() } });
    return res.status(200).json({ status: true, message: 'All notifications marked as read', modifiedCount: result.modifiedCount });
  } catch (err) {
    return next(err);
  }
};

const removeNotification = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const notificationId = safeTrim(req.body?.notificationId);
    if (!tenantId || !userId || !notificationId) return res.status(400).json({ status: false, message: 'tenantId, userId and notificationId are required' });
    const updated = await Notification.findOneAndUpdate({ tenantId, userId, notificationId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Notification not found' });
    return res.status(200).json({ status: true, message: 'Notification removed' });
  } catch (err) {
    return next(err);
  }
};

export default {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  removeNotification
};

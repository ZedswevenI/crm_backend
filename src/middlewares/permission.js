// Enforcement middleware for the custom permission system.
// Must run AFTER validatetoken (relies on req.user set there).
// Authorization data is read from the in-memory permission cache, not the JWT — this makes access
// changes take effect immediately (no waiting on token refresh) and keeps the token itself lean.

import User from '../models/users.model.js';
import { getUserAccess, setUserAccess } from '../services/permissionCache.service.js';

// Cache miss (e.g. fresh server restart) self-heals by reading straight from the DB and repopulating —
// no manual intervention needed, just one extra DB read for that user's first request afterward.
const resolveAccess = async (userId) => {
  const cached = getUserAccess(userId);
  if (cached) return cached;
  const user = await User.findOne({ userId, isdeleted: false }, { isAdmin: 1, permissions: 1 }).lean();
  const access = { isAdmin: !!user?.isAdmin, permissions: user?.permissions || [] };
  setUserAccess(userId, access);
  return access;
};

export const requirePermission = (permissionKey) => async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ status: false, message: 'Unauthorized' });
    const access = await resolveAccess(userId);
    if (access.isAdmin || access.permissions.includes(permissionKey)) return next();
    return res.status(403).json({ status: false, message: 'Forbidden: missing permission', required: permissionKey });
  } catch (err) {
    return next(err);
  }
};

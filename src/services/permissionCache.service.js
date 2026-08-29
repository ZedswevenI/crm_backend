import NodeCache from 'node-cache';

// In-memory cache of each logged-in user's authorization data, keyed by userId (the app-level uuid).
// Source of truth for requirePermission — populated on login/refresh, kept live on access changes,
// cleared on logout/deactivation/deletion. TTL is a defense-in-depth safety net only; entries are
// actively managed so it should rarely be hit in practice.
const cache = new NodeCache({ stdTTL: 24 * 60 * 60, checkperiod: 60 * 60 });

export const setUserAccess = (userId, { isAdmin, permissions }) => {
  if (!userId) return;
  cache.set(userId, { isAdmin: !!isAdmin, permissions: Array.isArray(permissions) ? permissions : [] });
};

export const getUserAccess = (userId) => {
  if (!userId) return undefined;
  return cache.get(userId);
};

export const clearUserAccess = (userId) => {
  if (!userId) return;
  cache.del(userId);
};

export const hasUserAccess = (userId) => cache.has(userId);

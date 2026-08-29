import Permission from '../models/permission.model.js';

// Read-only catalog — permissions are seeded from src/data/permissionCatalog.data.js, not created via API.
const listCatalog = async (req, res, next) => {
  try {
    const module = req.body?.module ? String(req.body.module).trim() : null;
    const query = { isActive: true };
    if (module) query.module = module;
    const rows = await Permission.find(query).sort({ module: 1, action: 1 }).lean();

    const grouped = [];
    const indexByModule = new Map();
    for (const row of rows) {
      if (!indexByModule.has(row.module)) {
        indexByModule.set(row.module, grouped.length);
        grouped.push({ module: row.module, permissions: [] });
      }
      grouped[indexByModule.get(row.module)].permissions.push({
        permissionKey: row.permissionKey,
        action: row.action,
        label: row.label
      });
    }

    return res.status(200).json({ status: true, message: 'Permission catalog retrieved successfully', data: grouped });
  } catch (err) {
    return next(err);
  }
};

export default { listCatalog };

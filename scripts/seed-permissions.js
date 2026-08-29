import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../src/models/permission.model.js';
import { PERMISSION_MODULES } from '../src/data/permissionCatalog.data.js';

dotenv.config();

const MONGO_URI = `mongodb+srv://${process.env.DBUSER}:${process.env.PASSWORD}@${process.env.HOST}/${process.env.DATABASE}`;

const DRY_RUN = process.argv.includes('--dry-run');

const humanize = (word) =>
  word
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

const buildCatalog = () => {
  const rows = [];
  for (const { module, label: moduleLabel, actions } of PERMISSION_MODULES) {
    for (const action of actions) {
      rows.push({
        permissionKey: `${module}:${action}`,
        module,
        action,
        label: `${moduleLabel} - ${humanize(action)}`
      });
    }
  }
  return rows;
};

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. DRY_RUN=${DRY_RUN}`);

  const catalog = buildCatalog();
  console.log(`Catalog defines ${catalog.length} permission(s) across ${PERMISSION_MODULES.length} module(s)`);

  if (DRY_RUN) {
    console.log('[dry-run] sample entries:', catalog.slice(0, 5));
    console.log('Dry run complete — no writes made.');
    await mongoose.disconnect();
    return;
  }

  const ops = catalog.map((entry) => ({
    updateOne: {
      filter: { permissionKey: entry.permissionKey },
      update: { $set: entry },
      upsert: true
    }
  }));
  const result = await Permission.bulkWrite(ops, { ordered: false });
  console.log(`Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`);

  // Deactivate any catalog rows in the DB that are no longer defined in the source file,
  // instead of deleting them outright (existing user.permissions[] entries referencing them stay intact).
  const currentKeys = catalog.map((c) => c.permissionKey);
  const staleResult = await Permission.updateMany({ permissionKey: { $nin: currentKeys }, isActive: true }, { $set: { isActive: false } });
  if (staleResult.modifiedCount) console.log(`Deactivated ${staleResult.modifiedCount} stale permission(s) no longer in the catalog source`);

  console.log('Seed complete.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

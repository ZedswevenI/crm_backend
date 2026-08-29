import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/users.model.js';
import { BASELINE_PERMISSIONS } from '../src/data/permissionCatalog.data.js';

dotenv.config();

const MONGO_URI = `mongodb+srv://${process.env.DBUSER}:${process.env.PASSWORD}@${process.env.HOST}/${process.env.DATABASE}`;

const DRY_RUN = process.argv.includes('--dry-run');

// Unlike migrate-user-access.js, this intentionally does NOT skip accessCustomizedAt users —
// baseline permissions are a universal floor everyone gets regardless of custom access, not a
// role-derived default that manual customization should opt out of. Uses $addToSet, so it only
// ever adds these keys — never removes anything, safe to re-run any time the baseline list grows.
const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. DRY_RUN=${DRY_RUN}. Baseline: ${BASELINE_PERMISSIONS.join(', ')}`);

  const filter = { isdeleted: false, isAdmin: { $ne: true }, permissions: { $not: { $all: BASELINE_PERMISSIONS } } };
  const affected = await User.countDocuments(filter);
  console.log(`${affected} user(s) missing at least one baseline permission`);

  if (DRY_RUN) {
    console.log('Dry run complete — no writes made.');
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(filter, { $addToSet: { permissions: { $each: BASELINE_PERMISSIONS } } });
  console.log(`Updated ${result.modifiedCount} user(s)`);
  console.log('Complete.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});

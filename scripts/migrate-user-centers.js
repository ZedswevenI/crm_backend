import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/users.model.js';

dotenv.config();

const MONGO_URI = `mongodb+srv://${process.env.DBUSER}:${process.env.PASSWORD}@${process.env.HOST}/${process.env.DATABASE}`;

const DRY_RUN = process.argv.includes('--dry-run');

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. DRY_RUN=${DRY_RUN}`);

  const coll = mongoose.connection.collection('users');

  const legacyUsers = await coll.find({ centerId: { $exists: true } }).toArray();
  console.log(`Found ${legacyUsers.length} users with legacy centerId field`);

  let migrated = 0;
  let skipped = 0;

  for (const u of legacyUsers) {
    const centers = u.centerId ? [{ centerId: u.centerId, centerName: u.centerName || null }] : [];
    if (DRY_RUN) {
      console.log(`[dry-run] would set userId=${u.userId} centers=${JSON.stringify(centers)}`);
      migrated++;
      continue;
    }
    await coll.updateOne({ _id: u._id }, { $set: { centers }, $unset: { centerId: '', centerName: '' } });
    migrated++;
  }

  // Any user doc that never had centerId at all still needs a default centers: []
  const backfillResult = DRY_RUN
    ? { modifiedCount: await coll.countDocuments({ centers: { $exists: false } }) }
    : await coll.updateMany({ centers: { $exists: false } }, { $set: { centers: [] } });

  console.log(`Migrated ${migrated} users, backfilled ${backfillResult.modifiedCount} with empty centers[]`);
  console.log(DRY_RUN ? 'Dry run complete — no writes made.' : 'Migration complete.');

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

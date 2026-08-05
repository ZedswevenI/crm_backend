import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = `mongodb+srv://${process.env.DBUSER}:${process.env.PASSWORD}@${process.env.HOST}/${process.env.DATABASE}`;

const DRY_RUN = process.argv.includes('--dry-run');

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. DRY_RUN=${DRY_RUN}`);

  const coll = mongoose.connection.collection('payments');

  const filter = { paymentCategory: { $exists: false } };
  const count = await coll.countDocuments(filter);
  console.log(`Found ${count} payment(s) missing paymentCategory`);

  if (DRY_RUN) {
    console.log(`[dry-run] would set paymentCategory='ADMISSION' on ${count} document(s)`);
    console.log('Dry run complete — no writes made.');
    await mongoose.disconnect();
    return;
  }

  const result = await coll.updateMany(filter, { $set: { paymentCategory: 'ADMISSION' } });
  console.log(`Backfilled ${result.modifiedCount} payment(s) with paymentCategory='ADMISSION'`);
  console.log('Migration complete.');

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

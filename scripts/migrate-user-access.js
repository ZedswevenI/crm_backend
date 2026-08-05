import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/users.model.js';
import { ROLE_PORTAL_MAP, ROLE_PERMISSION_MAP } from '../src/data/legacyRoleAccessMap.data.js';

dotenv.config();

const MONGO_URI = `mongodb+srv://${process.env.DBUSER}:${process.env.PASSWORD}@${process.env.HOST}/${process.env.DATABASE}`;

const DRY_RUN = process.argv.includes('--dry-run');

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. DRY_RUN=${DRY_RUN}`);

  const users = await User.find({ isdeleted: false }).sort({ tenantId: 1, createdAt: 1 }).select('tenantId userId email roleLevel roleLabel isAdmin role portal permissions').lean();

  const byTenant = new Map();
  for (const u of users) {
    if (!byTenant.has(u.tenantId)) byTenant.set(u.tenantId, []);
    byTenant.get(u.tenantId).push(u);
  }

  const adminOps = [];
  const accessOps = [];
  const report = [];

  for (const [tenantId, tenantUsers] of byTenant) {
    const alreadyAdmin = tenantUsers.find((u) => u.isAdmin);
    let adminCandidate = alreadyAdmin || null;

    if (!adminCandidate) {
      // Earliest-created L1 user is the heuristic pick for institute admin — review the report before trusting this on messy data.
      adminCandidate = tenantUsers.find((u) => u.roleLevel === 'L1') || null;
    }

    report.push({
      tenantId,
      totalUsers: tenantUsers.length,
      adminCandidate: adminCandidate ? adminCandidate.email : '(none found — no L1 user, needs manual assignment)',
      alreadyAdmin: !!alreadyAdmin
    });

    if (adminCandidate && !alreadyAdmin) {
      adminOps.push({
        updateOne: {
          filter: { _id: adminCandidate._id },
          update: { $set: { isAdmin: true, role: 'Admin', portal: ['CRM', 'ACADEMIC'] } }
        }
      });
    }

    for (const u of tenantUsers) {
      if (adminCandidate && String(u._id) === String(adminCandidate._id)) continue; // handled above
      accessOps.push({
        updateOne: {
          filter: { _id: u._id },
          update: {
            $set: {
              role: u.roleLabel || null,
              portal: ROLE_PORTAL_MAP[u.roleLevel] || [],
              permissions: ROLE_PERMISSION_MAP[u.roleLevel] || []
            }
          }
        }
      });
    }
  }

  console.log(`\nTenants: ${byTenant.size}, Users: ${users.length}`);
  console.log('\nAdmin assignment report:');
  console.table(report);

  if (DRY_RUN) {
    console.log(`\n[dry-run] would promote ${adminOps.length} user(s) to isAdmin, backfill access fields for ${accessOps.length} user(s)`);
    console.log('Dry run complete — no writes made.');
    await mongoose.disconnect();
    return;
  }

  if (adminOps.length) {
    const adminResult = await User.bulkWrite(adminOps, { ordered: false });
    console.log(`Promoted ${adminResult.modifiedCount} user(s) to isAdmin`);
  }
  if (accessOps.length) {
    const accessResult = await User.bulkWrite(accessOps, { ordered: false });
    console.log(`Backfilled access fields for ${accessResult.modifiedCount} user(s)`);
  }

  console.log('Migration complete.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

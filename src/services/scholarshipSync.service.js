import axios from 'axios';
import ScholarshipTest from '../models/scholarship.model.js';
import logger from '../helpers/logger.js';
import { mapScholarshipRecord, hasScholarshipRecordChanged } from '../helpers/scholarship.helper.js';

const toDateParam = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD

// Diffs the external portal's bulk result set against what's already cached locally and
// upserts only the rows that are new or actually changed — matches the operator's nightly
// expectation of "500 known, 520 came in tonight, update anything different, leave the rest".
export const syncScholarshipResultsBulk = async () => {
  const host = process.env.EXTERNAL_PORTAL_HOST;
  const apiKey = process.env.EXTERNAL_PORTAL_API_KEY;
  const tenantId = process.env.EXTERNAL_PORTAL_TENANT_ID;

  if (!host || !apiKey || !tenantId) {
    logger.error('[scholarshipSync] missing EXTERNAL_PORTAL_HOST / EXTERNAL_PORTAL_API_KEY / EXTERNAL_PORTAL_TENANT_ID');
    return { skipped: true, reason: 'config missing' };
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  const url = `${host}/api/v1/external/crm/results/bulk?startDate=${toDateParam(startDate)}&endDate=${toDateParam(endDate)}`;

  let resp;
  try {
    resp = await axios.get(url, { headers: { 'X-Z7i-CRM-Key': apiKey }, timeout: 60000 });
  } catch (err) {
    logger.error(`[scholarshipSync] bulk fetch failed: ${err?.response?.status || ''} ${err?.message || err}`);
    return { skipped: true, reason: 'fetch failed', error: err?.message };
  }

  const rows = Array.isArray(resp.data?.data) ? resp.data.data : [];
  const stats = { fetched: rows.length, inserted: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 };

  for (const d of rows) {
    try {
      const mapped = mapScholarshipRecord(tenantId, d);
      if (!mapped.registrationNumber) {
        stats.skipped++;
        continue;
      }
      const existing = await ScholarshipTest.findOne({ tenantId, registrationNumber: mapped.registrationNumber, isdeleted: false }).lean();
      if (existing && !hasScholarshipRecordChanged(existing, mapped)) {
        stats.unchanged++;
        continue;
      }
      await ScholarshipTest.updateOne(
        { tenantId, registrationNumber: mapped.registrationNumber, isdeleted: false },
        {
          $set: { ...mapped, lastSyncAt: Date.now(), lastSyncStatus: 'SUCCESS', lastSyncMessage: 'Synced via nightly bulk job', raw: { data: d } },
          $setOnInsert: { status: 'Active', isdeleted: false }
        },
        { upsert: true }
      );
      if (existing) stats.updated++;
      else stats.inserted++;
    } catch (err) {
      stats.errors++;
      logger.error(`[scholarshipSync] row failed for registrationNumber=${d?.registrationNumber}: ${err?.message || err}`);
    }
  }

  logger.info(`[scholarshipSync] done: fetched=${stats.fetched} inserted=${stats.inserted} updated=${stats.updated} unchanged=${stats.unchanged} skipped=${stats.skipped} errors=${stats.errors}`);
  return { skipped: false, stats };
};

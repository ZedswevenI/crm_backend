import { syncScholarshipResultsBulk } from '../services/scholarshipSync.service.js';
import logger from './logger.js';

let started = false;
let lastRunDateKey = null;

const dateKey = (d) => d.toISOString().slice(0, 10);

// No cron library in this codebase — matches the polling style of communicationScheduler.helper.js.
// Checks every 5 minutes whether it's past local midnight and today's run hasn't happened yet.
export const startScholarshipSyncScheduler = () => {
  if (started) return;
  started = true;
  const run = async () => {
    try {
      const now = new Date();
      const today = dateKey(now);
      if (now.getHours() !== 0 || lastRunDateKey === today) return;
      lastRunDateKey = today;
      await syncScholarshipResultsBulk();
    } catch (err) {
      logger.error(`[scholarship sync scheduler error] ${err?.message || err}`);
    }
  };
  setInterval(run, 5 * 60 * 1000);
  console.log('[scholarship sync scheduler] started');
};

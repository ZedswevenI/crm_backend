import { processDueScheduledCampaigns } from '../services/communicationProcessor.service.js';

let started = false;

export const startCommunicationScheduler = () => {
  if (started) return;
  started = true;

  setInterval(async () => {
    try {
      await processDueScheduledCampaigns();
    } catch (err) {
      console.error('[communication scheduler error]', err?.message || err);
    }
  }, 60 * 1000);

  console.log('[communication scheduler] started');
};

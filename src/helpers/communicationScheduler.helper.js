import CommunicationCampaign from '../models/communicationcampaign.model.js';
import { processCommunicationCampaign } from '../services/communicationProcessor.service.js';

let started = false;

export const startCommunicationScheduler = () => {
  if (started) return;
  started = true;
  const run = async () => {
    try {
      const now = Date.now();
      const campaigns = await CommunicationCampaign.find({
        isdeleted: false,
        status: { $in: ['QUEUED', 'SCHEDULED'] },
        $or: [{ sendType: 'NOW' }, { sendType: 'SCHEDULED', scheduledAt: { $lte: now } }]
      })
        .sort({ createdAt: 1 })
        .limit(10)
        .lean();
      for (const c of campaigns) {
        await processCommunicationCampaign({
          tenantId: c.tenantId,
          campaignId: c.campaignId
        });
      }
    } catch (err) {
      console.error('[communication scheduler error]', err?.message || err);
    }
  };
  run();
  setInterval(run, 60 * 1000);
  console.log('[communication scheduler] started');
};

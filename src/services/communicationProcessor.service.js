import CommunicationCampaign from '../models/communicationcampaign.model.js';
import CommunicationRecipientLog from '../models/communicationrecipientlog.model.js';
import { sendMailgunEmail } from './mailgun.service.js';

export const processCommunicationCampaign = async ({ tenantId, campaignId }) => {
  const campaign = await CommunicationCampaign.findOne({
    tenantId,
    campaignId,
    isdeleted: false,
    status: { $in: ['QUEUED', 'SCHEDULED', 'PROCESSING'] }
  });
  if (!campaign) return null;
  campaign.status = 'PROCESSING';
  campaign.startedAt = campaign.startedAt || Date.now();
  await campaign.save();
  const logs = await CommunicationRecipientLog.find({
    tenantId,
    campaignId,
    isdeleted: false,
    status: 'QUEUED'
  })
    .sort({ createdAt: 1 })
    .limit(100);
  for (const log of logs) {
    try {
      const resp = await sendMailgunEmail({
        to: log.recipientEmail,
        subject: log.subject,
        html: log.body,
        text: ''
      });
      log.status = 'SENT';
      log.sentAt = Date.now();
      log.providerMessageId = resp?.id || null;
      log.error = null;
      await log.save();
    } catch (err) {
      log.retries = Number(log.retries || 0) + 1;
      log.status = log.retries >= log.maxRetries ? 'FAILED' : 'QUEUED';
      log.error = err?.message || 'Mail send failed';
      await log.save();
    }
  }
  const stats = await CommunicationRecipientLog.aggregate([
    { $match: { tenantId, campaignId, isdeleted: false } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  const map = {};
  stats.forEach((x) => {
    map[x._id] = x.count;
  });
  const queued = map.QUEUED || 0;
  const sent = map.SENT || 0;
  const failed = map.FAILED || 0;
  const skipped = map.SKIPPED || 0;
  campaign.queuedCount = queued;
  campaign.sentCount = sent;
  campaign.failedCount = failed;
  campaign.skippedCount = skipped;
  if (queued > 0) {
    campaign.status = 'QUEUED';
  } else if (failed > 0 && sent > 0) {
    campaign.status = 'PARTIAL_FAILED';
    campaign.completedAt = Date.now();
  } else if (failed > 0 && sent === 0) {
    campaign.status = 'FAILED';
    campaign.completedAt = Date.now();
  } else {
    campaign.status = 'COMPLETED';
    campaign.completedAt = Date.now();
  }
  await campaign.save();
  return campaign;
};

export const processDueScheduledCampaigns = async () => {
  const now = Date.now();
  const campaigns = await CommunicationCampaign.find({
    isdeleted: false,
    status: 'SCHEDULED',
    sendType: 'SCHEDULED',
    scheduledAt: { $lte: now }
  })
    .sort({ scheduledAt: 1 })
    .limit(20)
    .lean();
  for (const c of campaigns) {
    await processCommunicationCampaign({
      tenantId: c.tenantId,
      campaignId: c.campaignId
    });
  }
  return campaigns.length;
};

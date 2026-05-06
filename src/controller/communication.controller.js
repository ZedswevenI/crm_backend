import constants from '../helpers/constants.js';
import CommunicationTemplate from '../models/communicationtemplate.model.js';
import CommunicationCampaign from '../models/communicationcampaign.model.js';
import CommunicationRecipientLog from '../models/communicationrecipientlog.model.js';
import { resolveStudentRecipients } from '../services/recipientResolver.service.js';
import { buildTemplateDataFromStudent, renderTemplate } from '../services/templateRenderer.service.js';
import { processCommunicationCampaign } from '../services/communicationProcessor.service.js';
import CommunicationEventConfig from '../models/communicationeventconfig.model.js';

const pickTenantId = (req) => String(req.body?.entiId || req.body?.tenantId || '').trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v).trim());
const pickUserId = (req) => safeTrim(req.user?.userId || req.body?.userId);

const extractVariables = (subject = '', body = '') => {
  const text = `${subject || ''} ${body || ''}`;
  const matches = text.match(/{{\s*[\w.]+\s*}}/g) || [];
  return Array.from(new Set(matches.map((x) => x.replace('{{', '').replace('}}', '').trim()).filter(Boolean)));
};

const createTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const name = safeTrim(req.body?.name);
    const channel = safeTrim(req.body?.channel) || 'email';
    const subject = safeTrim(req.body?.subject) || null;
    const body = req.body?.body || '';
    const category = safeTrim(req.body?.category).toUpperCase() || 'GENERAL';

    if (!name) return res.status(400).json({ status: false, message: 'Template name is required' });
    if (channel !== 'email') return res.status(400).json({ status: false, message: 'Only email channel is supported in Phase 1' });
    if (!safeTrim(body)) return res.status(400).json({ status: false, message: 'Template body is required' });

    const doc = await CommunicationTemplate.create({
      tenantId,
      name,
      channel,
      subject,
      body,
      category,
      variables: extractVariables(subject, body),
      status: 'ACTIVE',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });

    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Template created',
      data: doc
    });
  } catch (err) {
    if (String(err?.code) === '11000') return res.status(409).json({ status: false, message: 'Template already exists' });
    return next(err);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const templateId = safeTrim(req.body?.templateId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!templateId) return res.status(400).json({ status: false, message: 'templateId is required' });

    const doc = await CommunicationTemplate.findOne({ tenantId, templateId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Template not found' });

    if (req.body?.name !== undefined) doc.name = safeTrim(req.body.name);
    if (req.body?.category !== undefined) doc.category = safeTrim(req.body.category).toUpperCase() || 'GENERAL';
    if (req.body?.subject !== undefined) doc.subject = safeTrim(req.body.subject) || null;
    if (req.body?.body !== undefined) doc.body = req.body.body || '';
    if (req.body?.status !== undefined) doc.status = safeTrim(req.body.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    doc.variables = extractVariables(doc.subject, doc.body);
    doc.updatedBy = userId || null;
    await doc.save();

    return res.status(200).json({ status: true, message: 'Template updated', data: doc });
  } catch (err) {
    return next(err);
  }
};

const listTemplates = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const q = req.query || {};
    const search = safeTrim(q.search);
    const channel = safeTrim(q.channel);
    const category = safeTrim(q.category).toUpperCase();

    const query = { tenantId, isdeleted: false };
    if (channel) query.channel = channel;
    if (category && category !== 'ALL') query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };

    const rows = await CommunicationTemplate.find(query).sort({ updatedAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: 'Templates fetched',
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const viewTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const templateId = safeTrim(req.body?.templateId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!templateId) return res.status(400).json({ status: false, message: 'templateId is required' });

    const doc = await CommunicationTemplate.findOne({ tenantId, templateId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Template not found' });

    return res.status(200).json({ status: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const templateId = safeTrim(req.body?.templateId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!templateId) return res.status(400).json({ status: false, message: 'templateId is required' });

    await CommunicationTemplate.updateOne({ tenantId, templateId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } });

    return res.status(200).json({ status: true, message: 'Template deleted' });
  } catch (err) {
    return next(err);
  }
};

const previewRecipients = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const result = await resolveStudentRecipients({
      tenantId,
      filters: req.body?.filters || {}
    });

    return res.status(200).json({
      status: true,
      message: 'Recipients preview fetched',
      data: {
        totalRecipients: result.totalRecipients,
        validEmailCount: result.validEmailCount,
        missingEmailCount: result.missingEmailCount,
        rows: result.recipients.slice(0, 100)
      }
    });
  } catch (err) {
    return next(err);
  }
};

const sendCommunication = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const templateId = safeTrim(req.body?.templateId);
    const title = safeTrim(req.body?.title);
    const sendType = safeTrim(req.body?.sendType).toUpperCase() === 'SCHEDULED' ? 'SCHEDULED' : 'NOW';
    const scheduledAt = Number(req.body?.scheduledAt || 0);

    if (!templateId) return res.status(400).json({ status: false, message: 'templateId is required' });
    if (!title) return res.status(400).json({ status: false, message: 'Campaign title is required' });
    if (sendType === 'SCHEDULED' && (!scheduledAt || scheduledAt <= Date.now())) {
      return res.status(400).json({ status: false, message: 'Valid future scheduledAt is required' });
    }

    const template = await CommunicationTemplate.findOne({
      tenantId,
      templateId,
      channel: 'email',
      status: 'ACTIVE',
      isdeleted: false
    }).lean();

    if (!template) return res.status(404).json({ status: false, message: 'Active email template not found' });

    const resolved = await resolveStudentRecipients({
      tenantId,
      filters: req.body?.filters || {}
    });

    const campaign = await CommunicationCampaign.create({
      tenantId,
      title,
      templateId,
      templateName: template.name,
      category: template.category,
      channel: 'email',
      subject: template.subject || null,
      body: template.body || null,
      recipientFilters: req.body?.filters || {},
      sendType,
      scheduledAt: sendType === 'SCHEDULED' ? scheduledAt : null,
      totalRecipients: resolved.totalRecipients,
      validEmailCount: resolved.validEmailCount,
      missingEmailCount: resolved.missingEmailCount,
      queuedCount: resolved.validEmailCount,
      skippedCount: resolved.missingEmailCount,
      status: sendType === 'SCHEDULED' ? 'SCHEDULED' : 'QUEUED',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });

    const logDocs = resolved.recipients.map((r) => {
      const data = buildTemplateDataFromStudent(r);
      const subject = renderTemplate(template.subject || '', data);
      const body = renderTemplate(template.body || '', data);

      return {
        tenantId,
        campaignId: campaign.campaignId,
        templateId: template.templateId,
        templateName: template.name,
        channel: 'email',
        studentId: r.studentId || null,
        admissionNo: r.admissionNo || null,
        studentName: r.studentName || null,
        parentName: r.parentName || null,
        recipientEmail: r.recipientEmail || null,
        classNo: r.classNo,
        batchId: r.batchId || null,
        batchCode: r.batchCode || null,
        centerId: r.centerId || null,
        centerCode: r.centerCode || null,
        programId: r.programId || null,
        programName: r.programName || null,
        subject,
        body,
        status: r.hasValidEmail ? 'QUEUED' : 'SKIPPED',
        error: r.hasValidEmail ? null : 'Student email missing/invalid',
        createdBy: userId || null,
        updatedBy: userId || null
      };
    });

    if (logDocs.length) await CommunicationRecipientLog.insertMany(logDocs);

    if (sendType === 'NOW') {
      setImmediate(() => {
        processCommunicationCampaign({ tenantId, campaignId: campaign.campaignId }).catch((e) => console.error('[communication send failed]', e));
      });
    }

    return res.status(200).json({
      status: true,
      message: sendType === 'SCHEDULED' ? 'Communication scheduled' : 'Communication queued for sending',
      data: {
        campaignId: campaign.campaignId,
        totalRecipients: resolved.totalRecipients,
        validEmailCount: resolved.validEmailCount,
        missingEmailCount: resolved.missingEmailCount,
        status: campaign.status
      }
    });
  } catch (err) {
    return next(err);
  }
};

const listCampaigns = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const pageNum = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const query = { tenantId, isdeleted: false };
    const status = safeTrim(req.query.status).toUpperCase();
    if (status && status !== 'ALL') query.status = status;

    const [rows, total] = await Promise.all([CommunicationCampaign.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(), CommunicationCampaign.countDocuments(query)]);

    return res.status(200).json({
      status: true,
      message: 'Campaigns fetched',
      data: { rows, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 0 }
    });
  } catch (err) {
    return next(err);
  }
};

const listLogs = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const pageNum = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const search = safeTrim(req.query.search);
    const status = safeTrim(req.query.status).toUpperCase();
    const channel = safeTrim(req.query.channel);

    const query = { tenantId, isdeleted: false };
    if (status && status !== 'ALL') query.status = status;
    if (channel) query.channel = channel;
    if (search) {
      query.$or = [{ studentName: { $regex: search, $options: 'i' } }, { admissionNo: { $regex: search, $options: 'i' } }, { recipientEmail: { $regex: search, $options: 'i' } }, { batchCode: { $regex: search, $options: 'i' } }];
    }

    const [rows, total] = await Promise.all([CommunicationRecipientLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(), CommunicationRecipientLog.countDocuments(query)]);

    return res.status(200).json({
      status: true,
      message: 'Sent logs fetched',
      data: { rows, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 0 }
    });
  } catch (err) {
    return next(err);
  }
};

const viewLog = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const logId = safeTrim(req.body?.logId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!logId) return res.status(400).json({ status: false, message: 'logId is required' });

    const log = await CommunicationRecipientLog.findOne({ tenantId, logId, isdeleted: false }).lean();
    if (!log) return res.status(404).json({ status: false, message: 'Log not found' });

    return res.status(200).json({ status: true, data: log });
  } catch (err) {
    return next(err);
  }
};

const retryFailedLog = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const logId = safeTrim(req.body?.logId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!logId) return res.status(400).json({ status: false, message: 'logId is required' });

    const log = await CommunicationRecipientLog.findOne({ tenantId, logId, isdeleted: false });
    if (!log) return res.status(404).json({ status: false, message: 'Log not found' });
    if (log.status !== 'FAILED') return res.status(400).json({ status: false, message: 'Only failed logs can be retried' });

    log.status = 'QUEUED';
    log.error = null;
    await log.save();

    await CommunicationCampaign.updateOne({ tenantId, campaignId: log.campaignId, isdeleted: false }, { $set: { status: 'QUEUED' } });

    setImmediate(() => {
      processCommunicationCampaign({ tenantId, campaignId: log.campaignId }).catch((e) => console.error('[communication retry failed]', e));
    });

    return res.status(200).json({ status: true, message: 'Email retry queued' });
  } catch (err) {
    return next(err);
  }
};

const saveEventConfig = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const eventCode = safeTrim(req.body?.eventCode).toUpperCase();
    const eventName = safeTrim(req.body?.eventName);
    const sourceModule = safeTrim(req.body?.sourceModule).toUpperCase() || 'GENERAL';
    const templateId = safeTrim(req.body?.templateId);
    if (!eventCode) return res.status(400).json({ status: false, message: 'eventCode is required' });
    if (!eventName) return res.status(400).json({ status: false, message: 'eventName is required' });
    if (!templateId) return res.status(400).json({ status: false, message: 'templateId is required' });
    const template = await CommunicationTemplate.findOne({
      tenantId,
      templateId,
      channel: 'email',
      status: 'ACTIVE',
      isdeleted: false
    }).lean();
    if (!template) return res.status(404).json({ status: false, message: 'Active email template not found' });
    const doc = await CommunicationEventConfig.findOneAndUpdate(
      { tenantId, eventCode, channel: 'email', isdeleted: false },
      {
        $set: {
          tenantId,
          eventCode,
          eventName,
          sourceModule,
          templateId,
          channel: 'email',
          enabled: req.body?.enabled === false ? false : true,
          updatedBy: userId || null
        },
        $setOnInsert: {
          createdBy: userId || null,
          isdeleted: false
        }
      },
      { new: true, upsert: true }
    ).lean();
    return res.status(200).json({
      status: true,
      message: 'Event configuration saved',
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const listEventConfigs = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const query = { tenantId, isdeleted: false };
    const eventCode = safeTrim(req.query?.eventCode).toUpperCase();
    const sourceModule = safeTrim(req.query?.sourceModule).toUpperCase();
    if (eventCode) query.eventCode = eventCode;
    if (sourceModule) query.sourceModule = sourceModule;
    const rows = await CommunicationEventConfig.find(query).sort({ sourceModule: 1, eventCode: 1 }).lean();
    return res.status(200).json({
      status: true,
      message: 'Event configurations fetched',
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const toggleEventConfig = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const configId = safeTrim(req.body?.configId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!configId) return res.status(400).json({ status: false, message: 'configId is required' });
    const doc = await CommunicationEventConfig.findOne({ tenantId, configId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Event configuration not found' });
    doc.enabled = req.body?.enabled === true;
    doc.updatedBy = userId || null;
    await doc.save();
    return res.status(200).json({
      status: true,
      message: doc.enabled ? 'Event enabled' : 'Event disabled',
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const deleteEventConfig = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const configId = safeTrim(req.body?.configId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!configId) return res.status(400).json({ status: false, message: 'configId is required' });
    await CommunicationEventConfig.updateOne({ tenantId, configId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } });
    return res.status(200).json({ status: true, message: 'Event configuration deleted' });
  } catch (err) {
    return next(err);
  }
};

export default {
  createTemplate,
  updateTemplate,
  listTemplates,
  viewTemplate,
  deleteTemplate,
  previewRecipients,
  sendCommunication,
  listCampaigns,
  listLogs,
  viewLog,
  retryFailedLog,
  saveEventConfig,
  listEventConfigs,
  toggleEventConfig,
  deleteEventConfig
};

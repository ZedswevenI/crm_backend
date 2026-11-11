import constants from '../helpers/constants.js';
import CommunicationTemplate from '../models/communicationtemplate.model.js';
import CommunicationCampaign from '../models/communicationcampaign.model.js';
import CommunicationRecipientLog from '../models/communicationrecipientlog.model.js';
import { resolveStudentRecipients } from '../services/recipientResolver.service.js';
import { buildTemplateDataFromStudent, renderTemplate } from '../services/templateRenderer.service.js';
import { processCommunicationCampaign } from '../services/communicationProcessor.service.js';
import CommunicationEventConfig from '../models/communicationeventconfig.model.js';
import { uploadPublicEmailImageToS3 } from '../middlewares/s3.service.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';
import MockExam from '../models/mockExam.model.js';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExamBatchAssign from '../models/mockExambatchmapping.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import Batch from '../models/batch.model.js';

const pickTenantId = (req) => String(req.body?.entiId || req.body?.tenantId || '').trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v).trim());
const pickUserId = (req) => safeTrim(req.user?.userId || req.body?.userId);

const extractVariables = (subject = '', body = '') => {
  const text = `${subject || ''} ${body || ''}`;
  const matches = text.match(/{{\s*[\w.]+\s*}}/g) || [];
  return Array.from(new Set(matches.map((x) => x.replace('{{', '').replace('}}', '').trim()).filter(Boolean)));
};

const isValidEmailAddress = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

// Section names on MockExam already double as subject names (confirmed live: "PHYSICS"/"CHEMISTRY"/
// "MATHS"), so no separate Subject lookup is needed for the per-subject marks table.
const buildExamResultEmailData = (result, exam) => {
  const sectionNameMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), safeTrim(s.sectionName)]));
  const rowsHtml = (result.sectionResults || [])
    .map((sec) => {
      const name = sectionNameMap.get(safeTrim(sec.sectionId)) || safeTrim(sec.sectionId);
      return `<tr><td style="padding:6px 12px;border:1px solid #ccc;">${name}</td><td style="padding:6px 12px;border:1px solid #ccc;text-align:center;">${sec.obtainedMarks ?? 0}</td><td style="padding:6px 12px;border:1px solid #ccc;text-align:center;">${sec.totalMarks ?? 0}</td></tr>`;
    })
    .join('');
  const marksTable = `<table style="border-collapse:collapse;margin:12px 0;"><thead><tr><th style="padding:6px 12px;border:1px solid #ccc;">Subject</th><th style="padding:6px 12px;border:1px solid #ccc;">Obtained</th><th style="padding:6px 12px;border:1px solid #ccc;">Total</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
  const totalMarks = result.totalMarks || exam.totalMarks || 0;
  const obtainedMarks = result.obtainedMarks || 0;
  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 10000) / 100 : 0;
  return {
    examName: exam.examName || '',
    examCode: exam.examCode || '',
    totalMarks: String(totalMarks),
    obtainedMarks: String(obtainedMarks),
    percentage: String(percentage),
    marksTable
  };
};

// Fixed content — no user-authored template allowed for exam-result mail by design.
const EXAM_RESULT_SUBJECT = '{{examName}} - Exam Result';
const EXAM_RESULT_BODY = `<p>Dear {{parentName}},</p>
<p>Please find below the exam result for <b>{{studentName}}</b>.</p>
<table style="border-collapse:collapse;margin:12px 0;">
<tr><td style="padding:6px 12px;border:1px solid #ccc;"><b>Student Name</b></td><td style="padding:6px 12px;border:1px solid #ccc;">{{studentName}}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #ccc;"><b>Class</b></td><td style="padding:6px 12px;border:1px solid #ccc;">{{classNo}}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #ccc;"><b>Batch</b></td><td style="padding:6px 12px;border:1px solid #ccc;">{{batchName}}</td></tr>
</table>
<p>Exam: <b>{{examName}}</b></p>
{{marksTable}}
<p>Total Marks: <b>{{obtainedMarks}} / {{totalMarks}}</b> ({{percentage}}%)</p>`;

const EXAM_ABSENT_SUBJECT = '{{examName}} - Absence Notice';
const EXAM_ABSENT_BODY = `<p>Dear {{parentName}},</p>
<p>We wish to inform you that <b>{{studentName}}</b> (Class {{classNo}}, Batch {{batchName}}) was marked absent for <b>{{examName}}</b>.</p>
<p>Please reach out to the center if you believe this is incorrect.</p>`;

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

// Send to one or more batches, by DB-resolved recipients (not frontend-uploaded rows like
// sendExcelBulkMail) — either rendered from a saved template or raw ad-hoc subject/body, same
// choice sendExcelBulkMail already offers for Excel-sourced recipients.
const sendBatchCommunication = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const batchIds = Array.isArray(req.body?.batchIds) ? req.body.batchIds.map(safeTrim).filter(Boolean) : [];
    const batchCodes = Array.isArray(req.body?.batchCodes) ? req.body.batchCodes.map(safeTrim).filter(Boolean) : [];
    if (!batchIds.length && !batchCodes.length) {
      return res.status(400).json({ status: false, message: 'batchIds[] or batchCodes[] is required' });
    }

    const templateId = safeTrim(req.body?.templateId);
    const rawSubject = safeTrim(req.body?.subject);
    const rawBody = req.body?.body || '';
    if (templateId && (rawSubject || safeTrim(rawBody))) {
      return res.status(400).json({ status: false, message: 'Provide either templateId or subject/body, not both' });
    }
    if (!templateId && (!rawSubject || !safeTrim(rawBody))) {
      return res.status(400).json({ status: false, message: 'templateId, or both subject and body, is required' });
    }

    let subjectTemplate;
    let bodyTemplate;
    let category;
    let resolvedTemplateId;
    let templateName;
    if (templateId) {
      const template = await CommunicationTemplate.findOne({ tenantId, templateId, channel: 'email', status: 'ACTIVE', isdeleted: false }).lean();
      if (!template) return res.status(404).json({ status: false, message: 'Active email template not found' });
      subjectTemplate = template.subject || '';
      bodyTemplate = template.body || '';
      category = template.category;
      resolvedTemplateId = template.templateId;
      templateName = template.name;
    } else {
      subjectTemplate = rawSubject;
      bodyTemplate = rawBody;
      category = 'BATCH_BULK';
      resolvedTemplateId = `BATCH_${Date.now()}`;
      templateName = `Batch Mail ${Date.now()}`;
    }

    const title = safeTrim(req.body?.title) || templateName;
    const sendType = safeTrim(req.body?.sendType).toUpperCase() === 'SCHEDULED' ? 'SCHEDULED' : 'NOW';
    const scheduledAt = Number(req.body?.scheduledAt || 0);
    if (sendType === 'SCHEDULED' && (!scheduledAt || scheduledAt <= Date.now())) {
      return res.status(400).json({ status: false, message: 'Valid future scheduledAt is required' });
    }

    const filters = { ...(req.body?.filters || {}) };
    if (batchIds.length) filters.batchIds = batchIds;
    if (batchCodes.length) filters.batchCodes = batchCodes;
    const resolved = await resolveStudentRecipients({ tenantId, filters });

    const campaign = await CommunicationCampaign.create({
      tenantId,
      title,
      templateId: resolvedTemplateId,
      templateName,
      category,
      channel: 'email',
      subject: subjectTemplate || null,
      body: bodyTemplate || null,
      recipientFilters: filters,
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
      const subject = renderTemplate(subjectTemplate || '', data);
      const body = renderTemplate(bodyTemplate || '', data);
      return {
        tenantId,
        campaignId: campaign.campaignId,
        templateId: resolvedTemplateId,
        templateName,
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
        processCommunicationCampaign({ tenantId, campaignId: campaign.campaignId }).catch((e) => console.error('[batch communication send failed]', e));
      });
    }

    return res.status(200).json({
      status: true,
      message: sendType === 'SCHEDULED' ? 'Batch communication scheduled' : 'Batch communication queued for sending',
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

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const sendExcelBulkMail = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const title = safeTrim(req.body?.title) || 'Excel Bulk Mail';
    const subjectTemplate = safeTrim(req.body?.subject);
    const bodyTemplate = req.body?.body || '';
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const emailKey = safeTrim(req.body?.emailKey) || 'email';
    const nameKey = safeTrim(req.body?.nameKey) || 'name';
    if (!subjectTemplate) {
      return res.status(400).json({ status: false, message: 'Email subject is required' });
    }
    if (!safeTrim(bodyTemplate)) {
      return res.status(400).json({ status: false, message: 'Email body is required' });
    }
    if (!rows.length) {
      return res.status(400).json({ status: false, message: 'At least one row is required' });
    }
    const campaign = await CommunicationCampaign.create({
      tenantId,
      title,
      templateId: `EXCEL_${Date.now()}`,
      templateName: `Bulk Mail ${Date.now()}`,
      category: 'EXCEL_BULK',
      channel: 'email',
      subject: subjectTemplate,
      body: bodyTemplate,
      recipientFilters: {
        source: 'EXCEL_FRONTEND',
        totalRows: rows.length,
        emailKey,
        nameKey
      },
      sendType: 'NOW',
      scheduledAt: null,
      totalRecipients: rows.length,
      validEmailCount: 0,
      missingEmailCount: 0,
      queuedCount: 0,
      skippedCount: 0,
      status: 'QUEUED',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });
    let validEmailCount = 0;
    let skippedCount = 0;
    const logDocs = rows.map((row, index) => {
      const data = row || {};
      const recipientEmail = safeTrim(data[emailKey]);
      const recipientName = safeTrim(data[nameKey]) || safeTrim(data.name) || `Recipient ${index + 1}`;
      const hasValidEmail = isValidEmail(recipientEmail);
      if (hasValidEmail) validEmailCount++;
      else skippedCount++;
      return {
        tenantId,
        campaignId: campaign.campaignId,
        templateId: campaign.templateId,
        templateName: campaign.templateName,
        channel: 'email',
        studentId: null,
        admissionNo: safeTrim(data.admissionNo) || null,
        studentName: recipientName,
        parentName: null,
        recipientEmail: hasValidEmail ? recipientEmail : null,
        classNo: data.classNo || null,
        batchId: data.batchId || null,
        batchCode: data.batchCode || null,
        centerId: data.centerId || null,
        centerCode: data.centerCode || null,
        programId: data.programId || null,
        programName: data.programName || null,
        subject: hasValidEmail ? renderTemplate(subjectTemplate, data) : subjectTemplate,
        body: hasValidEmail ? renderTemplate(bodyTemplate, data) : bodyTemplate,
        status: hasValidEmail ? 'QUEUED' : 'SKIPPED',
        error: hasValidEmail ? null : 'Email missing/invalid',
        rawData: data,
        createdBy: userId || null,
        updatedBy: userId || null
      };
    });
    if (logDocs.length) {
      await CommunicationRecipientLog.insertMany(logDocs);
    }
    await CommunicationCampaign.updateOne(
      { tenantId, campaignId: campaign.campaignId },
      {
        $set: {
          validEmailCount,
          missingEmailCount: skippedCount,
          queuedCount: validEmailCount,
          skippedCount,
          totalRecipients: rows.length
        }
      }
    );
    if (validEmailCount > 0) {
      setImmediate(() => {
        processCommunicationCampaign({ tenantId, campaignId: campaign.campaignId }).catch((e) => console.error('[excel bulk mail failed]', e));
      });
    }
    return res.status(200).json({
      status: true,
      message: validEmailCount > 0 ? 'Bulk mail queued successfully' : 'No valid emails found',
      data: {
        campaignId: campaign.campaignId,
        totalRows: rows.length,
        queuedCount: validEmailCount,
        skippedCount
      }
    });
  } catch (err) {
    return next(err);
  }
};

const uploadEmailAsset = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        status: false,
        message: 'tenantId (entiId) is required'
      });
    }
    if (!req.files) {
      return res.status(400).json({
        status: false,
        message: 'Image file is required'
      });
    }
    if (req.files[0].size > 2 * 1024 * 1024) {
      return res.status(400).json({
        status: false,
        message: 'Image size should not exceed 2MB'
      });
    }
    const url = await uploadPublicEmailImageToS3(req.files[0], tenantId);
    return res.status(200).json({
      status: true,
      message: 'Email image uploaded successfully',
      data: { url }
    });
  } catch (err) {
    return next(err);
  }
};

// Emails exam results to parents — fixed content only (no user-authored template, by design).
// Targeting is inferred from which params are sent:
//   admissionNo given           -> that one student
//   batchId given (no admNo)    -> every student assigned to this exam in that batch
//   neither given               -> every student assigned to this exam, across all batches
// notifyAbsentees controls whether assigned-but-absent students get a separate "absence notice"
// email instead of being silently skipped. Requires the exam's results to be officially published.
const sendExamResultEmail = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const examId = safeTrim(req.body?.examId);
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    const admissionNo = safeTrim(req.body?.admissionNo) || null;
    const batchIdInput = safeTrim(req.body?.batchId) || null;
    const notifyAbsentees = req.body?.notifyAbsentees === true;

    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { examName: 1, examCode: 1, totalMarks: 1, sections: 1, status: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    if (exam.status !== 'result_published') {
      return res.status(400).json({ status: false, message: 'Results for this exam are not published yet' });
    }

    // Resolve the roster to target.
    let rosterAdmissionNos = [];
    if (admissionNo) {
      const profileExists = await StudentProfile.exists({ tenantId, admissionNo, isdeleted: false });
      if (!profileExists) return res.status(404).json({ status: false, message: 'Student not found' });
      rosterAdmissionNos = [admissionNo];
    } else {
      const assignQuery = { tenantId, examId, isdeleted: false, status: 'enabled' };
      if (batchIdInput) {
        // MockExamBatchAssign.batchId has been observed holding a batchCode instead of the real
        // batchId on some records — resolve the input to both forms before matching.
        const batchDoc = await Batch.findOne({ tenantId, $or: [{ batchId: batchIdInput }, { batchCode: batchIdInput }] }, { batchId: 1, batchCode: 1 }).lean();
        const candidates = [...new Set([batchIdInput, batchDoc?.batchId, batchDoc?.batchCode].filter(Boolean))];
        assignQuery.batchId = { $in: candidates };
      }
      const assignments = await MockExamBatchAssign.find(assignQuery, { batchId: 1, students: 1 }).lean();
      if (batchIdInput && !assignments.length) {
        return res.status(404).json({ status: false, message: 'No assignment found for this exam and batch' });
      }
      const seen = new Set();
      for (const a of assignments) {
        for (const s of a.students || []) {
          const admNo = safeTrim(s.admissionNo);
          if (admNo) seen.add(admNo);
        }
      }
      rosterAdmissionNos = [...seen];
      if (!rosterAdmissionNos.length) {
        return res.status(200).json({ status: true, message: 'No students assigned', data: { totalTargeted: 0, queuedMarksCount: 0, queuedAbsentCount: 0, skippedNoResultCount: 0, skippedNoEmailCount: 0 } });
      }
    }

    const [results, profiles] = await Promise.all([
      MockExamResult.find({ tenantId, examId, admissionNo: { $in: rosterAdmissionNos }, isdeleted: false }, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, sectionResults: 1 }).lean(),
      StudentProfile.find(
        { tenantId, admissionNo: { $in: rosterAdmissionNos }, isdeleted: false },
        { admissionNo: 1, studentId: 1, 'student.name': 1, 'student.email': 1, 'student.parentName': 1, classNo: 1, batchId: 1, centerId: 1, centerCode: 1, programId: 1, programName: 1 }
      ).lean()
    ]);
    const resultMap = new Map(results.map((r) => [safeTrim(r.admissionNo), r]));
    const profileMap = new Map(profiles.map((p) => [safeTrim(p.admissionNo), p]));

    const withResult = rosterAdmissionNos.filter((a) => resultMap.has(a));
    const absentList = rosterAdmissionNos.filter((a) => !resultMap.has(a));

    if (admissionNo && !withResult.length && !notifyAbsentees) {
      return res.status(404).json({ status: false, message: 'Result not found for this student' });
    }

    const batchKeys = [...new Set(profiles.map((p) => p.batchId).filter(Boolean))];
    const batches = batchKeys.length ? await Batch.find({ tenantId, $or: [{ batchId: { $in: batchKeys } }, { batchCode: { $in: batchKeys } }] }, { batchId: 1, batchCode: 1, batchName: 1 }).lean() : [];
    const batchMap = new Map();
    for (const b of batches) {
      batchMap.set(b.batchId, b);
      batchMap.set(b.batchCode, b);
    }

    const title = safeTrim(req.body?.title) || `${exam.examName} - Result Mail`;
    const sendType = safeTrim(req.body?.sendType).toUpperCase() === 'SCHEDULED' ? 'SCHEDULED' : 'NOW';
    const scheduledAt = Number(req.body?.scheduledAt || 0);
    if (sendType === 'SCHEDULED' && (!scheduledAt || scheduledAt <= Date.now())) {
      return res.status(400).json({ status: false, message: 'Valid future scheduledAt is required' });
    }

    const resolvedTemplateId = `EXAM_RESULT_${Date.now()}`;
    const templateName = `${exam.examName} Result Mail`;
    const campaign = await CommunicationCampaign.create({
      tenantId,
      title,
      templateId: resolvedTemplateId,
      templateName,
      category: 'EXAM_RESULT',
      channel: 'email',
      subject: EXAM_RESULT_SUBJECT,
      body: EXAM_RESULT_BODY,
      recipientFilters: { examId, admissionNo: admissionNo || null, batchId: batchIdInput || null, notifyAbsentees },
      sendType,
      scheduledAt: sendType === 'SCHEDULED' ? scheduledAt : null,
      status: sendType === 'SCHEDULED' ? 'SCHEDULED' : 'QUEUED',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });

    const buildLogBase = (admNo, profile, subject, body, hasValidEmail, email) => ({
      tenantId,
      campaignId: campaign.campaignId,
      templateId: resolvedTemplateId,
      templateName,
      channel: 'email',
      studentId: profile?.studentId || null,
      admissionNo: admNo,
      studentName: profile?.student?.name || null,
      parentName: profile?.student?.parentName || null,
      recipientEmail: email || null,
      classNo: profile?.classNo ?? null,
      batchId: profile?.batchId || null,
      batchCode: batchMap.get(profile?.batchId)?.batchCode || null,
      centerId: profile?.centerId || null,
      centerCode: profile?.centerCode || null,
      programId: profile?.programId || null,
      programName: profile?.programName || null,
      subject,
      body,
      status: hasValidEmail ? 'QUEUED' : 'SKIPPED',
      error: hasValidEmail ? null : 'Student email missing/invalid',
      createdBy: userId || null,
      updatedBy: userId || null
    });

    let queuedMarksCount = 0;
    let queuedAbsentCount = 0;
    let skippedNoEmailCount = 0;
    const logDocs = [];

    for (const admNo of withResult) {
      const profile = profileMap.get(admNo) || {};
      const result = resultMap.get(admNo);
      const email = safeTrim(profile?.student?.email).toLowerCase();
      const hasValidEmail = isValidEmailAddress(email);
      if (hasValidEmail) queuedMarksCount++;
      else skippedNoEmailCount++;
      const batch = profile.batchId ? batchMap.get(profile.batchId) : null;
      const data = {
        studentName: profile?.student?.name || '',
        parentName: safeTrim(profile?.student?.parentName) || 'Parent',
        classNo: profile?.classNo ?? '',
        batchName: batch?.batchName || '',
        ...buildExamResultEmailData(result, exam)
      };
      const subject = renderTemplate(EXAM_RESULT_SUBJECT, data);
      const body = renderTemplate(EXAM_RESULT_BODY, data);
      logDocs.push(buildLogBase(admNo, profile, subject, body, hasValidEmail, email));
    }

    if (notifyAbsentees) {
      for (const admNo of absentList) {
        const profile = profileMap.get(admNo) || {};
        const email = safeTrim(profile?.student?.email).toLowerCase();
        const hasValidEmail = isValidEmailAddress(email);
        if (hasValidEmail) queuedAbsentCount++;
        else skippedNoEmailCount++;
        const batch = profile.batchId ? batchMap.get(profile.batchId) : null;
        const data = {
          studentName: profile?.student?.name || '',
          parentName: safeTrim(profile?.student?.parentName) || 'Parent',
          classNo: profile?.classNo ?? '',
          batchName: batch?.batchName || '',
          examName: exam.examName || ''
        };
        const subject = renderTemplate(EXAM_ABSENT_SUBJECT, data);
        const body = renderTemplate(EXAM_ABSENT_BODY, data);
        logDocs.push(buildLogBase(admNo, profile, subject, body, hasValidEmail, email));
      }
    }
    const skippedNoResultCount = notifyAbsentees ? 0 : absentList.length;

    if (logDocs.length) await CommunicationRecipientLog.insertMany(logDocs);

    campaign.totalRecipients = logDocs.length;
    campaign.validEmailCount = queuedMarksCount + queuedAbsentCount;
    campaign.missingEmailCount = skippedNoEmailCount;
    campaign.queuedCount = queuedMarksCount + queuedAbsentCount;
    campaign.skippedCount = skippedNoEmailCount;
    await campaign.save();

    if (sendType === 'NOW' && logDocs.length) {
      setImmediate(() => {
        processCommunicationCampaign({ tenantId, campaignId: campaign.campaignId }).catch((e) => console.error('[exam result mail send failed]', e));
      });
    }

    return res.status(200).json({
      status: true,
      message: sendType === 'SCHEDULED' ? 'Exam result email scheduled' : 'Exam result email queued for sending',
      data: {
        campaignId: campaign.campaignId,
        totalTargeted: rosterAdmissionNos.length,
        queuedMarksCount,
        queuedAbsentCount,
        skippedNoResultCount,
        skippedNoEmailCount,
        status: campaign.status
      }
    });
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
  sendBatchCommunication,
  listCampaigns,
  listLogs,
  viewLog,
  retryFailedLog,
  saveEventConfig,
  listEventConfigs,
  toggleEventConfig,
  deleteEventConfig,
  sendExcelBulkMail,
  uploadEmailAsset,
  sendExamResultEmail
};

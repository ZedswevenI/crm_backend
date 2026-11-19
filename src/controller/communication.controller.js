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
import { sendEmail } from '../services/mail.service.js';
import { buildPerformanceReportFilename, generatePerformanceReportPdfBuffer } from '../helpers/performanceReportPdf.helper.js';

const pickTenantId = (req) => String(req.body?.entiId || req.body?.tenantId || '').trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v).trim());
const pickUserId = (req) => safeTrim(req.user?.userId || req.body?.userId);

const extractVariables = (subject = '', body = '') => {
  const text = `${subject || ''} ${body || ''}`;
  const matches = text.match(/{{\s*[\w.]+\s*}}/g) || [];
  return Array.from(new Set(matches.map((x) => x.replace('{{', '').replace('}}', '').trim()).filter(Boolean)));
};

const isValidEmailAddress = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const collectStudentEmails = (profile) => {
  const raw = [profile?.student?.email, profile?.student?.email1, profile?.student?.email2];
  return [
    ...new Set(
      raw
        .map((e) => safeTrim(e).toLowerCase())
        .filter((e) => isValidEmailAddress(e))
    )
  ];
};

const buildNoteBlockHtml = (note) => {
  const cleaned = safeTrim(note);
  if (!cleaned) return '';
  return `<p style="color:#0d6efd;margin:12px 0;"><b>Note:</b> ${escapeHtml(cleaned)}</p>`;
};

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

const computeExamStats = async (tenantId, examId) => {
  const allResults = await MockExamResult.find(
    { tenantId, examId, isdeleted: false },
    { obtainedMarks: 1, totalMarks: 1, isAbsent: 1, sectionResults: 1 }
  ).lean();

  const sectionBuckets = new Map();
  const sectionTotalMarks = new Map();
  let overallHighest = 0;
  let overallSum = 0;
  let overallPresentCount = 0;
  let overallTotalMarks = 0;

  for (const r of allResults) {
    if (!overallTotalMarks && r.totalMarks) overallTotalMarks = Number(r.totalMarks);
    const isOverallAbsent = Boolean(r.isAbsent);
    if (!isOverallAbsent) {
      const tot = Number(r.obtainedMarks ?? 0);
      if (tot > overallHighest) overallHighest = tot;
      overallSum += tot;
      overallPresentCount += 1;
    }
    for (const sec of r.sectionResults || []) {
      const sid = safeTrim(sec.sectionId);
      if (!sid) continue;
      if (!sectionTotalMarks.has(sid) && sec.totalMarks) sectionTotalMarks.set(sid, Number(sec.totalMarks));
      if (sec.isAbsent) continue;
      const val = Number(sec.obtainedMarks ?? 0);
      const cur = sectionBuckets.get(sid) || { max: -Infinity, sum: 0, count: 0 };
      if (val > cur.max) cur.max = val;
      cur.sum += val;
      cur.count += 1;
      sectionBuckets.set(sid, cur);
    }
  }

  const sectionStats = new Map();
  for (const [sid, cur] of sectionBuckets.entries()) {
    sectionStats.set(sid, {
      highest: cur.max === -Infinity ? 0 : cur.max,
      average: cur.count > 0 ? Math.round(cur.sum / cur.count) : 0
    });
  }

  return {
    sectionStats,
    sectionTotalMarks,
    overallTotalMarks,
    overallHighest: overallPresentCount ? overallHighest : 0,
    overallAverage: overallPresentCount ? Math.round(overallSum / overallPresentCount) : 0
  };
};

const buildStudentPerformanceReportData = (profile, result, exam, batch, stats) => {
  const studentName = safeTrim(profile?.student?.name) || safeTrim(profile?.admissionNo) || 'Student';
  const enrollmentNo = safeTrim(profile?.admissionNo) || '-';
  const admissionNo = safeTrim(profile?.registrationNumber) || safeTrim(profile?.portalStudentId) || '-';
  const regNo = safeTrim(profile?.registrationNumber) || enrollmentNo;
  const batchName = safeTrim(batch?.batchName) || safeTrim(batch?.batchCode) || '-';
  const programName = safeTrim(profile?.programName) || '-';
  const examName = safeTrim(exam?.examName) || 'Exam';

  const sectionNameMap = new Map((exam?.sections || []).map((s) => [safeTrim(s.sectionId), safeTrim(s.sectionName)]));
  const rows = (result?.sectionResults || []).map((sec) => {
    const sid = safeTrim(sec.sectionId);
    const subject = sectionNameMap.get(sid) || sid;
    const secStat = stats?.sectionStats?.get(sid) || { highest: 0, average: 0 };
    return {
      subject,
      yourMarks: sec.isAbsent ? 'AB' : Number(sec.obtainedMarks ?? 0),
      outOf: Number(sec.totalMarks ?? 0),
      highest: secStat.highest,
      average: secStat.average
    };
  });

  const outOfTotal = Number(result?.totalMarks || exam?.totalMarks || 0);
  const yourTotal = Number(result?.obtainedMarks ?? 0);
  const isOverallAbsent = Boolean(result?.isAbsent) || (rows.length > 0 && rows.every((r) => r.yourMarks === 'AB'));

  return {
    studentName,
    regNo,
    enrollmentNo,
    admissionNo,
    batchName,
    programName,
    examName,
    filename: buildPerformanceReportFilename(studentName, regNo),
    rows,
    total: {
      yourMarks: isOverallAbsent ? 'AB' : yourTotal,
      outOf: outOfTotal,
      highest: stats?.overallHighest ?? yourTotal,
      average: stats?.overallAverage ?? yourTotal
    }
  };
};

const buildAbsentStudentPerformanceReportData = (profile, exam, batch, stats) => {
  const studentName = safeTrim(profile?.student?.name) || safeTrim(profile?.admissionNo) || 'Student';
  const enrollmentNo = safeTrim(profile?.admissionNo) || '-';
  const admissionNo = safeTrim(profile?.registrationNumber) || safeTrim(profile?.portalStudentId) || '-';
  const regNo = safeTrim(profile?.registrationNumber) || enrollmentNo;
  const batchName = safeTrim(batch?.batchName) || safeTrim(batch?.batchCode) || '-';
  const programName = safeTrim(profile?.programName) || '-';
  const examName = safeTrim(exam?.examName) || 'Exam';

  const sections = Array.isArray(exam?.sections) ? exam.sections : [];
  const rows = sections.map((sec) => {
    const sid = safeTrim(sec.sectionId);
    const subject = safeTrim(sec.sectionName) || sid;
    const secStat = stats?.sectionStats?.get(sid) || { highest: 0, average: 0 };
    const outOf = stats?.sectionTotalMarks?.get(sid) ?? Number(sec.totalMarks ?? 0);
    return {
      subject,
      yourMarks: 'AB',
      outOf,
      highest: secStat.highest,
      average: secStat.average
    };
  });

  const outOfTotal = Number(exam?.totalMarks || stats?.overallTotalMarks || 0);

  return {
    isAbsent: true,
    classNo: profile?.classNo ?? '',
    studentName,
    regNo,
    enrollmentNo,
    admissionNo,
    batchName,
    programName,
    examName,
    filename: null,
    rows,
    total: {
      yourMarks: 'AB',
      outOf: outOfTotal,
      highest: stats?.overallHighest ?? 0,
      average: stats?.overallAverage ?? 0
    }
  };
};

const buildStudentDetailsHtml = (reportData) => {
  const rows = [
    ['Name', reportData?.studentName || '-'],
    ['Enrollment No', reportData?.enrollmentNo || '-'],
    ['Batch Name', reportData?.batchName || '-'],
    ['Program', reportData?.programName || '-']
  ];
  const trs = rows
    .map(
      ([label, val]) =>
        `<tr>
          <td style="padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:2px 6px;font-weight:bold;">:</td>
          <td style="padding:2px 0;">${escapeHtml(val)}</td>
        </tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;margin:10px 0 12px 0;"><tbody>${trs}</tbody></table>`;
};

const buildResultGridHtml = (reportData) => {
  const rows = Array.isArray(reportData?.rows) ? reportData.rows : [];
  const tot = reportData?.total || { yourMarks: 0, outOf: 0, highest: 0, average: 0 };
  const isAbMarks = (v) => String(v ?? '').trim().toUpperCase() === 'AB';
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:7px 14px;border:1px solid #000;text-align:center;">${escapeHtml(r.subject)}</td>
          <td style="padding:7px 14px;border:1px solid #000;text-align:center;${isAbMarks(r.yourMarks) ? 'color:#dc2626;font-weight:bold;' : ''}">${escapeHtml(r.yourMarks)}</td>
          <td style="padding:7px 14px;border:1px solid #000;text-align:center;">${r.outOf}</td>
          <td style="padding:7px 14px;border:1px solid #000;text-align:center;">${r.highest}</td>
          <td style="padding:7px 14px;border:1px solid #000;text-align:center;">${r.average}</td>
        </tr>`
    )
    .join('');

  return `<table style="border-collapse:collapse;margin:14px 0;width:100%;max-width:640px;">
    <thead>
      <tr style="font-weight:bold;">
        <th style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">Subject</th>
        <th style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">Your Marks</th>
        <th style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">Out of</th>
        <th style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">Highest</th>
        <th style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">Average</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr style="font-weight:bold;">
        <td style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">Total</td>
        <td style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;${isAbMarks(tot.yourMarks) ? 'color:#dc2626;' : ''}">${escapeHtml(tot.yourMarks)}</td>
        <td style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">${tot.outOf}</td>
        <td style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">${tot.highest}</td>
        <td style="padding:8px 14px;border:1px solid #000;text-align:center;font-weight:bold;">${tot.average}</td>
      </tr>
    </tbody>
  </table>`;
};

const buildAbsentMessageHtml = ({ studentName, classNo, batchName, examName }) =>
  `<p style="margin-top:12px;">We like to inform you that <b>${escapeHtml(studentName)}</b> (Class ${escapeHtml(classNo || '-')}, Batch ${escapeHtml(batchName || '-')}) was marked absent for <b>${escapeHtml(examName)}</b>.<br/>Please reach out to the center if you believe this is incorrect.</p>`;

// Fixed content — no user-authored template allowed for exam-result mail by design.
const EXAM_RESULT_SUBJECT = '{{examName}} - Academic Performance Report';
const EXAM_RESULT_BODY = `<p>Dear Parents,</p>
<p>Please find the performance report of the <b>{{examName}}</b> attached below.</p>
{{studentDetails}}
{{resultGrid}}
{{absentMessage}}
{{noteBlock}}
<p style="margin-top:16px;">Regards,<br/><b>Team Z7i</b><br/>Coimbatore</p>`;

const EXAM_ABSENT_SUBJECT = '{{examName}} - Absence Notice';
const EXAM_ABSENT_BODY = `<p>Dear Parents,</p>
<p>Please find the performance report of the <b>{{examName}}</b> below.</p>
{{studentDetails}}
{{resultGrid}}
{{absentMessage}}
{{noteBlock}}
<p style="margin-top:16px;">Regards,<br/><b>Team Z7i</b><br/>Coimbatore</p>`;

const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ADMISSION_ACK_SUBJECT = 'Admission Acknowledgement - {{studentName}}';
const ADMISSION_ACK_BODY = `<p>Dear Parent,</p>
<p>Warm greetings from Z7i !</p>
<p>We are pleased to formally acknowledge and confirm the admission of <b>{{studentName}}</b> to Z7i for the <b>{{programName}}</b> Program.</p>
<p>We are delighted to welcome <b>{{studentName}}</b> to the Z7i learning community and look forward to a rewarding educational partnership.</p>
<p>At Z7i, we remain committed to fostering academic excellence, nurturing individual potential, and providing an enriching and impactful learning experience.</p>
<p>Should you require any further information or assistance, please do not hesitate to contact us at 9626292233 / 9159391122.</p>
<p>We look forward to a meaningful and rewarding association with your family.</p>
<p>We sincerely appreciate your decision to entrust Z7i with your ward's educational journey.</p>
<p>Warm regards,<br/>Admissions Team<br/>Z7i</p>`;

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

const resolveRosterFromResults = async (tenantId, examId, candidates = []) => {
  const results = await MockExamResult.find(
    { tenantId, examId, isdeleted: false },
    { admissionNo: 1, batchId: 1 }
  ).lean();
  if (!results.length) return [];

  if (!candidates.length) {
    return [...new Set(results.map((r) => safeTrim(r.admissionNo)).filter(Boolean))];
  }

  const candidateSet = new Set(candidates.map(safeTrim).filter(Boolean));
  const missingBatchAdmNos = [
    ...new Set(results.filter((r) => !safeTrim(r.batchId)).map((r) => safeTrim(r.admissionNo)).filter(Boolean))
  ];
  const profileBatchMap = new Map();
  if (missingBatchAdmNos.length) {
    const profiles = await StudentProfile.find(
      { tenantId, admissionNo: { $in: missingBatchAdmNos }, isdeleted: false },
      { admissionNo: 1, batchId: 1 }
    ).lean();
    for (const p of profiles) {
      profileBatchMap.set(safeTrim(p.admissionNo), safeTrim(p.batchId));
    }
  }

  const admSet = new Set();
  for (const r of results) {
    const adm = safeTrim(r.admissionNo);
    if (!adm) continue;
    const bId = safeTrim(r.batchId) || profileBatchMap.get(adm) || '';
    if (bId && candidateSet.has(bId)) {
      admSet.add(adm);
    }
  }
  return [...admSet];
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
    const admissionNosInput = Array.isArray(req.body?.admissionNos)
      ? [...new Set(req.body.admissionNos.map(safeTrim).filter(Boolean))]
      : [];
    const batchIdInput = safeTrim(req.body?.batchId) || null;
    const batchIdsInput = Array.isArray(req.body?.batchIds)
      ? [...new Set(req.body.batchIds.map(safeTrim).filter(Boolean))]
      : [];
    const targetBatchInputs = batchIdsInput.length ? batchIdsInput : batchIdInput ? [batchIdInput] : [];
    const notifyAbsentees = req.body?.notifyAbsentees === true;
    const note = safeTrim(req.body?.note);

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
    } else if (admissionNosInput.length) {
      const matchingProfiles = await StudentProfile.find(
        { tenantId, admissionNo: { $in: admissionNosInput }, isdeleted: false },
        { admissionNo: 1 }
      ).lean();
      rosterAdmissionNos = matchingProfiles.map((p) => safeTrim(p.admissionNo)).filter(Boolean);
      if (!rosterAdmissionNos.length) {
        return res.status(404).json({ status: false, message: 'No matching students found' });
      }
    } else {
      const assignQuery = { tenantId, examId, isdeleted: false, status: 'enabled' };
      let candidates = [];
      if (targetBatchInputs.length) {
        // MockExamBatchAssign.batchId has been observed holding a batchCode instead of the real
        // batchId on some records — resolve the input to both forms before matching.
        const batchDocs = await Batch.find(
          { tenantId, $or: [{ batchId: { $in: targetBatchInputs } }, { batchCode: { $in: targetBatchInputs } }] },
          { batchId: 1, batchCode: 1 }
        ).lean();
        candidates = [
          ...new Set([...targetBatchInputs, ...batchDocs.map((b) => b.batchId), ...batchDocs.map((b) => b.batchCode)].filter(Boolean))
        ];
        assignQuery.batchId = { $in: candidates };
      }
      const assignments = await MockExamBatchAssign.find(assignQuery, { batchId: 1, students: 1 }).lean();
      if (assignments.length) {
        const seen = new Set();
        for (const a of assignments) {
          for (const s of a.students || []) {
            const admNo = safeTrim(s.admissionNo);
            if (admNo) seen.add(admNo);
          }
        }
        rosterAdmissionNos = [...seen];
      } else {
        // Fallback for imported exams (which have MockExamResult rows without MockExamBatchAssign)
        rosterAdmissionNos = await resolveRosterFromResults(tenantId, examId, candidates);
        if (targetBatchInputs.length && !rosterAdmissionNos.length) {
          return res.status(404).json({ status: false, message: 'No assignment found for this exam and selected batch(es)' });
        }
      }
      if (!rosterAdmissionNos.length) {
        return res.status(200).json({ status: true, message: 'No students assigned', data: { totalTargeted: 0, queuedMarksCount: 0, queuedAbsentCount: 0, skippedNoResultCount: 0, skippedNoEmailCount: 0 } });
      }
    }

    const [results, profiles, examStats] = await Promise.all([
      MockExamResult.find({ tenantId, examId, admissionNo: { $in: rosterAdmissionNos }, isdeleted: false }, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, isAbsent: 1, sectionResults: 1 }).lean(),
      StudentProfile.find(
        { tenantId, admissionNo: { $in: rosterAdmissionNos }, isdeleted: false },
        { admissionNo: 1, registrationNumber: 1, portalStudentId: 1, studentId: 1, 'student.name': 1, 'student.email': 1, 'student.email1': 1, 'student.email2': 1, 'student.parentName': 1, classNo: 1, batchId: 1, centerId: 1, centerCode: 1, programId: 1, programName: 1 }
      ).lean(),
      computeExamStats(tenantId, examId)
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
      recipientFilters: {
        examId,
        admissionNo: admissionNo || null,
        admissionNos: admissionNosInput.length ? admissionNosInput : null,
        batchId: batchIdInput || null,
        batchIds: targetBatchInputs.length ? targetBatchInputs : null,
        notifyAbsentees,
        note: note || null
      },
      sendType,
      scheduledAt: sendType === 'SCHEDULED' ? scheduledAt : null,
      status: sendType === 'SCHEDULED' ? 'SCHEDULED' : 'QUEUED',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });

    const buildLogBase = (admNo, profile, subject, body, hasValidEmail, email, reportPayload = null) => ({
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
      reportPayload,
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
      const validEmails = collectStudentEmails(profile);
      const hasValidEmail = validEmails.length > 0;
      const email = validEmails.join(', ');
      if (hasValidEmail) queuedMarksCount++;
      else skippedNoEmailCount++;
      const batch = profile.batchId ? batchMap.get(profile.batchId) : null;
      const reportPayload = buildStudentPerformanceReportData(profile, result, exam, batch, examStats);
      const data = {
        studentName: reportPayload.studentName,
        regNo: reportPayload.regNo,
        examName: reportPayload.examName,
        studentDetails: buildStudentDetailsHtml(reportPayload),
        resultGrid: buildResultGridHtml(reportPayload),
        absentMessage: '',
        noteBlock: buildNoteBlockHtml(note)
      };
      const subject = renderTemplate(EXAM_RESULT_SUBJECT, data);
      const body = renderTemplate(EXAM_RESULT_BODY, data);
      logDocs.push(buildLogBase(admNo, profile, subject, body, hasValidEmail, email, reportPayload));
    }

    if (notifyAbsentees) {
      for (const admNo of absentList) {
        const profile = profileMap.get(admNo) || {};
        const validEmails = collectStudentEmails(profile);
        const hasValidEmail = validEmails.length > 0;
        const email = validEmails.join(', ');
        if (hasValidEmail) queuedAbsentCount++;
        else skippedNoEmailCount++;
        const batch = profile.batchId ? batchMap.get(profile.batchId) : null;
        const absentReport = buildAbsentStudentPerformanceReportData(profile, exam, batch, examStats);
        const data = {
          studentName: absentReport.studentName,
          examName: absentReport.examName,
          studentDetails: buildStudentDetailsHtml(absentReport),
          resultGrid: buildResultGridHtml(absentReport),
          absentMessage: buildAbsentMessageHtml({
            studentName: absentReport.studentName,
            classNo: profile?.classNo ?? '',
            batchName: absentReport.batchName,
            examName: absentReport.examName
          }),
          noteBlock: buildNoteBlockHtml(note)
        };
        const subject = renderTemplate(EXAM_ABSENT_SUBJECT, data);
        const body = renderTemplate(EXAM_ABSENT_BODY, data);
        logDocs.push(buildLogBase(admNo, profile, subject, body, hasValidEmail, email, null));
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

// Standalone admission-acknowledgement email — fixed content, no campaign/log tracking, no DB
// lookups at all. Frontend supplies everything (studentName, programName, recipient email(s));
// this just fills the fixed template and sends, one send per recipient.
const sendAdmissionAcknowledgement = async (req, res, next) => {
  try {
    const rawEmails = Array.isArray(req.body?.emails) ? req.body.emails : safeTrim(req.body?.email) ? [req.body.email] : [];
    const emails = [...new Set(rawEmails.map((e) => safeTrim(e).toLowerCase()).filter(Boolean))];
    const validEmails = emails.filter(isValidEmailAddress);
    if (!validEmails.length) return res.status(400).json({ status: false, message: 'At least one valid email (emails[] or email) is required' });

    const studentName = safeTrim(req.body?.studentName);
    const programName = safeTrim(req.body?.programName);
    if (!studentName) return res.status(400).json({ status: false, message: 'studentName is required' });
    if (!programName) return res.status(400).json({ status: false, message: 'programName is required' });

    const data = { studentName: escapeHtml(studentName), programName: escapeHtml(programName) };
    const subject = renderTemplate(ADMISSION_ACK_SUBJECT, data);
    const body = renderTemplate(ADMISSION_ACK_BODY, data);

    const results = [];
    for (const to of validEmails) {
      try {
        const resp = await sendEmail({ to, subject, html: body, text: '' });
        results.push({ email: to, status: 'SENT', provider: resp?.provider || null });
      } catch (err) {
        results.push({ email: to, status: 'FAILED', error: err?.message || 'Mail send failed' });
      }
    }
    const sentCount = results.filter((r) => r.status === 'SENT').length;
    const failedCount = results.length - sentCount;

    return res.status(200).json({
      status: true,
      message: 'Admission acknowledgement email processed',
      data: { sentCount, failedCount, results }
    });
  } catch (err) {
    return next(err);
  }
};

const resolveSingleSamplePerformanceReport = async ({ tenantId, examId, admissionNo, batchId, batchIds = [] }) => {
  const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { examName: 1, examCode: 1, totalMarks: 1, sections: 1, status: 1 }).lean();
  if (!exam) return { error: { status: 404, message: 'Exam not found' } };

  let targetAdmNo = safeTrim(admissionNo);
  if (!targetAdmNo) {
    const assignQuery = { tenantId, examId, isdeleted: false, status: 'enabled' };
    const targetBatches = Array.isArray(batchIds) && batchIds.length ? batchIds.map(safeTrim).filter(Boolean) : batchId ? [safeTrim(batchId)] : [];
    if (targetBatches.length) {
      const batchDocs = await Batch.find(
        { tenantId, $or: [{ batchId: { $in: targetBatches } }, { batchCode: { $in: targetBatches } }] },
        { batchId: 1, batchCode: 1 }
      ).lean();
      const candidates = [
        ...new Set([...targetBatches, ...batchDocs.map((b) => b.batchId), ...batchDocs.map((b) => b.batchCode)].filter(Boolean))
      ];
      assignQuery.batchId = { $in: candidates };
    }
    const assignments = await MockExamBatchAssign.find(assignQuery, { students: 1 }).lean();
    let roster = [];
    for (const a of assignments) {
      for (const s of a.students || []) {
        const adm = safeTrim(s.admissionNo);
        if (adm) roster.push(adm);
      }
    }
    if (!roster.length) {
      roster = await resolveRosterFromResults(tenantId, examId, Array.isArray(assignQuery.batchId?.$in) ? assignQuery.batchId.$in : []);
    }
    const firstResult = roster.length
      ? await MockExamResult.findOne({ tenantId, examId, admissionNo: { $in: roster }, isdeleted: false }, { admissionNo: 1 }).lean()
      : await MockExamResult.findOne({ tenantId, examId, isdeleted: false }, { admissionNo: 1 }).lean();
    targetAdmNo = safeTrim(firstResult?.admissionNo || roster[0]);
  }

  if (!targetAdmNo) return { error: { status: 404, message: 'No student result found for preview' } };

  const [profile, result, examStats] = await Promise.all([
    StudentProfile.findOne(
      { tenantId, admissionNo: targetAdmNo, isdeleted: false },
      { admissionNo: 1, registrationNumber: 1, portalStudentId: 1, classNo: 1, 'student.name': 1, 'student.email': 1, 'student.email1': 1, 'student.email2': 1, batchId: 1, programName: 1 }
    ).lean(),
    MockExamResult.findOne({ tenantId, examId, admissionNo: targetAdmNo, isdeleted: false }, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, isAbsent: 1, sectionResults: 1 }).lean(),
    computeExamStats(tenantId, examId)
  ]);

  if (!profile) return { error: { status: 404, message: 'Student not found' } };
  const batch = profile.batchId
    ? await Batch.findOne({ tenantId, $or: [{ batchId: profile.batchId }, { batchCode: profile.batchId }] }, { batchId: 1, batchCode: 1, batchName: 1 }).lean()
    : null;

  const reportData = result
    ? buildStudentPerformanceReportData(profile, result, exam, batch, examStats)
    : buildAbsentStudentPerformanceReportData(profile, exam, batch, examStats);
  return { reportData, recipientEmail: collectStudentEmails(profile).join(', ') };
};

const previewExamResultEmail = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const examId = safeTrim(req.body?.examId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const batchId = safeTrim(req.body?.batchId);
    const batchIds = Array.isArray(req.body?.batchIds) ? req.body.batchIds.map(safeTrim).filter(Boolean) : [];
    const note = safeTrim(req.body?.note);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const resolved = await resolveSingleSamplePerformanceReport({ tenantId, examId, admissionNo, batchId, batchIds });
    if (resolved.error) return res.status(resolved.error.status).json({ status: false, message: resolved.error.message });

    const { reportData, recipientEmail } = resolved;
    const data = {
      studentName: reportData.studentName,
      regNo: reportData.regNo,
      examName: reportData.examName,
      studentDetails: buildStudentDetailsHtml(reportData),
      resultGrid: buildResultGridHtml(reportData),
      absentMessage: reportData.isAbsent
        ? buildAbsentMessageHtml({
            studentName: reportData.studentName,
            classNo: reportData.classNo,
            batchName: reportData.batchName,
            examName: reportData.examName
          })
        : '',
      noteBlock: buildNoteBlockHtml(note)
    };
    const isAbsent = !!reportData.isAbsent;
    return res.status(200).json({
      status: true,
      data: {
        recipientEmail,
        subject: renderTemplate(isAbsent ? EXAM_ABSENT_SUBJECT : EXAM_RESULT_SUBJECT, data),
        body: renderTemplate(isAbsent ? EXAM_ABSENT_BODY : EXAM_RESULT_BODY, data),
        reportData
      }
    });
  } catch (err) {
    return next(err);
  }
};

const downloadPerformanceReportPdf = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const examId = safeTrim(req.body?.examId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const batchId = safeTrim(req.body?.batchId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const resolved = await resolveSingleSamplePerformanceReport({ tenantId, examId, admissionNo, batchId });
    if (resolved.error) return res.status(resolved.error.status).json({ status: false, message: resolved.error.message });

    const { reportData } = resolved;
    const pdfBuffer = await generatePerformanceReportPdfBuffer(reportData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportData.filename}"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return next(err);
  }
};

const listExamResultBatchStudents = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const examId = safeTrim(req.body?.examId);
    const batchIdInput = safeTrim(req.body?.batchId);
    const batchIdsInput = Array.isArray(req.body?.batchIds)
      ? [...new Set(req.body.batchIds.map(safeTrim).filter(Boolean))]
      : [];
    const targetBatches = batchIdsInput.length ? batchIdsInput : batchIdInput ? [batchIdInput] : [];
    if (!tenantId || !examId || !targetBatches.length) {
      return res.status(400).json({ status: false, message: 'tenantId, examId and batchIds (or batchId) are required' });
    }

    const batchDocs = await Batch.find(
      { tenantId, $or: [{ batchId: { $in: targetBatches } }, { batchCode: { $in: targetBatches } }] },
      { batchId: 1, batchCode: 1, batchName: 1 }
    ).lean();
    const candidates = [
      ...new Set([...targetBatches, ...batchDocs.map((b) => b.batchId), ...batchDocs.map((b) => b.batchCode)].filter(Boolean))
    ];
    const batchNameMap = new Map();
    for (const b of batchDocs) {
      batchNameMap.set(b.batchId, b.batchName || b.batchCode);
      batchNameMap.set(b.batchCode, b.batchName || b.batchCode);
    }

    const assignments = await MockExamBatchAssign.find(
      { tenantId, examId, batchId: { $in: candidates }, isdeleted: false, status: 'enabled' },
      { students: 1 }
    ).lean();

    const admSet = new Set();
    for (const a of assignments) {
      for (const s of a.students || []) {
        const adm = safeTrim(s.admissionNo);
        if (adm) admSet.add(adm);
      }
    }
    const roster = admSet.size ? [...admSet] : await resolveRosterFromResults(tenantId, examId, candidates);
    if (!roster.length) {
      return res.status(200).json({ status: true, data: [] });
    }

    const [profiles, results] = await Promise.all([
      StudentProfile.find(
        { tenantId, admissionNo: { $in: roster }, isdeleted: false },
        { admissionNo: 1, batchId: 1, 'student.name': 1, 'student.email': 1, 'student.email1': 1, 'student.email2': 1 }
      )
        .sort({ 'student.name': 1 })
        .lean(),
      MockExamResult.find({ tenantId, examId, admissionNo: { $in: roster }, isdeleted: false }, { admissionNo: 1 }).lean()
    ]);

    const resultAdmSet = new Set(results.map((r) => safeTrim(r.admissionNo)));
    const data = profiles.map((p) => {
      const emails = collectStudentEmails(p);
      return {
        admissionNo: safeTrim(p.admissionNo),
        name: safeTrim(p.student?.name) || safeTrim(p.admissionNo),
        email: emails.join(', ') || null,
        batchId: safeTrim(p.batchId) || null,
        batchName: batchNameMap.get(safeTrim(p.batchId)) || null,
        hasResult: resultAdmSet.has(safeTrim(p.admissionNo))
      };
    });

    return res.status(200).json({ status: true, data });
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
  sendExamResultEmail,
  previewExamResultEmail,
  downloadPerformanceReportPdf,
  listExamResultBatchStudents,
  sendAdmissionAcknowledgement
};

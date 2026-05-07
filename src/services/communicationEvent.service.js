import CommunicationEventConfig from '../models/communicationeventconfig.model.js';
import CommunicationTemplate from '../models/communicationtemplate.model.js';
import CommunicationCampaign from '../models/communicationcampaign.model.js';
import CommunicationRecipientLog from '../models/communicationrecipientlog.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import { buildTemplateDataFromStudent, renderTemplate } from './templateRenderer.service.js';
import { processCommunicationCampaign } from './communicationProcessor.service.js';

const safeTrim = (v) => (v === null || v === undefined ? '' : String(v).trim());

const isValidEmail = (email) => /.+@.+\..+/.test(String(email || '').trim());

const buildStudentData = (s = {}) => ({
  studentId: safeTrim(s.studentId),
  admissionNo: safeTrim(s.admissionNo),
  studentName: safeTrim(s?.student?.name),
  studentPhone: safeTrim(s?.student?.phone),
  parentName: safeTrim(s?.student?.parentName),
  recipientEmail: safeTrim(s?.student?.email).toLowerCase(),
  classNo: s.classNo ?? null,
  batchId: safeTrim(s.batchId),
  batchCode: safeTrim(s.batchCode),
  centerId: safeTrim(s.centerId),
  centerCode: safeTrim(s.centerCode),
  centerName: safeTrim(s.centerName),
  programId: safeTrim(s.programId),
  programCode: safeTrim(s.programCode),
  programName: safeTrim(s.programName),
  academicYear: safeTrim(s.academicYear),
  currentAcademicYear: safeTrim(s.currentAcademicYear)
});

export const triggerCommunicationEvent = async ({ tenantId, eventCode, admissionNo, studentId, sourceModule = 'GENERAL', sourceRefId = null, userId = null, extraData = {} }) => {
  tenantId = safeTrim(tenantId);
  eventCode = safeTrim(eventCode).toUpperCase();

  if (!tenantId || !eventCode) return { skipped: true, reason: 'tenantId/eventCode missing' };

  const config = await CommunicationEventConfig.findOne({
    tenantId,
    eventCode,
    channel: 'email',
    enabled: true,
    isdeleted: false
  }).lean();

  if (!config) return { skipped: true, reason: 'event config not found/disabled' };

  const template = await CommunicationTemplate.findOne({
    tenantId,
    templateId: config.templateId,
    channel: 'email',
    status: 'ACTIVE',
    isdeleted: false
  }).lean();

  if (!template) return { skipped: true, reason: 'active template not found' };

  const studentQuery = {
    tenantId,
    isdeleted: false,
    status: 'ACTIVE'
  };

  if (safeTrim(studentId)) studentQuery.studentId = safeTrim(studentId);
  else if (safeTrim(admissionNo)) studentQuery.admissionNo = safeTrim(admissionNo);
  else return { skipped: true, reason: 'studentId/admissionNo missing' };

  const profile = await StudentProfile.findOne(studentQuery, {
    _id: 0,
    studentId: 1,
    admissionNo: 1,
    academicYear: 1,
    currentAcademicYear: 1,
    classNo: 1,
    batchId: 1,
    batchCode: 1,
    centerId: 1,
    centerCode: 1,
    centerName: 1,
    programId: 1,
    programCode: 1,
    programName: 1,
    'student.name': 1,
    'student.email': 1,
    'student.phone': 1,
    'student.parentName': 1
  }).lean();
  if (!profile) return { skipped: true, reason: 'student profile not found' };
  const student = buildStudentData(profile);
  const validEmail = isValidEmail(student.recipientEmail);
  const templateData = {
    ...buildTemplateDataFromStudent(student),
    ...extraData
  };
  const subject = renderTemplate(template.subject || '', templateData);
  const body = renderTemplate(template.body || '', templateData);
  const campaign = await CommunicationCampaign.create({
    tenantId,
    title: `${config.eventName} - ${student.studentName || student.admissionNo}`,
    templateId: template.templateId,
    templateName: template.name,
    category: template.category || 'GENERAL',
    channel: 'email',
    subject,
    body,
    recipientFilters: {
      eventCode,
      sourceModule,
      sourceRefId,
      admissionNo: student.admissionNo,
      studentId: student.studentId
    },
    sendType: 'NOW',
    scheduledAt: null,
    totalRecipients: 1,
    validEmailCount: validEmail ? 1 : 0,
    missingEmailCount: validEmail ? 0 : 1,
    queuedCount: validEmail ? 1 : 0,
    skippedCount: validEmail ? 0 : 1,
    status: validEmail ? 'QUEUED' : 'FAILED',
    isdeleted: false,
    createdBy: userId || null,
    updatedBy: userId || null
  });
  await CommunicationRecipientLog.create({
    tenantId,
    campaignId: campaign.campaignId,
    templateId: template.templateId,
    templateName: template.name,
    channel: 'email',
    studentId: student.studentId || null,
    admissionNo: student.admissionNo || null,
    studentName: student.studentName || null,
    parentName: student.parentName || null,
    recipientEmail: student.recipientEmail || null,
    classNo: student.classNo,
    batchId: student.batchId || null,
    batchCode: student.batchCode || null,
    centerId: student.centerId || null,
    centerCode: student.centerCode || null,
    programId: student.programId || null,
    programName: student.programName || null,
    subject,
    body,
    status: validEmail ? 'QUEUED' : 'SKIPPED',
    error: validEmail ? null : 'Student email missing/invalid',
    createdBy: userId || null,
    updatedBy: userId || null
  });
  if (validEmail) {
    setImmediate(() => {
      processCommunicationCampaign({ tenantId, campaignId: campaign.campaignId }).catch((e) => console.error('[event communication failed]', e?.message || e));
    });
  }
  return {
    skipped: false,
    campaignId: campaign.campaignId,
    eventCode
  };
};

export const triggerCommunicationEventSafe = async (args) => {
  try {
    return await triggerCommunicationEvent(args);
  } catch (err) {
    console.error('[triggerCommunicationEventSafe]', err?.message || err);
    return { skipped: true, reason: err?.message || 'event trigger failed' };
  }
};

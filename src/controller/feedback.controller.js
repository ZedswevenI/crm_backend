import FeedbackTemplate from '../models/feedbackTemplate.model.js';
import FeedbackForm from '../models/feedbackForm.model.js';
import FeedbackResponse from '../models/feedbackResponse.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import Staff from '../models/staff.model.js';
import Batch from '../models/batch.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const pickTenantId = (req) => (req.body?.entiId || req.body?.tenantId || '').toString().trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();

const autoUpdateStatuses = async (tenantId) => {
  const now = Date.now();
  await Promise.all([FeedbackForm.updateMany({ tenantId, isdeleted: false, status: 'DRAFT', startDate: { $lte: now } }, { $set: { status: 'ACTIVE' } }), FeedbackForm.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', endDate: { $lt: now } }, { $set: { status: 'CLOSED' } })]);
};

const VALID_TYPES = ['text', 'radio', 'checkbox', 'score'];

const normalizeQuestions = (raw) => {
  if (!Array.isArray(raw) || !raw.length) return { valid: false, message: 'At least one question is required' };
  const questions = [];
  for (let i = 0; i < raw.length; i++) {
    const q = raw[i] || {};
    const fieldType = safeTrim(q.fieldType).toLowerCase();
    if (!VALID_TYPES.includes(fieldType)) return { valid: false, message: `Q${i + 1}: invalid fieldType "${q.fieldType}"` };
    const fieldText = safeTrim(q.fieldText);
    if (!fieldText) return { valid: false, message: `Q${i + 1}: fieldText is required` };
    const fieldOptions = Array.isArray(q.fieldOptions)
      ? q.fieldOptions
          .map((o) => ({
            label: safeTrim(typeof o === 'object' ? o.label || '' : String(o)),
            score: Number(typeof o === 'object' ? o.score : 0) || 0
          }))
          .filter((o) => o.label)
      : [];
    if ((fieldType === 'radio' || fieldType === 'checkbox') && fieldOptions.length < 2) return { valid: false, message: `Q${i + 1}: "${fieldType}" needs at least 2 options` };
    const maxScore = fieldType === 'score' ? Number(q.maxScore) || 10 : 10;
    questions.push({
      fieldId: q.fieldId ? safeTrim(q.fieldId) : `q_${i + 1}`,
      fieldType,
      fieldText,
      fieldOptions: fieldType === 'text' || fieldType === 'score' ? [] : fieldOptions,
      part: safeTrim(q.part) || 'A',
      weightage: Number(q.weightage) || 1,
      maxScore,
      sortOrder: Number(q.sortOrder) || i + 1,
      isSubjectBased: !!q.isSubjectBased
    });
  }
  return { valid: true, questions };
};

const getFeedbackTargetStudents = async ({ tenantId, batchCodes }) => {
  const batches = Array.isArray(batchCodes) ? batchCodes.map((x) => safeTrim(x)).filter(Boolean) : [];
  if (!batches.length) return [];
  return await StudentProfile.find(
    {
      tenantId,
      batchCode: { $in: batches },
      status: 'ACTIVE',
      isdeleted: false
    },
    {
      studentId: 1,
      admissionNo: 1,
      batchCode: 1
    }
  ).lean();
};

const createTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const { title, description, category } = req.body;
    if (!title || !category) return res.status(400).json({ status: false, message: 'title and category are required' });
    const validCategories = ['STAFF', 'BATCH', 'FACILITY', 'COURSE'];
    if (!validCategories.includes(category.toUpperCase())) return res.status(400).json({ status: false, message: `Invalid category. Use: ${validCategories.join(', ')}` });
    const qResult = normalizeQuestions(req.body.questions);
    if (!qResult.valid) return res.status(400).json({ status: false, message: qResult.message });
    const template = await FeedbackTemplate.create({ tenantId, title: safeTrim(title), description: description ? safeTrim(description) : null, category: category.toUpperCase(), questions: qResult.questions, status: 'ACTIVE', isdeleted: false, createdBy: userId });
    return res.status(201).json({ status: true, message: 'Feedback template created successfully', data: template });
  } catch (err) {
    return next(err);
  }
};

const listTemplates = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const page = parseInt(req.query?.page || req.body?.page, 10) || 1;
    const limit = parseInt(req.query?.limit || req.body?.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const status = safeTrim(req.query?.status || req.body?.status || '');
    const category = safeTrim(req.query?.category || req.body?.category || '');
    const listType = req.query?.list || '';
    const query = { tenantId, isdeleted: false };
    if (status) query.status = status.toUpperCase();
    if (category) query.category = category.toUpperCase();
    if (listType === 'full') {
      const data = await FeedbackTemplate.find(query).sort('title').lean();
      return res.status(200).json({ status: true, data, count: data.length });
    }
    const [data, count] = await Promise.all([FeedbackTemplate.find(query).sort('-createdAt').skip(skip).limit(limit).lean(), FeedbackTemplate.countDocuments(query)]);
    return res.status(200).json({ status: true, data, page, limit, count, pages: Math.ceil(count / limit) || 0 });
  } catch (err) {
    return next(err);
  }
};

const listActiveTemplates = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const category = safeTrim(req.query?.category || req.body?.category || '');
    const query = { tenantId, status: 'ACTIVE', isdeleted: false };
    if (category) query.category = category.toUpperCase();
    const data = await FeedbackTemplate.find(query).select('title description category questions').sort('title').lean();
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return next(err);
  }
};

const viewTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const templateId = safeTrim(req.body?.templateId || req.query?.templateId);
    if (!tenantId || !templateId) return res.status(400).json({ status: false, message: 'tenantId and templateId are required' });
    const template = await FeedbackTemplate.findOne({ _id: templateId, tenantId, isdeleted: false }).lean();
    if (!template) return res.status(404).json({ status: false, message: 'Template not found' });
    return res.status(200).json({ status: true, data: template });
  } catch (err) {
    return next(err);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const templateId = safeTrim(req.body?.templateId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !templateId) return res.status(400).json({ status: false, message: 'tenantId and templateId are required' });
    const template = await FeedbackTemplate.findOne({ _id: templateId, tenantId, isdeleted: false });
    if (!template) return res.status(404).json({ status: false, message: 'Template not found' });
    const updateDoc = { updatedBy: userId };
    if (req.body.title) updateDoc.title = safeTrim(req.body.title);
    if (req.body.description !== undefined) updateDoc.description = req.body.description ? safeTrim(req.body.description) : null;
    if (req.body.category) updateDoc.category = req.body.category.toUpperCase();
    if (req.body.questions) {
      const qResult = normalizeQuestions(req.body.questions);
      if (!qResult.valid) return res.status(400).json({ status: false, message: qResult.message });
      updateDoc.questions = qResult.questions;
    }
    const updated = await FeedbackTemplate.findOneAndUpdate({ _id: templateId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true }).lean();
    return res.status(200).json({ status: true, message: 'Template updated', data: updated });
  } catch (err) {
    return next(err);
  }
};

const toggleTemplateStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const templateId = safeTrim(req.body?.templateId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !templateId) return res.status(400).json({ status: false, message: 'tenantId and templateId are required' });
    const template = await FeedbackTemplate.findOne({ _id: templateId, tenantId, isdeleted: false });
    if (!template) return res.status(404).json({ status: false, message: 'Template not found' });
    const newStatus = template.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await FeedbackTemplate.findOneAndUpdate({ _id: templateId, tenantId, isdeleted: false }, { $set: { status: newStatus, updatedBy: userId } }, { new: true }).lean();
    return res.status(200).json({ status: true, message: `Template ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`, data: updated });
  } catch (err) {
    return next(err);
  }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const templateId = safeTrim(req.body?.templateId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !templateId) return res.status(400).json({ status: false, message: 'tenantId and templateId are required' });
    const activeFormsCount = await FeedbackForm.countDocuments({ tenantId, templateId, status: { $in: ['DRAFT', 'ACTIVE'] }, isdeleted: false });
    if (activeFormsCount > 0) return res.status(400).json({ status: false, message: `Cannot delete — ${activeFormsCount} active form(s) use this template.` });
    await FeedbackTemplate.findOneAndUpdate({ _id: templateId, tenantId, isdeleted: false }, { $set: { isdeleted: true, status: 'INACTIVE', updatedBy: userId } });
    return res.status(200).json({ status: true, message: 'Template deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

const createFeedbackForm = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const { title, description, templateId, assignedBatches, startDate, endDate } = req.body;
    const phase = req.body?.phase ? Number(req.body.phase) : null;
    const staffAssignments = Array.isArray(req.body?.staffAssignments) ? req.body.staffAssignments : [];
    if (!title || !templateId || !startDate || !endDate) return res.status(400).json({ status: false, message: 'title, templateId, startDate and endDate are required' });
    if (Number(endDate) <= Number(startDate)) return res.status(400).json({ status: false, message: 'endDate must be after startDate' });
    const batches = Array.isArray(assignedBatches) ? assignedBatches.map((b) => safeTrim(String(b))).filter(Boolean) : [];
    if (!batches.length) return res.status(400).json({ status: false, message: 'At least one batch must be assigned' });
    const template = await FeedbackTemplate.findOne({ _id: templateId, tenantId, status: 'ACTIVE', isdeleted: false }).lean();
    if (!template) return res.status(404).json({ status: false, message: 'Template not found or not ACTIVE' });
    if (template.category === 'STAFF' && !staffAssignments.length) return res.status(400).json({ status: false, message: 'At least one staff assignment is required for STAFF category' });
    const totalAssignedStudents = await StudentProfile.countDocuments({ tenantId, batchCode: { $in: batches }, status: 'ACTIVE', isdeleted: false });
    const batchDocs = await Batch.find({ tenantId, batchCode: { $in: batches }, isdeleted: false }, { batchCode: 1, batchName: 1 }).lean();
    const batchMap = new Map(batchDocs.map((b) => [b.batchCode, b.batchName]));
    const batchQuestions = batches.map((batchCode) => ({
      batchCode,
      batchName: batchMap.get(batchCode) || batchCode,
      questions: template.questions.map((q) => ({ ...q }))
    }));
    const now = Date.now();
    const initialStatus = now >= Number(startDate) ? 'ACTIVE' : 'DRAFT';
    const form = await FeedbackForm.create({
      tenantId,
      title: safeTrim(title),
      description: description ? safeTrim(description) : null,
      templateId: template._id,
      templateTitle: template.title,
      category: template.category,
      phase,
      staffAssignments: staffAssignments.map((s) => ({
        staffId: safeTrim(s.staffId),
        staffCode: safeTrim(s.staffCode) || null,
        staffName: safeTrim(s.staffName) || null,
        subjectId: safeTrim(s.subjectId) || null,
        subjectName: safeTrim(s.subjectName) || null,
        subjectCode: safeTrim(s.subjectCode) || null
      })),
      staffIds: staffAssignments.map((s) => safeTrim(s.staffId)).filter(Boolean),
      staffNames: staffAssignments.map((s) => safeTrim(s.staffName)).filter(Boolean),
      questions: template.questions,
      assignedBatches: batches,
      batchQuestions,
      startDate: Number(startDate),
      endDate: Number(endDate),
      totalAssignedStudents,
      status: initialStatus,
      isdeleted: false,
      createdBy: userId
    });
    // email trigger
    // if (safeTrim(form.status).toUpperCase() === 'ACTIVE') {
    //   const students = await getFeedbackTargetStudents({
    //     tenantId,
    //     batchCodes: form.assignedBatches
    //   });
    //   for (const st of students || []) {
    //     triggerCommunicationEventSafe({
    //       tenantId,
    //       eventCode: 'FEEDBACK_FORM_ASSIGNED',
    //       admissionNo: safeTrim(st?.admissionNo),
    //       studentId: safeTrim(st?.studentId),
    //       sourceModule: 'FEEDBACK',
    //       sourceRefId: String(form._id),
    //       userId,
    //       extraData: {
    //         formId: String(form._id),
    //         feedbackTitle: form.title,
    //         feedbackCategory: form.category,
    //         templateTitle: form.templateTitle,
    //         batchCode: safeTrim(st?.batchCode),
    //         startDate: form.startDate,
    //         endDate: form.endDate,
    //         phase: form.phase || ''
    //       }
    //     });
    //   }
    // }
    return res.status(201).json({ status: true, message: 'Feedback form created successfully', data: form });
  } catch (err) {
    return next(err);
  }
};

const listFeedbackForms = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    await autoUpdateStatuses(tenantId);
    const page = parseInt(req.query?.page || req.body?.page, 10) || 1;
    const limit = parseInt(req.query?.limit || req.body?.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const status = safeTrim(req.query?.status || req.body?.status || '');
    const category = safeTrim(req.query?.category || req.body?.category || '');
    const query = { tenantId, isdeleted: false };
    if (status) query.status = status.toUpperCase();
    if (category) query.category = category.toUpperCase();
    const [forms, count] = await Promise.all([FeedbackForm.find(query).select('-questions -batchQuestions').sort('-createdAt').skip(skip).limit(limit).lean(), FeedbackForm.countDocuments(query)]);
    const formIds = forms.map((f) => f._id);
    const responseCounts = await FeedbackResponse.aggregate([{ $match: { formId: { $in: formIds }, isdeleted: false } }, { $group: { _id: { formId: '$formId', studentId: '$studentId' } } }, { $group: { _id: '$_id.formId', count: { $sum: 1 } } }]);
    const countMap = new Map(responseCounts.map((r) => [r._id.toString(), r.count]));
    const data = forms.map((f) => ({
      ...f,
      responseCount: countMap.get(f._id.toString()) || 0,
      responseRate: f.totalAssignedStudents > 0 ? Math.round(((countMap.get(f._id.toString()) || 0) / f.totalAssignedStudents) * 1000) / 10 : 0
    }));
    return res.status(200).json({ status: true, data, page, limit, count, pages: Math.ceil(count / limit) || 0 });
  } catch (err) {
    return next(err);
  }
};

const viewFeedbackForm = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId || req.query?.formId);
    if (!tenantId || !formId) return res.status(400).json({ status: false, message: 'tenantId and formId are required' });
    const form = await FeedbackForm.findOne({ _id: formId, tenantId, isdeleted: false }).lean();
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    return res.status(200).json({ status: true, data: form });
  } catch (err) {
    return next(err);
  }
};

const updateFeedbackForm = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !formId) return res.status(400).json({ status: false, message: 'tenantId and formId are required' });
    const form = await FeedbackForm.findOne({ _id: formId, tenantId, isdeleted: false });
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    if (form.status !== 'DRAFT') return res.status(400).json({ status: false, message: 'Only DRAFT forms can be edited' });
    const updateDoc = { updatedBy: userId };
    const { title, description, startDate, endDate, assignedBatches } = req.body;
    if (title) updateDoc.title = safeTrim(title);
    if (description !== undefined) updateDoc.description = description ? safeTrim(description) : null;
    if (startDate) updateDoc.startDate = Number(startDate);
    if (endDate) updateDoc.endDate = Number(endDate);
    if (req.body?.phase !== undefined) updateDoc.phase = req.body.phase ? Number(req.body.phase) : null;
    if (Array.isArray(req.body?.staffAssignments)) {
      const sa = req.body.staffAssignments;
      updateDoc.staffAssignments = sa.map((s) => ({
        staffId: safeTrim(s.staffId),
        staffCode: safeTrim(s.staffCode) || null,
        staffName: safeTrim(s.staffName) || null,
        subjectId: safeTrim(s.subjectId) || null,
        subjectName: safeTrim(s.subjectName) || null,
        subjectCode: safeTrim(s.subjectCode) || null
      }));
      updateDoc.staffIds = sa.map((s) => safeTrim(s.staffId)).filter(Boolean);
      updateDoc.staffNames = sa.map((s) => safeTrim(s.staffName)).filter(Boolean);
    }
    if (assignedBatches) {
      const batches = Array.isArray(assignedBatches) ? assignedBatches.map((b) => safeTrim(String(b))).filter(Boolean) : [];
      if (!batches.length) return res.status(400).json({ status: false, message: 'At least one batch required' });
      updateDoc.assignedBatches = batches;
      updateDoc.totalAssignedStudents = await StudentProfile.countDocuments({ tenantId, batchCode: { $in: batches }, status: 'ACTIVE', isdeleted: false });
    }
    const updated = await FeedbackForm.findOneAndUpdate({ _id: formId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true }).lean();
    return res.status(200).json({ status: true, message: 'Form updated', data: updated });
  } catch (err) {
    return next(err);
  }
};

const changeFeedbackFormStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId);
    const newStatus = safeTrim(req.body?.status).toUpperCase();
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !formId || !newStatus) return res.status(400).json({ status: false, message: 'tenantId, formId and status are required' });
    const validStatuses = ['DRAFT', 'ACTIVE', 'CLOSED'];
    if (!validStatuses.includes(newStatus)) return res.status(400).json({ status: false, message: 'Invalid status. Use DRAFT, ACTIVE or CLOSED' });
    const form = await FeedbackForm.findOne({ _id: formId, tenantId, isdeleted: false });
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    if (form.status === 'CLOSED' && newStatus !== 'CLOSED') return res.status(400).json({ status: false, message: 'A CLOSED form cannot be reopened' });
    const updated = await FeedbackForm.findOneAndUpdate({ _id: formId, tenantId, isdeleted: false }, { $set: { status: newStatus, updatedBy: userId } }, { new: true }).lean();
    // email trigger
    // if (safeTrim(newStatus).toUpperCase() === 'ACTIVE') {
    //   const students = await getFeedbackTargetStudents({
    //     tenantId,
    //     batchCodes: updated.assignedBatches
    //   });
    //   for (const st of students || []) {
    //     triggerCommunicationEventSafe({
    //       tenantId,
    //       eventCode: 'FEEDBACK_FORM_ASSIGNED',
    //       admissionNo: safeTrim(st?.admissionNo),
    //       studentId: safeTrim(st?.studentId),
    //       sourceModule: 'FEEDBACK',
    //       sourceRefId: String(updated._id),
    //       userId,
    //       extraData: {
    //         formId: String(updated._id),
    //         feedbackTitle: updated.title,
    //         feedbackCategory: updated.category,
    //         templateTitle: updated.templateTitle,
    //         batchCode: safeTrim(st?.batchCode),
    //         startDate: updated.startDate,
    //         endDate: updated.endDate,
    //         phase: updated.phase || ''
    //       }
    //     });
    //   }
    // }
    return res.status(200).json({ status: true, message: `Form status changed to ${newStatus}`, data: updated });
  } catch (err) {
    return next(err);
  }
};

const deleteFeedbackForm = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !formId) return res.status(400).json({ status: false, message: 'tenantId and formId are required' });
    const form = await FeedbackForm.findOne({ _id: formId, tenantId, isdeleted: false });
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    if (form.status === 'ACTIVE') return res.status(400).json({ status: false, message: 'Cannot delete an ACTIVE form. Close it first.' });
    await FeedbackForm.findOneAndUpdate({ _id: formId, tenantId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId } });
    return res.status(200).json({ status: true, message: 'Form deleted' });
  } catch (err) {
    return next(err);
  }
};

const getActiveFormsForStudent = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode);
    const studentId = safeTrim(req.body?.studentId || req.query?.studentId);
    if (!tenantId || !batchCode || !studentId) return res.status(400).json({ status: false, message: 'tenantId, batchCode and studentId are required' });
    await autoUpdateStatuses(tenantId);
    const forms = await FeedbackForm.find({ tenantId, isdeleted: false, status: 'ACTIVE', assignedBatches: batchCode }).lean();
    const formIds = forms.map((f) => f._id);
    const submitted = await FeedbackResponse.find({ tenantId, formId: { $in: formIds }, studentId, isdeleted: false }, { formId: 1, staffId: 1 }).lean();
    const submittedMap = new Map();
    submitted.forEach((r) => {
      if (!submittedMap.has(r.formId.toString())) submittedMap.set(r.formId.toString(), new Set());
      if (r.staffId) submittedMap.get(r.formId.toString()).add(r.staffId);
    });
    const data = forms.map((f) => {
      const submittedStaff = submittedMap.get(f._id.toString()) || new Set();
      const staffPending = (f.staffAssignments || []).filter((s) => !submittedStaff.has(s.staffId));
      return {
        _id: f._id,
        title: f.title,
        description: f.description,
        category: f.category,
        templateTitle: f.templateTitle,
        startDate: f.startDate,
        endDate: f.endDate,
        phase: f.phase,
        questions: f.questions,
        staffAssignments: f.staffAssignments || [],
        staffPending,
        fullySubmitted: staffPending.length === 0 && (f.staffAssignments || []).length > 0
      };
    });
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return next(err);
  }
};

const submitFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const admissionNo = safeTrim(req.body?.admissionNo) || null;
    const formId = safeTrim(req.body?.formId);
    const batchCode = safeTrim(req.body?.batchCode);
    const staffId = safeTrim(req.body?.staffId) || null;
    const answers = req.body?.answers;
    const remarks = req.body?.remarks ? String(req.body.remarks).trim() : null;
    if (!tenantId || !studentId || !formId || !batchCode) return res.status(400).json({ status: false, message: 'tenantId, studentId, formId and batchCode are required' });
    if (!Array.isArray(answers) || !answers.length) return res.status(400).json({ status: false, message: 'answers array is required' });
    const form = await FeedbackForm.findOne({ _id: formId, tenantId, isdeleted: false }).lean();
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    if (form.status !== 'ACTIVE') return res.status(400).json({ status: false, message: 'This feedback form is not currently active' });
    if (!form.assignedBatches.includes(batchCode)) return res.status(403).json({ status: false, message: 'This form is not assigned to your batch' });
    if (form.category === 'STAFF' && !staffId) return res.status(400).json({ status: false, message: 'staffId is required for STAFF category feedback' });
    const existingQuery = { tenantId, formId, studentId, isdeleted: false };
    if (staffId) existingQuery.staffId = staffId;
    else existingQuery.staffId = null;
    const existing = await FeedbackResponse.findOne(existingQuery);
    if (existing) return res.status(409).json({ status: false, message: 'You have already submitted feedback for this staff member' });
    let staffCode = null,
      staffName = null;
    if (staffId) {
      const sa = (form.staffAssignments || []).find((s) => s.staffId === staffId);
      staffCode = sa?.staffCode || null;
      staffName = sa?.staffName || null;
    }
    const answerMap = new Map(answers.map((a) => [safeTrim(String(a.fieldId || '')), a]));
    const cleanAnswers = form.questions.map((q) => {
      const raw = answerMap.get(q.fieldId);
      const base = { fieldId: q.fieldId, fieldType: q.fieldType, part: q.part || 'A' };
      if (!raw) return { ...base, score: null, fieldValue: null };
      if (q.fieldType === 'score') {
        const score = Number(raw.score ?? raw.fieldValue);
        if (!Number.isFinite(score) || score < 0 || score > (q.maxScore || 10)) throw Object.assign(new Error(`Score for "${q.fieldText}" must be between 0 and ${q.maxScore || 10}`), { statusCode: 400 });
        return { ...base, score, fieldValue: null };
      }
      if (q.fieldType === 'text') return { ...base, score: null, fieldValue: safeTrim(String(raw.fieldValue ?? '')) || null };
      if (q.fieldType === 'radio') {
        const val = safeTrim(String(raw.fieldValue ?? ''));
        if (val && !q.fieldOptions.some((o) => o.label === val)) throw Object.assign(new Error(`Invalid option for "${q.fieldText}"`), { statusCode: 400 });
        return { ...base, score: null, fieldValue: val || null };
      }
      if (q.fieldType === 'checkbox') {
        const vals = Array.isArray(raw.fieldValue) ? raw.fieldValue : [raw.fieldValue];
        const cleaned = vals.map((v) => safeTrim(String(v ?? ''))).filter(Boolean);
        return { ...base, score: null, fieldValue: cleaned.length ? cleaned : null };
      }
      return { ...base, score: null, fieldValue: null };
    });
    await FeedbackResponse.create({ tenantId, formId, batchCode, studentId, admissionNo, staffId: staffId || null, staffCode, staffName, remarks, answers: cleanAnswers, submittedAt: Date.now() });
    return res.status(201).json({ status: true, message: 'Feedback submitted successfully. Thank you!' });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ status: false, message: err.message });
    if (err.code === 11000) return res.status(409).json({ status: false, message: 'You have already submitted this feedback' });
    return next(err);
  }
};

const checkSubmitted = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId || req.query?.studentId);
    const formId = safeTrim(req.body?.formId || req.query?.formId);
    const staffId = safeTrim(req.body?.staffId || req.query?.staffId) || null;
    if (!tenantId || !studentId || !formId) return res.status(400).json({ status: false, message: 'tenantId, studentId and formId are required' });
    const existing = await FeedbackResponse.findOne({ tenantId, formId, studentId, staffId, isdeleted: false }, { submittedAt: 1 }).lean();
    return res.status(200).json({ status: true, submitted: !!existing, submittedAt: existing?.submittedAt || null });
  } catch (err) {
    return next(err);
  }
};

const viewFeedbackResults = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId || req.query?.formId);
    const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode || '');
    if (!tenantId || !formId) return res.status(400).json({ status: false, message: 'tenantId and formId are required' });
    const form = await FeedbackForm.findOne({ _id: formId, tenantId, isdeleted: false }).lean();
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    const responseFilter = { formId, tenantId, isdeleted: false };
    if (batchCode) responseFilter.batchCode = batchCode;
    const responses = await FeedbackResponse.find(responseFilter).lean();
    const totalResponses = new Set(responses.map((r) => r.studentId)).size;
    const responseRate = form.totalAssignedStudents > 0 ? Math.round((totalResponses / form.totalAssignedStudents) * 1000) / 10 : 0;
    const batchBreakdown = {};
    responses.forEach((r) => {
      batchBreakdown[r.batchCode] = (batchBreakdown[r.batchCode] || 0) + 1;
    });
    const batchesToProcess = batchCode ? [batchCode] : form.assignedBatches || [];
    const batchResults = batchesToProcess.map((bc) => {
      const batchResponses = responses.filter((r) => r.batchCode === bc);
      if (form.category === 'STAFF') {
        const staffResults = (form.staffAssignments || []).map((sa) => {
          const staffResponses = batchResponses.filter((r) => r.staffId === sa.staffId);
          const questionSummary = buildQuestionSummary(form.questions, staffResponses);
          return { staffId: sa.staffId, staffCode: sa.staffCode, staffName: sa.staffName, subjectName: sa.subjectName, responseCount: staffResponses.length, questionSummary };
        });
        return { batchCode: bc, totalResponses: batchResponses.length, staffResults };
      }
      const questionSummary = buildQuestionSummary(form.questions, batchResponses);
      return { batchCode: bc, totalResponses: batchResponses.length, questionSummary };
    });
    return res.status(200).json({
      status: true,
      data: {
        formId: form._id,
        title: form.title,
        description: form.description,
        category: form.category,
        templateTitle: form.templateTitle,
        status: form.status,
        staffAssignments: form.staffAssignments || [],
        assignedBatches: form.assignedBatches,
        startDate: form.startDate,
        endDate: form.endDate,
        totalAssignedStudents: form.totalAssignedStudents,
        totalResponses,
        responseRate,
        batchBreakdown,
        batchResults,
        filteredBatch: batchCode || null
      }
    });
  } catch (err) {
    return next(err);
  }
};

const buildQuestionSummary = (questions, responses) => {
  return (questions || []).map((q) => {
    if (q.fieldType === 'score') {
      const scores = responses
        .map((r) => {
          const ans = (r.answers || []).find((a) => a.fieldId === q.fieldId);
          return ans?.score != null ? ans.score : null;
        })
        .filter((v) => v !== null);
      const avg = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : 0;
      return { fieldId: q.fieldId, fieldType: q.fieldType, fieldText: q.fieldText, part: q.part, maxScore: q.maxScore, totalAnswered: scores.length, avgScore: avg, scores };
    }
    if (q.fieldType === 'text') {
      const textAnswers = responses.map((r) => (r.answers || []).find((a) => a.fieldId === q.fieldId)?.fieldValue).filter((v) => v && String(v).trim());
      return { fieldId: q.fieldId, fieldType: q.fieldType, fieldText: q.fieldText, part: q.part, totalAnswered: textAnswers.length, textAnswers };
    }
    const optionCounts = {};
    (q.fieldOptions || []).forEach((opt) => {
      optionCounts[opt.label || opt] = 0;
    });
    let totalAnswered = 0;
    responses.forEach((r) => {
      const ans = (r.answers || []).find((a) => a.fieldId === q.fieldId);
      if (!ans || ans.fieldValue === null) return;
      const vals = Array.isArray(ans.fieldValue) ? ans.fieldValue : [ans.fieldValue];
      vals.forEach((v) => {
        const key = String(v).trim();
        if (key && optionCounts[key] !== undefined) optionCounts[key]++;
      });
      totalAnswered++;
    });
    return {
      fieldId: q.fieldId,
      fieldType: q.fieldType,
      fieldText: q.fieldText,
      part: q.part,
      fieldOptions: q.fieldOptions,
      totalAnswered,
      optionCounts,
      optionPercentages: Object.fromEntries(Object.entries(optionCounts).map(([opt, count]) => [opt, totalAnswered > 0 ? Math.round((count / totalAnswered) * 1000) / 10 : 0]))
    };
  });
};

const getConsolidatedReport = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId || req.query?.formId);
    if (!tenantId || !formId) return res.status(400).json({ status: false, message: 'tenantId and formId are required' });
    const filterStaffIds = Array.isArray(req.body?.staffIds) ? req.body.staffIds : [];
    const filterBatchCodes = Array.isArray(req.body?.batchCodes) ? req.body.batchCodes : [];
    const form = await FeedbackForm.findOne({ _id: formId, tenantId, isdeleted: false }).lean();
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    const responseFilter = { formId, tenantId, isdeleted: false };
    if (filterBatchCodes.length) responseFilter.batchCode = { $in: filterBatchCodes };
    if (filterStaffIds.length) responseFilter.staffId = { $in: filterStaffIds };
    const responses = await FeedbackResponse.find(responseFilter).lean();
    const batchCodes = filterBatchCodes.length ? filterBatchCodes : form.assignedBatches;
    const studentCounts = await StudentProfile.aggregate([{ $match: { tenantId, batchCode: { $in: batchCodes }, status: 'ACTIVE', isdeleted: false } }, { $group: { _id: '$batchCode', count: { $sum: 1 } } }]);
    const strengthMap = new Map(studentCounts.map((s) => [s._id, s.count]));
    const questions = form.questions || [];
    const partAQs = questions.filter((q) => q.part === 'A' && q.fieldType === 'score').sort((a, b) => a.sortOrder - b.sortOrder);
    const partBQs = questions.filter((q) => q.part === 'B' && q.fieldType === 'score').sort((a, b) => a.sortOrder - b.sortOrder);
    const staffList = filterStaffIds.length ? form.staffAssignments.filter((s) => filterStaffIds.includes(s.staffId)) : form.staffAssignments;
    const rows = [];
    for (const staff of staffList) {
      for (const batchCode of batchCodes) {
        const staffBatchResponses = responses.filter((r) => r.staffId === staff.staffId && r.batchCode === batchCode);
        const responseCount = staffBatchResponses.length;
        const strength = strengthMap.get(batchCode) || 0;
        const partAScores = partAQs.map((q) => {
          const scores = staffBatchResponses.map((r) => (r.answers || []).find((a) => a.fieldId === q.fieldId)?.score).filter((v) => v != null);
          return scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null;
        });
        const partBScores = partBQs.map((q) => {
          const scores = staffBatchResponses.map((r) => (r.answers || []).find((a) => a.fieldId === q.fieldId)?.score).filter((v) => v != null);
          return scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null;
        });
        const validA = partAScores.filter((v) => v != null);
        const maxA = partAQs[0]?.maxScore || 10;
        const teaPct = validA.length ? Math.round((validA.reduce((s, v) => s + v, 0) / validA.length / maxA) * 100 * 10) / 10 : null;
        const validB = partBScores.filter((v) => v != null);
        const maxB = partBQs[0]?.maxScore || 10;
        const reaPct = validB.length ? Math.round((validB.reduce((s, v) => s + v, 0) / validB.length / maxB) * 100 * 10) / 10 : null;
        rows.push({
          staffId: staff.staffId,
          staffCode: staff.staffCode || staff.staffId,
          staffName: staff.staffName,
          subjectName: staff.subjectName,
          batchCode,
          strength,
          responseCount,
          partAScores,
          partBScores,
          teaPct,
          reaPct
        });
      }
    }
    rows.sort((a, b) => (a.staffCode > b.staffCode ? 1 : a.staffCode < b.staffCode ? -1 : a.batchCode > b.batchCode ? 1 : -1));
    return res.status(200).json({
      status: true,
      data: {
        formId: form._id,
        title: form.title,
        category: form.category,
        status: form.status,
        startDate: form.startDate,
        endDate: form.endDate,
        assignedBatches: batchCodes,
        staffAssignments: form.staffAssignments,
        partAHeaders: partAQs.map((q, i) => ({ label: `A${i + 1}`, fieldId: q.fieldId, fieldText: q.fieldText, maxScore: q.maxScore })),
        partBHeaders: partBQs.map((q, i) => ({ label: `B${i + 1}`, fieldId: q.fieldId, fieldText: q.fieldText, maxScore: q.maxScore })),
        rows
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getReportStaffList = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const forms = await FeedbackForm.find({ tenantId, isdeleted: false, 'staffAssignments.0': { $exists: true } }, { staffAssignments: 1 }).lean();
    const staffMap = new Map();
    forms.forEach((form) => {
      (form.staffAssignments || []).forEach((s) => {
        if (s.staffId && !staffMap.has(s.staffId)) {
          staffMap.set(s.staffId, {
            staffId: s.staffId,
            staffCode: s.staffCode || null,
            staffName: s.staffName || s.staffId,
            subjectName: s.subjectName || null
          });
        }
      });
    });
    const data = Array.from(staffMap.values()).sort((a, b) => (a.staffCode || a.staffName).localeCompare(b.staffCode || b.staffName));
    return res.status(200).json({ status: true, data, count: data.length });
  } catch (err) {
    return next(err);
  }
};

// const getConsolidatedStaffReport = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const staffIds = Array.isArray(req.body?.staffIds) ? req.body.staffIds : [];
//     const fromDate = req.body?.fromDate ? Number(req.body.fromDate) : null;
//     const toDate = req.body?.toDate ? Number(req.body.toDate) : null;
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
//     const formQuery = { tenantId, isdeleted: false, 'staffAssignments.0': { $exists: true } };
//     if (fromDate || toDate) {
//       formQuery.startDate = {};
//       if (fromDate) formQuery.startDate.$gte = fromDate;
//       if (toDate) formQuery.startDate.$lte = toDate;
//     }
//     const forms = await FeedbackForm.find(formQuery).lean();
//     if (!forms.length) {
//       return res.status(200).json({
//         status: true,
//         data: { rows: [], partHeaders: {}, partKeys: [], staffList: [], totalForms: 0, totalResponses: 0 }
//       });
//     }
//     const allStaffMap = new Map();
//     forms.forEach((form) => {
//       (form.staffAssignments || []).forEach((s) => {
//         if (!allStaffMap.has(s.staffId)) {
//           allStaffMap.set(s.staffId, {
//             staffId: s.staffId,
//             staffCode: s.staffCode || s.staffId,
//             staffName: s.staffName || s.staffId,
//             subjectName: s.subjectName || null
//           });
//         }
//       });
//     });
//     const targetStaffIds = staffIds.length ? staffIds.filter((id) => allStaffMap.has(id)) : Array.from(allStaffMap.keys());
//     if (!targetStaffIds.length) {
//       return res.status(200).json({
//         status: true,
//         data: { rows: [], partHeaders: {}, partKeys: [], staffList: [], totalForms: 0, totalResponses: 0 }
//       });
//     }
//     const questionMeta = {};
//     const questionsByPart = {};
//     forms.forEach((form) => {
//       (form.questions || []).forEach((q) => {
//         if (!questionMeta[q.fieldId]) {
//           questionMeta[q.fieldId] = {
//             fieldId: q.fieldId,
//             fieldText: q.fieldText,
//             fieldType: q.fieldType,
//             part: q.part || 'A',
//             maxScore: q.maxScore || 10,
//             sortOrder: q.sortOrder || 0
//           };
//         }
//         const part = q.part || 'A';
//         if (!questionsByPart[part]) questionsByPart[part] = [];
//         if (!questionsByPart[part].find((x) => x.fieldId === q.fieldId)) {
//           questionsByPart[part].push(questionMeta[q.fieldId]);
//         }
//       });
//     });
//     Object.keys(questionsByPart).forEach((part) => {
//       questionsByPart[part].sort((a, b) => a.sortOrder - b.sortOrder);
//     });
//     const partKeys = Object.keys(questionsByPart).sort();
//     const partHeaders = {};
//     partKeys.forEach((part) => {
//       partHeaders[part] = questionsByPart[part].map((q, i) => ({
//         label: part + (i + 1),
//         fieldId: q.fieldId,
//         fieldText: q.fieldText,
//         maxScore: q.maxScore
//       }));
//     });
//     const formIds = forms.map((f) => f._id);
//     const responses = await FeedbackResponse.find({
//       tenantId,
//       formId: { $in: formIds },
//       staffId: { $in: targetStaffIds },
//       isdeleted: false
//     }).lean();
//     const formLookup = new Map(forms.map((f) => [f._id.toString(), f]));
//     const allBatchCodes = [...new Set(responses.map((r) => r.batchCode))];
//     const strengthAgg = await StudentProfile.aggregate([{ $match: { tenantId, batchCode: { $in: allBatchCodes }, status: 'ACTIVE', isdeleted: false } }, { $group: { _id: '$batchCode', count: { $sum: 1 } } }]);
//     const strengthMap = new Map(strengthAgg.map((s) => [s._id, s.count]));
//     const rowMap = new Map();
//     responses.forEach((resp) => {
//       const form = formLookup.get(resp.formId.toString());
//       const phase = form?.phase || null;
//       const key = resp.staffId + '::' + resp.batchCode + '::' + (phase || '');
//       if (!rowMap.has(key)) {
//         rowMap.set(key, {
//           staffId: resp.staffId,
//           staffCode: resp.staffCode || allStaffMap.get(resp.staffId)?.staffCode || resp.staffId,
//           staffName: resp.staffName || allStaffMap.get(resp.staffId)?.staffName || '',
//           subjectName: allStaffMap.get(resp.staffId)?.subjectName || null,
//           batchCode: resp.batchCode,
//           phase,
//           strength: strengthMap.get(resp.batchCode) || 0,
//           responses: []
//         });
//       }
//       rowMap.get(key).responses.push({ resp, form });
//     });
//     const rows = Array.from(rowMap.values()).map((row) => {
//       const scoresByField = {};
//       row.responses.forEach(({ resp, form }) => {
//         (resp.answers || []).forEach((ans) => {
//           if (!scoresByField[ans.fieldId]) scoresByField[ans.fieldId] = [];
//           if (ans.fieldType === 'score' && ans.score != null) {
//             scoresByField[ans.fieldId].push(ans.score);
//           } else if ((ans.fieldType === 'radio' || ans.fieldType === 'checkbox') && ans.fieldValue) {
//             const question = (form?.questions || []).find((q) => q.fieldId === ans.fieldId);
//             if (question) {
//               const vals = Array.isArray(ans.fieldValue) ? ans.fieldValue : [ans.fieldValue];
//               vals.forEach((val) => {
//                 const opt = (question.fieldOptions || []).find((o) => o.label === val);
//                 if (opt?.score != null) scoresByField[ans.fieldId].push(opt.score);
//               });
//             }
//           }
//         });
//       });
//       const avgByField = {};
//       Object.keys(scoresByField).forEach((fieldId) => {
//         const scores = scoresByField[fieldId];
//         avgByField[fieldId] = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null;
//       });
//       const partScores = {};
//       partKeys.forEach((part) => {
//         partScores[part] = questionsByPart[part].map((q) => avgByField[q.fieldId] ?? null);
//       });
//       const partPct = {};
//       partKeys.forEach((part) => {
//         const valid = partScores[part].filter((v) => v != null);
//         const maxScr = questionsByPart[part][0]?.maxScore || 10;
//         partPct[part] = valid.length ? Math.round((valid.reduce((s, v) => s + v, 0) / valid.length / maxScr) * 100 * 10) / 10 : null;
//       });
//       return {
//         staffId: row.staffId,
//         staffCode: row.staffCode,
//         staffName: row.staffName,
//         subjectName: row.subjectName,
//         batchCode: row.batchCode,
//         phase: row.phase,
//         strength: row.strength,
//         responseCount: row.responses.length,
//         partScores,
//         partPct,
//         partAScores: partScores['A'] || [],
//         partBScores: partScores['B'] || [],
//         teaPct: partPct['A'] ?? null,
//         reaPct: partPct['B'] ?? null
//       };
//     });
//     rows.sort((a, b) => {
//       const sc = (a.staffCode || '').localeCompare(b.staffCode || '');
//       if (sc !== 0) return sc;
//       const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
//       if (bc !== 0) return bc;
//       return (a.phase || 0) - (b.phase || 0);
//     });
//     return res.status(200).json({
//       status: true,
//       data: {
//         rows,
//         partHeaders,
//         partKeys,
//         staffList: Array.from(allStaffMap.values()),
//         dateRange: { fromDate, toDate },
//         totalForms: forms.length,
//         totalResponses: responses.length
//       }
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

// ─────────────────────────────────────────────────────────────────────────────
// Replace the entire getConsolidatedStaffReport function in feedback.controller.js
// ─────────────────────────────────────────────────────────────────────────────

const getConsolidatedStaffReport = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const staffIds = Array.isArray(req.body?.staffIds) ? req.body.staffIds : [];
    const fromDate = req.body?.fromDate ? Number(req.body.fromDate) : null;
    const toDate = req.body?.toDate ? Number(req.body.toDate) : null;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    // ── Find forms in date range ──────────────────────────────────────────────
    const formQuery = { tenantId, isdeleted: false, 'staffAssignments.0': { $exists: true } };
    if (fromDate || toDate) {
      formQuery.startDate = {};
      if (fromDate) formQuery.startDate.$gte = fromDate;
      if (toDate) formQuery.startDate.$lte = toDate;
    }
    const forms = await FeedbackForm.find(formQuery).lean();

    if (!forms.length) {
      return res.status(200).json({
        status: true,
        data: { rows: [], partHeaders: {}, partKeys: [], staffList: [], totalForms: 0, totalResponses: 0 }
      });
    }

    // ── Build allStaffMap keyed by staffId::subjectName ───────────────────────
    // This correctly handles same staff teaching different subjects in different forms
    const allStaffMap = new Map();
    forms.forEach((form) => {
      (form.staffAssignments || []).forEach((s) => {
        const staffKey = s.staffId + '::' + (s.subjectName || '');
        if (!allStaffMap.has(staffKey)) {
          allStaffMap.set(staffKey, {
            staffKey,
            staffId: s.staffId,
            staffCode: s.staffCode || null,
            staffName: s.staffName || null,
            subjectName: s.subjectName || null,
            subjectCode: s.subjectCode || null
          });
        }
      });
    });

    if (!allStaffMap.size) {
      return res.status(200).json({
        status: true,
        data: { rows: [], partHeaders: {}, partKeys: [], staffList: [], totalForms: 0, totalResponses: 0 }
      });
    }

    // ── Resolve target staffIds ───────────────────────────────────────────────
    const allUniqueStaffIds = [...new Set(Array.from(allStaffMap.values()).map((s) => s.staffId))];
    const targetStaffIds = staffIds.length ? staffIds.filter((id) => allUniqueStaffIds.includes(id)) : allUniqueStaffIds;

    if (!targetStaffIds.length) {
      return res.status(200).json({
        status: true,
        data: { rows: [], partHeaders: {}, partKeys: [], staffList: [], totalForms: 0, totalResponses: 0 }
      });
    }

    // ── Collect question metadata ─────────────────────────────────────────────
    const questionMeta = {};
    const questionsByPart = {};
    forms.forEach((form) => {
      (form.questions || []).forEach((q) => {
        if (!questionMeta[q.fieldId]) {
          questionMeta[q.fieldId] = {
            fieldId: q.fieldId,
            fieldText: q.fieldText,
            fieldType: q.fieldType,
            part: q.part || 'A',
            maxScore: q.maxScore || 10,
            sortOrder: q.sortOrder || 0
          };
        }
        // Use the frozen, first-seen part for this fieldId (same as fieldText/maxScore/etc. above) —
        // not this particular form's copy — so a question can never end up double-counted across two
        // parts if the template's part assignment changed between when different forms were created.
        const part = questionMeta[q.fieldId].part;
        if (!questionsByPart[part]) questionsByPart[part] = [];
        if (!questionsByPart[part].find((x) => x.fieldId === q.fieldId)) {
          questionsByPart[part].push(questionMeta[q.fieldId]);
        }
      });
    });
    Object.keys(questionsByPart).forEach((part) => {
      questionsByPart[part].sort((a, b) => a.sortOrder - b.sortOrder);
    });
    const partKeys = Object.keys(questionsByPart).sort();
    const partHeaders = {};
    partKeys.forEach((part) => {
      partHeaders[part] = questionsByPart[part].map((q, i) => ({
        label: part + (i + 1),
        fieldId: q.fieldId,
        fieldText: q.fieldText,
        maxScore: q.maxScore
      }));
    });

    // ── Fetch responses ───────────────────────────────────────────────────────
    const formIds = forms.map((f) => f._id);
    const formLookup = new Map(forms.map((f) => [f._id.toString(), f]));

    const responses = await FeedbackResponse.find({
      tenantId,
      formId: { $in: formIds },
      staffId: { $in: targetStaffIds },
      isdeleted: false
    }).lean();

    // ── Batch strength lookup ─────────────────────────────────────────────────
    const allBatchCodes = [...new Set(responses.map((r) => r.batchCode))];
    const strengthAgg = await StudentProfile.aggregate([{ $match: { tenantId, batchCode: { $in: allBatchCodes }, status: 'ACTIVE', isdeleted: false } }, { $group: { _id: '$batchCode', count: { $sum: 1 } } }]);
    const strengthMap = new Map(strengthAgg.map((s) => [s._id, s.count]));
    const consolidatedBatches = allBatchCodes.length ? await Batch.find({ tenantId, batchCode: { $in: allBatchCodes } }, { batchCode: 1, batchName: 1 }).lean() : [];
    const consolidatedBatchNameMap = new Map(consolidatedBatches.map((b) => [b.batchCode, b.batchName]));

    // ── Group responses by staffId::subjectName::batchCode::phase ────────────
    const rowMap = new Map();
    responses.forEach((resp) => {
      const form = formLookup.get(resp.formId.toString());
      const phase = form?.phase ?? null;
      const staffAssignment = (form?.staffAssignments || []).find((s) => s.staffId === resp.staffId);
      const subjectName = staffAssignment?.subjectName || null;
      const subjectCode = staffAssignment?.subjectCode || null;
      const staffCode = resp.staffCode || staffAssignment?.staffCode || resp.staffId;
      const staffName = resp.staffName || staffAssignment?.staffName || resp.staffId;
      const key = resp.staffId + '::' + (subjectName || '') + '::' + resp.batchCode + '::' + (phase ?? '');
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          staffId: resp.staffId,
          staffCode,
          staffName,
          subjectName,
          subjectCode,
          batchCode: resp.batchCode,
          batchName: consolidatedBatchNameMap.get(resp.batchCode) || null,
          phase,
          strength: strengthMap.get(resp.batchCode) || 0,
          responses: []
        });
      }
      rowMap.get(key).responses.push({ resp, form });
    });
    const rows = Array.from(rowMap.values()).map((row) => {
      const scoresByField = {};
      row.responses.forEach(({ resp, form }) => {
        (resp.answers || []).forEach((ans) => {
          if (!scoresByField[ans.fieldId]) scoresByField[ans.fieldId] = [];
          if (ans.fieldType === 'score' && ans.score != null) {
            scoresByField[ans.fieldId].push(ans.score);
          } else if ((ans.fieldType === 'radio' || ans.fieldType === 'checkbox') && ans.fieldValue) {
            const question = (form?.questions || []).find((q) => q.fieldId === ans.fieldId);
            if (question) {
              const vals = Array.isArray(ans.fieldValue) ? ans.fieldValue : [ans.fieldValue];
              vals.forEach((val) => {
                const opt = (question.fieldOptions || []).find((o) => o.label === val);
                if (opt?.score != null) scoresByField[ans.fieldId].push(opt.score);
              });
            }
          }
        });
      });
      const avgByField = {};
      Object.keys(scoresByField).forEach((fieldId) => {
        const scores = scoresByField[fieldId];
        avgByField[fieldId] = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null;
      });
      const partScores = {};
      partKeys.forEach((part) => {
        partScores[part] = questionsByPart[part].map((q) => avgByField[q.fieldId] ?? null);
      });
      const partPct = {};
      partKeys.forEach((part) => {
        const valid = partScores[part].filter((v) => v != null);
        const maxScr = questionsByPart[part][0]?.maxScore || 10;
        partPct[part] = valid.length ? Math.round((valid.reduce((s, v) => s + v, 0) / valid.length / maxScr) * 100 * 10) / 10 : null;
      });
      return {
        staffId: row.staffId,
        staffCode: row.staffCode,
        staffName: row.staffName,
        subjectName: row.subjectName,
        subjectCode: row.subjectCode,
        batchCode: row.batchCode,
        batchName: row.batchName,
        phase: row.phase,
        strength: row.strength,
        responseCount: row.responses.length,
        partScores,
        partPct,
        partAScores: partScores['A'] || [],
        partBScores: partScores['B'] || [],
        teaPct: partPct['A'] ?? null,
        reaPct: partPct['B'] ?? null
      };
    });
    rows.sort((a, b) => {
      const sc = (a.staffCode || '').localeCompare(b.staffCode || '');
      if (sc !== 0) return sc;
      const sn = (a.subjectName || '').localeCompare(b.subjectName || '');
      if (sn !== 0) return sn;
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
      return (a.phase || 0) - (b.phase || 0);
    });
    const staffList = Array.from(allStaffMap.values())
      .filter((s) => targetStaffIds.includes(s.staffId))
      .sort((a, b) => (a.staffCode || '').localeCompare(b.staffCode || ''));
    return res.status(200).json({
      status: true,
      data: {
        rows,
        partHeaders,
        partKeys,
        staffList,
        dateRange: { fromDate, toDate },
        totalForms: forms.length,
        totalResponses: responses.length
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getStaffRemarksReport = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const staffIds = Array.isArray(req.body?.staffIds) ? req.body.staffIds : [];
    const fromDate = req.body?.fromDate ? Number(req.body.fromDate) : null;
    const toDate = req.body?.toDate ? Number(req.body.toDate) : null;

    const formQuery = { tenantId, isdeleted: false };
    if (fromDate || toDate) {
      formQuery.startDate = {};
      if (fromDate) formQuery.startDate.$gte = fromDate;
      if (toDate) formQuery.startDate.$lte = toDate;
    }
    const forms = await FeedbackForm.find(formQuery, { _id: 1, phase: 1 }).lean();
    if (!forms.length) return res.status(200).json({ status: true, data: [], totalStaff: 0 });

    const formIds = forms.map((f) => f._id);
    const formLookup = new Map(forms.map((f) => [f._id.toString(), f]));

    const responseFilter = {
      tenantId,
      formId: { $in: formIds },
      isdeleted: false,
      remarks: { $nin: [null, ''] }
    };
    if (staffIds.length) responseFilter.staffId = { $in: staffIds };

    const responses = await FeedbackResponse.find(responseFilter, { staffId: 1, staffCode: 1, staffName: 1, batchCode: 1, formId: 1, remarks: 1, submittedAt: 1 }).lean();

    if (!responses.length) return res.status(200).json({ status: true, data: [], totalStaff: 0 });

    // Group: staffId → batchCode → phase → remarks[]
    const staffMap = new Map();
    responses.forEach((r) => {
      const form = formLookup.get(r.formId.toString());
      const phase = form?.phase ?? null;

      if (!staffMap.has(r.staffId)) {
        staffMap.set(r.staffId, {
          staffId: r.staffId,
          staffCode: r.staffCode || null,
          staffName: r.staffName || r.staffId,
          batches: new Map()
        });
      }
      const staffEntry = staffMap.get(r.staffId);

      if (!staffEntry.batches.has(r.batchCode)) {
        staffEntry.batches.set(r.batchCode, new Map());
      }
      const batchEntry = staffEntry.batches.get(r.batchCode);

      const phaseKey = phase != null ? String(phase) : 'general';
      if (!batchEntry.has(phaseKey)) {
        batchEntry.set(phaseKey, {
          phase,
          phaseLabel: phase != null ? `Phase ${phase}` : 'General',
          remarks: []
        });
      }
      batchEntry.get(phaseKey).remarks.push({
        remark: r.remarks,
        submittedAt: r.submittedAt
      });
    });

    const data = Array.from(staffMap.values())
      .sort((a, b) => (a.staffCode || a.staffName).localeCompare(b.staffCode || b.staffName))
      .map((staff) => ({
        staffId: staff.staffId,
        staffCode: staff.staffCode,
        staffName: staff.staffName,
        batches: Array.from(staff.batches.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([batchCode, phaseMap]) => ({
            batchCode,
            phases: Array.from(phaseMap.values())
              .sort((a, b) => (a.phase ?? 999) - (b.phase ?? 999))
              .map((p) => ({
                phase: p.phase,
                phaseLabel: p.phaseLabel,
                remarks: p.remarks.sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0))
              }))
          }))
      }));

    return res.status(200).json({ status: true, data, totalStaff: data.length });
  } catch (err) {
    return next(err);
  }
};

export default {
  createTemplate,
  listTemplates,
  listActiveTemplates,
  viewTemplate,
  updateTemplate,
  toggleTemplateStatus,
  deleteTemplate,
  createFeedbackForm,
  listFeedbackForms,
  viewFeedbackForm,
  updateFeedbackForm,
  changeFeedbackFormStatus,
  deleteFeedbackForm,
  getActiveFormsForStudent,
  submitFeedback,
  checkSubmitted,
  viewFeedbackResults,
  getConsolidatedReport,
  getReportStaffList,
  getConsolidatedStaffReport,
  getStaffRemarksReport
};

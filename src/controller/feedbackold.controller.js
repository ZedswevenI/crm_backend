import mongoose from 'mongoose';
import FeedbackTemplate from '../models/feedbackTemplate.model.js';
import FeedbackForm from '../models/feedbackForm.model.js';
import FeedbackResponse from '../models/feedbackResponse.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import Batch from '../models/batch.model.js';
import { buildBatchQuestionSnapshots } from '../helpers/feedbackExpansion.helper.js';

const pickTenantId = (req) => (req.body?.entiId || req.body?.tenantId || '').toString().trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();

const autoUpdateStatuses = async (tenantId) => {
  const now = Date.now();
  await Promise.all([FeedbackForm.updateMany({ tenantId, isdeleted: false, status: 'DRAFT', startDate: { $lte: now } }, { $set: { status: 'ACTIVE' } }), FeedbackForm.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', endDate: { $lt: now } }, { $set: { status: 'CLOSED' } })]);
};

const VALID_TYPES = ['text', 'radio', 'checkbox'];

const normalizeQuestions = (raw) => {
  if (!Array.isArray(raw) || !raw.length) return { valid: false, message: 'At least one question is required' };
  const questions = [];
  for (let i = 0; i < raw.length; i++) {
    const q = raw[i] || {};
    const fieldType = safeTrim(q.fieldType).toLowerCase();
    if (!VALID_TYPES.includes(fieldType)) return { valid: false, message: `Q${i + 1}: invalid fieldType "${q.fieldType}"` };
    const fieldText = safeTrim(q.fieldText);
    if (!fieldText) return { valid: false, message: `Q${i + 1}: fieldText is required` };
    const fieldOptions = Array.isArray(q.fieldOptions) ? q.fieldOptions.map((o) => safeTrim(String(o))).filter(Boolean) : [];
    if ((fieldType === 'radio' || fieldType === 'checkbox') && fieldOptions.length < 2)
      return {
        valid: false,
        message: `Q${i + 1}: "${fieldType}" needs at least 2 options`
      };
    questions.push({
      fieldId: q.fieldId ? safeTrim(q.fieldId) : `q_${i + 1}`,
      fieldType,
      fieldText,
      fieldOptions: fieldType === 'text' ? [] : fieldOptions,
      sortOrder: i + 1
    });
  }
  return { valid: true, questions };
};

const createTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const { title, description, category } = req.body;
    if (!title || !category)
      return res.status(400).json({
        status: false,
        message: 'title and category are required'
      });
    const validCategories = ['STAFF', 'BATCH', 'FACILITY', 'COURSE'];
    if (!validCategories.includes(category.toUpperCase()))
      return res.status(400).json({
        status: false,
        message: `Invalid category. Use: ${validCategories.join(', ')}`
      });
    const qResult = normalizeQuestions(req.body.questions);
    if (!qResult.valid) return res.status(400).json({ status: false, message: qResult.message });
    const template = await FeedbackTemplate.create({
      tenantId,
      title: safeTrim(title),
      description: description ? safeTrim(description) : null,
      category: category.toUpperCase(),
      questions: qResult.questions,
      status: 'ACTIVE',
      isdeleted: false,
      createdBy: userId
    });
    return res.status(201).json({
      status: true,
      message: 'Feedback template created successfully',
      data: template
    });
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
    return res.status(200).json({
      status: true,
      data,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0
    });
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
    if (!tenantId || !templateId)
      return res.status(400).json({
        status: false,
        message: 'tenantId and templateId are required'
      });
    const template = await FeedbackTemplate.findOne({
      _id: templateId,
      tenantId,
      isdeleted: false
    }).lean();
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
    if (!tenantId || !templateId)
      return res.status(400).json({
        status: false,
        message: 'tenantId and templateId are required'
      });
    const template = await FeedbackTemplate.findOne({
      _id: templateId,
      tenantId,
      isdeleted: false
    });
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
    return res.status(200).json({
      status: true,
      message: 'Template updated',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const toggleTemplateStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const templateId = safeTrim(req.body?.templateId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !templateId)
      return res.status(400).json({
        status: false,
        message: 'tenantId and templateId are required'
      });
    const template = await FeedbackTemplate.findOne({
      _id: templateId,
      tenantId,
      isdeleted: false
    });
    if (!template) return res.status(404).json({ status: false, message: 'Template not found' });
    const newStatus = template.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await FeedbackTemplate.findOneAndUpdate({ _id: templateId, tenantId, isdeleted: false }, { $set: { status: newStatus, updatedBy: userId } }, { new: true }).lean();
    return res.status(200).json({
      status: true,
      message: `Template ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`,
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const templateId = safeTrim(req.body?.templateId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !templateId)
      return res.status(400).json({
        status: false,
        message: 'tenantId and templateId are required'
      });
    const activeFormsCount = await FeedbackForm.countDocuments({
      tenantId,
      templateId,
      status: { $in: ['DRAFT', 'ACTIVE'] },
      isdeleted: false
    });
    if (activeFormsCount > 0)
      return res.status(400).json({
        status: false,
        message: `Cannot delete — ${activeFormsCount} active form(s) use this template. Close them first.`
      });
    await FeedbackTemplate.findOneAndUpdate({ _id: templateId, tenantId, isdeleted: false }, { $set: { isdeleted: true, status: 'INACTIVE', updatedBy: userId } });
    return res.status(200).json({
      status: true,
      message: 'Template deleted successfully'
    });
  } catch (err) {
    return next(err);
  }
};

// const createFeedbackForm = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const userId = safeTrim(req.body?.userId);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
//     const { title, description, templateId, assignedBatches, startDate, endDate } = req.body;
//     const staffIds = Array.isArray(req.body?.staffIds) ? req.body.staffIds.map((s) => safeTrim(String(s))).filter(Boolean) : [];
//     const staffNames = Array.isArray(req.body?.staffNames) ? req.body.staffNames.map((s) => safeTrim(String(s))).filter(Boolean) : [];
//     if (!title || !templateId || !startDate || !endDate)
//       return res.status(400).json({
//         status: false,
//         message: 'title, templateId, startDate and endDate are required'
//       });
//     if (Number(endDate) <= Number(startDate))
//       return res.status(400).json({
//         status: false,
//         message: 'endDate must be after startDate'
//       });
//     const batches = Array.isArray(assignedBatches) ? assignedBatches.map((b) => safeTrim(String(b))).filter(Boolean) : [];
//     if (!batches.length)
//       return res.status(400).json({
//         status: false,
//         message: 'At least one batch must be assigned'
//       });
//     const template = await FeedbackTemplate.findOne({
//       _id: templateId,
//       tenantId,
//       status: 'ACTIVE',
//       isdeleted: false
//     }).lean();
//     if (!template)
//       return res.status(404).json({
//         status: false,
//         message: 'Template not found or not ACTIVE. Only ACTIVE templates can be used.'
//       });
//     if (template.category === 'STAFF' && !staffIds.length)
//       return res.status(400).json({
//         status: false,
//         message: 'At least one staffId is required for STAFF category template'
//       });
//     const totalAssignedStudents = await StudentProfile.countDocuments({
//       tenantId,
//       batchCode: { $in: batches },
//       status: 'ACTIVE',
//       isdeleted: false
//     });
//     const now = Date.now();
//     const initialStatus = now >= Number(startDate) ? 'ACTIVE' : 'DRAFT';
//     const form = await FeedbackForm.create({
//       tenantId,
//       title: safeTrim(title),
//       description: description ? safeTrim(description) : null,
//       templateId: template._id,
//       templateTitle: template.title,
//       category: template.category,
//       staffIds,
//       staffNames,
//       questions: template.questions,
//       assignedBatches: batches,
//       startDate: Number(startDate),
//       endDate: Number(endDate),
//       totalAssignedStudents,
//       status: initialStatus,
//       isdeleted: false,
//       createdBy: userId
//     });
//     return res.status(201).json({
//       status: true,
//       message: 'Feedback form created successfully',
//       data: form
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const createFeedbackForm = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const { title, description, templateId, staffIds, staffNames, assignedBatches, startDate, endDate } = req.body;
    if (!title || !templateId || !startDate || !endDate)
      return res.status(400).json({
        status: false,
        message: 'title, templateId, startDate and endDate are required'
      });
    if (Number(endDate) <= Number(startDate))
      return res.status(400).json({
        status: false,
        message: 'endDate must be after startDate'
      });
    const batches = Array.isArray(assignedBatches) ? assignedBatches.map((b) => safeTrim(String(b))).filter(Boolean) : [];
    if (!batches.length)
      return res.status(400).json({
        status: false,
        message: 'At least one batch must be assigned'
      });
    const template = await FeedbackTemplate.findOne({
      _id: templateId,
      tenantId,
      status: 'ACTIVE',
      isdeleted: false
    }).lean();
    if (!template)
      return res.status(404).json({
        status: false,
        message: 'Template not found or not ACTIVE'
      });
    const sIds = Array.isArray(staffIds) ? staffIds.map((s) => safeTrim(String(s))).filter(Boolean) : [];
    const sNames = Array.isArray(staffNames) ? staffNames.map((s) => safeTrim(String(s))).filter(Boolean) : [];
    if (template.category === 'STAFF' && !sIds.length)
      return res.status(400).json({
        status: false,
        message: 'At least one staffId is required for STAFF category'
      });
    const totalAssignedStudents = await StudentProfile.countDocuments({
      tenantId,
      batchCode: { $in: batches },
      status: 'ACTIVE',
      isdeleted: false
    });
    const batchQuestions = await buildBatchQuestionSnapshots(tenantId, batches, template.questions);
    const hasSubjectQuestions = template.questions.some((q) => q.isSubjectBased);
    const mergedQuestions = hasSubjectQuestions
      ? batchQuestions[0]?.questions || [] // use first batch as reference
      : batchQuestions[0]?.questions || [];
    const now = Date.now();
    const initialStatus = now >= Number(startDate) ? 'ACTIVE' : 'DRAFT';
    const form = await FeedbackForm.create({
      tenantId,
      title: safeTrim(title),
      description: description ? safeTrim(description) : null,
      templateId: template._id,
      templateTitle: template.title,
      category: template.category,
      staffIds: sIds,
      staffNames: sNames,
      assignedBatches: batches,
      batchQuestions,
      questions: mergedQuestions,
      startDate: Number(startDate),
      endDate: Number(endDate),
      totalAssignedStudents,
      status: initialStatus,
      isdeleted: false,
      createdBy: userId
    });
    return res.status(201).json({
      status: true,
      message: 'Feedback form created successfully',
      data: form
    });
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
    const [forms, count] = await Promise.all([FeedbackForm.find(query).select('-questions').sort('-createdAt').skip(skip).limit(limit).lean(), FeedbackForm.countDocuments(query)]);
    const formIds = forms.map((f) => f._id);
    const responseCounts = await FeedbackResponse.aggregate([{ $match: { formId: { $in: formIds }, isdeleted: false } }, { $group: { _id: '$formId', count: { $sum: 1 } } }]);
    const countMap = new Map(responseCounts.map((r) => [r._id.toString(), r.count]));
    const data = forms.map((f) => ({
      ...f,
      responseCount: countMap.get(f._id.toString()) || 0,
      responseRate: f.totalAssignedStudents > 0 ? Math.round(((countMap.get(f._id.toString()) || 0) / f.totalAssignedStudents) * 1000) / 10 : 0
    }));
    return res.status(200).json({
      status: true,
      data,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0
    });
  } catch (err) {
    return next(err);
  }
};

const viewFeedbackForm = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId || req.query?.formId);
    if (!tenantId || !formId)
      return res.status(400).json({
        status: false,
        message: 'tenantId and formId are required'
      });
    const form = await FeedbackForm.findOne({
      _id: formId,
      tenantId,
      isdeleted: false
    }).lean();
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
    if (!tenantId || !formId)
      return res.status(400).json({
        status: false,
        message: 'tenantId and formId are required'
      });
    const form = await FeedbackForm.findOne({
      _id: formId,
      tenantId,
      isdeleted: false
    });
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    if (form.status !== 'DRAFT')
      return res.status(400).json({
        status: false,
        message: 'Only DRAFT forms can be edited'
      });
    const updateDoc = { updatedBy: userId };
    const { title, description, startDate, endDate, staffId, staffName, assignedBatches } = req.body;
    if (title) updateDoc.title = safeTrim(title);
    if (description !== undefined) updateDoc.description = description ? safeTrim(description) : null;
    if (startDate) updateDoc.startDate = Number(startDate);
    if (endDate) updateDoc.endDate = Number(endDate);
    if (req.body.staffIds !== undefined) {
      const staffIds = Array.isArray(req.body.staffIds) ? req.body.staffIds.map((s) => safeTrim(String(s))).filter(Boolean) : [];
      updateDoc.staffIds = staffIds;
      updateDoc.staffNames = Array.isArray(req.body.staffNames) ? req.body.staffNames.map((s) => safeTrim(String(s))).filter(Boolean) : [];
    }
    if (assignedBatches) {
      const batches = Array.isArray(assignedBatches) ? assignedBatches.map((b) => safeTrim(String(b))).filter(Boolean) : [];
      if (!batches.length)
        return res.status(400).json({
          status: false,
          message: 'At least one batch required'
        });
      updateDoc.assignedBatches = batches;
      updateDoc.totalAssignedStudents = await StudentProfile.countDocuments({
        tenantId,
        batchCode: { $in: batches },
        status: 'ACTIVE',
        isdeleted: false
      });
    }
    const updated = await FeedbackForm.findOneAndUpdate({ _id: formId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true }).lean();
    return res.status(200).json({
      status: true,
      message: 'Form updated',
      data: updated
    });
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
    if (!tenantId || !formId || !newStatus)
      return res.status(400).json({
        status: false,
        message: 'tenantId, formId and status are required'
      });
    const validStatuses = ['DRAFT', 'ACTIVE', 'CLOSED'];
    if (!validStatuses.includes(newStatus))
      return res.status(400).json({
        status: false,
        message: 'Invalid status. Use DRAFT, ACTIVE or CLOSED'
      });
    const form = await FeedbackForm.findOne({
      _id: formId,
      tenantId,
      isdeleted: false
    });
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    if (form.status === 'CLOSED' && newStatus !== 'CLOSED')
      return res.status(400).json({
        status: false,
        message: 'A CLOSED form cannot be reopened'
      });
    const updated = await FeedbackForm.findOneAndUpdate({ _id: formId, tenantId, isdeleted: false }, { $set: { status: newStatus, updatedBy: userId } }, { new: true }).lean();
    return res.status(200).json({
      status: true,
      message: `Form status changed to ${newStatus}`,
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const deleteFeedbackForm = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !formId)
      return res.status(400).json({
        status: false,
        message: 'tenantId and formId are required'
      });
    const form = await FeedbackForm.findOne({
      _id: formId,
      tenantId,
      isdeleted: false
    });
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    if (form.status === 'ACTIVE')
      return res.status(400).json({
        status: false,
        message: 'Cannot delete an ACTIVE form. Close it first.'
      });
    await FeedbackForm.findOneAndUpdate({ _id: formId, tenantId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId } });
    return res.status(200).json({ status: true, message: 'Form deleted' });
  } catch (err) {
    return next(err);
  }
};

// const viewFeedbackResults = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const formId = safeTrim(req.body?.formId || req.query?.formId);
//     const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode || '');
//     if (!tenantId || !formId)
//       return res.status(400).json({
//         status: false,
//         message: 'tenantId and formId are required'
//       });
//     const form = await FeedbackForm.findOne({
//       _id: formId,
//       tenantId,
//       isdeleted: false
//     }).lean();
//     if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
//     const responseFilter = { formId, tenantId, isdeleted: false };
//     if (batchCode) responseFilter.batchCode = batchCode;
//     const responses = await FeedbackResponse.find(responseFilter, { answers: 1, batchCode: 1, submittedAt: 1, _id: 0 }).lean();
//     const totalResponses = responses.length;
//     const responseRate = form.totalAssignedStudents > 0 ? Math.round((totalResponses / form.totalAssignedStudents) * 1000) / 10 : 0;
//     const batchBreakdown = {};
//     responses.forEach((r) => {
//       batchBreakdown[r.batchCode] = (batchBreakdown[r.batchCode] || 0) + 1;
//     });
//     const batchResults = form.batchQuestions.map((bq) => {
//       const batchResponses = responses.filter((r) => r.batchCode === bq.batchCode);
//       const questionSummary = bq.questions.map((q) => {
//         if (q.fieldType === 'text') {
//           const textAnswers = batchResponses.map((r) => r.answers.find((a) => a.fieldId === q.fieldId)?.fieldValue).filter((v) => v && String(v).trim());
//           return {
//             fieldId: q.fieldId,
//             fieldType: q.fieldType,
//             fieldText: q.fieldText,
//             isSubjectBased: q.isSubjectBased,
//             subjectName: q.subjectName,
//             staffName: q.staffName,
//             totalAnswered: textAnswers.length,
//             textAnswers
//           };
//         }
//         const optionCounts = {};
//         q.fieldOptions.forEach((opt) => {
//           optionCounts[opt] = 0;
//         });
//         let totalAnswered = 0;
//         batchResponses.forEach((r) => {
//           const ans = r.answers.find((a) => a.fieldId === q.fieldId);
//           if (!ans || ans.fieldValue === null) return;
//           const vals = Array.isArray(ans.fieldValue) ? ans.fieldValue : [ans.fieldValue];
//           vals.forEach((v) => {
//             const key = String(v).trim();
//             if (key && optionCounts[key] !== undefined) optionCounts[key]++;
//           });
//           totalAnswered++;
//         });
//         return {
//           fieldId: q.fieldId,
//           fieldType: q.fieldType,
//           fieldText: q.fieldText,
//           fieldOptions: q.fieldOptions,
//           isSubjectBased: q.isSubjectBased,
//           subjectName: q.subjectName,
//           staffName: q.staffName,
//           totalAnswered,
//           optionCounts,
//           optionPercentages: Object.fromEntries(Object.entries(optionCounts).map(([opt, count]) => [opt, totalAnswered > 0 ? Math.round((count / totalAnswered) * 1000) / 10 : 0]))
//         };
//       });
//       return {
//         batchCode: bq.batchCode,
//         batchName: bq.batchName,
//         totalResponses: batchResponses.length,
//         questionSummary
//       };
//     });

//     return res.status(200).json({
//       status: true,
//       data: {
//         formId: form._id,
//         title: form.title,
//         description: form.description,
//         category: form.category,
//         templateTitle: form.templateTitle,
//         status: form.status,
//         staffNames: form.staffNames,
//         assignedBatches: form.assignedBatches,
//         startDate: form.startDate,
//         endDate: form.endDate,
//         totalAssignedStudents: form.totalAssignedStudents,
//         totalResponses,
//         responseRate,
//         batchBreakdown,
//         // Per-batch results — each batch has its own question set
//         batchResults,
//         // Filtered batch (if batchCode passed)
//         filteredBatch: batchCode || null
//       }
//     });
//   } catch (err) {
//     console.log('err ', err);
//     return next(err);
//   }
// };

const viewFeedbackResults = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const formId = safeTrim(req.body?.formId || req.query?.formId);
    const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode || '');

    if (!tenantId || !formId) {
      return res.status(400).json({
        status: false,
        message: 'tenantId and formId are required'
      });
    }

    const form = await FeedbackForm.findOne({
      _id: formId,
      tenantId,
      isdeleted: false
    }).lean();

    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });

    const responseFilter = { formId, tenantId, isdeleted: false };
    if (batchCode) responseFilter.batchCode = batchCode;

    const responses = await FeedbackResponse.find(responseFilter, { answers: 1, batchCode: 1, submittedAt: 1, _id: 0 }).lean();

    const totalResponses = responses.length;
    const responseRate = form.totalAssignedStudents > 0 ? Math.round((totalResponses / form.totalAssignedStudents) * 1000) / 10 : 0;

    const batchBreakdown = {};
    responses.forEach((r) => {
      batchBreakdown[r.batchCode] = (batchBreakdown[r.batchCode] || 0) + 1;
    });

    // Determine the list of batches to process.
    // If a specific batchCode was requested, only process that one.
    // Otherwise, process all assignedBatches.
    const batchesToProcess = batchCode ? [batchCode] : form.assignedBatches || Object.keys(batchBreakdown);

    // Map over the batches, using the ROOT form.questions array
    const batchResults = batchesToProcess.map((currentBatchCode) => {
      const batchResponses = responses.filter((r) => r.batchCode === currentBatchCode);

      const questionSummary = (form.questions || []).map((q) => {
        if (q.fieldType === 'text') {
          const textAnswers = batchResponses.map((r) => (r.answers || []).find((a) => a.fieldId === q.fieldId)?.fieldValue).filter((v) => v && String(v).trim());

          return {
            fieldId: q.fieldId,
            fieldType: q.fieldType,
            fieldText: q.fieldText,
            isSubjectBased: q.isSubjectBased,
            subjectName: q.subjectName, // Might be undefined at root level, which is fine
            staffName: form.staffName || q.staffName, // Pull staffName from root if available
            totalAnswered: textAnswers.length,
            textAnswers
          };
        }

        const optionCounts = {};
        (q.fieldOptions || []).forEach((opt) => {
          optionCounts[opt] = 0;
        });

        let totalAnswered = 0;
        batchResponses.forEach((r) => {
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
          fieldOptions: q.fieldOptions || [],
          isSubjectBased: q.isSubjectBased,
          subjectName: q.subjectName,
          staffName: form.staffName || q.staffName,
          totalAnswered,
          optionCounts,
          optionPercentages: Object.fromEntries(Object.entries(optionCounts).map(([opt, count]) => [opt, totalAnswered > 0 ? Math.round((count / totalAnswered) * 1000) / 10 : 0]))
        };
      });

      return {
        batchCode: currentBatchCode,
        batchName: currentBatchCode, // You might need a lookup to get the real batch name if needed
        totalResponses: batchResponses.length,
        questionSummary
      };
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
        staffNames: form.staffNames || [form.staffName].filter(Boolean), // Normalize to array if needed
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
    console.log('err ', err);
    return next(err);
  }
};

const getActiveFormsForStudent = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode);
    const studentId = safeTrim(req.body?.studentId || req.query?.studentId);

    if (!tenantId || !batchCode || !studentId)
      return res.status(400).json({
        status: false,
        message: 'tenantId, batchCode and studentId are required'
      });

    await autoUpdateStatuses(tenantId);

    const forms = await FeedbackForm.find({
      tenantId,
      isdeleted: false,
      status: 'ACTIVE',
      assignedBatches: batchCode
    }).lean();

    const formIds = forms.map((f) => f._id);
    const submitted = await FeedbackResponse.find({ tenantId, formId: { $in: formIds }, studentId, isdeleted: false }, { formId: 1 }).lean();
    const submittedSet = new Set(submitted.map((r) => r.formId.toString()));

    const data = forms.map((f) => {
      // ── Find this student's batch-specific questions ──
      const batchSnapshot = f.batchQuestions?.find((bq) => bq.batchCode === batchCode);
      // Fallback to merged questions if batch snapshot not found
      const questions = batchSnapshot?.questions || f.questions || [];

      return {
        _id: f._id,
        title: f.title,
        description: f.description,
        category: f.category,
        staffNames: f.staffNames,
        templateTitle: f.templateTitle,
        startDate: f.startDate,
        endDate: f.endDate,
        questions,
        alreadySubmitted: submittedSet.has(f._id.toString())
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
    const formId = safeTrim(req.body?.formId);
    const batchCode = safeTrim(req.body?.batchCode);
    const answers = req.body?.answers;
    if (!tenantId || !studentId || !formId || !batchCode)
      return res.status(400).json({
        status: false,
        message: 'tenantId, studentId, formId and batchCode are required'
      });
    if (!Array.isArray(answers) || !answers.length)
      return res.status(400).json({
        status: false,
        message: 'answers array is required'
      });
    const form = await FeedbackForm.findOne({
      _id: formId,
      tenantId,
      isdeleted: false
    }).lean();
    if (!form) return res.status(404).json({ status: false, message: 'Form not found' });
    if (form.status !== 'ACTIVE')
      return res.status(400).json({
        status: false,
        message: 'This feedback form is not currently active'
      });
    if (!form.assignedBatches.includes(batchCode))
      return res.status(403).json({
        status: false,
        message: 'This form is not assigned to your batch'
      });
    const existing = await FeedbackResponse.findOne({
      tenantId,
      formId,
      studentId,
      isdeleted: false
    });
    if (existing)
      return res.status(409).json({
        status: false,
        message: 'You have already submitted this feedback'
      });
    const answerMap = new Map(answers.map((a) => [safeTrim(String(a.fieldId || '')), a.fieldValue]));
    const cleanAnswers = form.questions.map((q) => {
      const raw = answerMap.get(q.fieldId);
      if (raw === undefined || raw === null) return { fieldId: q.fieldId, fieldType: q.fieldType, fieldValue: null };
      let fieldValue = null;
      if (q.fieldType === 'text') {
        fieldValue = safeTrim(String(raw)) || null;
      } else if (q.fieldType === 'radio') {
        const val = safeTrim(String(raw));
        if (val && !q.fieldOptions.includes(val)) throw Object.assign(new Error(`Invalid option "${val}" for "${q.fieldText}"`), { statusCode: 400 });
        fieldValue = val || null;
      } else if (q.fieldType === 'checkbox') {
        const vals = Array.isArray(raw) ? raw : [raw];
        const cleaned = vals.map((v) => safeTrim(String(v ?? ''))).filter(Boolean);
        const bad = cleaned.find((v) => !q.fieldOptions.includes(v));
        if (bad) throw Object.assign(new Error(`Invalid option "${bad}" for "${q.fieldText}"`), { statusCode: 400 });
        fieldValue = cleaned.length ? cleaned : null;
      }
      return { fieldId: q.fieldId, fieldType: q.fieldType, fieldValue };
    });
    await FeedbackResponse.create({
      tenantId,
      formId,
      batchCode,
      studentId,
      answers: cleanAnswers,
      submittedAt: Date.now()
    });
    return res.status(201).json({
      status: true,
      message: 'Feedback submitted successfully. Thank you!'
    });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ status: false, message: err.message });
    if (err.code === 11000)
      return res.status(409).json({
        status: false,
        message: 'You have already submitted this feedback'
      });
    return next(err);
  }
};

const checkSubmitted = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId || req.query?.studentId);
    const formId = safeTrim(req.body?.formId || req.query?.formId);
    if (!tenantId || !studentId || !formId)
      return res.status(400).json({
        status: false,
        message: 'tenantId, studentId and formId are required'
      });
    const existing = await FeedbackResponse.findOne({ tenantId, formId, studentId, isdeleted: false }, { submittedAt: 1 }).lean();
    return res.status(200).json({
      status: true,
      submitted: !!existing,
      submittedAt: existing?.submittedAt || null
    });
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
  viewFeedbackResults,
  getActiveFormsForStudent,
  submitFeedback,
  checkSubmitted
};

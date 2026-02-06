import AssignmentQns from '../models/assingmentQns.model.js';
import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import logger from '../helpers/logger.js';
import path from 'path';
import crypto from 'crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client from '../middlewares/s3config.js';

const { ObjectId } = mongoose.Types;
const QUESTION_BUCKET = process.env.AWS_S3_QUESTION_BUCKET;
const REGION = process.env.AWS_REGION || 'ap-south-1';

function buildQuestionImageKey(originalName) {
  const ext = path.extname(originalName) || '';
  const base = path
    .basename(originalName, ext)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  const random = crypto.randomBytes(8).toString('hex');
  const ts = Date.now();
  return `questions/${base}-${ts}-${random}${ext}`;
}

function extractS3Key(input) {
  if (!input) return '';
  const raw = String(input);
  if (!raw.startsWith('http')) {
    return raw.replace(/^\/+/, '');
  }
  try {
    const url = new URL(raw);
    return url.pathname.replace(/^\/+/, '');
  } catch {
    return '';
  }
}

function safeTrim(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function toNum(v, def = 0) {
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : def;
}

function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

const ALLOWED_TYPES = new Set(['mcq_single', 'mcq_multi', 'true_false', 'short_answer', 'integer', 'subjective', 'numeric', 'passage_qns']);
const ALLOWED_DIFFICULTY = new Set(['easy', 'medium', 'hard']);

function needsOptions(qt) {
  const t = safeTrim(qt).toLowerCase();
  return t === 'mcq_single' || t === 'mcq_multi' || t === 'true_false';
}

function needsAtLeastOneCorrect(qt) {
  const t = safeTrim(qt).toLowerCase();
  return t === 'mcq_single' || t === 'true_false';
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  const out = images
    .filter((img) => img && img.url)
    .map((img, idx) => ({
      url: safeTrim(img.url),
      label: safeTrim(img.label),
      order: typeof img.order === 'number' ? img.order : typeof img.order === 'string' ? parseInt(img.order, 10) || idx : idx
    }))
    .filter((x) => x.url);

  out.sort((a, b) => (a.order || 0) - (b.order || 0));
  return out;
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((opt, idx) => ({
    key: safeTrim(opt?.key) || null,
    textHtml: opt?.textHtml === undefined || opt?.textHtml === null ? '' : String(opt.textHtml),
    images: normalizeImages(opt?.images),
    isCorrect: opt?.isCorrect === true || String(opt?.isCorrect).toLowerCase() === 'true'
  }));
}

const uploadSingleQuestionImage = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: false,
        message: 'No files uploaded.'
      });
    }
    if (!QUESTION_BUCKET) {
      return res.status(500).json({
        status: false,
        message: 'S3 bucket is not configured. Please set AWS_S3_QUESTION_BUCKET.'
      });
    }
    const baseApiUrl = `${req.protocol}://${req.get('host')}`;
    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        const key = buildQuestionImageKey(file.originalname);
        const putCmd = new PutObjectCommand({
          Bucket: QUESTION_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype
        });
        await s3Client.send(putCmd);
        const s3Url = `https://${QUESTION_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
        const downloadUrl = `${baseApiUrl}/assignmentqns/image?key=${encodeURIComponent(key)}`;
        return {
          key,
          s3Url,
          url: downloadUrl,
          fileName: file.originalname
        };
      })
    );
    return res.status(201).json({
      status: true,
      message: 'Images uploaded successfully.',
      files: uploadedFiles
    });
  } catch (err) {
    logger.error('uploadSingleQuestionImage error:', err);
    return res.status(500).json({
      status: false,
      message: err.message || 'Image upload failed.'
    });
  }
};

const getQuestionImage = async (req, res) => {
  try {
    const raw = req.query?.key || req.body?.key || req.body?.url || '';
    const key = extractS3Key(raw);
    if (!key) {
      return res.status(400).json({
        status: false,
        message: 'Missing required parameter: key'
      });
    }
    if (!QUESTION_BUCKET) {
      return res.status(500).json({
        status: false,
        message: 'S3 bucket is not configured. Please set AWS_S3_QUESTION_BUCKET.'
      });
    }
    const cmd = new GetObjectCommand({
      Bucket: QUESTION_BUCKET,
      Key: key
    });
    const signedUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 60 * 30 });
    return res.status(200).json({
      status: true,
      url: signedUrl
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || 'Failed to fetch image.'
    });
  }
};

const createQuestionsBulk = async (req, res, next) => {
  try {
    const tenantId = req.body.entiId;
    const userId = req.user?.userId || req.body?.userId || null;
    const testId = req.body.testId;
    const payload = req.body.questions;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({
        status: false,
        message: 'Request body must be a non-empty array of questions.'
      });
    }
    const incomingTriplets = payload
      .map((q) => ({
        tenantId: safeTrim(tenantId),
        testId: safeTrim(testId),
        questionId: safeTrim(q.questionId)
      }))
      .filter((x) => x.tenantId && x.testId && x.questionId);
    if (incomingTriplets.length > 0) {
      const existing = await AssignmentQns.find(
        {
          isdeleted: false,
          $or: incomingTriplets.map((x) => ({
            tenantId: tenantId,
            testId: testId,
            questionId: x.questionId
          }))
        },
        { tenantId: 1, testId: 1, questionId: 1, _id: 0 }
      ).lean();
      if (existing.length > 0) {
        return res.status(400).json({
          status: false,
          message: 'One or more questions already exist for this test.',
          conflicts: existing
        });
      }
    }
    const docsToInsert = payload.map((q) => {
      const questionId = safeTrim(q.questionId) || uuid();
      const questionType = safeTrim(q.questionType).toLowerCase();
      const difficulty = safeTrim(q.difficulty || 'medium').toLowerCase();
      return {
        tenantId,
        testId,
        questionId,
        questionType,
        difficulty,
        images: normalizeImages(q.images),
        positiveMarks: toNum(q.positiveMarks, 0),
        negativeMarks: toNum(q.negativeMarks, 0),
        questionHtml: q.questionHtml === undefined || q.questionHtml === null ? '' : String(q.questionHtml),
        passageHtml: q.passageHtml === undefined || q.passageHtml === null ? '' : String(q.passageHtml),
        instructionHtml: q.instructionHtml === undefined || q.instructionHtml === null ? '' : String(q.instructionHtml),
        questionOptions: normalizeOptions(q.questionOptions),
        solutionHtml: q.solutionHtml === undefined || q.solutionHtml === null ? '' : String(q.solutionHtml),
        enablePassage: q.enablePassage === true,
        enableInstruction: q.enableInstruction === true,
        enableSolution: q.enableSolution === true,
        correctAnswer: q.correctAnswer !== false,
        tags: Array.isArray(q.tags) ? q.tags.map((t) => safeTrim(t)).filter(Boolean) : [],
        status: q.status || 'active',
        isdeleted: false,
        createdBy: userId,
        updatedBy: userId
      };
    });
    for (let i = 0; i < docsToInsert.length; i++) {
      const d = docsToInsert[i];
      if (!d.tenantId) {
        return res.status(400).json({ status: false, message: `Row ${i + 1}: entiId (tenantId) is required.` });
      }
      if (!d.testId) {
        return res.status(400).json({ status: false, message: `Row ${i + 1}: testId is required.` });
      }
      if (!ALLOWED_TYPES.has(d.questionType)) {
        return res.status(400).json({
          status: false,
          message: `Row ${i + 1}: invalid questionType. Allowed: ${Array.from(ALLOWED_TYPES).join(', ')}`
        });
      }
      if (!ALLOWED_DIFFICULTY.has(d.difficulty)) {
        return res.status(400).json({
          status: false,
          message: `Row ${i + 1}: invalid difficulty. Allowed: easy, medium, hard`
        });
      }
      if (needsOptions(d.questionType)) {
        if (!Array.isArray(d.questionOptions) || d.questionOptions.length === 0) {
          return res.status(400).json({
            status: false,
            message: `Row ${i + 1}: questionOptions is required for mcq_single/mcq_multi/true_false.`
          });
        }
        if (needsAtLeastOneCorrect(d.questionType)) {
          const correctCount = d.questionOptions.filter((o) => o && o.isCorrect === true).length;
          if (correctCount < 1) {
            return res.status(400).json({
              status: false,
              message: `Row ${i + 1}: at least one correct option is required.`
            });
          }
        }
      }
    }
    const insertedDocs = await AssignmentQns.insertMany(docsToInsert, {
      ordered: true
    });
    return res.status(201).json({
      status: true,
      message: 'Questions created successfully.',
      insertedCount: insertedDocs.length,
      data: insertedDocs
    });
  } catch (err) {
    logger.error('createQuestionsBulk error:', err);
    return res.status(500).json({
      status: false,
      message: err.message || 'Failed to create questions.'
    });
  }
};

const listQuestionsByTopic = async (req, res) => {
  try {
    const { testId, difficulty, questionType, status } = req.body || {};
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'entiId is required.' });
    }
    if (!testId) {
      return res.status(400).json({
        status: false,
        message: 'testId is required.'
      });
    }
    const query = {
      tenantId,
      testId: safeTrim(testId),
      isdeleted: false
    };
    if (difficulty) query.difficulty = safeTrim(difficulty).toLowerCase();
    if (questionType) query.questionType = safeTrim(questionType).toLowerCase();
    if (status) query.status = safeTrim(status);
    const questions = await AssignmentQns.find(query)
      .select('tenantId testId questionId questionType difficulty images positiveMarks negativeMarks questionHtml passageHtml instructionHtml questionOptions solutionHtml enablePassage enableInstruction enableSolution correctAnswer tags status createdAt updatedAt')
      .sort({ _id: 1 })
      .lean();
    if (!questions.length) {
      return res.status(200).json({
        status: true,
        data: []
      });
    }
    return res.status(200).json({
      status: true,
      data: [
        {
          testId: safeTrim(testId),
          questions
        }
      ]
    });
  } catch (err) {
    logger.error('listQuestionsByTopic error:', err);
    return res.status(500).json({
      status: false,
      message: err.message || 'Failed to fetch questions.'
    });
  }
};

const listQuestionsByTestId = async (req, res) => {
  try {
    const { testId, difficulty, questionType, status } = req.body || {};
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'entiId is required.' });
    }
    if (!testId) {
      return res.status(400).json({
        status: false,
        message: 'testId is required.'
      });
    }
    const query = {
      tenantId,
      testId: safeTrim(testId),
      isdeleted: false
    };
    if (difficulty) query.difficulty = safeTrim(difficulty).toLowerCase();
    if (questionType) query.questionType = safeTrim(questionType).toLowerCase();
    if (status) query.status = safeTrim(status);
    const questions = await AssignmentQns.find(query)
      .select('tenantId testId questionId questionType difficulty images positiveMarks negativeMarks questionHtml passageHtml instructionHtml questionOptions solutionHtml enablePassage enableInstruction enableSolution correctAnswer tags status createdBy updatedBy createdAt updatedAt')
      .sort({ _id: 1 })
      .lean();
    if (!questions.length) {
      return res.status(200).json({
        status: true,
        data: []
      });
    }
    return res.status(200).json({
      status: true,
      data: [
        {
          testId: safeTrim(testId),
          questions
        }
      ]
    });
  } catch (err) {
    logger.error('listQuestionsByTestId error:', err);
    return res.status(500).json({
      status: false,
      message: err.message || 'Failed to fetch questions by testId.'
    });
  }
};

const bulkUpdateByTestId = async (req, res) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    const { testId } = req.body || {};
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'entiId is required.' });
    }
    if (!testId) {
      return res.status(400).json({
        status: false,
        message: 'testId is required.'
      });
    }
    const body = req.body || {};
    const userId = req.body?.userId || req.user?.userId || null;
    const allowedFields = ['difficulty', 'questionType', 'status', 'enablePassage', 'enableInstruction', 'enableSolution', 'correctAnswer', 'positiveMarks', 'negativeMarks', 'tags'];
    const updateDoc = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        if (field === 'difficulty') updateDoc.difficulty = safeTrim(body[field]).toLowerCase();
        else if (field === 'questionType') updateDoc.questionType = safeTrim(body[field]).toLowerCase();
        else if (field === 'tags') {
          updateDoc.tags = Array.isArray(body.tags) ? body.tags.map((t) => safeTrim(t)).filter(Boolean) : [];
        } else if (field === 'positiveMarks' || field === 'negativeMarks') {
          updateDoc[field] = toNum(body[field], 0);
        } else {
          updateDoc[field] = body[field];
        }
      }
    }
    if (!Object.keys(updateDoc).length) {
      return res.status(400).json({
        status: false,
        message: 'No valid fields provided to update.'
      });
    }
    updateDoc.updatedBy = userId;
    const result = await AssignmentQns.updateMany({ tenantId, testId: safeTrim(testId), isdeleted: false }, { $set: updateDoc });
    const matchedCount = result.matchedCount ?? result.n ?? 0;
    const modifiedCount = result.modifiedCount ?? result.nModified ?? 0;
    return res.status(200).json({
      status: true,
      message: 'Bulk update success.',
      testId: safeTrim(testId),
      matchedCount,
      modifiedCount
    });
  } catch (err) {
    logger.error('bulkUpdateByTestId error:', err);
    return res.status(500).json({
      status: false,
      message: err.message || 'Bulk update failed.'
    });
  }
};

const bulkSoftDeleteByTestId = async (req, res) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    const { testId } = req.params;
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'entiId is required.' });
    }
    if (!testId) {
      return res.status(400).json({
        status: false,
        message: 'testId is required.'
      });
    }
    const userId = req.user?.userId || req.body?.userId || null;
    const result = await AssignmentQns.updateMany(
      { tenantId, testId: safeTrim(testId), isdeleted: false },
      {
        $set: {
          isdeleted: true,
          status: 'inactive',
          updatedBy: userId
        }
      }
    );
    const matchedCount = result.matchedCount ?? result.n ?? 0;
    const modifiedCount = result.modifiedCount ?? result.nModified ?? 0;
    return res.status(200).json({
      status: true,
      message: 'Bulk soft delete success.',
      testId: safeTrim(testId),
      matchedCount,
      modifiedCount
    });
  } catch (err) {
    logger.error('bulkSoftDeleteByTestId error:', err);
    return res.status(500).json({
      status: false,
      message: err.message || 'Bulk delete failed.'
    });
  }
};

const listQuestionTests = async (req, res) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    const { status, testId } = req.body || {};
    const rawSearch = safeTrim(req.query?.search);
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query?.limit, 10) || 10, 1);
    const skip = (page - 1) * limit;
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'entiId is required.' });
    }
    const match = {
      tenantId,
      isdeleted: false
    };
    if (testId) {
      match.testId = safeTrim(testId);
    } else {
      match.testId = { $nin: [null, ''] };
    }
    if (status) match.status = safeTrim(status);
    if (rawSearch) {
      match.$or = [{ testId: { $regex: rawSearch, $options: 'i' } }, { questionHtml: { $regex: rawSearch, $options: 'i' } }];
    }
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            testId: '$testId',
            status: '$status',
            createdBy: '$createdBy'
          },
          questionCount: { $sum: 1 },
          createdAt: { $min: '$createdAt' },
          updatedAt: { $max: '$updatedAt' }
        }
      },
      { $sort: { updatedAt: -1 } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];
    const agg = await AssignmentQns.aggregate(pipeline);
    const rows = agg[0]?.rows || [];
    const total = agg[0]?.totalCount?.[0]?.count || 0;
    const pages = total ? Math.ceil(total / limit) : 0;
    if (!rows.length) {
      return res.status(200).json({
        status: true,
        data: [],
        pagination: { page, limit, total, pages }
      });
    }
    const data = rows
      .filter((row) => row._id?.testId)
      .map((row) => ({
        testId: row._id.testId,
        createdBy: row._id.createdBy || null,
        status: row._id.status || 'inactive',
        questionCount: row.questionCount || 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    return res.status(200).json({
      status: true,
      data,
      pagination: { page, limit, total, pages }
    });
  } catch (err) {
    logger.error('listQuestionTests error:', err);
    return res.status(500).json({
      status: false,
      message: err.message || 'Failed to list tests.'
    });
  }
};

const viewQuestion = async (req, res, next) => {
  try {
    const id = req.body.recId || null;
    if (!id) {
      return res.status(400).json({
        status: false,
        message: 'Question id is required'
      });
    }
    const question = await AssignmentQns.findOne({
      _id: id,
      isdeleted: false
    }).lean();
    if (!question) {
      return res.status(404).json({
        status: false,
        message: 'Question not found'
      });
    }
    return res.status(200).json({
      status: true,
      message: 'Request success',
      data: question
    });
  } catch (err) {
    return next(err);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const { recId, testId, questionId, questionType, difficulty, images = [], positiveMarks, negativeMarks, questionHtml, passageHtml, instructionHtml, questionOptions = [], solutionHtml, enablePassage, enableInstruction, enableSolution, correctAnswer, tags, status } = req.body || {};
    if (!recId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({ status: false, message: 'recId is required' });
    }
    const existing = await AssignmentQns.findOne({ _id: recId, isdeleted: false });
    if (!existing) {
      return res.status(constants.HTTPS_NOT_FOUND || 404).json({ status: false, message: 'Question not found' });
    }
    const update = {};
    if (typeof testId === 'string' && safeTrim(testId) !== '') update.testId = safeTrim(testId);
    if (typeof questionId === 'string' && safeTrim(questionId) !== '') update.questionId = safeTrim(questionId);
    if (typeof questionType === 'string' && safeTrim(questionType) !== '') {
      const qt = safeTrim(questionType).toLowerCase();
      if (!ALLOWED_TYPES.has(qt)) {
        return res.status(400).json({
          status: false,
          message: `Invalid questionType. Allowed: ${Array.from(ALLOWED_TYPES).join(', ')}`
        });
      }
      update.questionType = qt;
    }
    if (typeof difficulty === 'string' && safeTrim(difficulty) !== '') {
      const df = safeTrim(difficulty).toLowerCase();
      if (!ALLOWED_DIFFICULTY.has(df)) {
        return res.status(400).json({
          status: false,
          message: 'Invalid difficulty. Allowed: easy, medium, hard'
        });
      }
      update.difficulty = df;
    }
    if (positiveMarks !== undefined) update.positiveMarks = toNum(positiveMarks, 0);
    if (negativeMarks !== undefined) update.negativeMarks = toNum(negativeMarks, 0);
    if (typeof questionHtml === 'string') update.questionHtml = questionHtml;
    if (typeof passageHtml === 'string') update.passageHtml = passageHtml;
    if (typeof instructionHtml === 'string') update.instructionHtml = instructionHtml;
    if (typeof solutionHtml === 'string') update.solutionHtml = solutionHtml;
    if (Array.isArray(images)) update.images = normalizeImages(images);
    if (Array.isArray(questionOptions)) update.questionOptions = normalizeOptions(questionOptions);
    if (enablePassage !== undefined) update.enablePassage = enablePassage === true;
    if (enableInstruction !== undefined) update.enableInstruction = enableInstruction === true;
    if (enableSolution !== undefined) update.enableSolution = enableSolution === true;
    if (correctAnswer !== undefined) update.correctAnswer = correctAnswer !== false;
    if (tags !== undefined) {
      update.tags = Array.isArray(tags) ? tags.map((t) => safeTrim(t)).filter(Boolean) : [];
    }
    if (typeof status === 'string' && safeTrim(status) !== '') update.status = safeTrim(status);
    const finalType = safeTrim(update.questionType || existing.questionType).toLowerCase();
    const finalOptions = update.questionOptions || existing.questionOptions || [];
    if (needsOptions(finalType)) {
      if (!Array.isArray(finalOptions) || finalOptions.length === 0) {
        return res.status(400).json({
          status: false,
          message: 'questionOptions is required for mcq_single/mcq_multi/true_false'
        });
      }
      if (needsAtLeastOneCorrect(finalType)) {
        const correctCount = finalOptions.filter((o) => o && o.isCorrect === true).length;
        if (correctCount < 1) {
          return res.status(400).json({
            status: false,
            message: 'At least one correct option is required'
          });
        }
      }
    }
    update.updatedBy = String(req.body.userId || req.user?.userId || '');
    const updated = await AssignmentQns.findOneAndUpdate({ _id: recId, isdeleted: false }, { $set: update }, { new: true }).lean();
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Question updated successfully',
      data: updated
    });
  } catch (err) {
    logger.error('updateQuestion error:', err);
    return next(err);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const recId = req.body?.recId || null;
    if (!recId) {
      return res.status(400).json({ status: false, message: 'recId is required' });
    }
    const userId = req.user?.userId || req.body?.userId || null;
    const updated = await AssignmentQns.findOneAndUpdate({ _id: recId, isdeleted: false }, { $set: { isdeleted: true, status: 'inactive', updatedBy: userId } }, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ status: false, message: 'Question not found or already deleted' });
    }
    return res.status(200).json({
      status: true,
      message: 'Question deleted successfully.',
      data: updated
    });
  } catch (err) {
    logger.error('deleteQuestion error:', err);
    return next(err);
  }
};

const createQuestion = async (req, res, next) => {
  try {
    const {
      entiId,
      tenantId,
      testId,
      questionId,
      questionType,
      difficulty,
      images = [],
      positiveMarks,
      negativeMarks,
      questionHtml,
      passageHtml,
      instructionHtml,
      questionOptions = [],
      solutionHtml,
      enablePassage,
      enableInstruction,
      enableSolution,
      correctAnswer,
      tags = [],
      status
    } = req.body || {};
    const finalTenantId = safeTrim(entiId || tenantId);
    const userId = req.user?.userId || req.body?.userId || null;
    if (!finalTenantId) {
      return res.status(400).json({
        status: false,
        message: 'entiId (tenantId) is required'
      });
    }
    if (!testId) {
      return res.status(400).json({
        status: false,
        message: 'testId is required'
      });
    }
    if (!questionType) {
      return res.status(400).json({
        status: false,
        message: 'questionType is required'
      });
    }
    const qt = safeTrim(questionType).toLowerCase();
    if (!ALLOWED_TYPES.has(qt)) {
      return res.status(400).json({
        status: false,
        message: `Invalid questionType. Allowed: ${Array.from(ALLOWED_TYPES).join(', ')}`
      });
    }
    const diff = safeTrim(difficulty || 'medium').toLowerCase();
    if (!ALLOWED_DIFFICULTY.has(diff)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid difficulty. Allowed: easy, medium, hard'
      });
    }
    const normalizedOptions = normalizeOptions(questionOptions);
    if (needsOptions(qt)) {
      if (!normalizedOptions.length) {
        return res.status(400).json({
          status: false,
          message: 'questionOptions is required for mcq_single / mcq_multi / true_false'
        });
      }
      if (needsAtLeastOneCorrect(qt)) {
        const correctCount = normalizedOptions.filter((o) => o.isCorrect === true).length;
        if (correctCount < 1) {
          return res.status(400).json({
            status: false,
            message: 'At least one correct option is required'
          });
        }
      }
    }
    const doc = {
      tenantId: finalTenantId,
      testId: safeTrim(testId),
      questionId: safeTrim(questionId) || uuid(),
      questionType: qt,
      difficulty: diff,
      images: normalizeImages(images),
      positiveMarks: toNum(positiveMarks, 0),
      negativeMarks: toNum(negativeMarks, 0),
      questionHtml: questionHtml ?? '',
      passageHtml: passageHtml ?? '',
      instructionHtml: instructionHtml ?? '',
      questionOptions: normalizedOptions,
      solutionHtml: solutionHtml ?? '',
      enablePassage: enablePassage === true,
      enableInstruction: enableInstruction === true,
      enableSolution: enableSolution === true,
      correctAnswer: correctAnswer !== false,
      tags: Array.isArray(tags) ? tags.map((t) => safeTrim(t)).filter(Boolean) : [],
      status: status || 'active',
      isdeleted: false,
      createdBy: userId,
      updatedBy: userId
    };
    const created = await AssignmentQns.create(doc);
    return res.status(constants.HTTPS_SUCCESS || 201).json({
      status: true,
      message: 'Question created successfully',
      data: created
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        status: false,
        message: 'Duplicate question (tenantId + testId + questionId already exists)'
      });
    }
    logger.error('createQuestion error:', err);
    return next(err);
  }
};

export default {
  uploadSingleQuestionImage,
  getQuestionImage,
  createQuestionsBulk,
  listQuestionsByTopic,
  listQuestionsByTestId,
  bulkUpdateByTestId,
  bulkSoftDeleteByTestId,
  listQuestionTests,
  viewQuestion,
  updateQuestion,
  deleteQuestion,
  createQuestion
};

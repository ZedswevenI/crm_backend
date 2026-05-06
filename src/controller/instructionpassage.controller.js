import crypto from 'crypto';
import path from 'path';
import logger from '../helpers/logger.js';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client from '../middlewares/s3config.js';
import ExamInstruction from '../models/mockExamInstruction.model.js';
import ExamPassage from '../models/passage.model.js';

const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const pickTid = (req) => safeTrim(req.body?.entiId || req.body?.tenantId);
const pickUid = (req) => safeTrim(req.body?.userId || req.user?.userId);
const uuid = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));

const BUCKET = process.env.AWS_S3_QUESTION_BUCKET;
const REGION = process.env.AWS_REGION || 'ap-south-1';
function buildImageKeypass(name) {
  const ext = path.extname(name) || '';
  const base = path
    .basename(name, ext)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  return `mockexam/questions/${base}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
}

function buildImageKeyInst(name) {
  const ext = path.extname(name) || '';
  const base = path
    .basename(name, ext)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  return `mockexam/questions/${base}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
}

// ─── UPLOAD IMAGE ─────────────────────────────────────────────────────────────
const uploadImageInstruction = async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ status: false, message: 'No files uploaded' });
    if (!BUCKET) return res.status(500).json({ status: false, message: 'S3 bucket not configured' });
    const base = `${req.protocol}://${req.get('host')}`;
    const files = await Promise.all(
      req.files.map(async (f) => {
        const key = buildImageKeyInst(f.originalname);
        await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: f.buffer, ContentType: f.mimetype }));
        return { key, s3Url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`, url: `${base}/mockexamqns/image?key=${encodeURIComponent(key)}`, fileName: f.originalname };
      })
    );
    return res.status(201).json({ status: true, message: 'Images uploaded successfully', files });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message || 'Upload failed' });
  }
};

// ─── UPLOAD IMAGE ─────────────────────────────────────────────────────────────
const uploadImagePassage = async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ status: false, message: 'No files uploaded' });
    if (!BUCKET) return res.status(500).json({ status: false, message: 'S3 bucket not configured' });
    const base = `${req.protocol}://${req.get('host')}`;
    const files = await Promise.all(
      req.files.map(async (f) => {
        const key = buildImageKeypass(f.originalname);
        await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: f.buffer, ContentType: f.mimetype }));
        return { key, s3Url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`, url: `${base}/mockexamqns/image?key=${encodeURIComponent(key)}`, fileName: f.originalname };
      })
    );
    return res.status(201).json({ status: true, message: 'Images uploaded successfully', files });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message || 'Upload failed' });
  }
};

const createInstruction = async (req, res, next) => {
  try {
    console.log(req.body);
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    console.log('userId ', userId);
    const title = safeTrim(req.body?.title);
    const contentHtml = req.body?.contentHtml ?? '';
    const language = safeTrim(req.body?.language) || 'en';
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!title) return res.status(400).json({ status: false, message: 'title is required' });
    const doc = await ExamInstruction.create({
      tenantId,
      instructionId: uuid(),
      title,
      contentHtml,
      language,
      status: 'active',
      createdBy: userId || null,
      updatedBy: userId || null,
      isdeleted: false
    });
    return res.status(201).json({ status: true, message: 'Instruction created successfully', data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate instructionId' });
    return next(err);
  }
};

const updateInstruction = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const recId = safeTrim(req.body?.recId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const set = {};
    if (req.body?.title !== undefined) {
      const v = safeTrim(req.body.title);
      if (v) set.title = v;
    }
    if (req.body?.contentHtml !== undefined) set.contentHtml = req.body.contentHtml;
    if (req.body?.language !== undefined) {
      const v = safeTrim(req.body.language);
      if (v) set.language = v;
    }
    if (req.body?.status !== undefined) {
      const v = safeTrim(req.body.status);
      if (v) set.status = v;
    }
    if (!Object.keys(set).length) return res.status(400).json({ status: false, message: 'No fields to update' });
    set.updatedBy = userId || null;
    const updated = await ExamInstruction.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: set }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Instruction not found' });
    return res.status(200).json({ status: true, message: 'Instruction updated successfully', data: updated });
  } catch (err) {
    return next(err);
  }
};

const listInstructions = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const listAll = String(req.query.list || '').toLowerCase() === 'full';

    const query = { tenantId, isdeleted: false };
    if (req.query.status) query.status = safeTrim(req.query.status);
    if (req.query.language) query.language = safeTrim(req.query.language);
    if (req.query.search) {
      query.title = { $regex: safeTrim(req.query.search), $options: 'i' };
    }

    let rows, count;
    if (listAll) {
      rows = await ExamInstruction.find(query).sort('-createdAt').lean();
      count = rows.length;
    } else {
      [rows, count] = await Promise.all([ExamInstruction.find(query).sort('-createdAt').skip(skip).limit(limit).lean(), ExamInstruction.countDocuments(query)]);
    }

    return res.status(200).json({ status: true, message: 'Instructions loaded', data: rows, count, ...(listAll ? {} : { page, limit }) });
  } catch (err) {
    return next(err);
  }
};

const deleteInstruction = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const recId = safeTrim(req.body?.recId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const doc = await ExamInstruction.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Instruction not found or already deleted' });

    return res.status(200).json({ status: true, message: 'Instruction deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXAM PASSAGE CRUD
// ═══════════════════════════════════════════════════════════════════════════════

const createPassage = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const title = safeTrim(req.body?.title);
    const passageHtml = req.body?.passageHtml ?? '';
    const language = safeTrim(req.body?.language) || 'en';
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(safeTrim).filter(Boolean) : [];

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!title) return res.status(400).json({ status: false, message: 'title is required' });
    if (!passageHtml) return res.status(400).json({ status: false, message: 'passageHtml is required' });

    const doc = await ExamPassage.create({
      tenantId,
      passageId: uuid(),
      title,
      passageHtml,
      language,
      tags,
      status: 'active',
      createdBy: userId || null,
      updatedBy: null,
      isdeleted: false
    });

    return res.status(201).json({ status: true, message: 'Passage created successfully', data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate passageId' });
    return next(err);
  }
};

const updatePassage = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const recId = safeTrim(req.body?.recId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const set = {};
    if (req.body?.title !== undefined) {
      const v = safeTrim(req.body.title);
      if (v) set.title = v;
    }
    if (req.body?.passageHtml !== undefined) set.passageHtml = req.body.passageHtml;
    if (req.body?.language !== undefined) {
      const v = safeTrim(req.body.language);
      if (v) set.language = v;
    }
    if (req.body?.status !== undefined) {
      const v = safeTrim(req.body.status);
      if (v) set.status = v;
    }
    if (Array.isArray(req.body?.tags)) set.tags = req.body.tags.map(safeTrim).filter(Boolean);

    if (!Object.keys(set).length) return res.status(400).json({ status: false, message: 'No fields to update' });
    set.updatedBy = userId || null;

    const updated = await ExamPassage.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: set }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Passage not found' });

    return res.status(200).json({ status: true, message: 'Passage updated successfully', data: updated });
  } catch (err) {
    return next(err);
  }
};

const listPassages = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const listAll = String(req.query.list || '').toLowerCase() === 'full';

    const query = { tenantId, isdeleted: false };
    if (req.query.status) query.status = safeTrim(req.query.status);
    if (req.query.language) query.language = safeTrim(req.query.language);
    if (req.query.tag) query.tags = safeTrim(req.query.tag);
    if (req.query.search) {
      query.title = { $regex: safeTrim(req.query.search), $options: 'i' };
    }

    let rows, count;
    if (listAll) {
      rows = await ExamPassage.find(query).sort('-createdAt').lean();
      count = rows.length;
    } else {
      [rows, count] = await Promise.all([ExamPassage.find(query).sort('-createdAt').skip(skip).limit(limit).lean(), ExamPassage.countDocuments(query)]);
    }

    return res.status(200).json({ status: true, message: 'Passages loaded', data: rows, count, ...(listAll ? {} : { page, limit }) });
  } catch (err) {
    return next(err);
  }
};

const deletePassage = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const recId = safeTrim(req.body?.recId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const doc = await ExamPassage.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Passage not found or already deleted' });

    return res.status(200).json({ status: true, message: 'Passage deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

export const instructionController = { createInstruction, updateInstruction, listInstructions, deleteInstruction, uploadImageInstruction };
export const passageController = { createPassage, updatePassage, listPassages, deletePassage, uploadImagePassage };

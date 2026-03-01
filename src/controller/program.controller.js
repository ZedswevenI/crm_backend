import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import constants from '../helpers/constants.js';
import Program from '../models/program.model.js';
import ExamCategory from '../models/examcategory.model.js';
import ExamSubCategory from '../models/examsubcategory.model.js';
import PTM from '../models/ptm.model.js';
import StudentProfile from '../models/studentProfile.model.js';

const pickTenantId = (req) => (req.body?.entiId || req.body?.tenantId || '').toString().trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

const normalizeSubjects = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = safeTrim(v);
  if (!s) return [];
  return s
    .split(',')
    .map((x) => String(x || '').trim())
    .filter(Boolean);
};

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const parseDateTimeToEpoch = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const dtString = timeStr && timeStr !== 'NULL' ? `${dateStr} ${timeStr}` : `${dateStr} 00:00:00`;
  const parsed = new Date(dtString).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const createProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const eligibleToClass = toNum(payload.eligibleToClass);
    const startingClass = toNum(payload.startingClass);
    const duration = toNum(payload.duration);
    const subjects = normalizeSubjects(payload.subjects);
    const badSub = subjects.find((x) => !isValidObjectId(x));
    if (badSub) return res.status(400).json({ status: false, message: 'Invalid subject id in subjects' });
    const doc = await Program.create({
      tenantId,
      eligibleToClass,
      startingClass,
      duration,
      programName: safeTrim(payload.programName),
      programCodes: safeTrim(payload.programCodes),
      target: payload.target ? safeTrim(payload.target) : null,
      version: safeTrim(payload.version),
      programType: payload.programType ? safeTrim(payload.programType) : null,
      excelId: payload.excelId ?? null,
      subjects,
      status: payload.status || 'Active',
      isdeleted: false
    });
    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Program created successfully',
      data: doc
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const viewProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const doc = await Program.findOne({ _id: recId, tenantId, isdeleted: false }).populate('subjects', 'subjectName subjectCode');
    if (!doc) return res.status(404).json({ status: false, message: 'Program not found' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const payload = req.body || {};
    const updateDoc = {};
    if (payload.eligibleToClass !== undefined) updateDoc.eligibleToClass = toNum(payload.eligibleToClass);
    if (payload.startingClass !== undefined) updateDoc.startingClass = toNum(payload.startingClass);
    if (payload.duration !== undefined) updateDoc.duration = toNum(payload.duration);
    if (payload.programName !== undefined) updateDoc.programName = safeTrim(payload.programName);
    if (payload.programCodes !== undefined) updateDoc.programCodes = safeTrim(payload.programCodes);
    if (payload.target !== undefined) updateDoc.target = payload.target ? safeTrim(payload.target) : null;
    if (payload.version !== undefined) updateDoc.version = safeTrim(payload.version);
    if (payload.programType !== undefined) updateDoc.programType = payload.programType ? safeTrim(payload.programType) : null;
    if (payload.excelId !== undefined) updateDoc.excelId = payload.excelId ?? null;
    if (payload.status !== undefined) updateDoc.status = payload.status;
    if (payload.subjects !== undefined) {
      const subjects = normalizeSubjects(payload.subjects);
      const badSub = subjects.find((x) => !isValidObjectId(x));
      if (badSub) return res.status(400).json({ status: false, message: 'Invalid subject id in subjects' });
      updateDoc.subjects = subjects;
    }
    if (!Object.keys(updateDoc).length) {
      return res.status(400).json({ status: false, message: 'No fields to update' });
    }
    const updated = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ status: false, message: 'Program not found or already deleted' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program updated successfully',
      data: updated
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const deleteProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const deleted = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true });
    if (!deleted) return res.status(404).json({ status: false, message: 'Program not found or already deleted' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program deleted successfully',
      data: deleted
    });
  } catch (err) {
    return next(err);
  }
};

const listPrograms = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required in body' });
    const listType = req.query.list;
    const sort = req.query.sort || '-createdAt';
    const search = safeTrim(req.query.search);
    const eligibleToClass = safeTrim(req.query.eligibleToClass);
    const startingClass = safeTrim(req.query.startingClass);
    const endingClass = safeTrim(req.query.endingClass);
    const duration = safeTrim(req.query.duration);
    const status = safeTrim(req.query.status);
    const target = safeTrim(req.query.target);
    const query = { tenantId, isdeleted: false };
    if (eligibleToClass) query.eligibleToClass = toNum(eligibleToClass);
    if (startingClass) query.startingClass = toNum(startingClass);
    if (endingClass) query.endingClass = toNum(endingClass);
    if (duration) query.duration = toNum(duration);
    if (status) query.status = status;
    if (target) query.target = target;
    if (search) {
      query.$or = [{ programName: { $regex: search, $options: 'i' } }, { programType: { $regex: search, $options: 'i' } }, { target: { $regex: search, $options: 'i' } }, { programCodes: { $regex: search, $options: 'i' } }, { version: { $regex: search, $options: 'i' } }];
    }
    let data;
    let count;
    let page;
    if (listType === 'full') {
      data = await Program.find(query).sort('createdAt');
      count = data.length;
    } else {
      page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;
      count = await Program.countDocuments(query);
      data = await Program.find(query).sort(sort).skip(skip).limit(limit);
    }
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program list retrieved successfully',
      data,
      page,
      count
    });
  } catch (err) {
    return next(err);
  }
};

const addProgramSubjects = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = safeTrim(req.body?.recId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const subjects = normalizeSubjects(req.body?.subjects);
    const badSub = subjects.find((x) => !isValidObjectId(x));
    if (badSub) return res.status(400).json({ status: false, message: 'Invalid subject id in subjects' });
    const updated = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $addToSet: { subjects: { $each: subjects } } }, { new: true });
    if (!updated) return res.status(404).json({ status: false, message: 'Program not found' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Subjects added to program',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const importPrograms = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const mode = safeTrim(payload.mode || 'insert').toLowerCase();
    if (!rows.length) {
      return res.status(400).json({ status: false, message: 'rows must be a non-empty array' });
    }
    const docs = [];
    const rowErrors = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const programName = safeTrim(r.programName);
      const programCodes = safeTrim(r.programCodes);
      const version = safeTrim(r.version);
      const eligibleToClass = toNum(r.eligibleToClass);
      const startingClass = toNum(r.startingClass);
      const duration = toNum(r.duration);
      const endingClass = toNum(r.endingClass);
      if (!programName || !programCodes || !version || !eligibleToClass || !startingClass || !duration) {
        rowErrors.push({
          row: i + 1,
          message: 'programName, programCodes, version, eligibleToClass, startingClass, duration are required'
        });
        continue;
      }
      const subjects = normalizeSubjects(r.subjects);
      const badSub = subjects.find((x) => !isValidObjectId(x));
      if (badSub) {
        rowErrors.push({ row: i + 1, message: 'Invalid subject id in subjects' });
        continue;
      }
      docs.push({
        tenantId,
        excelId: r.excelId ?? null,
        programName,
        programCodes,
        eligibleToClass,
        endingClass,
        startingClass,
        duration,
        target: r.target ? safeTrim(r.target) : null,
        version,
        programType: r.programType ? safeTrim(r.programType) : null,
        subjects,
        status: r.status ? safeTrim(r.status) : 'Active',
        isdeleted: false
      });
    }

    if (!docs.length) {
      return res.status(400).json({ status: false, message: 'No valid rows to import', rowErrors });
    }

    if (mode === 'upsert') {
      const ops = docs.map((d) => ({
        updateOne: {
          filter: {
            tenantId: d.tenantId,
            eligibleToClass: d.eligibleToClass,
            programName: d.programName,
            version: d.version,
            isdeleted: false
          },
          update: { $set: d },
          upsert: true
        }
      }));

      const result = await Program.bulkWrite(ops, { ordered: false });

      return res.status(constants.HTTPS_SUCCESS || 200).json({
        status: true,
        message: 'Program import completed (upsert)',
        rowErrors,
        summary: {
          received: rows.length,
          valid: docs.length,
          upserted: result.upsertedCount || 0,
          modified: result.modifiedCount || 0,
          matched: result.matchedCount || 0
        }
      });
    }

    let inserted = [];
    let insertErrs = [];

    try {
      inserted = await Program.insertMany(docs, { ordered: false });
    } catch (e) {
      inserted = e?.insertedDocs || [];
      insertErrs = Array.isArray(e?.writeErrors)
        ? e.writeErrors.map((we) => ({
            index: we.index,
            code: we.code,
            message: we.errmsg || we.message
          }))
        : [{ message: e?.message || 'Bulk insert error' }];
    }

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program import completed (insert)',
      rowErrors,
      summary: {
        received: rows.length,
        valid: docs.length,
        inserted: inserted.length,
        failed: insertErrs.length
      },
      insertErrors: insertErrs
    });
  } catch (err) {
    return next(err);
  }
};

const updateProgramExamMappings = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = safeTrim(req.body?.recId);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows is required (non-empty array)' });
    const prog = await Program.findOne({ _id: recId, tenantId, isdeleted: false }, { _id: 1 }).lean();
    if (!prog) return res.status(404).json({ status: false, message: 'Program not found' });
    const map = new Map();
    for (const r of rows) {
      const categoryId = safeTrim(r?.categoryId);
      const subCategoryId = safeTrim(r?.subCategoryId);
      if (!categoryId || !subCategoryId) continue;
      const key = `${categoryId}__${subCategoryId}`;
      if (!map.has(key)) {
        const so = toNum(r?.sortOrder);
        map.set(key, {
          categoryId,
          subCategoryId,
          sortOrder: Number.isFinite(so) ? so : 0
        });
      }
    }
    let cleanRows = Array.from(map.values());
    if (!cleanRows.length) {
      return res.status(400).json({ status: false, message: 'No valid rows (categoryId/subCategoryId missing)' });
    }
    const categoryIds = Array.from(new Set(cleanRows.map((x) => x.categoryId)));
    const subCategoryIds = Array.from(new Set(cleanRows.map((x) => x.subCategoryId)));
    const cats = await ExamCategory.find({ tenantId, categoryId: { $in: categoryIds }, isdeleted: false }, { _id: 0, categoryId: 1 }).lean();
    const catSet = new Set((cats || []).map((x) => String(x.categoryId)));
    const subs = await ExamSubCategory.find({ tenantId, subCategoryId: { $in: subCategoryIds }, isdeleted: false }, { _id: 0, subCategoryId: 1, categoryId: 1 }).lean();
    const subMap = new Map((subs || []).map((x) => [String(x.subCategoryId), String(x.categoryId)]));
    const bad = [];
    for (const r of cleanRows) {
      if (!catSet.has(r.categoryId)) bad.push({ row: r, reason: 'Invalid categoryId' });
      const belongsCat = subMap.get(r.subCategoryId);
      if (!belongsCat) bad.push({ row: r, reason: 'Invalid subCategoryId' });
      else if (belongsCat !== r.categoryId) bad.push({ row: r, reason: 'Sub-category does not belong to category' });
    }
    if (bad.length) {
      return res.status(400).json({
        status: false,
        message: 'Invalid exam mapping rows',
        data: bad.slice(0, 20)
      });
    }
    cleanRows.sort((a, b) => {
      const as = Number.isFinite(a.sortOrder) && a.sortOrder > 0 ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const bs = Number.isFinite(b.sortOrder) && b.sortOrder > 0 ? b.sortOrder : Number.MAX_SAFE_INTEGER;
      if (as !== bs) return as - bs;
      const ak = `${a.categoryId}__${a.subCategoryId}`;
      const bk = `${b.categoryId}__${b.subCategoryId}`;
      return ak.localeCompare(bk);
    });
    cleanRows = cleanRows.map((r, idx) => ({ ...r, sortOrder: idx + 1 }));
    const updated = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { examMappings: cleanRows, updatedBy: userId || null } }, { new: true, runValidators: true }).lean();
    return res.status(200).json({
      status: true,
      message: 'Program exam mappings updated',
      data: {
        recId,
        count: updated?.examMappings?.length || 0,
        examMappings: updated?.examMappings || []
      }
    });
  } catch (err) {
    return next(err);
  }
};

const schedulePTM = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { scope, targetIds, ptmDate, startTime, endTime, durationMins, content, venue, meetingMode } = req.body;
    if (!tenantId || !scope || !Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ status: false, message: 'Invalid scope or targetIds' });
    }
    if (!ptmDate || !startTime || !endTime) {
      return res.status(400).json({ status: false, message: 'ptmDate, startTime, and endTime are required (in Epoch ms)' });
    }
    const studentQuery = { tenantId, status: 'ACTIVE', isdeleted: false };
    if (scope === 'CENTER') studentQuery.centerCode = { $in: targetIds };
    else if (scope === 'PROGRAM') studentQuery.programCode = { $in: targetIds };
    else if (scope === 'BATCH') studentQuery.batchCode = { $in: targetIds };
    else if (scope === 'STUDENT') studentQuery.studentId = { $in: targetIds };
    else return res.status(400).json({ status: false, message: 'Invalid scope' });
    const students = await StudentProfile.find(studentQuery).lean();
    if (!students.length) {
      return res.status(404).json({ status: false, message: 'No active students found for the given scope' });
    }
    const bulkOps = students.map((st) => ({
      updateOne: {
        filter: { tenantId, admissionNo: st.admissionNo, startTime: Number(startTime), isdeleted: false },
        update: {
          $setOnInsert: {
            ptmId: uuid(),
            studentId: st.studentId,
            studentName: st.student?.name || 'Unknown',
            centerCode: st.centerCode,
            programCode: st.programCode,
            batchCode: st.batchCode,
            createdBy: userId
          },
          $set: {
            ptmDate: Number(ptmDate),
            endTime: Number(endTime),
            durationMins: toInt(durationMins, 15),
            content: safeTrim(content),
            venue: safeTrim(venue),
            meetingMode: safeTrim(meetingMode) || 'OFFLINE',
            status: 'SCHEDULED',
            updatedBy: userId
          }
        },
        upsert: true
      }
    }));
    await PTM.bulkWrite(bulkOps, { ordered: false });
    return res.status(201).json({ status: true, message: `Successfully scheduled PTM for ${students.length} student(s).` });
  } catch (err) {
    return next(err);
  }
};

const bulkImportSchedule = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const rows = req.body?.rows;
    if (!tenantId || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ status: false, message: 'tenantId and rows array are required' });
    }
    const enos = rows.map((r) => safeTrim(r.Eno)).filter(Boolean);
    const students = await StudentProfile.find({ tenantId, admissionNo: { $in: enos }, isdeleted: false }).lean();
    const studentMap = new Map(students.map((st) => [st.admissionNo, st]));
    const bulkOps = [];
    const report = { successCount: 0, failedCount: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const eno = safeTrim(r.Eno);
      const st = studentMap.get(eno);
      if (!st) {
        report.failedCount++;
        report.errors.push({ row: i + 1, Eno: eno, reason: 'Student not found or inactive' });
        continue;
      }
      const ptmDateMs = parseDateTimeToEpoch(r['PTM Date'], null) || Number(r['PTM Date']);
      const startMs = parseDateTimeToEpoch(r['PTM Date'], r['PTM Start Time']) || Number(r['PTM Start Time']);
      const endMs = parseDateTimeToEpoch(r['PTM Date'], r['PTM End Time']) || Number(r['PTM End Time']);
      if (!ptmDateMs || !startMs) {
        report.failedCount++;
        report.errors.push({ row: i + 1, Eno: eno, reason: 'Invalid Date/Time formats' });
        continue;
      }
      bulkOps.push({
        updateOne: {
          filter: { tenantId, admissionNo: eno, startTime: startMs, isdeleted: false },
          update: {
            $setOnInsert: {
              ptmId: uuid(),
              studentId: st.studentId,
              studentName: safeTrim(r['Student Name']) || st.student?.name,
              centerCode: safeTrim(r.CCode) || st.centerCode,
              batchCode: safeTrim(r['Batch Code']) || st.batchCode,
              createdBy: userId
            },
            $set: {
              ptmDate: ptmDateMs,
              endTime: endMs,
              durationMins: toInt(r.Duration, 15),
              content: safeTrim(r.Content) !== 'NULL' ? safeTrim(r.Content) : null,
              venue: safeTrim(r.Venue) !== 'NULL' ? safeTrim(r.Venue) : null,
              status: 'SCHEDULED',
              updatedBy: userId
            }
          },
          upsert: true
        }
      });
      report.successCount++;
    }
    if (bulkOps.length > 0) await PTM.bulkWrite(bulkOps, { ordered: false });
    return res.status(200).json({ status: true, message: `Schedule import processed. Success: ${report.successCount}, Failed: ${report.failedCount}`, data: report });
  } catch (err) {
    return next(err);
  }
};

const submitPrePTMFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { ptmId, prePtmFeedback } = req.body;
    if (!tenantId || !ptmId || !prePtmFeedback) {
      return res.status(400).json({ status: false, message: 'Missing required fields' });
    }
    const updated = await PTM.findOneAndUpdate({ tenantId, ptmId, isdeleted: false }, { $set: { prePtmFeedback: safeTrim(prePtmFeedback), prePtmSubmittedAt: Date.now() } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'PTM not found' });
    return res.status(200).json({ status: true, message: 'Pre-PTM feedback submitted', data: updated });
  } catch (err) {
    return next(err);
  }
};

const submitStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const staffId = safeTrim(req.body?.userId);
    const { ptmId, staffRemarks, status } = req.body;
    if (!tenantId || !ptmId || !status) {
      return res.status(400).json({ status: false, message: 'tenantId, ptmId, and status are required' });
    }
    const updated = await PTM.findOneAndUpdate(
      { tenantId, ptmId, isdeleted: false },
      {
        $set: {
          staffRemarks: safeTrim(staffRemarks),
          status: safeTrim(status),
          staffId,
          staffFeedbackSubmittedAt: Date.now(),
          updatedBy: staffId
        }
      },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'PTM not found' });
    return res.status(200).json({ status: true, message: 'Staff feedback saved', data: updated });
  } catch (err) {
    return next(err);
  }
};

const bulkImportFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const staffId = safeTrim(req.body?.userId);
    const rows = req.body?.rows;
    if (!tenantId || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ status: false, message: 'tenantId and rows array are required' });
    }
    const bulkOps = [];
    const report = { successCount: 0, failedCount: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const eno = safeTrim(r.Eno);
      const ptmDateMs = parseDateTimeToEpoch(r['PTM Date'], null) || Number(r['PTM Date']);
      if (!eno || !ptmDateMs) {
        report.failedCount++;
        report.errors.push({ row: i + 1, reason: 'Missing Eno or PTM Date' });
        continue;
      }
      bulkOps.push({
        updateOne: {
          filter: { tenantId, admissionNo: eno, ptmDate: ptmDateMs, isdeleted: false },
          update: {
            $set: {
              staffRemarks: safeTrim(r['Staff Remarks']),
              status: safeTrim(r.Status) || 'COMPLETED',
              staffId,
              staffFeedbackSubmittedAt: Date.now(),
              updatedBy: staffId
            }
          }
        }
      });
      report.successCount++;
    }
    if (bulkOps.length > 0) await PTM.bulkWrite(bulkOps, { ordered: false });
    return res.status(200).json({
      status: true,
      message: `Feedback import processed. Sent ${report.successCount} updates.`,
      data: report
    });
  } catch (err) {
    return next(err);
  }
};

const listPTMs = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const page = parseInt(req.query.page || req.body.page, 10) || 1;
    const limit = parseInt(req.query.limit || req.body.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || req.body.sort || '-ptmDate';
    const centerCode = req.query.centerCode;
    const batchCode = req.query.batchCode;
    const admissionNo = req.query.admissionNo;
    const studentId = req.query.studentId;
    const status = req.query.status;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const query = { tenantId, isdeleted: false };
    if (centerCode) query.centerCode = safeTrim(centerCode);
    if (batchCode) query.batchCode = safeTrim(batchCode);
    if (admissionNo) query.admissionNo = safeTrim(admissionNo);
    if (studentId) query.studentId = safeTrim(studentId);
    if (status) query.status = safeTrim(status);
    if (fromDate || toDate) {
      query.ptmDate = {};
      if (fromDate) query.ptmDate.$gte = Number(fromDate);
      if (toDate) query.ptmDate.$lte = Number(toDate);
    }
    const [rows, count] = await Promise.all([
      PTM.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'studentId',
          model: 'studentprofile',
          localField: 'studentId',
          foreignField: 'studentId',
          select: 'admissionNo student.name student.phone parentName parentPhone'
        })
        .populate({
          path: 'studentId',
          model: 'studentprofile',
          localField: 'studentId',
          foreignField: 'studentId',
          select: 'admissionNo student.name student.phone parentName parentPhone'
        })
        .lean(),
      PTM.countDocuments(query)
    ]);
    return res.status(200).json({
      status: true,
      data: rows,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0,
      message: 'PTMs retrieved'
    });
  } catch (err) {
    next(err);
  }
};

const viewPTM = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const ptmId = safeTrim(req.body?.ptmId || req.query?.ptmId);
    if (!tenantId || !ptmId) {
      return res.status(400).json({ status: false, message: 'tenantId and ptmId are required' });
    }
    const ptmRecord = await PTM.findOne({ tenantId, ptmId, isdeleted: false })
      .populate({
        path: 'studentId',
        model: 'studentprofile',
        localField: 'studentId',
        foreignField: 'studentId',
        select: 'admissionNo student.name student.phone parentName parentPhone'
      })
      .populate({
        path: 'staffId',
        localField: 'staffId',
        foreignField: 'staffId',
        model: 'staff',
        justOne: true,
        select: 'staffName staffCode facultyType _id'
      })
      .lean();
    if (!ptmRecord) {
      return res.status(404).json({ status: false, message: 'PTM record not found' });
    }
    return res.status(200).json({ status: true, message: 'PTM retrieved successfully', data: ptmRecord });
  } catch (err) {
    return next(err);
  }
};

const editPTM = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const ptmId = safeTrim(req.body?.ptmId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !ptmId) {
      return res.status(400).json({ status: false, message: 'tenantId and ptmId are required' });
    }
    const updateData = { updatedBy: userId };
    if (req.body.ptmDate !== undefined) updateData.ptmDate = Number(req.body.ptmDate);
    if (req.body.startTime !== undefined) updateData.startTime = Number(req.body.startTime);
    if (req.body.endTime !== undefined) updateData.endTime = Number(req.body.endTime);
    if (req.body.durationMins !== undefined) updateData.durationMins = toInt(req.body.durationMins);
    if (req.body.content !== undefined) updateData.content = safeTrim(req.body.content);
    if (req.body.venue !== undefined) updateData.venue = safeTrim(req.body.venue);
    if (req.body.meetingMode !== undefined) updateData.meetingMode = safeTrim(req.body.meetingMode);
    if (req.body.status !== undefined) updateData.status = safeTrim(req.body.status);
    const updatedPTM = await PTM.findOneAndUpdate({ tenantId, ptmId, isdeleted: false }, { $set: updateData }, { new: true, runValidators: true }).lean();
    if (!updatedPTM) {
      return res.status(404).json({ status: false, message: 'PTM record not found' });
    }
    return res.status(200).json({ status: true, message: 'PTM updated successfully', data: updatedPTM });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ status: false, message: 'Student already has a PTM scheduled at this exact time.' });
    }
    return next(err);
  }
};

const removePTM = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const ptmId = safeTrim(req.body?.ptmId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !ptmId) {
      return res.status(400).json({ status: false, message: 'tenantId and ptmId are required' });
    }
    const deletedPTM = await PTM.findOneAndUpdate(
      { tenantId, ptmId, isdeleted: false },
      {
        $set: {
          isdeleted: true,
          status: 'CANCELLED',
          updatedBy: userId
        }
      },
      { new: true }
    ).lean();
    if (!deletedPTM) {
      return res.status(404).json({ status: false, message: 'PTM record not found' });
    }
    return res.status(200).json({ status: true, message: 'PTM removed successfully' });
  } catch (err) {
    return next(err);
  }
};

const addStudentsToPTM = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { referencePtmId, studentIds } = req.body;
    if (!tenantId || !referencePtmId || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ status: false, message: 'tenantId, referencePtmId, and studentIds array are required' });
    }
    const refPtm = await PTM.findOne({ tenantId, ptmId: referencePtmId, isdeleted: false }).lean();
    if (!refPtm) {
      return res.status(404).json({ status: false, message: 'Reference PTM not found' });
    }
    const students = await StudentProfile.find({
      tenantId,
      studentId: { $in: studentIds },
      status: 'ACTIVE',
      isdeleted: false
    }).lean();
    if (!students.length) {
      return res.status(404).json({ status: false, message: 'No valid active students found from the provided IDs' });
    }
    const bulkOps = students.map((st) => ({
      updateOne: {
        filter: {
          tenantId,
          admissionNo: st.admissionNo,
          startTime: refPtm.startTime,
          isdeleted: false
        },
        update: {
          $setOnInsert: {
            ptmId: uuid(),
            studentId: st.studentId,
            studentName: st.student?.name || 'Unknown',
            centerCode: st.centerCode,
            programCode: st.programCode,
            batchCode: st.batchCode,
            createdBy: userId
          },
          $set: {
            ptmDate: refPtm.ptmDate,
            endTime: refPtm.endTime,
            durationMins: refPtm.durationMins,
            content: refPtm.content,
            venue: refPtm.venue,
            meetingMode: refPtm.meetingMode,
            status: 'SCHEDULED',
            updatedBy: userId
          }
        },
        upsert: true
      }
    }));
    const result = await PTM.bulkWrite(bulkOps, { ordered: false });
    return res.status(201).json({
      status: true,
      message: `Successfully added ${result.upsertedCount || students.length} student(s) to the PTM session.`,
      data: { addedCount: result.upsertedCount || students.length }
    });
  } catch (err) {
    return next(err);
  }
};

const removeStudentsFromPTM = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { ptmIds } = req.body;
    if (!tenantId || !Array.isArray(ptmIds) || ptmIds.length === 0) {
      return res.status(400).json({ status: false, message: 'tenantId and ptmIds array are required' });
    }
    const result = await PTM.updateMany(
      { tenantId, ptmId: { $in: ptmIds }, isdeleted: false },
      {
        $set: {
          isdeleted: true,
          status: 'CANCELLED',
          updatedBy: userId
        }
      }
    );
    return res.status(200).json({
      status: true,
      message: `Successfully removed ${result.modifiedCount} student(s) from the PTM.`,
      data: { removedCount: result.modifiedCount }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createProgram,
  viewProgram,
  updateProgram,
  deleteProgram,
  listPrograms,
  importPrograms,
  addProgramSubjects,
  updateProgramExamMappings,
  schedulePTM,
  bulkImportSchedule,
  submitPrePTMFeedback,
  submitStaffFeedback,
  bulkImportFeedback,
  listPTMs,
  viewPTM,
  editPTM,
  removePTM,
  addStudentsToPTM,
  removeStudentsFromPTM
};

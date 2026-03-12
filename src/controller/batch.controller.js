import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import constants from '../helpers/constants.js';
import Batch from '../models/batch.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import Program from '../models/program.model.js';
import AcademicYearConfig from '../models/academicYear.model.js';
import BatchAssignEnable from '../models/batchenabledAssignment.model.js';
import Topic from '../models/topic.model.js';
import Assignment from '../models/assignment.model.js';
const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getCurrentAyStartYear = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month < 3 ? year - 1 : year;
};
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const toIntYear = (v) => {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
};
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toEpoch = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const normalizeIdList = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : []).map((x) => safeTrim(x)).filter(Boolean)));
const ensureClassNo = (n) => Number.isFinite(n) && n >= 6 && n <= 13;
const mustObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));
const BATCH_STATUSES = ['DRAFT', 'ACTIVE', 'CLOSED', 'INACTIVE'];
const ensureBatchEditable = (b) => {
  if (!b) return { ok: false, msg: 'Batch not found' };
  if (b.isdeleted) return { ok: false, msg: 'Batch is deleted' };
  if (b.status === 'CLOSED') return { ok: false, msg: 'Batch is closed. No changes allowed.' };
  if (b.status === 'INACTIVE') return { ok: false, msg: 'Batch is inactive. No changes allowed.' };
  return { ok: true, msg: 'OK' };
};
const fetchBatchById = async (tenantId, batchId) => Batch.findOne({ tenantId, batchId: safeTrim(batchId), isdeleted: false }).lean();

const refreshStudentCount = async (tenantId, batchId, session) => {
  const q = { tenantId, isdeleted: false, status: 'ACTIVE', batchId: safeTrim(batchId) };
  const cnt = session ? await StudentProfile.countDocuments(q).session(session) : await StudentProfile.countDocuments(q);
  const upd = { $set: { studentCount: cnt } };
  if (session) {
    await Batch.updateOne({ tenantId, batchId: safeTrim(batchId), isdeleted: false }, upd, { session });
  } else {
    await Batch.updateOne({ tenantId, batchId: safeTrim(batchId), isdeleted: false }, upd);
  }
  return cnt;
};

const buildCohortAndRunningYears = ({ startYear, duration }) => {
  const sy = toIntYear(startYear);
  const dur = toIntYear(duration);
  if (!sy || sy < 2000) return null;
  if (!dur || dur < 1 || dur > 6) return null;
  const endYear = sy + dur;
  const cohortAy = `${sy} - ${endYear}`;
  const runningYears = [];
  for (let i = 0; i < dur; i++) {
    const y1 = sy + i;
    const y2 = y1 + 1;
    runningYears.push(`${y1}-${y2}`);
  }
  return { startYear: sy, endYear, cohortAy, runningYears, currentAy: runningYears[0] || null };
};
const startOfAcademicYearEpoch = (year) => new Date(Number(year), 3, 1, 0, 0, 0, 0).getTime();
const endOfAcademicYearEpoch = (year) => new Date(Number(year), 2, 31, 23, 59, 59, 999).getTime();
const normalizeAy = (s) =>
  safeTrim(s)
    .replace(/\s+/g, '')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-');

const upsertAcademicYearConfigIfMissing = async ({ tenantId, programId, cohortAy, duration, runningYears, startingClass, userId }) => {
  if (!tenantId || !programId || !cohortAy || !duration || !Array.isArray(runningYears) || !runningYears.length) return;
  const curAyStartYear = getCurrentAyStartYear();
  const years = [];
  for (let i = 0; i < runningYears.length; i++) {
    const ay = runningYears[i];
    const m = String(ay).match(/^(\d{4})-(\d{4})$/);
    const y1 = m ? Number(m[1]) : 0;
    const y2 = m ? Number(m[2]) : 0;
    if (!y1) continue;
    if (y1 > curAyStartYear) break;
    years.push({
      academicYear: ay,
      classNo: Number(startingClass || 0) + i,
      startOn: startOfAcademicYearEpoch(y1),
      endOn: endOfAcademicYearEpoch(y2)
    });
  }
  const all = await AcademicYearConfig.find({ tenantId, programId, isdeleted: false }, { _id: 1, cohortAy: 1, years: 1 }).lean();
  const existingDoc = (all || []).find((c) => normalizeAy(c.cohortAy) === normalizeAy(cohortAy));
  if (!existingDoc) {
    await AcademicYearConfig.updateOne(
      { tenantId, programId, cohortAy, isdeleted: false },
      {
        $set: { tenantId, programId, cohortAy, duration: toIntYear(duration), years, status: 'Active', isdeleted: false, updatedBy: userId || null },
        $setOnInsert: { createdBy: userId || null }
      },
      { upsert: true }
    );
  } else {
    const existingAys = new Set((existingDoc.years || []).map((y) => y.academicYear));
    const toAdd = years.filter((y) => !existingAys.has(y.academicYear));
    if (toAdd.length) {
      await AcademicYearConfig.updateOne({ tenantId, programId, cohortAy: existingDoc.cohortAy, isdeleted: false }, { $push: { years: { $each: toAdd } }, $set: { updatedBy: userId || null } });
    }
  }
};

const pushYearToAyConfigIfMissing = async ({ tenantId, programId, cohortAy, academicYear, classNo, userId }) => {
  if (!tenantId || !programId || !cohortAy || !academicYear) return;
  const m = String(academicYear).match(/^(\d{4})-(\d{4})$/);
  const y1 = m ? Number(m[1]) : 0;
  const y2 = m ? Number(m[2]) : 0;
  if (!y1) return;
  if (y1 > getCurrentAyStartYear()) return;
  const all = await AcademicYearConfig.find({ tenantId, programId, isdeleted: false }, { _id: 1, cohortAy: 1, years: 1 }).lean();
  const doc = (all || []).find((c) => normalizeAy(c.cohortAy) === normalizeAy(cohortAy));
  if (!doc) return;
  const alreadyHas = (doc.years || []).some((y) => y.academicYear === academicYear);
  if (alreadyHas) return;
  await AcademicYearConfig.updateOne(
    { _id: doc._id },
    {
      $push: { years: { academicYear, classNo, startOn: startOfAcademicYearEpoch(y1), endOn: endOfAcademicYearEpoch(y2) } },
      $set: { updatedBy: userId || null }
    }
  );
};

const backfillStudentsIntoEnabledTests = async (tenantId, batchId, studentIds, session) => {
  const studs = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', studentId: { $in: studentIds } }, { _id: 0, studentId: 1, admissionNo: 1, cgpa: 1 })
    .lean()
    .session(session);
  const normalizedStuds = (studs || [])
    .map((s) => ({
      studentId: safeTrim(s?.studentId),
      admissionNo: safeTrim(s?.admissionNo),
      cgpa: s?.cgpa === null || s?.cgpa === undefined ? null : toNum(s?.cgpa)
    }))
    .filter((s) => !!s.studentId && !!s.admissionNo);
  if (!normalizedStuds.length) return;
  const enabledTests = await BatchAssignEnable.find({ tenantId, batchId, isdeleted: false, status: 'enabled' }, { _id: 1, enabledAt: 1 }).lean().session(session);
  if (!enabledTests.length) return;
  const now = Date.now();
  const ops = [];
  for (const t of enabledTests) {
    for (const s of normalizedStuds) {
      ops.push({
        updateOne: {
          filter: {
            _id: t._id,
            students: { $not: { $elemMatch: { admissionNo: s.admissionNo } } }
          },
          update: {
            $push: {
              students: {
                studentId: s.studentId,
                admissionNo: s.admissionNo,
                cgpa: s.cgpa,
                status: 'ASSIGNED',
                assignedAt: now,
                startedAt: null,
                completedAt: null,
                attempts: 0
              }
            }
          }
        }
      });
    }
  }
  if (!ops.length) return;
  await BatchAssignEnable.bulkWrite(ops, { ordered: false, session });
};

const validateStudentsForBatch = async (tenantId, batch, studentIds, mode) => {
  const students = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', studentId: { $in: studentIds } }, { studentId: 1, admissionNo: 1, academicYear: 1, currentAcademicYear: 1, programId: 1, centerId: 1, batchId: 1 }).lean();
  const byId = new Map((students || []).map((s) => [String(s.studentId), s]));
  const missing = studentIds.filter((id) => !byId.has(id));
  if (missing.length) return { ok: false, msg: `Some students not found/inactive: ${missing.join(', ')}` };
  const badProgram = studentIds.filter((id) => String(byId.get(id)?.programId || '') !== String(batch.programId || ''));
  if (badProgram.length) return { ok: false, msg: `Program mismatch for students: ${badProgram.join(', ')}` };
  const normalizeAyStrict = (s) =>
    safeTrim(s)
      .replace(/\s+/g, '')
      .replace(/–/g, '-')
      .replace(/—/g, '-')
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, '-')
      .toLowerCase();

  const bAy = normalizeAyStrict(batch?.academicYear);
  const badYear = studentIds.filter((id) => normalizeAyStrict(byId.get(id)?.currentAcademicYear) !== bAy);
  if (badYear.length) return { ok: false, msg: `Academic year mismatch for students: ${badYear.join(', ')}` };
  const badCenter = studentIds.filter((id) => String(byId.get(id)?.centerId || '') !== String(batch.centerId || ''));
  if (badCenter.length) return { ok: false, msg: `Center mismatch for students: ${badCenter.join(', ')}` };
  if (mode === 'ASSIGN_ONLY_UNASSIGNED') {
    const alreadyAssigned = studentIds.filter((id) => !!safeTrim(byId.get(id)?.batchId));
    if (alreadyAssigned.length)
      return {
        ok: false,
        msg: `These students are already assigned to a batch: ${alreadyAssigned.join(', ')}`
      };
  }
  return { ok: true, msg: 'OK', students };
};

const getAcademicYearOrderMap = async (tenantId, programId) => {
  const docs = await AcademicYearConfig.find({ tenantId, programId, isdeleted: false, status: 'Active' }, { _id: 0, years: 1 }).lean();
  const flatYears = [];
  for (const d of docs || []) {
    const arr = Array.isArray(d.years) ? d.years : [];
    for (const y of arr) {
      flatYears.push({
        academicYear: String(y?.academicYear || '').trim(),
        startOn: y?.startOn ?? null
      });
    }
  }
  const ordered = flatYears
    .filter((x) => x.academicYear)
    .sort((a, b) => {
      const as = a.startOn === null || a.startOn === undefined ? Number.MAX_SAFE_INTEGER : Number(a.startOn);
      const bs = b.startOn === null || b.startOn === undefined ? Number.MAX_SAFE_INTEGER : Number(b.startOn);
      return as - bs;
    });
  const map = new Map();
  for (let i = 0; i < ordered.length; i++) {
    map.set(String(ordered[i].academicYear), i);
  }
  return map;
};

const resolveBatchYearAndClass = async (tenantId, programId, academicYear, programStartAy) => {
  const prog = await Program.findOne({ tenantId, programId: safeTrim(programId), isdeleted: false }, { startingClass: 1, duration: 1 }).lean();
  if (!prog) return { ok: false, msg: 'Program not found' };
  const ayMap = await getAcademicYearOrderMap(tenantId, programId);
  const idxStart = ayMap.get(String(programStartAy));
  const idxCur = ayMap.get(String(academicYear));
  if (idxStart === undefined)
    return {
      ok: false,
      msg: `programStartAy not found in AcademicYear config: ${programStartAy}`
    };
  if (idxCur === undefined) return { ok: false, msg: `academicYear not found in AcademicYear config: ${academicYear}` };
  const diff = idxCur - idxStart;
  const yearNo = diff + 1;
  if (yearNo <= 0) return { ok: false, msg: 'academicYear is before programStartAy' };
  if (yearNo > Number(prog.duration || 0)) return { ok: false, msg: 'academicYear exceeds program duration' };
  const classNo = Number(prog.startingClass || 0) + diff;
  return { ok: true, yearNo, classNo, startingClass: prog.startingClass, duration: prog.duration };
};

const pickActiveAcademicYearFromCfg = (yearsArr) => {
  const now = Date.now();
  const arr = Array.isArray(yearsArr) ? yearsArr : [];
  const hit = arr.find((y) => {
    const s = y?.startOn ?? null;
    const e = y?.endOn ?? null;
    if (!s || !e) return false;
    return Number(s) <= now && now < Number(e);
  });
  if (hit?.academicYear) return hit;
  const sorted = [...arr].sort((a, b) => {
    const as = a?.startOn ?? Number.MAX_SAFE_INTEGER;
    const bs = b?.startOn ?? Number.MAX_SAFE_INTEGER;
    return Number(as) - Number(bs);
  });
  return sorted[0] || null;
};

const createBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const batchName = safeTrim(payload.batchName);
    const batchCode = safeTrim(payload.batchCode);
    const academicYear = safeTrim(payload.academicYear);
    const programId = safeTrim(payload.programId);
    const centerId = safeTrim(payload.centerId);
    const startDate = toEpoch(payload.startDate);
    const endDate = toEpoch(payload.endDate);
    const programStartAy = safeTrim(payload.programStartAy) || academicYear;
    const userId = safeTrim(payload.userId);
    if (!batchName || !batchCode || !academicYear || !programId || !centerId || !startDate || !endDate) {
      return res.status(400).json({
        status: false,
        message: 'batchName, batchCode, academicYear, programId, centerId, startDate, endDate are required'
      });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ status: false, message: 'startDate must be before endDate' });
    }
    const program = await Program.findOne({ tenantId, programId, isdeleted: false }, { duration: 1, startingClass: 1 }).lean();
    if (!program) return res.status(400).json({ status: false, message: 'Program not found' });
    const startAyMatch = String(programStartAy).match(/^(\d{4})/);
    const startYear = startAyMatch ? toIntYear(startAyMatch[1]) : 0;
    if (startYear > 0 && program.duration) {
      const calc = buildCohortAndRunningYears({ startYear, duration: program.duration });
      if (calc) {
        await upsertAcademicYearConfigIfMissing({
          tenantId,
          programId,
          cohortAy: calc.cohortAy,
          duration: program.duration,
          runningYears: calc.runningYears,
          startingClass: program.startingClass,
          userId
        });
      }
    }
    const yr = await resolveBatchYearAndClass(tenantId, programId, academicYear, programStartAy);
    if (!yr.ok) return res.status(400).json({ status: false, message: yr.msg });
    const doc = await Batch.create({
      tenantId,
      batchName,
      batchCode,
      academicYear,
      programId,
      programCode: safeTrim(payload.programCode) || null,
      programName: safeTrim(payload.programName) || null,
      centerId,
      centerCode: safeTrim(payload.centerCode) || null,
      centerName: safeTrim(payload.centerName) || null,
      startDate,
      endDate,
      programStartAy,
      yearNo: yr.yearNo,
      classNo: yr.classNo,
      status: safeTrim(payload.status) || 'ACTIVE',
      staffMap: Array.isArray(payload.staffMap) ? payload.staffMap : [],
      studentCount: 0,
      remarks: safeTrim(payload.remarks) || null,
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Batch created', data: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        status: false,
        message: 'Batch code already exists for this academic year'
      });
    }
    return next(err);
  }
};

const listBatches = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const list = safeTrim(req.query.list);
    const search = safeTrim(req.query.search);
    const status = safeTrim(req.query.status);
    const academicYear = safeTrim(req.query.academicYear);
    const programId = safeTrim(req.query.programId);
    const centerId = safeTrim(req.query.centerId);
    const query = { tenantId, isdeleted: false };
    if (status && status !== 'ALL') query.status = status;
    if (academicYear) query.academicYear = academicYear;
    if (programId) query.programId = programId;
    if (centerId) query.centerId = centerId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ batchName: rx }, { batchCode: rx }, { programName: rx }, { centerName: rx }];
    }
    if (list === 'full') {
      const rows = await Batch.find(query).sort({ createdAt: -1 }).lean();
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'Request success',
        data: rows,
        count: rows.length
      });
    }
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([Batch.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Batch.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: rows,
      count
    });
  } catch (err) {
    return next(err);
  }
};

const viewBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const batchId = safeTrim(req.body.batchId);
    const batchCode = safeTrim(req.body.batchCode);
    if (!batchId && !batchCode) return res.status(400).json({ status: false, message: 'batchId or batch Code is required' });
    const query = { tenantId, isdeleted: false };
    if (batchCode) query.batchCode = batchCode;
    if (batchId) query.batchId = batchId;
    const doc = await Batch.findOne(query).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Batch not found' });
    const includeStudents = toBool(req.body?.includeStudents);
    if (!includeStudents) {
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'Request success',
        data: doc
      });
    }
    const students = await StudentProfile.find(
      { tenantId, isdeleted: false, status: 'ACTIVE', batchId: doc.batchId },
      {
        studentId: 1,
        admissionNo: 1,
        registrationNumber: 1,
        academicYear: 1,
        programId: 1,
        centerId: 1,
        batchId: 1,
        batchCode: 1,
        student: 1
      }
    )
      .sort({ createdAt: -1 })
      .lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: { ...doc, students }
    });
  } catch (err) {
    return next(err);
  }
};

const updateBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const batchId = safeTrim(payload.batchId);
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const cur = await Batch.findOne({ tenantId, batchId, isdeleted: false });
    if (!cur) return res.status(404).json({ status: false, message: 'Batch not found' });
    const guard = ensureBatchEditable(cur);
    if (!guard.ok) return res.status(400).json({ status: false, message: guard.msg });
    const patch = {};
    if (payload.batchName !== undefined) patch.batchName = safeTrim(payload.batchName);
    if (payload.batchCode !== undefined) patch.batchCode = safeTrim(payload.batchCode);
    if (payload.academicYear !== undefined) patch.academicYear = safeTrim(payload.academicYear);
    if (payload.programId !== undefined) patch.programId = safeTrim(payload.programId);
    if (payload.programCode !== undefined) patch.programCode = safeTrim(payload.programCode) || null;
    if (payload.programName !== undefined) patch.programName = safeTrim(payload.programName) || null;
    if (payload.centerId !== undefined) patch.centerId = safeTrim(payload.centerId);
    if (payload.centerCode !== undefined) patch.centerCode = safeTrim(payload.centerCode) || null;
    if (payload.centerName !== undefined) patch.centerName = safeTrim(payload.centerName) || null;
    if (payload.remarks !== undefined) patch.remarks = safeTrim(payload.remarks) || null;
    if (payload.userId !== undefined) patch.updatedBy = payload.userId || null;
    if (payload.startDate !== undefined) patch.startDate = toEpoch(payload.startDate);
    if (payload.endDate !== undefined) patch.endDate = toEpoch(payload.endDate);
    if (payload.programStartAy !== undefined) patch.programStartAy = safeTrim(payload.programStartAy);
    if (payload.status !== undefined) {
      const newStatus = safeTrim(payload.status);
      if (newStatus && !BATCH_STATUSES.includes(newStatus)) {
        return res.status(400).json({
          status: false,
          message: `Invalid status "${newStatus}". Allowed: ${BATCH_STATUSES.join(', ')}`
        });
      }
      patch.status = newStatus || cur.status;
    }
    const effStart = patch.startDate !== undefined ? patch.startDate : cur.startDate;
    const effEnd = patch.endDate !== undefined ? patch.endDate : cur.endDate;
    if (effStart && effEnd && effStart >= effEnd) {
      return res.status(400).json({ status: false, message: 'startDate must be before endDate' });
    }
    if (patch.batchName !== undefined && !patch.batchName) {
      return res.status(400).json({ status: false, message: 'batchName cannot be empty' });
    }
    if (patch.batchCode !== undefined && !patch.batchCode) {
      return res.status(400).json({ status: false, message: 'batchCode cannot be empty' });
    }
    const changingCore = (patch.programId !== undefined && String(patch.programId) !== String(cur.programId)) || (patch.academicYear !== undefined && String(patch.academicYear) !== String(cur.academicYear)) || (patch.centerId !== undefined && String(patch.centerId) !== String(cur.centerId));
    if (changingCore) {
      const hasStudents = await StudentProfile.countDocuments({
        tenantId,
        isdeleted: false,
        status: 'ACTIVE',
        batchId
      });
      if (hasStudents > 0) {
        return res.status(400).json({
          status: false,
          message: 'Cannot change program/center/academicYear while students are assigned. Remove/shift students first.'
        });
      }
      const effAcademicYear = patch.academicYear !== undefined ? patch.academicYear : cur.academicYear;
      const effProgramId = patch.programId !== undefined ? patch.programId : cur.programId;
      const effStartAy = patch.programStartAy !== undefined ? patch.programStartAy : cur.programStartAy || cur.academicYear;
      const effProgram = await Program.findOne({ tenantId, programId: effProgramId, isdeleted: false }, { duration: 1, startingClass: 1 }).lean();
      const startAyMatch = String(effStartAy).match(/^(\d{4})/);
      const startYear = startAyMatch ? toIntYear(startAyMatch[1]) : 0;
      if (startYear > 0 && effProgram?.duration) {
        const calc = buildCohortAndRunningYears({ startYear, duration: effProgram.duration });
        if (calc) {
          await upsertAcademicYearConfigIfMissing({
            tenantId,
            programId: effProgramId,
            cohortAy: calc.cohortAy,
            duration: effProgram.duration,
            runningYears: calc.runningYears,
            startingClass: effProgram.startingClass,
            userId: payload.userId
          });
        }
      }
      const yr = await resolveBatchYearAndClass(tenantId, effProgramId, effAcademicYear, effStartAy);
      if (!yr.ok) return res.status(400).json({ status: false, message: yr.msg });
      patch.programStartAy = effStartAy;
      patch.yearNo = yr.yearNo;
      patch.classNo = yr.classNo;
    }
    const doc = await Batch.findOneAndUpdate({ tenantId, batchId, isdeleted: false }, { $set: patch }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Batch not found' });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Batch updated',
      data: doc
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        status: false,
        message: 'Batch code already exists for this academic year'
      });
    }
    return next(err);
  }
};

const deleteBatch = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const batchId = safeTrim(req.body.batchId);
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const updatedBy = req.body.userId || null;
    session.startTransaction();
    const b = await Batch.findOne({ tenantId, batchId, isdeleted: false }).session(session);
    if (!b) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ status: false, message: 'Batch not found' });
    }
    const guard = ensureBatchEditable(b);
    if (!guard.ok) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: false, message: guard.msg });
    }
    await StudentProfile.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', batchId }, { $set: { batchId: null, batchCode: null, updatedBy } }, { session });
    const doc = await Batch.findOneAndUpdate({ tenantId, batchId, isdeleted: false }, { $set: { isdeleted: true, status: 'INACTIVE', studentCount: 0, updatedBy } }, { new: true, session });
    await session.commitTransaction();
    session.endSession();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Batch deleted',
      data: doc
    });
  } catch (err) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch {}
    return next(err);
  }
};

const closeBatch = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const batchId = safeTrim(req.body.batchId);
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const updatedBy = req.body.userId || null;
    session.startTransaction();
    const b = await Batch.findOne({ tenantId, batchId, isdeleted: false }).session(session);
    if (!b) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ status: false, message: 'Batch not found' });
    }
    if (b.status === 'CLOSED') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: false, message: 'Batch already closed' });
    }
    await StudentProfile.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', batchId }, { $set: { batchId: null, batchCode: null, updatedBy } }, { session });
    b.status = 'CLOSED';
    b.studentCount = 0;
    b.updatedBy = updatedBy;
    await b.save({ session });
    await session.commitTransaction();
    session.endSession();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Batch closed and students released'
    });
  } catch (err) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch {}
    return next(err);
  }
};

const saveBatchStaffMap = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const batchId = safeTrim(req.body.batchId);
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const staffMapRaw = Array.isArray(req.body.staffMap) ? req.body.staffMap : [];
    const staffMap = staffMapRaw
      .map((x) => ({
        subjectId: safeTrim(x?.subjectId),
        subjectName: safeTrim(x?.subjectName) || null,
        staffId: safeTrim(x?.staffId),
        staffName: safeTrim(x?.staffName) || null
      }))
      .filter((x) => !!x.subjectId && !!x.staffId);
    const subjSet = new Set();
    for (const r of staffMap) {
      const k = String(r.subjectId);
      if (subjSet.has(k)) {
        return res.status(400).json({
          status: false,
          message: `Duplicate subjectId in staffMap: ${k}`
        });
      }
      subjSet.add(k);
    }
    const b = await Batch.findOne({ tenantId, batchId, isdeleted: false });
    if (!b) return res.status(404).json({ status: false, message: 'Batch not found' });
    const guard = ensureBatchEditable(b);
    if (!guard.ok) return res.status(400).json({ status: false, message: guard.msg });
    b.staffMap = staffMap;
    b.updatedBy = req.body.userId || null;
    await b.save();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Staff mapping saved',
      data: b
    });
  } catch (err) {
    return next(err);
  }
};

const listEligibleStudentsForBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const batchId = safeTrim(req.body.batchId);
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const b = await fetchBatchById(tenantId, batchId);
    if (!b) return res.status(404).json({ status: false, message: 'Batch not found' });
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const skip = (page - 1) * limit;
    const search = safeTrim(req.query.search);
    const query = {
      tenantId,
      isdeleted: false,
      status: 'ACTIVE',
      programId: b.programId,
      centerId: b.centerId,
      currentAcademicYear: b.academicYear,
      batchId: null
    };
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ admissionNo: rx }, { registrationNumber: rx }, { 'student.name': rx }, { 'student.phone': rx }, { 'student.parentPhone': rx }];
    }
    const [rows, count] = await Promise.all([StudentProfile.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), StudentProfile.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: rows,
      count
    });
  } catch (err) {
    return next(err);
  }
};

const assignStudentsToBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const batchId = safeTrim(payload.batchId);
    const studentIds = normalizeIdList(payload.studentIds);
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    if (!studentIds.length) return res.status(400).json({ status: false, message: 'studentIds must be a non-empty array' });
    const b = await Batch.findOne({ tenantId, batchId, isdeleted: false });
    if (!b) return res.status(404).json({ status: false, message: 'Batch not found' });
    const guard = ensureBatchEditable(b);
    if (!guard.ok) return res.status(400).json({ status: false, message: guard.msg });
    const check = await validateStudentsForBatch(tenantId, b, studentIds, 'ASSIGN_ONLY_UNASSIGNED');
    if (!check.ok) return res.status(400).json({ status: false, message: check.msg });
    const updatedBy = payload.userId || null;
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await StudentProfile.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', studentId: { $in: studentIds }, batchId: null }, { $set: { batchId: b.batchId, batchCode: b.batchCode, updatedBy } }, { session });
      await backfillStudentsIntoEnabledTests(tenantId, b.batchId, studentIds, session);
      const cnt = await refreshStudentCount(tenantId, b.batchId, session);
      await Batch.updateOne({ tenantId, batchId: b.batchId, isdeleted: false }, { $set: { updatedBy } }, { session });
      await session.commitTransaction();
      session.endSession();
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'Students assigned to batch',
        count: cnt
      });
    } catch (txErr) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch {}
      return next(txErr);
    }
  } catch (err) {
    return next(err);
  }
};

const moveStudentsToBatch = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const toBatchId = safeTrim(payload.toBatchId || payload.batchId);
    const studentIds = normalizeIdList(payload.studentIds);
    if (!toBatchId) return res.status(400).json({ status: false, message: 'toBatchId (batchId) is required' });
    if (!studentIds.length) return res.status(400).json({ status: false, message: 'studentIds must be a non-empty array' });
    const toBatch = await Batch.findOne({ tenantId, batchId: toBatchId, isdeleted: false });
    if (!toBatch) return res.status(404).json({ status: false, message: 'Target batch not found' });
    const guard = ensureBatchEditable(toBatch);
    if (!guard.ok) return res.status(400).json({ status: false, message: guard.msg });
    const check = await validateStudentsForBatch(tenantId, toBatch, studentIds, 'MOVE_ALLOWED');
    if (!check.ok) return res.status(400).json({ status: false, message: check.msg });
    const updatedBy = payload.userId || null;
    const students = check.students || [];
    const fromBatchIds = Array.from(new Set(students.map((s) => safeTrim(s.batchId)).filter((x) => !!x && x !== toBatch.batchId)));
    session.startTransaction();
    await StudentProfile.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', studentId: { $in: studentIds } }, { $set: { batchId: toBatch.batchId, batchCode: toBatch.batchCode, updatedBy } }, { session });
    await backfillStudentsIntoEnabledTests(tenantId, toBatch.batchId, studentIds, session);
    for (const bid of [toBatch.batchId, ...fromBatchIds]) {
      await refreshStudentCount(tenantId, bid, session);
      await Batch.updateOne({ tenantId, batchId: bid, isdeleted: false }, { $set: { updatedBy } }, { session });
    }
    await session.commitTransaction();
    session.endSession();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Students moved to batch',
      moved: studentIds.length,
      toBatchId: toBatch.batchId,
      fromBatchIds
    });
  } catch (err) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch {}
    return next(err);
  }
};

const removeStudentsFromBatch = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const studentIds = normalizeIdList(payload.studentIds);
    if (!studentIds.length) return res.status(400).json({ status: false, message: 'studentIds must be a non-empty array' });
    const updatedBy = payload.userId || null;
    const studs = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', studentId: { $in: studentIds } }, { studentId: 1, batchId: 1 }).lean();
    const fromBatchIds = Array.from(new Set((studs || []).map((s) => safeTrim(s.batchId)).filter(Boolean)));
    session.startTransaction();
    await StudentProfile.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', studentId: { $in: studentIds } }, { $set: { batchId: null, batchCode: null, updatedBy } }, { session });
    for (const bid of fromBatchIds) {
      await refreshStudentCount(tenantId, bid, session);
      await Batch.updateOne({ tenantId, batchId: bid, isdeleted: false }, { $set: { updatedBy } }, { session });
    }
    await session.commitTransaction();
    session.endSession();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Students removed from batch',
      removed: studentIds.length,
      refreshedBatches: fromBatchIds
    });
  } catch (err) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch {}
    return next(err);
  }
};

const shuffleStudentsBetweenBatches = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const fromBatchId = safeTrim(payload.fromBatchId);
    const toBatchId = safeTrim(payload.toBatchId);
    const studentIds = normalizeIdList(payload.studentIds);
    if (!fromBatchId || !toBatchId) return res.status(400).json({ status: false, message: 'fromBatchId and toBatchId are required' });
    if (!studentIds.length) return res.status(400).json({ status: false, message: 'studentIds must be a non-empty array' });
    if (fromBatchId === toBatchId) return res.status(400).json({ status: false, message: 'fromBatchId and toBatchId cannot be same' });
    const [fromBatch, toBatch] = await Promise.all([Batch.findOne({ tenantId, batchId: fromBatchId, isdeleted: false }), Batch.findOne({ tenantId, batchId: toBatchId, isdeleted: false })]);
    if (!fromBatch) return res.status(404).json({ status: false, message: 'From batch not found' });
    if (!toBatch) return res.status(404).json({ status: false, message: 'To batch not found' });
    const g1 = ensureBatchEditable(fromBatch);
    if (!g1.ok) return res.status(400).json({ status: false, message: g1.msg });
    const g2 = ensureBatchEditable(toBatch);
    if (!g2.ok) return res.status(400).json({ status: false, message: g2.msg });
    if (String(fromBatch.programId) !== String(toBatch.programId) || String(fromBatch.academicYear) !== String(toBatch.academicYear) || String(fromBatch.centerId) !== String(toBatch.centerId)) {
      return res.status(400).json({
        status: false,
        message: 'Cannot shuffle between batches with different program/academicYear/center'
      });
    }
    const found = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', studentId: { $in: studentIds }, batchId: fromBatch.batchId }, { studentId: 1 }).lean();
    const foundIds = new Set((found || []).map((x) => String(x.studentId)));
    const notInFrom = studentIds.filter((id) => !foundIds.has(id));
    if (notInFrom.length) {
      return res.status(400).json({
        status: false,
        message: `These students are not in fromBatch: ${notInFrom.join(', ')}`
      });
    }
    const updatedBy = payload.userId || null;
    session.startTransaction();
    await StudentProfile.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', studentId: { $in: studentIds }, batchId: fromBatch.batchId }, { $set: { batchId: toBatch.batchId, batchCode: toBatch.batchCode, updatedBy } }, { session });
    await refreshStudentCount(tenantId, fromBatch.batchId, session);
    await refreshStudentCount(tenantId, toBatch.batchId, session);
    await Batch.updateOne({ tenantId, batchId: fromBatch.batchId, isdeleted: false }, { $set: { updatedBy } }, { session });
    await Batch.updateOne({ tenantId, batchId: toBatch.batchId, isdeleted: false }, { $set: { updatedBy } }, { session });
    await session.commitTransaction();
    session.endSession();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Students shuffled between batches',
      moved: studentIds.length,
      fromBatchId: fromBatch.batchId,
      toBatchId: toBatch.batchId
    });
  } catch (err) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch {}
    return next(err);
  }
};

const recalcBatchStudentCount = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const batchId = safeTrim(req.body.batchId);
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const cnt = await refreshStudentCount(tenantId, batchId);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Student count refreshed',
      count: cnt
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchSubjects = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchId = safeTrim(req.body.batchId);
    if (!tenantId || !batchId) return res.status(400).json({ status: false, message: 'tenantId and batchId required' });
    const batch = await Batch.findOne({ tenantId, batchId, isdeleted: false }).lean();
    if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    if (!batch.programId) return res.status(200).json({ status: true, data: [] });
    const program = await Program.findOne({ tenantId, programId: batch.programId, isdeleted: false }).populate('subjects', 'subjectName subjectCode').lean();
    const subjects = (program?.subjects || []).map((s) => ({
      subjectId: s._id,
      subjectName: s.subjectName,
      subjectCode: s.subjectCode
    }));
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, data: subjects });
  } catch (err) {
    return next(err);
  }
};

const getBatchAyInfo = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const programId = safeTrim(req.body?.programId);
    if (!programId) return res.status(400).json({ status: false, message: 'programId is required' });
    const courseStartYearRaw = req.body?.courseStartYear;
    if (courseStartYearRaw === undefined || courseStartYearRaw === null || String(courseStartYearRaw).trim() === '') {
      return res.status(400).json({ status: false, message: 'courseStartYear is required' });
    }
    const courseStartYear = String(courseStartYearRaw).trim();
    const userId = safeTrim(req.body?.userId);
    const cohortAy = safeTrim(req.body?.cohortAy);
    if (!cohortAy) return res.status(400).json({ status: false, message: 'cohortAy is required' });
    let cfgs = await AcademicYearConfig.find({ tenantId, programId, isdeleted: false, status: 'Active' }, { _id: 0, cohortAy: 1, years: 1, duration: 1 }).lean();
    let cfg = (cfgs || []).find((c) => normalizeAy(c?.cohortAy) === normalizeAy(cohortAy));
    if (!cfg) {
      const program = await Program.findOne({ tenantId, programId, isdeleted: false }, { duration: 1 }).lean();
      if (program && program.duration) {
        const startYear = toIntYear(courseStartYear);
        if (startYear > 0) {
          const calc = buildCohortAndRunningYears({ startYear, duration: program.duration });
          if (calc) {
            await upsertAcademicYearConfigIfMissing({
              tenantId,
              programId,
              cohortAy: calc.cohortAy,
              duration: program.duration,
              runningYears: calc.runningYears,
              startingClass: program.startingClass,
              userId
            });
            cfgs = await AcademicYearConfig.find({ tenantId, programId, isdeleted: false, status: 'Active' }, { _id: 0, cohortAy: 1, years: 1, duration: 1 }).lean();
            cfg = (cfgs || []).find((c) => normalizeAy(c?.cohortAy) === normalizeAy(calc.cohortAy));
          }
        }
      }
      if (!cfg) {
        return res.status(404).json({
          status: false,
          message: `AcademicYear config not found and auto-creation failed for programId=${programId} cohortAy=${cohortAy}`
        });
      }
    }
    const requestedAy = safeTrim(req.body?.academicYear);
    let yearRow = null;
    if (requestedAy) {
      yearRow = (cfg.years || []).find((y) => normalizeAy(y?.academicYear) === normalizeAy(requestedAy)) || null;
      if (!yearRow) {
        return res.status(400).json({
          status: false,
          message: `academicYear not found under cohortAy=${cfg.cohortAy}: ${requestedAy}`
        });
      }
    } else {
      yearRow = pickActiveAcademicYearFromCfg(cfg.years);
      if (!yearRow) {
        return res.status(400).json({
          status: false,
          message: `No years configured under cohortAy=${cfg.cohortAy}`
        });
      }
    }
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: {
        programId,
        courseStartYear: Number(courseStartYear),
        programStartAy: cfg.cohortAy,
        academicYear: yearRow.academicYear,
        startDate: yearRow.startOn ?? null,
        endDate: yearRow.endOn ?? null,
        years: cfg.years || []
      }
    });
  } catch (err) {
    return next(err);
  }
};

const listBatchesForEnablement = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const classNo = toNum(req.body?.classNo);
    const subjectId = safeTrim(req.body?.subjectId);
    if (!ensureClassNo(classNo)) return res.status(400).json({ status: false, message: 'Invalid classNo (6..13)' });
    if (!subjectId) return res.status(400).json({ status: false, message: 'subjectId is required' });
    const q = {
      tenantId,
      isdeleted: false,
      classNo,
      status: { $in: ['ACTIVE', 'DRAFT'] },
      staffMap: { $elemMatch: { subjectId } }
    };
    const rows = await Batch.find(q, {
      _id: 0,
      batchId: 1,
      batchName: 1,
      batchCode: 1,
      academicYear: 1,
      programId: 1,
      centerId: 1,
      centerName: 1,
      studentCount: 1,
      status: 1
    })
      .sort({ batchName: 1 })
      .lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Batches loaded',
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const listTopicsForEnablement = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const classNo = toNum(req.body?.classNo);
    const subjectIdRaw = req.body?.subjectId;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!ensureClassNo(classNo)) return res.status(400).json({ status: false, message: 'Invalid classNo (6..13)' });
    if (!subjectIdRaw || !mustObjectId(subjectIdRaw)) return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const rows = await Topic.find({ tenantId, isdeleted: false, status: 'Active', classNo, subjectId }, { _id: 0, topicId: 1, topicName: 1, topicCode: 1, sortOrder: 1 }).sort({ sortOrder: 1, topicName: 1 }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Topics loaded',
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const listTestsForEnablement = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const classNo = toNum(req.body?.classNo);
    const subjectIdRaw = req.body?.subjectId;
    const subjectIdStr = safeTrim(req.body?.subjectId);
    const topicId = safeTrim(req.body?.topicId);
    const batchId = safeTrim(req.body?.batchId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!ensureClassNo(classNo)) return res.status(400).json({ status: false, message: 'Invalid classNo (6..13)' });
    if (!subjectIdRaw || !mustObjectId(subjectIdRaw)) return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    if (!topicId) return res.status(400).json({ status: false, message: 'topicId is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const subjectIdObj = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const rows = await Assignment.aggregate([
      {
        $match: {
          tenantId,
          isdeleted: false,
          classNo,
          subjectId: subjectIdObj,
          topicId
        }
      },
      {
        $lookup: {
          from: BatchAssignEnable.collection.name,
          let: { tId: '$testId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$tenantId', tenantId] }, { $eq: ['$batchId', batchId] }, { $eq: ['$subjectId', subjectIdStr] }, { $eq: ['$testId', '$$tId'] }, { $eq: ['$isdeleted', false] }, { $eq: ['$status', 'enabled'] }]
                }
              }
            },
            { $project: { _id: 0, enabledAt: 1, enabledBy: 1 } }
          ],
          as: 'en'
        }
      },
      {
        $addFields: {
          enabled: { $gt: [{ $size: '$en' }, 0] },
          enabledAt: { $ifNull: [{ $arrayElemAt: ['$en.enabledAt', 0] }, null] },
          enabledBy: { $ifNull: [{ $arrayElemAt: ['$en.enabledBy', 0] }, null] }
        }
      },
      {
        $project: {
          _id: 0,
          testId: 1,
          testNo: 1,
          testCode: 1,
          numberOfQuestions: 1,
          status: 1,
          classNo: 1,
          topicId: 1,
          subTopicId: 1,
          categoryId: 1,
          subCategoryId: 1,
          enabled: 1,
          enabledAt: 1
        }
      },
      { $sort: { testNo: 1, testCode: 1 } }
    ]);

    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Tests loaded',
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

// const promoteBatch = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
//     const payload = req.body || {};
//     const batchId = safeTrim(payload.batchId);
//     const updatedBy = payload.userId || null;
//     if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
//     const batch = await Batch.findOne({ tenantId, batchId, isdeleted: false });
//     if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });
//     if (batch.status !== 'ACTIVE') return res.status(400).json({ status: false, message: `Batch must be ACTIVE to promote. Current status: ${batch.status}` });
//     const program = await Program.findOne({ tenantId, programId: batch.programId, isdeleted: false }, { duration: 1, startingClass: 1 }).lean();
//     if (!program) return res.status(400).json({ status: false, message: 'Program not found' });
//     const duration = toIntYear(program.duration);
//     if (batch.yearNo >= duration) {
//       return res.status(400).json({
//         status: false,
//         message: `Cannot promote: batch is already in final year (year ${batch.yearNo} of ${duration}). Close the batch instead.`
//       });
//     }
//     const startAyMatch = String(batch.programStartAy).match(/^(\d{4})/);
//     const cohortStartYear = startAyMatch ? toIntYear(startAyMatch[1]) : 0;
//     if (!cohortStartYear) return res.status(400).json({ status: false, message: 'Cannot determine cohort start year from programStartAy' });
//     const calc = buildCohortAndRunningYears({ startYear: cohortStartYear, duration });
//     if (!calc) return res.status(400).json({ status: false, message: 'Unable to compute cohort academic years' });
//     const nextIdx = batch.yearNo;
//     if (nextIdx >= calc.runningYears.length) {
//       return res.status(400).json({ status: false, message: 'Next academic year not available in cohort configuration' });
//     }
//     const nextAcademicYear = calc.runningYears[nextIdx];
//     const nextYearNo = batch.yearNo + 1;
//     const nextClassNo = batch.classNo + 1;
//     const patch = { academicYear: nextAcademicYear, yearNo: nextYearNo, classNo: nextClassNo, updatedBy };
//     if (payload.startDate !== undefined) {
//       const sd = toEpoch(payload.startDate);
//       if (sd) patch.startDate = sd;
//     }
//     if (payload.endDate !== undefined) {
//       const ed = toEpoch(payload.endDate);
//       if (ed) patch.endDate = ed;
//     }
//     const effStart = patch.startDate ?? batch.startDate;
//     const effEnd = patch.endDate ?? batch.endDate;
//     if (effStart && effEnd && effStart >= effEnd) {
//       return res.status(400).json({ status: false, message: 'startDate must be before endDate' });
//     }
//     const updated = await Batch.findOneAndUpdate({ tenantId, batchId, isdeleted: false }, { $set: patch }, { new: true }).lean();
//     if (!updated) return res.status(404).json({ status: false, message: 'Batch not found during update' });
//     const historyEntry = {
//       academicYear: batch.academicYear,
//       yearNo: batch.yearNo,
//       classNo: batch.classNo,
//       changedOn: Date.now(),
//       changedBy: updatedBy
//     };
//     await StudentProfile.updateMany(
//       {
//         tenantId,
//         isdeleted: false,
//         status: 'ACTIVE',
//         batchId: batch.batchId
//       },
//       {
//         $set: {
//           currentAcademicYear: nextAcademicYear,
//           yearNo: nextYearNo,
//           classNo: nextClassNo,
//           updatedBy
//         },
//         $push: {
//           ayHistory: historyEntry
//         }
//       }
//     );
//     await pushYearToAyConfigIfMissing({
//       tenantId,
//       programId: batch.programId,
//       cohortAy: calc.cohortAy,
//       academicYear: nextAcademicYear,
//       classNo: nextClassNo,
//       userId: updatedBy
//     });
//     return res.status(constants.HTTPS_SUCCESS).json({
//       status: true,
//       message: `Batch promoted to ${nextAcademicYear} (Year ${nextYearNo}, Class ${nextClassNo})`,
//       data: updated
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

// const promoteBatch = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
//     const payload = req.body || {};
//     const batchId = safeTrim(payload.batchId);
//     const updatedBy = payload.userId || null;
//     if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });

//     const batch = await Batch.findOne({ tenantId, batchId, isdeleted: false });
//     if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });
//     if (batch.status !== 'ACTIVE') return res.status(400).json({ status: false, message: `Batch must be ACTIVE to promote. Current status: ${batch.status}` });

//     const program = await Program.findOne({ tenantId, programId: batch.programId, isdeleted: false }, { duration: 1, startingClass: 1 }).lean();
//     if (!program) return res.status(400).json({ status: false, message: 'Program not found' });

//     const duration = toIntYear(program.duration);
//     if (batch.yearNo >= duration) return res.status(400).json({ status: false, message: `Cannot promote: batch is already in final year (year ${batch.yearNo} of ${duration}). Close the batch instead.` });

//     const startAyMatch = String(batch.programStartAy).match(/^(\d{4})/);
//     const cohortStartYear = startAyMatch ? toIntYear(startAyMatch[1]) : 0;
//     if (!cohortStartYear) return res.status(400).json({ status: false, message: 'Cannot determine cohort start year from programStartAy' });

//     const calc = buildCohortAndRunningYears({ startYear: cohortStartYear, duration });
//     if (!calc) return res.status(400).json({ status: false, message: 'Unable to compute cohort academic years' });

//     const nextIdx = batch.yearNo;
//     if (nextIdx >= calc.runningYears.length) return res.status(400).json({ status: false, message: 'Next academic year not available in cohort configuration' });

//     const nextAcademicYear = calc.runningYears[nextIdx];
//     const nextYearNo = batch.yearNo + 1;
//     const nextClassNo = batch.classNo + 1;

//     const patch = { academicYear: nextAcademicYear, yearNo: nextYearNo, classNo: nextClassNo, updatedBy };
//     if (payload.startDate !== undefined) {
//       const sd = toEpoch(payload.startDate);
//       if (sd) patch.startDate = sd;
//     }
//     if (payload.endDate !== undefined) {
//       const ed = toEpoch(payload.endDate);
//       if (ed) patch.endDate = ed;
//     }

//     const effStart = patch.startDate ?? batch.startDate;
//     const effEnd = patch.endDate ?? batch.endDate;
//     if (effStart && effEnd && effStart >= effEnd) return res.status(400).json({ status: false, message: 'startDate must be before endDate' });

//     const updated = await Batch.findOneAndUpdate({ tenantId, batchId, isdeleted: false }, { $set: patch }, { new: true }).lean();
//     if (!updated) return res.status(404).json({ status: false, message: 'Batch not found during update' });

//     // ── Student profiles ──────────────────────────────────────────────────────
//     const historyEntry = {
//       academicYear: batch.academicYear, // OLD values — archive before overwrite
//       yearNo: batch.yearNo,
//       classNo: batch.classNo,
//       changedOn: Date.now(),
//       changedBy: updatedBy
//     };

//     // Step 1: update current fields on all batch students
//     await StudentProfile.updateMany(
//       { tenantId, isdeleted: false, status: 'ACTIVE', batchId: batch.batchId },
//       {
//         $set: {
//           currentAcademicYear: nextAcademicYear,
//           yearNo: nextYearNo,
//           classNo: nextClassNo,
//           updatedBy
//         }
//       }
//     );

//     // Step 2: push history only if this old AY entry not already recorded
//     // ✅ FIX: prevents duplicate history entries on retry/double-call
//     await StudentProfile.updateMany(
//       {
//         tenantId,
//         isdeleted: false,
//         status: 'ACTIVE',
//         batchId: batch.batchId,
//         ayHistory: {
//           $not: {
//             $elemMatch: {
//               academicYear: batch.academicYear,
//               yearNo: batch.yearNo,
//               classNo: batch.classNo
//             }
//           }
//         }
//       },
//       { $push: { ayHistory: historyEntry } }
//     );

//     // ── AcademicYearConfig ────────────────────────────────────────────────────
//     // ✅ FIX: pushYearToAyConfigIfMissing has a `y1 > getCurrentAyStartYear()`
//     //         guard that blocks future AYs — bypass it with a direct upsert
//     const ayMatch = String(nextAcademicYear).match(/^(\d{4})-(\d{4})$/);
//     const nextYearStart = ayMatch ? Number(ayMatch[1]) : 0;
//     const nextYearEnd = ayMatch ? Number(ayMatch[2]) : 0;

//     if (nextYearStart && nextYearEnd) {
//       await AcademicYearConfig.updateOne(
//         {
//           tenantId,
//           programId: batch.programId,
//           cohortAy: calc.cohortAy,
//           isdeleted: false,
//           'years.academicYear': { $ne: nextAcademicYear } // only push if missing
//         },
//         {
//           $push: {
//             years: {
//               academicYear: nextAcademicYear,
//               classNo: nextClassNo,
//               startOn: startOfAcademicYearEpoch(nextYearStart),
//               endOn: endOfAcademicYearEpoch(nextYearEnd)
//             }
//           },
//           $set: { updatedBy }
//         }
//       );
//     }
//     return res.status(constants.HTTPS_SUCCESS).json({
//       status: true,
//       message: `Batch promoted to ${nextAcademicYear} (Year ${nextYearNo}, Class ${nextClassNo})`,
//       data: updated
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const promoteBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const payload = req.body || {};
    const batchId = safeTrim(payload.batchId);
    const updatedBy = payload.userId || null;

    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });

    // ── Fetch batch ───────────────────────────────────────────────────────────
    const batch = await Batch.findOne({ tenantId, batchId, isdeleted: false });
    if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    if (batch.status !== 'ACTIVE') return res.status(400).json({ status: false, message: `Batch must be ACTIVE to promote. Current status: ${batch.status}` });

    // ── Fetch program ─────────────────────────────────────────────────────────
    const program = await Program.findOne({ tenantId, programId: batch.programId, isdeleted: false }, { duration: 1, startingClass: 1 }).lean();
    if (!program) return res.status(400).json({ status: false, message: 'Program not found' });

    const duration = toIntYear(program.duration);

    // ── Final year guard ──────────────────────────────────────────────────────
    if (batch.yearNo >= duration)
      return res.status(400).json({
        status: false,
        message: `Cannot promote: batch is already in final year (year ${batch.yearNo} of ${duration}). Close the batch instead.`
      });

    // ── Compute next AY from cohort ───────────────────────────────────────────
    const startAyMatch = String(batch.programStartAy).match(/^(\d{4})/);
    const cohortStartYear = startAyMatch ? toIntYear(startAyMatch[1]) : 0;
    if (!cohortStartYear) return res.status(400).json({ status: false, message: 'Cannot determine cohort start year from programStartAy' });

    const calc = buildCohortAndRunningYears({ startYear: cohortStartYear, duration });
    if (!calc) return res.status(400).json({ status: false, message: 'Unable to compute cohort academic years' });

    const nextIdx = batch.yearNo; // yearNo is 1-based, so yearNo=1 → index 1 → second AY
    if (nextIdx >= calc.runningYears.length) return res.status(400).json({ status: false, message: 'Next academic year not available in cohort configuration' });

    const nextAcademicYear = calc.runningYears[nextIdx];
    const nextYearNo = batch.yearNo + 1;
    const nextClassNo = batch.classNo + 1;

    // ── Optional date override from payload ───────────────────────────────────
    const patch = { academicYear: nextAcademicYear, yearNo: nextYearNo, classNo: nextClassNo, updatedBy };
    if (payload.startDate !== undefined) {
      const sd = toEpoch(payload.startDate);
      if (sd) patch.startDate = sd;
    }
    if (payload.endDate !== undefined) {
      const ed = toEpoch(payload.endDate);
      if (ed) patch.endDate = ed;
    }

    const effStart = patch.startDate ?? batch.startDate;
    const effEnd = patch.endDate ?? batch.endDate;
    if (effStart && effEnd && effStart >= effEnd) return res.status(400).json({ status: false, message: 'startDate must be before endDate' });

    // ── Update Batch ──────────────────────────────────────────────────────────
    const updated = await Batch.findOneAndUpdate({ tenantId, batchId, isdeleted: false }, { $set: patch }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Batch not found during update' });

    // ── Compute new AY epoch dates ────────────────────────────────────────────
    const ayMatch = String(nextAcademicYear).match(/^(\d{4})-(\d{4})$/);
    const nextYearStart = ayMatch ? Number(ayMatch[1]) : 0;
    const nextYearEnd = ayMatch ? Number(ayMatch[2]) : 0;
    const newStartOn = nextYearStart ? startOfAcademicYearEpoch(nextYearStart) : null;
    const newEndOn = nextYearEnd ? endOfAcademicYearEpoch(nextYearEnd) : null;

    // ── Update AcademicYearConfig ─────────────────────────────────────────────
    // Direct upsert — bypasses pushYearToAyConfigIfMissing which blocks future AYs
    // via `y1 > getCurrentAyStartYear()` guard
    if (nextYearStart && nextYearEnd) {
      await AcademicYearConfig.updateOne(
        {
          tenantId,
          programId: batch.programId,
          cohortAy: calc.cohortAy,
          isdeleted: false,
          'years.academicYear': { $ne: nextAcademicYear } // only push if missing
        },
        {
          $push: {
            years: {
              academicYear: nextAcademicYear,
              classNo: nextClassNo,
              startOn: newStartOn,
              endOn: newEndOn
            }
          },
          $set: { updatedBy }
        }
      );
    }

    // ── Update StudentProfiles ────────────────────────────────────────────────
    const now = Date.now();

    // Step 1: update current standing fields on all batch students
    await StudentProfile.updateMany(
      { tenantId, isdeleted: false, status: 'ACTIVE', batchId: batch.batchId },
      {
        $set: {
          currentAcademicYear: nextAcademicYear,
          yearNo: nextYearNo,
          classNo: nextClassNo,
          updatedBy
        }
      }
    );

    // Step 2: push OLD AY into ayHistory — duplicate guard makes it safe on retry
    await StudentProfile.updateMany(
      {
        tenantId,
        isdeleted: false,
        status: 'ACTIVE',
        batchId: batch.batchId,
        ayHistory: {
          $not: {
            $elemMatch: {
              academicYear: batch.academicYear,
              yearNo: batch.yearNo,
              classNo: batch.classNo
            }
          }
        }
      },
      {
        $push: {
          ayHistory: {
            academicYear: batch.academicYear, // OLD values — archived before overwrite
            yearNo: batch.yearNo,
            classNo: batch.classNo,
            startOn: null, // old AY dates not tracked retroactively
            endOn: null,
            changedOn: now,
            changedBy: updatedBy
          }
        }
      }
    );

    // Step 3: push NEW AY into ayHistory WITH startOn/endOn from AcademicYearConfig
    // This mirrors exactly what was pushed into AcademicYearConfig.years above
    await StudentProfile.updateMany(
      {
        tenantId,
        isdeleted: false,
        status: 'ACTIVE',
        batchId: batch.batchId,
        ayHistory: {
          $not: {
            $elemMatch: {
              academicYear: nextAcademicYear,
              yearNo: nextYearNo,
              classNo: nextClassNo
            }
          }
        }
      },
      {
        $push: {
          ayHistory: {
            academicYear: nextAcademicYear, // NEW values with dates
            yearNo: nextYearNo,
            classNo: nextClassNo,
            startOn: newStartOn, // ✅ mirrors AcademicYearConfig.years entry
            endOn: newEndOn, // ✅ mirrors AcademicYearConfig.years entry
            changedOn: now,
            changedBy: updatedBy
          }
        }
      }
    );

    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: `Batch promoted to ${nextAcademicYear} (Year ${nextYearNo}, Class ${nextClassNo})`,
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createBatch,
  listBatches,
  viewBatch,
  updateBatch,
  deleteBatch,
  closeBatch,
  saveBatchStaffMap,
  listEligibleStudentsForBatch,
  assignStudentsToBatch,
  moveStudentsToBatch,
  removeStudentsFromBatch,
  shuffleStudentsBetweenBatches,
  recalcBatchStudentCount,
  getBatchSubjects,
  getBatchAyInfo,
  listBatchesForEnablement,
  listTopicsForEnablement,
  listTestsForEnablement,
  promoteBatch
};

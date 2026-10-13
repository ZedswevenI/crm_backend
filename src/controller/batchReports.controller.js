import mongoose from 'mongoose';
import Batch from '../models/batch.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import Staff from '../models/staff.model.js';
import Subject from '../models/subject.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import TimeTable from '../models/timetable.model.js';
import Phase from '../models/phaseplan.model.js';
import BatchAssignEnable from '../models/batchenabledAssignment.model.js';
import MockExamBatchAssign from '../models/mockExambatchmapping.model.js';
import MockExam from '../models/mockExam.model.js';
import Assignment from '../models/assignment.model.js';
import PTM from '../models/ptm.model.js';
import ExamCategory from '../models/examcategory.model.js';
import ExamSubCategory from '../models/examsubcategory.model.js';
import Topic from '../models/topic.model.js';
import SubTopic from '../models/subtopic.model.js';
import Program from '../models/program.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pickTid = (req) => String(req?.body?.entiId || req?.body?.tenantId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const getPreviousMonday = (epochMs) => {
  const d = new Date(epochMs);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};

const DAY_ORDER = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
const normDay = (d) => String(d || '').toUpperCase();

// Reuse effective periods logic from timetable controller
const getEffectivePeriods = (tt, dateMs) => {
  if (!tt || !Array.isArray(tt.week)) return [];
  const targetDate = new Date(Number(dateMs));
  const utcDay = targetDate.getUTCDay();
  const dayStr = DAYS[utcDay];
  const targetUTC = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());

  const matchesDate = (oDateMs) => {
    const od = new Date(Number(oDateMs));
    const ovUTC = Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), od.getUTCDate());
    return ovUTC === targetUTC;
  };

  const baseDay = (tt.week || []).find((w) => String(w.day).toUpperCase() === dayStr);
  let periods = baseDay && Array.isArray(baseDay.periods) ? JSON.parse(JSON.stringify(baseDay.periods)) : [];

  for (const ov of tt.dayOverrides || []) {
    if (!matchesDate(ov.date)) continue;
    if (ov.action === 'CANCEL_DAY') return [];
    if (ov.action === 'REPLACE_DAY' && Array.isArray(ov.periods)) {
      periods = JSON.parse(JSON.stringify(ov.periods));
    }
  }

  const baseMap = new Map();
  periods.forEach((p) => {
    if (p.periodNo != null) baseMap.set(Number(p.periodNo), p);
  });

  const periodOvs = (tt.periodOverrides || []).filter((o) => matchesDate(o.date));
  for (const ov of periodOvs) {
    const fromNo = Number(ov.periodNo);
    if (!fromNo) continue;
    if (ov.action === 'CANCEL_PERIOD') baseMap.delete(fromNo);
    if (ov.action === 'REPLACE_PERIOD' && ov.period) baseMap.set(fromNo, { ...ov.period, periodNo: fromNo });
    if (ov.action === 'ADD_PERIOD' && ov.period) baseMap.set(fromNo, { ...ov.period, periodNo: fromNo });
  }

  const moves = periodOvs.filter((o) => o.action === 'MOVE_PERIOD');
  if (moves.length) {
    const snapshot = new Map(baseMap);
    const appliedMoves = new Set();
    for (const ov of moves) {
      const fromNo = Number(ov.periodNo),
        toNo = Number(ov.toPeriodNo);
      if (!fromNo || !toNo || fromNo === toNo) continue;
      const key = `${Math.min(fromNo, toNo)}-${Math.max(fromNo, toNo)}`;
      if (appliedMoves.has(key)) continue;
      appliedMoves.add(key);
      const fp = snapshot.get(fromNo),
        tp = snapshot.get(toNo);
      if (fp) baseMap.set(toNo, { ...fp, periodNo: toNo, time: tp?.time ?? fp.time });
      else baseMap.delete(toNo);
      if (tp) baseMap.set(fromNo, { ...tp, periodNo: fromNo, time: fp?.time ?? tp.time });
      else baseMap.delete(fromNo);
    }
  }

  return Array.from(baseMap.values()).sort((a, b) => (a.periodNo || 0) - (b.periodNo || 0));
};

const resolveBatch = async (tenantId, batchId, batchCode) => {
  const q = { tenantId, isdeleted: false };
  if (batchId) q.batchId = safeTrim(batchId);
  else if (batchCode) q.batchCode = safeTrim(batchCode);
  else return null;
  return Batch.findOne(q).lean();
};

const pickBatchIds = async (req) => {
  const arr = req.body?.batchIds;
  let batchIds = Array.isArray(arr) && arr.length ? arr.map(safeTrim).filter(Boolean) : [];
  const centerId = safeTrim(req.body?.centerId);
  if (centerId) {
    const tenantId = pickTid(req);
    const centerBatches = await Batch.find({ tenantId, centerId, isdeleted: false }, { batchId: 1 }).lean();
    const centerBatchIds = new Set(centerBatches.map((b) => b.batchId));
    batchIds = batchIds.length ? batchIds.filter((id) => centerBatchIds.has(id)) : [...centerBatchIds];
  }
  return batchIds;
};

const pickBatchCodes = async (req) => {
  const arr = req.body?.batchCodes;
  let batchCodes = Array.isArray(arr) && arr.length ? arr.map(safeTrim).filter(Boolean) : [];
  const centerId = safeTrim(req.body?.centerId);
  if (centerId) {
    const tenantId = pickTid(req);
    const centerBatches = await Batch.find({ tenantId, centerId, isdeleted: false }, { batchCode: 1 }).lean();
    const centerBatchCodes = new Set(centerBatches.map((b) => b.batchCode));
    batchCodes = batchCodes.length ? batchCodes.filter((c) => centerBatchCodes.has(c)) : [...centerBatchCodes];
  }
  return batchCodes;
};

const applyBatchIdFilter = (query, batchIds) => {
  if (batchIds.length === 1) query.batchId = batchIds[0];
  else if (batchIds.length > 1) query.batchId = { $in: batchIds };
};

const applyBatchCodeFilter = (query, batchCodes) => {
  if (batchCodes.length === 1) query.batchCode = batchCodes[0];
  else if (batchCodes.length > 1) query.batchCode = { $in: batchCodes };
};

const getStudentListReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchIds = await pickBatchIds(req);
    const search = safeTrim(req.body?.search || '');
    const status = safeTrim(req.body?.status || 'ACTIVE');
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const query = { tenantId, isdeleted: false };
    applyBatchIdFilter(query, batchIds);
    if (status && status !== 'ALL') query.status = status;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ admissionNo: rx }, { 'student.name': rx }, { 'student.phone': rx }, { registrationNumber: rx }];
    }
    const students = await StudentProfile.find(query).sort({ 'student.name': 1 }).lean();
    const data = students.map((s, idx) => ({
      slNo: idx + 1,
      studentId: s.studentId,
      admissionNo: s.admissionNo,
      registrationNumber: s.registrationNumber || null,
      name: s.student?.name || null,
      phone: s.student?.phone || null,
      email: s.student?.email || null,
      parentName: s.student?.parentName || null,
      parentPhone: s.student?.parentPhone || null,
      gender: s.student?.gender || null,
      dob: s.student?.dob || null,
      address: s.student?.addressLine1 || null,
      city: s.student?.city || null,
      batchCode: s.batchCode || null,
      batchName: s.batchName || null,
      academicYear: s.currentAcademicYear || s.academicYear || null,
      classNo: s.classNo || null,
      yearNo: s.yearNo || null,
      status: s.status
    }));
    return res.status(200).json({ status: true, count: data.length, data });
  } catch (err) {
    return next(err);
  }
};

const getStaffListReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const stBatchIds = await pickBatchIds(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const batchQuery = { tenantId, isdeleted: false };
    if (stBatchIds.length) batchQuery.batchId = { $in: stBatchIds };
    const batches = await Batch.find(batchQuery).lean();
    const allStaffIds = [...new Set(batches.flatMap((b) => (b.staffMap || []).map((s) => safeTrim(s.staffId)).filter(Boolean)))];
    const staffDocs = allStaffIds.length ? await Staff.find({ tenantId, staffId: { $in: allStaffIds }, isdeleted: false }).lean() : [];
    const staffDocMap = new Map(staffDocs.map((s) => [s.staffId, s]));
    let slNo = 0;
    const currentStaff = batches.flatMap((b) =>
      (b.staffMap || []).map((entry) => {
        const doc = staffDocMap.get(safeTrim(entry.staffId)) || {};
        return {
          slNo: ++slNo,
          batchCode: b.batchCode,
          batchName: b.batchName,
          staffId: entry.staffId,
          staffName: doc.staffName || entry.staffName || null,
          staffCode: doc.staffCode || null,
          subjectId: entry.subjectId || null,
          subjectName: entry.subjectName || null,
          facultyType: doc.facultyType || null,
          phone: doc.phone || null,
          email: doc.email || null,
          role: doc.role || null,
          status: doc.status || null
        };
      })
    );
    return res.status(200).json({ status: true, currentStaffCount: currentStaff.length, currentStaff });
  } catch (err) {
    return next(err);
  }
};

const getLateEntryReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchCode = safeTrim(req.body?.batchCode || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const type = safeTrim(req.body?.type || '');
    const entryType = safeTrim(req.body?.entryType || '');
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!fromDate) return res.status(400).json({ status: false, message: 'fromDate is required' });
    if (!toDate) return res.status(400).json({ status: false, message: 'toDate is required' });
    const batchCodes = await pickBatchCodes(req);
    const query = { tenantId, isdeleted: false, date: { $gte: fromDate, $lte: toDate } };
    applyBatchCodeFilter(query, batchCodes);
    if (type && ['STAFF', 'STUDENT'].includes(type.toUpperCase())) query.type = type.toUpperCase();
    if (entryType && ['LATE', 'EARLY_LEAVE'].includes(entryType.toUpperCase())) query.entryType = entryType.toUpperCase();
    const entries = await LateEntryLog.find(query).sort({ date: 1, periodNo: 1 }).lean();
    const formatDate = (ms) => {
      if (!ms) return null;
      const d = new Date(ms);
      return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
    };
    const data = entries.map((e, idx) => ({
      slNo: idx + 1,
      logId: e.logId,
      type: e.type,
      entryType: e.entryType || 'LATE',
      personId: e.personId,
      personName: e.personName || null,
      date: e.date,
      dateFormatted: formatDate(e.date),
      periodNo: e.periodNo,
      scheduledStartMin: e.scheduledStartMin,
      delayMinutes: e.delayMinutes,
      reason: e.reason || null
    }));
    const studentCount = data.filter((e) => e.type === 'STUDENT').length;
    const staffCount = data.filter((e) => e.type === 'STAFF').length;
    const lateCount = data.filter((e) => e.entryType === 'LATE').length;
    const earlyLeaveCount = data.filter((e) => e.entryType === 'EARLY_LEAVE').length;
    const byPerson = new Map();
    for (const e of data) {
      const key = e.personId;
      if (!byPerson.has(key)) byPerson.set(key, { personId: e.personId, personName: e.personName, type: e.type, count: 0 });
      byPerson.get(key).count++;
    }
    const personSummary = Array.from(byPerson.values()).sort((a, b) => b.count - a.count);
    return res.status(200).json({
      status: true,
      batchCode,
      fromDate,
      toDate,
      summary: { total: data.length, studentCount, staffCount, lateCount, earlyLeaveCount },
      personSummary,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getTimetableReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchCode = safeTrim(req.body?.batchCode || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const subjectId = safeTrim(req.body?.subjectId || '');
    const mode = safeTrim(req.body?.mode || '').toUpperCase();
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!fromDate) return res.status(400).json({ status: false, message: 'fromDate is required' });
    const effectiveToDate = toDate || fromDate;
    const msPerDay = 86400000;
    if (effectiveToDate - fromDate > 31 * msPerDay) {
      return res.status(400).json({ status: false, message: 'Date range cannot exceed 31 days' });
    }
    const weekStarts = new Set();
    let curr = fromDate;
    while (curr <= effectiveToDate) {
      weekStarts.add(getPreviousMonday(curr));
      curr += msPerDay;
    }
    const batchCodes = await pickBatchCodes(req);
    const ttQuery = { tenantId, wkStartOn: { $in: [...weekStarts] }, status: 'Active', isdeleted: false };
    applyBatchCodeFilter(ttQuery, batchCodes);
    const timetables = await TimeTable.find(ttQuery).lean();
    const ttBatchCodes = [...new Set([batchCode, ...timetables.map((tt) => tt.batchCode)].filter(Boolean))];
    const ttBatches = ttBatchCodes.length ? await Batch.find({ tenantId, batchCode: { $in: ttBatchCodes } }, { batchCode: 1, batchName: 1 }).lean() : [];
    const ttBatchNameMap = new Map(ttBatches.map((b) => [b.batchCode, b.batchName]));
    const ttMap = new Map(timetables.map((tt) => [tt.wkStartOn, tt]));
    const schedule = [];
    curr = fromDate;
    while (curr <= effectiveToDate) {
      const wkStart = getPreviousMonday(curr);
      const tt = ttMap.get(wkStart);
      if (!tt) {
        const d = new Date(curr);
        schedule.push({ date: curr, day: DAYS[d.getUTCDay()], isHoliday: false, periods: [], timetableId: null });
      } else {
        const periods = getEffectivePeriods(tt, curr);
        const d = new Date(curr);
        schedule.push({
          date: curr,
          day: DAYS[d.getUTCDay()],
          batchCode: tt.batchCode,
          batchName: ttBatchNameMap.get(tt.batchCode) || null,
          timetableId: String(tt._id),
          isHoliday: false,
          periods: periods
            .filter((p) => {
              if (subjectId && safeTrim(p.subjectId) !== subjectId) return false;
              if (mode && safeTrim(p.mode).toUpperCase() !== mode) return false;
              return true;
            })
            .map((p) => ({
              periodNo: p.periodNo,
              periodType: p.periodType || null,
              mode: p.mode || null,
              subjectId: p.subjectId || null,
              subjectName: p.subjectName || null,
              facultyId: p.facultyId || null,
              facultyName: p.facultyName || null,
              startTime: p.time?.startLabel || null,
              endTime: p.time?.endLabel || null,
              startMin: p.time?.startMin || null,
              endMin: p.time?.endMin || null,
              venue: p.venue || null,
              topic: p.topic || null,
              isCancelled: !!p.isCancelled
            }))
        });
      }
      curr += msPerDay;
    }
    const totalPeriods = schedule.reduce((s, d) => s + d.periods.filter((p) => !p.isCancelled).length, 0);
    const cancelledCount = schedule.reduce((s, d) => s + d.periods.filter((p) => p.isCancelled).length, 0);
    return res.status(200).json({
      status: true,
      batchCode,
      batchName: batchCode ? ttBatchNameMap.get(batchCode) || null : null,
      fromDate,
      toDate: effectiveToDate,
      summary: { totalDays: schedule.length, totalPeriods, cancelledCount },
      data: schedule
    });
  } catch (err) {
    return next(err);
  }
};

// const getPhaseAllotmentReport = async (req, res, next) => {
//   try {
//     const tenantId = pickTid(req);
//     const batchId = safeTrim(req.body?.batchId || '');
//     const batchCode = safeTrim(req.body?.batchCode || '');
//     const subjectId = safeTrim(req.body?.subjectId || '');
//     const programIds = Array.isArray(req.body?.programIds) ? req.body.programIds.filter(Boolean) : [];
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
//     const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
//     if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });
//     const paBatchIds = pickBatchIds(req);
//     const paBatches = paBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: paBatchIds }, isdeleted: false }).lean() : batch ? [batch] : null;
//     const ttFilter = { tenantId, isdeleted: false, status: 'Active' };
//     if (paBatches)
//       applyBatchCodeFilter(
//         ttFilter,
//         paBatches.map((b) => b.batchCode)
//       );
//     const timetables = await TimeTable.find(ttFilter).lean();
//     const subjectPhaseMins = new Map();
//     const subjectTotalMins = new Map();
//     const countPeriod = (p) => {
//       if (p?.isCancelled) return;
//       const sid = safeTrim(p?.subjectId);
//       const phId = safeTrim(p?.phaseId || '');
//       if (!sid) return;
//       if (subjectId && sid !== subjectId) return;
//       const start = toInt(p?.time?.startMin, -1);
//       const end = toInt(p?.time?.endMin, -1);
//       if (start < 0 || end <= start) return;
//       const mins = end - start;
//       subjectTotalMins.set(sid, (subjectTotalMins.get(sid) || 0) + mins);
//       const key = `${sid}_${phId}`;
//       subjectPhaseMins.set(key, (subjectPhaseMins.get(key) || 0) + mins);
//     };
//     for (const tt of timetables) {
//       for (const dayObj of tt.week || []) {
//         for (const p of dayObj.periods || []) countPeriod(p);
//       }
//       for (const ov of tt.dayOverrides || []) {
//         if (ov.action === 'CANCEL_DAY') continue;
//         if (ov.action === 'REPLACE_DAY') {
//           for (const p of ov.periods || []) countPeriod(p);
//         }
//       }
//       const ovrMap = new Map();
//       for (const ov of tt.periodOverrides || []) {
//         const k = `${ov.date}_${normDay(ov.day)}_${ov.periodNo}`;
//         ovrMap.set(k, ov);
//       }
//       for (const ov of ovrMap.values()) {
//         if (ov.action === 'CANCEL_PERIOD') {
//           const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
//           const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
//           if (base && !base.isCancelled) {
//             const sid = safeTrim(base.subjectId);
//             const phId = safeTrim(base.phaseId || '');
//             const start = toInt(base.time?.startMin, -1);
//             const end = toInt(base.time?.endMin, -1);
//             if (sid && start >= 0 && end > start) {
//               if (!subjectId || sid === subjectId) {
//                 const mins = end - start;
//                 const key = `${sid}_${phId}`;
//                 subjectPhaseMins.set(key, Math.max(0, (subjectPhaseMins.get(key) || 0) - mins));
//                 subjectTotalMins.set(sid, Math.max(0, (subjectTotalMins.get(sid) || 0) - mins));
//               }
//             }
//           }
//         } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
//           const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
//           const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
//           if (base && !base.isCancelled) {
//             const sid = safeTrim(base.subjectId);
//             const phId = safeTrim(base.phaseId || '');
//             const start = toInt(base.time?.startMin, -1);
//             const end = toInt(base.time?.endMin, -1);
//             if (sid && start >= 0 && end > start) {
//               if (!subjectId || sid === subjectId) {
//                 const mins = end - start;
//                 const key = `${sid}_${phId}`;
//                 subjectPhaseMins.set(key, Math.max(0, (subjectPhaseMins.get(key) || 0) - mins));
//                 subjectTotalMins.set(sid, Math.max(0, (subjectTotalMins.get(sid) || 0) - mins));
//               }
//             }
//           }
//           countPeriod({ ...ov.period, periodNo: ov.periodNo });
//         } else if (ov.action === 'ADD_PERIOD' && ov.period) {
//           countPeriod({ ...ov.period, periodNo: ov.periodNo });
//         }
//       }
//     }
//     const phaseQuery = { tenantId, isdeleted: false, status: 'Active' };
//     if (batch) {
//       phaseQuery.programId = batch.programId;
//       phaseQuery.classNo = batch.classNo;
//     } else if (programIds.length) {
//       const progBatches = await Batch.find(
//         {
//           tenantId,
//           programId: { $in: programIds },
//           isdeleted: false
//         },
//         { programId: 1, classNo: 1 }
//       ).lean();
//       const classNos = [...new Set(progBatches.map((b) => b.classNo).filter(Boolean))];
//       if (classNos.length) phaseQuery.classNo = { $in: classNos };
//       phaseQuery.programId = programIds.length === 1 ? programIds[0] : { $in: programIds };
//     }
//     if (subjectId) phaseQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
//     const phases = await Phase.find(phaseQuery).sort({ subjectId: 1, sortOrder: 1 }).lean();
//     const phasesBySubject = new Map();
//     for (const ph of phases) {
//       const sid = String(ph.subjectId);
//       if (!phasesBySubject.has(sid)) phasesBySubject.set(sid, []);
//       phasesBySubject.get(sid).push(ph);
//     }
//     const toHours = (mins) => round2(mins / 60);
//     const subjectIds = subjectId ? [subjectId] : [...new Set([...subjectTotalMins.keys(), ...phasesBySubject.keys()])];
//     const subjectDocs = await Subject.find(
//       {
//         _id: {
//           $in: subjectIds
//             .map((id) => {
//               try {
//                 return new mongoose.Types.ObjectId(id);
//               } catch {
//                 return null;
//               }
//             })
//             .filter(Boolean)
//         },
//         isdeleted: false
//       },
//       { subjectName: 1, subjectCode: 1 }
//     ).lean();
//     const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));
//     // const data = subjectIds.map((sid) => {
//     //   const subDoc = subjectDocMap.get(sid) || {};
//     //   const totalAllocMins = subjectTotalMins.get(sid) || 0;
//     //   const subjectPhases = phasesBySubject.get(sid) || [];
//     //   let totalEstMins = 0;
//     //   const phasesReport = subjectPhases
//     //     .map((ph) => {
//     //       const phAllotMins = subjectPhaseMins.get(`${sid}_${ph.phaseId}`) || 0;
//     //       const phEstMins = (ph.topics || []).reduce((s, t) => s + (t.estHours || 0) * 60, 0);
//     //       totalEstMins += phEstMins;

//     //       const topicsReport = (ph.topics || [])
//     //         .map((t) => {
//     //           const estMins = (t.estHours || 0) * 60;
//     //           return {
//     //             topicName: t.topicName,
//     //             estHours: t.estHours || 0,
//     //             sortOrder: t.sortOrder || 0
//     //           };
//     //         })
//     //         .sort((a, b) => a.sortOrder - b.sortOrder);
//     //       const remainingMins = phEstMins - phAllotMins;
//     //       const progressPct = phEstMins > 0 ? round2((phAllotMins / phEstMins) * 100) : null;
//     //       return {
//     //         phaseId: ph.phaseId,
//     //         phaseName: ph.phaseName,
//     //         sortOrder: ph.sortOrder || 0,
//     //         estHours: toHours(phEstMins),
//     //         allottedHours: toHours(phAllotMins),
//     //         remainingHours: toHours(remainingMins),
//     //         progressPct,
//     //         topics: topicsReport
//     //       };
//     //     })
//     //     .sort((a, b) => a.sortOrder - b.sortOrder);
//     //   const unassignedKey = `${sid}_`;
//     //   const unassignedMins = subjectPhaseMins.get(unassignedKey) || 0;
//     //   const totalRemMins = totalEstMins - totalAllocMins;
//     //   return {
//     //     subjectId: sid,
//     //     subjectName: subDoc.subjectName || null,
//     //     subjectCode: subDoc.subjectCode || null,
//     //     totalEstHours: toHours(totalEstMins),
//     //     totalAllottedHours: toHours(totalAllocMins),
//     //     totalRemainingHours: toHours(totalRemMins),
//     //     overallProgressPct: totalEstMins > 0 ? round2((totalAllocMins / totalEstMins) * 100) : null,
//     //     unassignedHours: toHours(unassignedMins),
//     //     phases: phasesReport
//     //   };
//     // });
//     const batchSubjectMinsMap = new Map();
//     for (const tt of timetables) {
//       for (const dayObj of tt.week || []) {
//         for (const p of dayObj.periods || []) {
//           if (p?.isCancelled) continue;
//           const sid = safeTrim(p?.subjectId);
//           if (!sid) continue;
//           if (subjectId && sid !== subjectId) continue;
//           const start = toInt(p?.time?.startMin, -1);
//           const end = toInt(p?.time?.endMin, -1);
//           if (start < 0 || end <= start) continue;
//           const mins = end - start;
//           const phId = safeTrim(p?.phaseId || '');
//           const batchKey = `${tt.batchCode}_${sid}_${phId}`;
//           batchSubjectMinsMap.set(batchKey, (batchSubjectMinsMap.get(batchKey) || 0) + mins);
//         }
//       }
//     }
//     const batchInfoMap = new Map((paBatches || []).map((b) => [b.batchCode, b]));
//     const batchSubjectKeys = new Set();
//     for (const key of batchSubjectMinsMap.keys()) {
//       const parts = key.split('_');
//       const batchCode = parts[0];
//       const sid = parts.slice(1, parts.length - 1).join('_');
//       batchSubjectKeys.add(`${batchCode}_${sid}`);
//     }
//     const data = [];
//     for (const bsKey of batchSubjectKeys) {
//       const underscoreIdx = bsKey.indexOf('_');
//       const batchCode = bsKey.substring(0, underscoreIdx);
//       const sid = bsKey.substring(underscoreIdx + 1);
//       const batchInfo = batchInfoMap.get(batchCode) || {};
//       const subDoc = subjectDocMap.get(sid) || {};
//       const subjectPhases = phasesBySubject.get(sid) || [];
//       let totalEstMins = 0;
//       let totalAllocMins = 0;
//       const phasesReport = subjectPhases
//         .map((ph) => {
//           const phAllotMins = batchSubjectMinsMap.get(`${batchCode}_${sid}_${ph.phaseId}`) || 0;
//           const phEstMins = (ph.topics || []).reduce((s, t) => s + (t.estHours || 0) * 60, 0);
//           totalEstMins += phEstMins;
//           totalAllocMins += phAllotMins;
//           const remainingMins = phEstMins - phAllotMins;
//           const progressPct = phEstMins > 0 ? round2((phAllotMins / phEstMins) * 100) : null;
//           return {
//             phaseId: ph.phaseId,
//             phaseName: ph.phaseName,
//             sortOrder: ph.sortOrder || 0,
//             estHours: toHours(phEstMins),
//             allottedHours: toHours(phAllotMins),
//             remainingHours: toHours(remainingMins),
//             progressPct
//           };
//         })
//         .sort((a, b) => a.sortOrder - b.sortOrder);
//       const unassignedKey = `${batchCode}_${sid}_`;
//       const unassignedMins = batchSubjectMinsMap.get(unassignedKey) || 0;
//       const totalRemMins = totalEstMins - totalAllocMins;
//       data.push({
//         batchCode,
//         batchName: batchInfo.batchName || null,
//         subjectId: sid,
//         subjectName: subDoc.subjectName || null,
//         subjectCode: subDoc.subjectCode || null,
//         totalEstHours: toHours(totalEstMins),
//         totalAllottedHours: toHours(totalAllocMins),
//         totalRemainingHours: toHours(totalRemMins),
//         overallProgressPct: totalEstMins > 0 ? round2((totalAllocMins / totalEstMins) * 100) : null,
//         unassignedHours: toHours(unassignedMins),
//         phases: phasesReport
//       });
//     }
//     data.sort((a, b) => {
//       const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
//       if (bc !== 0) return bc;
//       return (a.subjectName || '').localeCompare(b.subjectName || '');
//     });
//     return res.status(200).json({
//       status: true,
//       batchCode: batch?.batchCode || null,
//       batchName: batch?.batchName || null,
//       programId: batch?.programId || null,
//       classNo: batch?.classNo || null,
//       count: data.length,
//       data
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const getPhaseAllotmentReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId || '');
    const batchCode = safeTrim(req.body?.batchCode || '');
    const subjectId = safeTrim(req.body?.subjectId || '');
    const programIds = Array.isArray(req.body?.programIds) ? req.body.programIds.filter(Boolean) : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
    if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    const paBatchIds = await pickBatchIds(req);
    const paBatches = paBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: paBatchIds }, isdeleted: false }).lean() : batch ? [batch] : null;
    const ttFilter = { tenantId, isdeleted: false, status: 'Active' };
    if (paBatches)
      applyBatchCodeFilter(
        ttFilter,
        paBatches.map((b) => b.batchCode)
      );
    const timetables = await TimeTable.find(ttFilter).lean();
    if (!timetables.length) {
      return res.status(200).json({
        status: true,
        batchCode: batch?.batchCode || null,
        batchName: batch?.batchName || null,
        count: 0,
        data: []
      });
    }
    const batchSubjectMinsMap = new Map();
    const countBatchPeriod = (p, bc) => {
      if (p?.isCancelled) return;
      const sid = safeTrim(p?.subjectId);
      if (!sid) return;
      if (subjectId && sid !== subjectId) return;
      const start = toInt(p?.time?.startMin, -1);
      const end = toInt(p?.time?.endMin, -1);
      if (start < 0 || end <= start) return;
      const mins = end - start;
      const phId = safeTrim(p?.phaseId || '');
      const key = `${bc}::${sid}::${phId}`;
      batchSubjectMinsMap.set(key, (batchSubjectMinsMap.get(key) || 0) + mins);
    };
    for (const tt of timetables) {
      const bc = tt.batchCode;
      for (const dayObj of tt.week || []) {
        for (const p of dayObj.periods || []) countBatchPeriod(p, bc);
      }
      for (const ov of tt.dayOverrides || []) {
        if (ov.action === 'CANCEL_DAY') continue;
        if (ov.action === 'REPLACE_DAY') {
          for (const p of ov.periods || []) countBatchPeriod(p, bc);
        }
      }
      const ovrMap = new Map();
      for (const ov of tt.periodOverrides || []) {
        const k = `${ov.date}_${normDay(ov.day)}_${ov.periodNo}`;
        ovrMap.set(k, ov);
      }
      for (const ov of ovrMap.values()) {
        if (ov.action === 'CANCEL_PERIOD') {
          const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
          const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
          if (base && !base.isCancelled) {
            const sid = safeTrim(base.subjectId);
            const phId = safeTrim(base.phaseId || '');
            const start = toInt(base.time?.startMin, -1);
            const end = toInt(base.time?.endMin, -1);
            if (sid && start >= 0 && end > start) {
              if (!subjectId || sid === subjectId) {
                const mins = end - start;
                const key = `${bc}::${sid}::${phId}`;
                batchSubjectMinsMap.set(key, Math.max(0, (batchSubjectMinsMap.get(key) || 0) - mins));
              }
            }
          }
        } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
          const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
          const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
          if (base && !base.isCancelled) {
            const sid = safeTrim(base.subjectId);
            const phId = safeTrim(base.phaseId || '');
            const start = toInt(base.time?.startMin, -1);
            const end = toInt(base.time?.endMin, -1);
            if (sid && start >= 0 && end > start) {
              if (!subjectId || sid === subjectId) {
                const mins = end - start;
                const key = `${bc}::${sid}::${phId}`;
                batchSubjectMinsMap.set(key, Math.max(0, (batchSubjectMinsMap.get(key) || 0) - mins));
              }
            }
          }
          countBatchPeriod({ ...ov.period, periodNo: ov.periodNo }, bc);
        } else if (ov.action === 'ADD_PERIOD' && ov.period) {
          countBatchPeriod({ ...ov.period, periodNo: ov.periodNo }, bc);
        }
      }
    }
    const phaseQuery = { tenantId, isdeleted: false, status: 'Active' };
    if (batch) {
      phaseQuery.programId = batch.programId;
      phaseQuery.classNo = batch.classNo;
    } else if (paBatches && paBatches.length) {
      const programIdSet = [...new Set(paBatches.map((b) => b.programId).filter(Boolean))];
      const classNoSet = [...new Set(paBatches.map((b) => b.classNo).filter(Boolean))];
      if (programIdSet.length === 1) phaseQuery.programId = programIdSet[0];
      else if (programIdSet.length > 1) phaseQuery.programId = { $in: programIdSet };
      if (classNoSet.length === 1) phaseQuery.classNo = classNoSet[0];
      else if (classNoSet.length > 1) phaseQuery.classNo = { $in: classNoSet };
    } else if (programIds.length) {
      const progBatches = await Batch.find({ tenantId, programId: { $in: programIds }, isdeleted: false }, { programId: 1, classNo: 1 }).lean();
      const classNos = [...new Set(progBatches.map((b) => b.classNo).filter(Boolean))];
      if (classNos.length) phaseQuery.classNo = { $in: classNos };
      phaseQuery.programId = programIds.length === 1 ? programIds[0] : { $in: programIds };
    }
    if (subjectId) phaseQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
    const phases = await Phase.find(phaseQuery).sort({ subjectId: 1, sortOrder: 1 }).lean();
    const phasesBySubject = new Map();
    for (const ph of phases) {
      const sid = String(ph.subjectId);
      if (!phasesBySubject.has(sid)) phasesBySubject.set(sid, []);
      phasesBySubject.get(sid).push(ph);
    }
    const batchSubjectKeys = new Set();
    for (const key of batchSubjectMinsMap.keys()) {
      const parts = key.split('::');
      const bc = parts[0];
      const sid = parts[1];
      if (bc && sid) batchSubjectKeys.add(`${bc}::${sid}`);
    }
    if (paBatches) {
      for (const b of paBatches) {
        for (const [sid] of phasesBySubject.entries()) {
          batchSubjectKeys.add(`${b.batchCode}::${sid}`);
        }
      }
    }
    const subjectIds = [
      ...new Set(
        Array.from(batchSubjectKeys)
          .map((key) => key.split('::')[1])
          .filter(Boolean)
      )
    ];
    const subjectDocs = await Subject.find(
      {
        _id: {
          $in: subjectIds
            .map((id) => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        },
        isdeleted: false
      },
      { subjectName: 1, subjectCode: 1 }
    ).lean();
    const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));
    const batchInfoMap = new Map((paBatches || []).map((b) => [b.batchCode, b]));
    const toHours = (mins) => round2(mins / 60);
    const data = [];
    for (const bsKey of batchSubjectKeys) {
      const [bc, sid] = bsKey.split('::');
      if (!bc || !sid) continue;
      const batchInfo = batchInfoMap.get(bc) || {};
      const subDoc = subjectDocMap.get(sid) || {};
      const subjectPhases = phasesBySubject.get(sid) || [];
      let totalEstMins = 0;
      let totalAllocMins = 0;
      const phasesReport = subjectPhases
        .map((ph) => {
          const phAllotMins = batchSubjectMinsMap.get(`${bc}::${sid}::${ph.phaseId}`) || 0;
          const phEstMins = (ph.topics || []).reduce((s, t) => s + (t.estHours || 0) * 60, 0);
          totalEstMins += phEstMins;
          totalAllocMins += phAllotMins;
          const remainingMins = phEstMins - phAllotMins;
          const progressPct = phEstMins > 0 ? round2((phAllotMins / phEstMins) * 100) : null;
          return {
            phaseId: ph.phaseId,
            phaseName: ph.phaseName,
            sortOrder: ph.sortOrder || 0,
            estHours: toHours(phEstMins),
            allottedHours: toHours(phAllotMins),
            remainingHours: toHours(remainingMins),
            progressPct
          };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const unassignedMins = batchSubjectMinsMap.get(`${bc}::${sid}::`) || 0;
      if (unassignedMins > 0) {
        totalAllocMins += unassignedMins;
        phasesReport.push({
          phaseId: null,
          phaseName: 'Unassigned',
          sortOrder: 9999,
          estHours: 0,
          allottedHours: toHours(unassignedMins),
          remainingHours: toHours(-unassignedMins),
          progressPct: null
        });
      }
      const totalRemMins = totalEstMins - totalAllocMins;
      data.push({
        batchCode: bc,
        batchName: batchInfo.batchName || null,
        subjectId: sid,
        subjectName: subDoc.subjectName || null,
        subjectCode: subDoc.subjectCode || null,
        totalEstHours: toHours(totalEstMins),
        totalAllottedHours: toHours(totalAllocMins),
        totalRemainingHours: toHours(totalRemMins),
        overallProgressPct: totalEstMins > 0 ? round2((totalAllocMins / totalEstMins) * 100) : null,
        unassignedHours: toHours(unassignedMins),
        phases: phasesReport
      });
    }
    data.sort((a, b) => {
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
      return (a.subjectName || '').localeCompare(b.subjectName || '');
    });
    return res.status(200).json({
      status: true,
      batchCode: batch?.batchCode || null,
      batchName: batch?.batchName || null,
      programId: batch?.programId || null,
      classNo: batch?.classNo || null,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getAssignmentCompletionReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId || '');
    const batchCode = safeTrim(req.body?.batchCode || '');
    const subjectId = safeTrim(req.body?.subjectId || '');

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
    if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });

    const abBatchIds = await pickBatchIds(req);
    const query = { tenantId, isdeleted: false, status: 'enabled' };
    applyBatchIdFilter(query, abBatchIds);
    if (subjectId) query.subjectId = subjectId;

    const enabledTests = await BatchAssignEnable.find(query).lean();
    if (!enabledTests.length) {
      return res.status(200).json({ status: true, batchCode: batch?.batchCode || null, count: 0, data: [] });
    }

    // Fetch assignment meta for enrichment
    const testIds = enabledTests.map((t) => t.testId).filter(Boolean);
    const assignments = await Assignment.find({ tenantId, testId: { $in: testIds }, isdeleted: false }, { testId: 1, testNo: 1, testCode: 1, subjectId: 1, topicId: 1, classNo: 1 }).lean();
    const assignMap = new Map(assignments.map((a) => [a.testId, a]));

    // Fetch subject names
    const subjectIds = [...new Set(enabledTests.map((t) => t.subjectId).filter(Boolean))];
    const subjectDocs = await Subject.find(
      {
        _id: {
          $in: subjectIds
            .map((id) => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        }
      },
      { subjectName: 1, subjectCode: 1 }
    ).lean();
    const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));

    const data = enabledTests.map((t) => {
      const students = Array.isArray(t.students) ? t.students : [];
      const total = students.length;
      const completed = students.filter((s) => s.status === 'COMPLETED').length;
      const inProgress = students.filter((s) => s.status === 'IN_PROGRESS').length;
      const assigned = students.filter((s) => s.status === 'ASSIGNED').length;
      const completionPct = total > 0 ? round2((completed / total) * 100) : 0;

      const meta = assignMap.get(t.testId) || {};
      const subDoc = subjectDocMap.get(t.subjectId) || {};

      return {
        testId: t.testId,
        testNo: meta.testNo || t.testNo || null,
        testCode: meta.testCode || null,
        subjectId: t.subjectId,
        subjectName: subDoc.subjectName || null,
        subjectCode: subDoc.subjectCode || null,
        classNo: t.classNo || meta.classNo || null,
        enabledAt: t.enabledAt,
        totalStudents: total,
        completed,
        inProgress,
        assigned,
        completionPct
      };
    });

    // Summary
    const totalTests = data.length;
    const totalStudents = data.reduce((s, t) => s + t.totalStudents, 0);
    const totalCompleted = data.reduce((s, t) => s + t.completed, 0);

    return res.status(200).json({
      status: true,
      batchCode: batch?.batchCode || null,
      batchName: batch?.batchName || null,
      summary: { totalTests, totalStudents, totalCompleted },
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getExamCompletionReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId || '');
    const batchCode = safeTrim(req.body?.batchCode || '');

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
    if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });

    const exBatchIds = await pickBatchIds(req);
    const assignQuery = { tenantId, isdeleted: false };
    applyBatchIdFilter(assignQuery, exBatchIds);
    const assigns = await MockExamBatchAssign.find(assignQuery).lean();

    if (!assigns.length) {
      return res.status(200).json({ status: true, batchCode: batch?.batchCode || null, count: 0, data: [] });
    }

    // Fetch exam meta
    const examIds = assigns.map((a) => a.examId).filter(Boolean);
    const examDocs = await MockExam.find({ tenantId, examId: { $in: examIds }, isdeleted: false }, { examId: 1, examCode: 1, examName: 1, totalMarks: 1, startTime: 1, endTime: 1, status: 1, duration: 1 }).lean();
    const examMap = new Map(examDocs.map((e) => [e.examId, e]));

    const data = assigns.map((a) => {
      const students = Array.isArray(a.students) ? a.students : [];
      const total = students.length;
      const completed = students.filter((s) => s.status === 'completed').length;
      const started = students.filter((s) => s.status === 'started').length;
      const absent = students.filter((s) => s.status === 'absent').length;
      const assigned = students.filter((s) => s.status === 'assigned').length;
      const completionPct = total > 0 ? round2((completed / total) * 100) : 0;

      const exam = examMap.get(a.examId) || {};

      return {
        examId: a.examId,
        examCode: exam.examCode || null,
        examName: exam.examName || null,
        totalMarks: exam.totalMarks || null,
        duration: exam.duration || null,
        startTime: exam.startTime || null,
        endTime: exam.endTime || null,
        examStatus: exam.status || null,
        batchStatus: a.status,
        enabledAt: a.enabledAt,
        totalStudents: total,
        completed,
        started,
        absent,
        assigned,
        completionPct
      };
    });

    const summary = {
      totalExams: data.length,
      totalCompleted: data.reduce((s, e) => s + e.completed, 0),
      totalStudents: data[0]?.totalStudents || 0
    };

    return res.status(200).json({
      status: true,
      batchCode: batch?.batchCode || null,
      batchName: batch?.batchName || null,
      summary,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchInfoReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const programId = safeTrim(req.body?.programId || '');
    const centerId = safeTrim(req.body?.centerId || '');
    const academicYear = safeTrim(req.body?.academicYear || '');
    const status = safeTrim(req.body?.status || '');
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const query = { tenantId, isdeleted: false };
    const programIds = Array.isArray(req.body?.programIds) ? req.body.programIds.filter(Boolean) : [];
    const centerIds = Array.isArray(req.body?.centerIds) ? req.body.centerIds.filter(Boolean) : [];
    if (programIds.length === 1) query.programId = programIds[0];
    else if (programIds.length > 1) query.programId = { $in: programIds };
    if (centerIds.length === 1) query.centerId = centerIds[0];
    else if (centerIds.length > 1) query.centerId = { $in: centerIds };
    if (academicYear) query.academicYear = academicYear;
    if (status && status !== 'ALL') query.status = status;
    const batches = await Batch.find(query).sort({ centerName: 1, programName: 1, academicYear: 1, batchName: 1 }).lean();
    const data = batches.map((b, idx) => ({
      slNo: idx + 1,
      batchId: b.batchId,
      batchCode: b.batchCode,
      batchName: b.batchName,
      programId: b.programId,
      programName: b.programName || null,
      programCode: b.programCode || null,
      centerId: b.centerId,
      centerName: b.centerName || null,
      centerCode: b.centerCode || null,
      academicYear: b.academicYear,
      yearNo: b.yearNo,
      classNo: b.classNo,
      section: b.section || null,
      status: b.status,
      studentCount: b.studentCount || 0,
      staffCount: Array.isArray(b.staffMap) ? b.staffMap.length : 0,
      classTeacherId: b.classTeacherId || null,
      classTeacherName: b.classTeacherName || null,
      startDate: b.startDate || null,
      endDate: b.endDate || null,
      remarks: b.remarks || null
    }));
    const byCenterMap = new Map();
    for (const b of data) {
      const key = b.centerName || b.centerId;
      if (!byCenterMap.has(key)) byCenterMap.set(key, { centerName: key, batches: [] });
      byCenterMap.get(key).batches.push(b);
    }
    const byCenter = Array.from(byCenterMap.values());
    return res.status(200).json({
      status: true,
      count: data.length,
      summary: {
        totalBatches: data.length,
        activeBatches: data.filter((b) => b.status === 'ACTIVE').length,
        totalStudents: data.reduce((s, b) => s + b.studentCount, 0)
      },
      byCenter,
      data
    });
  } catch (err) {
    return next(err);
  }
};

// const getSubjectHoursReport = async (req, res, next) => {
//   try {
//     const tenantId = pickTid(req);
//     const batchId = safeTrim(req.body?.batchId || '');
//     const batchCode = safeTrim(req.body?.batchCode || '');
//     const phaseId = safeTrim(req.body?.phaseId || '');
//     const filterSubjectId = safeTrim(req.body?.subjectId || '');
//     const fromDate = toInt(req.body?.fromDate, 0);
//     const toDate = toInt(req.body?.toDate, 0);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
//     const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
//     if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });
//     const shBatchIds = pickBatchIds(req);
//     const shBatches = shBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: shBatchIds }, isdeleted: false }).lean() : batch ? [batch] : null;
//     const shTtQuery = { tenantId, isdeleted: false, status: 'Active' };
//     if (shBatches)
//       applyBatchCodeFilter(
//         shTtQuery,
//         shBatches.map((b) => b.batchCode)
//       );
//     if (fromDate) {
//       const fromMonday = getPreviousMonday(fromDate);
//       shTtQuery.wkStartOn = { $gte: fromMonday };
//     }
//     if (toDate) {
//       const toMonday = getPreviousMonday(toDate);
//       shTtQuery.wkStartOn = { ...shTtQuery.wkStartOn, $lte: toMonday };
//     }
//     const timetables = await TimeTable.find(shTtQuery).lean();
//     if (!timetables.length) {
//       return res.status(200).json({
//         status: true,
//         batchCode: batch?.batchCode || null,
//         count: 0,
//         data: [],
//         summary: { totalAllottedHours: 0 }
//       });
//     }
//     const batchNameMap = new Map((shBatches || []).map((b) => [b.batchCode, b.batchName]));
//     const programClassPairs = (shBatches || [])
//       .map((b) => ({
//         programId: b.programId,
//         classNo: b.classNo
//       }))
//       .filter((p) => p.programId && p.classNo);
//     // const subjectMins = new Map();
//     // const subjectMeta = new Map();
//     // const countP = (p) => {
//     //   if (p?.isCancelled) return;
//     //   const sid = safeTrim(p?.subjectId);
//     //   if (!sid) return;
//     //   if (phaseId && safeTrim(p?.phaseId) !== phaseId) return;
//     //   const start = toInt(p?.time?.startMin, -1);
//     //   const end = toInt(p?.time?.endMin, -1);
//     //   if (start < 0 || end <= start) return;
//     //   subjectMins.set(sid, (subjectMins.get(sid) || 0) + (end - start));
//     //   if (!subjectMeta.has(sid)) {
//     //     subjectMeta.set(sid, {
//     //       subjectCode: safeTrim(p?.subjectCode) || null,
//     //       subjectName: safeTrim(p?.subjectName) || null
//     //     });
//     //   }
//     // };
//     // for (const tt of timetables) {
//     //   for (const dayObj of tt.week || []) {
//     //     for (const p of dayObj.periods || []) countP(p);
//     //   }
//     //   for (const ov of tt.dayOverrides || []) {
//     //     if (ov.action === 'CANCEL_DAY') continue;
//     //     if (ov.action === 'REPLACE_DAY') {
//     //       for (const p of ov.periods || []) countP(p);
//     //     }
//     //   }
//     //   const ovrMap = new Map();
//     //   for (const ov of tt.periodOverrides || []) {
//     //     ovrMap.set(`${ov.date}_${normDay(ov.day)}_${ov.periodNo}`, ov);
//     //   }
//     //   for (const ov of ovrMap.values()) {
//     //     if (ov.action === 'CANCEL_PERIOD') {
//     //       const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
//     //       const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
//     //       if (base && !base.isCancelled) {
//     //         const sid = safeTrim(base.subjectId);
//     //         const s = toInt(base.time?.startMin, -1);
//     //         const e = toInt(base.time?.endMin, -1);
//     //         if (sid && s >= 0 && e > s) {
//     //           if (!phaseId || safeTrim(base.phaseId) === phaseId) {
//     //             subjectMins.set(sid, Math.max(0, (subjectMins.get(sid) || 0) - (e - s)));
//     //           }
//     //         }
//     //       }
//     //     } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
//     //       const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
//     //       const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
//     //       if (base && !base.isCancelled) {
//     //         const sid = safeTrim(base.subjectId);
//     //         const s = toInt(base.time?.startMin, -1);
//     //         const e = toInt(base.time?.endMin, -1);
//     //         if (sid && s >= 0 && e > s) {
//     //           if (!phaseId || safeTrim(base.phaseId) === phaseId) {
//     //             subjectMins.set(sid, Math.max(0, (subjectMins.get(sid) || 0) - (e - s)));
//     //           }
//     //         }
//     //       }
//     //       countP({ ...ov.period, periodNo: ov.periodNo });
//     //     } else if (ov.action === 'ADD_PERIOD' && ov.period) {
//     //       countP({ ...ov.period, periodNo: ov.periodNo });
//     //     }
//     //   }
//     // }
//     const batchSubjectMins = new Map();
//     const subjectMeta = new Map();
//     const countP = (p, batchCode) => {
//       if (p?.isCancelled) return;
//       const sid = safeTrim(p?.subjectId);
//       if (!sid) return;
//       if (filterSubjectId && sid !== filterSubjectId) return;
//       if (phaseId && safeTrim(p?.phaseId) !== phaseId) return;
//       const start = toInt(p?.time?.startMin, -1);
//       const end = toInt(p?.time?.endMin, -1);
//       if (start < 0 || end <= start) return;
//       const key = `${batchCode}_${sid}`;
//       batchSubjectMins.set(key, (batchSubjectMins.get(key) || 0) + (end - start));
//       if (!subjectMeta.has(sid)) {
//         subjectMeta.set(sid, {
//           subjectCode: safeTrim(p?.subjectCode) || null,
//           subjectName: safeTrim(p?.subjectName) || null
//         });
//       }
//     };
//     for (const tt of timetables) {
//       const bc = tt.batchCode;
//       for (const dayObj of tt.week || []) {
//         for (const p of dayObj.periods || []) countP(p, bc);
//       }
//       for (const ov of tt.dayOverrides || []) {
//         if (ov.action === 'CANCEL_DAY') continue;
//         if (ov.action === 'REPLACE_DAY') {
//           for (const p of ov.periods || []) countP(p, bc);
//         }
//       }
//       const ovrMap = new Map();
//       for (const ov of tt.periodOverrides || []) {
//         ovrMap.set(`${ov.date}_${normDay(ov.day)}_${ov.periodNo}`, ov);
//       }
//       for (const ov of ovrMap.values()) {
//         if (ov.action === 'CANCEL_PERIOD') {
//           const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
//           const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
//           if (base && !base.isCancelled) {
//             const sid = safeTrim(base.subjectId);
//             const s = toInt(base.time?.startMin, -1);
//             const e = toInt(base.time?.endMin, -1);
//             if (sid && s >= 0 && e > s) {
//               if (!phaseId || safeTrim(base.phaseId) === phaseId) {
//                 const key = `${bc}_${sid}`;
//                 batchSubjectMins.set(key, Math.max(0, (batchSubjectMins.get(key) || 0) - (e - s)));
//               }
//             }
//           }
//         } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
//           const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
//           const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
//           if (base && !base.isCancelled) {
//             const sid = safeTrim(base.subjectId);
//             const s = toInt(base.time?.startMin, -1);
//             const e = toInt(base.time?.endMin, -1);
//             if (sid && s >= 0 && e > s) {
//               if (!phaseId || safeTrim(base.phaseId) === phaseId) {
//                 const key = `${bc}_${sid}`;
//                 batchSubjectMins.set(key, Math.max(0, (batchSubjectMins.get(key) || 0) - (e - s)));
//               }
//             }
//           }
//           countP({ ...ov.period, periodNo: ov.periodNo }, bc);
//         } else if (ov.action === 'ADD_PERIOD' && ov.period) {
//           countP({ ...ov.period, periodNo: ov.periodNo }, bc);
//         }
//       }
//     }
//     const toHours = (m) => round2(m / 60);
//     const data = [];
//     for (const [key, mins] of batchSubjectMins.entries()) {
//       const [batchCode, ...subjectParts] = key.split('_');
//       const sid = subjectParts.join('_');
//       const meta = subjectMeta.get(sid) || {};
//       data.push({
//         batchCode,
//         batchName: batchNameMap.get(batchCode) || null,
//         subjectId: sid,
//         subjectCode: meta.subjectCode || null,
//         subjectName: meta.subjectName || null,
//         allottedHours: toHours(mins),
//         allottedMinutes: mins
//       });
//     }
//     data.sort((a, b) => {
//       const bc = a.batchCode.localeCompare(b.batchCode);
//       if (bc !== 0) return bc;
//       return (a.subjectName || '').localeCompare(b.subjectName || '');
//     });
//     const totalAllottedHours = toHours(Array.from(batchSubjectMins.values()).reduce((s, m) => s + m, 0));
//     // const toHours = (m) => round2(m / 60);
//     // const data = Array.from(subjectMins.entries())
//     //   .map(([sid, mins]) => {
//     //     const meta = subjectMeta.get(sid) || {};
//     //     return {
//     //       subjectId: sid,
//     //       subjectCode: meta.subjectCode || null,
//     //       subjectName: meta.subjectName || null,
//     //       allottedHours: toHours(mins),
//     //       allottedMinutes: mins
//     //     };
//     //   })
//     //   .sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || ''));
//     // const totalAllottedHours = toHours(Array.from(subjectMins.values()).reduce((s, m) => s + m, 0));
//     return res.status(200).json({
//       status: true,
//       batchCode: batch?.batchCode || null,
//       batchName: batch?.batchName || null,
//       programId: batch?.programId || null,
//       classNo: batch?.classNo || null,
//       summary: { totalAllottedHours },
//       count: data.length,
//       data
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const getSubjectHoursReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const batchId = safeTrim(req.body?.batchId || '');
    const batchCode = safeTrim(req.body?.batchCode || '');
    const filterSubjectId = safeTrim(req.body?.subjectId || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
    if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    const shBatchIds = await pickBatchIds(req);
    const shBatches = shBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: shBatchIds }, isdeleted: false }).lean() : batch ? [batch] : null;
    const shTtQuery = { tenantId, isdeleted: false, status: 'Active' };
    if (shBatches)
      applyBatchCodeFilter(
        shTtQuery,
        shBatches.map((b) => b.batchCode)
      );
    if (fromDate) {
      const fromMonday = getPreviousMonday(fromDate);
      shTtQuery.wkStartOn = { $gte: fromMonday };
    }
    if (toDate) {
      const toMonday = getPreviousMonday(toDate);
      shTtQuery.wkStartOn = { ...(shTtQuery.wkStartOn || {}), $lte: toMonday };
    }
    const timetables = await TimeTable.find(shTtQuery).lean();
    if (!timetables.length) {
      return res.status(200).json({
        status: true,
        batchCode: batch?.batchCode || null,
        batchName: batch?.batchName || null,
        summary: { totalAllottedHours: 0 },
        count: 0,
        data: []
      });
    }
    const batchSubjectPhaseMins = new Map();
    const subjectMeta = new Map();
    const countP = (p, bc) => {
      if (p?.isCancelled) return;
      const sid = safeTrim(p?.subjectId);
      if (!sid) return;
      if (filterSubjectId && sid !== filterSubjectId) return;
      const start = toInt(p?.time?.startMin, -1);
      const end = toInt(p?.time?.endMin, -1);
      if (start < 0 || end <= start) return;
      const mins = end - start;
      const phId = safeTrim(p?.phaseId || '');
      const key = `${bc}::${sid}::${phId}`;
      batchSubjectPhaseMins.set(key, (batchSubjectPhaseMins.get(key) || 0) + mins);
      if (!subjectMeta.has(sid)) {
        subjectMeta.set(sid, {
          subjectName: safeTrim(p?.subjectName) || null,
          subjectCode: safeTrim(p?.subjectCode) || null
        });
      }
    };
    for (const tt of timetables) {
      const bc = tt.batchCode;
      for (const dayObj of tt.week || []) {
        for (const p of dayObj.periods || []) countP(p, bc);
      }
      for (const ov of tt.dayOverrides || []) {
        if (ov.action === 'CANCEL_DAY') continue;
        if (ov.action === 'REPLACE_DAY') {
          for (const p of ov.periods || []) countP(p, bc);
        }
      }
      const ovrMap = new Map();
      for (const ov of tt.periodOverrides || []) {
        const k = `${ov.date}_${normDay(ov.day)}_${ov.periodNo}`;
        ovrMap.set(k, ov);
      }
      for (const ov of ovrMap.values()) {
        if (ov.action === 'CANCEL_PERIOD') {
          const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
          const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
          if (base && !base.isCancelled) {
            const sid = safeTrim(base.subjectId);
            const phId = safeTrim(base.phaseId || '');
            const start = toInt(base.time?.startMin, -1);
            const end = toInt(base.time?.endMin, -1);
            if (sid && start >= 0 && end > start) {
              if (!filterSubjectId || sid === filterSubjectId) {
                const mins = end - start;
                const key = `${bc}::${sid}::${phId}`;
                batchSubjectPhaseMins.set(key, Math.max(0, (batchSubjectPhaseMins.get(key) || 0) - mins));
              }
            }
          }
        } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
          const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
          const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
          if (base && !base.isCancelled) {
            const sid = safeTrim(base.subjectId);
            const phId = safeTrim(base.phaseId || '');
            const start = toInt(base.time?.startMin, -1);
            const end = toInt(base.time?.endMin, -1);
            if (sid && start >= 0 && end > start) {
              if (!filterSubjectId || sid === filterSubjectId) {
                const mins = end - start;
                const key = `${bc}::${sid}::${phId}`;
                batchSubjectPhaseMins.set(key, Math.max(0, (batchSubjectPhaseMins.get(key) || 0) - mins));
              }
            }
          }
          countP({ ...ov.period, periodNo: ov.periodNo }, bc);
        } else if (ov.action === 'ADD_PERIOD' && ov.period) {
          countP({ ...ov.period, periodNo: ov.periodNo }, bc);
        }
      }
    }
    const phasesBySubject = new Map();
    if (shBatches && shBatches.length) {
      const programIdSet = [...new Set(shBatches.map((b) => b.programId).filter(Boolean))];
      const classNoSet = [...new Set(shBatches.map((b) => b.classNo).filter(Boolean))];
      if (programIdSet.length && classNoSet.length) {
        const phaseQuery = {
          tenantId,
          isdeleted: false,
          status: 'Active'
        };
        if (programIdSet.length === 1) phaseQuery.programId = programIdSet[0];
        else phaseQuery.programId = { $in: programIdSet };
        if (classNoSet.length === 1) phaseQuery.classNo = classNoSet[0];
        else phaseQuery.classNo = { $in: classNoSet };
        if (filterSubjectId) phaseQuery.subjectId = new mongoose.Types.ObjectId(filterSubjectId);
        const phases = await Phase.find(phaseQuery).sort({ subjectId: 1, sortOrder: 1 }).lean();
        for (const ph of phases) {
          const sid = String(ph.subjectId);
          if (!phasesBySubject.has(sid)) phasesBySubject.set(sid, []);
          phasesBySubject.get(sid).push(ph);
        }
      }
    }
    const phaseNameMap = new Map();
    for (const [, phases] of phasesBySubject.entries()) {
      for (const ph of phases) {
        phaseNameMap.set(ph.phaseId, ph.phaseName);
      }
    }
    const phaseEstMinsMap = new Map();
    for (const [sid, phases] of phasesBySubject.entries()) {
      for (const ph of phases) {
        const estMins = (ph.topics || []).reduce((s, t) => s + (t.estHours || 0) * 60, 0);
        const key = `${sid}::${ph.phaseId}`;
        phaseEstMinsMap.set(key, (phaseEstMinsMap.get(key) || 0) + estMins);
      }
    }
    const batchSubjectPhaseKeys = new Set(batchSubjectPhaseMins.keys());
    if (shBatches) {
      for (const b of shBatches) {
        for (const [sid, phases] of phasesBySubject.entries()) {
          if (filterSubjectId && sid !== filterSubjectId) continue;
          for (const ph of phases) {
            batchSubjectPhaseKeys.add(`${b.batchCode}::${sid}::${ph.phaseId}`);
          }
        }
      }
    }
    const allSubjectIds = [
      ...new Set(
        Array.from(batchSubjectPhaseKeys)
          .map((key) => key.split('::')[1])
          .filter(Boolean)
      )
    ];
    const subjectDocs = await Subject.find(
      {
        _id: {
          $in: allSubjectIds
            .map((id) => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        },
        isdeleted: false
      },
      { subjectName: 1, subjectCode: 1 }
    ).lean();
    const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));
    for (const [sid, doc] of subjectDocMap.entries()) {
      if (!subjectMeta.has(sid) || !subjectMeta.get(sid).subjectName) {
        subjectMeta.set(sid, {
          subjectName: doc.subjectName || null,
          subjectCode: doc.subjectCode || null
        });
      }
    }
    const batchNameMap = new Map((shBatches || []).map((b) => [b.batchCode, b.batchName]));
    const toHours = (m) => round2(m / 60);
    const data = [];
    for (const key of batchSubjectPhaseKeys) {
      const parts = key.split('::');
      const bc = parts[0];
      const sid = parts[1];
      const phId = parts[2] ?? '';

      if (!bc || !sid) continue;
      const allottedMins = batchSubjectPhaseMins.get(key) || 0;
      const estMins = phaseEstMinsMap.get(`${sid}::${phId}`) || 0;
      const balanceMins = estMins - allottedMins;
      const meta = subjectMeta.get(sid) || {};
      const phaseName = phId ? phaseNameMap.get(phId) || phId : 'Unassigned';
      data.push({
        batchCode: bc,
        batchName: batchNameMap.get(bc) || null,
        subjectId: sid,
        subjectName: meta.subjectName || null,
        phaseId: phId || null,
        phaseName,
        estHours: toHours(estMins),
        allottedHours: toHours(allottedMins),
        balanceHours: toHours(balanceMins),
        allottedMinutes: allottedMins
      });
    }
    data.sort((a, b) => {
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
      const sc = (a.subjectName || '').localeCompare(b.subjectName || '');
      if (sc !== 0) return sc;
      if (a.phaseName === 'Unassigned') return 1;
      if (b.phaseName === 'Unassigned') return -1;
      return (a.phaseName || '').localeCompare(b.phaseName || '');
    });

    const totalAllottedHours = toHours(Array.from(batchSubjectPhaseMins.values()).reduce((s, m) => s + m, 0));

    return res.status(200).json({
      status: true,
      batchCode: batch?.batchCode || null,
      batchName: batch?.batchName || null,
      summary: { totalAllottedHours },
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getFeedbackReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchCode = safeTrim(req.body?.batchCode || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const fbBatchCodes = await pickBatchCodes(req);
    const query = { tenantId, isdeleted: false };
    applyBatchCodeFilter(query, fbBatchCodes);
    if (fromDate) query.ptmDate = { $gte: fromDate };
    if (toDate) query.ptmDate = { ...query.ptmDate, $lte: toDate };
    const ptmDocs = await PTM.find(query).lean();
    if (!ptmDocs.length) {
      return res.status(200).json({ status: true, batchCode, count: 0, batchSummary: null, staffSummary: [], data: [] });
    }
    const total = ptmDocs.length;
    const completed = ptmDocs.filter((p) => p.status === 'COMPLETED').length;
    const noShow = ptmDocs.filter((p) => p.status === 'NO_SHOW').length;
    const cancelled = ptmDocs.filter((p) => p.status === 'CANCELLED').length;
    const scheduled = ptmDocs.filter((p) => p.status === 'SCHEDULED').length;
    const prePtmSubmitted = ptmDocs.filter((p) => !!p.prePtmSubmittedAt).length;
    const postPtmSubmitted = ptmDocs.filter((p) => !!p.postPtmSubmittedAt).length;
    const batchSummary = {
      totalStudents: total,
      completed,
      noShow,
      cancelled,
      scheduled,
      prePtmSubmitted,
      postPtmSubmitted,
      prePtmPendingCount: total - prePtmSubmitted,
      postPtmPendingCount: total - postPtmSubmitted,
      prePtmSubmissionPct: round2((prePtmSubmitted / total) * 100),
      postPtmSubmissionPct: round2((postPtmSubmitted / total) * 100)
    };
    const staffRemarksMap = new Map();
    for (const ptm of ptmDocs) {
      const remarks = Array.isArray(ptm.staffRemarks) ? ptm.staffRemarks : [];
      for (const r of remarks) {
        const sid = safeTrim(r.staffId || '');
        if (!sid) continue;
        const key = `${sid}_${safeTrim(r.subjectId || '')}`;
        if (!staffRemarksMap.has(key)) {
          staffRemarksMap.set(key, {
            staffId: sid,
            staffName: r.staffName || null,
            subjectId: r.subjectId || null,
            subjectName: r.subjectName || null,
            subjectCode: r.subjectCode || null,
            remarksCount: 0,
            studentsCovered: new Set()
          });
        }
        const entry = staffRemarksMap.get(key);
        entry.remarksCount++;
        entry.studentsCovered.add(ptm.admissionNo || ptm.studentId);
      }
    }
    const staffSummary = Array.from(staffRemarksMap.values())
      .map((e) => ({
        staffId: e.staffId,
        staffName: e.staffName || null,
        subjectId: e.subjectId || null,
        subjectName: e.subjectName || null,
        subjectCode: e.subjectCode || null,
        remarksCount: e.remarksCount,
        studentsCovered: e.studentsCovered.size
      }))
      .sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || ''));
    const data = ptmDocs.map((p) => ({
      ptmId: p.ptmId,
      studentId: p.studentId,
      admissionNo: p.admissionNo,
      studentName: p.studentName,
      status: p.status,
      ptmDate: p.ptmDate,
      prePtmSubmittedAt: p.prePtmSubmittedAt || null,
      postPtmSubmittedAt: p.postPtmSubmittedAt || null,
      prePtmRemarks: p.prePtmRemarks || null,
      postPtmRemarks: p.postPtmRemarks || null,
      staffFeedbackCount: Array.isArray(p.staffRemarks) ? p.staffRemarks.length : 0,
      staffRemarks: Array.isArray(p.staffRemarks) ? p.staffRemarks : []
    }));
    return res.status(200).json({
      status: true,
      batchCode,
      fromDate: fromDate || null,
      toDate: toDate || null,
      batchSummary,
      staffSummary,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchPtmReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchCode = safeTrim(req.body?.batchCode || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const status = safeTrim(req.body?.status || '');
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const ptmBatchCodes = await pickBatchCodes(req);
    const query = { tenantId, isdeleted: false };
    applyBatchCodeFilter(query, ptmBatchCodes);
    if (fromDate) query.ptmDate = { $gte: fromDate };
    if (toDate) query.ptmDate = { ...query.ptmDate, $lte: toDate };
    if (status && status !== 'ALL') query.status = status;
    const ptmDocs = await PTM.find(query).sort({ ptmDate: -1, startTime: 1 }).lean();
    if (!ptmDocs.length) {
      return res.status(200).json({ status: true, batchCode, sessions: [], count: 0 });
    }
    const sessionMap = new Map();
    for (const p of ptmDocs) {
      const key = `${p.ptmDate}_${p.startTime}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          ptmDate: p.ptmDate,
          startTime: p.startTime,
          endTime: p.endTime,
          durationMins: p.durationMins,
          meetingMode: p.meetingMode,
          venue: p.venue || null,
          content: p.content || null,
          enablePostPtmFeedback: p.enablePostPtmFeedback,
          students: []
        });
      }
      sessionMap.get(key).students.push(p);
    }
    const sessions = Array.from(sessionMap.values())
      .map((s) => {
        const students = s.students;
        const total = students.length;
        const completed = students.filter((p) => p.status === 'COMPLETED').length;
        const noShow = students.filter((p) => p.status === 'NO_SHOW').length;
        const cancelled = students.filter((p) => p.status === 'CANCELLED').length;
        const scheduled = students.filter((p) => p.status === 'SCHEDULED').length;
        const prePtmSubmitted = students.filter((p) => !!p.prePtmSubmittedAt).length;
        const postPtmSubmitted = students.filter((p) => !!p.postPtmSubmittedAt).length;
        return {
          ptmDate: s.ptmDate,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMins: s.durationMins,
          meetingMode: s.meetingMode,
          venue: s.venue,
          content: s.content,
          enablePostPtmFeedback: s.enablePostPtmFeedback,
          totalStudents: total,
          completed,
          noShow,
          cancelled,
          scheduled,
          prePtmSubmitted,
          postPtmSubmitted,
          prePtmPendingCount: total - prePtmSubmitted,
          postPtmPendingCount: total - postPtmSubmitted,
          prePtmSubmissionPct: total > 0 ? round2((prePtmSubmitted / total) * 100) : 0,
          postPtmSubmissionPct: total > 0 ? round2((postPtmSubmitted / total) * 100) : 0,
          students: students.map((p) => ({
            ptmId: p.ptmId,
            studentId: p.studentId,
            admissionNo: p.admissionNo,
            studentName: p.studentName,
            status: p.status,
            prePtmSubmittedAt: p.prePtmSubmittedAt || null,
            postPtmSubmittedAt: p.postPtmSubmittedAt || null,
            staffFeedbackCount: Array.isArray(p.staffRemarks) ? p.staffRemarks.length : 0
          }))
        };
      })
      .sort((a, b) => b.ptmDate - a.ptmDate);
    const allStudents = ptmDocs;
    const summary = {
      totalSessions: sessions.length,
      totalStudents: allStudents.length,
      completed: allStudents.filter((p) => p.status === 'COMPLETED').length,
      noShow: allStudents.filter((p) => p.status === 'NO_SHOW').length,
      cancelled: allStudents.filter((p) => p.status === 'CANCELLED').length,
      prePtmSubmitted: allStudents.filter((p) => !!p.prePtmSubmittedAt).length,
      postPtmSubmitted: allStudents.filter((p) => !!p.postPtmSubmittedAt).length
    };
    return res.status(200).json({
      status: true,
      batchCode,
      summary,
      count: sessions.length,
      sessions
    });
  } catch (err) {
    return next(err);
  }
};

const getCgpaReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const cgBatchIds = await pickBatchIds(req);
    const subjectId = safeTrim(req.body?.subjectId || '');

    // Fetch batch docs for names
    const batchQuery = { tenantId, isdeleted: false };
    if (cgBatchIds.length) batchQuery.batchId = { $in: cgBatchIds };
    const batches = await Batch.find(batchQuery, { batchId: 1, batchCode: 1, batchName: 1 }).lean();
    const batchMap = new Map(batches.map((b) => [b.batchId, b]));

    if (!batches.length) {
      return res.status(200).json({ status: true, count: 0, data: [], studentDetail: [] });
    }

    // Fetch enabled assignments for these batches
    const enableQuery = { tenantId, isdeleted: false, status: 'enabled' };
    applyBatchIdFilter(enableQuery, cgBatchIds.length ? cgBatchIds : batches.map((b) => b.batchId));
    if (subjectId) enableQuery.subjectId = subjectId;

    const enabledRows = await BatchAssignEnable.find(enableQuery).lean();

    if (!enabledRows.length) {
      return res.status(200).json({ status: true, count: 0, data: [], studentDetail: [] });
    }

    // Fetch subject names
    const subjectIds = [...new Set(enabledRows.map((r) => safeTrim(r.subjectId)).filter(Boolean))];
    const subjectDocs = await Subject.find(
      {
        _id: {
          $in: subjectIds
            .map((id) => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        }
      },
      { subjectName: 1, subjectCode: 1 }
    ).lean();
    const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));

    // Group by batchId + subjectId
    // key: `${batchId}::${subjectId}`
    const groupMap = new Map();

    for (const row of enabledRows) {
      const bid = safeTrim(row.batchId);
      const sid = safeTrim(row.subjectId);
      const key = `${bid}::${sid}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          batchId: bid,
          subjectId: sid,
          students: []
        });
      }

      // Collect all students from this enabled test
      for (const stu of row.students || []) {
        groupMap.get(key).students.push({
          admissionNo: safeTrim(stu.admissionNo),
          studentId: safeTrim(stu.studentId || ''),
          status: safeTrim(stu.status),
          cgpa: stu.cgpa !== null && stu.cgpa !== undefined ? Number(stu.cgpa) : null
        });
      }
    }

    // Build summary per batch+subject — merge duplicate students (take latest cgpa)
    const summaryData = [];
    const studentDetailData = [];

    for (const [key, grp] of groupMap.entries()) {
      const batch = batchMap.get(grp.batchId) || {};
      const subDoc = subjectDocMap.get(grp.subjectId) || {};

      // Deduplicate students — keep highest cgpa per admissionNo
      const stuMap = new Map();
      for (const stu of grp.students) {
        const existing = stuMap.get(stu.admissionNo);
        if (!existing || (stu.cgpa !== null && (existing.cgpa === null || stu.cgpa > existing.cgpa))) {
          stuMap.set(stu.admissionNo, stu);
        }
      }

      const allStudents = Array.from(stuMap.values());
      const completedStudents = allStudents.filter((s) => s.status === 'COMPLETED');
      const withCgpa = completedStudents.filter((s) => s.cgpa !== null);

      const avgCgpa = withCgpa.length > 0 ? round2(withCgpa.reduce((s, st) => s + st.cgpa, 0) / withCgpa.length) : null;
      const minCgpa = withCgpa.length > 0 ? round2(Math.min(...withCgpa.map((s) => s.cgpa))) : null;
      const maxCgpa = withCgpa.length > 0 ? round2(Math.max(...withCgpa.map((s) => s.cgpa))) : null;

      summaryData.push({
        batchId: grp.batchId,
        batchCode: batch.batchCode || grp.batchId,
        batchName: batch.batchName || null,
        subjectId: grp.subjectId,
        subjectName: subDoc.subjectName || null,
        subjectCode: subDoc.subjectCode || null,
        totalStudents: allStudents.length,
        completedStudents: completedStudents.length,
        studentsWithCgpa: withCgpa.length,
        avgCgpa,
        minCgpa,
        maxCgpa
      });

      // Per-student detail
      for (const stu of allStudents) {
        studentDetailData.push({
          batchCode: batch.batchCode || grp.batchId,
          batchName: batch.batchName || null,
          subjectName: subDoc.subjectName || null,
          subjectCode: subDoc.subjectCode || null,
          admissionNo: stu.admissionNo,
          status: stu.status,
          cgpa: stu.cgpa !== null ? stu.cgpa : '-'
        });
      }
    }

    // Sort summary by batchCode then subjectName
    summaryData.sort((a, b) => {
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
      return (a.subjectName || '').localeCompare(b.subjectName || '');
    });

    studentDetailData.sort((a, b) => {
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
      const sc = (a.subjectName || '').localeCompare(b.subjectName || '');
      if (sc !== 0) return sc;
      return (a.admissionNo || '').localeCompare(b.admissionNo || '');
    });

    const summary = {
      totalBatches: new Set(summaryData.map((r) => r.batchCode)).size,
      totalStudents: studentDetailData.length,
      overallAvgCgpa: summaryData.filter((r) => r.avgCgpa !== null).length > 0 ? round2(summaryData.filter((r) => r.avgCgpa !== null).reduce((s, r) => s + r.avgCgpa, 0) / summaryData.filter((r) => r.avgCgpa !== null).length) : null
    };

    return res.status(200).json({
      status: true,
      summary,
      count: summaryData.length,
      data: summaryData,
      studentDetail: studentDetailData
    });
  } catch (err) {
    return next(err);
  }
};

const getSlashReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const slBatchIds = await pickBatchIds(req);
    const subjectId = safeTrim(req.body?.subjectId || '');

    // Fetch batch docs for names
    const batchQuery = { tenantId, isdeleted: false };
    if (slBatchIds.length) batchQuery.batchId = { $in: slBatchIds };
    const batches = await Batch.find(batchQuery, { batchId: 1, batchCode: 1, batchName: 1 }).lean();
    const batchMap = new Map(batches.map((b) => [b.batchId, b]));

    if (!batches.length) {
      return res.status(200).json({ status: true, count: 0, data: [] });
    }

    // Fetch all enabled assignments for these batches
    const enableQuery = { tenantId, isdeleted: false, status: 'enabled' };
    applyBatchIdFilter(enableQuery, slBatchIds.length ? slBatchIds : batches.map((b) => b.batchId));
    if (subjectId) enableQuery.subjectId = subjectId;

    const enabledRows = await BatchAssignEnable.find(enableQuery).lean();

    if (!enabledRows.length) {
      return res.status(200).json({ status: true, count: 0, data: [] });
    }

    // Fetch subject names
    const subjectIds = [...new Set(enabledRows.map((r) => safeTrim(r.subjectId)).filter(Boolean))];
    const subjectDocs = await Subject.find(
      {
        _id: {
          $in: subjectIds
            .map((id) => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        }
      },
      { subjectName: 1, subjectCode: 1 }
    ).lean();
    const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));

    // ── Fetch Assignment meta for category/subcategory ──
    const testIdsForCat = [...new Set(enabledRows.map((r) => safeTrim(r.testId)).filter(Boolean))];
    const catAssignments = await Assignment.find({ tenantId, testId: { $in: testIdsForCat }, isdeleted: false }, { testId: 1, categoryId: 1, subCategoryId: 1 }).lean();
    const testCatMap = new Map(catAssignments.map((a) => [a.testId, a]));

    const categoryIds = [...new Set(catAssignments.map((a) => safeTrim(a.categoryId)).filter(Boolean))];
    const subCategoryIds = [...new Set(catAssignments.map((a) => safeTrim(a.subCategoryId)).filter(Boolean))];
    const [catDocs, subCatDocs] = await Promise.all([
      ExamCategory.find({ tenantId, categoryId: { $in: categoryIds }, isdeleted: false }, { categoryId: 1, categoryName: 1 }).lean(),
      ExamSubCategory.find({ tenantId, subCategoryId: { $in: subCategoryIds }, isdeleted: false }, { subCategoryId: 1, subCategoryName: 1, sortOrder: 1 }).lean()
    ]);
    const catMap = new Map(catDocs.map((c) => [c.categoryId, c]));
    const subCatMap = new Map(subCatDocs.map((s) => [s.subCategoryId, s]));

    // ── Program-specific category/subcategory sort order (mirrors getAssignmentReport) ──
    const programIds = [...new Set(batches.map((b) => safeTrim(b.programId)).filter(Boolean))];
    const programDocs = programIds.length ? await Program.find({ tenantId, programId: { $in: programIds }, isdeleted: false }, { programId: 1, examMappings: 1 }).lean() : [];
    const programSortMap = new Map(); // programId → Map("catId::subCatId" → sortOrder)
    for (const p of programDocs) {
      const m = new Map();
      for (const em of p.examMappings || []) {
        const key = `${safeTrim(em.categoryId)}::${safeTrim(em.subCategoryId)}`;
        m.set(key, Number.isFinite(Number(em.sortOrder)) ? Number(em.sortOrder) : 0);
      }
      programSortMap.set(p.programId, m);
    }
    const resolveSortOrder = (programId, catId, subCatId) => {
      const progMap = programSortMap.get(programId);
      const key = `${catId}::${subCatId}`;
      if (progMap && progMap.has(key)) return progMap.get(key);
      const subCat = subCatMap.get(subCatId) || {};
      return subCat.sortOrder || 0;
    };

    // Group by batchId + subjectId + categoryId + subCategoryId
    // key: `${batchId}::${subjectId}::${categoryId}::${subCategoryId}`
    const groupMap = new Map();

    for (const row of enabledRows) {
      const bid = safeTrim(row.batchId);
      const sid = safeTrim(row.subjectId);
      const testId = safeTrim(row.testId);
      const asg = testCatMap.get(testId) || {};
      const catId = safeTrim(asg.categoryId) || '';
      const subCatId = safeTrim(asg.subCategoryId) || '';
      const key = `${bid}::${sid}::${catId}::${subCatId}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          batchId: bid,
          subjectId: sid,
          categoryId: catId,
          subCategoryId: subCatId,
          testIds: new Set(),
          // studentId → { testIds completed }
          studentTestMap: new Map()
        });
      }

      const grp = groupMap.get(key);
      if (testId) grp.testIds.add(testId);

      // Track per-student per-test status
      for (const stu of row.students || []) {
        const admNo = safeTrim(stu.admissionNo);
        if (!admNo) continue;
        if (!grp.studentTestMap.has(admNo)) {
          grp.studentTestMap.set(admNo, {
            admissionNo: admNo,
            completedTests: new Set(),
            inProgressTests: new Set(),
            assignedTests: new Set()
          });
        }
        const stuData = grp.studentTestMap.get(admNo);
        const status = safeTrim(stu.status);
        if (status === 'COMPLETED') stuData.completedTests.add(testId);
        else if (status === 'IN_PROGRESS') stuData.inProgressTests.add(testId);
        else stuData.assignedTests.add(testId);
      }
    }

    // Build report rows
    const data = [];

    for (const [key, grp] of groupMap.entries()) {
      const batch = batchMap.get(grp.batchId) || {};
      const subDoc = subjectDocMap.get(grp.subjectId) || {};
      const cat = catMap.get(grp.categoryId) || {};
      const subCat = subCatMap.get(grp.subCategoryId) || {};
      const availableTests = grp.testIds.size;
      const allStudents = Array.from(grp.studentTestMap.values());
      const totalStudents = allStudents.length;

      // Completed all = student who completed ALL available tests
      const fullyCompleted = allStudents.filter((s) => s.completedTests.size === availableTests).length;
      // In Progress = at least one in progress or partially completed
      const inProgress = allStudents.filter((s) => s.inProgressTests.size > 0 || (s.completedTests.size > 0 && s.completedTests.size < availableTests)).length;
      // Not started = all tests still assigned
      const notStarted = allStudents.filter((s) => s.completedTests.size === 0 && s.inProgressTests.size === 0).length;

      const completionPct = totalStudents > 0 && availableTests > 0 ? round2((fullyCompleted / totalStudents) * 100) : 0;

      data.push({
        batchId: grp.batchId,
        batchCode: batch.batchCode || grp.batchId,
        batchName: batch.batchName || null,
        subjectId: grp.subjectId,
        subjectName: subDoc.subjectName || null,
        subjectCode: subDoc.subjectCode || null,
        categoryId: grp.categoryId || null,
        categoryName: cat.categoryName || null,
        subCategoryId: grp.subCategoryId || null,
        subCategoryName: subCat.subCategoryName || null,
        sortOrder: resolveSortOrder(batch.programId, grp.categoryId, grp.subCategoryId),
        availableTests,
        totalStudents,
        fullyCompleted,
        inProgress,
        notStarted,
        completionPct
      });
    }

    // Sort by batchCode → sortOrder → subjectName
    data.sort((a, b) => {
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return (a.subjectName || '').localeCompare(b.subjectName || '');
    });

    const summary = {
      totalBatches: new Set(data.map((r) => r.batchCode)).size,
      totalSubjects: new Set(data.map((r) => r.subjectId)).size,
      totalAvailableTests: data.reduce((s, r) => s + r.availableTests, 0),
      overallCompletionPct: data.length > 0 ? round2(data.reduce((s, r) => s + r.completionPct, 0) / data.length) : 0
    };

    return res.status(200).json({
      status: true,
      summary,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getSubjectsByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const batchCodes = await pickBatchCodes(req);
    const ttQuery = { tenantId, isdeleted: false, status: 'Active' };
    if (batchCodes.length) applyBatchCodeFilter(ttQuery, batchCodes);
    const timetables = await TimeTable.find(ttQuery, { week: 1 }).lean();
    const subjectIdSet = new Set();
    for (const tt of timetables) {
      for (const day of tt.week || []) {
        for (const p of day.periods || []) {
          if (p.subjectId) subjectIdSet.add(String(p.subjectId));
        }
      }
    }
    if (!subjectIdSet.size) {
      return res.status(200).json({ status: true, count: 0, data: [] });
    }
    const subjects = await Subject.find(
      {
        _id: {
          $in: Array.from(subjectIdSet)
            .map((id) => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        },
        isdeleted: false
      },
      { subjectName: 1, subjectCode: 1 }
    ).lean();
    const seen = new Set();
    const data = subjects
      .filter((s) => {
        if (seen.has(s.subjectName)) return false;
        seen.add(s.subjectName);
        return true;
      })
      .sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || ''));

    return res.status(200).json({ status: true, count: data.length, data });
  } catch (err) {
    return next(err);
  }
};

// const getAssignmentReport = async (req, res, next) => {
//   try {
//     const tenantId = pickTid(req);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
//     const view = safeTrim(req.body?.view || 'batch');
//     const filterSubjectId = safeTrim(req.body?.subjectId || '');
//     const admissionNos = Array.isArray(req.body?.admissionNos) ? req.body.admissionNos.map(safeTrim).filter(Boolean) : [];
//     const batchIds = pickBatchIds(req);
//     if (!batchIds.length) return res.status(400).json({ status: false, message: 'batchIds[] is required' });
//     const batches = await Batch.find({ tenantId, batchId: { $in: batchIds }, isdeleted: false }).lean();
//     if (!batches.length) return res.status(200).json({ status: true, view, count: 0, batches: [] });
//     const batchMap = new Map(batches.map((b) => [b.batchId, b]));
//     const enableQuery = { tenantId, isdeleted: false, status: 'enabled', batchId: { $in: batchIds } };
//     if (filterSubjectId) enableQuery.subjectId = filterSubjectId;
//     const enabledRows = await BatchAssignEnable.find(enableQuery).lean();
//     if (!enabledRows.length) return res.status(200).json({ status: true, view, count: 0, batches: [] });
//     const allTestIds = [...new Set(enabledRows.map((r) => safeTrim(r.testId)).filter(Boolean))];
//     const assignments = await Assignment.find({ tenantId, testId: { $in: allTestIds }, isdeleted: false }, { testId: 1, testNo: 1, testCode: 1, subjectId: 1, topicId: 1, subTopicId: 1, categoryId: 1, subCategoryId: 1, classNo: 1 }).lean();
//     console.log('allTestIds:', allTestIds.length);
//     console.log('assignments found:', assignments.length);
//     console.log('categoryIds:', categoryIds);
//     console.log('subCategoryIds:', subCategoryIds);
//     console.log('catDocs found:', catDocs.length);
//     console.log('subCatDocs found:', subCatDocs.length);
//     const assignMap = new Map(assignments.map((a) => [a.testId, a]));
//     const categoryIds = [...new Set(assignments.map((a) => safeTrim(a.categoryId)).filter(Boolean))];
//     const subCategoryIds = [...new Set(assignments.map((a) => safeTrim(a.subCategoryId)).filter(Boolean))];
//     const [catDocs, subCatDocs] = await Promise.all([
//       ExamCategory.find({ tenantId, categoryId: { $in: categoryIds }, isdeleted: false }, { categoryId: 1, categoryName: 1, categoryCode: 1 }).lean(),
//       ExamSubCategory.find({ tenantId, subCategoryId: { $in: subCategoryIds }, isdeleted: false }, { subCategoryId: 1, subCategoryName: 1, subCategoryCode: 1, categoryId: 1 }).lean()
//     ]);
//     const catMap = new Map(catDocs.map((c) => [c.categoryId, c]));
//     const subCatMap = new Map(subCatDocs.map((s) => [s.subCategoryId, s]));
//     const subjectIds = [...new Set(enabledRows.map((r) => safeTrim(r.subjectId)).filter(Boolean))];
//     const subjectDocs = await Subject.find(
//       {
//         _id: {
//           $in: subjectIds
//             .map((id) => {
//               try {
//                 return new mongoose.Types.ObjectId(id);
//               } catch {
//                 return null;
//               }
//             })
//             .filter(Boolean)
//         }
//       },
//       { subjectName: 1, subjectCode: 1 }
//     ).lean();
//     const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));
//     let topicMap = new Map();
//     let subTopicMap = new Map();
//     if (view === 'student') {
//       const topicIds = [...new Set(assignments.map((a) => safeTrim(a.topicId)).filter(Boolean))];
//       const subTopicIds = [...new Set(assignments.map((a) => safeTrim(a.subTopicId)).filter(Boolean))];
//       const [topicDocs, subTopicDocs] = await Promise.all([Topic.find({ tenantId, topicId: { $in: topicIds }, isdeleted: false }, { topicId: 1, topicName: 1 }).lean(), SubTopic.find({ tenantId, subTopicId: { $in: subTopicIds }, isdeleted: false }, { subTopicId: 1, subTopicName: 1 }).lean()]);
//       topicMap = new Map(topicDocs.map((t) => [t.topicId, t.topicName]));
//       subTopicMap = new Map(subTopicDocs.map((s) => [s.subTopicId, s.subTopicName]));
//     }
//     const enabledByBatch = new Map();
//     for (const row of enabledRows) {
//       const bid = safeTrim(row.batchId);
//       if (!enabledByBatch.has(bid)) enabledByBatch.set(bid, []);
//       enabledByBatch.get(bid).push(row);
//     }
//     if (view === 'batch') {
//       const batchResults = [];
//       for (const batchId of batchIds) {
//         const batch = batchMap.get(batchId);
//         if (!batch) continue;
//         const batchEnabledRows = enabledByBatch.get(batchId) || [];
//         if (!batchEnabledRows.length) continue;
//         const colKeySet = new Map();
//         for (const row of batchEnabledRows) {
//           const asg = assignMap.get(safeTrim(row.testId));
//           if (!asg) continue;
//           const catId = safeTrim(asg.categoryId);
//           const subCatId = safeTrim(asg.subCategoryId);
//           const colKey = `${catId}::${subCatId}`;
//           if (!colKeySet.has(colKey)) {
//             const cat = catMap.get(catId) || {};
//             const subCat = subCatMap.get(subCatId) || {};
//             const catCode = safeTrim(cat.categoryCode || cat.categoryName || catId);
//             const subCatCode = safeTrim(subCat.subCategoryCode || subCat.subCategoryName || subCatId);
//             colKeySet.set(colKey, {
//               colKey,
//               categoryId: catId,
//               subCategoryId: subCatId,
//               catName: cat.categoryName || catId,
//               subCatName: subCat.subCategoryName || subCatId,
//               colLabel: `${catCode}${subCatCode}`
//             });
//           }
//         }
//         const columns = Array.from(colKeySet.values());
//         const testColMap = new Map();
//         for (const row of batchEnabledRows) {
//           const asg = assignMap.get(safeTrim(row.testId));
//           if (!asg) continue;
//           const colKey = `${safeTrim(asg.categoryId)}::${safeTrim(asg.subCategoryId)}`;
//           testColMap.set(safeTrim(row.testId), colKey);
//         }
//         const studentColCgpa = new Map();
//         for (const row of batchEnabledRows) {
//           const testId = safeTrim(row.testId);
//           const colKey = testColMap.get(testId);
//           if (!colKey) continue;
//           for (const stu of row.students || []) {
//             const admNo = safeTrim(stu.admissionNo);
//             if (!admNo) continue;
//             if (!studentColCgpa.has(admNo)) studentColCgpa.set(admNo, new Map());
//             const stuMap = studentColCgpa.get(admNo);
//             if (stu.status === 'COMPLETED' && stu.cgpa !== null && stu.cgpa !== undefined) {
//               stuMap.set(colKey, round2(Number(stu.cgpa)));
//             } else if (!stuMap.has(colKey)) {
//               stuMap.set(colKey, 0);
//             }
//           }
//         }
//         const batchStudents = await StudentProfile.find({ tenantId, batchId, isdeleted: false, status: 'ACTIVE' }, { admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).lean();
//         const studentRows = [];
//         let slNo = 0;
//         const colSums = new Map();
//         const colCounts = new Map();
//         for (const stu of batchStudents) {
//           const admNo = safeTrim(stu.admissionNo);
//           const stuColMap = studentColCgpa.get(admNo) || new Map();
//           const row = {
//             slNo: ++slNo,
//             admissionNo: admNo,
//             studentName: stu.student?.name || null
//           };
//           let sgpaSum = 0;
//           let sgpaCount = 0;
//           for (const col of columns) {
//             const cgpa = stuColMap.has(col.colKey) ? stuColMap.get(col.colKey) : 0;
//             row[col.colKey] = cgpa;
//             colSums.set(col.colKey, (colSums.get(col.colKey) || 0) + cgpa);
//             if (cgpa > 0) {
//               colCounts.set(col.colKey, (colCounts.get(col.colKey) || 0) + 1);
//               sgpaSum += cgpa;
//               sgpaCount++;
//             }
//           }
//           const sgpa = sgpaCount > 0 ? round2(sgpaSum / sgpaCount) : 0;
//           row['SGPA'] = sgpa;
//           row['GSGPA'] = sgpa;
//           studentRows.push(row);
//         }
//         const avgRow = {
//           slNo: null,
//           admissionNo: null,
//           studentName: 'Batch Average (BGPA)'
//         };
//         let batchSgpaSum = 0;
//         let batchSgpaCount = 0;
//         for (const col of columns) {
//           const total = colSums.get(col.colKey) || 0;
//           const count = batchStudents.length;
//           const avg = count > 0 ? round2(total / count) : 0;
//           avgRow[col.colKey] = avg;
//           if (avg > 0) {
//             batchSgpaSum += avg;
//             batchSgpaCount++;
//           }
//         }
//         const batchSgpa = batchSgpaCount > 0 ? round2(batchSgpaSum / batchSgpaCount) : 0;
//         avgRow['SGPA'] = batchSgpa;
//         avgRow['GSGPA'] = batchSgpa;
//         batchResults.push({
//           batchId,
//           batchCode: batch.batchCode,
//           batchName: batch.batchName,
//           columns: columns.map((c) => ({
//             colKey: c.colKey,
//             colLabel: c.colLabel,
//             catName: c.catName,
//             subCatName: c.subCatName
//           })),
//           students: studentRows,
//           batchAverage: avgRow,
//           totalStudents: batchStudents.length
//         });
//       }
//       return res.status(200).json({
//         status: true,
//         view: 'batch',
//         count: batchResults.length,
//         batches: batchResults
//       });
//     }
//     if (view === 'student') {
//       if (!admissionNos.length) return res.status(400).json({ status: false, message: 'admissionNos[] is required for student view' });
//       const students = await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, batchId: 1, batchCode: 1, 'student.name': 1 }).lean();
//       const studentMap = new Map(students.map((s) => [s.admissionNo, s]));
//       const studentResults = [];
//       for (const admNo of admissionNos) {
//         const student = studentMap.get(admNo);
//         if (!student) continue;
//         const stuBatchRows = enabledByBatch.get(student.batchId) || [];
//         const testRows = [];
//         for (const row of stuBatchRows) {
//           const testId = safeTrim(row.testId);
//           const asg = assignMap.get(testId);
//           if (!asg) continue;
//           const stuData = (row.students || []).find((s) => safeTrim(s.admissionNo) === admNo);
//           const cgpa = stuData?.status === 'COMPLETED' && stuData?.cgpa !== null ? round2(Number(stuData.cgpa)) : 0;
//           const status = stuData?.status || 'NOT_ASSIGNED';
//           const cat = catMap.get(safeTrim(asg.categoryId)) || {};
//           const subCat = subCatMap.get(safeTrim(asg.subCategoryId)) || {};
//           const subDoc = subjectDocMap.get(String(asg.subjectId)) || {};
//           testRows.push({
//             testId,
//             testCode: asg.testCode || null,
//             testNo: asg.testNo || null,
//             subjectName: subDoc.subjectName || null,
//             topicName: topicMap.get(safeTrim(asg.topicId)) || null,
//             subTopicName: subTopicMap.get(safeTrim(asg.subTopicId)) || null,
//             categoryName: cat.categoryName || null,
//             subCategoryName: subCat.subCategoryName || null,
//             colLabel: `${safeTrim(cat.categoryCode || cat.categoryName || '')}${safeTrim(subCat.subCategoryCode || subCat.subCategoryName || '')}`,
//             cgpa,
//             status
//           });
//         }
//         testRows.sort((a, b) => {
//           const s = (a.subjectName || '').localeCompare(b.subjectName || '');
//           if (s !== 0) return s;
//           return (a.topicName || '').localeCompare(b.topicName || '');
//         });
//         const completedRows = testRows.filter((r) => r.cgpa > 0);
//         const sgpa = completedRows.length > 0 ? round2(completedRows.reduce((s, r) => s + r.cgpa, 0) / completedRows.length) : 0;
//         studentResults.push({
//           admissionNo: admNo,
//           studentName: student.student?.name || null,
//           batchCode: student.batchCode || null,
//           sgpa,
//           tests: testRows
//         });
//       }
//       return res.status(200).json({
//         status: true,
//         view: 'student',
//         count: studentResults.length,
//         students: studentResults
//       });
//     }
//     return res.status(400).json({ status: false, message: 'Invalid view. Use batch or student' });
//   } catch (err) {
//     return next(err);
//   }
// };

const getSlashDetailReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const batchIds = await pickBatchIds(req);
    if (!batchIds.length) return res.status(400).json({ status: false, message: 'batchIds[] is required' });

    const filterSubjectId = safeTrim(req.body?.subjectId || '');
    const filterTopicIds = Array.isArray(req.body?.topicIds) ? req.body.topicIds.map(safeTrim).filter(Boolean) : [];

    // Fetch batches
    const batches = await Batch.find({ tenantId, batchId: { $in: batchIds }, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1 }).lean();
    const batchMap = new Map(batches.map((b) => [b.batchId, b]));

    // Fetch enabled tests
    const enableQuery = {
      tenantId,
      isdeleted: false,
      status: 'enabled',
      batchId: { $in: batchIds }
    };
    if (filterSubjectId) enableQuery.subjectId = filterSubjectId;
    const enabledRows = await BatchAssignEnable.find(enableQuery).lean();

    if (!enabledRows.length) return res.status(200).json({ status: true, count: 0, data: [] });

    // Fetch assignment meta for topicId
    const allTestIds = [...new Set(enabledRows.map((r) => safeTrim(r.testId)).filter(Boolean))];
    const assignments = await Assignment.find({ tenantId, testId: { $in: allTestIds }, isdeleted: false }, { testId: 1, topicId: 1, subTopicId: 1, subjectId: 1 }).lean();
    const assignMap = new Map(assignments.map((a) => [a.testId, a]));

    // Fetch topic names
    const topicIds = [...new Set(assignments.map((a) => safeTrim(a.topicId)).filter(Boolean))];
    const topicDocs = await Topic.find({ tenantId, topicId: { $in: topicIds }, isdeleted: false }, { topicId: 1, topicName: 1 }).lean();
    const topicNameMap = new Map(topicDocs.map((t) => [t.topicId, t.topicName]));

    // Fetch subject names
    const subjectIds = [...new Set(enabledRows.map((r) => safeTrim(r.subjectId)).filter(Boolean))];
    const subjectDocs = await Subject.find(
      {
        _id: {
          $in: subjectIds
            .map((id) => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        }
      },
      { subjectName: 1 }
    ).lean();
    const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));

    // Build testId → topicId map, filtered by topicIds if provided
    const testTopicMap = new Map(); // testId → topicId
    for (const asg of assignments) {
      const topicId = safeTrim(asg.topicId);
      if (filterTopicIds.length && !filterTopicIds.includes(topicId)) continue;
      testTopicMap.set(safeTrim(asg.testId), topicId);
    }

    // Build batchId → subjectId → topicId → testIds[] map
    // for counting available tests per batch+subject+topic
    const batchSubjectTopicTests = new Map();
    // key: `${batchId}::${subjectId}::${topicId}` → Set of testIds

    for (const row of enabledRows) {
      const bid = safeTrim(row.batchId);
      const sid = safeTrim(row.subjectId);
      const testId = safeTrim(row.testId);
      const topicId = testTopicMap.get(testId);
      if (!topicId) continue;

      const key = `${bid}::${sid}::${topicId}`;
      if (!batchSubjectTopicTests.has(key)) batchSubjectTopicTests.set(key, new Set());
      batchSubjectTopicTests.get(key).add(testId);
    }

    // Build student data
    // admissionNo → batchId → subjectId → topicId → { completed, total }
    // First collect all students from enabledRows
    const studentBatchMap = new Map(); // admissionNo → batchId
    const studentNameMap = new Map(); // admissionNo → name

    // Fetch students for all batches
    const allStudents = await StudentProfile.find({ tenantId, batchId: { $in: batchIds }, isdeleted: false, status: 'ACTIVE' }, { admissionNo: 1, batchId: 1, batchCode: 1, 'student.name': 1 }).lean();

    for (const stu of allStudents) {
      studentBatchMap.set(safeTrim(stu.admissionNo), stu);
      studentNameMap.set(safeTrim(stu.admissionNo), stu.student?.name || null);
    }

    // Build per student per subject+topic completion map
    // key: `${admNo}::${batchId}::${subjectId}::${topicId}` → { completedTests: Set, totalTests: Set }
    const studentTopicMap = new Map();

    for (const row of enabledRows) {
      const bid = safeTrim(row.batchId);
      const sid = safeTrim(row.subjectId);
      const testId = safeTrim(row.testId);
      const topicId = testTopicMap.get(testId);
      if (!topicId) continue;

      for (const stu of row.students || []) {
        const admNo = safeTrim(stu.admissionNo);
        if (!admNo) continue;
        const key = `${admNo}::${bid}::${sid}::${topicId}`;
        if (!studentTopicMap.has(key)) {
          studentTopicMap.set(key, {
            admissionNo: admNo,
            batchId: bid,
            subjectId: sid,
            topicId,
            completedTests: new Set(),
            totalTests: new Set()
          });
        }
        const entry = studentTopicMap.get(key);
        entry.totalTests.add(testId);
        if (stu.status === 'COMPLETED') entry.completedTests.add(testId);
      }
    }

    // Build flat report rows
    const data = [];

    for (const [key, entry] of studentTopicMap.entries()) {
      const stuDoc = studentBatchMap.get(entry.admissionNo) || {};
      const batch = batchMap.get(entry.batchId) || {};
      const subDoc = subjectDocMap.get(entry.subjectId) || {};
      const topicName = topicNameMap.get(entry.topicId) || entry.topicId;

      const available = entry.totalTests.size;
      const completed = entry.completedTests.size;
      const notCompleted = available - completed;

      data.push({
        batchCode: batch.batchCode || null,
        batchName: batch.batchName || null,
        admissionNo: entry.admissionNo,
        studentName: studentNameMap.get(entry.admissionNo) || null,
        subjectId: entry.subjectId,
        subjectName: subDoc.subjectName || null,
        topicId: entry.topicId,
        topicName,
        available,
        completed,
        notCompleted,
        report: `${available}/${completed}/${notCompleted}`
      });
    }

    // Sort by batchCode → studentName → subjectName → topicName
    data.sort((a, b) => {
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
      const sn = (a.studentName || '').localeCompare(b.studentName || '');
      if (sn !== 0) return sn;
      const sub = (a.subjectName || '').localeCompare(b.subjectName || '');
      if (sub !== 0) return sub;
      return (a.topicName || '').localeCompare(b.topicName || '');
    });

    const summary = {
      totalStudents: new Set(data.map((r) => r.admissionNo)).size,
      totalBatches: new Set(data.map((r) => r.batchCode)).size,
      totalTopics: new Set(data.map((r) => r.topicId)).size
    };

    return res.status(200).json({
      status: true,
      summary,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getAssignmentReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const view = safeTrim(req.body?.view || 'batch'); // 'batch' | 'student'
    const filterSubjectId = safeTrim(req.body?.subjectId || '');
    const admissionNos = Array.isArray(req.body?.admissionNos) ? req.body.admissionNos.map(safeTrim).filter(Boolean) : [];

    const batchIds = await pickBatchIds(req);
    if (!batchIds.length) return res.status(400).json({ status: false, message: 'batchIds[] is required' });

    // ── Fetch batches ──
    const batches = await Batch.find({ tenantId, batchId: { $in: batchIds }, isdeleted: false }).lean();
    if (!batches.length) return res.status(200).json({ status: true, view, count: 0, batches: [] });

    const batchMap = new Map(batches.map((b) => [b.batchId, b]));

    // ── Fetch enabled tests ──
    const enableQuery = {
      tenantId,
      isdeleted: false,
      status: 'enabled',
      batchId: { $in: batchIds }
    };
    if (filterSubjectId) enableQuery.subjectId = filterSubjectId;
    const enabledRows = await BatchAssignEnable.find(enableQuery).lean();
    if (!enabledRows.length) return res.status(200).json({ status: true, view, count: 0, batches: [] });

    const allTestIds = [...new Set(enabledRows.map((r) => safeTrim(r.testId)).filter(Boolean))];

    // ── Fetch Assignment meta ──
    const assignments = await Assignment.find({ tenantId, testId: { $in: allTestIds }, isdeleted: false }, { testId: 1, testNo: 1, testCode: 1, subjectId: 1, topicId: 1, subTopicId: 1, categoryId: 1, subCategoryId: 1, classNo: 1 }).lean();
    const assignMap = new Map(assignments.map((a) => [a.testId, a]));

    // ── Derive categoryIds and subCategoryIds BEFORE using them ──
    const categoryIds = [...new Set(assignments.map((a) => safeTrim(a.categoryId)).filter(Boolean))];
    const subCategoryIds = [...new Set(assignments.map((a) => safeTrim(a.subCategoryId)).filter(Boolean))];

    // ── Fetch category + subcategory names ──
    const [catDocs, subCatDocs] = await Promise.all([
      ExamCategory.find({ tenantId, categoryId: { $in: categoryIds }, isdeleted: false }, { categoryId: 1, categoryName: 1, categoryCode: 1 }).lean(),
      ExamSubCategory.find({ tenantId, subCategoryId: { $in: subCategoryIds }, isdeleted: false }, { subCategoryId: 1, subCategoryName: 1, subCategoryCode: 1, categoryId: 1 }).lean()
    ]);
    const catMap = new Map(catDocs.map((c) => [c.categoryId, c]));
    const subCatMap = new Map(subCatDocs.map((s) => [s.subCategoryId, s]));

    // ── Program-specific category/subcategory sort order (mirrors student.controller.js getAllClassSubjectTopics) ──
    const programIds = [...new Set(batches.map((b) => safeTrim(b.programId)).filter(Boolean))];
    const programDocs = programIds.length ? await Program.find({ tenantId, programId: { $in: programIds }, isdeleted: false }, { programId: 1, examMappings: 1 }).lean() : [];
    const programSortMap = new Map(); // programId → Map("catId::subCatId" → sortOrder)
    for (const p of programDocs) {
      const m = new Map();
      for (const em of p.examMappings || []) {
        const key = `${safeTrim(em.categoryId)}::${safeTrim(em.subCategoryId)}`;
        m.set(key, Number.isFinite(Number(em.sortOrder)) ? Number(em.sortOrder) : 0);
      }
      programSortMap.set(p.programId, m);
    }
    // Resolve sortOrder for a category/subcategory combo, scoped to a specific program.
    // Falls back to the subcategory's own global sortOrder if the program has no explicit mapping for it.
    const resolveSortOrder = (programId, catId, subCatId) => {
      const progMap = programSortMap.get(programId);
      const key = `${catId}::${subCatId}`;
      if (progMap && progMap.has(key)) return progMap.get(key);
      const subCat = subCatMap.get(subCatId) || {};
      return subCat.sortOrder || 0;
    };

    const subjectIds = [...new Set(enabledRows.map((r) => safeTrim(r.subjectId)).filter(Boolean))];
    const subjectDocs = await Subject.find(
      {
        _id: {
          $in: subjectIds
            .map((id) => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        }
      },
      { subjectName: 1, subjectCode: 1 }
    ).lean();
    const subjectDocMap = new Map(subjectDocs.map((s) => [String(s._id), s]));

    // ── Fetch topic + subtopic names (for student view) ──
    let topicMap = new Map();
    let subTopicMap = new Map();
    if (view === 'student') {
      const topicIds = [...new Set(assignments.map((a) => safeTrim(a.topicId)).filter(Boolean))];
      const subTopicIds = [...new Set(assignments.map((a) => safeTrim(a.subTopicId)).filter(Boolean))];
      const [topicDocs, subTopicDocs] = await Promise.all([Topic.find({ tenantId, topicId: { $in: topicIds }, isdeleted: false }, { topicId: 1, topicName: 1 }).lean(), SubTopic.find({ tenantId, subTopicId: { $in: subTopicIds }, isdeleted: false }, { subTopicId: 1, subTopicName: 1 }).lean()]);
      topicMap = new Map(topicDocs.map((t) => [t.topicId, t.topicName]));
      subTopicMap = new Map(subTopicDocs.map((s) => [s.subTopicId, s.subTopicName]));
    }

    // ── Group enabled rows by batchId ──
    const enabledByBatch = new Map();
    for (const row of enabledRows) {
      const bid = safeTrim(row.batchId);
      if (!enabledByBatch.has(bid)) enabledByBatch.set(bid, []);
      enabledByBatch.get(bid).push(row);
    }

    // Helper to build column label from category + subcategory
    const buildColLabel = (catId, subCatId) => {
      const cat = catMap.get(catId) || {};
      const subCat = subCatMap.get(subCatId) || {};
      const catPart = safeTrim(cat.categoryName);
      const subCatPart = safeTrim(subCat.subCategoryName);
      return `${catPart} ${subCatPart}`;
    };

    // ════════════════════════════════════════════════════════════════
    // BATCH VIEW
    // ════════════════════════════════════════════════════════════════
    if (view === 'batch') {
      const batchResults = [];

      for (const batchId of batchIds) {
        const batch = batchMap.get(batchId);
        if (!batch) continue;

        const batchEnabledRows = enabledByBatch.get(batchId) || [];
        if (!batchEnabledRows.length) continue;

        // Build columns — unique categoryId+subCategoryId combos for this batch
        const colKeySet = new Map(); // colKey → column meta
        for (const row of batchEnabledRows) {
          const asg = assignMap.get(safeTrim(row.testId));
          if (!asg) continue;
          const catId = safeTrim(asg.categoryId);
          const subCatId = safeTrim(asg.subCategoryId);
          if (!catId || !subCatId) continue;
          const colKey = `${catId}::${subCatId}`;
          if (!colKeySet.has(colKey)) {
            const cat = catMap.get(catId) || {};
            const subCat = subCatMap.get(subCatId) || {};
            colKeySet.set(colKey, {
              colKey,
              categoryId: catId,
              subCategoryId: subCatId,
              catName: cat.categoryName || catId,
              subCatName: subCat.subCategoryName || subCatId,
              colLabel: buildColLabel(catId, subCatId),
              sortOrder: resolveSortOrder(batch.programId, catId, subCatId)
            });
          }
        }

        // Sort columns by the batch's program-mapped sortOrder
        const columns = Array.from(colKeySet.values()).sort((a, b) => a.sortOrder - b.sortOrder);

        // Build testId → colKey map
        const testColMap = new Map();
        for (const row of batchEnabledRows) {
          const asg = assignMap.get(safeTrim(row.testId));
          if (!asg) continue;
          const catId = safeTrim(asg.categoryId);
          const subCatId = safeTrim(asg.subCategoryId);
          if (!catId || !subCatId) continue;
          testColMap.set(safeTrim(row.testId), `${catId}::${subCatId}`);
        }

        // Build student → colKey → cgpa map
        const studentColCgpa = new Map(); // admissionNo → Map(colKey → cgpa)
        for (const row of batchEnabledRows) {
          const testId = safeTrim(row.testId);
          const colKey = testColMap.get(testId);
          if (!colKey) continue;
          for (const stu of row.students || []) {
            const admNo = safeTrim(stu.admissionNo);
            if (!admNo) continue;
            if (!studentColCgpa.has(admNo)) studentColCgpa.set(admNo, new Map());
            const stuMap = studentColCgpa.get(admNo);
            if (stu.status === 'COMPLETED' && stu.cgpa !== null && stu.cgpa !== undefined) {
              // Only one test per col — take as-is
              stuMap.set(colKey, round2(Number(stu.cgpa)));
            } else if (!stuMap.has(colKey)) {
              stuMap.set(colKey, 0);
            }
          }
        }

        // Fetch all active students in batch ordered by name
        const batchStudents = await StudentProfile.find({ tenantId, batchId, isdeleted: false, status: 'ACTIVE' }, { admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).lean();

        // Build student rows
        const studentRows = [];
        let slNo = 0;
        const colSums = new Map(); // colKey → sum of all student cgpa
        const colNonZeroCounts = new Map(); // colKey → count with cgpa > 0

        for (const stu of batchStudents) {
          const admNo = safeTrim(stu.admissionNo);
          const stuColMap = studentColCgpa.get(admNo) || new Map();
          const row = {
            slNo: ++slNo,
            admissionNo: admNo,
            studentName: stu.student?.name || null
          };

          let sgpaSum = 0;
          let sgpaCount = 0;

          for (const col of columns) {
            const cgpa = stuColMap.has(col.colKey) ? stuColMap.get(col.colKey) : 0;
            row[col.colKey] = cgpa;
            colSums.set(col.colKey, (colSums.get(col.colKey) || 0) + cgpa);
            if (cgpa > 0) {
              colNonZeroCounts.set(col.colKey, (colNonZeroCounts.get(col.colKey) || 0) + 1);
              sgpaSum += cgpa;
              sgpaCount++;
            }
          }

          // SGPA = average of non-zero cgpa columns for this student
          row['SGPA'] = sgpaCount > 0 ? round2(sgpaSum / sgpaCount) : 0;
          row['GSGPA'] = row['SGPA']; // same for now

          studentRows.push(row);
        }

        // Build batch average row
        const avgRow = {
          slNo: null,
          admissionNo: null,
          studentName: 'Batch Average (BGPA)'
        };
        let batchSgpaSum = 0;
        let batchSgpaCount = 0;
        const totalStudents = batchStudents.length;

        for (const col of columns) {
          const total = colSums.get(col.colKey) || 0;
          const avg = totalStudents > 0 ? round2(total / totalStudents) : 0;
          avgRow[col.colKey] = avg;
          if (avg > 0) {
            batchSgpaSum += avg;
            batchSgpaCount++;
          }
        }
        avgRow['SGPA'] = batchSgpaCount > 0 ? round2(batchSgpaSum / batchSgpaCount) : 0;
        avgRow['GSGPA'] = avgRow['SGPA'];

        batchResults.push({
          batchId,
          batchCode: batch.batchCode,
          batchName: batch.batchName,
          columns: columns.map((c) => ({
            colKey: c.colKey,
            colLabel: c.colLabel,
            catName: c.catName,
            subCatName: c.subCatName,
            sortOrder: c.sortOrder
          })),
          students: studentRows,
          batchAverage: avgRow,
          totalStudents
        });
      }

      return res.status(200).json({
        status: true,
        view: 'batch',
        count: batchResults.length,
        batches: batchResults
      });
    }

    // ════════════════════════════════════════════════════════════════
    // STUDENT VIEW
    // ════════════════════════════════════════════════════════════════
    if (view === 'student') {
      if (!admissionNos.length)
        return res.status(400).json({
          status: false,
          message: 'admissionNos[] is required for student view'
        });

      // Fetch student profiles
      const students = await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, batchId: 1, batchCode: 1, 'student.name': 1 }).lean();
      const studentMap = new Map(students.map((s) => [s.admissionNo, s]));

      const studentResults = [];

      for (const admNo of admissionNos) {
        const student = studentMap.get(admNo);
        if (!student) continue;

        const stuBatchRows = enabledByBatch.get(student.batchId) || [];
        const testRows = [];

        for (const row of stuBatchRows) {
          const testId = safeTrim(row.testId);
          const asg = assignMap.get(testId);
          if (!asg) continue;

          const stuData = (row.students || []).find((s) => safeTrim(s.admissionNo) === admNo);
          const cgpa = stuData?.status === 'COMPLETED' && stuData?.cgpa !== null ? round2(Number(stuData.cgpa)) : 0;
          const status = stuData?.status || 'NOT_ASSIGNED';
          const catId = safeTrim(asg.categoryId);
          const subCatId = safeTrim(asg.subCategoryId);
          const cat = catMap.get(catId) || {};
          const subCat = subCatMap.get(subCatId) || {};
          const subDoc = subjectDocMap.get(String(asg.subjectId)) || {};
          const studentProgramId = batchMap.get(student.batchId)?.programId;

          testRows.push({
            testId,
            testCode: asg.testCode || null,
            testNo: asg.testNo || null,
            subjectName: subDoc.subjectName || null,
            topicName: topicMap.get(safeTrim(asg.topicId)) || null,
            subTopicName: subTopicMap.get(safeTrim(asg.subTopicId)) || null,
            categoryName: cat.categoryName || null,
            subCategoryName: subCat.subCategoryName || null,
            colLabel: buildColLabel(catId, subCatId),
            sortOrder: resolveSortOrder(studentProgramId, catId, subCatId),
            cgpa,
            status
          });
        }

        // Sort by the student's batch-program-mapped sortOrder, then subject → topic as a tiebreaker
        testRows.sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          const s = (a.subjectName || '').localeCompare(b.subjectName || '');
          if (s !== 0) return s;
          return (a.topicName || '').localeCompare(b.topicName || '');
        });

        // SGPA = average of non-zero cgpa rows
        const completedRows = testRows.filter((r) => r.cgpa > 0);
        const sgpa = completedRows.length > 0 ? round2(completedRows.reduce((s, r) => s + r.cgpa, 0) / completedRows.length) : 0;

        studentResults.push({
          admissionNo: admNo,
          studentName: student.student?.name || null,
          batchCode: student.batchCode || null,
          sgpa,
          tests: testRows
        });
      }

      return res.status(200).json({
        status: true,
        view: 'student',
        count: studentResults.length,
        students: studentResults
      });
    }

    return res.status(400).json({ status: false, message: 'Invalid view. Use batch or student' });
  } catch (err) {
    return next(err);
  }
};

export default {
  getStudentListReport,
  getStaffListReport,
  getLateEntryReport,
  getTimetableReport,
  getPhaseAllotmentReport,
  getAssignmentCompletionReport,
  getExamCompletionReport,
  getBatchInfoReport,
  getSubjectHoursReport,
  getFeedbackReport,
  getBatchPtmReport,
  getCgpaReport,
  getSlashReport,
  getSubjectsByBatch,
  getAssignmentReport,
  getSlashDetailReport
};

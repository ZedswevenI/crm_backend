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

// ─── Helpers: resolve single or multiple batch ───────────────────────────────
const resolveBatch = async (tenantId, batchId, batchCode) => {
  const q = { tenantId, isdeleted: false };
  if (batchId) q.batchId = safeTrim(batchId);
  else if (batchCode) q.batchCode = safeTrim(batchCode);
  else return null;
  return Batch.findOne(q).lean();
};

const pickBatchIds = (req) => {
  const arr = req.body?.batchIds;
  return Array.isArray(arr) && arr.length ? arr.map(safeTrim).filter(Boolean) : [];
};

const pickBatchCodes = (req) => {
  const arr = req.body?.batchCodes;
  return Array.isArray(arr) && arr.length ? arr.map(safeTrim).filter(Boolean) : [];
};

const applyBatchIdFilter = (query, batchIds) => {
  if (batchIds.length === 1) query.batchId = batchIds[0];
  else if (batchIds.length > 1) query.batchId = { $in: batchIds };
};

const applyBatchCodeFilter = (query, batchCodes) => {
  if (batchCodes.length === 1) query.batchCode = batchCodes[0];
  else if (batchCodes.length > 1) query.batchCode = { $in: batchCodes };
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 1 — Student List with Profile
// POST /batch/reports/students
// ═══════════════════════════════════════════════════════════════════════════════
const getStudentListReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchIds = pickBatchIds(req);
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

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 2 — Staff List with Details
// POST /batch/reports/staff
// ═══════════════════════════════════════════════════════════════════════════════
const getStaffListReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const stBatchIds = pickBatchIds(req);

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

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 3 — Late Entry Report
// POST /batch/reports/late-entries
// ═══════════════════════════════════════════════════════════════════════════════
const getLateEntryReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchCode = safeTrim(req.body?.batchCode || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const type = safeTrim(req.body?.type || ''); // STAFF | STUDENT | ''
    const entryType = safeTrim(req.body?.entryType || ''); // LATE | EARLY_LEAVE | ''

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    if (!fromDate) return res.status(400).json({ status: false, message: 'fromDate is required' });
    if (!toDate) return res.status(400).json({ status: false, message: 'toDate is required' });

    const batchCodes = pickBatchCodes(req);
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

    // Summary
    const studentCount = data.filter((e) => e.type === 'STUDENT').length;
    const staffCount = data.filter((e) => e.type === 'STAFF').length;
    const lateCount = data.filter((e) => e.entryType === 'LATE').length;
    const earlyLeaveCount = data.filter((e) => e.entryType === 'EARLY_LEAVE').length;

    // Group by person
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
    const batchCodes = pickBatchCodes(req);
    const ttQuery = { tenantId, wkStartOn: { $in: [...weekStarts] }, status: 'Active', isdeleted: false };
    applyBatchCodeFilter(ttQuery, batchCodes);
    const timetables = await TimeTable.find(ttQuery).lean();
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
      fromDate,
      toDate: effectiveToDate,
      summary: { totalDays: schedule.length, totalPeriods, cancelledCount },
      data: schedule
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 5 — Phase Plan Allotment
// POST /batch/reports/phase-allotment
// ═══════════════════════════════════════════════════════════════════════════════
const getPhaseAllotmentReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId || '');
    const batchCode = safeTrim(req.body?.batchCode || '');
    const subjectId = safeTrim(req.body?.subjectId || ''); // optional filter

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
    if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });

    // Get all published timetables for batch (or all batches)
    const paBatchIds = pickBatchIds(req);
    const paBatches = paBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: paBatchIds }, isdeleted: false }).lean() : batch ? [batch] : null;
    const ttFilter = { tenantId, isdeleted: false, status: 'Active' };
    if (paBatches)
      applyBatchCodeFilter(
        ttFilter,
        paBatches.map((b) => b.batchCode)
      );
    const timetables = await TimeTable.find(ttFilter).lean();

    // Build subject → phaseId → minutes allotted from timetable
    const subjectPhaseMins = new Map(); // key: `${subjectId}_${phaseId}` → mins
    const subjectTotalMins = new Map(); // key: subjectId → total mins

    const countPeriod = (p) => {
      if (p?.isCancelled) return;
      const sid = safeTrim(p?.subjectId);
      const phId = safeTrim(p?.phaseId || '');
      if (!sid) return;
      if (subjectId && sid !== subjectId) return;
      const start = toInt(p?.time?.startMin, -1);
      const end = toInt(p?.time?.endMin, -1);
      if (start < 0 || end <= start) return;
      const mins = end - start;

      subjectTotalMins.set(sid, (subjectTotalMins.get(sid) || 0) + mins);

      const key = `${sid}_${phId}`;
      subjectPhaseMins.set(key, (subjectPhaseMins.get(key) || 0) + mins);
    };

    for (const tt of timetables) {
      for (const dayObj of tt.week || []) {
        for (const p of dayObj.periods || []) countPeriod(p);
      }
      // Day overrides
      for (const ov of tt.dayOverrides || []) {
        if (ov.action === 'CANCEL_DAY') continue;
        if (ov.action === 'REPLACE_DAY') {
          for (const p of ov.periods || []) countPeriod(p);
        }
      }
      // Period overrides — net change
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
                const key = `${sid}_${phId}`;
                subjectPhaseMins.set(key, Math.max(0, (subjectPhaseMins.get(key) || 0) - mins));
                subjectTotalMins.set(sid, Math.max(0, (subjectTotalMins.get(sid) || 0) - mins));
              }
            }
          }
        } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
          // subtract old, add new
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
                const key = `${sid}_${phId}`;
                subjectPhaseMins.set(key, Math.max(0, (subjectPhaseMins.get(key) || 0) - mins));
                subjectTotalMins.set(sid, Math.max(0, (subjectTotalMins.get(sid) || 0) - mins));
              }
            }
          }
          countPeriod({ ...ov.period, periodNo: ov.periodNo });
        } else if (ov.action === 'ADD_PERIOD' && ov.period) {
          countPeriod({ ...ov.period, periodNo: ov.periodNo });
        }
      }
    }

    // Fetch phases for this batch's program + classNo (or all if no batch)
    const phaseQuery = { tenantId, isdeleted: false, status: 'Active' };
    if (batch) {
      phaseQuery.programId = batch.programId;
      phaseQuery.classNo = batch.classNo;
    }
    if (subjectId) phaseQuery.subjectId = new mongoose.Types.ObjectId(subjectId);

    const phases = await Phase.find(phaseQuery).sort({ subjectId: 1, sortOrder: 1 }).lean();

    // Group phases by subjectId
    const phasesBySubject = new Map();
    for (const ph of phases) {
      const sid = String(ph.subjectId);
      if (!phasesBySubject.has(sid)) phasesBySubject.set(sid, []);
      phasesBySubject.get(sid).push(ph);
    }

    // Build report
    const toHours = (mins) => round2(mins / 60);

    const subjectIds = subjectId ? [subjectId] : [...new Set([...subjectTotalMins.keys(), ...phasesBySubject.keys()])];

    // Fetch subject names
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

    const data = subjectIds.map((sid) => {
      const subDoc = subjectDocMap.get(sid) || {};
      const totalAllocMins = subjectTotalMins.get(sid) || 0;
      const subjectPhases = phasesBySubject.get(sid) || [];

      let totalEstMins = 0;
      const phasesReport = subjectPhases
        .map((ph) => {
          const phAllotMins = subjectPhaseMins.get(`${sid}_${ph.phaseId}`) || 0;
          const phEstMins = (ph.topics || []).reduce((s, t) => s + (t.estHours || 0) * 60, 0);
          totalEstMins += phEstMins;

          const topicsReport = (ph.topics || [])
            .map((t) => {
              const estMins = (t.estHours || 0) * 60;
              return {
                topicName: t.topicName,
                estHours: t.estHours || 0,
                sortOrder: t.sortOrder || 0
              };
            })
            .sort((a, b) => a.sortOrder - b.sortOrder);

          const remainingMins = phEstMins - phAllotMins;
          const progressPct = phEstMins > 0 ? round2((phAllotMins / phEstMins) * 100) : null;

          return {
            phaseId: ph.phaseId,
            phaseName: ph.phaseName,
            sortOrder: ph.sortOrder || 0,
            estHours: toHours(phEstMins),
            allottedHours: toHours(phAllotMins),
            remainingHours: toHours(remainingMins),
            progressPct,
            topics: topicsReport
          };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);

      // Unassigned hours — allotted without a phase
      const unassignedKey = `${sid}_`;
      const unassignedMins = subjectPhaseMins.get(unassignedKey) || 0;

      const totalRemMins = totalEstMins - totalAllocMins;

      return {
        subjectId: sid,
        subjectName: subDoc.subjectName || null,
        subjectCode: subDoc.subjectCode || null,
        totalEstHours: toHours(totalEstMins),
        totalAllottedHours: toHours(totalAllocMins),
        totalRemainingHours: toHours(totalRemMins),
        overallProgressPct: totalEstMins > 0 ? round2((totalAllocMins / totalEstMins) * 100) : null,
        unassignedHours: toHours(unassignedMins),
        phases: phasesReport
      };
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

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 6 — Assignment Completion
// POST /batch/reports/assignments
// ═══════════════════════════════════════════════════════════════════════════════
const getAssignmentCompletionReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId || '');
    const batchCode = safeTrim(req.body?.batchCode || '');
    const subjectId = safeTrim(req.body?.subjectId || '');

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
    if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });

    const abBatchIds = pickBatchIds(req);
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

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 7 — Mock Exam Completion
// POST /batch/reports/exams
// ═══════════════════════════════════════════════════════════════════════════════
const getExamCompletionReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId || '');
    const batchCode = safeTrim(req.body?.batchCode || '');

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
    if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });

    const exBatchIds = pickBatchIds(req);
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

const getSubjectHoursReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId || '');
    const batchCode = safeTrim(req.body?.batchCode || '');
    const phaseId = safeTrim(req.body?.phaseId || '');
    const filterSubjectId = safeTrim(req.body?.subjectId || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const batch = batchId || batchCode ? await resolveBatch(tenantId, batchId, batchCode) : null;
    if ((batchId || batchCode) && !batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    const shBatchIds = pickBatchIds(req);
    const shBatches = shBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: shBatchIds }, isdeleted: false }).lean() : batch ? [batch] : null;
    // const shTtQuery = { tenantId, isdeleted: false, status: 'Active' };
    // if (shBatches)
    //   applyBatchCodeFilter(
    //     shTtQuery,
    //     shBatches.map((b) => b.batchCode)
    //   );
    // const timetables = await TimeTable.find(shTtQuery).lean();
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
      shTtQuery.wkStartOn = { ...shTtQuery.wkStartOn, $lte: toMonday };
    }
    const timetables = await TimeTable.find(shTtQuery).lean();
    if (!timetables.length) {
      return res.status(200).json({
        status: true,
        batchCode: batch?.batchCode || null,
        count: 0,
        data: [],
        summary: { totalAllottedHours: 0 }
      });
    }
    const batchNameMap = new Map((shBatches || []).map((b) => [b.batchCode, b.batchName]));
    // const subjectMins = new Map();
    // const subjectMeta = new Map();
    // const countP = (p) => {
    //   if (p?.isCancelled) return;
    //   const sid = safeTrim(p?.subjectId);
    //   if (!sid) return;
    //   if (phaseId && safeTrim(p?.phaseId) !== phaseId) return;
    //   const start = toInt(p?.time?.startMin, -1);
    //   const end = toInt(p?.time?.endMin, -1);
    //   if (start < 0 || end <= start) return;
    //   subjectMins.set(sid, (subjectMins.get(sid) || 0) + (end - start));
    //   if (!subjectMeta.has(sid)) {
    //     subjectMeta.set(sid, {
    //       subjectCode: safeTrim(p?.subjectCode) || null,
    //       subjectName: safeTrim(p?.subjectName) || null
    //     });
    //   }
    // };
    // for (const tt of timetables) {
    //   for (const dayObj of tt.week || []) {
    //     for (const p of dayObj.periods || []) countP(p);
    //   }
    //   for (const ov of tt.dayOverrides || []) {
    //     if (ov.action === 'CANCEL_DAY') continue;
    //     if (ov.action === 'REPLACE_DAY') {
    //       for (const p of ov.periods || []) countP(p);
    //     }
    //   }
    //   const ovrMap = new Map();
    //   for (const ov of tt.periodOverrides || []) {
    //     ovrMap.set(`${ov.date}_${normDay(ov.day)}_${ov.periodNo}`, ov);
    //   }
    //   for (const ov of ovrMap.values()) {
    //     if (ov.action === 'CANCEL_PERIOD') {
    //       const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
    //       const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
    //       if (base && !base.isCancelled) {
    //         const sid = safeTrim(base.subjectId);
    //         const s = toInt(base.time?.startMin, -1);
    //         const e = toInt(base.time?.endMin, -1);
    //         if (sid && s >= 0 && e > s) {
    //           if (!phaseId || safeTrim(base.phaseId) === phaseId) {
    //             subjectMins.set(sid, Math.max(0, (subjectMins.get(sid) || 0) - (e - s)));
    //           }
    //         }
    //       }
    //     } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
    //       const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
    //       const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
    //       if (base && !base.isCancelled) {
    //         const sid = safeTrim(base.subjectId);
    //         const s = toInt(base.time?.startMin, -1);
    //         const e = toInt(base.time?.endMin, -1);
    //         if (sid && s >= 0 && e > s) {
    //           if (!phaseId || safeTrim(base.phaseId) === phaseId) {
    //             subjectMins.set(sid, Math.max(0, (subjectMins.get(sid) || 0) - (e - s)));
    //           }
    //         }
    //       }
    //       countP({ ...ov.period, periodNo: ov.periodNo });
    //     } else if (ov.action === 'ADD_PERIOD' && ov.period) {
    //       countP({ ...ov.period, periodNo: ov.periodNo });
    //     }
    //   }
    // }
    const batchSubjectMins = new Map();
    const subjectMeta = new Map();
    const countP = (p, batchCode) => {
      if (p?.isCancelled) return;
      const sid = safeTrim(p?.subjectId);
      if (!sid) return;
      if (filterSubjectId && sid !== filterSubjectId) return;
      if (phaseId && safeTrim(p?.phaseId) !== phaseId) return;
      const start = toInt(p?.time?.startMin, -1);
      const end = toInt(p?.time?.endMin, -1);
      if (start < 0 || end <= start) return;
      const key = `${batchCode}_${sid}`;
      batchSubjectMins.set(key, (batchSubjectMins.get(key) || 0) + (end - start));
      if (!subjectMeta.has(sid)) {
        subjectMeta.set(sid, {
          subjectCode: safeTrim(p?.subjectCode) || null,
          subjectName: safeTrim(p?.subjectName) || null
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
        ovrMap.set(`${ov.date}_${normDay(ov.day)}_${ov.periodNo}`, ov);
      }
      for (const ov of ovrMap.values()) {
        if (ov.action === 'CANCEL_PERIOD') {
          const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
          const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
          if (base && !base.isCancelled) {
            const sid = safeTrim(base.subjectId);
            const s = toInt(base.time?.startMin, -1);
            const e = toInt(base.time?.endMin, -1);
            if (sid && s >= 0 && e > s) {
              if (!phaseId || safeTrim(base.phaseId) === phaseId) {
                const key = `${bc}_${sid}`;
                batchSubjectMins.set(key, Math.max(0, (batchSubjectMins.get(key) || 0) - (e - s)));
              }
            }
          }
        } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
          const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
          const base = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
          if (base && !base.isCancelled) {
            const sid = safeTrim(base.subjectId);
            const s = toInt(base.time?.startMin, -1);
            const e = toInt(base.time?.endMin, -1);
            if (sid && s >= 0 && e > s) {
              if (!phaseId || safeTrim(base.phaseId) === phaseId) {
                const key = `${bc}_${sid}`;
                batchSubjectMins.set(key, Math.max(0, (batchSubjectMins.get(key) || 0) - (e - s)));
              }
            }
          }
          countP({ ...ov.period, periodNo: ov.periodNo }, bc);
        } else if (ov.action === 'ADD_PERIOD' && ov.period) {
          countP({ ...ov.period, periodNo: ov.periodNo }, bc);
        }
      }
    }
    const toHours = (m) => round2(m / 60);
    const data = [];
    for (const [key, mins] of batchSubjectMins.entries()) {
      const [batchCode, ...subjectParts] = key.split('_');
      const sid = subjectParts.join('_');
      const meta = subjectMeta.get(sid) || {};
      data.push({
        batchCode,
        batchName: batchNameMap.get(batchCode) || null,
        subjectId: sid,
        subjectCode: meta.subjectCode || null,
        subjectName: meta.subjectName || null,
        allottedHours: toHours(mins),
        allottedMinutes: mins
      });
    }
    data.sort((a, b) => {
      const bc = a.batchCode.localeCompare(b.batchCode);
      if (bc !== 0) return bc;
      return (a.subjectName || '').localeCompare(b.subjectName || '');
    });
    const totalAllottedHours = toHours(Array.from(batchSubjectMins.values()).reduce((s, m) => s + m, 0));
    // const toHours = (m) => round2(m / 60);
    // const data = Array.from(subjectMins.entries())
    //   .map(([sid, mins]) => {
    //     const meta = subjectMeta.get(sid) || {};
    //     return {
    //       subjectId: sid,
    //       subjectCode: meta.subjectCode || null,
    //       subjectName: meta.subjectName || null,
    //       allottedHours: toHours(mins),
    //       allottedMinutes: mins
    //     };
    //   })
    //   .sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || ''));
    // const totalAllottedHours = toHours(Array.from(subjectMins.values()).reduce((s, m) => s + m, 0));
    return res.status(200).json({
      status: true,
      batchCode: batch?.batchCode || null,
      batchName: batch?.batchName || null,
      programId: batch?.programId || null,
      classNo: batch?.classNo || null,
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
    const fbBatchCodes = pickBatchCodes(req);
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
    const ptmBatchCodes = pickBatchCodes(req);
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

    const cgBatchIds = pickBatchIds(req);
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

    const slBatchIds = pickBatchIds(req);
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
          testIds: new Set(),
          // studentId → { testIds completed }
          studentTestMap: new Map()
        });
      }

      const grp = groupMap.get(key);
      const testId = safeTrim(row.testId);
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
        availableTests,
        totalStudents,
        fullyCompleted,
        inProgress,
        notStarted,
        completionPct
      });
    }

    // Sort by batchCode then subjectName
    data.sort((a, b) => {
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
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
  getSlashReport
};

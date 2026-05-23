import Batch from '../models/batch.model.js';
import Staff from '../models/staff.model.js';
import Task from '../models/task.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import TimeTable from '../models/timetable.model.js';
import Attendance from '../models/attandence.model.js';
import BatchAssignEnable from '../models/batchenabledAssignment.model.js';
import MockExamBatchAssign from '../models/mockExambatchmapping.model.js';
import MockExam from '../models/mockExam.model.js';
import PTM from '../models/ptm.model.js';
import Subject from '../models/subject.model.js';
import mongoose from 'mongoose';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pickTid = (req) => String(req?.body?.entiId || req?.body?.tenantId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const pickBatchIds = (req) => {
  const arr = req.body?.batchIds;
  return Array.isArray(arr) && arr.length ? arr.map(safeTrim).filter(Boolean) : [];
};
const pickBatchCodes = (req) => {
  const arr = req.body?.batchCodes;
  return Array.isArray(arr) && arr.length ? arr.map(safeTrim).filter(Boolean) : [];
};
const applyBatchIdFilter = (query, ids) => {
  if (ids.length === 1) query.batchId = ids[0];
  else if (ids.length > 1) query.batchId = { $in: ids };
};
const applyBatchCodeFilter = (query, codes) => {
  if (codes.length === 1) query.batchCode = codes[0];
  else if (codes.length > 1) query.batchCode = { $in: codes };
};
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const formatDate = (ms) => {
  if (!ms) return null;
  const d = new Date(ms);
  return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const getPreviousMonday = (epochMs) => {
  const d = new Date(epochMs);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};

const getPreviousMonday1 = (dateMs) => {
  const d = new Date(dateMs);
  const utcDay = d.getUTCDay();
  const diffDays = utcDay === 0 ? -6 : 1 - utcDay;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffDays);
};

const normDay = (d) => String(d || '').toUpperCase();

// Reuse getEffectivePeriods logic
const getEffectivePeriods = (tt, dateMs) => {
  if (!tt || !Array.isArray(tt.week)) return [];
  const targetDate = new Date(Number(dateMs));
  const dayStr = DAYS[targetDate.getUTCDay()];
  const targetUTC = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());

  const matchesDate = (oMs) => {
    const od = new Date(Number(oMs));
    return Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), od.getUTCDate()) === targetUTC;
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
    const n = Number(ov.periodNo);
    if (!n) continue;
    if (ov.action === 'CANCEL_PERIOD') baseMap.delete(n);
    if (ov.action === 'REPLACE_PERIOD' && ov.period) baseMap.set(n, { ...ov.period, periodNo: n });
    if (ov.action === 'ADD_PERIOD' && ov.period) baseMap.set(n, { ...ov.period, periodNo: n });
  }

  const moves = periodOvs.filter((o) => o.action === 'MOVE_PERIOD');
  if (moves.length) {
    const snap = new Map(baseMap);
    const done = new Set();
    for (const ov of moves) {
      const from = Number(ov.periodNo),
        to = Number(ov.toPeriodNo);
      if (!from || !to || from === to) continue;
      const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
      if (done.has(key)) continue;
      done.add(key);
      const fp = snap.get(from),
        tp = snap.get(to);
      if (fp) baseMap.set(to, { ...fp, periodNo: to, time: tp?.time ?? fp.time });
      else baseMap.delete(to);
      if (tp) baseMap.set(from, { ...tp, periodNo: from, time: fp?.time ?? tp.time });
      else baseMap.delete(from);
    }
  }

  return Array.from(baseMap.values()).sort((a, b) => (a.periodNo || 0) - (b.periodNo || 0));
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 1 — Faculty Batch Report
// POST /teacher/reports/batches
// Returns all batches where staff is subject teacher OR class teacher
// ═══════════════════════════════════════════════════════════════════════════════
const getFacultyBatchReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const staffId = safeTrim(req.body?.staffId || '');
    const status = safeTrim(req.body?.status || '');

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });

    // Fetch staff details
    const staff = await Staff.findOne({ tenantId, staffId, isdeleted: false }).lean();
    if (!staff) return res.status(404).json({ status: false, message: 'Staff not found' });

    const query = { tenantId, isdeleted: false };
    if (status && status !== 'ALL') query.status = status;

    // All batches in tenant — filter in memory for both roles
    const allBatches = await Batch.find(query).lean();

    const result = [];

    for (const b of allBatches) {
      const isClassTeacher = safeTrim(b.classTeacherId) === staffId;
      const staffMapEntry = (b.staffMap || []).find((s) => safeTrim(s.staffId) === staffId);
      const isSubjectTeacher = !!staffMapEntry;

      if (!isClassTeacher && !isSubjectTeacher) continue;

      result.push({
        batchId: b.batchId,
        batchCode: b.batchCode,
        batchName: b.batchName,
        programName: b.programName || null,
        programCode: b.programCode || null,
        centerName: b.centerName || null,
        academicYear: b.academicYear,
        classNo: b.classNo,
        yearNo: b.yearNo,
        section: b.section || null,
        status: b.status,
        studentCount: b.studentCount || 0,
        isClassTeacher,
        isSubjectTeacher,
        subjectId: staffMapEntry?.subjectId || null,
        subjectName: staffMapEntry?.subjectName || null,
        startDate: b.startDate || null,
        endDate: b.endDate || null
      });
    }

    // Summary
    const classTeacherBatches = result.filter((b) => b.isClassTeacher).length;
    const subjectTeacherBatches = result.filter((b) => b.isSubjectTeacher).length;

    return res.status(200).json({
      status: true,
      staffId,
      staffName: staff.staffName,
      staffCode: staff.staffCode,
      summary: {
        totalBatches: result.length,
        classTeacherBatches,
        subjectTeacherBatches,
        totalStudents: result.reduce((s, b) => s + b.studentCount, 0)
      },
      count: result.length,
      data: result
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 2 — Task Progress and Delayed Report
// POST /teacher/reports/tasks
// ═══════════════════════════════════════════════════════════════════════════════
const getTaskReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const staffId = safeTrim(req.body?.staffId || '');
    const status = safeTrim(req.body?.status || ''); // PENDING|IN_PROGRESS|COMPLETED|NOT_COMPLETED|NEED_MORE_TIME
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });

    const query = { tenantId, staffId, isdeleted: false };
    if (status && status !== 'ALL') query.status = status;
    if (fromDate) query.dueDate = { $gte: fromDate };
    if (toDate) query.dueDate = { ...(query.dueDate || {}), $lte: toDate };

    const tasks = await Task.find(query).sort({ dueDate: 1 }).lean();

    const now = Date.now();

    const statusCount = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      NOT_COMPLETED: 0,
      NEED_MORE_TIME: 0
    };
    let delayedCount = 0;

    const data = tasks.map((t, idx) => {
      if (statusCount[t.status] !== undefined) statusCount[t.status]++;

      // Delayed = dueDate passed and not completed
      const isDelayed = t.dueDate < now && !['COMPLETED'].includes(t.status);
      if (isDelayed) delayedCount++;

      const daysOverdue = isDelayed ? Math.floor((now - t.dueDate) / 86400000) : 0;

      return {
        slNo: idx + 1,
        taskId: t.taskId,
        taskName: t.taskName,
        description: t.description || null,
        dueDate: t.dueDate,
        dueDateFormatted: formatDate(t.dueDate),
        status: t.status,
        isDelayed,
        daysOverdue,
        remarks: t.remarks || null,
        createdAt: t.createdAt
      };
    });

    // Separate delayed list
    const delayedTasks = data.filter((t) => t.isDelayed);

    return res.status(200).json({
      status: true,
      staffId,
      fromDate: fromDate || null,
      toDate: toDate || null,
      summary: {
        total: tasks.length,
        delayed: delayedCount,
        byStatus: statusCount,
        completionPct: tasks.length > 0 ? round2((statusCount.COMPLETED / tasks.length) * 100) : 0
      },
      delayedTasks,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 3 — Late Entry Report (Staff)
// POST /teacher/reports/late-entries
// ═══════════════════════════════════════════════════════════════════════════════
const getStaffLateEntryReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const staffId = safeTrim(req.body?.staffId || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    if (!fromDate) return res.status(400).json({ status: false, message: 'fromDate is required' });
    if (!toDate) return res.status(400).json({ status: false, message: 'toDate is required' });

    const lateBatchCodes = pickBatchCodes(req);
    const lateQuery = { tenantId, type: 'STAFF', entryType: 'LATE', personId: staffId, isdeleted: false, date: { $gte: fromDate, $lte: toDate } };
    applyBatchCodeFilter(lateQuery, lateBatchCodes);

    const entries = await LateEntryLog.find(lateQuery).sort({ date: 1 }).lean();

    const totalDelay = entries.reduce((s, e) => s + (e.delayMinutes || 0), 0);
    const avgDelay = entries.length > 0 ? Math.round(totalDelay / entries.length) : 0;

    // Group by batch
    const byBatch = new Map();
    for (const e of entries) {
      const key = e.batchCode || 'UNKNOWN';
      if (!byBatch.has(key)) byBatch.set(key, { batchCode: key, count: 0, totalDelay: 0 });
      byBatch.get(key).count++;
      byBatch.get(key).totalDelay += e.delayMinutes || 0;
    }

    const data = entries.map((e, idx) => ({
      slNo: idx + 1,
      logId: e.logId,
      date: e.date,
      dateFormatted: formatDate(e.date),
      batchCode: e.batchCode || null,
      periodNo: e.periodNo,
      scheduledStartMin: e.scheduledStartMin,
      delayMinutes: e.delayMinutes,
      reason: e.reason || null
    }));

    return res.status(200).json({
      status: true,
      staffId,
      fromDate,
      toDate,
      summary: {
        total: entries.length,
        totalDelayMinutes: totalDelay,
        avgDelayMinutes: avgDelay
      },
      byBatch: Array.from(byBatch.values()),
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 4 — Early Leaving Report (Staff)
// POST /teacher/reports/early-leaving
// ═══════════════════════════════════════════════════════════════════════════════
const getStaffEarlyLeavingReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const staffId = safeTrim(req.body?.staffId || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    if (!fromDate) return res.status(400).json({ status: false, message: 'fromDate is required' });
    if (!toDate) return res.status(400).json({ status: false, message: 'toDate is required' });

    const earlyBatchCodes = pickBatchCodes(req);
    const earlyQuery = { tenantId, type: 'STAFF', entryType: 'EARLY_LEAVE', personId: staffId, isdeleted: false, date: { $gte: fromDate, $lte: toDate } };
    applyBatchCodeFilter(earlyQuery, earlyBatchCodes);

    const entries = await LateEntryLog.find(earlyQuery).sort({ date: 1 }).lean();

    const totalEarly = entries.reduce((s, e) => s + (e.delayMinutes || 0), 0);
    const avgEarly = entries.length > 0 ? Math.round(totalEarly / entries.length) : 0;

    const data = entries.map((e, idx) => ({
      slNo: idx + 1,
      logId: e.logId,
      date: e.date,
      dateFormatted: formatDate(e.date),
      batchCode: e.batchCode || null,
      periodNo: e.periodNo,
      scheduledStartMin: e.scheduledStartMin,
      earlyByMinutes: e.delayMinutes,
      reason: e.reason || null
    }));

    return res.status(200).json({
      status: true,
      staffId,
      fromDate,
      toDate,
      summary: {
        total: entries.length,
        totalEarlyMinutes: totalEarly,
        avgEarlyMinutes: avgEarly
      },
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 5 — Assignment Enabling Report (by Staff)
// POST /teacher/reports/assignments
// Shows all assignments enabled for batches where this staff teaches
// ═══════════════════════════════════════════════════════════════════════════════
const getStaffAssignmentReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const staffId = safeTrim(req.body?.staffId || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });

    const asnBatchIds = pickBatchIds(req);
    const batchQuery = { tenantId, isdeleted: false };
    applyBatchIdFilter(batchQuery, asnBatchIds);
    const batches = await Batch.find(batchQuery).lean();
    const staffBatches = batches.filter((b) => (b.staffMap || []).some((s) => safeTrim(s.staffId) === staffId));

    if (!staffBatches.length) {
      return res.status(200).json({ status: true, staffId, count: 0, data: [] });
    }

    // Get subjects this staff teaches
    const staffSubjectMap = new Map();
    // batchId → subjectId[]
    for (const b of staffBatches) {
      const subjects = (b.staffMap || []).filter((s) => safeTrim(s.staffId) === staffId).map((s) => safeTrim(s.subjectId));
      staffSubjectMap.set(b.batchId, subjects);
    }

    const batchIds = staffBatches.map((b) => b.batchId);

    const assignQuery = { tenantId, batchId: { $in: batchIds }, isdeleted: false, status: 'enabled' };
    if (fromDate) assignQuery.enabledAt = { $gte: fromDate };
    if (toDate) assignQuery.enabledAt = { ...(assignQuery.enabledAt || {}), $lte: toDate };

    const allEnabled = await BatchAssignEnable.find(assignQuery).lean();

    // Filter to only assignments for subjects this staff teaches in that batch
    const filtered = allEnabled.filter((t) => {
      const subjects = staffSubjectMap.get(t.batchId) || [];
      return subjects.includes(safeTrim(t.subjectId));
    });

    // Fetch subject names
    const subjectIds = [...new Set(filtered.map((t) => t.subjectId).filter(Boolean))];
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

    const batchMap = new Map(staffBatches.map((b) => [b.batchId, b]));

    const data = filtered.map((t, idx) => {
      const students = Array.isArray(t.students) ? t.students : [];
      const total = students.length;
      const completed = students.filter((s) => s.status === 'COMPLETED').length;
      const inProgress = students.filter((s) => s.status === 'IN_PROGRESS').length;
      const assigned = students.filter((s) => s.status === 'ASSIGNED').length;
      const batch = batchMap.get(t.batchId) || {};
      const subDoc = subjectDocMap.get(t.subjectId) || {};

      return {
        slNo: idx + 1,
        testId: t.testId,
        testNo: t.testNo || null,
        batchId: t.batchId,
        batchCode: batch.batchCode || null,
        batchName: batch.batchName || null,
        subjectId: t.subjectId,
        subjectName: subDoc.subjectName || null,
        subjectCode: subDoc.subjectCode || null,
        enabledAt: t.enabledAt,
        enabledAtFormatted: formatDate(t.enabledAt),
        totalStudents: total,
        completed,
        inProgress,
        assigned,
        completionPct: total > 0 ? round2((completed / total) * 100) : 0
      };
    });

    // Group by subject
    const bySubject = new Map();
    for (const d of data) {
      const key = d.subjectId || 'UNKNOWN';
      if (!bySubject.has(key)) {
        bySubject.set(key, {
          subjectId: d.subjectId,
          subjectName: d.subjectName,
          testCount: 0,
          totalStudents: 0,
          totalCompleted: 0
        });
      }
      const e = bySubject.get(key);
      e.testCount++;
      e.totalStudents += d.totalStudents;
      e.totalCompleted += d.completed;
    }

    return res.status(200).json({
      status: true,
      staffId,
      summary: {
        totalAssignments: data.length,
        totalBatches: staffBatches.length
      },
      bySubject: Array.from(bySubject.values()).map((e) => ({
        ...e,
        avgCompletionPct: e.totalStudents > 0 ? round2((e.totalCompleted / e.totalStudents) * 100) : 0
      })),
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 6 — Attendance Marked / Not Marked (Timetable based)
// POST /teacher/reports/attendance
// today = pass date as today's epoch, date range = fromDate + toDate
// ═══════════════════════════════════════════════════════════════════════════════
const getStaffAttendanceReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const staffId = safeTrim(req.body?.staffId || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, fromDate); // default = same day
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    if (!fromDate) return res.status(400).json({ status: false, message: 'fromDate is required' });

    const msPerDay = 86400000;
    if (toDate - fromDate > 31 * msPerDay) {
      return res.status(400).json({ status: false, message: 'Date range cannot exceed 31 days' });
    }

    // Collect all week starts in range
    const weekStarts = new Set();
    let curr = fromDate;
    while (curr <= toDate) {
      weekStarts.add(getPreviousMonday(curr));
      curr += msPerDay;
    }

    // Fetch all active timetables for these weeks
    const attBatchCodes = pickBatchCodes(req);
    const ttQuery = { tenantId, wkStartOn: { $in: [...weekStarts] }, status: 'Active', isdeleted: false };
    applyBatchCodeFilter(ttQuery, attBatchCodes);
    const timetables = await TimeTable.find(ttQuery).lean();

    // Build date → [ { batchCode, timetableId, period } ] for this staff
    const scheduleByDate = new Map();
    curr = fromDate;
    while (curr <= toDate) {
      const wkStart = getPreviousMonday(curr);
      const dayTTs = timetables.filter((tt) => tt.wkStartOn === wkStart);

      for (const tt of dayTTs) {
        const periods = getEffectivePeriods(tt, curr);
        const myPeriods = periods.filter((p) => safeTrim(p.facultyId) === staffId || safeTrim(p.replacementFacultyId) === staffId);

        for (const p of myPeriods) {
          if (!scheduleByDate.has(curr)) scheduleByDate.set(curr, []);
          scheduleByDate.get(curr).push({
            batchCode: tt.batchCode,
            timetableId: String(tt._id),
            periodNo: p.periodNo,
            subjectId: p.subjectId || null,
            subjectName: p.subjectName || null,
            startTime: p.time?.startLabel || null,
            endTime: p.time?.endLabel || null,
            periodType: p.periodType || null
          });
        }
      }
      curr += msPerDay;
    }

    // Fetch all attendance records in range for these batchCodes
    const allBatchCodes = [...new Set([...scheduleByDate.values()].flat().map((p) => p.batchCode))];

    const attRecords = allBatchCodes.length
      ? await Attendance.find(
          {
            tenantId,
            batchCode: { $in: allBatchCodes },
            facultyId: staffId,
            date: { $gte: fromDate, $lte: toDate },
            isdeleted: false
          },
          { batchCode: 1, date: 1, periodNo: 1, students: 1 }
        ).lean()
      : [];

    const markedSet = new Set(attRecords.map((a) => `${a.batchCode}_${a.date}_${a.periodNo}`));

    // Build report per day
    let totalPeriods = 0;
    let markedCount = 0;
    let notMarkedCount = 0;

    const dailyReport = [];
    curr = fromDate;
    while (curr <= toDate) {
      const periods = scheduleByDate.get(curr) || [];
      const dayData = periods.map((p) => {
        const key = `${p.batchCode}_${curr}_${p.periodNo}`;
        const isMarked = markedSet.has(key);
        totalPeriods++;
        if (isMarked) markedCount++;
        else notMarkedCount++;

        // Attendance stats if marked
        const attRec = attRecords.find((a) => a.batchCode === p.batchCode && a.date === curr && a.periodNo === p.periodNo);
        const students = Array.isArray(attRec?.students) ? attRec.students : [];

        return {
          batchCode: p.batchCode,
          timetableId: p.timetableId,
          periodNo: p.periodNo,
          subjectId: p.subjectId || null,
          subjectName: p.subjectName || null,
          startTime: p.startTime || null,
          endTime: p.endTime || null,
          periodType: p.periodType || null,
          isMarked,
          presentCount: isMarked ? students.filter((s) => s.status === 'PRESENT').length : null,
          absentCount: isMarked ? students.filter((s) => s.status === 'ABSENT').length : null,
          lateCount: isMarked ? students.filter((s) => s.status === 'LATE').length : null,
          totalStudents: isMarked ? students.length : null
        };
      });

      if (dayData.length > 0) {
        const d = new Date(curr);
        dailyReport.push({
          date: curr,
          dateFormatted: formatDate(curr),
          day: DAYS[d.getUTCDay()],
          totalPeriods: dayData.length,
          markedCount: dayData.filter((p) => p.isMarked).length,
          notMarkedCount: dayData.filter((p) => !p.isMarked).length,
          periods: dayData
        });
      }
      curr += msPerDay;
    }

    return res.status(200).json({
      status: true,
      staffId,
      fromDate,
      toDate,
      summary: {
        totalPeriods,
        markedCount,
        notMarkedCount,
        markedPct: totalPeriods > 0 ? round2((markedCount / totalPeriods) * 100) : 0,
        notMarkedPct: totalPeriods > 0 ? round2((notMarkedCount / totalPeriods) * 100) : 0
      },
      count: dailyReport.length,
      data: dailyReport
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 7 — Feedback Report (PTM staff remarks)
// POST /teacher/reports/feedback
// Shows all PTMs where this staff added remarks
// ═══════════════════════════════════════════════════════════════════════════════
const getStaffFeedbackReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const staffId = safeTrim(req.body?.staffId || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });

    const fbBatchCodes = pickBatchCodes(req);
    const query = { tenantId, isdeleted: false, 'staffRemarks.staffId': staffId };
    if (fromDate) query.ptmDate = { $gte: fromDate };
    if (toDate) query.ptmDate = { ...(query.ptmDate || {}), $lte: toDate };
    applyBatchCodeFilter(query, fbBatchCodes);

    const ptmDocs = await PTM.find(query).lean();

    if (!ptmDocs.length) {
      return res.status(200).json({ status: true, staffId, count: 0, data: [] });
    }

    // Per-subject summary of remarks
    const subjectSummary = new Map();

    const data = ptmDocs.map((p) => {
      // Extract only this staff's remarks
      const myRemarks = (Array.isArray(p.staffRemarks) ? p.staffRemarks : []).filter((r) => safeTrim(r.staffId) === staffId);

      for (const r of myRemarks) {
        const key = safeTrim(r.subjectId || 'GENERAL');
        if (!subjectSummary.has(key)) {
          subjectSummary.set(key, {
            subjectId: r.subjectId || null,
            subjectName: r.subjectName || null,
            subjectCode: r.subjectCode || null,
            remarksCount: 0
          });
        }
        subjectSummary.get(key).remarksCount++;
      }

      return {
        ptmId: p.ptmId,
        batchCode: p.batchCode,
        studentId: p.studentId,
        admissionNo: p.admissionNo,
        studentName: p.studentName,
        ptmDate: p.ptmDate,
        ptmDateFormatted: formatDate(p.ptmDate),
        ptmStatus: p.status,
        myRemarks: myRemarks.map((r) => ({
          subjectId: r.subjectId || null,
          subjectName: r.subjectName || null,
          subjectCode: r.subjectCode || null,
          remarks: r.remarks || null,
          submittedAt: r.submittedAt || null
        }))
      };
    });

    return res.status(200).json({
      status: true,
      staffId,
      fromDate: fromDate || null,
      toDate: toDate || null,
      summary: {
        totalStudents: data.length,
        totalRemarks: data.reduce((s, d) => s + d.myRemarks.length, 0),
        bySubject: Array.from(subjectSummary.values())
      },
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 8 — Exam Report (Staff perspective)
// POST /teacher/reports/exams
// Shows mock exams assigned to batches where this staff teaches
// ═══════════════════════════════════════════════════════════════════════════════
const getStaffExamReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const staffId = safeTrim(req.body?.staffId || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });

    const exBatchIds = pickBatchIds(req);
    const batchQuery = { tenantId, isdeleted: false };
    applyBatchIdFilter(batchQuery, exBatchIds);
    const batches = await Batch.find(batchQuery).lean();
    const staffBatches = batches.filter((b) => safeTrim(b.classTeacherId) === staffId || (b.staffMap || []).some((s) => safeTrim(s.staffId) === staffId));

    if (!staffBatches.length) {
      return res.status(200).json({ status: true, staffId, count: 0, data: [] });
    }

    const batchIds = staffBatches.map((b) => b.batchId);
    const batchMap = new Map(staffBatches.map((b) => [b.batchId, b]));

    // Fetch all mock exam assignments for these batches
    const assigns = await MockExamBatchAssign.find({
      tenantId,
      batchId: { $in: batchIds },
      isdeleted: false
    }).lean();

    if (!assigns.length) {
      return res.status(200).json({ status: true, staffId, count: 0, data: [] });
    }

    // Fetch exam details
    const examIds = [...new Set(assigns.map((a) => a.examId))];
    const examQuery = { tenantId, examId: { $in: examIds }, isdeleted: false };
    if (fromDate) examQuery.startTime = { $gte: fromDate };
    if (toDate) examQuery.startTime = { ...(examQuery.startTime || {}), $lte: toDate };

    const examDocs = await MockExam.find(examQuery, { examId: 1, examCode: 1, examName: 1, totalMarks: 1, startTime: 1, endTime: 1, status: 1, duration: 1, autoPublishAt: 1, resultPublishedAt: 1 }).lean();
    const examMap = new Map(examDocs.map((e) => [e.examId, e]));

    // Group assigns by examId — one exam can be assigned to multiple batches
    const examBatchMap = new Map();
    for (const a of assigns) {
      const exam = examMap.get(a.examId);
      if (!exam) continue; // filtered out by date

      if (!examBatchMap.has(a.examId)) {
        examBatchMap.set(a.examId, {
          examId: exam.examId,
          examCode: exam.examCode || null,
          examName: exam.examName || null,
          totalMarks: exam.totalMarks || null,
          duration: exam.duration || null,
          startTime: exam.startTime || null,
          endTime: exam.endTime || null,
          examStatus: exam.status || null,
          resultPublished: !!exam.resultPublishedAt,
          batches: []
        });
      }
      const students = Array.isArray(a.students) ? a.students : [];
      const total = students.length;
      const completed = students.filter((s) => s.status === 'completed').length;
      const started = students.filter((s) => s.status === 'started').length;
      const absent = students.filter((s) => s.status === 'absent').length;
      const assigned = students.filter((s) => s.status === 'assigned').length;
      const batch = batchMap.get(a.batchId) || {};
      examBatchMap.get(a.examId).batches.push({
        batchId: a.batchId,
        batchCode: batch.batchCode || null,
        batchName: batch.batchName || null,
        academicYear: batch.academicYear || null,
        classNo: batch.classNo || null,
        batchStatus: a.status,
        totalStudents: total,
        completed,
        started,
        absent,
        assigned,
        completionPct: total > 0 ? round2((completed / total) * 100) : 0
      });
    }
    const data = Array.from(examBatchMap.values())
      .map((e) => {
        const totalStudents = e.batches.reduce((s, b) => s + b.totalStudents, 0);
        const totalCompleted = e.batches.reduce((s, b) => s + b.completed, 0);
        return {
          ...e,
          totalStudents,
          totalCompleted,
          overallCompletionPct: totalStudents > 0 ? round2((totalCompleted / totalStudents) * 100) : 0
        };
      })
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    return res.status(200).json({
      status: true,
      staffId,
      fromDate: fromDate || null,
      toDate: toDate || null,
      summary: {
        totalExams: data.length,
        totalBatches: staffBatches.length,
        published: data.filter((e) => e.resultPublished).length,
        pending: data.filter((e) => !e.resultPublished).length
      },
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getFacultyLoadReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const filterStaffId = safeTrim(req.body?.staffId || '');
    const filterBatchIds = Array.isArray(req.body?.batchIds) ? req.body.batchIds.filter(Boolean) : [];
    const filterCenterIds = Array.isArray(req.body?.centerIds) ? req.body.centerIds.filter(Boolean) : [];
    const staffQuery = { tenantId, isdeleted: false, status: { $in: ['ACTIVE', 'active', 'Active'] } };
    if (filterStaffId) staffQuery.staffId = filterStaffId;
    const allStaff = await Staff.find(staffQuery, {
      staffId: 1,
      staffName: 1,
      staffCode: 1,
      centerId: 1,
      centerName: 1
    }).lean();
    if (!allStaff.length) {
      return res.status(200).json({ status: true, count: 0, data: [], detail: [] });
    }
    const staffMap = new Map(allStaff.map((s) => [s.staffId, s]));
    const allStaffIds = allStaff.map((s) => s.staffId);
    const ttQuery = { tenantId, isdeleted: false, status: 'Active' };
    // if (filterBatchIds.length) ttQuery.batchId = { $in: filterBatchIds };
    if (filterBatchIds.length) {
      const filterBatches = await Batch.find({ tenantId, batchId: { $in: filterBatchIds }, isdeleted: false }, { batchCode: 1 }).lean();
      const filterBatchCodeList = filterBatches.map((b) => b.batchCode).filter(Boolean);
      if (filterBatchCodeList.length) ttQuery.batchCode = { $in: filterBatchCodeList };
    }
    if (fromDate) ttQuery.wkStartOn = { $gte: getPreviousMonday1(fromDate) };
    if (toDate) ttQuery.wkStartOn = { ...ttQuery.wkStartOn, $lte: getPreviousMonday1(toDate) };
    const timetables = await TimeTable.find(ttQuery).lean();
    if (!timetables.length) {
      return res.status(200).json({ status: true, count: 0, data: [], detail: [] });
    }
    const batchCodes = [...new Set(timetables.map((tt) => tt.batchCode).filter(Boolean))];
    const batches = await Batch.find({ tenantId, batchCode: { $in: batchCodes }, isdeleted: false }, { batchCode: 1, batchId: 1, batchName: 1, centerId: 1, centerName: 1 }).lean();
    const batchInfoMap = new Map(batches.map((b) => [b.batchCode, b]));
    const subjectIds = new Set();
    for (const tt of timetables) {
      for (const day of tt.week || []) {
        for (const p of day.periods || []) {
          if (p.subjectId) subjectIds.add(String(p.subjectId));
        }
      }
    }
    const subjectDocs = await Subject.find(
      {
        _id: {
          $in: Array.from(subjectIds)
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
    const subjectNameMap = new Map(subjectDocs.map((s) => [String(s._id), s.subjectName]));
    const detailMap = new Map();
    const ensureKey = (staffId, batchCode, subjectId) => {
      const key = `${staffId}::${batchCode}::${subjectId}`;
      if (!detailMap.has(key)) {
        const staff = staffMap.get(staffId) || {};
        const batchInfo = batchInfoMap.get(batchCode) || {};
        detailMap.set(key, {
          staffId,
          staffName: staff.staffName || staffId,
          staffCode: staff.staffCode || null,
          batchCode,
          batchName: batchInfo.batchName || null,
          centerId: batchInfo.centerId || null,
          centerName: batchInfo.centerName || null,
          subjectId,
          subjectName: subjectNameMap.get(subjectId) || subjectId,
          scheduledCount: 0,
          scheduledMins: 0,
          cancelledCount: 0,
          replacedCount: 0,
          replacedMins: 0
        });
      }
      return detailMap.get(key);
    };
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    for (const tt of timetables) {
      const batchCode = tt.batchCode;
      const batchInfo = batchInfoMap.get(batchCode) || {};
      if (filterCenterIds.length && !filterCenterIds.includes(batchInfo.centerId)) continue;
      const ttStart = toInt(tt.wkStartOn, 0);
      if (!ttStart) continue;
      const rangeStart = fromDate ? Math.max(ttStart, getPreviousMonday1(fromDate)) : ttStart;
      const rangeEnd = toDate ? Math.min(toDate, ttStart + 6 * 86400000) : ttStart + 6 * 86400000;
      for (let dayMs = rangeStart; dayMs <= rangeEnd; dayMs += 86400000) {
        const dayIdx = new Date(dayMs).getUTCDay();
        const dayStr = DAYS[dayIdx];
        const dayOv = (tt.dayOverrides || []).find((ov) => {
          const od = new Date(Number(ov.date));
          const ovUTC = Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), od.getUTCDate());
          return ovUTC === dayMs;
        });
        if (dayOv?.action === 'CANCEL_DAY') {
          const baseDay = (tt.week || []).find((w) => String(w.day).toUpperCase() === dayStr);
          for (const p of baseDay?.periods || []) {
            const sid = String(p.subjectId || '');
            const fid = safeTrim(p.facultyId || '');
            if (!fid || !allStaffIds.includes(fid)) continue;
            if (filterStaffId && fid !== filterStaffId) continue;
            const grp = ensureKey(fid, batchCode, sid);
            grp.cancelledCount++;
          }
          continue;
        }
        let basePeriods = [];
        if (dayOv?.action === 'REPLACE_DAY') {
          basePeriods = dayOv.periods || [];
        } else {
          const baseDay = (tt.week || []).find((w) => String(w.day).toUpperCase() === dayStr);
          basePeriods = baseDay?.periods ? JSON.parse(JSON.stringify(baseDay.periods)) : [];
        }
        const periodMap = new Map();
        basePeriods.forEach((p) => {
          if (p.periodNo != null) periodMap.set(Number(p.periodNo), { ...p, _cancelled: false });
        });
        const periodOvs = (tt.periodOverrides || []).filter((ov) => {
          const od = new Date(Number(ov.date));
          const ovUTC = Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), od.getUTCDate());
          return ovUTC === dayMs;
        });
        for (const ov of periodOvs) {
          const pNo = Number(ov.periodNo);
          if (!pNo) continue;
          if (ov.action === 'CANCEL_PERIOD') {
            const base = periodMap.get(pNo);
            if (base) periodMap.set(pNo, { ...base, _cancelled: true });
          } else if ((ov.action === 'REPLACE_PERIOD' || ov.action === 'ADD_PERIOD') && ov.period) {
            periodMap.set(pNo, { ...ov.period, periodNo: pNo, _cancelled: false });
          }
        }
        for (const [, p] of periodMap.entries()) {
          const sid = String(p.subjectId || '');
          const startMin = toInt(p.time?.startMin, -1);
          const endMin = toInt(p.time?.endMin, -1);
          const mins = startMin >= 0 && endMin > startMin ? endMin - startMin : 0;
          const fid = safeTrim(p.facultyId || '');
          if (fid && allStaffIds.includes(fid)) {
            if (!filterStaffId || fid === filterStaffId) {
              const grp = ensureKey(fid, batchCode, sid);
              if (p._cancelled) {
                grp.cancelledCount++;
              } else {
                grp.scheduledCount++;
                grp.scheduledMins += mins;
              }
            }
          }
          const rfid = safeTrim(p.replacementFacultyId || '');
          if (!p._cancelled && rfid && rfid !== fid && allStaffIds.includes(rfid)) {
            if (!filterStaffId || rfid === filterStaffId) {
              const grp = ensureKey(rfid, batchCode, sid);
              grp.replacedCount++;
              grp.replacedMins += mins;
            }
          }
        }
      }
    }
    const detail = Array.from(detailMap.values()).map((d) => ({
      ...d,
      scheduledHours: round2(d.scheduledMins / 60),
      scheduledHoursFormatted: formatHours(d.scheduledMins),
      replacedHoursFormatted: formatHours(d.replacedMins)
    }));
    detail.sort((a, b) => {
      const s = (a.staffName || '').localeCompare(b.staffName || '');
      if (s !== 0) return s;
      const bc = (a.batchCode || '').localeCompare(b.batchCode || '');
      if (bc !== 0) return bc;
      return (a.subjectName || '').localeCompare(b.subjectName || '');
    });
    // const summaryKeyMap = new Map();
    // for (const d of detail) {
    //   const key = `${d.staffId}::${d.subjectId}`;
    //   if (!summaryKeyMap.has(key)) {
    //     summaryKeyMap.set(key, {
    //       staffId: d.staffId,
    //       staffName: d.staffName,
    //       staffCode: d.staffCode,
    //       subjectId: d.subjectId,
    //       subjectName: d.subjectName,
    //       batches: new Set(),
    //       scheduledCount: 0,
    //       scheduledMins: 0,
    //       cancelledCount: 0,
    //       replacedCount: 0,
    //       replacedMins: 0
    //     });
    //   }
    //   const s = summaryKeyMap.get(key);
    //   s.batches.add(d.batchCode);
    //   s.scheduledCount += d.scheduledCount;
    //   s.scheduledMins += d.scheduledMins;
    //   s.cancelledCount += d.cancelledCount;
    //   s.replacedCount += d.replacedCount;
    //   s.replacedMins += d.replacedMins;
    // }
    // const summaryData = Array.from(summaryKeyMap.values()).map((s) => ({
    //   staffId: s.staffId,
    //   staffName: s.staffName,
    //   staffCode: s.staffCode,
    //   subjectId: s.subjectId,
    //   subjectName: s.subjectName,
    //   totalBatches: s.batches.size,
    //   scheduledCount: s.scheduledCount,
    //   scheduledHoursFormatted: formatHours(s.scheduledMins),
    //   cancelledCount: s.cancelledCount,
    //   replacedCount: s.replacedCount,
    //   replacedHoursFormatted: formatHours(s.replacedMins)
    // }));
    // summaryData.sort((a, b) => {
    //   const s = (a.staffName || '').localeCompare(b.staffName || '');
    //   if (s !== 0) return s;
    //   return (a.subjectName || '').localeCompare(b.subjectName || '');
    // });
    // const summary = {
    //   totalStaff: summaryData.length,
    //   totalScheduledPeriods: summaryData.reduce((s, r) => s + r.scheduledCount, 0),
    //   totalCancelledPeriods: summaryData.reduce((s, r) => s + r.cancelledCount, 0)
    // };
    // return res.status(200).json({
    //   status: true,
    //   summary,
    //   count: summaryData.length,
    //   data: summaryData,
    //   detail
    // });
    // data = detail rows directly (staff + subject + batch level)
    const summaryData = detail.map((d) => ({
      staffId: d.staffId,
      staffName: d.staffName,
      staffCode: d.staffCode,
      subjectId: d.subjectId,
      subjectName: d.subjectName,
      batchCode: d.batchCode,
      batchName: d.batchName,
      centerName: d.centerName,
      scheduledCount: d.scheduledCount,
      scheduledHoursFormatted: d.scheduledHoursFormatted,
      cancelledCount: d.cancelledCount,
      replacedCount: d.replacedCount,
      replacedHoursFormatted: d.replacedHoursFormatted
    }));
    const summary = {
      totalStaff: new Set(detail.map((d) => d.staffId)).size,
      totalScheduledPeriods: detail.reduce((s, r) => s + r.scheduledCount, 0),
      totalCancelledPeriods: detail.reduce((s, r) => s + r.cancelledCount, 0)
    };
    return res.status(200).json({
      status: true,
      summary,
      count: summaryData.length,
      data: summaryData,
      detail
    });
  } catch (err) {
    return next(err);
  }
};

const formatHours = (mins) => {
  if (!mins) return '0 min';
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs === 0) return `${m} min`;
  if (m === 0) return `${hrs} hr`;
  return `${hrs} hr ${m} min`;
};

export default {
  getFacultyBatchReport,
  getTaskReport,
  getStaffLateEntryReport,
  getStaffEarlyLeavingReport,
  getStaffAssignmentReport,
  getStaffAttendanceReport,
  getStaffFeedbackReport,
  getStaffExamReport,
  getFacultyLoadReport
};

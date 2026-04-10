import Attendance from '../models/attandence.model.js';
import SchoolAttendance from '../models/schoolAttendance.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import StudentRemark from '../models/studentremark.model.js';
import StudentProfile from '../models/studentProfile.model.js';

const pickTid = (req) => String(req?.body?.entiId || req?.body?.tenantId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const formatDate = (ms) => {
  if (!ms) return null;
  const d = new Date(ms);
  return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const resolveStudent = async (tenantId, studentId, admissionNo) => {
  const q = { tenantId, isdeleted: false };
  if (studentId) q.studentId = safeTrim(studentId);
  else if (admissionNo) q.admissionNo = safeTrim(admissionNo);
  else return null;
  return StudentProfile.findOne(q).lean();
};

const getStudentAttendanceReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const studentId = safeTrim(req.body?.studentId || '');
    const admissionNo = safeTrim(req.body?.admissionNo || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!studentId && !admissionNo) return res.status(400).json({ status: false, message: 'studentId or admissionNo is required' });
    if (!fromDate) return res.status(400).json({ status: false, message: 'fromDate is required' });
    if (!toDate) return res.status(400).json({ status: false, message: 'toDate is required' });
    const student = await resolveStudent(tenantId, studentId, admissionNo);
    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });
    const sid = student.studentId;
    const admNo = student.admissionNo;
    const batchCode = safeTrim(student.batchCode || '');
    const attRecords = await Attendance.find({
      tenantId,
      batchCode,
      date: { $gte: fromDate, $lte: toDate },
      isdeleted: false
    })
      .sort({ date: 1, periodNo: 1 })
      .lean();

    let periodTotal = 0;
    let periodPresent = 0;
    let periodAbsent = 0;
    let periodLate = 0;
    let periodNotMarked = 0;

    const periodDetail = [];

    for (const rec of attRecords) {
      const stuRec = (rec.students || []).find((s) => s.studentId === sid);
      if (!stuRec) {
        // Student was in batch but not in attendance record — count as not marked
        periodNotMarked++;
        continue;
      }
      periodTotal++;
      if (stuRec.status === 'PRESENT') periodPresent++;
      else if (stuRec.status === 'ABSENT') periodAbsent++;
      else if (stuRec.status === 'LATE') {
        periodPresent++;
        periodLate++;
      } // LATE counts as present

      periodDetail.push({
        date: rec.date,
        dateFormatted: formatDate(rec.date),
        periodNo: rec.periodNo,
        subjectId: rec.subjectId || null,
        facultyId: rec.facultyId || null,
        status: stuRec.status,
        remarks: stuRec.remarks || null,
        topicTaught: rec.topicTaught || null
      });
    }

    const periodAbsentPct = periodTotal > 0 ? Math.round((periodAbsent / periodTotal) * 100) : 0;
    const periodPresentPct = periodTotal > 0 ? Math.round((periodPresent / periodTotal) * 100) : 0;

    // ── 2. School attendance (day-level) ─────────────────────────────────────
    const schoolRecords = batchCode
      ? await SchoolAttendance.find({
          tenantId,
          batchCode,
          date: { $gte: fromDate, $lte: toDate },
          isdeleted: false
        })
          .sort({ date: 1 })
          .lean()
      : [];

    let schoolTotal = 0;
    let schoolPresent = 0;
    let schoolAbsent = 0;
    let schoolLate = 0;

    const schoolDetail = [];

    for (const rec of schoolRecords) {
      const stuRec = (rec.students || []).find((s) => s.studentId === sid);
      if (!stuRec) continue;

      schoolTotal++;
      if (stuRec.status === 'PRESENT') schoolPresent++;
      else if (stuRec.status === 'ABSENT') schoolAbsent++;
      else if (stuRec.status === 'LATE') {
        schoolPresent++;
        schoolLate++;
      }

      schoolDetail.push({
        date: rec.date,
        dateFormatted: formatDate(rec.date),
        status: stuRec.status,
        remarks: stuRec.remarks || null,
        markedByName: rec.markedByName || null,
        classRemarks: rec.remarks || null
      });
    }

    const schoolAbsentPct = schoolTotal > 0 ? Math.round((schoolAbsent / schoolTotal) * 100) : 0;
    const schoolPresentPct = schoolTotal > 0 ? Math.round((schoolPresent / schoolTotal) * 100) : 0;

    // ── 3. Subject-wise summary (from period attendance) ─────────────────────
    const subjectMap = new Map();
    // key: subjectId → { total, present, absent, late }
    for (const rec of periodDetail) {
      const key = rec.subjectId || 'UNKNOWN';
      if (!subjectMap.has(key)) subjectMap.set(key, { subjectId: key, total: 0, present: 0, absent: 0, late: 0 });
      const e = subjectMap.get(key);
      e.total++;
      if (rec.status === 'PRESENT') e.present++;
      else if (rec.status === 'ABSENT') e.absent++;
      else if (rec.status === 'LATE') {
        e.present++;
        e.late++;
      }
    }
    const subjectSummary = Array.from(subjectMap.values()).map((e) => ({
      ...e,
      presentPct: e.total > 0 ? Math.round((e.present / e.total) * 100) : 0,
      absentPct: e.total > 0 ? Math.round((e.absent / e.total) * 100) : 0
    }));

    return res.status(200).json({
      status: true,
      studentId: sid,
      admissionNo: admNo,
      studentName: student.student?.name || null,
      batchCode,
      fromDate,
      toDate,

      // Period-wise (timetable) attendance
      periodAttendance: {
        total: periodTotal,
        present: periodPresent,
        absent: periodAbsent,
        late: periodLate,
        notMarked: periodNotMarked,
        presentPct: periodPresentPct,
        absentPct: periodAbsentPct,
        detail: periodDetail
      },

      // School (day-level) attendance
      schoolAttendance: {
        total: schoolTotal,
        present: schoolPresent,
        absent: schoolAbsent,
        late: schoolLate,
        presentPct: schoolPresentPct,
        absentPct: schoolAbsentPct,
        detail: schoolDetail
      },

      // Subject-wise breakdown
      subjectSummary
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentRemarksReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const studentId = safeTrim(req.body?.studentId || '');
    const admissionNo = safeTrim(req.body?.admissionNo || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const type = safeTrim(req.body?.type || ''); // ACADEMIC|BEHAVIOUR|ATTENDANCE|HEALTH|OTHER
    const status = safeTrim(req.body?.status || ''); // PENDING|ACKNOWLEDGED

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!studentId && !admissionNo) return res.status(400).json({ status: false, message: 'studentId or admissionNo is required' });

    // ── Fetch student ─────────────────────────────────────────────────────────
    const student = await resolveStudent(tenantId, studentId, admissionNo);
    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });

    const sid = student.studentId;
    const admNo = student.admissionNo;

    // ── Build query ───────────────────────────────────────────────────────────
    const query = { tenantId, studentId: sid, isdeleted: false };
    if (fromDate) query.dateOfIncident = { $gte: fromDate };
    if (toDate) query.dateOfIncident = { ...(query.dateOfIncident || {}), $lte: toDate };
    if (type && ['ACADEMIC', 'BEHAVIOUR', 'ATTENDANCE', 'HEALTH', 'OTHER'].includes(type.toUpperCase())) {
      query.type = type.toUpperCase();
    }
    if (status && ['PENDING', 'ACKNOWLEDGED'].includes(status.toUpperCase())) {
      query.status = status.toUpperCase();
    }

    const remarks = await StudentRemark.find(query).sort({ dateOfIncident: -1 }).lean();

    // ── Type-wise summary ─────────────────────────────────────────────────────
    const typeCount = { ACADEMIC: 0, BEHAVIOUR: 0, ATTENDANCE: 0, HEALTH: 0, OTHER: 0 };
    const statusCount = { PENDING: 0, ACKNOWLEDGED: 0 };

    for (const r of remarks) {
      if (typeCount[r.type] !== undefined) typeCount[r.type]++;
      if (statusCount[r.status] !== undefined) statusCount[r.status]++;
    }

    const data = remarks.map((r, idx) => ({
      slNo: idx + 1,
      remarkId: r.remarkId,
      type: r.type,
      dateOfIncident: r.dateOfIncident,
      dateFormatted: formatDate(r.dateOfIncident),
      remark: r.remark,
      reportedByParent: r.reportedByParent,
      status: r.status,
      createdAt: r.createdAt,
      createdBy: r.createdBy || null
    }));

    return res.status(200).json({
      status: true,
      studentId: sid,
      admissionNo: admNo,
      studentName: student.student?.name || null,
      batchCode: student.batchCode || null,
      summary: {
        total: remarks.length,
        byType: typeCount,
        byStatus: statusCount
      },
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 3 — Student Late Entry Report
// POST /student/reports/late-entries
// ═══════════════════════════════════════════════════════════════════════════════
const getStudentLateEntryReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const studentId = safeTrim(req.body?.studentId || '');
    const admissionNo = safeTrim(req.body?.admissionNo || '');
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const entryType = safeTrim(req.body?.entryType || ''); // LATE | EARLY_LEAVE

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!studentId && !admissionNo) return res.status(400).json({ status: false, message: 'studentId or admissionNo is required' });

    // ── Fetch student ─────────────────────────────────────────────────────────
    const student = await resolveStudent(tenantId, studentId, admissionNo);
    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });

    const sid = student.studentId;
    const admNo = student.admissionNo;

    // ── Query late entry logs ─────────────────────────────────────────────────
    const query = {
      tenantId,
      type: 'STUDENT',
      personId: sid,
      isdeleted: false
    };
    if (fromDate) query.date = { $gte: fromDate };
    if (toDate) query.date = { ...(query.date || {}), $lte: toDate };
    if (entryType && ['LATE', 'EARLY_LEAVE'].includes(entryType.toUpperCase())) {
      query.entryType = entryType.toUpperCase();
    }

    const entries = await LateEntryLog.find(query).sort({ date: 1, periodNo: 1 }).lean();

    // ── Summary ───────────────────────────────────────────────────────────────
    const lateCount = entries.filter((e) => (e.entryType || 'LATE') === 'LATE').length;
    const earlyLeaveCount = entries.filter((e) => e.entryType === 'EARLY_LEAVE').length;
    const totalDelay = entries.reduce((s, e) => s + (e.delayMinutes || 0), 0);
    const avgDelay = entries.length > 0 ? Math.round(totalDelay / entries.length) : 0;

    // ── Group by date for calendar view ──────────────────────────────────────
    const byDateMap = new Map();
    for (const e of entries) {
      const key = e.date;
      if (!byDateMap.has(key)) byDateMap.set(key, []);
      byDateMap.get(key).push(e);
    }
    const byDate = Array.from(byDateMap.entries())
      .map(([date, logs]) => ({
        date,
        dateFormatted: formatDate(date),
        count: logs.length,
        logs: logs.map((e) => ({
          logId: e.logId,
          entryType: e.entryType || 'LATE',
          periodNo: e.periodNo,
          scheduledStartMin: e.scheduledStartMin,
          delayMinutes: e.delayMinutes,
          reason: e.reason || null
        }))
      }))
      .sort((a, b) => a.date - b.date);

    const data = entries.map((e, idx) => ({
      slNo: idx + 1,
      logId: e.logId,
      entryType: e.entryType || 'LATE',
      date: e.date,
      dateFormatted: formatDate(e.date),
      periodNo: e.periodNo,
      batchCode: e.batchCode || null,
      scheduledStartMin: e.scheduledStartMin,
      delayMinutes: e.delayMinutes,
      reason: e.reason || null
    }));

    return res.status(200).json({
      status: true,
      studentId: sid,
      admissionNo: admNo,
      studentName: student.student?.name || null,
      batchCode: student.batchCode || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      summary: {
        total: entries.length,
        lateCount,
        earlyLeaveCount,
        totalDelayMinutes: totalDelay,
        avgDelayMinutes: avgDelay
      },
      byDate,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────
export default {
  getStudentAttendanceReport,
  getStudentRemarksReport,
  getStudentLateEntryReport
};

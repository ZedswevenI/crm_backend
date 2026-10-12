import Attendance from '../models/attandence.model.js';
import SchoolAttendance from '../models/schoolAttendance.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import StudentRemark from '../models/studentremark.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import Batch from '../models/batch.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

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

const round2 = (n) => Math.round(Number(n) * 100) / 100;

const buildBatchNameMap = async (tenantId, batchCodes) => {
  const codes = [...new Set((batchCodes || []).map(safeTrim).filter(Boolean))];
  if (!codes.length) return new Map();
  const batches = await Batch.find({ tenantId, batchCode: { $in: codes } }, { batchCode: 1, batchName: 1 }).lean();
  return new Map(batches.map((b) => [b.batchCode, b.batchName]));
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
    // fromDate/toDate are optional — omitting either (or both) returns the student's full attendance history.
    const dateFilter = {};
    if (fromDate) dateFilter.$gte = fromDate;
    if (toDate) dateFilter.$lte = toDate;
    const student = await resolveStudent(tenantId, studentId, admissionNo);
    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });
    const sid = student.studentId;
    const admNo = student.admissionNo;
    const batchCode = safeTrim(student.batchCode || '');
    const batchNameMap = await buildBatchNameMap(tenantId, [batchCode]);
    const attRecords = await Attendance.find({
      tenantId,
      batchCode,
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
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
          ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
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
      batchName: batchCode ? batchNameMap.get(batchCode) || null : null,
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
    const batchNameMap = await buildBatchNameMap(tenantId, [student.batchCode]);

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
      batchName: student.batchCode ? batchNameMap.get(student.batchCode) || null : null,
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
    const batchNameMap = await buildBatchNameMap(tenantId, [student.batchCode, ...entries.map((e) => e.batchCode)]);

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
      batchName: e.batchCode ? batchNameMap.get(e.batchCode) || null : null,
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
      batchName: student.batchCode ? batchNameMap.get(student.batchCode) || null : null,
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

const getStudentAttendanceBulkReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const admissionNos = Array.isArray(req.body?.admissionNos) ? [...new Set(req.body.admissionNos.map(safeTrim).filter(Boolean))] : [];
    if (!admissionNos.length) {
      return res.status(400).json({ status: false, message: 'admissionNos[] is required' });
    }
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const centerId = safeTrim(req.body?.centerId);
    const studentQuery = {
      tenantId,
      admissionNo: { $in: admissionNos },
      isdeleted: false
    };
    if (centerId) studentQuery.centerId = centerId;
    const students = await StudentProfile.find(
      studentQuery,
      {
        studentId: 1,
        admissionNo: 1,
        batchCode: 1,
        batchId: 1,
        'student.name': 1
      }
    ).lean();
    if (!students.length) {
      return res.status(200).json({ status: true, count: 0, data: [], detail: [] });
    }
    const studentMap = new Map(students.map((s) => [s.admissionNo, s]));
    const batchCodes = [...new Set(students.map((s) => s.batchCode).filter(Boolean))];
    const batchNameMap = await buildBatchNameMap(tenantId, batchCodes);
    const attQuery = {
      tenantId,
      batchCode: { $in: batchCodes },
      isdeleted: false
    };
    if (fromDate || toDate) {
      attQuery.date = {};
      if (fromDate) attQuery.date.$gte = fromDate;
      if (toDate) attQuery.date.$lte = toDate;
    }
    const pipeline = [
      { $match: attQuery },
      { $unwind: '$students' },
      { $match: { 'students.studentId': { $in: students.map((s) => s.studentId) } } },
      {
        $addFields: {
          subjectObjId: {
            $cond: [{ $eq: [{ $type: '$subjectId' }, 'string'] }, { $toObjectId: '$subjectId' }, '$subjectId']
          }
        }
      },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectObjId',
          foreignField: '_id',
          as: 'subject'
        }
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          date: 1,
          periodNo: 1,
          batchCode: 1,
          subjectName: '$subject.subjectName',
          topicTaught: 1,
          studentId: '$students.studentId',
          admissionNo: '$students.admissionNo',
          status: '$students.status',
          remarks: '$students.remarks'
        }
      },
      { $sort: { admissionNo: 1, date: -1, periodNo: 1 } }
    ];
    const periodRecords = await Attendance.aggregate(pipeline);
    const periodByStudent = new Map();
    for (const r of periodRecords) {
      const key = r.admissionNo || r.studentId;
      if (!periodByStudent.has(key)) periodByStudent.set(key, []);
      periodByStudent.get(key).push({
        date: r.date,
        dateFormatted: formatDate(r.date),
        periodNo: r.periodNo,
        batchCode: r.batchCode,
        subjectName: r.subjectName || null,
        topicTaught: r.topicTaught || null,
        status: r.status,
        remarks: r.remarks || null
      });
    }
    const summaryData = [];
    const detailData = [];
    for (const admNo of admissionNos) {
      const student = studentMap.get(admNo);
      if (!student) continue;
      const periods = periodByStudent.get(admNo) || [];
      const totalPeriods = periods.length;
      const present = periods.filter((p) => p.status === 'PRESENT').length;
      const absent = periods.filter((p) => p.status === 'ABSENT').length;
      const late = periods.filter((p) => p.status === 'LATE').length;
      const attended = present + late;
      const attendancePct = totalPeriods > 0 ? round2((attended / totalPeriods) * 100) : 0;
      summaryData.push({
        admissionNo: admNo,
        studentName: student.student?.name || null,
        batchCode: student.batchCode || null,
        batchName: student.batchCode ? batchNameMap.get(student.batchCode) || null : null,
        totalPeriods,
        present,
        absent,
        late,
        attendancePct: attendancePct + '%'
      });
      for (const p of periods) {
        detailData.push({
          admissionNo: admNo,
          studentName: student.student?.name || null,
          batchCode: student.batchCode || null,
          batchName: student.batchCode ? batchNameMap.get(student.batchCode) || null : null,
          ...p
        });
      }
    }
    const overallSummary = {
      totalStudents: summaryData.length,
      avgAttendancePct: summaryData.length > 0 ? round2(summaryData.reduce((s, r) => s + parseFloat(r.attendancePct), 0) / summaryData.length) : 0
    };
    return res.status(200).json({
      status: true,
      summary: overallSummary,
      count: summaryData.length,
      data: summaryData,
      detail: detailData
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentRemarksBulkReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const admissionNos = Array.isArray(req.body?.admissionNos) ? [...new Set(req.body.admissionNos.map(safeTrim).filter(Boolean))] : [];
    if (!admissionNos.length) return res.status(400).json({ status: false, message: 'admissionNos[] is required' });
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const filterType = safeTrim(req.body?.type || '');
    const filterStatus = safeTrim(req.body?.status || '');
    const centerId = safeTrim(req.body?.centerId);
    const remarksStudentQuery = {
      tenantId,
      admissionNo: { $in: admissionNos },
      isdeleted: false
    };
    if (centerId) remarksStudentQuery.centerId = centerId;
    const students = await StudentProfile.find(remarksStudentQuery, { studentId: 1, admissionNo: 1, batchCode: 1, 'student.name': 1 }).lean();
    const studentMap = new Map(students.map((s) => [s.admissionNo, s]));
    const remarksBatchNameMap = await buildBatchNameMap(tenantId, students.map((s) => s.batchCode));
    const remarkQuery = { tenantId, admissionNo: { $in: admissionNos }, isdeleted: false };
    if (filterType) remarkQuery.type = filterType;
    if (filterStatus) remarkQuery.status = filterStatus;
    if (fromDate || toDate) {
      remarkQuery.dateOfIncident = {};
      if (fromDate) remarkQuery.dateOfIncident.$gte = fromDate;
      if (toDate) remarkQuery.dateOfIncident.$lte = toDate;
    }
    const remarks = await StudentRemark.find(remarkQuery).sort({ admissionNo: 1, dateOfIncident: -1 }).lean();
    const remarksByStudent = new Map();
    for (const r of remarks) {
      const key = safeTrim(r.admissionNo);
      if (!remarksByStudent.has(key)) remarksByStudent.set(key, []);
      remarksByStudent.get(key).push(r);
    }
    const summaryData = [];
    const detailData = [];
    for (const admNo of admissionNos) {
      const student = studentMap.get(admNo);
      const studentRemarks = remarksByStudent.get(admNo) || [];
      summaryData.push({
        admissionNo: admNo,
        studentName: student?.student?.name || null,
        batchCode: student?.batchCode || null,
        batchName: student?.batchCode ? remarksBatchNameMap.get(student.batchCode) || null : null,
        totalRemarks: studentRemarks.length
      });
      for (const r of studentRemarks) {
        detailData.push({
          admissionNo: admNo,
          studentName: student?.student?.name || null,
          batchCode: student?.batchCode || null,
          batchName: student?.batchCode ? remarksBatchNameMap.get(student.batchCode) || null : null,
          type: r.type || null,
          dateFormatted: formatDate(r.dateOfIncident),
          remark: r.remark || null,
          status: r.status || null,
          reportedByParent: r.reportedByParent ? 'Yes' : 'No'
        });
      }
    }
    const summary = {
      totalStudents: summaryData.length,
      totalRemarks: remarks.length
    };
    return res.status(200).json({
      status: true,
      summary,
      count: summaryData.length,
      data: summaryData,
      detail: detailData
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentLateEntriesBulkReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const admissionNos = Array.isArray(req.body?.admissionNos) ? [...new Set(req.body.admissionNos.map(safeTrim).filter(Boolean))] : [];
    if (!admissionNos.length) return res.status(400).json({ status: false, message: 'admissionNos[] is required' });

    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, 0);
    const filterEntryType = safeTrim(req.body?.entryType || '');
    const centerId = safeTrim(req.body?.centerId);

    // Fetch students
    const lateStudentQuery = {
      tenantId,
      admissionNo: { $in: admissionNos },
      isdeleted: false
    };
    if (centerId) lateStudentQuery.centerId = centerId;
    const students = await StudentProfile.find(lateStudentQuery, { studentId: 1, admissionNo: 1, batchCode: 1, 'student.name': 1 }).lean();

    const studentMap = new Map(students.map((s) => [s.admissionNo, s]));
    const studentIds = students.map((s) => s.studentId).filter(Boolean);
    const lateBatchNameMap = await buildBatchNameMap(tenantId, students.map((s) => s.batchCode));

    // Fetch all late entries at once
    const lateQuery = {
      tenantId,
      type: 'STUDENT',
      personId: { $in: studentIds },
      isdeleted: false
    };
    if (filterEntryType) lateQuery.entryType = filterEntryType;
    if (fromDate || toDate) {
      lateQuery.date = {};
      if (fromDate) lateQuery.date.$gte = fromDate;
      if (toDate) lateQuery.date.$lte = toDate;
    }

    const entries = await LateEntryLog.find(lateQuery).sort({ personId: 1, date: -1 }).lean();

    // Map studentId → admissionNo
    const studentIdToAdmNo = new Map(students.map((s) => [s.studentId, s.admissionNo]));

    // Group by admissionNo
    const entriesByStudent = new Map();
    for (const e of entries) {
      const admNo = studentIdToAdmNo.get(safeTrim(e.personId));
      if (!admNo) continue;
      if (!entriesByStudent.has(admNo)) entriesByStudent.set(admNo, []);
      entriesByStudent.get(admNo).push(e);
    }

    // Build summary and detail
    const summaryData = [];
    const detailData = [];

    for (const admNo of admissionNos) {
      const student = studentMap.get(admNo);
      const studentEntries = entriesByStudent.get(admNo) || [];
      const lateCount = studentEntries.filter((e) => e.entryType === 'LATE').length;
      const earlyCount = studentEntries.filter((e) => e.entryType === 'EARLY_LEAVE').length;
      const totalDelay = studentEntries.reduce((s, e) => s + (e.delayMinutes || 0), 0);

      summaryData.push({
        admissionNo: admNo,
        studentName: student?.student?.name || null,
        batchCode: student?.batchCode || null,
        batchName: student?.batchCode ? lateBatchNameMap.get(student.batchCode) || null : null,
        totalEntries: studentEntries.length,
        lateCount,
        earlyCount,
        totalDelayMinutes: totalDelay
      });

      for (const e of studentEntries) {
        detailData.push({
          admissionNo: admNo,
          studentName: student?.student?.name || null,
          batchCode: student?.batchCode || null,
          batchName: student?.batchCode ? lateBatchNameMap.get(student.batchCode) || null : null,
          entryType: e.entryType || null,
          dateFormatted: formatDate(e.date),
          periodNo: e.periodNo || null,
          delayMinutes: e.delayMinutes || null,
          reason: e.reason || null
        });
      }
    }

    const summary = {
      totalStudents: summaryData.length,
      totalEntries: entries.length,
      totalLate: entries.filter((e) => e.entryType === 'LATE').length,
      totalEarlyLeave: entries.filter((e) => e.entryType === 'EARLY_LEAVE').length
    };

    return res.status(200).json({
      status: true,
      summary,
      count: summaryData.length,
      data: summaryData,
      detail: detailData
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  getStudentAttendanceReport,
  getStudentRemarksReport,
  getStudentLateEntryReport,
  getStudentAttendanceBulkReport,
  getStudentRemarksBulkReport,
  getStudentLateEntriesBulkReport
};

import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import StudentPerformance from '../models/studentperformance.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import AssignmentResult from '../models/assignmentResult.model.js';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExam from '../models/mockExam.model.js';
import SchoolExamLog from '../models/schoolexam.model.js';
import Subject from '../models/subject.model.js';
import Batch from '../models/batch.model.js';
import Staff from '../models/staff.model.js';
import StaffPerformance from '../models/staffperformance.model.js';
import constants from '../helpers/constants.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';
import { resolveAcademicYear } from '../helpers/performanceSync.helper.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();

const safeTrim = (v) => (v === undefined || v === null ? '' : String(v)).trim();

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const round2 = (v) => (v != null ? Math.round(v * 100) / 100 : null);

const toRating = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : null;
};

const escapeRx = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const WEIGHTS = { assignment: 0.4, mock: 0.3, school: 0.3 };

const computeCombined = (assignPct, mockPct, schoolPct) => {
  const available = [assignPct != null ? { v: assignPct, w: WEIGHTS.assignment } : null, mockPct != null ? { v: mockPct, w: WEIGHTS.mock } : null, schoolPct != null ? { v: schoolPct, w: WEIGHTS.school } : null].filter(Boolean);
  if (!available.length) return null;
  const totalW = available.reduce((s, x) => s + x.w, 0);
  return round2(available.reduce((s, x) => s + x.v * x.w, 0) / totalW);
};

const getProfile = async (tenantId, studentId) => {
  return StudentProfile.findOne({ tenantId, studentId, isdeleted: false }, { admissionNo: 1, batchId: 1, batchCode: 1, programId: 1, centerId: 1, academicYear: 1, currentAcademicYear: 1, classNo: 1, ayHistory: 1 }).lean();
};

const upsertPerf = async (filter, setDoc, setOnInsert) => {
  const cleanSetOnInsert = Object.fromEntries(Object.entries({ performanceId: uuid(), ...setOnInsert }).filter(([key]) => !(key in setDoc)));
  return StudentPerformance.findOneAndUpdate(
    { ...filter, isdeleted: false },
    {
      $set: setDoc,
      $setOnInsert: cleanSetOnInsert
    },
    { upsert: true, new: true }
  ).lean();
};

const _recomputeSummary = async (tenantId, studentId, academicYear, profile) => {
  const [assignments, mockExams, schoolExams] = await Promise.all([
    StudentPerformance.find({ tenantId, studentId, academicYear, performanceType: 'ASSIGNMENT', isdeleted: false }, { cgpa: 1, percentage: 1 }).lean(),
    StudentPerformance.find({ tenantId, studentId, academicYear, performanceType: 'MOCK_EXAM', isdeleted: false }, { percentage: 1, rank: 1 }).lean(),
    StudentPerformance.find({ tenantId, studentId, academicYear, performanceType: 'SCHOOL_EXAM', isdeleted: false }, { percentage: 1 }).lean()
  ]);
  const validCgpa = assignments.filter((a) => a.cgpa != null);
  const validAPct = assignments.filter((a) => a.percentage != null);
  const assignmentAvgCgpa = validCgpa.length ? round2(validCgpa.reduce((s, a) => s + a.cgpa, 0) / validCgpa.length) : null;
  const assignmentAvgPct = validAPct.length ? round2(validAPct.reduce((s, a) => s + a.percentage, 0) / validAPct.length) : null;
  const validMPct = mockExams.filter((m) => m.percentage != null);
  const validRanks = mockExams.filter((m) => m.rank != null);
  const mockAvgPct = validMPct.length ? round2(validMPct.reduce((s, m) => s + m.percentage, 0) / validMPct.length) : null;
  const mockBestPct = validMPct.length ? round2(Math.max(...validMPct.map((m) => m.percentage))) : null;
  const mockBestRank = validRanks.length ? Math.min(...validRanks.map((m) => m.rank)) : null;
  const validSPct = schoolExams.filter((s) => s.percentage != null);
  const schoolAvgPct = validSPct.length ? round2(validSPct.reduce((s, e) => s + e.percentage, 0) / validSPct.length) : null;
  const schoolBestPct = validSPct.length ? round2(Math.max(...validSPct.map((e) => e.percentage))) : null;
  const combinedScore = computeCombined(assignmentAvgPct, mockAvgPct, schoolAvgPct);
  const existing = await StudentPerformance.findOne({ tenantId, studentId, academicYear, performanceType: 'SUMMARY', isdeleted: false }, { 'summary.batchRank': 1, staffFeedback: 1 }).lean();
  const summaryDoc = {
    assignmentAvgCgpa,
    assignmentAvgPct,
    assignmentSubjectCount: assignments.length,
    mockAvgPct,
    mockBestPct,
    mockBestRank,
    mockExamCount: mockExams.length,
    schoolAvgPct,
    schoolBestPct,
    schoolExamCount: schoolExams.length,
    combinedScore,
    batchRank: existing?.summary?.batchRank ?? null,
    lastSyncedAt: Date.now()
  };
  return upsertPerf(
    { tenantId, studentId, academicYear, performanceType: 'SUMMARY' },
    {
      summary: summaryDoc,
      syncedAt: Date.now(),
      admissionNo: profile?.admissionNo || null,
      batchId: profile?.batchId || null,
      batchCode: profile?.batchCode || null,
      programId: profile?.programId || null,
      centerId: profile?.centerId || null
    },
    { tenantId, studentId, academicYear, performanceType: 'SUMMARY' }
  );
};

const syncAssignmentPerf = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });
    const profile = await getProfile(tenantId, studentId);
    if (!profile) return res.status(404).json({ status: false, message: 'Student not found' });
    const allResults = await AssignmentResult.find({ tenantId, admissionNo: profile.admissionNo, isdeleted: false, status: 'completed' }, { subjectId: 1, obtainedMarks: 1, totalMarks: 1, cgpa: 1, numberOfReattempts: 1, batchId: 1, classNo: 1 }).lean();

    // A subject is reused across classes/years, so a student's completed results for the same
    // subjectId can span multiple years — only keep the ones that actually belong to academicYear.
    const resultBatchIds = [...new Set(allResults.map((r) => r.batchId).filter(Boolean))];
    const resultBatches = resultBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: resultBatchIds }, isdeleted: false }, { batchId: 1, academicYear: 1 }).lean() : [];
    const batchYearMap = new Map(resultBatches.map((b) => [b.batchId, b.academicYear]));
    const results = allResults.filter((r) => {
      const resultYear = (r.batchId && batchYearMap.get(r.batchId)) || resolveAcademicYear(profile, r.classNo);
      return resultYear === academicYear;
    });

    const subjectMap = new Map();
    for (const r of results) {
      const sid = r.subjectId?.toString() || '__unknown__';
      if (!subjectMap.has(sid)) subjectMap.set(sid, []);
      subjectMap.get(sid).push(r);
    }
    const validIds = [...subjectMap.keys()].filter((s) => s !== '__unknown__' && mongoose.Types.ObjectId.isValid(s));
    const subDocs = await Subject.find({ _id: { $in: validIds } }, { subjectName: 1 }).lean();
    const subNames = new Map(subDocs.map((s) => [s._id.toString(), s.subjectName]));
    const upserted = [];
    for (const [sid, rows] of subjectMap) {
      let totalAttempts = 0,
        totalSecured = 0,
        totalMax = 0,
        totalCgpa = 0,
        cgpaCount = 0;
      for (const r of rows) {
        totalAttempts += toNum(r.numberOfReattempts) || 1;
        totalSecured += toNum(r.obtainedMarks) || 0;
        totalMax += toNum(r.totalMarks) || 0;
        if (r.cgpa != null) {
          totalCgpa += toNum(r.cgpa);
          cgpaCount++;
        }
      }
      const avgCgpa = cgpaCount > 0 ? round2(totalCgpa / cgpaCount) : null;
      const pct = totalMax > 0 ? round2((totalSecured / totalMax) * 100) : null;
      const realSid = sid !== '__unknown__' ? sid : null;
      const doc = await upsertPerf(
        { tenantId, studentId, academicYear, performanceType: 'ASSIGNMENT', subjectId: realSid },
        {
          admissionNo: profile.admissionNo,
          batchId: profile.batchId,
          batchCode: profile.batchCode,
          programId: profile.programId,
          centerId: profile.centerId,
          subjectName: subNames.get(sid) || null,
          cgpa: avgCgpa,
          attempts: totalAttempts,
          obtainedMarks: totalSecured || null,
          totalMarks: totalMax || null,
          percentage: pct,
          syncedAt: Date.now()
        },
        { tenantId, studentId, academicYear, performanceType: 'ASSIGNMENT', subjectId: realSid }
      );
      upserted.push(doc);
    }
    await _recomputeSummary(tenantId, studentId, academicYear, profile);
    return res.status(200).json({
      status: true,
      message: `Assignment performance synced — ${upserted.length} subject(s)`,
      count: upserted.length
    });
  } catch (err) {
    return next(err);
  }
};

const syncMockExamPerf = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });
    const profile = await getProfile(tenantId, studentId);
    if (!profile) return res.status(404).json({ status: false, message: 'Student not found' });
    const results = await MockExamResult.find({ tenantId, admissionNo: profile.admissionNo, isdeleted: false }).lean();
    if (!results.length) {
      return res.status(200).json({ status: true, message: 'No mock exam results found', count: 0 });
    }
    const examIds = [...new Set(results.map((r) => r.examId))];
    const examDocs = await MockExam.find({ tenantId, examId: { $in: examIds } }, { examId: 1, examName: 1, classNo: 1 }).lean();
    const examNames = new Map(examDocs.map((e) => [e.examId, e.examName]));
    const examClassNo = new Map(examDocs.map((e) => [e.examId, e.classNo]));
    const allSubIds = results.flatMap((r) => (r.sectionResults || []).map((s) => s.subjectId?.toString()).filter(Boolean));
    const uniqSubs = [...new Set(allSubIds)].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const subDocs = await Subject.find({ _id: { $in: uniqSubs } }, { subjectName: 1 }).lean();
    const subNames = new Map(subDocs.map((s) => [s._id.toString(), s.subjectName]));

    // A student's mock exam history can span multiple years — only sync exams that actually
    // resolve to the requested academicYear, using each result's own batchId/classNo.
    const resultBatchIds = [...new Set(results.map((r) => r.batchId).filter(Boolean))];
    const resultBatches = resultBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: resultBatchIds }, isdeleted: false }, { batchId: 1, academicYear: 1 }).lean() : [];
    const batchYearMap = new Map(resultBatches.map((b) => [b.batchId, b.academicYear]));

    const upserted = [];
    const skipped = [];
    for (const r of results) {
      const resolvedYear = (r.batchId && batchYearMap.get(r.batchId)) || resolveAcademicYear(profile, examClassNo.get(r.examId));
      if (resolvedYear !== academicYear) {
        console.error(`[Performance] syncMockExamPerf skipped: tenantId=${tenantId} studentId=${studentId} examId=${r.examId} requested=${academicYear} resolvedYear=${resolvedYear || 'null'} resultBatchId=${r.batchId || 'null'} examClassNo=${examClassNo.get(r.examId) ?? 'null'}`);
        skipped.push({ examId: r.examId, resolvedYear: resolvedYear || null });
        continue;
      }
      const pct = r.totalMarks > 0 ? round2((r.obtainedMarks / r.totalMarks) * 100) : null;
      const doc = await upsertPerf(
        { tenantId, studentId, examId: r.examId, academicYear, performanceType: 'MOCK_EXAM' },
        {
          admissionNo: profile.admissionNo,
          batchId: profile.batchId,
          batchCode: profile.batchCode,
          programId: profile.programId,
          centerId: profile.centerId,
          academicYear,
          examName: examNames.get(r.examId) || null,
          obtainedMarks: r.obtainedMarks || 0,
          totalMarks: r.totalMarks || 0,
          percentage: pct,
          rank: r.rank || null,
          sectionResults: (r.sectionResults || []).map((s) => ({
            sectionId: s.sectionId || null,
            subjectId: s.subjectId?.toString() || null,
            subjectName: subNames.get(s.subjectId?.toString()) || null,
            totalMarks: s.totalMarks || 0,
            obtainedMarks: s.obtainedMarks || 0,
            correctCount: s.correctCount || 0,
            wrongCount: s.wrongCount || 0,
            skippedCount: s.skippedCount || 0,
            timeTaken: s.timeTaken || 0
          })),
          syncedAt: Date.now()
        },
        { tenantId, studentId, examId: r.examId, performanceType: 'MOCK_EXAM', academicYear }
      );
      upserted.push(doc);
    }
    await _recomputeSummary(tenantId, studentId, academicYear, profile);
    return res.status(200).json({
      status: true,
      message: `Mock exam performance synced — ${upserted.length} exam(s)`,
      count: upserted.length,
      skipped: skipped.length ? skipped : undefined
    });
  } catch (err) {
    return next(err);
  }
};

// const syncSchoolExamPerf = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const studentId = safeTrim(req.body?.studentId);
//     const academicYear = safeTrim(req.body?.academicYear);
//     if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });
//     const profile = await getProfile(tenantId, studentId);
//     if (!profile) return res.status(404).json({ status: false, message: 'Student not found' });
//     const results = await SchoolExamResult.find({ tenantId, studentId, isdeleted: false }).lean();
//     if (!results.length) {
//       return res.status(200).json({ status: true, message: 'No school exam results found', count: 0 });
//     }
//     const examIds = [...new Set(results.map((r) => r.examId))];
//     const examDocs = await SchoolExam.find({ examLogId: { $in: examIds }, tenantId }, { examLogId: 1, examName: 1, examDate: 1 }).lean();
//     const examMap = new Map(examDocs.map((e) => [e.examLogId, e]));
//     const upserted = [];
//     for (const r of results) {
//       const exam = examMap.get(r.examId) || {};
//       const pct = r.totalMaxMarks > 0 ? round2((r.totalObtainedMarks / r.totalMaxMarks) * 100) : null;
//       const doc = await upsertPerf(
//         { tenantId, studentId, examId: r.examId, performanceType: 'SCHOOL_EXAM' },
//         {
//           admissionNo: profile.admissionNo,
//           batchId: profile.batchId,
//           batchCode: profile.batchCode,
//           programId: profile.programId,
//           centerId: profile.centerId,
//           academicYear,
//           examName: exam.examName || null,
//           examDate: exam.examDate || null,
//           obtainedMarks: r.totalObtainedMarks || 0,
//           totalMarks: r.totalMaxMarks || 0,
//           percentage: pct,
//           subjects: (r.subjects || []).map((s) => ({
//             subjectName: s.subjectName || null,
//             maxMarks: s.maxMarks || 0,
//             obtainedMarks: s.obtainedMarks || 0,
//             percentage: s.maxMarks > 0 ? round2((s.obtainedMarks / s.maxMarks) * 100) : null,
//             grade: s.grade || null
//           })),
//           syncedAt: Date.now()
//         },
//         { tenantId, studentId, examId: r.examId, performanceType: 'SCHOOL_EXAM', academicYear }
//       );
//       upserted.push(doc);
//     }
//     await _recomputeSummary(tenantId, studentId, academicYear, profile);
//     return res.status(200).json({
//       status: true,
//       message: `School exam performance synced — ${upserted.length} exam(s)`,
//       count: upserted.length
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const syncSchoolExamPerf = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });

    const profile = await getProfile(tenantId, studentId);
    if (!profile) return res.status(404).json({ status: false, message: 'Student not found' });

    // Find all SchoolExamLogs where this student appears in results[]
    const examLogs = await SchoolExamLog.find({
      tenantId,
      academicYear,
      isdeleted: false,
      'results.studentId': studentId
    }).lean();

    if (!examLogs.length) {
      return res.status(200).json({ status: true, message: 'No school exam results found', count: 0 });
    }

    const upserted = [];
    for (const examLog of examLogs) {
      const studentResult = (examLog.results || []).find((r) => r.studentId === studentId);
      if (!studentResult) continue;

      const subjectsWithMarks = (studentResult.subjects || []).filter((s) => s.marks != null && !s.isAbsent);
      const totalObtained = subjectsWithMarks.reduce((s, sub) => s + (toNum(sub.marks) || 0), 0);
      const hasMaxMarks = (studentResult.subjects || []).some((s) => s.maxMarks != null);
      const totalMaxFromSubjects = hasMaxMarks ? subjectsWithMarks.reduce((s, sub) => s + (toNum(sub.maxMarks) || 0), 0) : null;
      const totalMax = totalMaxFromSubjects || toNum(studentResult.totalMarks) || null;
      const pct = totalMax > 0 ? round2((totalObtained / totalMax) * 100) : null;

      const resolvedYear = resolveAcademicYear(profile, studentResult.classNo ?? examLog.classNo);
      if (resolvedYear && resolvedYear !== academicYear) {
        console.error(`[Performance] syncSchoolExamPerf academicYear mismatch: tenantId=${tenantId} studentId=${studentId} examLogId=${examLog.examLogId} requested=${academicYear} resolvedFromProfile=${resolvedYear}`);
      }

      const doc = await upsertPerf(
        { tenantId, studentId, examId: examLog.examLogId, academicYear, performanceType: 'SCHOOL_EXAM' },
        {
          admissionNo: profile.admissionNo,
          batchId: examLog.batchId || profile.batchId || null,
          batchCode: examLog.batchCode || profile.batchCode || null,
          programId: profile.programId || null,
          centerId: examLog.centerId || profile.centerId || null,
          academicYear,
          examName: examLog.examName || null,
          examDate: examLog.examDate || null,
          obtainedMarks: totalObtained,
          totalMarks: totalMax,
          percentage: pct,
          subjects: (studentResult.subjects || []).map((s) => {
            const sMax = toNum(s.maxMarks);
            const sObtained = s.isAbsent ? 0 : toNum(s.marks) || 0;
            return {
              subjectName: s.subjectName || null,
              maxMarks: sMax,
              obtainedMarks: sObtained,
              percentage: sMax > 0 ? round2((sObtained / sMax) * 100) : null,
              grade: null
            };
          }),
          syncedAt: Date.now()
        },
        {
          tenantId,
          studentId,
          examId: examLog.examLogId,
          performanceType: 'SCHOOL_EXAM',
          academicYear
        }
      );
      upserted.push(doc);
    }

    await _recomputeSummary(tenantId, studentId, academicYear, profile);
    return res.status(200).json({
      status: true,
      message: `School exam performance synced — ${upserted.length} exam(s)`,
      count: upserted.length
    });
  } catch (err) {
    return next(err);
  }
};

const syncAllPerformance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });
    // Run sequentially, not concurrently — concurrent upserts from multiple sync functions
    // writing to the same StudentPerformance collection at once can trigger spurious
    // duplicate-key errors against unrelated unique indexes under MongoDB's write path.
    await _runSyncAssignment(tenantId, studentId, academicYear);
    await _runSyncMock(tenantId, studentId, academicYear);
    await _runSyncSchool(tenantId, studentId, academicYear);
    const profile = await getProfile(tenantId, studentId);
    const summary = await _recomputeSummary(tenantId, studentId, academicYear, profile);
    return res.status(200).json({ status: true, message: 'All performance synced', data: summary });
  } catch (err) {
    return next(err);
  }
};

const syncBatchPerformance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchId = safeTrim(req.body?.batchId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !batchId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, batchId and academicYear are required' });
    const students = await StudentProfile.find({ tenantId, batchId, isdeleted: false, status: 'ACTIVE' }, { studentId: 1 }).lean();
    if (!students.length) return res.status(200).json({ status: true, message: 'No active students in batch', synced: 0 });
    let synced = 0,
      errors = 0;
    for (const s of students) {
      try {
        // Run sequentially, not concurrently — concurrent upserts from multiple sync
        // functions writing to the same StudentPerformance collection at once can trigger
        // spurious duplicate-key errors against unrelated unique indexes under MongoDB's
        // write path.
        await _runSyncAssignment(tenantId, s.studentId, academicYear);
        await _runSyncMock(tenantId, s.studentId, academicYear);
        await _runSyncSchool(tenantId, s.studentId, academicYear);
        const profile = await getProfile(tenantId, s.studentId);
        await _recomputeSummary(tenantId, s.studentId, academicYear, profile);
        synced++;
      } catch (err) {
        console.error(`[Performance] syncBatchPerformance failed for studentId=${s.studentId}: ${err?.message || err}`);
        errors++;
      }
    }
    const summaries = await StudentPerformance.find({ tenantId, batchId, academicYear, performanceType: 'SUMMARY', isdeleted: false, 'summary.combinedScore': { $ne: null } })
      .sort({ 'summary.combinedScore': -1 })
      .select('studentId')
      .lean();
    if (summaries.length) {
      const bulkOps = summaries.map((r, idx) => ({
        updateOne: {
          filter: { tenantId, studentId: r.studentId, academicYear, performanceType: 'SUMMARY', isdeleted: false },
          update: { $set: { 'summary.batchRank': idx + 1 } }
        }
      }));
      await StudentPerformance.bulkWrite(bulkOps);
    }
    return res.status(200).json({
      status: true,
      message: `Batch sync complete. ${synced} synced, ${errors} errors.`,
      synced,
      errors,
      ranked: summaries.length
    });
  } catch (err) {
    return next(err);
  }
};

const _runSyncAssignment = async (tenantId, studentId, academicYear) => {
  const profile = await getProfile(tenantId, studentId);
  if (!profile) return;
  const allResults = await AssignmentResult.find({ tenantId, admissionNo: profile.admissionNo, isdeleted: false, status: 'completed' }, { subjectId: 1, obtainedMarks: 1, totalMarks: 1, cgpa: 1, numberOfReattempts: 1, batchId: 1, classNo: 1 }).lean();
  if (!allResults.length) return;

  // A subject is reused across classes/years, so a student's completed results for the same
  // subjectId can span multiple years — only keep the ones that actually belong to academicYear.
  const resultBatchIds = [...new Set(allResults.map((r) => r.batchId).filter(Boolean))];
  const resultBatches = resultBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: resultBatchIds }, isdeleted: false }, { batchId: 1, academicYear: 1 }).lean() : [];
  const batchYearMap = new Map(resultBatches.map((b) => [b.batchId, b.academicYear]));
  const results = allResults.filter((r) => {
    const resultYear = (r.batchId && batchYearMap.get(r.batchId)) || resolveAcademicYear(profile, r.classNo);
    return resultYear === academicYear;
  });
  if (!results.length) return;

  const subjectMap = new Map();
  for (const r of results) {
    const sid = r.subjectId?.toString() || '__unknown__';
    if (!subjectMap.has(sid)) subjectMap.set(sid, []);
    subjectMap.get(sid).push(r);
  }
  const validIds = [...subjectMap.keys()].filter((s) => s !== '__unknown__' && mongoose.Types.ObjectId.isValid(s));
  const subDocs = await Subject.find({ _id: { $in: validIds } }, { subjectName: 1 }).lean();
  const subNames = new Map(subDocs.map((s) => [s._id.toString(), s.subjectName]));
  for (const [sid, rows] of subjectMap) {
    let totalAttempts = 0,
      totalSecured = 0,
      totalMax = 0,
      totalCgpa = 0,
      cgpaCount = 0;
    for (const r of rows) {
      totalAttempts += toNum(r.numberOfReattempts) || 1;
      totalSecured += toNum(r.obtainedMarks) || 0;
      totalMax += toNum(r.totalMarks) || 0;
      if (r.cgpa != null) {
        totalCgpa += toNum(r.cgpa);
        cgpaCount++;
      }
    }
    const avgCgpa = cgpaCount > 0 ? round2(totalCgpa / cgpaCount) : null;
    const pct = totalMax > 0 ? round2((totalSecured / totalMax) * 100) : null;
    const realSid = sid !== '__unknown__' ? sid : null;
    try {
      await upsertPerf(
        { tenantId, studentId, academicYear, performanceType: 'ASSIGNMENT', subjectId: realSid },
        {
          admissionNo: profile.admissionNo,
          batchId: profile.batchId,
          batchCode: profile.batchCode,
          programId: profile.programId,
          centerId: profile.centerId,
          subjectName: subNames.get(sid) || null,
          cgpa: avgCgpa,
          attempts: totalAttempts,
          obtainedMarks: totalSecured || null,
          totalMarks: totalMax || null,
          percentage: pct,
          syncedAt: Date.now()
        },
        { tenantId, studentId, academicYear, performanceType: 'ASSIGNMENT', subjectId: realSid }
      );
    } catch (err) {
      console.error(`[PerfSync:_runSyncAssignment] UPSERT FAILED studentId=${studentId} subjectId=${realSid || 'null'} academicYear=${academicYear} code=${err?.code} message=${err?.message}`);
    }
  }
};

const _runSyncMock = async (tenantId, studentId, academicYear) => {
  const profile = await getProfile(tenantId, studentId);
  if (!profile) return;
  const results = await MockExamResult.find({ tenantId, admissionNo: profile.admissionNo, isdeleted: false }).lean();
  if (!results.length) return;
  const examIds = [...new Set(results.map((r) => r.examId))];
  const examDocs = await MockExam.find({ tenantId, examId: { $in: examIds } }, { examId: 1, examName: 1, classNo: 1 }).lean();
  const examNames = new Map(examDocs.map((e) => [e.examId, e.examName]));
  const examClassNo = new Map(examDocs.map((e) => [e.examId, e.classNo]));
  const allSubIds = results.flatMap((r) => (r.sectionResults || []).map((s) => s.subjectId?.toString()).filter(Boolean));
  const uniqSubs = [...new Set(allSubIds)].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const subDocs = await Subject.find({ _id: { $in: uniqSubs } }, { subjectName: 1 }).lean();
  const subNames = new Map(subDocs.map((s) => [s._id.toString(), s.subjectName]));
  const resultBatchIds = [...new Set(results.map((r) => r.batchId).filter(Boolean))];
  const resultBatches = resultBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: resultBatchIds }, isdeleted: false }, { batchId: 1, academicYear: 1 }).lean() : [];
  const batchYearMap = new Map(resultBatches.map((b) => [b.batchId, b.academicYear]));
  for (const r of results) {
    const viaBatch = r.batchId ? batchYearMap.get(r.batchId) : undefined;
    const resolvedYear = viaBatch || resolveAcademicYear(profile, examClassNo.get(r.examId));
    if (resolvedYear !== academicYear) continue;
    const pct = r.totalMarks > 0 ? round2((r.obtainedMarks / r.totalMarks) * 100) : null;
    try {
      await upsertPerf(
        { tenantId, studentId, examId: r.examId, academicYear, performanceType: 'MOCK_EXAM' },
        {
          admissionNo: profile.admissionNo,
          batchId: profile.batchId,
          batchCode: profile.batchCode,
          programId: profile.programId,
          centerId: profile.centerId,
          academicYear,
          examName: examNames.get(r.examId) || null,
          obtainedMarks: r.obtainedMarks || 0,
          totalMarks: r.totalMarks || 0,
          percentage: pct,
          rank: r.rank || null,
          subjectId: null,
          sectionResults: (r.sectionResults || []).map((s) => ({
            sectionId: s.sectionId || null,
            subjectId: s.subjectId?.toString() || null,
            subjectName: subNames.get(s.subjectId?.toString()) || null,
            totalMarks: s.totalMarks || 0,
            obtainedMarks: s.obtainedMarks || 0,
            correctCount: s.correctCount || 0,
            wrongCount: s.wrongCount || 0,
            skippedCount: s.skippedCount || 0,
            timeTaken: s.timeTaken || 0
          })),
          syncedAt: Date.now()
        },
        { tenantId, studentId, examId: r.examId, performanceType: 'MOCK_EXAM', academicYear }
      );
    } catch (err) {
      console.error(`[PerfSync:_runSyncMock] UPSERT FAILED examId=${r.examId} academicYear=${academicYear} code=${err?.code} message=${err?.message}`);
    }
  }
};

const _runSyncSchool = async (tenantId, studentId, academicYear) => {
  const profile = await getProfile(tenantId, studentId);
  if (!profile) return;
  const examLogs = await SchoolExamLog.find({
    tenantId,
    academicYear,
    isdeleted: false,
    'results.studentId': studentId
  }).lean();
  if (!examLogs.length) return;
  for (const examLog of examLogs) {
    const studentResult = (examLog.results || []).find((r) => r.studentId === studentId);
    if (!studentResult) continue;
    const subjectsWithMarks = (studentResult.subjects || []).filter((s) => s.marks != null && !s.isAbsent);
    const totalObtained = subjectsWithMarks.reduce((s, sub) => s + (toNum(sub.marks) || 0), 0);
    const hasMaxMarks = (studentResult.subjects || []).some((s) => s.maxMarks != null);
    const totalMaxFromSubjects = hasMaxMarks ? subjectsWithMarks.reduce((s, sub) => s + (toNum(sub.maxMarks) || 0), 0) : null;
    const totalMax = totalMaxFromSubjects || toNum(studentResult.totalMarks) || null;
    const pct = totalMax > 0 ? round2((totalObtained / totalMax) * 100) : null;
    try {
      await upsertPerf(
        { tenantId, studentId, examId: examLog.examLogId, academicYear, performanceType: 'SCHOOL_EXAM' },
        {
          admissionNo: profile.admissionNo,
          batchId: examLog.batchId || profile.batchId || null,
          batchCode: examLog.batchCode || profile.batchCode || null,
          programId: profile.programId || null,
          centerId: examLog.centerId || profile.centerId || null,
          // academicYear,
          examName: examLog.examName || null,
          examDate: examLog.examDate || null,
          obtainedMarks: totalObtained,
          totalMarks: totalMax,
          percentage: pct,
          subjectId: null,
          subjects: (studentResult.subjects || []).map((s) => {
            const sMax = toNum(s.maxMarks);
            const sObtained = s.isAbsent ? 0 : toNum(s.marks) || 0;
            return {
              subjectName: s.subjectName || null,
              maxMarks: sMax,
              obtainedMarks: sObtained,
              percentage: sMax > 0 ? round2((sObtained / sMax) * 100) : null,
              grade: null
            };
          }),
          syncedAt: Date.now()
        },
        {
          tenantId,
          studentId,
          examId: examLog.examLogId,
          performanceType: 'SCHOOL_EXAM',
          academicYear
        }
      );
    } catch (err) {
      console.error(`[PerfSync:_runSyncSchool] UPSERT FAILED studentId=${studentId} examLogId=${examLog.examLogId} academicYear=${academicYear} code=${err?.code} message=${err?.message}`);
    }
  }
};

const getStudentPerformanceFull = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });
    const records = await StudentPerformance.find({ tenantId, studentId, academicYear, isdeleted: false }).lean();
    const grouped = { summary: null, assignments: [], mockExams: [], schoolExams: [] };
    for (const r of records) {
      if (r.performanceType === 'SUMMARY') grouped.summary = r;
      else if (r.performanceType === 'ASSIGNMENT') grouped.assignments.push(r);
      else if (r.performanceType === 'MOCK_EXAM') grouped.mockExams.push(r);
      else if (r.performanceType === 'SCHOOL_EXAM') grouped.schoolExams.push(r);
    }
    grouped.mockExams.sort((a, b) => (b.syncedAt || 0) - (a.syncedAt || 0));
    grouped.schoolExams.sort((a, b) => (b.examDate || 0) - (a.examDate || 0));
    return res.status(200).json({ status: true, data: grouped });
  } catch (err) {
    return next(err);
  }
};

const getStudentMockList = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });
    const page = Math.max(toInt(req.body?.page, 1), 1);
    const limit = Math.min(Math.max(toInt(req.body?.limit, 20), 1), 100);
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      StudentPerformance.find({ tenantId, studentId, academicYear, performanceType: 'MOCK_EXAM', isdeleted: false }, { examId: 1, examName: 1, obtainedMarks: 1, totalMarks: 1, percentage: 1, rank: 1, sectionResults: 1, syncedAt: 1 }).sort({ syncedAt: -1 }).skip(skip).limit(limit).lean(),
      StudentPerformance.countDocuments({ tenantId, studentId, academicYear, performanceType: 'MOCK_EXAM', isdeleted: false })
    ]);
    return res.status(200).json({ status: true, data: rows, page, limit, count, pages: Math.ceil(count / limit) || 0 });
  } catch (err) {
    return next(err);
  }
};

const getStudentSchoolList = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });
    const page = Math.max(toInt(req.body?.page, 1), 1);
    const limit = Math.min(Math.max(toInt(req.body?.limit, 20), 1), 100);
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      StudentPerformance.find({ tenantId, studentId, academicYear, performanceType: 'SCHOOL_EXAM', isdeleted: false }).sort({ examDate: -1 }).skip(skip).limit(limit).lean(),
      StudentPerformance.countDocuments({ tenantId, studentId, academicYear, performanceType: 'SCHOOL_EXAM', isdeleted: false })
    ]);
    return res.status(200).json({ status: true, data: rows, page, limit, count, pages: Math.ceil(count / limit) || 0 });
  } catch (err) {
    return next(err);
  }
};

const getBatchPerformanceList = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchId = safeTrim(req.body?.batchId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !batchId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, batchId and academicYear are required' });
    const page = Math.max(toInt(req.body?.page, 1), 1);
    const limit = Math.min(Math.max(toInt(req.body?.limit, 20), 1), 200);
    const skip = (page - 1) * limit;
    const search = safeTrim(req.body?.search);
    const studentQuery = { tenantId, batchId, isdeleted: false, status: 'ACTIVE' };
    if (search) {
      const rx = new RegExp(escapeRx(search), 'i');
      studentQuery.$or = [{ 'student.name': rx }, { admissionNo: rx }];
    }
    const [students, total] = await Promise.all([StudentProfile.find(studentQuery, { studentId: 1, admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).skip(skip).limit(limit).lean(), StudentProfile.countDocuments(studentQuery)]);
    const studentIds = students.map((s) => s.studentId);
    const summaries = await StudentPerformance.find({ tenantId, studentId: { $in: studentIds }, academicYear, performanceType: 'SUMMARY', isdeleted: false }, { studentId: 1, summary: 1 }).lean();
    const summaryMap = new Map(summaries.map((s) => [s.studentId, s.summary]));
    const data = students.map((s) => ({
      studentId: s.studentId,
      admissionNo: s.admissionNo,
      studentName: s.student?.name || null,
      summary: summaryMap.get(s.studentId) || null
    }));
    const withScore = summaries.filter((s) => s.summary?.combinedScore != null);
    const avgCombined = withScore.length ? round2(withScore.reduce((a, s) => a + s.summary.combinedScore, 0) / withScore.length) : null;
    return res.status(200).json({
      status: true,
      data,
      page,
      limit,
      count: total,
      pages: Math.ceil(total / limit) || 0,
      batchSummary: { batchId, academicYear, totalStudents: total, studentsWithPerf: summaries.length, avgCombinedScore: avgCombined }
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchLeaderboard = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchId = safeTrim(req.body?.batchId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !batchId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, batchId and academicYear are required' });
    const limit = Math.min(toInt(req.body?.limit, 50), 200);
    const records = await StudentPerformance.find({ tenantId, batchId, academicYear, performanceType: 'SUMMARY', isdeleted: false, 'summary.combinedScore': { $ne: null } })
      .sort({ 'summary.combinedScore': -1 })
      .limit(limit)
      .select('studentId admissionNo summary')
      .lean();
    const studentIds = records.map((r) => r.studentId);
    const profiles = await StudentProfile.find({ tenantId, studentId: { $in: studentIds } }, { studentId: 1, 'student.name': 1 }).lean();
    const nameMap = new Map(profiles.map((p) => [p.studentId, p.student?.name || null]));
    const data = records.map((r, idx) => ({
      rank: idx + 1,
      studentId: r.studentId,
      admissionNo: r.admissionNo,
      studentName: nameMap.get(r.studentId) || null,
      combinedScore: r.summary?.combinedScore ?? null,
      assignmentAvgPct: r.summary?.assignmentAvgPct ?? null,
      mockAvgPct: r.summary?.mockAvgPct ?? null,
      schoolAvgPct: r.summary?.schoolAvgPct ?? null,
      mockBestRank: r.summary?.mockBestRank ?? null,
      assignmentAvgCgpa: r.summary?.assignmentAvgCgpa ?? null
    }));
    return res.status(200).json({ status: true, data, count: data.length });
  } catch (err) {
    return next(err);
  }
};

const getBatchReport = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchId = safeTrim(req.body?.batchId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!tenantId || !batchId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, batchId and academicYear are required' });
    const [assignmentReport, mockReport, schoolReport, summaryReport] = await Promise.all([
      StudentPerformance.aggregate([
        { $match: { tenantId, batchId, academicYear, performanceType: 'ASSIGNMENT', isdeleted: false } },
        {
          $group: {
            _id: '$subjectId',
            subjectName: { $first: '$subjectName' },
            avgCgpa: { $avg: '$cgpa' },
            avgPct: { $avg: '$percentage' },
            studentCount: { $sum: 1 }
          }
        },
        { $sort: { subjectName: 1 } }
      ]),
      StudentPerformance.aggregate([
        { $match: { tenantId, batchId, academicYear, performanceType: 'MOCK_EXAM', isdeleted: false } },
        {
          $group: {
            _id: '$examId',
            examName: { $first: '$examName' },
            avgPct: { $avg: '$percentage' },
            avgRank: { $avg: '$rank' },
            studentCount: { $sum: 1 },
            topScore: { $max: '$percentage' },
            bottomScore: { $min: '$percentage' }
          }
        },
        { $sort: { syncedAt: -1 } }
      ]),
      StudentPerformance.aggregate([
        { $match: { tenantId, batchId, academicYear, performanceType: 'SCHOOL_EXAM', isdeleted: false } },
        {
          $group: {
            _id: '$examId',
            examName: { $first: '$examName' },
            examDate: { $first: '$examDate' },
            avgPct: { $avg: '$percentage' },
            studentCount: { $sum: 1 },
            topScore: { $max: '$percentage' },
            bottomScore: { $min: '$percentage' }
          }
        },
        { $sort: { examDate: -1 } }
      ]),
      StudentPerformance.aggregate([
        { $match: { tenantId, batchId, academicYear, performanceType: 'SUMMARY', isdeleted: false } },
        {
          $group: {
            _id: null,
            avgCombinedScore: { $avg: '$summary.combinedScore' },
            avgAssignmentPct: { $avg: '$summary.assignmentAvgPct' },
            avgMockPct: { $avg: '$summary.mockAvgPct' },
            avgSchoolPct: { $avg: '$summary.schoolAvgPct' },
            studentCount: { $sum: 1 }
          }
        }
      ])
    ]);
    return res.status(200).json({
      status: true,
      data: {
        batchId,
        academicYear,
        overview: summaryReport[0] || null,
        subjectWise: assignmentReport.map((r) => ({ ...r, avgCgpa: round2(r.avgCgpa), avgPct: round2(r.avgPct) })),
        mockExamWise: mockReport.map((r) => ({ ...r, avgPct: round2(r.avgPct), topScore: round2(r.topScore), bottomScore: round2(r.bottomScore) })),
        schoolExamWise: schoolReport.map((r) => ({ ...r, avgPct: round2(r.avgPct), topScore: round2(r.topScore), bottomScore: round2(r.bottomScore) }))
      }
    });
  } catch (err) {
    return next(err);
  }
};

const overrideAssignmentPerf = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    const subjectId = safeTrim(req.body?.subjectId) || null;
    if (!tenantId || !studentId || !academicYear) return res.status(400).json({ status: false, message: 'tenantId, studentId and academicYear are required' });
    const existing = await StudentPerformance.findOne({ tenantId, studentId, academicYear, performanceType: 'ASSIGNMENT', subjectId, isdeleted: false }).lean();
    const marksSecured = req.body.marksSecured !== undefined ? toNum(req.body.marksSecured) : existing?.obtainedMarks;
    const marksTotal = req.body.marksTotal !== undefined ? toNum(req.body.marksTotal) : existing?.totalMarks;
    const pct = marksTotal > 0 ? round2((marksSecured / marksTotal) * 100) : null;
    const updated = await upsertPerf(
      { tenantId, studentId, academicYear, performanceType: 'ASSIGNMENT', subjectId },
      {
        cgpa: req.body.cgpa !== undefined ? toNum(req.body.cgpa) : existing?.cgpa,
        attempts: req.body.attempts !== undefined ? toNum(req.body.attempts) : existing?.attempts,
        obtainedMarks: marksSecured,
        totalMarks: marksTotal,
        percentage: pct,
        overridden: true,
        syncedAt: Date.now()
      },
      { tenantId, studentId, academicYear, performanceType: 'ASSIGNMENT', subjectId }
    );
    const profile = await getProfile(tenantId, studentId);
    await _recomputeSummary(tenantId, studentId, academicYear, profile);
    return res.status(200).json({ status: true, message: 'Assignment performance overridden', data: updated });
  } catch (err) {
    return next(err);
  }
};

const addStudentFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    const staffId = safeTrim(req.body?.staffId);
    const remarks = safeTrim(req.body?.remarks);
    if (!tenantId || !studentId || !academicYear || !staffId || !remarks) return res.status(400).json({ status: false, message: 'tenantId, studentId, academicYear, staffId and remarks are required' });
    const record = await StudentPerformance.findOne({ tenantId, studentId, academicYear, performanceType: 'SUMMARY', isdeleted: false });
    if (!record) return res.status(404).json({ status: false, message: 'Performance summary record not found. Run sync first.' });
    const staff = await Staff.findOne({ tenantId, staffId, isdeleted: false }, { staffName: 1 }).lean();
    record.staffFeedback.push({ feedbackId: uuid(), staffId, staffName: staff?.staffName || null, remarks, addedAt: Date.now() });
    await record.save();
    return res.status(201).json({ status: true, message: 'Feedback added', data: record.toObject() });
  } catch (err) {
    return next(err);
  }
};

const deleteStudentFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const performanceId = safeTrim(req.body?.performanceId);
    const feedbackId = safeTrim(req.body?.feedbackId);
    if (!tenantId || !performanceId || !feedbackId) return res.status(400).json({ status: false, message: 'tenantId, performanceId and feedbackId are required' });
    const updated = await StudentPerformance.findOneAndUpdate({ tenantId, performanceId, performanceType: 'SUMMARY', isdeleted: false }, { $pull: { staffFeedback: { feedbackId } } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Record not found' });
    return res.status(200).json({ status: true, message: 'Feedback removed', data: updated });
  } catch (err) {
    return next(err);
  }
};

const addStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const staffId = safeTrim(req.body?.staffId);
    const remarks = safeTrim(req.body?.remarks) || null;
    const addedBy = safeTrim(req.body?.userId) || null;
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    const rating = toRating(req.body?.rating);
    if (rating === null) return res.status(400).json({ status: false, message: 'rating must be between 1 and 5' });
    const staff = await Staff.findOne({ tenantId, staffId, isdeleted: false }, { staffCode: 1, staffName: 1, staffType: 1, employeeId: 1 }).lean();
    if (!staff) return res.status(404).json({ status: false, message: 'Staff not found' });
    const doc = await StaffPerformance.create({
      tenantId,
      performanceId: uuid(),
      staffId,
      staffCode: staff.employeeId || staff.staffCode || null,
      staffName: staff.staffName || null,
      staffType: staff.staffType || null,
      rating,
      remarks,
      addedBy,
      isdeleted: false
    });
    return res.status(201).json({ status: true, message: 'Staff feedback added', data: doc });
  } catch (err) {
    return next(err);
  }
};

const listStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const staffId = safeTrim(req.body?.staffId);
    if (!tenantId || !staffId) return res.status(400).json({ status: false, message: 'tenantId and staffId are required' });
    const page = Math.max(toInt(req.body?.page, 1), 1);
    const limit = Math.min(Math.max(toInt(req.body?.limit, 20), 1), 200);
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([StaffPerformance.find({ tenantId, staffId, isdeleted: false }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), StaffPerformance.countDocuments({ tenantId, staffId, isdeleted: false })]);
    return res.status(200).json({ status: true, data: rows, count });
  } catch (err) {
    return next(err);
  }
};

const updateStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const performanceId = safeTrim(req.body?.performanceId);
    if (!tenantId || !performanceId) return res.status(400).json({ status: false, message: 'tenantId and performanceId are required' });
    const patch = {};
    if (req.body?.rating !== undefined) {
      const rating = toRating(req.body.rating);
      if (rating === null) return res.status(400).json({ status: false, message: 'rating must be between 1 and 5' });
      patch.rating = rating;
    }
    if (req.body?.remarks !== undefined) patch.remarks = safeTrim(req.body.remarks) || null;
    if (!Object.keys(patch).length) return res.status(400).json({ status: false, message: 'Nothing to update' });
    const doc = await StaffPerformance.findOneAndUpdate({ tenantId, performanceId, isdeleted: false }, { $set: patch }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Record not found' });
    return res.status(200).json({ status: true, message: 'Feedback updated', data: doc });
  } catch (err) {
    return next(err);
  }
};

const deleteStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const performanceId = safeTrim(req.body?.performanceId);
    if (!tenantId || !performanceId) return res.status(400).json({ status: false, message: 'tenantId and performanceId are required' });
    const doc = await StaffPerformance.findOneAndUpdate({ tenantId, performanceId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Record not found' });
    return res.status(200).json({ status: true, message: 'Feedback deleted' });
  } catch (err) {
    return next(err);
  }
};

const listAllStaffPerf = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const search = safeTrim(req.body?.search);
    const staffType = safeTrim(req.body?.staffType);
    const centerId = safeTrim(req.body?.centerId);
    const page = Math.max(toInt(req.body?.page, 1), 1);
    const limit = Math.min(Math.max(toInt(req.body?.limit, 20), 1), 200);
    const skip = (page - 1) * limit;
    const matchBase = { tenantId, isdeleted: false };
    if (staffType) matchBase.staffType = staffType;
    if (centerId) {
      const staffIdsForCenter = (await Staff.find({ tenantId, centerId, isdeleted: false }, { staffId: 1 }).lean()).map((s) => s.staffId);
      matchBase.staffId = { $in: staffIdsForCenter };
    }
    if (search) {
      const rx = new RegExp(escapeRx(search), 'i');
      matchBase.$or = [{ staffName: rx }, { staffCode: rx }];
    }
    const pipeline = [
      { $match: matchBase },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$staffId', staffId: { $first: '$staffId' }, staffCode: { $first: '$staffCode' }, staffName: { $first: '$staffName' }, staffType: { $first: '$staffType' }, avgRating: { $avg: '$rating' }, totalCount: { $sum: 1 }, latestEntry: { $first: '$$ROOT' } } },
      { $sort: { 'latestEntry.createdAt': -1 } },
      { $skip: skip },
      { $limit: limit }
    ];
    const countPipeline = [{ $match: matchBase }, { $group: { _id: '$staffId' } }, { $count: 'total' }];
    const [rows, countResult] = await Promise.all([StaffPerformance.aggregate(pipeline), StaffPerformance.aggregate(countPipeline)]);
    return res.status(200).json({ status: true, data: rows, count: countResult[0]?.total || 0 });
  } catch (err) {
    return next(err);
  }
};

export default {
  syncAssignmentPerf,
  syncMockExamPerf,
  syncSchoolExamPerf,
  syncAllPerformance,
  syncBatchPerformance,
  getStudentPerformanceFull,
  getStudentMockList,
  getStudentSchoolList,
  getBatchPerformanceList,
  getBatchLeaderboard,
  getBatchReport,
  overrideAssignmentPerf,
  addStudentFeedback,
  deleteStudentFeedback,
  addStaffFeedback,
  listStaffFeedback,
  updateStaffFeedback,
  deleteStaffFeedback,
  listAllStaffPerf
};

/**
 * performanceSync.util.js
 *
 * Fire-and-forget performance sync hooks.
 * Each function is called AFTER the main API succeeds.
 * Never throws — never blocks the main response.
 *
 * Usage:
 *   import { syncOnAssignmentSubmit, syncOnMockPublish, syncOnSchoolExamUpload } from '../utils/performanceSync.util.js';
 *
 *   // At end of submitAssignmentResult (after AssignmentResult.create):
 *   syncOnAssignmentSubmit({ tenantId, admissionNo, studentId, batchId, subjectId }).catch(() => {});
 *
 *   // At end of publishResult (after MockExam status update):
 *   syncOnMockPublish({ tenantId, examId }).catch(() => {});
 *
 *   // At end of uploadExamMarks (after SchoolExamLog upsert):
 *   syncOnSchoolExamUpload({ tenantId, examLogId, batchCode, academicYear }).catch(() => {});
 */

import mongoose from 'mongoose';
import StudentPerformance from '../models/studentperformance.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import AssignmentResult from '../models/assignmentResult.model.js';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExam from '../models/mockExam.model.js';
import SchoolExamLog from '../models/schoolexam.model.js';
import Subject from '../models/subject.model.js';
import Batch from '../models/batch.model.js';

// ── Helpers ────────────────────────────────────────────────────────────────
const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (v) => (v != null ? Math.round(v * 100) / 100 : null);

const WEIGHTS = { assignment: 0.4, mock: 0.3, school: 0.3 };

// Weighted combined score from available averages
const computeCombined = (assignPct, mockPct, schoolPct) => {
  const parts = [assignPct != null ? { v: assignPct, w: WEIGHTS.assignment } : null, mockPct != null ? { v: mockPct, w: WEIGHTS.mock } : null, schoolPct != null ? { v: schoolPct, w: WEIGHTS.school } : null].filter(Boolean);
  if (!parts.length) return null;
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  return round2(parts.reduce((s, p) => s + p.v * p.w, 0) / totalW);
};

// Upsert a single performance record (any type)
const upsert = (filter, setDoc, setOnInsert) => StudentPerformance.findOneAndUpdate({ ...filter, isdeleted: false }, { $set: setDoc, $setOnInsert: { ...setOnInsert, isdeleted: false } }, { upsert: true, new: true });

// Recompute SUMMARY for a student after any sync
const recomputeSummary = async (tenantId, studentId, academicYear, profile) => {
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

  // Preserve existing batchRank
  const existing = await StudentPerformance.findOne({ tenantId, studentId, academicYear, performanceType: 'SUMMARY', isdeleted: false }, { 'summary.batchRank': 1 }).lean();

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

  return upsert(
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

// ─────────────────────────────────────────────────────────────────────────────
// HOOK 1: Called after submitAssignmentResult succeeds
//
// What it does:
//   1. Fetch academicYear from Batch using batchId
//   2. Pull all completed AssignmentResults for this student + subjectId
//   3. Compute avg CGPA and percentage
//   4. Upsert ASSIGNMENT record for this student + subject
//   5. Recompute SUMMARY
//
// Call it like:
//   syncOnAssignmentSubmit({ tenantId, admissionNo, studentId, batchId, subjectId }).catch(() => {});
// ─────────────────────────────────────────────────────────────────────────────
export const syncOnAssignmentSubmit = async ({ tenantId, admissionNo, studentId, batchId, subjectId }) => {
  try {
    if (!tenantId || !admissionNo) return;

    // Step 1: Get academicYear from Batch
    const batch = await Batch.findOne({ tenantId, batchId, isdeleted: false }, { academicYear: 1, batchCode: 1, programId: 1, centerId: 1 }).lean();
    if (!batch?.academicYear) return;

    const academicYear = batch.academicYear;

    // Step 2: Get student profile for identity fields
    const profile = await StudentProfile.findOne({ tenantId, admissionNo, isdeleted: false }, { studentId: 1, admissionNo: 1, batchId: 1, batchCode: 1, programId: 1, centerId: 1 }).lean();

    const resolvedStudentId = studentId || profile?.studentId;
    if (!resolvedStudentId) return;

    // Step 3: Pull all completed assignment results for this student + subject
    const subjectObjId = mongoose.Types.ObjectId.isValid(String(subjectId || '')) ? new mongoose.Types.ObjectId(String(subjectId)) : subjectId;

    const results = await AssignmentResult.find({ tenantId, admissionNo, subjectId: subjectObjId, isdeleted: false, status: 'completed' }, { obtainedMarks: 1, totalMarks: 1, cgpa: 1, numberOfReattempts: 1 }).lean();

    if (!results.length) return;

    // Step 4: Compute aggregates
    let totalAttempts = 0,
      totalSecured = 0,
      totalMax = 0,
      totalCgpa = 0,
      cgpaCount = 0;
    for (const r of results) {
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

    // Fetch subject name
    let subjectName = null;
    if (mongoose.Types.ObjectId.isValid(String(subjectId || ''))) {
      const subDoc = await Subject.findOne({ _id: subjectObjId }, { subjectName: 1 }).lean();
      subjectName = subDoc?.subjectName || null;
    }

    // Step 5: Upsert ASSIGNMENT record
    await upsert(
      {
        tenantId,
        studentId: resolvedStudentId,
        academicYear,
        performanceType: 'ASSIGNMENT',
        subjectId: String(subjectId)
      },
      {
        admissionNo: profile?.admissionNo || admissionNo,
        batchId: batchId || profile?.batchId || null,
        batchCode: batch?.batchCode || profile?.batchCode || null,
        programId: profile?.programId || null,
        centerId: profile?.centerId || null,
        subjectName,
        cgpa: avgCgpa,
        attempts: totalAttempts,
        obtainedMarks: totalSecured || null,
        totalMarks: totalMax || null,
        percentage: pct,
        syncedAt: Date.now()
      },
      {
        tenantId,
        studentId: resolvedStudentId,
        academicYear,
        performanceType: 'ASSIGNMENT',
        subjectId: String(subjectId)
      }
    );

    // Step 6: Recompute SUMMARY
    await recomputeSummary(tenantId, resolvedStudentId, academicYear, profile || { admissionNo, batchId, batchCode: batch?.batchCode });
  } catch (err) {
    console.error('[PerfSync] syncOnAssignmentSubmit error:', err?.message || err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOK 2: Called after publishResult succeeds
//
// What it does:
//   1. Fetch all MockExamResults for this examId (ranks are now set)
//   2. Fetch exam name from MockExam
//   3. For each student result → upsert MOCK_EXAM record
//   4. Recompute SUMMARY for each student
//
// Call it like:
//   syncOnMockPublish({ tenantId, examId }).catch(() => {});
// ─────────────────────────────────────────────────────────────────────────────
export const syncOnMockPublish = async ({ tenantId, examId }) => {
  try {
    if (!tenantId || !examId) return;

    // Fetch exam name
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { examName: 1, sections: 1 }).lean();
    if (!exam) return;

    // Fetch all results for this exam
    const results = await MockExamResult.find({ tenantId, examId, isdeleted: false }, { admissionNo: 1, studentId: 1, batchId: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, sectionResults: 1 }).lean();
    if (!results.length) return;

    // Fetch subject names for sections
    const allSubIds = results.flatMap((r) => (r.sectionResults || []).map((s) => s.subjectId?.toString()).filter(Boolean));
    const uniqSubs = [...new Set(allSubIds)].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const subDocs = await Subject.find({ _id: { $in: uniqSubs } }, { subjectName: 1 }).lean();
    const subNames = new Map(subDocs.map((s) => [s._id.toString(), s.subjectName]));

    // Fetch student profiles to get academicYear
    const admissionNos = [...new Set(results.map((r) => r.admissionNo).filter(Boolean))];
    const profiles = await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, studentId: 1, batchId: 1, batchCode: 1, programId: 1, centerId: 1, academicYear: 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [p.admissionNo, p]));

    // Process each student
    for (const r of results) {
      try {
        const profile = profileMap.get(r.admissionNo) || null;
        const studentId = r.studentId || profile?.studentId;
        const academicYear = profile?.academicYear;
        if (!studentId || !academicYear) continue;

        const pct = r.totalMarks > 0 ? round2((r.obtainedMarks / r.totalMarks) * 100) : null;

        await upsert(
          { tenantId, studentId, examId, performanceType: 'MOCK_EXAM' },
          {
            admissionNo: r.admissionNo,
            batchId: r.batchId || profile?.batchId || null,
            batchCode: profile?.batchCode || null,
            programId: profile?.programId || null,
            centerId: profile?.centerId || null,
            academicYear,
            examName: exam.examName || null,
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
          {
            tenantId,
            studentId,
            examId,
            performanceType: 'MOCK_EXAM',
            academicYear
          }
        );

        await recomputeSummary(tenantId, studentId, academicYear, profile);
      } catch (innerErr) {
        console.error(`[PerfSync] syncOnMockPublish student ${r.admissionNo} error:`, innerErr?.message);
      }
    }
  } catch (err) {
    console.error('[PerfSync] syncOnMockPublish error:', err?.message || err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOK 3: Called after uploadExamMarks succeeds
//
// What it does:
//   1. Fetch the SchoolExamLog by examLogId
//   2. For each matched result in log.results[] → upsert SCHOOL_EXAM record
//   3. Recompute SUMMARY for each student
//
// Call it like:
//   syncOnSchoolExamUpload({ tenantId, examLogId, academicYear }).catch(() => {});
// ─────────────────────────────────────────────────────────────────────────────
export const syncOnSchoolExamUpload = async ({ tenantId, examLogId, academicYear }) => {
  try {
    if (!tenantId || !examLogId) return;

    // Fetch the exam log
    const examLog = await SchoolExamLog.findOne({ tenantId, examLogId, isdeleted: false }).lean();
    if (!examLog) return;

    // Only process matched students (isMatched = true, have studentId)
    const matchedResults = (examLog.results || []).filter((r) => r.isMatched && r.studentId);
    if (!matchedResults.length) return;

    const resolvedYear = academicYear || examLog.academicYear;
    if (!resolvedYear) return;

    // Fetch student profiles for identity fields
    const studentIds = matchedResults.map((r) => r.studentId).filter(Boolean);
    const profiles = await StudentProfile.find({ tenantId, studentId: { $in: studentIds }, isdeleted: false }, { studentId: 1, admissionNo: 1, batchId: 1, batchCode: 1, programId: 1, centerId: 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [p.studentId, p]));

    for (const r of matchedResults) {
      try {
        const profile = profileMap.get(r.studentId) || null;
        const studentId = r.studentId;

        // Compute totals from subjects
        const subjectsWithMax = (r.subjects || []).filter((s) => s.marks != null && !s.isAbsent);
        const totalObtained = subjectsWithMax.reduce((s, sub) => s + (toNum(sub.marks) || 0), 0);

        // totalMarks — use the stored value or sum of max marks if available
        // SchoolExamLog doesn't store maxMarks per subject, only marks obtained
        // Use examLog-level totalMarks if stored on the result row
        const totalMax = toNum(r.totalMarks) || null;
        const pct = totalMax > 0 ? round2((totalObtained / totalMax) * 100) : null;

        await upsert(
          { tenantId, studentId, examId: examLogId, performanceType: 'SCHOOL_EXAM' },
          {
            admissionNo: r.admissionNo || profile?.admissionNo || null,
            batchId: examLog.batchId || profile?.batchId || null,
            batchCode: examLog.batchCode || profile?.batchCode || null,
            programId: profile?.programId || null,
            centerId: examLog.centerId || profile?.centerId || null,
            academicYear: resolvedYear,
            examName: examLog.examName || null,
            examDate: examLog.examDate || null,
            obtainedMarks: totalObtained,
            totalMarks: totalMax,
            percentage: pct,
            subjects: (r.subjects || []).map((s) => ({
              subjectName: s.subjectName || null,
              maxMarks: null, // not stored in SchoolExamLog
              obtainedMarks: s.isAbsent ? 0 : toNum(s.marks) || 0,
              percentage: null, // can't compute without maxMarks
              grade: null
            })),
            syncedAt: Date.now()
          },
          {
            tenantId,
            studentId,
            examId: examLogId,
            performanceType: 'SCHOOL_EXAM',
            academicYear: resolvedYear
          }
        );

        await recomputeSummary(tenantId, studentId, resolvedYear, profile);
      } catch (innerErr) {
        console.error(`[PerfSync] syncOnSchoolExamUpload student ${r.studentId} error:`, innerErr?.message);
      }
    }
  } catch (err) {
    console.error('[PerfSync] syncOnSchoolExamUpload error:', err?.message || err);
  }
};

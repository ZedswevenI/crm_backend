import mongoose from 'mongoose';
import StudentPerformance from '../models/studentperformance.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import AssignmentResult from '../models/assignmentResult.model.js';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExam from '../models/mockExam.model.js';
import SchoolExamLog from '../models/schoolexam.model.js';
import Subject from '../models/subject.model.js';
import Batch from '../models/batch.model.js';

const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (v) => (v != null ? Math.round(v * 100) / 100 : null);

const WEIGHTS = { assignment: 0.4, mock: 0.3, school: 0.3 };

export const resolveAcademicYear = (profile, classNo) => {
  if (!profile) return null;
  if (classNo != null) {
    const matches = (profile.ayHistory || []).filter((h) => h.classNo === classNo);
    if (matches.length) {
      matches.sort((a, b) => (b.changedOn || 0) - (a.changedOn || 0));
      if (matches[0].academicYear) return matches[0].academicYear;
    }
    if (profile.classNo === classNo) {
      return profile.currentAcademicYear || profile.academicYear || null;
    }
    return null;
  }
  return profile.currentAcademicYear || profile.academicYear || null;
};

const computeCombined = (assignPct, mockPct, schoolPct) => {
  const parts = [assignPct != null ? { v: assignPct, w: WEIGHTS.assignment } : null, mockPct != null ? { v: mockPct, w: WEIGHTS.mock } : null, schoolPct != null ? { v: schoolPct, w: WEIGHTS.school } : null].filter(Boolean);
  if (!parts.length) return null;
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  return round2(parts.reduce((s, p) => s + p.v * p.w, 0) / totalW);
};

const upsert = (filter, setDoc, setOnInsert) => StudentPerformance.findOneAndUpdate({ ...filter, isdeleted: false }, { $set: setDoc, $setOnInsert: { ...setOnInsert, isdeleted: false } }, { upsert: true, new: true });

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

export const syncOnAssignmentSubmit = async ({ tenantId, admissionNo, studentId, batchId, subjectId }) => {
  try {
    if (!tenantId || !admissionNo) return;
    const batch = await Batch.findOne({ tenantId, batchId, isdeleted: false }, { academicYear: 1, batchCode: 1, programId: 1, centerId: 1 }).lean();
    if (!batch?.academicYear) {
      console.error(`[PerfSync] syncOnAssignmentSubmit skipped: no Batch/academicYear for tenantId=${tenantId} admissionNo=${admissionNo} batchId=${batchId}`);
      return;
    }
    const academicYear = batch.academicYear;
    const profile = await StudentProfile.findOne({ tenantId, admissionNo, isdeleted: false }, { studentId: 1, admissionNo: 1, batchId: 1, batchCode: 1, programId: 1, centerId: 1, academicYear: 1, currentAcademicYear: 1, classNo: 1, ayHistory: 1 }).lean();
    const resolvedStudentId = studentId || profile?.studentId;
    if (!resolvedStudentId) return;
    const subjectObjId = mongoose.Types.ObjectId.isValid(String(subjectId || '')) ? new mongoose.Types.ObjectId(String(subjectId)) : subjectId;
    const allResults = await AssignmentResult.find({ tenantId, admissionNo, subjectId: subjectObjId, isdeleted: false, status: 'completed' }, { obtainedMarks: 1, totalMarks: 1, cgpa: 1, numberOfReattempts: 1, batchId: 1, classNo: 1 }).lean();
    if (!allResults.length) return;
    const resultBatchIds = [...new Set(allResults.map((r) => r.batchId).filter(Boolean))];
    const resultBatches = resultBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: resultBatchIds }, isdeleted: false }, { batchId: 1, academicYear: 1 }).lean() : [];
    const batchYearMap = new Map(resultBatches.map((b) => [b.batchId, b.academicYear]));
    const results = allResults.filter((r) => {
      const resultYear = (r.batchId && batchYearMap.get(r.batchId)) || resolveAcademicYear(profile, r.classNo);
      return resultYear === academicYear;
    });
    if (!results.length) return;
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
    let subjectName = null;
    if (mongoose.Types.ObjectId.isValid(String(subjectId || ''))) {
      const subDoc = await Subject.findOne({ _id: subjectObjId }, { subjectName: 1 }).lean();
      subjectName = subDoc?.subjectName || null;
    }
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
    await recomputeSummary(tenantId, resolvedStudentId, academicYear, profile || { admissionNo, batchId, batchCode: batch?.batchCode });
  } catch (err) {
    console.error('[PerfSync] syncOnAssignmentSubmit error:', err?.message || err);
  }
};

export const syncOnMockPublish = async ({ tenantId, examId }) => {
  try {
    if (!tenantId || !examId) return;
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { examName: 1, sections: 1, classNo: 1 }).lean();
    if (!exam) return;
    const results = await MockExamResult.find({ tenantId, examId, isdeleted: false }, { admissionNo: 1, studentId: 1, batchId: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, sectionResults: 1 }).lean();
    if (!results.length) return;
    const resultBatchIds = [...new Set(results.map((r) => r.batchId).filter(Boolean))];
    const resultBatches = resultBatchIds.length ? await Batch.find({ tenantId, batchId: { $in: resultBatchIds }, isdeleted: false }, { batchId: 1, academicYear: 1 }).lean() : [];
    const batchYearMap = new Map(resultBatches.map((b) => [b.batchId, b.academicYear]));
    const allSubIds = results.flatMap((r) => (r.sectionResults || []).map((s) => s.subjectId?.toString()).filter(Boolean));
    const uniqSubs = [...new Set(allSubIds)].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const subDocs = await Subject.find({ _id: { $in: uniqSubs } }, { subjectName: 1 }).lean();
    const subNames = new Map(subDocs.map((s) => [s._id.toString(), s.subjectName]));
    const admissionNos = [...new Set(results.map((r) => r.admissionNo).filter(Boolean))];
    const profiles = await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, studentId: 1, batchId: 1, batchCode: 1, programId: 1, centerId: 1, academicYear: 1, currentAcademicYear: 1, classNo: 1, ayHistory: 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [p.admissionNo, p]));
    for (const r of results) {
      try {
        const profile = profileMap.get(r.admissionNo) || null;
        const studentId = r.studentId || profile?.studentId;
        const viaBatch = r.batchId ? batchYearMap.get(r.batchId) : undefined;
        const academicYear = viaBatch || resolveAcademicYear(profile, exam.classNo);
        if (!studentId || !academicYear) {
          console.error(`[PerfSync] syncOnMockPublish skipped student: tenantId=${tenantId} examId=${examId} admissionNo=${r.admissionNo} studentId=${studentId || 'null'} reason=${!studentId ? 'no studentId' : 'unresolvable academicYear'}`);
          continue;
        }
        const pct = r.totalMarks > 0 ? round2((r.obtainedMarks / r.totalMarks) * 100) : null;
        await upsert(
          { tenantId, studentId, examId, academicYear, performanceType: 'MOCK_EXAM' },
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

export const syncOnSchoolExamUpload = async ({ tenantId, examLogId, academicYear }) => {
  try {
    if (!tenantId || !examLogId) return;
    const examLog = await SchoolExamLog.findOne({ tenantId, examLogId, isdeleted: false }).lean();
    if (!examLog) return;
    const matchedResults = (examLog.results || []).filter((r) => r.isMatched && r.studentId);
    if (!matchedResults.length) return;
    const studentIds = matchedResults.map((r) => r.studentId).filter(Boolean);
    const profiles = await StudentProfile.find({ tenantId, studentId: { $in: studentIds }, isdeleted: false }, { studentId: 1, admissionNo: 1, batchId: 1, batchCode: 1, programId: 1, centerId: 1, academicYear: 1, currentAcademicYear: 1, classNo: 1, ayHistory: 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [p.studentId, p]));

    for (const r of matchedResults) {
      try {
        const profile = profileMap.get(r.studentId) || null;
        const studentId = r.studentId;
        const resolvedYear = resolveAcademicYear(profile, r.classNo ?? examLog.classNo) || academicYear || examLog.academicYear || null;
        if (!resolvedYear) {
          console.error(`[PerfSync] syncOnSchoolExamUpload skipped student: tenantId=${tenantId} examLogId=${examLogId} studentId=${studentId} admissionNo=${r.admissionNo} reason=unresolvable academicYear`);
          continue;
        }
        const subjectsWithMax = (r.subjects || []).filter((s) => s.marks != null && !s.isAbsent);
        const totalObtained = subjectsWithMax.reduce((s, sub) => s + (toNum(sub.marks) || 0), 0);
        const hasMaxMarks = (r.subjects || []).some((s) => s.maxMarks != null);
        const totalMaxFromSubjects = hasMaxMarks ? subjectsWithMax.reduce((s, sub) => s + (toNum(sub.maxMarks) || 0), 0) : null;
        const totalMax = totalMaxFromSubjects || toNum(r.totalMarks) || null;
        const pct = totalMax > 0 ? round2((totalObtained / totalMax) * 100) : null;
        await upsert(
          { tenantId, studentId, examId: examLogId, academicYear: resolvedYear, performanceType: 'SCHOOL_EXAM' },
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
            subjects: (r.subjects || []).map((s) => {
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

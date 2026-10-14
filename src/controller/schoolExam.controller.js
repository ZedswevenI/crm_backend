import SchoolExamLog from '../models/schoolexam.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import { syncOnSchoolExamUpload, getSchoolExamSubjectStatsMap } from '../helpers/performanceSync.helper.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : null;
};
const pickTid = (req) => safeTrim(req.body?.entiId || req.body?.tenantId);
const pickUid = (req) => safeTrim(req.body?.userId || req.user?.userId);

const parseMarks = (val) => {
  if (val === null || val === undefined || val === '') return { marks: null, isAbsent: false };
  const s = safeTrim(String(val)).toUpperCase();
  if (s === 'AB' || s === 'ABS' || s === 'ABSENT' || s === '-') return { marks: null, isAbsent: true };
  const n = toNum(val);
  return { marks: n, isAbsent: false };
};

const uploadExamMarks = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examName = safeTrim(req.body?.examName);
    const examDate = req.body?.examDate ? Number(req.body.examDate) : null;
    const batchCode = safeTrim(req.body?.batchCode) || null;
    const batchId = safeTrim(req.body?.batchId) || null;
    const centerId = safeTrim(req.body?.centerId) || null;
    const academicYear = safeTrim(req.body?.academicYear) || null;
    const rows = Array.isArray(req.body?.data) ? req.body.data : [];
    // Set once per exam (not repeated per student row) — e.g. Physics: 100. Can be sent alongside the
    // first marks upload, as a standalone follow-up call to backfill an existing exam, or both.
    const subjectMaxMarksInput = Array.isArray(req.body?.subjectMaxMarks) ? req.body.subjectMaxMarks : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examName) return res.status(400).json({ status: false, message: 'examName is required' });
    if (!rows.length && !subjectMaxMarksInput.length) {
      return res.status(400).json({ status: false, message: 'data[] or subjectMaxMarks[] is required' });
    }
    const admissionNos = rows.map((r) => safeTrim(r.admissionNo)).filter(Boolean);
    if (rows.length && !admissionNos.length) {
      return res.status(400).json({ status: false, message: 'No valid admissionNo found in data rows' });
    }
    const profiles = admissionNos.length ? await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, studentId: 1, studentSchoolId: 1, 'student.name': 1, batchCode: 1, batchId: 1, centerId: 1, classNo: 1 }).lean() : [];
    const profileMap = new Map(profiles.map((p) => [safeTrim(p.admissionNo), p]));

    const firstProfile = profiles[0] || null;
    const resolvedBatchCode = batchCode || firstProfile?.batchCode || null;
    const resolvedBatchId = batchId || firstProfile?.batchId || null;
    const resolvedCenterId = centerId || firstProfile?.centerId || null;
    const resolvedClassNo = rows[0]?.classNo ? Number(rows[0].classNo) || null : null;

    const existingDoc = await SchoolExamLog.findOne({
      tenantId,
      examName,
      examDate,
      batchCode: resolvedBatchCode,
      isdeleted: false
    }).lean();

    // Merge exam-level subject max marks: existing values, overwritten by any this call supplies.
    const maxMarksMap = new Map((existingDoc?.subjectMaxMarks || []).map((s) => [safeTrim(s.subjectName), toNum(s.maxMarks)]));
    subjectMaxMarksInput.forEach((s) => {
      const name = safeTrim(s.subjectName);
      if (name && s.maxMarks != null) maxMarksMap.set(name, toNum(s.maxMarks));
    });
    const mergedSubjectMaxMarks = Array.from(maxMarksMap.entries())
      .filter(([name]) => name)
      .map(([subjectName, maxMarks]) => ({ subjectName, maxMarks }));

    const updateOps = [];
    for (const row of rows) {
      const admNo = safeTrim(row.admissionNo);
      const excelSchoolId = safeTrim(row.studentSchoolId);
      if (!admNo || !excelSchoolId) {
        continue;
      }
      const profile = profileMap.get(admNo);
      if (!profile) {
        continue;
      }
      if (!safeTrim(profile.studentSchoolId)) {
        updateOps.push({
          updateOne: {
            filter: { tenantId, admissionNo: admNo, isdeleted: false },
            update: { $set: { studentSchoolId: excelSchoolId, updatedBy: userId || null } }
          }
        });
        profile.studentSchoolId = excelSchoolId;
      }
    }
    console.log(`Total updateOps: ${updateOps.length}`);
    if (updateOps.length) {
      await StudentProfile.bulkWrite(updateOps, { ordered: false });
    }
    const warnings = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    const subjectNamesSet = new Set();
    const incomingMap = new Map();
    for (const row of rows) {
      const admissionNo = safeTrim(row.admissionNo) || null;
      const studentName = safeTrim(row.studentName) || null;
      const classNo = row.classNo ? Number(row.classNo) || null : null;
      const excelTotal = row.totalMarks != null ? toNum(row.totalMarks) : null;
      const excelSchoolId = safeTrim(row.studentSchoolId) || null;
      const profile = admissionNo ? profileMap.get(admissionNo) || null : null;
      const isMatched = !!profile;
      if (!isMatched && admissionNo) {
        warnings.push({ admissionNo, message: 'Student not found in profile — logged without studentId' });
        unmatchedCount++;
      } else if (isMatched) {
        matchedCount++;
      }
      const subjects = Array.isArray(row.subjects)
        ? row.subjects.map((s) => {
            subjectNamesSet.add(safeTrim(s.subjectName));
            const subjectName = safeTrim(s.subjectName);
            return {
              subjectName,
              marks: s.isAbsent ? null : s.marks != null ? toNum(s.marks) : null,
              // Per-row value wins if given; otherwise resolved from the exam-level subjectMaxMarks set above.
              maxMarks: s.maxMarks != null ? toNum(s.maxMarks) : (maxMarksMap.get(subjectName) ?? null),
              isAbsent: !!s.isAbsent
            };
          })
        : [];
      const autoTotal = subjects.reduce((sum, s) => sum + (s.marks ?? 0), 0);
      const totalMarks = excelTotal !== null ? excelTotal : autoTotal;
      const resolvedSchoolId = safeTrim(profile?.studentSchoolId) || excelSchoolId || null;
      incomingMap.set(admissionNo, {
        admissionNo,
        studentId: profile ? safeTrim(profile.studentId) : null,
        studentSchoolId: resolvedSchoolId,
        studentName: studentName || profile?.student?.name || null,
        classNo: classNo || profile?.classNo || null,
        subjects,
        totalMarks,
        isMatched
      });
    }
    const existingSubjectNames = existingDoc?.subjectNames || [];

    const mergedSubjectNames = Array.from(new Set([...existingSubjectNames, ...Array.from(subjectNamesSet)])).filter(Boolean);
    let mergedResults = [];
    if (existingDoc?.results?.length) {
      mergedResults = existingDoc.results.map((existing) => {
        const admNo = safeTrim(existing.admissionNo);
        if (incomingMap.has(admNo)) {
          const updated = incomingMap.get(admNo);
          incomingMap.delete(admNo);
          return updated;
        }
        return existing;
      });
      for (const [, newRow] of incomingMap) {
        mergedResults.push(newRow);
      }
    } else {
      mergedResults = Array.from(incomingMap.values());
    }
    const finalMatched = mergedResults.filter((r) => r.isMatched).length;
    const finalUnmatched = mergedResults.filter((r) => !r.isMatched).length;
    const doc = await SchoolExamLog.findOneAndUpdate(
      { tenantId, examName, examDate, batchCode: resolvedBatchCode, isdeleted: false },
      {
        $set: {
          examName,
          examDate,
          batchCode: resolvedBatchCode,
          batchId: resolvedBatchId,
          centerId: resolvedCenterId,
          classNo: resolvedClassNo,
          academicYear,
          subjectNames: mergedSubjectNames,
          subjectMaxMarks: mergedSubjectMaxMarks,
          results: mergedResults,
          totalStudents: mergedResults.length,
          matchedCount: finalMatched,
          unmatchedCount: finalUnmatched,
          uploadedBy: userId || null,
          uploadedAt: Date.now(),
          updatedBy: userId || null
        },
        $setOnInsert: { createdBy: userId || null }
      },
      { new: true, upsert: true }
    );
    syncOnSchoolExamUpload({ tenantId, examLogId: doc.examLogId, academicYear }).catch((e) => console.error('[SchoolExam] syncOnSchoolExamUpload failed:', e?.message));
    return res.status(200).json({
      status: true,
      message: 'Exam marks imported successfully',
      data: {
        examLogId: doc.examLogId,
        examName: doc.examName,
        examDate: doc.examDate,
        batchCode: doc.batchCode,
        totalStudents: doc.totalStudents,
        matchedCount: doc.matchedCount,
        unmatchedCount: doc.unmatchedCount,
        subjectNames: doc.subjectNames,
        subjectMaxMarks: doc.subjectMaxMarks,
        profilesUpdated: updateOps.length
      },
      warnings: warnings.length ? warnings : undefined
    });
  } catch (err) {
    return next(err);
  }
};

const listExams = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const page = Math.max(parseInt(req.body?.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.body?.limit || '20', 10), 1), 100);
    const skip = (page - 1) * limit;
    const query = { tenantId, isdeleted: false };
    if (req.body?.examLogId) {
      query.examLogId = safeTrim(req.body.examLogId);
      const doc = await SchoolExamLog.findOne(query).lean();
      if (!doc) return res.status(404).json({ status: false, message: 'Exam not found' });
      return res.status(200).json({ status: true, data: doc });
    }
    if (req.body?.batchCode) query.batchCode = safeTrim(req.body.batchCode);
    if (req.body?.centerId) query.centerId = safeTrim(req.body.centerId);
    if (req.body?.academicYear) query.academicYear = safeTrim(req.body.academicYear);
    if (req.body?.classNo) query.classNo = Number(req.body.classNo);
    if (req.body?.examName) query.examName = { $regex: safeTrim(req.body.examName), $options: 'i' };
    const [rows, count] = await Promise.all([
      SchoolExamLog.find(query, {
        examLogId: 1,
        examName: 1,
        examDate: 1,
        batchCode: 1,
        centerId: 1,
        classNo: 1,
        academicYear: 1,
        subjectNames: 1,
        subjectMaxMarks: 1,
        totalStudents: 1,
        matchedCount: 1,
        unmatchedCount: 1,
        uploadedAt: 1,
        uploadedBy: 1
      })
        .sort({ examDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SchoolExamLog.countDocuments(query)
    ]);

    return res.status(200).json({ status: true, data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const viewExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examLogId = safeTrim(req.body?.examLogId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examLogId) return res.status(400).json({ status: false, message: 'examLogId is required' });
    const doc = await SchoolExamLog.findOne({ tenantId, examLogId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Exam log not found' });
    return res.status(200).json({ status: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

// Per-subject batch average/highest for one exam log — the school-exam equivalent of mock exam's
// batch-subject-stats. Delegates to the shared helper so this standalone endpoint and the embedded
// version in the student-facing performance reads never drift apart.
const getBatchSubjectStats = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examLogId = safeTrim(req.body?.examLogId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examLogId) return res.status(400).json({ status: false, message: 'examLogId is required' });
    const exists = await SchoolExamLog.exists({ tenantId, examLogId, isdeleted: false });
    if (!exists) return res.status(404).json({ status: false, message: 'Exam log not found' });
    const statsMap = await getSchoolExamSubjectStatsMap(tenantId, examLogId);
    const data = Array.from(statsMap.entries()).map(([subjectName, stats]) => ({ subjectName, ...stats }));
    return res.status(200).json({ status: true, examLogId, data });
  } catch (err) {
    return next(err);
  }
};

const deleteExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examLogId = safeTrim(req.body?.examLogId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examLogId) return res.status(400).json({ status: false, message: 'examLogId is required' });
    const doc = await SchoolExamLog.findOneAndUpdate({ tenantId, examLogId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Exam log not found' });
    return res.status(200).json({ status: true, message: 'Exam log deleted' });
  } catch (err) {
    return next(err);
  }
};

const listByStudent = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const studentId = safeTrim(req.body?.studentId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!admissionNo && !studentId) return res.status(400).json({ status: false, message: 'admissionNo or studentId is required' });
    const query = { tenantId, isdeleted: false };
    if (req.body?.academicYear) query.academicYear = safeTrim(req.body.academicYear);
    if (req.body?.batchCode) query.batchCode = safeTrim(req.body.batchCode);
    if (studentId) query['results.studentId'] = studentId;
    else query['results.admissionNo'] = admissionNo;
    const exams = await SchoolExamLog.find(query, {
      examLogId: 1,
      examName: 1,
      examDate: 1,
      batchCode: 1,
      academicYear: 1,
      classNo: 1,
      subjectNames: 1,
      results: 1
    })
      .sort({ examDate: -1 })
      .lean();
    const data = exams.map((e) => {
      const result = (e.results || []).find((r) => (studentId ? r.studentId === studentId : r.admissionNo === admissionNo));
      return {
        examLogId: e.examLogId,
        examName: e.examName,
        examDate: e.examDate,
        batchCode: e.batchCode,
        academicYear: e.academicYear,
        classNo: e.classNo,
        subjectNames: e.subjectNames,
        result: result || null
      };
    });

    return res.status(200).json({ status: true, data, count: data.length });
  } catch (err) {
    return next(err);
  }
};

export default { uploadExamMarks, listExams, viewExam, deleteExam, listByStudent, getBatchSubjectStats };

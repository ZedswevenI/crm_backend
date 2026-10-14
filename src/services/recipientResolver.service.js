import StudentProfile from '../models/studentProfile.model.js';

const safeTrim = (v) => (v === null || v === undefined ? '' : String(v).trim());
const toNumOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const isValidEmail = (email) => /.+@.+\..+/.test(String(email || '').trim());

export const buildStudentQuery = ({ tenantId, filters = {} }) => {
  const query = {
    tenantId,
    isdeleted: false,
    status: 'ACTIVE'
  };
  const classNo = toNumOrNull(filters.classNo);
  if (classNo !== null) query.classNo = classNo;
  if (safeTrim(filters.studentId)) query.studentId = safeTrim(filters.studentId);
  if (safeTrim(filters.admissionNo)) query.admissionNo = safeTrim(filters.admissionNo);
  const batchIds = Array.isArray(filters.batchIds) ? filters.batchIds.map(safeTrim).filter(Boolean) : [];
  const batchCodes = Array.isArray(filters.batchCodes) ? filters.batchCodes.map(safeTrim).filter(Boolean) : [];
  if (batchIds.length && batchCodes.length) query.$or = [{ batchId: { $in: batchIds } }, { batchCode: { $in: batchCodes } }];
  else if (batchIds.length) query.batchId = { $in: batchIds };
  else if (batchCodes.length) query.batchCode = { $in: batchCodes };
  else if (safeTrim(filters.batchId)) query.batchId = safeTrim(filters.batchId);
  else if (safeTrim(filters.batchCode)) query.batchCode = safeTrim(filters.batchCode);
  if (safeTrim(filters.centerId)) query.centerId = safeTrim(filters.centerId);
  if (safeTrim(filters.centerCode)) query.centerCode = safeTrim(filters.centerCode);
  if (safeTrim(filters.programId)) query.programId = safeTrim(filters.programId);
  if (safeTrim(filters.programCode)) query.programCode = safeTrim(filters.programCode);
  if (safeTrim(filters.academicYear)) query.academicYear = safeTrim(filters.academicYear);
  if (safeTrim(filters.currentAcademicYear)) query.currentAcademicYear = safeTrim(filters.currentAcademicYear);
  return query;
};

export const resolveStudentRecipients = async ({ tenantId, filters = {} }) => {
  const query = buildStudentQuery({ tenantId, filters });
  const rows = await StudentProfile.find(query, {
    _id: 0,
    studentId: 1,
    admissionNo: 1,
    academicYear: 1,
    currentAcademicYear: 1,
    classNo: 1,
    batchId: 1,
    batchCode: 1,
    centerId: 1,
    centerCode: 1,
    centerName: 1,
    programId: 1,
    programCode: 1,
    programName: 1,
    'student.name': 1,
    'student.email': 1,
    'student.phone': 1,
    'student.parentName': 1
  })
    .sort({ batchCode: 1, admissionNo: 1 })
    .lean();
  const recipients = rows.map((s) => {
    const email = safeTrim(s?.student?.email).toLowerCase();
    return {
      studentId: safeTrim(s.studentId),
      admissionNo: safeTrim(s.admissionNo),
      studentName: safeTrim(s?.student?.name),
      studentPhone: safeTrim(s?.student?.phone),
      parentName: safeTrim(s?.student?.parentName),
      recipientEmail: email,
      hasValidEmail: isValidEmail(email),
      classNo: s.classNo ?? null,
      batchId: safeTrim(s.batchId),
      batchCode: safeTrim(s.batchCode),
      centerId: safeTrim(s.centerId),
      centerCode: safeTrim(s.centerCode),
      centerName: safeTrim(s.centerName),
      programId: safeTrim(s.programId),
      programCode: safeTrim(s.programCode),
      programName: safeTrim(s.programName),
      academicYear: safeTrim(s.academicYear),
      currentAcademicYear: safeTrim(s.currentAcademicYear)
    };
  });
  return {
    totalRecipients: recipients.length,
    validEmailCount: recipients.filter((r) => r.hasValidEmail).length,
    missingEmailCount: recipients.filter((r) => !r.hasValidEmail).length,
    recipients
  };
};

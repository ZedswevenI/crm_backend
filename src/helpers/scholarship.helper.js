const safeTrim = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Accepts epoch ms, "YYYY-MM-DD", or "DD-MM-YYYY" (the two shapes the external portal sends
// across its single-record and bulk endpoints), falls back to native Date parsing.
export const toEpochOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v > 0 ? v : 0;
  const n = Number(String(v).trim());
  if (Number.isFinite(n) && String(v).trim().match(/^\d+$/)) return n;
  const s = safeTrim(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const dd = Number(m[3]);
    return new Date(yyyy, mm, dd, 0, 0, 0, 0).getTime();
  }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const yyyy = Number(m[3]);
    return new Date(yyyy, mm, dd, 0, 0, 0, 0).getTime();
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();
  return null;
};

// Maps one external-portal scholarship record (single-record or bulk shape — both use the same
// field names) onto a ScholarshipTest document body. Shared by the on-demand lookup
// (fetchScholarshipRegistration) and the nightly bulk sync so the mapping never drifts apart.
export const mapScholarshipRecord = (tenantId, d) => ({
  tenantId,
  registrationNumber: safeTrim(d.registrationNumber),
  studentId: safeTrim(d.studentId) || null,
  firstName: safeTrim(d.firstName) || null,
  lastName: safeTrim(d.lastName) || null,
  name: safeTrim(d.name) || null,
  email: safeTrim(d.email) ? safeTrim(d.email).toLowerCase() : null,
  mobileNo: safeTrim(d.mobileNo) || null,
  dateOfBirth: toEpochOrNull(d.dateOfBirth),
  gender: safeTrim(d.gender) || null,
  fatherName: safeTrim(d.fatherName) || null,
  motherName: safeTrim(d.motherName) || null,
  address: safeTrim(d.address) || null,
  city: safeTrim(d.city) || null,
  state: safeTrim(d.state) || null,
  pincode: safeTrim(d.pincode) || null,
  schoolName: safeTrim(d.schoolName) || null,
  className: safeTrim(d.className) || null,
  testDate: toEpochOrNull(d.testDate),
  testCity: safeTrim(d.testCity) || null,
  testCentre: safeTrim(d.testCentre) || null,
  testName: safeTrim(d.testName) || null,
  centerCode: safeTrim(d.centerCode) || null,
  programName: safeTrim(d.programName) || null,
  programCode: safeTrim(d.programCode) || null,
  paper1Total: safeTrim(d.paper1Total) || null,
  paper2Total: safeTrim(d.paper2Total) || null,
  gtotal: safeTrim(d.gtotal) || null,
  normalizedScore: d.normalizedScore ?? null,
  normalizedPercentage: d.normalizedPercentage ?? null,
  normalizedRank: d.normalizedRank ?? null,
  resultCategory: safeTrim(d.resultCategory) || null,
  testResultStatus: safeTrim(d.status) || null,
  selection: safeTrim(d.selection) || null,
  selectionStatus: safeTrim(d.selectionStatus) || null,
  programOffered1: safeTrim(d.programOffered1) || null,
  programOffered2: safeTrim(d.programOffered2) || null,
  waiverPerInTf: d.waiverPerInTf === null || d.waiverPerInTf === undefined ? null : Number(d.waiverPerInTf),
  studyCentre: safeTrim(d.studyCentre) || null
});

// Fields that count toward the "did this record actually change" diff — excludes
// bookkeeping fields (lastSyncAt/lastSyncStatus/raw/updatedBy) that would make every record
// look "changed" every single night regardless of the underlying data.
const DIFF_FIELDS = [
  'studentId', 'firstName', 'lastName', 'name', 'email', 'mobileNo', 'dateOfBirth', 'gender',
  'fatherName', 'motherName', 'address', 'city', 'state', 'pincode', 'schoolName', 'className',
  'testDate', 'testCity', 'testCentre', 'testName', 'centerCode', 'programName', 'programCode',
  'paper1Total', 'paper2Total', 'gtotal', 'normalizedScore', 'normalizedPercentage', 'normalizedRank',
  'resultCategory', 'testResultStatus', 'selection', 'selectionStatus', 'programOffered1',
  'programOffered2', 'waiverPerInTf', 'studyCentre'
];

export const hasScholarshipRecordChanged = (existingDoc, mapped) => {
  if (!existingDoc) return true;
  return DIFF_FIELDS.some((f) => (existingDoc[f] ?? null) !== (mapped[f] ?? null));
};

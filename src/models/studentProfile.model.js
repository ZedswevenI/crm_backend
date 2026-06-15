import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const ayHistorySchema = new mongoose.Schema(
  {
    academicYear: { type: String, trim: true, default: null },
    yearNo: { type: Number, default: null },
    classNo: { type: Number, default: null },
    startOn: { type: Number, default: null },
    endOn: { type: Number, default: null },
    programId: { type: String, default: null, trim: true },
    changedOn: { type: Number, default: () => Date.now() },
    changedBy: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const boardExamSchema = new mongoose.Schema(
  {
    boardExamName: { type: String, trim: true, default: null },
    schoolId: { type: String, trim: true, default: null },
    s1: { type: Number, default: null },
    s2: { type: Number, default: null },
    s3: { type: Number, default: null },
    s4: { type: Number, default: null },
    s5: { type: Number, default: null },
    s6: { type: Number, default: null },
    s7: { type: Number, default: null },
    total: { type: Number, default: null },
    importedAt: { type: Number, default: () => Date.now() }
  },
  { _id: false }
);

const StudentProfileSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, default: uuid, index: true },
    admissionId: { type: String, required: true, ref: 'admission', index: true },
    admissionNo: { type: String, required: true, index: true },
    registrationNumber: { type: String, trim: true, index: true },
    portalStudentId: { type: String, trim: true, index: true },
    studentSchoolId: { type: String, trim: true, default: null, index: true },
    photoUrl: { type: String, default: null, trim: true },
    isTabletBlocked: { type: Boolean, default: false },
    student: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: false, trim: true },
      phone1: { type: String, trim: true, default: null },
      phone2: { type: String, trim: true, default: null },
      email: { type: String, trim: false },
      email1: { type: String, trim: true, default: null },
      email2: { type: String, trim: true, default: null },
      parentName: { type: String, required: false, trim: true },
      parentPhone: { type: String, required: false, trim: true, default: null },
      address: { type: String, trim: false, default: null },
      city: { type: String, trim: false, default: null },
      state: { type: String, trim: false, default: null },
      pincode: { type: String, trim: false, default: null }
    },
    academicYear: { type: String, required: true, trim: true, index: true },
    programId: { type: String, required: true, ref: 'program', trim: true, index: true },
    programCode: { type: String, trim: true },
    programName: { type: String, trim: true },
    centerId: { type: String, required: true, trim: true, ref: 'center', index: true },
    centerCode: { type: String, trim: true },
    centerName: { type: String, trim: true },
    batchId: { type: String, trim: true, index: true, ref: 'batch', default: null },
    batchCode: { type: String, trim: true, default: null },
    courseStartYear: { type: Number, required: false, default: null, index: true },
    currentAcademicYear: { type: String, required: false, trim: true, default: null, index: true },
    yearNo: { type: Number, required: false, default: 1 },
    classNo: { type: Number, required: false, default: null },
    ayHistory: { type: [ayHistorySchema], required: false, default: [] },
    boardExams: { type: [boardExamSchema], default: [] },
    studentRpa: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    },
    batchRemovalRemarks: { type: String, default: null, trim: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: null, ref: 'user' },
    updatedBy: { type: String, trim: true, default: null, ref: 'user' }
  },
  { timestamps: true }
);

StudentProfileSchema.index({ tenantId: 1, admissionNo: 1 }, { unique: true });
StudentProfileSchema.index({ tenantId: 1, registrationNumber: 1 });
StudentProfileSchema.index({ tenantId: 1, studentRpa: 1 });
StudentProfileSchema.index({ tenantId: 1, studentSchoolId: 1 });

const StudentProfile = mongoose.model('studentprofile', StudentProfileSchema);
export default StudentProfile;

import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const StudentProfileSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, default: uuid, index: true },
    admissionId: { type: String, required: true, ref: 'admission', index: true },
    admissionNo: { type: String, required: true, index: true },
    registrationNumber: { type: String, trim: true, index: true },
    portalStudentId: { type: String, trim: true, index: true },
    student: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true },
      parentName: { type: String, required: true, trim: true },
      parentPhone: { type: String, required: true, trim: true },
      address: { type: String, trim: true, default: null },
      city: { type: String, trim: true, default: null },
      state: { type: String, trim: true, default: null },
      pincode: { type: String, trim: true, default: null }
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
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: null, ref: 'user' },
    updatedBy: { type: String, trim: true, default: null, ref: 'user' }
  },
  { timestamps: true }
);

StudentProfileSchema.index({ tenantId: 1, admissionNo: 1 }, { unique: true });
StudentProfileSchema.index({ tenantId: 1, registrationNumber: 1 });

const StudentProfile = mongoose.model('studentprofile', StudentProfileSchema);
export default StudentProfile;

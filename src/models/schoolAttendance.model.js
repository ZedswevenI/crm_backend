import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const studentAttendanceSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true },
    admissionNo: { type: String, required: true },
    status: { type: String, enum: ['PRESENT', 'ABSENT', 'LATE'], required: true },
    remarks: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const schoolAttendanceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    attendanceId: { type: String, required: true, default: uuid, index: true },
    batchId: { type: String, required: true, index: true },
    batchCode: { type: String, required: true, index: true },
    batchName: { type: String, default: null },
    section: { type: String, default: null },
    academicYear: { type: String, default: null },
    classNo: { type: Number, default: null },
    date: { type: Number, required: true, index: true },
    type: {
      type: String,
      enum: ['ATTENDANCE', 'HOLIDAY', 'WEEK_OFF', 'LEAVE'],
      default: 'ATTENDANCE',
      index: true
    },
    holidayName: { type: String, trim: true, default: null },
    markedBy: { type: String, default: null }, // staffId or userId
    markedByName: { type: String, default: null },
    markedByRole: { type: String, default: null }, // L1, L3, classTeacher
    remarks: { type: String, trim: true, default: null },
    students: { type: [studentAttendanceSchema], default: [] },
    isFinalised: { type: Boolean, default: false },
    finalisedBy: { type: String, default: null },
    finalisedByName: { type: String, default: null },
    finalisedAt: { type: Number, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

schoolAttendanceSchema.index({ tenantId: 1, batchCode: 1, date: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

const SchoolAttendance = mongoose.model('schoolattendance', schoolAttendanceSchema);
export default SchoolAttendance;

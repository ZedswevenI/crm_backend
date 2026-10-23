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

const attendanceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    attendanceId: { type: String, required: true, default: uuid, index: true },
    batchCode: { type: String, required: true, index: true },
    timetableId: { type: String, required: true, index: true },
    date: { type: Number, required: true, index: true },
    periodNo: { type: Number, required: true },
    facultyId: { type: String, required: true, index: true },
    subjectId: { type: String, required: true },
    topicTaught: { type: String, trim: true, default: null },
    feedback: { type: String, trim: true, default: null },
    students: { type: [studentAttendanceSchema], default: [] },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

attendanceSchema.index({ tenantId: 1, batchCode: 1, date: 1, periodNo: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
// Supports looking up a student's attendance across every batch they've ever been in, not just
// their current one — StudentProfile.batchCode has no history, so queries keyed on the student's
// current batch silently miss records from before a batch transfer.
attendanceSchema.index({ tenantId: 1, 'students.studentId': 1, date: 1 }, { name: 'student_attendance_lookup_idx' });

const Attendance = mongoose.model('attendance', attendanceSchema);
export default Attendance;

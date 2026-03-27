import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const BatchStaffSchema = new mongoose.Schema(
  {
    subjectId: { type: String, required: true, trim: true },
    subjectName: { type: String, trim: true },
    staffId: { type: String, required: true, trim: true },
    staffName: { type: String, trim: true }
  },
  { _id: false }
);

const BatchSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    batchId: { type: String, required: true, default: uuid, index: true },
    batchName: { type: String, required: true, trim: true, index: true },
    batchCode: { type: String, required: true, trim: true, index: true },
    academicYear: { type: String, required: true, trim: true, index: true },
    programId: { type: String, required: true, trim: true, index: true },
    programCode: { type: String, trim: true },
    programName: { type: String, trim: true },
    centerId: { type: String, required: true, trim: true, index: true },
    centerCode: { type: String, trim: true },
    centerName: { type: String, trim: true },
    startDate: { type: Number, required: true, index: true },
    endDate: { type: Number, required: true, index: true },
    programStartAy: { type: String, required: true, trim: true, index: true },
    yearNo: { type: Number, default: 0, index: true },
    classNo: { type: Number, default: 0, index: true },
    classTeacherId: { type: String, default: null },
    classTeacherName: { type: String, default: null },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'CLOSED', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    },
    staffMap: { type: [BatchStaffSchema], default: [] },
    studentCount: { type: Number, default: 0 },
    remarks: { type: String, trim: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true },
    updatedBy: { type: String, trim: true }
  },
  { timestamps: true }
);

BatchSchema.index({ tenantId: 1, academicYear: 1, batchCode: 1 }, { unique: true });

const Batch = mongoose.model('batch', BatchSchema);
export default Batch;

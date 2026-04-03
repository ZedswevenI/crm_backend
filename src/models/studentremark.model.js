import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const studentRemarkSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    remarkId: { type: String, required: true, default: uuid, index: true },
    admissionNo: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    type: { type: String, enum: ['ACADEMIC', 'BEHAVIOUR', 'ATTENDANCE', 'HEALTH', 'OTHER'], required: true },
    dateOfIncident: { type: Number, required: true }, // Epoch MS for the day of leave/late
    remark: { type: String, required: true, trim: true },
    reportedByParent: { type: Boolean, default: true },
    status: { type: String, enum: ['PENDING', 'ACKNOWLEDGED'], default: 'PENDING' },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

const studentremark = mongoose.model('studentremark', studentRemarkSchema);
export default studentremark;

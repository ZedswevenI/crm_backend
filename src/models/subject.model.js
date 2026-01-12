import mongoose from 'mongoose';

const SubjectSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, index: true },
    subjectCode: { type: String, trim: true, index: true },
    subjectName: { type: String, required: true, trim: true, index: true },
    category: { type: String, enum: ['academic', 'aptitude', 'language', 'other'], default: 'academic' },
    isActive: { type: Boolean, default: true, index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

SubjectSchema.index({ tenantId: 1, subjectName: 1, isdeleted: 1 }, { unique: true });
SubjectSchema.index({ tenantId: 1, subjectCode: 1, isdeleted: 1 });
const Subject = mongoose.model('subject', SubjectSchema);

export default Subject;

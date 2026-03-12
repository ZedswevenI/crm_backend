import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const studyMaterialSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    materialId: { type: String, required: true, default: uuid, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    attachmentUrl: [
      {
        url: { type: String, trim: true }
      }
    ],
    classNo: { type: Number, required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true, index: true },
    topicId: { type: String, required: false, default: null, index: true },
    subTopicId: { type: String, required: false, default: null },
    batchIds: { type: [String], default: [], index: true },
    studentIds: { type: [String], default: [], index: true },
    availableFrom: { type: Number, required: false, default: null },
    availableUntil: { type: Number, required: false, default: null },
    status: { type: String, enum: ['Active', 'Inactive', 'Draft'], default: 'Active', index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

studyMaterialSchema.index({ tenantId: 1, classNo: 1, subjectId: 1, isdeleted: 1, status: 1 }, { name: 'material_taxonomy_idx' });
studyMaterialSchema.pre('validate', function (next) {
  try {
    if (this.availableFrom && this.availableUntil) {
      if (this.availableFrom >= this.availableUntil) {
        const err = new Error('availableFrom date must be earlier than availableUntil date.');
        err.statusCode = 400;
        return next(err);
      }
    }
    if (Array.isArray(this.batchIds)) {
      this.batchIds = Array.from(new Set(this.batchIds.map((id) => String(id).trim()).filter(Boolean)));
    }
    if (Array.isArray(this.studentIds)) {
      this.studentIds = Array.from(new Set(this.studentIds.map((id) => String(id).trim()).filter(Boolean)));
    }
    next();
  } catch (error) {
    next(error);
  }
});

const StudyMaterial = mongoose.model('studymaterial', studyMaterialSchema);
export default StudyMaterial;

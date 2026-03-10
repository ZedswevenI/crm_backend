import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const PhaseTopicSchema = new mongoose.Schema(
  {
    topicId: { type: String, required: true, ref: 'topic' },
    topicName: { type: String, trim: true },
    estHours: { type: Number, default: null },
    sortOrder: { type: Number, default: 0 }
  },
  { _id: false }
);

const phaseSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    phaseId: { type: String, required: true, default: uuid, index: true },
    programId: { type: String, required: true, index: true },
    phaseName: { type: String, required: true, trim: true },
    classNo: { type: Number, required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'subject', index: true },
    sortOrder: { type: Number, default: 0 },
    topics: { type: [PhaseTopicSchema], default: [] },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

// UPDATED UNIQUE INDEX
phaseSchema.index({ tenantId: 1, programId: 1, classNo: 1, subjectId: 1, phaseName: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

const Phase = mongoose.model('phase', phaseSchema);
export default Phase;

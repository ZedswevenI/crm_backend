import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const topicSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    topicId: { type: String, required: true, default: uuid, index: true },

    classNo: { type: Number, required: true, min: 6, max: 13, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'subject', index: true },

    topicName: { type: String, required: true, trim: true, index: true },
    topicCode: { type: String, trim: true, default: null },
    sortOrder: { type: Number, required: false, default: 0 },

    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

topicSchema.index({ tenantId: 1, classNo: 1, subjectId: 1, topicName: 1, isdeleted: 1 }, { unique: true });
topicSchema.index({ tenantId: 1, classNo: 1, subjectId: 1, isdeleted: 1, sortOrder: 1, createdAt: 1 });

const Topic = mongoose.model('topic', topicSchema);
export default Topic;

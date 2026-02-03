import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const examCategorySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    categoryId: { type: String, required: true, default: uuid, trim: true, index: true },
    categoryName: { type: String, required: true, trim: true, index: true },
    categoryCode: { type: String, required: false, trim: true, default: null, index: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    isdeleted: { type: Boolean, required: true, default: false, index: true },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

examCategorySchema.index({ tenantId: 1, categoryName: 1, isdeleted: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
examCategorySchema.index({ tenantId: 1, categoryCode: 1, isdeleted: 1 }, { partialFilterExpression: { isdeleted: false } });

const ExamCategory = mongoose.model('examcategory', examCategorySchema);
export default ExamCategory;

import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const examSubCategorySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    subCategoryId: { type: String, required: true, default: uuid, trim: true, index: true },
    categoryId: { type: String, required: true, trim: true, index: true },
    subCategoryName: { type: String, required: true, trim: true, index: true },
    subCategoryCode: { type: String, required: false, trim: true, default: null, index: true },
    sortOrder: { type: Number, required: false, default: 0, index: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    isdeleted: { type: Boolean, required: true, default: false, index: true },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

examSubCategorySchema.index({ tenantId: 1, categoryId: 1, subCategoryName: 1, isdeleted: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
examSubCategorySchema.index({ tenantId: 1, categoryId: 1, sortOrder: 1, isdeleted: 1 });

const ExamSubCategory = mongoose.model('examsubcategory', examSubCategorySchema);
export default ExamSubCategory;

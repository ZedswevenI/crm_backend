import mongoose from 'mongoose';

const DepartmentSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, index: true },
    departmentCode: { type: String, trim: true, index: true },
    departmentName: { type: String, required: true, trim: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

DepartmentSchema.index({ tenantId: 1, departmentName: 1, isdeleted: 1 }, { unique: true });

const Department = mongoose.model('department', DepartmentSchema);

export default Department;

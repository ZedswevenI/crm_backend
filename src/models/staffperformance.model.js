import mongoose from 'mongoose';

const staffPerformanceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    performanceId: { type: String, required: true, unique: true, trim: true },
    staffId: { type: String, required: true, trim: true },
    staffCode: { type: String, default: null, trim: true },
    staffName: { type: String, default: null, trim: true },
    staffType: { type: String, default: null, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    remarks: { type: String, default: null, trim: true },
    addedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

staffPerformanceSchema.index({ tenantId: 1, staffId: 1, isdeleted: 1 });
staffPerformanceSchema.index({ tenantId: 1, performanceId: 1 });

const StaffPerformance = mongoose.model('StaffPerformance', staffPerformanceSchema);
export default StaffPerformance;

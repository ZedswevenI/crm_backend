import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const depositBatchSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    batchId: { type: String, required: true, default: uuid, trim: true, index: true },
    depositDate: { type: String, required: true, trim: true },
    bankName: { type: String, required: false, trim: true, default: null },
    paymentIds: [{ type: String, required: true, trim: true }],
    chequeCount: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'CLOSED', 'CANCELLED'], default: 'SUBMITTED' },
    remarks: { type: String, required: false, trim: true, default: null },
    createdBy: { type: String, required: false, trim: true, default: null },
    updatedBy: { type: String, required: false, trim: true, default: null },
    statusFlag: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

depositBatchSchema.index({ tenantId: 1, batchId: 1, isdeleted: 1 }, { unique: true });
depositBatchSchema.index({ tenantId: 1, depositDate: 1, isdeleted: 1 });
depositBatchSchema.index({ tenantId: 1, bankName: 1, isdeleted: 1 });
depositBatchSchema.index({ tenantId: 1, status: 1, isdeleted: 1 });

const DepositBatch = mongoose.model('depositbatch', depositBatchSchema);
export default DepositBatch;

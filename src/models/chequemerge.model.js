import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const chequeMergeSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    groupId: { type: String, required: true, default: uuid, trim: true, index: true },
    childPaymentIds: [{ type: String, required: true, trim: true }],
    masterPaymentId: { type: String, required: false, trim: true, default: null },
    totalAmount: { type: Number, required: true, default: 0 },
    remarks: { type: String, required: false, trim: true, default: null },
    status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE' },
    createdBy: { type: String, required: false, trim: true, default: null },
    updatedBy: { type: String, required: false, trim: true, default: null },
    statusFlag: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

// ---------------- Indexes ----------------
chequeMergeSchema.index({ tenantId: 1, groupId: 1, isdeleted: 1 }, { unique: true });
chequeMergeSchema.index({ tenantId: 1, masterPaymentId: 1, isdeleted: 1 });
chequeMergeSchema.index({ tenantId: 1, status: 1, isdeleted: 1 });

const ChequeMergeGroup = mongoose.model('chequemerge', chequeMergeSchema);
export default ChequeMergeGroup;

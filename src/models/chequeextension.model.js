import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const chequeExtensionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    requestId: { type: String, required: true, default: uuid, trim: true, index: true },
    paymentId: { type: String, required: true, trim: true, index: true },
    oldPlannedDepositDate: { type: Number, required: false, trim: true, default: null },
    newPlannedDepositDate: { type: Number, required: true, trim: true },
    remarks: { type: String, required: true, trim: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
    requestedBy: { type: String, required: false, trim: true, default: null },
    requestedAt: { type: Number, required: false, default: null },
    approvedBy: { type: String, required: false, trim: true, default: null },
    approvedAt: { type: Number, required: false, default: null },
    approvalRemarks: { type: String, required: false, trim: true, default: null },
    createdBy: { type: String, required: false, trim: true, default: null },
    updatedBy: { type: String, required: false, trim: true, default: null },
    statusFlag: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

// ---------------- Indexes ----------------
chequeExtensionSchema.index({ tenantId: 1, requestId: 1, isdeleted: 1 }, { unique: true });
chequeExtensionSchema.index({ tenantId: 1, paymentId: 1, isdeleted: 1 });
chequeExtensionSchema.index({ tenantId: 1, status: 1, isdeleted: 1 });
chequeExtensionSchema.index({ tenantId: 1, newPlannedDepositDate: 1, isdeleted: 1 });

const ChequeExtensionRequest = mongoose.model('chequeextension', chequeExtensionSchema);
export default ChequeExtensionRequest;

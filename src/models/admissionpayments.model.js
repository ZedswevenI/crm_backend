import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const PAYMENT_TYPES = ['NEFT', 'CHEQUE', 'OTHER'];
const PAYMENT_STATUS = ['PENDING', 'SUBMITTED', 'DEPOSITED', 'EXTENTION_REQUESTED', 'CLEARED', 'FAILED', 'CANCELLED'];
const CHEQUE_MODES = ['PDC', 'CDC'];

const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'STATUS_CHANGE', 'DEPOSIT_BATCH_ADD', 'DEPOSIT_BATCH_REMOVE', 'RECONCILE', 'REPLACE_INIT', 'REPLACED_BY', 'EXTENSION_REQUEST', 'EXTENSION_APPROVE', 'EXTENSION_REJECT', 'REMARK'];

const AuditSchema = new mongoose.Schema(
  {
    at: { type: Number, required: true, default: () => Date.now() },
    by: { type: String, required: false, default: null, ref: 'user' },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    fromStatus: { type: String, enum: PAYMENT_STATUS, required: false, default: null },
    toStatus: { type: String, enum: PAYMENT_STATUS, required: false, default: null },
    remarks: { type: String, required: false, trim: true, default: null },
    meta: { type: Object, required: false, default: null }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    paymentId: { type: String, required: true, default: uuid, trim: true },
    admissionId: { type: String, required: true, ref: 'admission', trim: true, index: true },
    admissionNo: { type: String, required: false, trim: true, default: null },
    academicYear: { type: String, required: false, trim: true, default: null },
    centerId: { type: String, required: false, trim: true, default: null },
    centerName: { type: String, required: true, trim: true },
    programId: { type: String, required: false, trim: true, default: null },
    programName: { type: String, required: true, trim: true },
    programCode: { type: String, required: false, trim: true, default: null },
    studentName: { type: String, required: true, trim: true },
    studentPhone: { type: String, required: false, trim: true, default: null },
    registrationNumber: { type: String, required: false, trim: true, default: null },
    paymentType: { type: String, enum: PAYMENT_TYPES, required: true },
    amount: { type: Number, required: true },
    remarks: { type: String, required: false, trim: true, default: null },
    status: { type: String, enum: PAYMENT_STATUS, default: 'PENDING' },
    submittedOn: { type: Number, required: false, default: null },
    depositedOn: { type: Number, required: false, default: null },
    clearedOn: { type: Number, required: false, default: null },
    failedOn: { type: Number, required: false, default: null },
    failureReason: { type: String, required: false, trim: true, default: null },
    neft: {
      utr: { type: String, required: false, trim: true, default: null },
      paidOn: { type: Number, required: false, default: null },
      bankName: { type: String, required: false, trim: true, default: null },
      branchName: { type: String, required: false, trim: true, default: null },
      referenceNote: { type: String, required: false, trim: true, default: null }
    },

    cheque: {
      sno: { type: Number, required: false, default: null },
      chequeNo: { type: String, required: false, trim: true, default: null },
      chequeDate: { type: Number, required: false, default: null },
      dueDate: { type: Number, required: false, default: null },
      favourOf: { type: String, required: false, trim: true, default: null },
      mode: { type: String, enum: CHEQUE_MODES, required: false, default: null },
      bankName: { type: String, required: false, trim: true, default: null },
      branchName: { type: String, required: false, trim: true, default: null },
      plannedDepositDate: { type: Number, required: false, default: null },
      instalmentLabel: { type: String, required: false, trim: true, default: null },
      instalmentDate: { type: Number, required: false, default: null }
    },
    other: {
      mode: { type: String, required: false, trim: true, default: null },
      refNo: { type: String, required: false, trim: true, default: null },
      paidOn: { type: Number, required: false, default: null },
      bankName: { type: String, required: false, trim: true, default: null },
      branchName: { type: String, required: false, trim: true, default: null },
      referenceNote: { type: String, required: false, trim: true, default: null }
    },
    depositBatchId: { type: String, required: false, trim: true, default: null, index: true },
    mergeGroupId: { type: String, required: false, trim: true, default: null, index: true },

    replacement: {
      replacesPaymentId: { type: String, required: false, trim: true, default: null, index: true },
      replacedByPaymentId: { type: String, required: false, trim: true, default: null, index: true },
      reason: { type: String, required: false, trim: true, default: null },
      replacedAt: { type: Number, required: false, default: null },
      replacedBy: { type: String, required: false, default: null, ref: 'user' }
    },
    audit: { type: [AuditSchema], required: false, default: [] },
    batchId: { type: String, required: false, trim: true, default: null },
    paymentCategory: { type: String, trim: true, default: 'ADMISSION' },
    categoryLabel: { type: String, trim: true, default: null },
    statusFlag: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

// ---------------- Indexes ----------------
paymentSchema.index({ tenantId: 1, paymentId: 1, isdeleted: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, admissionId: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, paymentType: 1, status: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, academicYear: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, centerId: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, programCode: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, 'cheque.dueDate': 1, status: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, 'cheque.plannedDepositDate': 1, status: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, 'replacement.replacesPaymentId': 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, 'replacement.replacedByPaymentId': 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, depositBatchId: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, mergeGroupId: 1, isdeleted: 1 });
paymentSchema.index({ tenantId: 1, paymentCategory: 1, isdeleted: 1 });

// ---------------- Validation ----------------
paymentSchema.pre('validate', function (next) {
  try {
    if (this.paymentType === 'NEFT') {
      if (!this.neft?.utr) {
        const err = new Error('NEFT UTR is required');
        err.statusCode = 400;
        return next(err);
      }
    }

    if (this.paymentType === 'CHEQUE') {
      if (!this.cheque?.chequeNo) {
        const err = new Error('Cheque number is required');
        err.statusCode = 400;
        return next(err);
      }

      // ✅ dueDate is mandatory (instalment due date)
      if (!this.cheque?.dueDate) {
        const err = new Error('Cheque due date (instalment due date) is required');
        err.statusCode = 400;
        return next(err);
      }

      if (!this.cheque?.mode) {
        const err = new Error('Cheque mode (PDC/CDC) is required');
        err.statusCode = 400;
        return next(err);
      }

      if (!this.cheque?.favourOf) {
        const err = new Error('Cheque favourOf is required');
        err.statusCode = 400;
        return next(err);
      }
    }

    next();
  } catch (e) {
    return next(e);
  }
});

const Payment = mongoose.model('payment', paymentSchema);
export default Payment;

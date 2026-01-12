import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

/**
 * Payment Ledger (per admission, multiple entries)
 * - Stores NEFT refs and Cheques (PDC/CDC) as separate payment rows
 * - Supports status flow and accounts reporting
 */

const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    paymentId: { type: String, required: true, default: uuid, trim: true },
    admissionId: { type: String, required: true, trim: true, index: true },
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
    paymentType: { type: String, enum: ['NEFT', 'CHEQUE'], required: true },
    amount: { type: Number, required: true },
    remarks: { type: String, required: false, trim: true, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'SUBMITTED', 'DEPOSITED', 'CLEARED', 'FAILED', 'CANCELLED'],
      default: 'PENDING'
    },
    submittedOn: { type: String, required: false, trim: true, default: null }, // UI date string
    depositedOn: { type: String, required: false, trim: true, default: null },
    clearedOn: { type: String, required: false, trim: true, default: null },
    failedOn: { type: String, required: false, trim: true, default: null },
    failureReason: { type: String, required: false, trim: true, default: null },
    neft: {
      utr: { type: String, required: false, trim: true, default: null },
      paidOn: { type: String, required: false, trim: true, default: null }, // date
      bankName: { type: String, required: false, trim: true, default: null },
      referenceNote: { type: String, required: false, trim: true, default: null }
    },
    cheque: {
      sno: { type: Number, required: false, default: null },
      chequeNo: { type: String, required: false, trim: true, default: null },
      chequeDate: { type: String, required: false, trim: true, default: null },
      dueDate: { type: String, required: false, trim: true, default: null },
      favourOf: { type: String, required: false, trim: true, default: null },
      mode: { type: String, enum: ['PDC', 'CDC'], required: false, default: null },
      bankName: { type: String, required: false, trim: true, default: null }
    },
    batchId: { type: String, required: false, trim: true, default: null },
    statusFlag: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
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
      if (!this.cheque?.dueDate) {
        const err = new Error('Cheque due date is required');
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

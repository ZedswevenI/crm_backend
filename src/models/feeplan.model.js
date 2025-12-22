import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const feeHeadSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    gstPercent: { type: Number, required: true, default: 0 },
    gstAmount: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },
    discountAllowed: { type: Boolean, default: false }
  },
  { _id: false }
);

/**
 * Instalment Schema
 * Used for NEFT / PDC generation
 */
const instalmentSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true }, // 1,2,3...
    label: { type: String, required: true, trim: true }, // Instalment 1
    amount: { type: Number, required: true }
  },
  { _id: false }
);

const feePlanSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    feePlanId: { type: String, required: true, default: uuid, trim: true },
    academicYear: { type: String, required: true, trim: true },
    programId: { type: String, required: true, trim: true },
    programName: { type: String, required: true, trim: true },
    programCode: { type: String, required: true, trim: true },
    feePlanName: { type: String, required: true, trim: true }, // ex: Regular Fee Plan
    currency: { type: String, default: 'INR' },
    feeHeads: { type: [feeHeadSchema], required: true, default: [] },
    instalments: { type: [instalmentSchema], required: true, default: [] },
    totalBaseFee: { type: Number, required: true },
    totalGST: { type: Number, required: true },
    totalFee: { type: Number, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  {
    timestamps: true
  }
);

// ---------------- Indexes ----------------
feePlanSchema.index({ tenantId: 1, feePlanId: 1, isdeleted: 1 }, { unique: true });
feePlanSchema.index({ tenantId: 1, academicYear: 1, programId: 1, feePlanName: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
feePlanSchema.index({ tenantId: 1, programId: 1, academicYear: 1, isdeleted: 1 });
feePlanSchema.index({ tenantId: 1, status: 1, isdeleted: 1, createdAt: -1 });

// ---------------- Validation ----------------
feePlanSchema.pre('validate', function (next) {
  try {
    if (!this.feeHeads.length) {
      return next(new Error('At least one fee head is required'));
    }
    if (!this.instalments.length) {
      return next(new Error('At least one instalment is required'));
    }
    const invalidDiscount = this.feeHeads.find((h) => h.discountAllowed && h.key !== 'TF');
    if (invalidDiscount) {
      return next(new Error('Discount can be applied only on Tuition Fee'));
    }
    let base = 0;
    let gst = 0;
    let total = 0;
    this.feeHeads.forEach((h) => {
      base += h.amount;
      gst += h.gstAmount;
      total += h.totalAmount;
    });
    this.totalBaseFee = base;
    this.totalGST = gst;
    this.totalFee = total;
    const instSum = this.instalments.reduce((s, i) => s + i.amount, 0);
    if (instSum !== total) {
      return next(new Error('Instalment total does not match total fee'));
    }
    next();
  } catch (err) {
    return next(err);
  }
});

const FeePlan = mongoose.model('fee_plan', feePlanSchema);
export default FeePlan;

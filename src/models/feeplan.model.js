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

const instalmentSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true },
    feeHead: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    instalmentDate: { type: Number, required: true, default: 0 },
    amount: { type: Number, required: true },
    mode: { type: String, required: false, trim: true, default: null },
    chequeFavour: { type: String, required: false, trim: true, default: null },
    discountApplied: { type: Boolean, required: true, default: false }
  },
  { _id: false }
);

const feePlanSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    feePlanId: { type: String, required: true, default: uuid, trim: true },
    academicYear: { type: String, required: true, trim: true },
    programCode: { type: String, required: true, trim: true },
    programId: { type: String, required: false, trim: true, default: null },
    programName: { type: String, required: false, trim: true, default: null },
    feePlanName: { type: String, required: true, trim: true },
    feePlanDisplayName: { type: String, required: true, trim: true },
    currency: { type: String, default: 'INR' },
    feeHeads: { type: [feeHeadSchema], required: true, default: [] },
    instalments: { type: [instalmentSchema], required: true, default: [] },
    totalBaseFee: { type: Number, required: true, default: 0 },
    totalGST: { type: Number, required: true, default: 0 },
    totalFee: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    centerCode: { type: String, required: false, trim: true, default: null },
    testDate: { type: Number, required: false, default: null },
    validTill: { type: Number, required: false, default: null },
    isdeleted: { type: Boolean, required: true, default: false },
    createdBy: { type: String, trim: true, default: null, ref: 'user' },
    updatedBy: { type: String, trim: true, default: null, ref: 'user' }
  },
  { timestamps: true }
);

feePlanSchema.index({ tenantId: 1, feePlanId: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
feePlanSchema.index({ tenantId: 1, academicYear: 1, programCode: 1, feePlanName: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
feePlanSchema.index({ tenantId: 1, programCode: 1, academicYear: 1, isdeleted: 1 });
feePlanSchema.index({ tenantId: 1, status: 1, isdeleted: 1, createdAt: -1 });

feePlanSchema.pre('validate', function (next) {
  try {
    const ay = String(this.academicYear || '').trim();
    const pc = String(this.programCode || '').trim();
    const fn = String(this.feePlanName || '').trim();
    this.feePlanDisplayName = `${pc} - ${fn}${ay ? ' - ' + ay : ''}`.trim();
    if (!this.feeHeads.length) return next(new Error('At least one fee head is required'));
    if (!this.instalments.length) return next(new Error('At least one instalment is required'));
    const invalidDiscount = this.feeHeads.find((h) => h.discountAllowed && String(h.key || '').toUpperCase() !== 'TF');
    if (invalidDiscount) return next(new Error('Discount can be applied only on Tuition Fee'));
    let base = 0;
    let gst = 0;
    let total = 0;
    this.feeHeads.forEach((h) => {
      base += Number(h.amount || 0);
      gst += Number(h.gstAmount || 0);
      total += Number(h.totalAmount || 0);
    });
    this.totalBaseFee = Number(base.toFixed(2));
    this.totalGST = Number(gst.toFixed(2));
    this.totalFee = Number(total.toFixed(2));
    const feeHeadKeys = new Set(
      this.feeHeads
        .map((h) =>
          String(h.key || '')
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    );
    const insts = Array.isArray(this.instalments) ? this.instalments : [];
    insts.forEach((i) => {
      i.feeHead = String(i.feeHead || '')
        .trim()
        .toUpperCase();
      i.label = String(i.label || '').trim();
      i.instalmentDate = Number(i.instalmentDate || 0);
      i.amount = Number(i.amount || 0);
      i.mode = i.mode ? String(i.mode).trim() : null;
      i.chequeFavour = i.chequeFavour ? String(i.chequeFavour).trim() : null;
      i.discountApplied = i.feeHead === 'TF';
      if (i.feeHead && !feeHeadKeys.has(i.feeHead)) {
        const err = new Error(`Instalment feeHead not found in feeHeads: ${i.feeHead}`);
        err.statusCode = 400;
        throw err;
      }
    });
    const sorted = insts.map((x) => x).sort((a, b) => Number(a.instalmentDate || 0) - Number(b.instalmentDate || 0));
    sorted.forEach((x, idx) => {
      x.seq = idx + 1;
    });
    this.instalments = sorted;
    const instSum = this.instalments.reduce((s, i) => s + Number(i.amount || 0), 0);
    if (Number(instSum.toFixed(2)) !== Number(this.totalFee.toFixed(2))) {
      return next(new Error('Instalment total does not match total fee'));
    }
    next();
  } catch (err) {
    return next(err);
  }
});

const FeePlan = mongoose.model('fee_plan', feePlanSchema);
export default FeePlan;

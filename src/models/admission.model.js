import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const neftRefSchema = new mongoose.Schema(
  {
    utr: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    paidOn: { type: String, required: false, trim: true, default: null },
    remarks: { type: String, required: false, trim: true, default: null }
  },
  { _id: false }
);

const admissionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    admissionId: { type: String, required: true, default: uuid, trim: true },
    admissionNo: { type: String, required: false, trim: true, default: null },
    sourceType: { type: String, enum: ['PORTAL', 'DIRECT'], required: true },
    registrationNumber: { type: String, required: false, trim: true, default: null },
    portalStudentId: { type: String, required: false, trim: true, default: null },
    scholarshipTestId: { type: String, required: false, trim: true, default: null },
    student: {
      name: { type: String, required: true, trim: true },
      firstName: { type: String, required: false, trim: true, default: null },
      lastName: { type: String, required: false, trim: true, default: null },
      email: { type: String, required: false, trim: true, lowercase: true, default: null },
      phone: { type: String, required: true, trim: true },
      dateOfBirth: { type: String, required: false, trim: true, default: null },
      gender: { type: String, required: false, trim: true, default: null },
      fatherName: { type: String, required: false, trim: true, default: null },
      motherName: { type: String, required: false, trim: true, default: null },
      parentName: { type: String, required: false, trim: true, default: null },
      parentPhone: { type: String, required: false, trim: true, default: null },
      address: { type: String, required: false, trim: true, default: null },
      city: { type: String, required: false, trim: true, default: null },
      schoolName: { type: String, required: false, trim: true, default: null },
      className: { type: String, required: false, trim: true, default: null }
    },
    centerId: { type: String, required: false, trim: true, default: null },
    centerName: { type: String, required: true, trim: true },
    programId: { type: String, required: false, trim: true, default: null },
    programName: { type: String, required: true, trim: true },
    programCode: { type: String, required: false, trim: true, default: null },
    batchId: { type: String, required: false, trim: true, default: null },
    batchName: { type: String, required: false, trim: true, default: null },
    classLabel: { type: String, required: false, trim: true, default: null },
    academicYear: { type: String, required: true, trim: true },
    test: {
      testDate: { type: String, required: false, trim: true, default: null },
      testCity: { type: String, required: false, trim: true, default: null },
      testCentre: { type: String, required: false, trim: true, default: null },
      centerCode: { type: String, required: false, trim: true, default: null },
      resultCategory: { type: String, required: false, trim: true, default: null },
      paper1Total: { type: String, required: false, trim: true, default: null },
      paper2Total: { type: String, required: false, trim: true, default: null },
      gtotal: { type: String, required: false, trim: true, default: null },
      normalizedScore: { type: String, required: false, trim: true, default: null },
      normalizedPercentage: { type: String, required: false, trim: true, default: null },
      normalizedRank: { type: String, required: false, trim: true, default: null },
      programOffered1: { type: String, required: false, trim: true, default: null },
      programOffered2: { type: String, required: false, trim: true, default: null },
      waiverPerInTf: { type: Number, required: false, default: null },
      studyCentre: { type: String, required: false, trim: true, default: null }
    },
    feePlanId: { type: String, required: true, trim: true },
    feePlanCode: { type: String, required: false, trim: true, default: null },
    fee: {
      baseFee: { type: Number, required: true },
      finalFee: { type: Number, required: true },
      testScholarshipPct: { type: Number, required: true, default: 0 },
      scholarshipPct: { type: Number, required: true, default: 0 },
      additionalScholarshipPct: { type: Number, required: true, default: 0 },
      totalDiscountPct: { type: Number, required: true, default: 0 },
      breakup: { type: Array, required: false, default: [] }
    },
    payments: {
      neft: {
        splitAmount: { type: Number, required: false, default: 0 },
        refs: { type: [neftRefSchema], required: false, default: [] },
        totalEntered: { type: Number, required: false, default: 0 }
      },
      chequeSummary: {
        totalCheques: { type: Number, required: false, default: 0 },
        totalAmount: { type: Number, required: false, default: 0 },
        pendingCount: { type: Number, required: false, default: 0 },
        clearedCount: { type: Number, required: false, default: 0 },
        bouncedCount: { type: Number, required: false, default: 0 }
      }
    },
    workflow: {
      stage: {
        type: String,
        enum: ['DRAFT', 'PAYMENTS_SUBMITTED', 'FEE_CALC_GENERATED', 'APPROVAL_SENT', 'CONFIRMED'],
        default: 'DRAFT'
      },
      paymentsSubmittedAt: { type: Date, required: false, default: null },
      feeCalcGeneratedAt: { type: Date, required: false, default: null },
      approvalSentAt: { type: Date, required: false, default: null },
      confirmedAt: { type: Date, required: false, default: null },
      approvedBy: { type: String, required: false, trim: true, default: null },
      approvedAt: { type: Date, required: false, default: null }
    },
    print: {
      feeAcknowledgementPrintedAt: { type: Date, required: false, default: null },
      contractPrintedAt: { type: Date, required: false, default: null },
      feeCalculationPrintedAt: { type: Date, required: false, default: null }
    },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

// indexes
admissionSchema.index({ tenantId: 1, admissionId: 1, isdeleted: 1 }, { unique: true });
admissionSchema.index({ tenantId: 1, registrationNumber: 1, isdeleted: 1 });
admissionSchema.index({ tenantId: 1, programCode: 1, isdeleted: 1 });
admissionSchema.index({ tenantId: 1, centerId: 1, isdeleted: 1 });
admissionSchema.index({ tenantId: 1, academicYear: 1, isdeleted: 1 });
admissionSchema.index({ tenantId: 1, 'workflow.stage': 1, createdAt: -1, isdeleted: 1 });

const Admission = mongoose.model('admission', admissionSchema);
export default Admission;

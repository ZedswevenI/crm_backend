import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const scholarshipTestSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    testId: { type: String, required: true, default: uuid, trim: true },

    registrationNumber: { type: String, required: true, trim: true },
    studentId: { type: String, required: false, trim: true, default: null },

    firstName: { type: String, required: false, trim: true, default: null },
    lastName: { type: String, required: false, trim: true, default: null },
    name: { type: String, required: false, trim: true, default: null },
    email: { type: String, required: false, trim: true, lowercase: true, default: null },
    mobileNo: { type: String, required: false, trim: true, default: null },
    dateOfBirth: { type: Number, required: false, default: null },
    gender: { type: String, required: false, trim: true, default: null },
    fatherName: { type: String, required: false, trim: true, default: null },
    motherName: { type: String, required: false, trim: true, default: null },
    address: { type: String, required: false, trim: true, default: null },
    city: { type: String, required: false, trim: true, default: null },
    state: { type: String, required: false, trim: true, default: null },
    pincode: { type: String, required: false, trim: true, default: null },
    schoolName: { type: String, required: false, trim: true, default: null },
    className: { type: String, required: false, trim: true, default: null },
    testDate: { type: Number, required: false, default: null },
    testCity: { type: String, required: false, trim: true, default: null },
    testCentre: { type: String, required: false, trim: true, default: null },
    testName: { type: String, required: false, trim: true, default: null },
    centerCode: { type: String, required: false, trim: true, default: null },
    programName: { type: String, required: false, trim: true, default: null },
    programCode: { type: String, required: false, trim: true, default: null },
    paper1Total: { type: String, required: false, trim: true, default: null },
    paper2Total: { type: String, required: false, trim: true, default: null },
    gtotal: { type: String, required: false, trim: true, default: null },

    normalizedScore: { type: String, required: false, trim: true, default: null },
    normalizedPercentage: { type: String, required: false, trim: true, default: null },
    normalizedRank: { type: String, required: false, trim: true, default: null },

    resultCategory: { type: String, required: false, trim: true, default: null },
    // External API's own "status" field (e.g. PASS/FAIL) — kept separate from this schema's `status`
    // (Active/Inactive) field below to avoid a name collision.
    testResultStatus: { type: String, required: false, trim: true, default: null },
    selection: { type: String, required: false, trim: true, default: null },
    selectionStatus: { type: String, required: false, trim: true, default: null },
    programOffered1: { type: String, required: false, trim: true, default: null },
    programOffered2: { type: String, required: false, trim: true, default: null },

    waiverPerInTf: { type: Number, required: false, default: null },
    studyCentre: { type: String, required: false, trim: true, default: null },

    // ✅ epoch ms (or null)
    lastSyncAt: { type: Number, required: false, default: null },

    lastSyncStatus: { type: String, enum: ['SUCCESS', 'NOT_FOUND', 'UNAUTHORIZED', 'ERROR'], default: null },
    lastSyncMessage: { type: String, required: false, trim: true, default: null },

    raw: { type: Object, required: false, default: null },

    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false },

    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

// indexes
scholarshipTestSchema.index({ tenantId: 1, registrationNumber: 1, isdeleted: 1 }, { unique: true });
scholarshipTestSchema.index({ tenantId: 1, studentId: 1, isdeleted: 1 });
scholarshipTestSchema.index({ tenantId: 1, programCode: 1, isdeleted: 1 });
scholarshipTestSchema.index({ tenantId: 1, className: 1, isdeleted: 1 });
scholarshipTestSchema.index({ tenantId: 1, lastSyncAt: -1, isdeleted: 1 });
scholarshipTestSchema.index({ tenantId: 1, testDate: -1, isdeleted: 1 });
scholarshipTestSchema.index({ tenantId: 1, selection: 1, isdeleted: 1 });
scholarshipTestSchema.index({ tenantId: 1, testResultStatus: 1, isdeleted: 1 });

const ScholarshipTest = mongoose.model('scholarship_test', scholarshipTestSchema);
export default ScholarshipTest;

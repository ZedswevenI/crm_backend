// import mongoose from 'mongoose';
// import { v4 as uuid } from 'uuid';

// const ptmSchema = new mongoose.Schema(
//   {
//     tenantId: { type: String, required: true, index: true, trim: true },
//     ptmId: { type: String, required: true, default: uuid, index: true },
//     centerCode: { type: String, required: true, index: true, trim: true },
//     programCode: { type: String, default: null, trim: true },
//     batchCode: { type: String, required: true, index: true, trim: true },
//     studentId: { type: String, required: true, ref: 'studentprofile', index: true },
//     admissionNo: { type: String, required: true, index: true, trim: true },
//     studentName: { type: String, required: true, trim: true },
//     ptmDate: { type: Number, required: true, index: true },
//     startTime: { type: Number, required: true },
//     endTime: { type: Number, required: true },
//     durationMins: { type: Number, required: true },
//     content: { type: String, trim: true, default: null },
//     venue: { type: String, trim: true, default: null },
//     meetingMode: { type: String, enum: ['OFFLINE', 'ONLINE', 'PHONE'], default: 'OFFLINE' },
//     prePtmFeedback: { type: String, trim: true, default: null },
//     prePtmSubmittedAt: { type: Number, default: null },
//     staffRemarks: { type: String, trim: true, default: null },
//     staffId: { type: String, default: null, trim: true },
//     staffFeedbackSubmittedAt: { type: Number, default: null },
//     status: {
//       type: String,
//       enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
//       default: 'SCHEDULED',
//       index: true
//     },
//     isdeleted: { type: Boolean, default: false, index: true },
//     createdBy: { type: String, default: null, trim: true },
//     updatedBy: { type: String, default: null, trim: true }
//   },
//   { timestamps: true }
// );

// ptmSchema.index({ tenantId: 1, admissionNo: 1, startTime: 1, isdeleted: 1 }, { unique: true, name: 'unique_student_ptm_time' });
// ptmSchema.index({ tenantId: 1, batchCode: 1, ptmDate: 1, isdeleted: 1 });
// ptmSchema.pre('validate', function (next) {
//   try {
//     if (this.startTime && this.endTime) {
//       if (this.startTime >= this.endTime) {
//         return next(new Error('PTM endTime must be strictly after startTime.'));
//       }
//     }
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// const PTM = mongoose.model('ptm', ptmSchema);
// export default PTM;

import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const feedbackQuestionSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true },
    fieldType: { type: String, enum: ['text', 'radio', 'checkbox'], required: true },
    fieldText: { type: String, required: true, trim: true },
    fieldOptions: { type: [String], default: [] },
    fieldValue: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const ptmSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    ptmId: { type: String, required: true, default: uuid, index: true },
    centerCode: { type: String, required: true, index: true, trim: true },
    programCode: { type: String, default: null, trim: true },
    batchCode: { type: String, required: true, index: true, trim: true },
    studentId: { type: String, required: true, ref: 'studentprofile', index: true },
    admissionNo: { type: String, required: true, index: true, trim: true },
    studentName: { type: String, required: true, trim: true },
    ptmDate: { type: Number, required: true, index: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    durationMins: { type: Number, required: true },
    content: { type: String, trim: true, default: null },
    venue: { type: String, trim: true, default: null },
    meetingMode: { type: String, enum: ['OFFLINE', 'ONLINE', 'PHONE'], default: 'OFFLINE' },
    prePtmQuestions: { type: [feedbackQuestionSchema], default: [] },
    prePtmRemarks: { type: String, trim: true, default: null },
    prePtmSubmittedAt: { type: Number, default: null },
    enablePostPtmFeedback: { type: Boolean, default: true },
    postPtmQuestions: { type: [feedbackQuestionSchema], default: [] },
    postPtmRemarks: { type: String, trim: true, default: null },
    postPtmSubmittedAt: { type: Number, default: null },
    staffRemarks: { type: String, trim: true, default: null },
    staffId: { type: String, default: null, trim: true },
    staffFeedbackSubmittedAt: { type: Number, default: null },
    status: {
      type: String,
      enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      default: 'SCHEDULED',
      index: true
    },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

ptmSchema.index({ tenantId: 1, admissionNo: 1, startTime: 1, isdeleted: 1 }, { unique: true, name: 'unique_student_ptm_time' });
ptmSchema.index({ tenantId: 1, batchCode: 1, ptmDate: 1, isdeleted: 1 });

ptmSchema.pre('validate', function (next) {
  try {
    if (this.startTime && this.endTime && this.startTime >= this.endTime) {
      return next(new Error('PTM endTime must be strictly after startTime.'));
    }
    next();
  } catch (err) {
    next(err);
  }
});

const PTM = mongoose.model('ptm', ptmSchema);
export default PTM;

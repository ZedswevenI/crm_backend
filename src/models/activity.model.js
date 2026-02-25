import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const activitySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    activityId: { type: String, required: true, default: uuid, index: true },
    batchCode: { type: String, required: true, index: true, trim: true },
    centerCode: { type: String, trim: true, default: null },
    activityName: { type: String, required: true, trim: true },
    sno: { type: Number, default: null },
    startDate: { type: Number, required: true, index: true },
    endDate: { type: Number, required: true, index: true },
    actualStartDate: { type: Number, default: null },
    actualEndDate: { type: Number, default: null },
    remarks: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
      index: true
    },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

activitySchema.index({ tenantId: 1, batchCode: 1, isdeleted: 1, startDate: 1 }, { name: 'student_calendar_idx' });

activitySchema.pre('validate', function (next) {
  try {
    if (this.startDate && this.endDate) {
      if (this.startDate > this.endDate) {
        const err = new Error('Activity endDate cannot be earlier than startDate.');
        err.statusCode = 400;
        return next(err);
      }
    }
    if (this.actualStartDate && this.actualEndDate) {
      if (this.actualStartDate > this.actualEndDate) {
        const err = new Error('Activity actualEndDate cannot be earlier than actualStartDate.');
        err.statusCode = 400;
        return next(err);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Activity = mongoose.model('activity', activitySchema);
export default Activity;

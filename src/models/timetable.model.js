import mongoose from 'mongoose';

const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const TimeRangeSchema = new mongoose.Schema(
  {
    startMin: { type: Number, required: true, min: 0, max: 1439 },
    endMin: { type: Number, required: true, min: 0, max: 1439 },
    startLabel: { type: String, trim: true, default: null },
    endLabel: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const PeriodSchema = new mongoose.Schema(
  {
    periodNo: { type: Number, required: true, min: 1 },
    time: { type: TimeRangeSchema, required: true },
    facultyId: { type: String, required: true, trim: true, index: true },
    facultyName: { type: String, default: null, trim: true },
    subjectId: { type: String, default: null, trim: true, index: true },
    subjectCode: { type: String, default: null, trim: true },
    subjectName: { type: String, default: null, trim: true },
    topic: { type: String, default: null, trim: true },
    venue: { type: String, default: null, trim: true },
    isCancelled: { type: Boolean, default: false },
    cancelReason: { type: String, default: null, trim: true },
    rearrangedTo: { type: String, default: null, trim: true },
    replacementFacultyId: { type: String, default: null, trim: true },
    replacementSubjectId: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true }
  },
  { _id: true }
);

const DaySchema = new mongoose.Schema(
  {
    day: { type: String, enum: DAYS, required: true },
    periods: { type: [PeriodSchema], default: [] }
  },
  { _id: false }
);

const OverrideSchema = new mongoose.Schema(
  {
    date: { type: Number, required: true, index: true },
    day: { type: String, enum: DAYS, default: null },
    periodNo: { type: Number, default: null, min: 1 },
    action: { type: String, enum: ['CANCEL_DAY', 'CANCEL_PERIOD', 'REPLACE_PERIOD', 'ADD_PERIOD', 'MOVE_PERIOD'], required: true },
    period: { type: PeriodSchema, default: null },
    reason: { type: String, default: null, trim: true }
  },
  { _id: true }
);

const timeTableSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true, ref: 'tenant' },
    status: { type: String, default: 'Active', trim: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true },
    batchCode: { type: String, required: true, trim: true, index: true },
    centerCode: { type: String, default: null, trim: true, index: true },
    phase: { type: String, default: null, trim: true },
    wkStartOn: { type: Number, required: true, index: true },
    week: { type: [DaySchema], default: [] },
    overrides: { type: [OverrideSchema], default: [] }
  },
  { timestamps: true }
);

timeTableSchema.index({ tenantId: 1, batchCode: 1, wkStartOn: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

timeTableSchema.pre('validate', function (next) {
  this.batchCode = safeTrim(this.batchCode);
  this.centCode = safeTrim(this.centCode) || null;
  this.phase = safeTrim(this.phase) || null;
  this.wkStartOn = toInt(this.wkStartOn, 0);
  next();
});

const TimeTable = mongoose.model('timetable', timeTableSchema);
export default TimeTable;

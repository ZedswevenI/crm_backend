import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    roomNo: { type: String, required: true },
    slot1StaffCode: { type: String, default: null },
    slot1StaffId: { type: mongoose.Schema.Types.ObjectId, default: null },
    slot1StaffName: { type: String, default: null },
    slot2StaffCode: { type: String, default: null },
    slot2StaffId: { type: mongoose.Schema.Types.ObjectId, default: null },
    slot2StaffName: { type: String, default: null }
  },
  { _id: false }
);

const invigilationSchema = new mongoose.Schema(
  {
    entiId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    examName: { type: String, required: true, trim: true },
    examDate: { type: Number, required: true },
    session: { type: String, required: true, enum: ['MORNING', 'AFTERNOON', 'EVENING'] },
    examStartTime: { type: String, default: null },
    examEndTime: { type: String, default: null },
    slot1StartTime: { type: String, default: null },
    slot1EndTime: { type: String, default: null },
    slot2StartTime: { type: String, default: null },
    slot2EndTime: { type: String, default: null },
    rooms: { type: [roomSchema], default: [] },
    isdeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  {
    timestamps: true,
    collection: 'invigilation'
  }
);

invigilationSchema.index({ tenantId: 1, examName: 1, examDate: 1, session: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

const Invigilation = mongoose.model('Invigilation', invigilationSchema);

export default Invigilation;

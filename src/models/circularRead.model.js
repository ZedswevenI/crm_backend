import mongoose from 'mongoose';

const circularReadSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    circularId: { type: String, required: true, index: true, trim: true },
    studentNo: { type: String, required: true, index: true, trim: true },
    readAt: { type: Number, default: () => Date.now() }
  },
  { timestamps: true }
);

circularReadSchema.index({ tenantId: 1, circularId: 1, studentNo: 1 }, { unique: true });

const CircularRead = mongoose.model('circularread', circularReadSchema);
export default CircularRead;

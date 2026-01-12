import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    key: { type: String, required: true, trim: true },
    seq: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

counterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

const Counter = mongoose.model('counter', counterSchema);
export default Counter;

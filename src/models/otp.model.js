import mongoose from 'mongoose';

const OTP_TYPES = ['FORGOT_PASSWORD', 'TWO_FACTOR', 'STUDENT_LOGIN'];

const otpSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    tenantId: { type: String, required: true },
    otpHash: { type: String, required: true },
    type: { type: String, required: true, enum: OTP_TYPES },
    expiresAt: { type: Date, required: true },
    isUsed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ userId: 1, type: 1 });

const Otp = mongoose.model('otp', otpSchema);
export default Otp;

import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, ref: 'user' },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});

tokenSchema.index({ token: 1 });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 });

const Token = mongoose.model('authtracker', tokenSchema);

export default Token;

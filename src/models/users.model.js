import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, ref: 'tenant' },
    userId: { type: String, required: true, trim: true },
    full_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/.+@.+\..+/, 'Please enter a valid email address.'] },
    phone: { type: String, required: false, match: [/^\d{10}$/, 'Please enter a valid phone number.'] },
    password: { type: String, required: true },
    permissions: { type: String, enum: ['admin', 'manager', 'supervisor', 'staff'], default: null },
    createdBy: { type: String, ref: 'user', default: null },
    updatedBy: { type: String, ref: 'user', default: null },
    isAdmin: { type: Boolean, default: false },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);
userSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
userSchema.index({ tenantId: 1, userId: 1, isdeleted: 1, updatedAt: -1 });
userSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { isdeleted: false, email: { $type: 'string' } } });
userSchema.index({ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { isdeleted: false, phone: { $type: 'string' } } });
userSchema.index({ tenantId: 1, isdeleted: 1 });
userSchema.index({ tenantId: 1, isdeleted: 1, updatedAt: -1 });
userSchema.index({ tenantId: 1, permissions: 1, isdeleted: 1 });
userSchema.index({ tenantId: 1, warehouseId: 1, isdeleted: 1 });
userSchema.pre('save', async function (next) {
  try {
    const existingEmail = await this.constructor.exists({
      email: this.email,
      _id: { $ne: this._id }
    });
    if (existingEmail) {
      const err = new Error('Email already exists');
      err.statusCode = 400;
      return next(err);
    }
  } catch (err) {
    next(err);
  }
});

const User = mongoose.model('user', userSchema);

export default User;

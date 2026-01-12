import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

/**
 * Role Levels (4)
 * L1 - Academic Head
 * L2 - Admission Manager
 * L3 - Accounts Manager
 * L4 - Academic Operations
 */
const ROLE_LEVELS = ['L1', 'L2', 'L3', 'L4'];

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, ref: 'tenant', trim: true, index: true },
    userId: { type: String, required: true, default: uuid, trim: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, 'Please enter a valid email address.']
    },
    phone: {
      type: String,
      required: true,
      match: [/^\d{10}$/, 'Please enter a valid phone number.']
    },
    password: { type: String, required: true },
    roleLevel: { type: String, required: true, enum: ROLE_LEVELS, default: 'L4' },
    roleLabel: { type: String, required: true, default: 'Academic Operations', trim: true },
    centerId: { type: String, required: false, trim: true },
    centerName: { type: String, required: false, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    lastLoginAt: { type: Date, default: null },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  {
    timestamps: true
  }
);

userSchema.index({ tenantId: 1, userId: 1, isdeleted: 1 }, { unique: true });
userSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
userSchema.index({ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
userSchema.index({ tenantId: 1, empCode: 1 }, { unique: true, partialFilterExpression: { isdeleted: false, empCode: { $type: 'string', $ne: '' } } });
userSchema.index({ tenantId: 1, roleLevel: 1, isdeleted: 1, createdAt: -1 });
userSchema.index({ tenantId: 1, name: 1, isdeleted: 1 });

userSchema.pre('validate', async function (next) {
  try {
    const map = {
      L1: 'Academic Head',
      L2: 'Admission Manager',
      L3: 'Accounts Manager',
      L4: 'Academic Operations'
    };
    this.roleLabel = map[this.roleLevel] || this.roleLabel || 'Academic Operations';
    const existingEmail = await this.constructor.exists(
      {
        tenantId: this.tenantId,
        email: this.email,
        _id: { $ne: this._id }
      },
      { session: this.$session() }
    );
    if (existingEmail) {
      const err = new Error('Email already exists');
      err.statusCode = 400;
      return next(err);
    }
    const existingPhone = await this.constructor.exists(
      {
        tenantId: this.tenantId,
        phone: this.phone,
        _id: { $ne: this._id }
      },
      { session: this.$session() }
    );
    if (existingPhone) {
      const err = new Error('Phone number already exists');
      err.statusCode = 400;
      return next(err);
    }
    next();
  } catch (err) {
    return next(err);
  }
});

const User = mongoose.model('user', userSchema);

export default User;

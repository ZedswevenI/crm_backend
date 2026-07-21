import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const ROLE_LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

export const ROLE_MAP = {
  L1: 'Super Admin',
  L2: 'Admissions',
  L3: 'AO',
  L4: 'Teacher',
  L5: 'Exam',
  L6: 'Account',
  L7: 'EDP'
};

const UserCenterSchema = new mongoose.Schema(
  {
    centerId: { type: String, trim: true },
    centerName: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, ref: 'tenant', trim: true, index: true },
    userId: { type: String, required: true, default: uuid, trim: true },
    staffId: { type: String, default: null, index: true },
    empCode: { type: String, default: null, trim: true },
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
    roleLabel: { type: String, required: true, default: 'Teacher', trim: true },
    centers: { type: [UserCenterSchema], default: [] },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    lastLoginAt: { type: Date, default: null },
    fcmTokens: [
      {
        token: { type: String, required: true },
        device: { type: String, default: null },
        updatedAt: { type: Number, default: null }
      }
    ],
    isdeleted: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
userSchema.index({ tenantId: 1, userId: 1, isdeleted: 1 }, { unique: true });
userSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
userSchema.index({ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
userSchema.index(
  { tenantId: 1, empCode: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { isdeleted: false, empCode: { $type: 'string', $ne: '' } }
  }
);
userSchema.index({ tenantId: 1, roleLevel: 1, isdeleted: 1, createdAt: -1 });
userSchema.index({ tenantId: 1, name: 1, isdeleted: 1 });
userSchema.index({ tenantId: 1, 'centers.centerId': 1, isdeleted: 1 });

// ── Pre-validate: only sync roleLabel from roleLevel ──────────────────────────
// FIX: removed manual duplicate email/phone checks — unique indexes handle this.
// Manual checks caused race conditions and double-fault errors.
userSchema.pre('validate', function (next) {
  this.roleLabel = ROLE_MAP[this.roleLevel] || this.roleLevel;
  next();
});

const User = mongoose.model('user', userSchema);
export default User;

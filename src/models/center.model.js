import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const centerSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    centerId: { type: String, required: true, default: uuid, trim: true },
    centerName: { type: String, required: true, trim: true },
    centerCode: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, 'Please enter a valid email address.']
    },
    phone: {
      type: String,
      required: false,
      match: [/^\d{10}$/, 'Please enter a valid phone number.']
    },
    cntatName: { type: String, required: false, trim: true },
    address1: { type: String, required: true, trim: true },
    address2: { type: String, required: false, trim: true },
    area: { type: String, required: false, lowercase: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: false, lowercase: true, trim: true },
    pincode: { type: String, required: true, match: [/^\d{6}$/, 'Please enter a valid pincode.'] },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  {
    timestamps: true
  }
);

centerSchema.index({ tenantId: 1, centerId: 1, isdeleted: 1 }, { unique: true });
centerSchema.index({ tenantId: 1, centerCode: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
centerSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { isdeleted: false, email: { $type: 'string', $ne: '' } } });
centerSchema.index({ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { isdeleted: false, phone: { $type: 'string', $ne: '' } } });
centerSchema.index({ tenantId: 1, isdeleted: 1, createdAt: -1 });
centerSchema.index({ tenantId: 1, centerName: 1, isdeleted: 1 });
centerSchema.pre('validate', async function (next) {
  try {
    const existingCode = await this.constructor.exists(
      {
        tenantId: this.tenantId,
        centerCode: this.centerCode,
        _id: { $ne: this._id }
      },
      { session: this.$session() }
    );
    if (existingCode) {
      const err = new Error('Center code already exists');
      err.statusCode = 400;
      return next(err);
    }
    const emailVal = String(this.email || '')
      .trim()
      .toLowerCase();
    if (emailVal) {
      const existingEmail = await this.constructor.exists(
        {
          tenantId: this.tenantId,
          email: emailVal,
          _id: { $ne: this._id }
        },
        { session: this.$session() }
      );
      if (existingEmail) {
        const err = new Error('Email already exists');
        err.statusCode = 400;
        return next(err);
      }
    }
    const phoneVal = String(this.phone || '').trim();
    if (phoneVal) {
      const existingPhone = await this.constructor.exists(
        {
          tenantId: this.tenantId,
          phone: phoneVal,
          _id: { $ne: this._id }
        },
        { session: this.$session() }
      );
      if (existingPhone) {
        const err = new Error('Phone number already exists');
        err.statusCode = 400;
        return next(err);
      }
    }
    next();
  } catch (err) {
    return next(err);
  }
});

const Center = mongoose.model('center', centerSchema);

export default Center;

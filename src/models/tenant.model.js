import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const tenantSchema = new mongoose.Schema(
  {
    tenantName: { type: String, required: true, trim: true },
    tenantId: { type: String, required: true, default: uuid, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/.+@.+\..+/, 'Please enter a valid email address.'] },
    phone: { type: String, required: true, unique: true, match: [/^\d{10}$/, 'Please enter a valid phone number.'] },
    cntatName: { type: String, required: true, trim: true },
    entAddress1: { type: String, required: false, lowercase: true, trim: true },
    entAddress2: { type: String, required: false, lowercase: true, trim: true },
    entArea: { type: String, required: false, lowercase: true, trim: true },
    entCity: { type: String, required: false, lowercase: true, trim: true },
    entState: { type: String, required: false, lowercase: true, trim: true },
    entCountry: { type: String, required: false, lowercase: true, trim: true },
    entZip: { type: String, required: false },
    entWebsite: { type: String, required: false, trim: true },
    hasGST: { type: Boolean, default: false },
    GSTN: { type: String, required: false },
    istermAccepted: { type: Boolean, required: true },
    isdeleted: { type: Boolean, required: true }
  },
  {
    timestamps: true
  }
);

// index
tenantSchema.index({ tenantId: 1, isdeleted: 1 }, { unique: true });
tenantSchema.index({ tenantId: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
tenantSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
tenantSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
tenantSchema.index({ isdeleted: 1, createdAt: -1 });
tenantSchema.index({ tenantName: 1, isdeleted: 1 });

// Unique email and phone validation
tenantSchema.pre('validate', async function (next) {
  try {
    const existingEmail = await this.constructor.exists(
      {
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
        phone: this.phone,
        _id: { $ne: this._id }
      },
      { session: this.$session() }
    );
    if (existingPhone) {
      const err = new Error('Phone number already exists');
      err.statusCode = 400;
      console.log(err);
      return next(err);
    }
    next();
  } catch (err) {
    return next(err);
  }
});

const Tenant = mongoose.model('tenant', tenantSchema);

export default Tenant;

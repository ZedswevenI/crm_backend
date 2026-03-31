import mongoose from 'mongoose';

const centerVenueSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    centerRecId: { type: mongoose.Schema.Types.ObjectId, ref: 'center', required: true, index: true },
    venueName: { type: String, required: true, trim: true },
    address1: { type: String, required: false, trim: true },
    address2: { type: String, required: false, trim: true },
    area: { type: String, required: false, trim: true, lowercase: true },
    city: { type: String, required: false, trim: true },
    state: { type: String, required: false, trim: true },
    venueCode: { type: String, required: false, trim: true },
    phone: { type: Number, required: false, trim: true },
    pincode: { type: String, required: false, trim: true, match: [/^\d{6}$/, 'Please enter a valid pincode.'] },
    capacity: { type: Number, required: false },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

centerVenueSchema.index({ tenantId: 1, centerRecId: 1, venueName: 1, venueCode : 1  }, { unique: true, partialFilterExpression: { isdeleted: false } });
centerVenueSchema.index({ tenantId: 1, centerRecId: 1, isdeleted: 1, createdAt: -1 });

const CenterVenue = mongoose.model('center_venue', centerVenueSchema);
export default CenterVenue;

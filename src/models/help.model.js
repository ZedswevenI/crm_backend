import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const helpSchema = new mongoose.Schema(
  {
    helpId: { type: String, required: true, default: uuid, index: true },
    moduleName: { type: String, required: true, trim: true, index: true },
    moduleSortOrder: { type: Number, default: 0 },
    topic: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    videoLink: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

helpSchema.index({ helpId: 1 }, { unique: true });
helpSchema.index({ isdeleted: 1, moduleName: 1, moduleSortOrder: 1, sortOrder: 1 });

const Help = mongoose.model('help', helpSchema);
export default Help;

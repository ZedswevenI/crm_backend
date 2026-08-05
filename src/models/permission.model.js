import mongoose from 'mongoose';

// Static catalog of every assignable permission key ("<module>:<action>").
// Seeded via scripts/seed-permissions.js from src/data/permissionCatalog.data.js — not user-editable.
const permissionSchema = new mongoose.Schema(
  {
    permissionKey: { type: String, required: true, trim: true, unique: true }, // e.g. "orgcenter:create"
    module: { type: String, required: true, trim: true, index: true }, // e.g. "orgcenter"
    action: { type: String, required: true, trim: true }, // e.g. "create"
    label: { type: String, required: true, trim: true }, // e.g. "Create Center"
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

permissionSchema.index({ module: 1, action: 1 }, { unique: true });

const Permission = mongoose.model('permission', permissionSchema);
export default Permission;

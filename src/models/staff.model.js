import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

const STAFF_ROLES = ['Faculty', 'Center Head', 'Counsellor', 'Admin'];
const FACULTY_TYPES = ['TEACHING', 'NON_TEACHING'];
const PAYROLL_TYPES = ['suguna', 'z7i'];
const WEEKOFF_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const staffSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, ref: 'tenant', trim: true, index: true },
    staffId: { type: String, required: true, default: uuid, trim: true },
    userId: { type: String, default: null, ref: 'user', index: true },
    employeeId: { type: String, required: true, trim: true },
    staffCode: { type: String, required: true, trim: true, index: true },
    staffName: { type: String, required: true, trim: true, index: true },
    role: { type: String, enum: STAFF_ROLES, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: false, trim: true, lowercase: true, default: null, index: true },
    centerId: { type: String, required: true, ref: 'center', default: null },
    joiningDate: { type: Number, required: true, trim: true },
    relievingDate: { type: Number, required: false, trim: true, default: null },
    facultyType: { type: String, enum: FACULTY_TYPES, required: false, default: null },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: false, allow: null },
    payroll: { type: String, enum: PAYROLL_TYPES, required: true, trim: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'department', required: true, index: true },
    weekoff: { type: [String], enum: WEEKOFF_DAYS, required: false, default: [] },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

staffSchema.index({ tenantId: 1, staffId: 1, isdeleted: 1 }, { unique: true });
staffSchema.index({ tenantId: 1, staffCode: 1, isdeleted: 1 }, { unique: true });
staffSchema.index({ tenantId: 1, employeeId: 1, isdeleted: 1 }, { unique: true });
staffSchema.index({ tenantId: 1, phone: 1, isdeleted: 1 }, { unique: true });
staffSchema.index({ tenantId: 1, email: 1, isdeleted: 1 }, { unique: true, sparse: true });
staffSchema.index({ tenantId: 1, centerId: 1, isdeleted: 1 });
staffSchema.index({ tenantId: 1, role: 1, status: 1, isdeleted: 1 });
staffSchema.index({ tenantId: 1, staffName: 1, isdeleted: 1 });

const Staff = mongoose.model('staff', staffSchema);
export default Staff;

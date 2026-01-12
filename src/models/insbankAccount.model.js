import mongoose from 'mongoose';

const BankAccountSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    bankName: { type: String, required: true, trim: true, index: true },
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifsc: { type: String, trim: true, default: null },
    branch: { type: String, trim: true, default: null },
    isDefault: { type: Boolean, default: false },
    statusFlag: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

BankAccountSchema.index({ tenantId: 1, accountNumber: 1, bankName: 1, isdeleted: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
const BankAccount = mongoose.model('bankaccount', BankAccountSchema);
export default BankAccount;

import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    taskId: { type: String, required: true, unique: true },
    taskName: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    staffId: { type: String, required: true, index: true },
    dueDate: { type: Number, required: true },
    attachmentUrl: [
      {
        url: { type: String, trim: true }
      }
    ],
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED', 'NEED_MORE_TIME'],
      default: 'PENDING'
    },
    remarks: { type: String, trim: true, default: null },
    isdeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

export default mongoose.model('Task', taskSchema, 'tasks');

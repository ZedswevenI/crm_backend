import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const supportTicketSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    ticketId: { type: String, required: true, default: uuid, index: true },
    studentNo: { type: String, required: true, index: true, trim: true },
    area: {
      type: String,
      enum: ['FEES', 'TIMETABLE', 'PTM', 'BOOKS_AND_STUDY', 'EXAMINATION', 'ACADEMICS', 'TAB', 'GENERAL'],
      required: true,
      index: true
    },
    issueSubject: { type: String, required: true, trim: true },
    issueDetails: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true
    },
    assignedStaffId: { type: String, trim: true, default: null, index: true },
    feedback: { type: String, trim: true, default: null },
    requestedAt: { type: Number, default: () => Date.now() },
    assignedAt: { type: Number, default: null },
    completedAt: { type: Number, default: null },
    reopenCount: { type: Number, default: 0 },
    reopenHistory: {
      type: [
        {
          reopenedAt: { type: Number, default: null },
          reason: { type: String, trim: true, default: null },
          reopenedBy: { type: String, trim: true, default: null },
          prevStatus: { type: String, trim: true, default: null }
        }
      ],
      default: []
    },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

supportTicketSchema.index({ tenantId: 1, ticketId: 1, isdeleted: 1 }, { unique: true });
supportTicketSchema.index({ tenantId: 1, studentNo: 1, isdeleted: 1 });
supportTicketSchema.index({ tenantId: 1, area: 1, status: 1, isdeleted: 1 });

const SupportTicket = mongoose.model('supportticket', supportTicketSchema);
export default SupportTicket;

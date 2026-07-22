import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const notificationSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    notificationId: { type: String, required: true, default: uuid, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: null },
    type: { type: String, trim: true, default: 'GENERAL', index: true },
    sourceModule: { type: String, trim: true, default: null },
    sourceRefId: { type: String, trim: true, default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Number, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ tenantId: 1, userId: 1, isRead: 1, isdeleted: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, userId: 1, isdeleted: 1 });

const Notification = mongoose.model('notification', notificationSchema);
export default Notification;

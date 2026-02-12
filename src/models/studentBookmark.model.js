import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const bookmarkSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    bookmarkId: { type: String, required: true, default: uuid, index: true },
    studentId: { type: String, required: true, ref: 'studentprofile', index: true },
    questionId: { type: String, required: true, ref: 'assignmentqns', index: true },
    assignmentId: { type: String, ref: 'assignment', default: null },
    subjectId: { type: String, ref: 'subject', default: null },
    note: { type: String, trim: true, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

bookmarkSchema.index({ tenantId: 1, studentId: 1, questionId: 1, isdeleted: 1 }, { unique: true });

const StudentBookmark = mongoose.model('studentbookmark', bookmarkSchema);
export default StudentBookmark;

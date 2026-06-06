import mongoose from 'mongoose';

const jeeMainSchema = new mongoose.Schema(
  {
    physics: { type: Number, default: null },
    chemistry: { type: Number, default: null },
    maths: { type: Number, default: null },
    total: { type: Number, default: null },
    rank: { type: Number, default: null },
    selected: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const jeeAdvPaperSchema = new mongoose.Schema(
  {
    physics: { type: Number, default: null },
    chemistry: { type: Number, default: null },
    maths: { type: Number, default: null },
    total: { type: Number, default: null }
  },
  { _id: false }
);

const jeeAdvSchema = new mongoose.Schema(
  {
    paper1: { type: jeeAdvPaperSchema, default: null },
    paper2: { type: jeeAdvPaperSchema, default: null },
    grandTotal: { type: Number, default: null },
    rank: { type: Number, default: null },
    selected: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const neetSchema = new mongoose.Schema(
  {
    physics: { type: Number, default: null },
    chemistry: { type: Number, default: null },
    biology: { type: Number, default: null },
    total: { type: Number, default: null },
    rank: { type: Number, default: null },
    collegeName: { type: String, trim: true, default: null },
    course: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const StudentAlumniSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    admissionNo: { type: String, required: true, trim: true, index: true },
    studentId: { type: String, trim: true, default: null, index: true },
    jeeMain: { type: jeeMainSchema, default: null },
    jeeAdv: { type: jeeAdvSchema, default: null },
    neet: { type: neetSchema, default: null },
    importedAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() }
  },
  { timestamps: true }
);

StudentAlumniSchema.index({ tenantId: 1, admissionNo: 1 }, { unique: true });

const StudentAlumni = mongoose.model('studentalumni', StudentAlumniSchema);
export default StudentAlumni;

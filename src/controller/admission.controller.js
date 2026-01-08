import axios from 'axios';
import constants from '../helpers/constants.js';
import Center from '../models/center.model.js';
import ScholarshipTest from '../models/scholarship.model.js';
import Admission from '../models/admission.model.js'; // your schema :contentReference[oaicite:1]{index=1}
import Payment from '../models/admissionpayments.model.js';
import Counter from '../models/counter.model.js';

const pickTenantId = (req) => String(req.body?.entiId || req.body?.tenantId || '').trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const toNum = (v) => {
  const n =
    typeof v === 'number'
      ? v
      : Number(
          String(v || '')
            .replace(/,/g, '')
            .trim()
        );
  return Number.isFinite(n) ? n : 0;
};
const pad = (n, len = 6) => String(n).padStart(len, '0');
const pickUserId = (req) => safeTrim(req.body?.userId);
const padN = (n, len = 4) => String(n).padStart(len, '0');
const hasTestMarks = (doc) => {
  if (!doc) return false;
  return doc.normalizedScore != null || doc.normalizedPercentage != null || doc.normalizedRank != null || doc.waiverPerInTf != null || doc.gtotal != null || doc.paper1Total != null || doc.paper2Total != null;
};

const fetchScholarshipRegistration = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const registrationNumber = safeTrim(req.body?.registrationNumber);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    if (!registrationNumber) {
      return res.status(400).json({ status: false, message: 'registrationNumber is required' });
    }
    const existingAdmission = await Admission.findOne({ tenantId, registrationNumber, isdeleted: false }, { _id: 0, admissionId: 1, admissionNo: 1, registrationNumber }).lean();
    if (existingAdmission) {
      return res.status(400).json({
        status: false,
        message: 'Admission already exists for this registration number',
        data: {
          admissionId: existingAdmission.admissionId || null,
          admissionNo: existingAdmission.admissionNo || null
        }
      });
    }
    const cachedExisting = await ScholarshipTest.findOne({ tenantId, registrationNumber, isdeleted: false }).lean();
    if (cachedExisting && hasTestMarks(cachedExisting)) {
      return res.status(200).json({
        status: true,
        message: 'Scholarship registration loaded from cache',
        data: cachedExisting,
        source: 'cache'
      });
    }
    const host = process.env.EXTERNAL_PORTAL_HOST;
    const apiKey = process.env.EXTERNAL_PORTAL_API_KEY;
    if (!host || !apiKey) {
      return res.status(500).json({
        status: false,
        message: 'External portal config missing (EXTERNAL_PORTAL_HOST / EXTERNAL_PORTAL_API_KEY)'
      });
    }
    const url = `${host}/api/v1/external/crm/${encodeURIComponent(registrationNumber)}`;
    let resp;
    try {
      resp = await axios.get(url, {
        headers: { 'X-Z7i-CRM-Key': apiKey },
        timeout: 15000
      });
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      if (status === 401) {
        await ScholarshipTest.updateOne(
          { tenantId, registrationNumber, isdeleted: false },
          {
            $set: {
              lastSyncAt: new Date(),
              lastSyncStatus: 'UNAUTHORIZED',
              lastSyncMessage: data?.message || 'Invalid API Key',
              raw: data || null,
              createdBy: req.body.userId,
              updatedBy: req.body.userId
            }
          },
          { upsert: true }
        );
        return res.status(401).json({
          status: false,
          message: 'External portal unauthorized (Invalid API Key)'
        });
      }
      if (status === 404) {
        await ScholarshipTest.updateOne(
          { tenantId, registrationNumber, isdeleted: false },
          {
            $set: {
              lastSyncAt: new Date(),
              lastSyncStatus: 'NOT_FOUND',
              lastSyncMessage: data?.message || 'Registration not found',
              raw: data || null,
              createdBy: req.body.userId,
              updatedBy: req.body.userId
            }
          },
          { upsert: true }
        );
        return res.status(404).json({ status: false, message: 'Registration not found' });
      }
      await ScholarshipTest.updateOne(
        { tenantId, registrationNumber, isdeleted: false },
        {
          $set: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'ERROR',
            lastSyncMessage: data?.message || e?.message || 'External error',
            raw: data || null,
            createdBy: req.body.userId,
            updatedBy: req.body.userId
          }
        },
        { upsert: true }
      );
      return res.status(500).json({
        status: false,
        message: 'External portal error',
        error: data || e?.message
      });
    }
    const body = resp?.data;
    if (!body?.success || !body?.data) {
      await ScholarshipTest.updateOne(
        { tenantId, registrationNumber, isdeleted: false },
        {
          $set: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'ERROR',
            lastSyncMessage: body?.message || 'Invalid external response',
            raw: body || null,
            createdBy: req.body.userId,
            updatedBy: req.body.userId
          }
        },
        { upsert: true }
      );
      return res.status(500).json({
        status: false,
        message: 'Invalid response from external portal'
      });
    }
    const d = body.data;
    const up = {
      tenantId,
      registrationNumber: safeTrim(d.registrationNumber),
      studentId: safeTrim(d.studentId) || null,
      firstName: safeTrim(d.firstName) || null,
      lastName: safeTrim(d.lastName) || null,
      name: safeTrim(d.name) || null,
      email: safeTrim(d.email) ? safeTrim(d.email).toLowerCase() : null,
      mobileNo: safeTrim(d.mobileNo) || null,
      dateOfBirth: safeTrim(d.dateOfBirth) || null,
      gender: safeTrim(d.gender) || null,
      fatherName: safeTrim(d.fatherName) || null,
      motherName: safeTrim(d.motherName) || null,
      address: safeTrim(d.address) || null,
      city: safeTrim(d.city) || null,
      schoolName: safeTrim(d.schoolName) || null,
      className: safeTrim(d.className) || null,
      testDate: safeTrim(d.testDate) || null,
      testCity: safeTrim(d.testCity) || null,
      testCentre: safeTrim(d.testCentre) || null,
      centerCode: safeTrim(d.centerCode) || null,
      programName: safeTrim(d.programName) || null,
      programCode: safeTrim(d.programCode) || null,
      paper1Total: safeTrim(d.paper1Total) || null,
      paper2Total: safeTrim(d.paper2Total) || null,
      gtotal: safeTrim(d.gtotal) || null,
      normalizedScore: d.normalizedScore ?? null,
      normalizedPercentage: d.normalizedPercentage ?? null,
      normalizedRank: d.normalizedRank ?? null,
      resultCategory: safeTrim(d.resultCategory) || null,
      programOffered1: safeTrim(d.programOffered1) || null,
      programOffered2: safeTrim(d.programOffered2) || null,
      waiverPerInTf: d.waiverPerInTf === null || d.waiverPerInTf === undefined ? null : Number(d.waiverPerInTf),
      studyCentre: safeTrim(d.studyCentre) || null,
      lastSyncAt: new Date(),
      lastSyncStatus: 'SUCCESS',
      lastSyncMessage: body?.message || 'OK',
      raw: body,
      createdBy: req.body.userId
    };
    const cached = await ScholarshipTest.findOneAndUpdate({ tenantId, registrationNumber: up.registrationNumber, isdeleted: false }, { $set: up, $setOnInsert: { isdeleted: false, status: 'Active' } }, { new: true, upsert: true }).lean();
    return res.status(200).json({
      status: true,
      message: 'Scholarship registration retrieved',
      data: cached,
      source: 'external'
    });
  } catch (err) {
    return next(err);
  }
};

const academicYear3 = (academicYearRaw) => {
  const s = safeTrim(academicYearRaw);
  const m = s.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (m) {
    const y1 = m[1];
    const y2 = m[2];
    return `${y1.slice(2, 4)}${y2.slice(3, 4)}`;
  }
  const m2 = s.match(/(\d{4})/);
  if (m2) return `${m2[1].slice(1, 4)}`;
  return '000';
};

const nextAdmissionRegNo = async ({ tenantId, programCode, centerCode, academicYear }) => {
  const p = safeTrim(programCode).toUpperCase();
  const c = safeTrim(centerCode).toUpperCase();
  const y3 = academicYear3(academicYear);
  if (!p || !c) {
    throw new Error('programCode and centerCode are required to generate registration number');
  }
  const key = `ADM_REG_${p}_${c}_${y3}`;
  const counter = await Counter.findOneAndUpdate({ tenantId, key }, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  const seq = Number(counter?.seq || 0);
  return `${p}${c}${y3}${padN(seq, 4)}`;
};

const createAdmissionDraft = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const p = req.body || {};
    const academicYear = safeTrim(p.academicYear);
    const sourceType = safeTrim(p.sourceType);
    const feePlanId = safeTrim(p.feePlanId);
    const centerName = safeTrim(p.centerName);
    const programName = safeTrim(p.programName);
    if (!academicYear || !sourceType || !feePlanId || !centerName || !programName) {
      return res.status(400).json({
        status: false,
        message: 'academicYear, sourceType, feePlanId, centerName, programName are required'
      });
    }
    const student = p.student || {};
    if (!safeTrim(student.name) || !safeTrim(student.phone)) {
      return res.status(400).json({ status: false, message: 'student.name and student.phone are required' });
    }
    const doc = await Admission.create({
      tenantId,
      academicYear,
      sourceType,
      registrationNumber: safeTrim(p.registrationNumber) || null,
      portalStudentId: safeTrim(p.portalStudentId) || null,
      scholarshipTestId: safeTrim(p.scholarshipTestId) || null,
      student: {
        name: safeTrim(student.name),
        firstName: safeTrim(student.firstName) || null,
        lastName: safeTrim(student.lastName) || null,
        email: safeTrim(student.email) ? safeTrim(student.email).toLowerCase() : null,
        phone: safeTrim(student.phone),
        dateOfBirth: safeTrim(student.dateOfBirth) || null,
        gender: safeTrim(student.gender) || null,
        fatherName: safeTrim(student.fatherName) || null,
        motherName: safeTrim(student.motherName) || null,
        parentName: safeTrim(student.parentName) || null,
        parentPhone: safeTrim(student.parentPhone) || null,
        address: safeTrim(student.address) || null,
        city: safeTrim(student.city) || null,
        schoolName: safeTrim(student.schoolName) || null,
        className: safeTrim(student.className) || null
      },
      centerId: safeTrim(p.centerId) || null,
      centerName,
      programId: safeTrim(p.programId) || null,
      programName,
      programCode: safeTrim(p.programCode) || null,
      batchId: safeTrim(p.batchId) || null,
      batchName: safeTrim(p.batchName) || null,
      classLabel: safeTrim(p.classLabel) || null,
      test: p.test || {},
      feePlanId,
      feePlanCode: safeTrim(p.feePlanCode) || null,
      fee: {
        baseFee: toNum(p.fee?.baseFee),
        finalFee: toNum(p.fee?.finalFee),
        testScholarshipPct: toNum(p.fee?.testScholarshipPct),
        scholarshipPct: toNum(p.fee?.scholarshipPct),
        additionalScholarshipPct: toNum(p.fee?.additionalScholarshipPct),
        totalDiscountPct: toNum(p.fee?.totalDiscountPct),
        breakup: Array.isArray(p.fee?.breakup) ? p.fee.breakup : []
      },
      payments: {
        neft: { splitAmount: toNum(p.payments?.neft?.splitAmount), refs: [], totalEntered: 0 },
        chequeSummary: { totalCheques: 0, totalAmount: 0, pendingCount: 0, clearedCount: 0, bouncedCount: 0 }
      },
      workflow: {
        stage: 'DRAFT'
      },
      status: 'Active',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });
    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Admission draft created',
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const saveAdmissionPayments = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false });
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    const neftRefs = Array.isArray(req.body?.neftRefs) ? req.body.neftRefs : [];
    const cheques = Array.isArray(req.body?.cheques) ? req.body.cheques : [];
    await Payment.updateMany({ tenantId, admissionId, isdeleted: false }, { $set: { isdeleted: true } });
    const docs = [];
    for (const r of neftRefs) {
      const utr = safeTrim(r.utr);
      const amt = toNum(r.amount);
      if (!utr || amt <= 0) continue;
      docs.push({
        tenantId,
        admissionId,
        admissionNo: admission.admissionNo || null,
        academicYear: admission.academicYear || null,
        centerId: admission.centerId || null,
        centerName: admission.centerName,
        programId: admission.programId || null,
        programName: admission.programName,
        programCode: admission.programCode || null,
        studentName: admission.student?.name || '',
        studentPhone: admission.student?.phone || null,
        registrationNumber: admission.registrationNumber || null,
        paymentType: 'NEFT',
        amount: amt,
        remarks: safeTrim(r.remarks) || null,
        status: 'SUBMITTED',
        submittedOn: safeTrim(r.paidOn) || null,
        neft: {
          utr,
          paidOn: safeTrim(r.paidOn) || null,
          bankName: safeTrim(r.bankName) || null,
          referenceNote: safeTrim(r.referenceNote) || null
        }
      });
    }
    for (const c of cheques) {
      const chequeNo = safeTrim(c.chequeNo);
      const dueDate = safeTrim(c.dueDate);
      const favourOf = safeTrim(c.favourOf);
      const mode = safeTrim(c.mode);
      const amt = toNum(c.amount);
      if (!chequeNo || !dueDate || !favourOf || !['PDC', 'CDC'].includes(mode) || amt <= 0) continue;
      docs.push({
        tenantId,
        admissionId,
        admissionNo: admission.admissionNo || null,
        academicYear: admission.academicYear || null,
        centerId: admission.centerId || null,
        centerName: admission.centerName,
        programId: admission.programId || null,
        programName: admission.programName,
        programCode: admission.programCode || null,
        studentName: admission.student?.name || '',
        studentPhone: admission.student?.phone || null,
        registrationNumber: admission.registrationNumber || null,
        paymentType: 'CHEQUE',
        amount: amt,
        remarks: safeTrim(c.remarks) || null,
        status: 'PENDING',
        cheque: {
          sno: c.sno ?? null,
          chequeNo,
          chequeDate: safeTrim(c.chequeDate) || null,
          dueDate,
          favourOf,
          mode,
          bankName: safeTrim(c.bankName) || null
        }
      });
    }
    if (!docs.length) {
      return res.status(400).json({ status: false, message: 'No valid NEFT/cheque rows provided' });
    }
    await Payment.insertMany(docs);
    const chequeRows = docs.filter((d) => d.paymentType === 'CHEQUE');
    const neftRows = docs.filter((d) => d.paymentType === 'NEFT');
    const chequeTotal = chequeRows.reduce((s, x) => s + toNum(x.amount), 0);
    const neftTotal = neftRows.reduce((s, x) => s + toNum(x.amount), 0);
    admission.payments = admission.payments || {};
    admission.payments.neft = admission.payments.neft || { splitAmount: 0, refs: [], totalEntered: 0 };
    admission.payments.neft.totalEntered = Number(neftTotal.toFixed(2));
    admission.payments.chequeSummary = {
      totalCheques: chequeRows.length,
      totalAmount: Number(chequeTotal.toFixed(2)),
      pendingCount: chequeRows.length,
      clearedCount: 0,
      bouncedCount: 0
    };
    admission.workflow = admission.workflow || {};
    admission.workflow.stage = 'PAYMENTS_SUBMITTED';
    admission.workflow.paymentsSubmittedAt = new Date();
    admission.updatedBy = userId;
    await admission.save();
    return res.status(200).json({
      status: true,
      message: 'Payments saved',
      data: {
        admissionId: admission.admissionId,
        neftCount: neftRows.length,
        chequeCount: chequeRows.length,
        neftTotal: Number(neftTotal.toFixed(2)),
        chequeTotal: Number(chequeTotal.toFixed(2))
      }
    });
  } catch (err) {
    return next(err);
  }
};

const submitForApproval = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false });
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    if (admission.workflow?.stage === 'DRAFT') {
      return res.status(400).json({ status: false, message: 'Submit payments first' });
    }
    admission.workflow.stage = 'APPROVAL_SENT';
    admission.workflow.approvalSentAt = new Date();
    admission.updatedBy = userId;
    await admission.save();
    return res.status(200).json({ status: true, message: 'Sent for approval', data: { admissionId } });
  } catch (err) {
    return next(err);
  }
};

const approveAdmission = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    const userId = safeTrim(req.user?.userId || req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false });
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    if (admission.workflow?.stage !== 'APPROVAL_SENT') {
      return res.status(400).json({ status: false, message: 'Admission must be in APPROVAL_SENT stage' });
    }
    const programCode = safeTrim(admission.programCode);
    const centerId = safeTrim(admission?.centerId);
    const centerCoderaw = await Center.findOne({ centerId: centerId }, { centerCode: 1 });
    const centerCode = centerCoderaw.centerCode;
    const studentRegNo = await nextAdmissionRegNo({ tenantId, programCode, centerCode, academicYear: admission.academicYear });
    admission.student = admission.student || {};
    admission.admissionNo = studentRegNo;
    admission.student.studentRegNo = studentRegNo;
    admission.workflow.stage = 'CONFIRMED';
    admission.workflow.approvedBy = userId || null;
    admission.workflow.approvedAt = new Date();
    admission.workflow.confirmedAt = new Date();
    admission.updatedBy = userId;
    admission.approvedBy = userId;
    await admission.save();
    return res.status(200).json({
      status: true,
      message: 'Admission approved',
      data: { admissionId, studentRegNo }
    });
  } catch (err) {
    return next(err);
  }
};

const viewAdmission = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false }).lean();
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    const payments = await Payment.find({ tenantId, admissionId, isdeleted: false }).sort({ createdAt: 1 }).lean();
    return res.status(200).json({ status: true, data: { admission, payments } });
  } catch (err) {
    return next(err);
  }
};

const listAdmissions = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const q = req.query || {};
    const registrationNumber = safeTrim(q.registrationNumber);
    const pageNum = Math.max(parseInt(q.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const query = {
      tenantId,
      isdeleted: false
    };
    if (safeTrim(q.includeInactive).toLowerCase() !== 'yes') {
      query.status = 'Active';
    }
    if (registrationNumber) {
      query.registrationNumber = {
        $regex: registrationNumber,
        $options: 'i'
      };
    }
    const [rows, total] = await Promise.all([
      Admission.find(query, {
        _id: 0,
        admissionId: 1,
        admissionNo: 1,
        academicYear: 1,
        registrationNumber: 1,
        centerId: 1,
        centerName: 1,
        programId: 1,
        programName: 1,
        programCode: 1,
        'student.name': 1,
        'student.phone': 1,
        status: 1,
        'workflow.stage': 1,
        createdAt: 1
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Admission.countDocuments(query)
    ]);
    return res.status(200).json({
      status: true,
      message: 'Admissions list fetched',
      data: {
        rows,
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 0
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  fetchScholarshipRegistration,
  createAdmissionDraft,
  saveAdmissionPayments,
  submitForApproval,
  approveAdmission,
  viewAdmission,
  listAdmissions
};

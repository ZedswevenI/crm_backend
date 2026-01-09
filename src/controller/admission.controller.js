import axios from 'axios';
import constants from '../helpers/constants.js';
import Center from '../models/center.model.js';
import ScholarshipTest from '../models/scholarship.model.js';
import Admission from '../models/admission.model.js';
import Payment from '../models/admissionpayments.model.js';
import Counter from '../models/counter.model.js';
import FeePlan from '../models/feeplan.model.js';

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
        status: true,
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
      testName: safeTrim(d.testName) || null,
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
    const sm = p.schoolMarks || {};
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
      schoolMarks: {
        overallPct: sm.overallPct === '' || sm.overallPct === null || sm.overallPct === undefined ? null : toNum(sm.overallPct),
        coreSubjectPct: sm.coreSubjectPct === '' || sm.coreSubjectPct === null || sm.coreSubjectPct === undefined ? null : toNum(sm.coreSubjectPct),
        remarks: safeTrim(sm.remarks) || null
      },
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
    if (!['PAYMENTS_SUBMITTED', 'FEE_CALC_GENERATED'].includes(String(admission.workflow?.stage || ''))) {
      return res.status(400).json({ status: false, message: 'Payments must be submitted before sending for approval' });
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
    const feePlan = await FeePlan.findOne({ tenantId, feePlanId: admission?.feePlanId, isdeleted: false }, { _id: 0, feePlanName: 1, feePlanCode: 1 }).lean();
    admission.feePlanName = feePlan?.feePlanName || null;
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
    const pageNum = Math.max(parseInt(q.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const registrationNumber = safeTrim(q.registrationNumber);
    const admissionNo = safeTrim(q.admissionNo);
    const search = safeTrim(q.search);
    const statusFilter = safeTrim(q.status).toLowerCase();
    const query = { tenantId, isdeleted: false };
    if (safeTrim(q.includeInactive).toLowerCase() !== 'yes') {
      query.status = 'Active';
    }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'approved') query['workflow.stage'] = 'CONFIRMED';
      else if (statusFilter === 'rejected') query['workflow.stage'] = 'REJECTED';
      else if (statusFilter === 'waiting' || statusFilter === 'waitingforapproval') query['workflow.stage'] = 'APPROVAL_SENT';
    }
    if (registrationNumber) {
      query.registrationNumber = { $regex: registrationNumber, $options: 'i' };
    }
    if (admissionNo) {
      query.admissionNo = { $regex: admissionNo, $options: 'i' };
    }
    if (search) {
      query.$or = [{ admissionNo: { $regex: search, $options: 'i' } }, { registrationNumber: { $regex: search, $options: 'i' } }, { 'student.name': { $regex: search, $options: 'i' } }, { 'student.phone': { $regex: search, $options: 'i' } }];
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
        'workflow.approvedAt': 1,
        'workflow.finalFee': 1,
        fee: 1,
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

const rejectAdmission = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    const reason = safeTrim(req.body?.reason);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    if (!userId) return res.status(400).json({ status: false, message: 'userId is required' });
    if (!reason) return res.status(400).json({ status: false, message: 'reason is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false });
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    if (admission.workflow?.stage !== 'APPROVAL_SENT') {
      return res.status(400).json({
        status: false,
        message: 'Only admissions in APPROVAL_SENT stage can be rejected'
      });
    }
    admission.workflow.stage = 'REJECTED';
    admission.workflow.rejectedAt = new Date();
    admission.workflow.rejectedBy = userId;
    admission.workflow.rejectionReason = reason || null;
    admission.updatedBy = userId;
    await admission.save();
    return res.status(200).json({
      status: true,
      message: 'Admission rejected',
      data: { admissionId, stage: admission.workflow.stage }
    });
  } catch (err) {
    return next(err);
  }
};

const updateAdmission = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    if (!userId) return res.status(400).json({ status: false, message: 'userId is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false });
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    const stage = safeTrim(admission?.workflow?.stage).toUpperCase();
    if (!['DRAFT', 'REJECTED'].includes(stage)) {
      return res.status(400).json({
        status: false,
        message: 'Only DRAFT/REJECTED admissions can be edited'
      });
    }
    const p = req.body || {};
    const student = p.student || {};
    const test = p.test || {};
    const fee = p.fee || {};
    const sm = p.schoolMarks || {};
    if (safeTrim(student.name)) admission.student.name = safeTrim(student.name);
    if (safeTrim(student.phone)) admission.student.phone = safeTrim(student.phone);
    if (student.email !== undefined) admission.student.email = safeTrim(student.email) ? safeTrim(student.email).toLowerCase() : null;
    if (student.parentName !== undefined) admission.student.parentName = safeTrim(student.parentName) || null;
    if (student.parentPhone !== undefined) admission.student.parentPhone = safeTrim(student.parentPhone) || null;
    if (student.address !== undefined) admission.student.address = safeTrim(student.address) || null;
    if (student.city !== undefined) admission.student.city = safeTrim(student.city) || null;
    if (student.className !== undefined) admission.student.className = safeTrim(student.className) || null;
    if (p.centerId !== undefined) admission.centerId = safeTrim(p.centerId) || null;
    if (p.centerName !== undefined) admission.centerName = safeTrim(p.centerName) || admission.centerName;
    if (p.programId !== undefined) admission.programId = safeTrim(p.programId) || null;
    if (p.programName !== undefined) admission.programName = safeTrim(p.programName) || admission.programName;
    if (p.programCode !== undefined) admission.programCode = safeTrim(p.programCode) || null;
    if (p.batchId !== undefined) admission.batchId = safeTrim(p.batchId) || null;
    if (p.batchName !== undefined) admission.batchName = safeTrim(p.batchName) || null;
    if (p.classLabel !== undefined) admission.classLabel = safeTrim(p.classLabel) || null;
    if (Object.keys(test).length) {
      admission.test = admission.test || {};
      Object.assign(admission.test, test);
    }
    if (p.feePlanId !== undefined) admission.feePlanId = safeTrim(p.feePlanId) || admission.feePlanId;
    if (p.feePlanCode !== undefined) admission.feePlanCode = safeTrim(p.feePlanCode) || admission.feePlanCode;
    admission.fee = admission.fee || {};
    if (fee.baseFee !== undefined) admission.fee.baseFee = toNum(fee.baseFee);
    if (fee.finalFee !== undefined) admission.fee.finalFee = toNum(fee.finalFee);
    if (fee.testScholarshipPct !== undefined) admission.fee.testScholarshipPct = toNum(fee.testScholarshipPct);
    if (fee.scholarshipPct !== undefined) admission.fee.scholarshipPct = toNum(fee.scholarshipPct);
    if (fee.additionalScholarshipPct !== undefined) admission.fee.additionalScholarshipPct = toNum(fee.additionalScholarshipPct);
    if (fee.totalDiscountPct !== undefined) admission.fee.totalDiscountPct = toNum(fee.totalDiscountPct);
    if (Array.isArray(fee.breakup)) admission.fee.breakup = fee.breakup;
    admission.schoolMarks = admission.schoolMarks || {};
    if (sm.overallPct !== undefined) admission.schoolMarks.overallPct = sm.overallPct === '' ? null : toNum(sm.overallPct);
    if (sm.coreSubjectPct !== undefined) admission.schoolMarks.coreSubjectPct = sm.coreSubjectPct === '' ? null : toNum(sm.coreSubjectPct);
    if (sm.remarks !== undefined) admission.schoolMarks.remarks = safeTrim(sm.remarks) || null;
    admission.workflow = admission.workflow || {};
    if (stage === 'REJECTED') {
      admission.workflow.stage = 'DRAFT';
      admission.workflow.rejectionReason = admission.workflow.rejectionReason;
    }
    admission.updatedBy = userId;
    await admission.save();
    return res.status(200).json({
      status: true,
      message: 'Admission updated',
      data: { admissionId: admission.admissionId, stage: admission.workflow.stage }
    });
  } catch (err) {
    return next(err);
  }
};

const getPaymentTemplate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false }).lean();
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    const feePlanId = safeTrim(admission?.feePlanId);
    if (!feePlanId) return res.status(400).json({ status: false, message: 'feePlanId missing in admission' });
    const feePlan = await FeePlan.findOne({ tenantId, feePlanId, isdeleted: false }).lean();
    if (!feePlan) return res.status(404).json({ status: false, message: 'Fee plan not found' });
    const instalments = Array.isArray(feePlan.instalments) ? feePlan.instalments : [];
    const chequeTemplate = instalments
      .sort((a, b) => toNum(a.seq) - toNum(b.seq))
      .map((x, idx) => {
        const sno = Number.isFinite(Number(x.seq)) ? Number(x.seq) : idx + 1;
        const label = safeTrim(x.label);
        const amount = toNum(x.amount);
        const dueDate = parseDateFromLabel(label);
        return {
          sno,
          instalmentLabel: label,
          chequeDate: null,
          dueDate,
          favourOf: safeTrim(admission?.centerName || admission?.academics?.centreName) || '—',
          mode: 'PDC',
          amount
        };
      });
    const neftSplitAmount = Number(admission?.payments?.neft?.splitAmount || 0);
    return res.status(200).json({
      status: true,
      message: 'Payment template loaded',
      data: {
        admissionId,
        feePlanId,
        neftSplitAmount,
        chequeTemplate
      }
    });
  } catch (err) {
    return next(err);
  }
};

function parseDateFromLabel(label) {
  const s = safeTrim(label);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = String(m[1]).padStart(2, '0');
    const mm = String(m[2]).padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export default {
  fetchScholarshipRegistration,
  createAdmissionDraft,
  saveAdmissionPayments,
  submitForApproval,
  approveAdmission,
  viewAdmission,
  listAdmissions,
  rejectAdmission,
  updateAdmission,
  getPaymentTemplate
};

import axios from 'axios';
import constants from '../helpers/constants.js';
import Center from '../models/center.model.js';
import ScholarshipTest from '../models/scholarship.model.js';
import Admission from '../models/admission.model.js';
import Payment from '../models/admissionpayments.model.js';
import Counter from '../models/counter.model.js';
import FeePlan from '../models/feeplan.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';
import { notifyUsers, getUserIdsByCenterAndRole } from '../helpers/pushNotification.helper.js';
import logger from '../helpers/logger.js';
import Program from '../models/program.model.js';
import AcademicYearConfig from '../models/academicYear.model.js';
import Batch from '../models/batch.model.js';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

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

const toEpochOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v > 0 ? v : 0;
  const n = Number(String(v).trim());
  if (Number.isFinite(n) && String(v).trim().match(/^\d+$/)) return n;
  const s = safeTrim(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const dd = Number(m[3]);
    return new Date(yyyy, mm, dd, 0, 0, 0, 0).getTime();
  }
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const yyyy = Number(m[3]);
    return new Date(yyyy, mm, dd, 0, 0, 0, 0).getTime();
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();
  return null;
};

const round2 = (n) => Number((toNum(n) || 0).toFixed(2));

const discountedAmountIfNeeded = ({ amount, discountApplied, fee }) => {
  const amt = toNum(amount);
  if (!discountApplied) return round2(amt);
  const t = toNum(fee?.testScholarshipPct);
  const s = toNum(fee?.scholarshipPct);
  const a = toNum(fee?.additionalScholarshipPct);
  const factor = (1 - t / 100) * (1 - s / 100) * (1 - a / 100);
  const out = amt * factor;
  return round2(out);
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

const toIntYear = (v) => {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
};

const buildCohortAndRunningYears = ({ startYear, duration }) => {
  const sy = toIntYear(startYear);
  const dur = toIntYear(duration);
  if (!sy || sy < 2000) return null;
  if (!dur || dur < 1 || dur > 6) return null;
  const endYear = sy + dur;
  const cohortAy = `${sy} - ${endYear}`;
  const runningYears = [];
  for (let i = 0; i < dur; i++) {
    const y1 = sy + i;
    const y2 = y1 + 1;
    runningYears.push(`${y1}-${y2}`);
  }
  return { startYear: sy, endYear, cohortAy, runningYears, currentAy: runningYears[0] || null };
};

const startOfAcademicYearEpoch = (year) => new Date(Number(year), 3, 1, 0, 0, 0, 0).getTime(); // Apr 1
const endOfAcademicYearEpoch = (year) => new Date(Number(year), 2, 31, 23, 59, 59, 999).getTime(); // Mar 31

const upsertAcademicYearConfigIfMissing = async ({ tenantId, programId, cohortAy, duration, runningYears, userId }) => {
  if (!tenantId || !programId || !cohortAy || !duration || !Array.isArray(runningYears) || !runningYears.length) return;
  const exists = await AcademicYearConfig.findOne({ tenantId, programId, cohortAy, isdeleted: false }, { _id: 1 }).lean();
  if (exists) return;
  const years = runningYears.map((ay) => {
    const m = String(ay).match(/^(\d{4})-(\d{4})$/);
    const y1 = m ? Number(m[1]) : 0;
    const y2 = m ? Number(m[2]) : 0;
    return {
      academicYear: ay,
      startOn: y1 ? startOfAcademicYearEpoch(y1) : null,
      endOn: y2 ? endOfAcademicYearEpoch(y2) : null
    };
  });
  await AcademicYearConfig.updateOne(
    { tenantId, programId, cohortAy, isdeleted: false },
    {
      $set: {
        tenantId,
        programId,
        cohortAy,
        duration: toIntYear(duration),
        years,
        status: 'Active',
        isdeleted: false,
        updatedBy: userId || null
      },
      $setOnInsert: { createdBy: userId || null }
    },
    { upsert: true }
  );
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

const fetchScholarshipRegistration = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const registrationNumber = safeTrim(req.body?.registrationNumber);
    const userId = pickUserId(req);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    if (!registrationNumber) {
      return res.status(400).json({ status: false, message: 'registrationNumber is required' });
    }
    const existingAdmission = await Admission.findOne({ tenantId, registrationNumber, isdeleted: false }).lean();
    if (existingAdmission) {
      return res.status(400).json({
        status: true,
        message: 'Admission already exists for this registration number',
        data: {
          admissionId: existingAdmission.admissionId || null,
          admissionNo: existingAdmission.admissionNo || null,
          admission: existingAdmission
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
      const syncSet = {
        lastSyncAt: Date.now(),
        lastSyncMessage: data?.message || e?.message || 'External error',
        raw: data || null,
        updatedBy: userId || null,
        ...(cachedExisting ? {} : { createdBy: userId || null })
      };
      if (status === 401) {
        await ScholarshipTest.updateOne({ tenantId, registrationNumber, isdeleted: false }, { $set: { ...syncSet, lastSyncStatus: 'UNAUTHORIZED' }, $setOnInsert: { status: 'Active', isdeleted: false, tenantId, registrationNumber } }, { upsert: true });
        return res.status(401).json({ status: false, message: 'External portal unauthorized (Invalid API Key)' });
      }
      if (status === 404) {
        await ScholarshipTest.updateOne({ tenantId, registrationNumber, isdeleted: false }, { $set: { ...syncSet, lastSyncStatus: 'NOT_FOUND' }, $setOnInsert: { status: 'Active', isdeleted: false, tenantId, registrationNumber } }, { upsert: true });
        return res.status(404).json({ status: false, message: 'Registration not found' });
      }
      await ScholarshipTest.updateOne({ tenantId, registrationNumber, isdeleted: false }, { $set: { ...syncSet, lastSyncStatus: 'ERROR' }, $setOnInsert: { status: 'Active', isdeleted: false, tenantId, registrationNumber } }, { upsert: true });
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
            lastSyncAt: Date.now(),
            lastSyncStatus: 'ERROR',
            lastSyncMessage: body?.message || 'Invalid external response',
            raw: body || null,
            updatedBy: userId || null,
            ...(cachedExisting ? {} : { createdBy: userId || null })
          },
          $setOnInsert: { status: 'Active', isdeleted: false, tenantId, registrationNumber }
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
      dateOfBirth: toEpochOrNull(d.dateOfBirth),
      gender: safeTrim(d.gender) || null,
      fatherName: safeTrim(d.fatherName) || null,
      motherName: safeTrim(d.motherName) || null,
      address: safeTrim(d.address) || null,
      city: safeTrim(d.city) || null,
      state: safeTrim(d.state) || null,
      pincode: safeTrim(d.pincode) || null,
      schoolName: safeTrim(d.schoolName) || null,
      className: safeTrim(d.className) || null,
      testDate: toEpochOrNull(d.testDate),
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
      lastSyncAt: Date.now(),
      lastSyncStatus: 'SUCCESS',
      lastSyncMessage: body?.message || 'OK',
      raw: body,
      updatedBy: userId || null
    };
    const cached = await ScholarshipTest.findOneAndUpdate({ tenantId, registrationNumber: up.registrationNumber, isdeleted: false }, { $set: up, $setOnInsert: { isdeleted: false, status: 'Active', createdBy: userId || null } }, { new: true, upsert: true }).lean();
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

const createAdmissionDraft = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const p = req.body || {};
    const sm = p.schoolMarks || {};
    const courseStartYear = toIntYear(p.courseStartYear);
    const sourceType = safeTrim(p.sourceType);
    const feePlanId = safeTrim(p.feePlanId);
    const centerName = safeTrim(p.centerName);
    const programName = safeTrim(p.programName);
    const programId = safeTrim(p.programId);
    if (!courseStartYear || !sourceType || !feePlanId || !centerName || !programName || !programId) {
      return res.status(400).json({
        status: false,
        message: 'courseStartYear, sourceType, feePlanId, centerName, programName, programId are required'
      });
    }
    const student = p.student || {};
    if (!safeTrim(student.name) || !safeTrim(student.phone)) {
      return res.status(400).json({ status: false, message: 'student.name and student.phone are required' });
    }
    const regNo = safeTrim(p.registrationNumber) || null;
    if (regNo) {
      const exists = await Admission.findOne({ tenantId, registrationNumber: regNo, isdeleted: false }, { _id: 0, admissionId: 1, admissionNo: 1 }).lean();
      if (exists) {
        return res.status(200).json({
          status: true,
          message: 'Admission already exists for this registration number',
          data: exists
        });
      }
    }
    const program = await Program.findOne({ tenantId, programId, isdeleted: false }, { duration: 1, startingClass: 1 }).lean();
    if (!program) {
      return res.status(400).json({ status: false, message: 'Program not found' });
    }
    const calc = buildCohortAndRunningYears({ startYear: courseStartYear, duration: program.duration });
    if (!calc) {
      return res.status(400).json({ status: false, message: 'Invalid courseStartYear / program duration' });
    }
    await upsertAcademicYearConfigIfMissing({
      tenantId,
      programId,
      cohortAy: calc.cohortAy,
      duration: program.duration,
      runningYears: calc.runningYears,
      userId
    });

    const doc = await Admission.create({
      tenantId,
      academicYear: calc.cohortAy,
      courseStartYear: calc.startYear,
      currentAcademicYear: calc.currentAy,
      sourceType,
      registrationNumber: regNo,
      portalStudentId: safeTrim(p.portalStudentId) || null,
      scholarshipTestId: safeTrim(p.scholarshipTestId) || null,
      student: {
        name: safeTrim(student.name),
        firstName: safeTrim(student.firstName) || null,
        lastName: safeTrim(student.lastName) || null,
        email: safeTrim(student.email) ? safeTrim(student.email).toLowerCase() : null,
        phone: safeTrim(student.phone),
        dateOfBirth: student.dateOfBirth === undefined ? null : toEpochOrNull(student.dateOfBirth),
        gender: safeTrim(student.gender) || null,
        fatherName: safeTrim(student.fatherName) || null,
        motherName: safeTrim(student.motherName) || null,
        parentName: safeTrim(student.parentName) || null,
        parentPhone: safeTrim(student.parentPhone) || null,
        address: safeTrim(student.address) || null,
        city: safeTrim(student.city) || null,
        state: safeTrim(student.state) || null,
        pincode: safeTrim(student.pincode) || null,
        schoolName: safeTrim(student.schoolName) || null,
        className: safeTrim(student.className) || null
      },
      centerId: safeTrim(p.centerId) || null,
      centerName,
      programId: safeTrim(p.programId),
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
      workflow: { stage: 'DRAFT' },
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
    const otherPayments = Array.isArray(req.body?.otherPayments) ? req.body.otherPayments : [];
    const locked = await Payment.exists({
      tenantId,
      admissionId,
      isdeleted: false,
      paymentType: 'CHEQUE',
      status: { $in: ['DEPOSITED', 'CLEARED', 'FAILED', 'CANCELLED'] }
    });
    if (locked) {
      return res.status(400).json({
        status: false,
        message: 'Payments cannot be edited because some cheques are already processed (Deposited/Cleared/Failed/Cancelled).'
      });
    }
    const feePlanId = safeTrim(admission?.feePlanId);
    const feePlan = feePlanId ? await FeePlan.findOne({ tenantId, feePlanId, isdeleted: false }).lean() : null;
    if (!feePlan) return res.status(400).json({ status: false, message: 'Fee plan missing / not found for admission' });
    const instalmentsRaw = Array.isArray(feePlan.instalments) ? feePlan.instalments : [];
    const discountedInstalments = instalmentsRaw
      .slice()
      .sort((a, b) => toNum(a.seq) - toNum(b.seq))
      .map((x, idx) => {
        const dueDate = typeof x.instalmentDate === 'number' ? x.instalmentDate : toEpochOrNull(x.instalmentDate);
        const discountApplied = !!x.discountApplied;
        const amt = discountedAmountIfNeeded({ amount: x.amount, discountApplied, fee: admission?.fee });
        return {
          seq: Number.isFinite(Number(x.seq)) ? Number(x.seq) : idx + 1,
          instalmentDate: Number.isFinite(Number(dueDate)) ? Number(dueDate) : null,
          amount: amt
        };
      });
    const allowedByDate = new Map();
    for (const i of discountedInstalments) {
      const k = toNum(i.instalmentDate);
      const prev = allowedByDate.get(k) || 0;
      allowedByDate.set(k, round2(prev + toNum(i.amount)));
    }
    const allowedNeft = round2(allowedByDate.get(0) || 0);
    const enteredNeft = round2(neftRefs.reduce((s, r) => s + toNum(r.amount), 0));
    const enteredChequeByDate = new Map();
    for (const c of cheques) {
      const dd = toNum(toEpochOrNull(c.dueDate));
      const amt = toNum(c.amount);
      if (!dd || amt <= 0) continue;
      enteredChequeByDate.set(dd, round2((enteredChequeByDate.get(dd) || 0) + amt));
    }
    await Payment.updateMany({ tenantId, admissionId, isdeleted: false }, { $set: { isdeleted: true } });
    const docs = [];
    for (const r of neftRefs) {
      const utr = safeTrim(r.utr);
      const amt = toNum(r.amount);
      const paidOn = toEpochOrNull(r.paidOn);
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
        submittedOn: paidOn,
        neft: {
          utr,
          paidOn,
          bankName: safeTrim(r.bankName) || null,
          branchName: safeTrim(r.branchName) || null,
          referenceNote: safeTrim(r.referenceNote) || null
        }
      });
    }
    const chequeMinDueByNo = new Map();
    for (const c of cheques) {
      const chequeNo = safeTrim(c.chequeNo);
      const dueDate = toEpochOrNull(c.dueDate);
      if (!chequeNo || !dueDate) continue;
      const prev = chequeMinDueByNo.get(chequeNo);
      if (!prev || dueDate < prev) chequeMinDueByNo.set(chequeNo, dueDate);
    }
    for (const c of cheques) {
      const chequeNo = safeTrim(c.chequeNo);
      const dueDate = toEpochOrNull(c.dueDate);
      const chequeDate = toEpochOrNull(c.chequeDate);
      const favourOf = safeTrim(c.favourOf);
      const mode = safeTrim(c.mode);
      const amt = toNum(c.amount);
      if (!chequeNo || !dueDate || !chequeDate || !favourOf || !['PDC', 'CDC'].includes(mode) || amt <= 0) continue;
      const plannedDepositDate = chequeMinDueByNo.get(chequeNo) || dueDate || null;
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
          chequeDate,
          dueDate,
          favourOf,
          mode,
          bankName: safeTrim(c.bankName) || null,
          branchName: safeTrim(c.branchName) || null,
          plannedDepositDate,
          instalmentLabel: safeTrim(c.description) || null,
          instalmentDate: dueDate || null
        },
        audit: [{ action: 'CREATE', by: userId || null, remarks: 'Created from admission payments' }]
      });
    }
    for (const o of otherPayments) {
      const mode = safeTrim(o.mode);
      const amt = toNum(o.amount);
      const paidOn = toEpochOrNull(o.paidOn);
      if (!mode || amt <= 0) continue;
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
        paymentType: 'OTHER',
        amount: amt,
        remarks: safeTrim(o.remarks) || null,
        status: 'SUBMITTED',
        submittedOn: paidOn,
        other: {
          mode,
          refNo: safeTrim(o.refNo) || null,
          paidOn,
          bankName: safeTrim(o.bankName) || null,
          branchName: safeTrim(o.branchName) || null,
          referenceNote: safeTrim(o.referenceNote) || null
        }
      });
    }
    if (!docs.length) return res.status(400).json({ status: false, message: 'No valid payment rows provided' });
    await Payment.insertMany(docs);
    const chequeRows = docs.filter((d) => d.paymentType === 'CHEQUE');
    const neftRows = docs.filter((d) => d.paymentType === 'NEFT');
    const otherRows = docs.filter((d) => d.paymentType === 'OTHER');
    const chequeTotal = chequeRows.reduce((s, x) => s + toNum(x.amount), 0);
    const neftTotal = neftRows.reduce((s, x) => s + toNum(x.amount), 0);
    const otherTotal = otherRows.reduce((s, x) => s + toNum(x.amount), 0);
    admission.payments = admission.payments || {};
    admission.payments.neft = admission.payments.neft || { splitAmount: 0, refs: [], totalEntered: 0 };
    admission.payments.neft.totalEntered = Number(neftTotal.toFixed(2));
    admission.payments.otherSummary = { totalCount: otherRows.length, totalAmount: Number(otherTotal.toFixed(2)) };
    admission.payments.chequeSummary = {
      totalCheques: chequeRows.length,
      totalAmount: Number(chequeTotal.toFixed(2)),
      pendingCount: chequeRows.length,
      clearedCount: 0,
      bouncedCount: 0
    };
    admission.workflow = admission.workflow || {};
    admission.workflow.stage = 'PAYMENTS_SUBMITTED';
    admission.workflow.paymentsSubmittedAt = Date.now();
    admission.updatedBy = userId;
    await admission.save();
    return res.status(200).json({
      status: true,
      message: 'Payments saved',
      data: {
        admissionId: admission.admissionId,
        neftCount: neftRows.length,
        chequeCount: chequeRows.length,
        otherCount: otherRows.length,
        neftTotal: Number(neftTotal.toFixed(2)),
        chequeTotal: Number(chequeTotal.toFixed(2)),
        otherTotal: Number(otherTotal.toFixed(2))
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
    if (!['PAYMENTS_SUBMITTED', 'FEE_CALC_GENERATED', 'UNDER_REVIEW'].includes(String(admission.workflow?.stage || ''))) {
      return res.status(400).json({ status: false, message: 'Payments must be submitted before sending for approval' });
    }
    admission.workflow.stage = 'APPROVAL_SENT';
    admission.workflow.approvalSentAt = Date.now();
    admission.updatedBy = userId;
    await admission.save();

    // Notify L1 users mapped to this admission's center that an admission is waiting for their approval
    (async () => {
      try {
        const centerId = safeTrim(admission.centerId);
        if (!centerId) return;
        const l1UserIds = await getUserIdsByCenterAndRole(tenantId, centerId, ['L1']);
        if (!l1UserIds.length) return;
        await notifyUsers({
          tenantId,
          userIds: l1UserIds,
          title: 'Admission Sent for Approval',
          body: `${safeTrim(admission.student?.name) || 'A student'}'s admission is waiting for your approval`,
          type: 'ADMISSION_APPROVAL_PENDING',
          sourceModule: 'ADMISSION',
          sourceRefId: admissionId,
          data: { type: 'ADMISSION_APPROVAL_PENDING', admissionId, centerId },
          createdBy: userId
        });
      } catch (e) {
        logger.error('[Admission] submitForApproval notify failed:', e?.message);
      }
    })();

    return res.status(200).json({ status: true, message: 'Sent for approval', data: { admissionId } });
  } catch (err) {
    return next(err);
  }
};

// Only field names (or dot-paths for nested fields, e.g. "student.name") — no operators.
const EXPORTABLE_FIELD_REGEX = /^[a-zA-Z0-9_.]+$/;

const exportAdmissions = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const fields = Array.isArray(req.body?.fields) ? req.body.fields.map((f) => safeTrim(f)).filter((f) => f && EXPORTABLE_FIELD_REGEX.test(f)) : [];
    if (!fields.length) return res.status(400).json({ status: false, message: 'fields[] is required — list the field names to include in the export' });

    const search = safeTrim(req.body?.search);
    const registrationNumber = safeTrim(req.body?.registrationNumber);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const programId = safeTrim(req.body?.programId);
    const programCode = safeTrim(req.body?.programCode);
    const centerId = safeTrim(req.body?.centerId);
    const batchId = safeTrim(req.body?.batchId);
    const academicYear = safeTrim(req.body?.academicYear);
    const statusFilter = safeTrim(req.body?.status).toLowerCase();
    const admissionIds = Array.isArray(req.body?.admissionIds) ? req.body.admissionIds.map(safeTrim).filter(Boolean) : [];
    const includeInactive = safeTrim(req.body?.includeInactive).toLowerCase() === 'yes';

    const query = { tenantId, isdeleted: false };
    if (!includeInactive) query.status = 'Active';
    if (centerId) query.centerId = centerId;
    if (batchId) query.batchId = batchId;
    if (programId) query.programId = programId;
    if (programCode) query.programCode = programCode;
    if (academicYear) query.academicYear = academicYear;
    if (admissionIds.length) query.admissionId = { $in: admissionIds };
    if (registrationNumber) query.registrationNumber = { $regex: registrationNumber, $options: 'i' };
    if (admissionNo) query.admissionNo = { $regex: admissionNo, $options: 'i' };
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'approved') query['workflow.stage'] = 'CONFIRMED';
      else if (statusFilter === 'rejected') query['workflow.stage'] = 'REJECTED';
      else if (statusFilter === 'waiting' || statusFilter === 'waitingforapproval') query['workflow.stage'] = 'APPROVAL_SENT';
      else if (statusFilter === 'underreview') query['workflow.stage'] = 'UNDER_REVIEW';
    }
    if (search) {
      query.$or = [{ admissionNo: { $regex: search, $options: 'i' } }, { registrationNumber: { $regex: search, $options: 'i' } }, { 'student.name': { $regex: search, $options: 'i' } }, { 'student.phone': { $regex: search, $options: 'i' } }];
    }

    const projection = { _id: 0 };
    for (const f of fields) projection[f] = 1;
    if (!projection.admissionId) projection.admissionId = 1; // always include as a row key

    const rows = await Admission.find(query, projection).lean();
    return res.status(200).json({
      status: true,
      message: 'Admission export data fetched',
      count: rows.length,
      data: rows
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
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false })
      .populate({ path: 'programId', model: 'program', localField: 'programId', foreignField: 'programId' })
      .populate({ path: 'createdBy', model: 'user', localField: 'createdBy', foreignField: 'userId', select: 'userId name email phone' })
      .lean();
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
    const centerId = safeTrim(q.centerId || req.body?.centerId);
    const query = { tenantId, isdeleted: false };
    if (centerId) query.centerId = centerId;
    if (safeTrim(q.includeInactive).toLowerCase() !== 'yes') {
      query.status = 'Active';
    }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'approved') query['workflow.stage'] = 'CONFIRMED';
      else if (statusFilter === 'rejected') query['workflow.stage'] = 'REJECTED';
      else if (statusFilter === 'waiting' || statusFilter === 'waitingforapproval') query['workflow.stage'] = 'APPROVAL_SENT';
      else if (statusFilter === 'underreview') query['workflow.stage'] = 'UNDER_REVIEW';
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
    admission.workflow.rejectedAt = Date.now();
    admission.workflow.rejectedBy = userId;
    admission.workflow.rejectionReason = reason || null;
    admission.updatedBy = userId;
    await admission.save();
    triggerCommunicationEventSafe({
      tenantId,
      eventCode: 'ADMISSION_REJECTED',
      admissionNo: admission.admissionNo,
      sourceModule: 'ADMISSION',
      sourceRefId: admissionId,
      userId,
      extraData: {
        admissionNo: admission.admissionNo || '',
        admissionStatus: 'Rejected',
        rejectionReason: reason,
        programName: safeTrim(admission.programName),
        centerName: safeTrim(admission.centerName),
        academicYear: safeTrim(admission.academicYear)
      }
    });
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
    if (!['DRAFT', 'REJECTED', 'UNDER_REVIEW'].includes(stage)) {
      return res.status(400).json({
        status: false,
        message: 'Only DRAFT/REJECTED/UNDER_REVIEW admissions can be edited'
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
    if (student.state !== undefined) admission.student.state = safeTrim(student.state) || null;
    if (student.pincode !== undefined) admission.student.pincode = safeTrim(student.pincode) || null;
    if (student.className !== undefined) admission.student.className = safeTrim(student.className) || null;
    if (student.dateOfBirth !== undefined) {
      admission.student.dateOfBirth = toEpochOrNull(student.dateOfBirth);
    }
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
      const t = { ...test };
      if (t.testDate !== undefined) t.testDate = toEpochOrNull(t.testDate);
      Object.assign(admission.test, t);
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
    if (stage === 'UNDER_REVIEW') {
      admission.workflow.stage = 'PAYMENTS_SUBMITTED';
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

function parseDateFromLabel(label) {
  return toEpochOrNull(label);
}

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

    const instalmentsRaw = Array.isArray(feePlan.instalments) ? feePlan.instalments : [];

    // ✅ build discounted instalment list (preserve count e.g., 26)
    const instalments = instalmentsRaw
      .slice()
      .sort((a, b) => toNum(a.seq) - toNum(b.seq))
      .map((x, idx) => {
        const seq = Number.isFinite(Number(x.seq)) ? Number(x.seq) : idx + 1;
        const label = safeTrim(x.label) || null;
        const feeHead = safeTrim(x.feeHead) || null;
        const dueDate = typeof x.instalmentDate === 'number' ? x.instalmentDate : toEpochOrNull(x.instalmentDate);
        const mode = safeTrim(x.mode) || null;
        const chequeFavour = safeTrim(x.chequeFavour) || safeTrim(admission?.centerName) || null;
        const discountApplied = !!x.discountApplied;

        const amt = discountedAmountIfNeeded({
          amount: x.amount,
          discountApplied,
          fee: admission?.fee
        });

        return {
          seq,
          feeHead,
          label,
          instalmentDate: Number.isFinite(Number(dueDate)) ? Number(dueDate) : null, // ✅ epoch (0 allowed)
          amount: amt,
          mode,
          chequeFavour,
          discountApplied
        };
      });
    const neftSplitAmount = round2(instalments.filter((i) => toNum(i.instalmentDate) === 0).reduce((s, i) => s + toNum(i.amount), 0));
    const byDateMap = new Map();
    for (const i of instalments) {
      const k = toNum(i.instalmentDate);
      const prev = byDateMap.get(k) || { instalmentDate: k, amount: 0 };
      prev.amount = round2(prev.amount + toNum(i.amount));
      byDateMap.set(k, prev);
    }
    const groupedByDate = Array.from(byDateMap.values()).sort((a, b) => toNum(a.instalmentDate) - toNum(b.instalmentDate));
    console.log('[getPaymentTemplate] discounted instalments =>', instalments);
    return res.status(200).json({
      status: true,
      message: 'Payment template loaded',
      data: {
        admissionId,
        feePlanId,
        neftSplitAmount,
        instalments,
        groupedByDate
      }
    });
  } catch (err) {
    return next(err);
  }
};

const upsertStudentProfileFromAdmission = async ({ tenantId, admission, userId }) => {
  if (!tenantId || !admission) return null;
  const admissionId = safeTrim(admission.admissionId);
  const admissionNo = safeTrim(admission.admissionNo);
  if (!admissionId || !admissionNo) return null;
  const student = admission.student || {};
  const programId = safeTrim(admission.programId) || null;
  let startingClass = null;
  let duration = null;
  if (programId) {
    const pg = await Program.findOne({ tenantId, programId, isdeleted: false }, { startingClass: 1, duration: 1 }).lean();
    startingClass = pg?.startingClass ?? null;
    duration = pg?.duration ?? null;
  }
  const courseStartYear = toIntYear(admission.courseStartYear);
  const calc = buildCohortAndRunningYears({
    startYear: courseStartYear || (safeTrim(admission.academicYear).match(/^(\d{4})/) ? RegExp.$1 : 0),
    duration: duration || 0
  });
  const cohortAy = safeTrim(admission.academicYear);
  const currentAy = safeTrim(admission.currentAcademicYear) || calc?.currentAy || null;
  const up = {
    tenantId,
    admissionId,
    admissionNo,
    registrationNumber: safeTrim(admission.registrationNumber) || null,
    portalStudentId: safeTrim(admission.portalStudentId) || null,
    student: {
      name: safeTrim(student.name),
      phone: safeTrim(student.phone),
      email: safeTrim(student.email) ? safeTrim(student.email).toLowerCase() : null,
      parentName: safeTrim(student.parentName) || safeTrim(student.fatherName) || null,
      parentPhone: safeTrim(student.parentPhone) || null,
      address: safeTrim(student.address) || null,
      city: safeTrim(student.city) || null,
      state: safeTrim(student.state) || null,
      pincode: safeTrim(student.pincode) || null
    },
    academicYear: safeTrim(admission.academicYear),
    programId: safeTrim(admission.programId) || null,
    programCode: safeTrim(admission.programCode) || null,
    programName: safeTrim(admission.programName) || null,
    centerId: safeTrim(admission.centerId) || null,
    centerCode: safeTrim(admission.centerCode) || null,
    centerName: safeTrim(admission.centerName) || null,
    courseStartYear: courseStartYear || calc?.startYear || null,
    currentAcademicYear: currentAy,
    yearNo: 1,
    classNo: startingClass,
    batchId: null,
    batchCode: null,
    status: 'ACTIVE',
    isdeleted: false,
    updatedBy: userId || null
  };
  const firstHist = {
    academicYear: currentAy || null,
    yearNo: 1,
    classNo: startingClass,
    changedOn: Date.now(),
    changedBy: userId || null
  };
  const existing = await StudentProfile.findOne({ tenantId, admissionNo, isdeleted: false }, { _id: 0, batchId: 1, batchCode: 1 }).lean();
  if (existing?.batchId) up.batchId = existing.batchId;
  if (existing?.batchCode) up.batchCode = existing.batchCode;
  const doc = await StudentProfile.findOneAndUpdate({ tenantId, admissionNo }, { $set: up, $setOnInsert: { createdBy: userId || null, ayHistory: [firstHist] } }, { new: true, upsert: true }).lean();
  return doc;
};

const approveAdmission = async (req, res, next) => {
  const session = await Admission.startSession();
  try {
    session.startTransaction();
    const tenantId = pickTenantId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    const userId = safeTrim(req.user?.userId || req.body?.userId);
    if (!tenantId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    if (!admissionId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: false, message: 'admissionId is required' });
    }
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false }).session(session);
    if (!admission) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ status: false, message: 'Admission not found' });
    }
    if (admission.workflow?.stage !== 'APPROVAL_SENT') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: false, message: 'Admission must be in APPROVAL_SENT stage' });
    }
    const programCode = safeTrim(admission.programCode);
    const centerId = safeTrim(admission?.centerId);
    const centerCoderaw = await Center.findOne({ centerId: centerId }, { centerCode: 1 }).session(session);
    const centerCode = safeTrim(centerCoderaw?.centerCode);
    const studentRegNo = await nextAdmissionRegNo({
      tenantId,
      programCode,
      centerCode,
      academicYear: admission.academicYear
    });
    admission.student = admission.student || {};
    admission.admissionNo = studentRegNo;
    admission.student.studentRegNo = studentRegNo;
    admission.workflow.stage = 'CONFIRMED';
    admission.workflow.approvedBy = userId || null;
    admission.workflow.approvedAt = Date.now();
    admission.workflow.confirmedAt = Date.now();
    admission.updatedBy = userId;
    admission.approvedBy = userId;
    await admission.save({ session });
    const programIdRaw = safeTrim(admission.programId);
    const program = programIdRaw ? await Program.findOne({ tenantId, programId: programIdRaw, isdeleted: false }, { duration: 1, startingClass: 1 }).session(session) : null;
    const courseStartYear = toIntYear(admission.courseStartYear);
    const calc = program ? buildCohortAndRunningYears({ startYear: courseStartYear, duration: program.duration }) : null;
    const cohortAy = safeTrim(admission.academicYear);
    const currentAy = safeTrim(admission.currentAcademicYear) || calc?.currentAy || null;
    const firstHist = {
      academicYear: currentAy || null,
      yearNo: 1,
      classNo: program?.startingClass ?? null,
      changedOn: Date.now(),
      changedBy: userId || null
    };
    const profile = await StudentProfile.findOneAndUpdate(
      { tenantId, admissionNo: studentRegNo },
      {
        $set: {
          tenantId,
          admissionId: safeTrim(admission.admissionId),
          admissionNo: studentRegNo,
          registrationNumber: safeTrim(admission.registrationNumber) || null,
          portalStudentId: safeTrim(admission.portalStudentId) || null,
          student: {
            name: safeTrim(admission.student?.name),
            phone: safeTrim(admission.student?.phone),
            email: safeTrim(admission.student?.email) ? safeTrim(admission.student?.email).toLowerCase() : null,
            parentName: safeTrim(admission.student?.parentName) || safeTrim(admission.student?.fatherName) || null,
            parentPhone: safeTrim(admission.student?.parentPhone) || null,
            address: safeTrim(admission.student?.address) || null,
            city: safeTrim(admission.student?.city) || null,
            state: safeTrim(admission.student?.state) || null,
            pincode: safeTrim(admission.student?.pincode) || null
          },
          academicYear: safeTrim(admission.academicYear),
          programId: safeTrim(admission.programId) || null,
          programCode: safeTrim(admission.programCode) || null,
          programName: safeTrim(admission.programName) || null,
          centerId: safeTrim(admission.centerId) || null,
          centerCode: safeTrim(centerCode) || null,
          centerName: safeTrim(admission.centerName) || null,
          courseStartYear: courseStartYear || calc?.startYear || null,
          currentAcademicYear: currentAy,
          yearNo: 1,
          classNo: program?.startingClass ?? null,
          status: 'ACTIVE',
          isdeleted: false,
          updatedBy: userId || null
        },
        $setOnInsert: { createdBy: userId || null, ayHistory: [firstHist] }
      },
      { new: true, upsert: true, session }
    );
    await session.commitTransaction();
    session.endSession();
    triggerCommunicationEventSafe({
      tenantId,
      eventCode: 'ADMISSION_CONFIRMED',
      admissionNo: studentRegNo,
      sourceModule: 'ADMISSION',
      sourceRefId: admissionId,
      userId,
      extraData: {
        admissionNo: studentRegNo,
        admissionStatus: 'Confirmed',
        programName: safeTrim(admission.programName),
        centerName: safeTrim(admission.centerName),
        academicYear: safeTrim(admission.academicYear)
      }
    });

    // Notify the person who originally entered this admission that it's approved & the student is mapped
    (async () => {
      try {
        const enteredBy = safeTrim(admission.createdBy);
        if (!enteredBy) return;
        await notifyUsers({
          tenantId,
          userIds: [enteredBy],
          title: 'Admission Approved',
          body: `${safeTrim(admission.student?.name) || 'Student'} (${studentRegNo}) has been approved and mapped`,
          type: 'ADMISSION_APPROVED',
          sourceModule: 'ADMISSION',
          sourceRefId: admissionId,
          data: { type: 'ADMISSION_APPROVED', admissionId, admissionNo: studentRegNo },
          createdBy: userId
        });
      } catch (e) {
        logger.error('[Admission] approveAdmission notify failed:', e?.message);
      }
    })();

    return res.status(200).json({
      status: true,
      message: 'Admission approved',
      data: { admissionId, studentRegNo, profileCreated: !!profile }
    });
  } catch (err) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch {}
    return next(err);
  }
};

const listConfirmedAdmissionsWithoutProfile = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const pageNum = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const search = safeTrim(req.query.search);
    const centerId = safeTrim(req.query.centerId || req.body?.centerId);
    const match = {
      tenantId,
      isdeleted: false,
      status: 'Active',
      'workflow.stage': 'CONFIRMED',
      admissionNo: { $ne: null }
    };
    if (centerId) match.centerId = centerId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      match.$or = [{ admissionNo: rx }, { registrationNumber: rx }, { 'student.name': rx }, { 'student.phone': rx }];
    }
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'studentprofiles',
          let: { t: '$tenantId', an: '$admissionNo' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$tenantId', '$$t'] }, { $eq: ['$admissionNo', '$$an'] }, { $eq: ['$isdeleted', false] }]
                }
              }
            },
            { $project: { _id: 0, admissionNo: 1 } }
          ],
          as: 'sp'
        }
      },
      { $match: { $or: [{ sp: { $exists: false } }, { sp: { $size: 0 } }] } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
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
                student: 1,
                'workflow.stage': 1,
                'workflow.confirmedAt': 1,
                createdAt: 1
              }
            }
          ],
          meta: [{ $count: 'total' }]
        }
      }
    ];
    const agg = await Admission.aggregate(pipeline);
    const rows = agg?.[0]?.rows || [];
    const total = agg?.[0]?.meta?.[0]?.total || 0;
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Confirmed admissions without student profile fetched',
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

const createStudentProfileFromAdmission = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.user?.userId || req.body?.userId);
    const admissionId = safeTrim(req.body?.admissionId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false }).lean();
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    const stage = safeTrim(admission?.workflow?.stage).toUpperCase();
    if (stage !== 'CONFIRMED') {
      return res.status(400).json({
        status: false,
        message: 'Admission is not CONFIRMED. Only confirmed admissions can create student profile.'
      });
    }
    const admissionNo = safeTrim(admission?.admissionNo);
    if (!admissionNo) {
      return res.status(400).json({
        status: false,
        message: 'admissionNo missing in confirmed admission. Please re-approve or fix admission.'
      });
    }
    const existing = await StudentProfile.findOne({ tenantId, admissionNo, isdeleted: false }, { _id: 0, studentId: 1, admissionNo: 1, batchId: 1, batchCode: 1 }).lean();
    if (existing) {
      return res.status(200).json({
        status: true,
        message: 'Student profile already exists',
        data: existing
      });
    }
    const student = admission.student || {};
    const programIdRaw = safeTrim(admission.programId);
    const program = programIdRaw ? await Program.findOne({ tenantId, programId: programIdRaw, isdeleted: false }, { duration: 1, startingClass: 1 }).lean() : null;
    const courseStartYear = toIntYear(admission.courseStartYear);
    const calc = program ? buildCohortAndRunningYears({ startYear: courseStartYear, duration: program.duration }) : null;
    const currentAy = safeTrim(admission.currentAcademicYear) || calc?.currentAy || null;
    const up = {
      tenantId,
      admissionId: safeTrim(admission.admissionId),
      admissionNo,
      registrationNumber: safeTrim(admission.registrationNumber) || null,
      portalStudentId: safeTrim(admission.portalStudentId) || null,
      student: {
        name: safeTrim(student.name),
        phone: safeTrim(student.phone),
        email: safeTrim(student.email) ? safeTrim(student.email).toLowerCase() : null,
        parentName: safeTrim(student.parentName) || safeTrim(student.fatherName) || null,
        parentPhone: safeTrim(student.parentPhone) || null,
        address: safeTrim(student.address) || null,
        city: safeTrim(student.city) || null,
        state: safeTrim(student.state) || null,
        pincode: safeTrim(student.pincode) || null
      },
      academicYear: safeTrim(admission.academicYear),
      programId: safeTrim(admission.programId) || null,
      programCode: safeTrim(admission.programCode) || null,
      programName: safeTrim(admission.programName) || null,
      centerId: safeTrim(admission.centerId) || null,
      centerCode: safeTrim(admission.centerCode) || null,
      centerName: safeTrim(admission.centerName) || null,
      courseStartYear: courseStartYear || calc?.startYear || null,
      currentAcademicYear: currentAy,
      yearNo: 1,
      classNo: program?.startingClass ?? null,
      batchId: null,
      batchCode: null,
      status: 'ACTIVE',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    };
    const firstHist = {
      academicYear: currentAy || null,
      yearNo: 1,
      classNo: program?.startingClass ?? null,
      changedOn: Date.now(),
      changedBy: userId || null
    };
    up.ayHistory = [firstHist];
    const doc = await StudentProfile.create(up);
    triggerCommunicationEventSafe({
      tenantId,
      eventCode: 'STUDENT_PROFILE_CREATED',
      admissionNo: doc.admissionNo,
      studentId: doc.studentId,
      sourceModule: 'STUDENT',
      sourceRefId: doc.studentId,
      userId,
      extraData: {
        admissionNo: doc.admissionNo,
        studentId: doc.studentId,
        admissionStatus: 'Confirmed',
        programName: safeTrim(doc.programName),
        centerName: safeTrim(doc.centerName),
        academicYear: safeTrim(doc.academicYear)
      }
    });
    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Student profile created',
      data: {
        studentId: doc.studentId,
        admissionId: doc.admissionId,
        admissionNo: doc.admissionNo
      }
    });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return res.status(409).json({ status: false, message: 'Student profile already exists for this admissionNo' });
    }
    return next(err);
  }
};

const bulkUploadStudents = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const studentsData = req.body?.students;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!Array.isArray(studentsData) || studentsData.length === 0) {
      return res.status(400).json({ status: false, message: 'No student data provided in payload' });
    }
    const report = {
      totalProcessed: studentsData.length,
      successCount: 0,
      failedCount: 0,
      errors: []
    };
    const enrolmentNumbers = [...new Set(studentsData.map((s) => safeTrim(s['Enrolment Number'])).filter(Boolean))];
    const batchCodes = [...new Set(studentsData.map((s) => safeTrim(s['Batch Code'])).filter(Boolean))];
    const existingProfiles = await StudentProfile.find({ tenantId, isdeleted: false, admissionNo: { $in: enrolmentNumbers } }, { admissionNo: 1 }).lean();
    const existingSet = new Set(existingProfiles.map((p) => p.admissionNo));
    const batches = await Batch.find({
      tenantId,
      isdeleted: false,
      batchCode: { $in: batchCodes }
    }).lean();
    const batchMap = new Map(batches.map((b) => [b.batchCode, b]));
    const affectedBatchIds = new Set();
    const now = Date.now();
    const admissionsToInsert = [];
    const profilesToInsert = [];
    for (let index = 0; index < studentsData.length; index++) {
      const row = studentsData[index];
      const rowNum = index + 1;
      const enrolmentNo = safeTrim(row['Enrolment Number']);
      const fullName = safeTrim(row['Full Name']);
      const batchCode = safeTrim(row['Batch Code']);
      const mobile = safeTrim(row['Mobile'] || row['Phone']);
      const email = safeTrim(row['Email']);
      if (!enrolmentNo || !fullName || !batchCode) {
        report.failedCount++;
        report.errors.push({ row: rowNum, enrolmentNo, reason: 'Missing mandatory fields' });
        continue;
      }
      if (existingSet.has(enrolmentNo)) {
        report.failedCount++;
        report.errors.push({ row: rowNum, enrolmentNo, reason: `Enrolment Number '${enrolmentNo}' already exists` });
        continue;
      }
      const batch = batchMap.get(batchCode);
      if (!batch) {
        report.failedCount++;
        report.errors.push({ row: rowNum, enrolmentNo, reason: `Batch Code '${batchCode}' not found.` });
        continue;
      }
      existingSet.add(enrolmentNo);
      const admissionId = uuid();
      const studentId = uuid();
      admissionsToInsert.push({
        tenantId,
        admissionId,
        admissionNo: enrolmentNo,
        sourceType: 'IMPORT',
        academicYear: batch.academicYear,
        programId: batch.programId,
        programName: batch.programName,
        centerId: batch.centerId,
        centerName: batch.centerName,
        batchId: batch.batchId,
        batchName: batch.batchName,
        batchCode: batch.batchCode,
        student: { name: fullName, phone: mobile, email: email },
        workflow: { stage: 'CONFIRMED', status: 'APPROVED', approvedBy: userId, approvedAt: now },
        isdeleted: false,
        createdBy: userId,
        updatedBy: userId
      });
      profilesToInsert.push({
        tenantId,
        studentId,
        admissionId,
        admissionNo: enrolmentNo,
        registrationNumber: enrolmentNo,
        portalStudentId: enrolmentNo,
        status: 'ACTIVE',
        academicYear: batch.academicYear,
        currentAcademicYear: batch.academicYear,
        classNo: batch.classNo,
        yearNo: batch.yearNo,
        programId: batch.programId,
        programName: batch.programName,
        centerId: batch.centerId,
        centerName: batch.centerName,
        batchId: batch.batchId,
        batchName: batch.batchName,
        batchCode: batch.batchCode,
        student: { name: fullName, phone: mobile, email: email },
        ayHistory: [
          {
            academicYear: batch.academicYear,
            programId: batch.programId,
            centerId: batch.centerId,
            batchId: batch.batchId,
            classNo: batch.classNo,
            yearNo: batch.yearNo,
            status: 'ACTIVE',
            promotedAt: now
          }
        ],
        isdeleted: false,
        createdBy: userId,
        updatedBy: userId
      });
      affectedBatchIds.add(batch.batchId);
      report.successCount++;
    }
    session.startTransaction();
    if (admissionsToInsert.length > 0) {
      await Admission.insertMany(admissionsToInsert, { session });
      await StudentProfile.insertMany(profilesToInsert, { session });
      for (const bId of affectedBatchIds) {
        const count = await StudentProfile.countDocuments({
          tenantId,
          batchId: bId,
          status: 'ACTIVE',
          isdeleted: false
        }).session(session);

        await Batch.updateOne({ tenantId, batchId: bId, isdeleted: false }, { $set: { studentCount: count } }, { session });
      }
    }
    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({
      status: true,
      message: `Bulk upload completed. Success: ${report.successCount}, Failed: ${report.failedCount}`,
      data: report
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return next(err);
  }
};

const putUnderReview = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const admissionId = safeTrim(req.body?.admissionId);
    const reviewRemarks = safeTrim(req.body?.reviewRemarks);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!admissionId) return res.status(400).json({ status: false, message: 'admissionId is required' });
    if (!userId) return res.status(400).json({ status: false, message: 'userId is required' });
    if (!reviewRemarks) return res.status(400).json({ status: false, message: 'reviewRemarks is required' });
    const admission = await Admission.findOne({ tenantId, admissionId, isdeleted: false });
    if (!admission) return res.status(404).json({ status: false, message: 'Admission not found' });
    if (admission.workflow?.stage !== 'APPROVAL_SENT') {
      return res.status(400).json({
        status: false,
        message: 'Only admissions in APPROVAL_SENT stage can be put under review'
      });
    }
    admission.workflow.stage = 'UNDER_REVIEW';
    admission.workflow.reviewedAt = Date.now();
    admission.workflow.reviewedBy = userId;
    admission.workflow.reviewRemarks = reviewRemarks;
    admission.updatedBy = userId;
    await admission.save();
    triggerCommunicationEventSafe({
      tenantId,
      eventCode: 'ADMISSION_UNDER_REVIEW',
      admissionNo: admission.admissionNo,
      sourceModule: 'ADMISSION',
      sourceRefId: admissionId,
      userId,
      extraData: {
        admissionNo: admission.admissionNo || '',
        admissionStatus: 'Under Review',
        reviewRemarks,
        programName: safeTrim(admission.programName),
        centerName: safeTrim(admission.centerName),
        academicYear: safeTrim(admission.academicYear)
      }
    });
    return res.status(200).json({
      status: true,
      message: 'Admission put under review',
      data: { admissionId, stage: admission.workflow.stage }
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
  listAdmissions,
  exportAdmissions,
  rejectAdmission,
  updateAdmission,
  getPaymentTemplate,
  listConfirmedAdmissionsWithoutProfile,
  createStudentProfileFromAdmission,
  bulkUploadStudents,
  putUnderReview
};

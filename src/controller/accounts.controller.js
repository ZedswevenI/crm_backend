import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import Payment from '../models/admissionpayments.model.js';
import DepositBatch from '../models/depositbatch.model.js';
import ChequeExtensionRequest from '../models/chequeextension.model.js';
import ChequeMergeGroup from '../models/chequemerge.model.js';
import Admission from '../models/admission.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const pickTenantId = (req) => String(req.body?.entiId || req.body?.tenantId || '').trim();
const pickUserId = (req) => String(req.body?.userId || '').trim();
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

const parseSort = (sortRaw) => {
  const s = safeTrim(sortRaw);
  if (!s) return { createdAt: -1 };
  if (s.startsWith('-')) return { [s.slice(1)]: -1 };
  return { [s]: 1 };
};

const buildRegex = (s) => ({ $regex: s, $options: 'i' });

const isValidYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());

const toEpochDate = (v, endOfDay = false) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const raw = safeTrim(v);
  if (!raw) return null;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) return asNum;
  if (!isValidYMD(raw)) return null;
  const [year, month, day] = raw.split('-').map((p) => parseInt(p, 10) || 0);
  if (!year || !month || !day) return null;
  const d = endOfDay ? new Date(year, month - 1, day, 23, 59, 59, 999) : new Date(year, month - 1, day, 0, 0, 0, 0);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
};

// Payments are submitted before an admission is approved, so admissionNo doesn't exist on
// the Payment doc yet at creation time. Rather than backfill/store it, resolve it live here
// via admissionId → Admission.admissionNo for any row missing it.
const populateAdmissionNo = async (tenantId, rows) => {
  const missingAdmissionIds = [...new Set(rows.filter((r) => !r.admissionNo && r.admissionId).map((r) => r.admissionId))];
  if (!missingAdmissionIds.length) return rows;
  const admissions = await Admission.find({ tenantId, admissionId: { $in: missingAdmissionIds }, isdeleted: false }, { admissionId: 1, admissionNo: 1 }).lean();
  const admissionNoMap = new Map(admissions.map((a) => [a.admissionId, a.admissionNo || null]));
  for (const r of rows) {
    if (!r.admissionNo && r.admissionId) r.admissionNo = admissionNoMap.get(r.admissionId) || null;
  }
  return rows;
};

const listCheques = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const q = req.query || {};
    const pageNum = Math.max(parseInt(q.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const search = safeTrim(q.search);
    const status = safeTrim(q.status).toUpperCase();
    const mode = safeTrim(q.mode).toUpperCase();
    const centerId = safeTrim(q.centerId || req.body?.centerId);
    const programCode = safeTrim(q.programCode);
    const fromDueRaw = q.fromDue;
    const toDueRaw = q.toDue;
    const fromDepositRaw = q.fromDeposit;
    const toDepositRaw = q.toDeposit;
    const fromPlannedRaw = q.fromPlanned;
    const toPlannedRaw = q.toPlanned;
    const includeInactive = safeTrim(q.includeInactive).toLowerCase() === 'yes';
    const query = { tenantId, isdeleted: false, paymentType: 'CHEQUE' };
    if (!includeInactive) query.statusFlag = 'Active';
    if (status && status !== 'ALL') query.status = status;
    if (mode) query['cheque.mode'] = mode;
    if (centerId) query.centerId = centerId;
    if (programCode) query.programCode = buildRegex(programCode);
    const fromDue = toEpochDate(fromDueRaw, false);
    const toDue = toEpochDate(toDueRaw, true);
    if (fromDue !== null || toDue !== null) {
      query['cheque.dueDate'] = {};
      if (fromDue !== null) query['cheque.dueDate'].$gte = fromDue;
      if (toDue !== null) query['cheque.dueDate'].$lte = toDue;
    }
    const fromDeposit = toEpochDate(fromDepositRaw, false);
    const toDeposit = toEpochDate(toDepositRaw, true);
    if (fromDeposit !== null || toDeposit !== null) {
      query.depositedOn = {};
      if (fromDeposit !== null) query.depositedOn.$gte = fromDeposit;
      if (toDeposit !== null) query.depositedOn.$lte = toDeposit;
    }
    const fromPlanned = toEpochDate(fromPlannedRaw, false);
    const toPlanned = toEpochDate(toPlannedRaw, true);
    if (fromPlanned !== null || toPlanned !== null) {
      query['cheque.plannedDepositDate'] = {};
      if (fromPlanned !== null) query['cheque.plannedDepositDate'].$gte = fromPlanned;
      if (toPlanned !== null) query['cheque.plannedDepositDate'].$lte = toPlanned;
    }
    if (search) {
      query.$or = [{ admissionNo: buildRegex(search) }, { studentName: buildRegex(search) }, { registrationNumber: buildRegex(search) }, { 'cheque.chequeNo': buildRegex(search) }, { 'cheque.bankName': buildRegex(search) }];
    }
    const sort = parseSort(q.sort);
    const listFull = safeTrim(q.list).toLowerCase() === 'full';
    if (listFull) {
      const rows = await Payment.find(query).sort(sort).lean();
      await populateAdmissionNo(tenantId, rows);
      return res.status(200).json({
        status: true,
        message: 'Cheques list fetched',
        data: { rows, total: rows.length, page: 1, limit: rows.length, pages: 1 }
      });
    }
    const [rows, total] = await Promise.all([Payment.find(query).sort(sort).skip(skip).limit(limitNum).lean(), Payment.countDocuments(query)]);
    await populateAdmissionNo(tenantId, rows);
    return res.status(200).json({
      status: true,
      message: 'Cheques list fetched',
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

const viewCheque = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const paymentId = safeTrim(req.body?.paymentId);
    const recId = safeTrim(req.body?.recId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!paymentId && !recId) return res.status(400).json({ status: false, message: 'paymentId or recId is required' });
    const filter = { tenantId, isdeleted: false, paymentType: 'CHEQUE' };
    if (paymentId) filter.paymentId = paymentId;
    if (recId) filter._id = recId;
    const doc = await Payment.findOne(filter).populate({ path: 'admissionId', localField: 'admissionId', foreignField: 'admissionId', model: 'admission', justOne: true, select: 'admissionNo registrationNumber admissionId' }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Cheque payment not found' });
    const [mergeGroup, depositBatch, extensionReqs] = await Promise.all([
      doc?.mergeGroupId ? ChequeMergeGroup.findOne({ tenantId, mergeGroupId: doc.mergeGroupId, isdeleted: false }).lean() : Promise.resolve(null),
      doc?.depositBatchId ? DepositBatch.findOne({ tenantId, depositBatchId: doc.depositBatchId, isdeleted: false }).lean() : Promise.resolve(null),
      ChequeExtensionRequest.find({ tenantId, paymentId: doc.paymentId, isdeleted: false }).sort({ createdAt: -1 }).lean()
    ]);
    return res.status(200).json({
      status: true,
      message: 'Cheque loaded',
      data: {
        payment: doc,
        mergeGroup: mergeGroup || null,
        depositBatch: depositBatch || null,
        extensions: extensionReqs || []
      }
    });
  } catch (err) {
    return next(err);
  }
};

const updateChequeRemarks = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const paymentId = safeTrim(req.body?.paymentId);
    const remarks = safeTrim(req.body?.remarks);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!paymentId) return res.status(400).json({ status: false, message: 'paymentId is required' });
    const doc = await Payment.findOne({ tenantId, paymentId, isdeleted: false, paymentType: 'CHEQUE' });
    if (!doc) return res.status(404).json({ status: false, message: 'Cheque payment not found' });
    doc.remarks = remarks || null;
    doc.updatedBy = pickUserId(req) || null;
    await doc.save();
    return res.status(200).json({ status: true, message: 'Remarks updated', data: { paymentId } });
  } catch (err) {
    return next(err);
  }
};

const createDepositBatch = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const rawDepositDate = req.body?.depositDate;
    const depositDate = toEpochDate(rawDepositDate, false);
    const bankName = safeTrim(req.body?.bankName) || null;
    const paymentIds = Array.isArray(req.body?.paymentIds) ? req.body.paymentIds.map(safeTrim).filter(Boolean) : [];
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    if (depositDate === null) {
      return res.status(400).json({
        status: false,
        message: 'depositDate is required (epoch ms or yyyy-mm-dd)'
      });
    }
    if (!paymentIds.length) {
      return res.status(400).json({ status: false, message: 'paymentIds is required' });
    }
    if (!paymentIds.length) return res.status(400).json({ status: false, message: 'paymentIds is required' });
    session.startTransaction();
    const cheques = await Payment.find({ tenantId, paymentId: { $in: paymentIds }, isdeleted: false, paymentType: 'CHEQUE' }, { _id: 1, paymentId: 1, amount: 1, status: 1 })
      .session(session)
      .lean();
    if (cheques.length !== paymentIds.length) {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'Some paymentIds are invalid' });
    }
    const invalid = cheques.filter((c) => !['PENDING', 'SUBMITTED'].includes(String(c.status || '')));
    if (invalid.length) {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: `Some cheques are not depositable (${invalid.map((x) => x.paymentId).join(', ')})` });
    }
    const totalAmount = Number(cheques.reduce((s, x) => s + toNum(x.amount), 0).toFixed(2));
    const batchArr = await DepositBatch.create(
      [
        {
          tenantId,
          depositDate,
          bankName,
          chequeCount: cheques.length,
          totalAmount,
          paymentIds,
          createdBy: userId || null,
          updatedBy: userId || null,
          isdeleted: false
        }
      ],
      { session }
    );
    const batchDoc = batchArr?.[0];
    await Payment.updateMany(
      { tenantId, paymentId: { $in: paymentIds }, isdeleted: false, paymentType: 'CHEQUE' },
      {
        $set: {
          status: 'DEPOSITED',
          depositedOn: depositDate,
          depositBatchId: batchDoc.depositBatchId,
          updatedBy: userId || null
        }
      },
      { session }
    );
    await session.commitTransaction();
    return res.status(200).json({
      status: true,
      message: 'Deposit batch created',
      data: { depositBatchId: batchDoc.depositBatchId, depositDate, chequeCount: cheques.length, totalAmount }
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    return next(err);
  } finally {
    session.endSession();
  }
};

const listDepositBatches = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const q = req.query || {};
    const pageNum = Math.max(parseInt(q.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const search = safeTrim(q.search);
    const fromRaw = q.fromDate;
    const toRaw = q.toDate;
    const query = { tenantId, isdeleted: false };
    const from = toEpochDate(fromRaw, false);
    const to = toEpochDate(toRaw, true);
    if (from !== null || to !== null) {
      query.depositDate = {};
      if (from !== null) query.depositDate.$gte = from;
      if (to !== null) query.depositDate.$lte = to;
    }
    if (search) {
      query.$or = [{ depositBatchId: buildRegex(search) }, { bankName: buildRegex(search) }];
    }
    const sort = parseSort(q.sort || '-createdAt');
    const [rows, total] = await Promise.all([DepositBatch.find(query).sort(sort).skip(skip).limit(limitNum).lean(), DepositBatch.countDocuments(query)]);
    return res.status(200).json({
      status: true,
      message: 'Deposit batches fetched',
      data: { rows, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 0 }
    });
  } catch (err) {
    return next(err);
  }
};

const viewDepositBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const depositBatchId = safeTrim(req.body?.depositBatchId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!depositBatchId) return res.status(400).json({ status: false, message: 'depositBatchId is required' });
    const batch = await DepositBatch.findOne({ tenantId, batchId: depositBatchId, isdeleted: false }).lean();
    if (!batch) return res.status(404).json({ status: false, message: 'Deposit batch not found' });
    const payments = await Payment.find(
      { tenantId, paymentId: { $in: batch.paymentIds || [] }, isdeleted: false, paymentType: 'CHEQUE' },
      {
        _id: 0,
        paymentId: 1,
        admissionNo: 1,
        studentName: 1,
        centerName: 1,
        programName: 1,
        amount: 1,
        status: 1,
        depositedOn: 1,
        clearedOn: 1,
        failedOn: 1,
        'cheque.chequeNo': 1,
        'cheque.dueDate': 1,
        'cheque.plannedDepositDate': 1,
        'cheque.mode': 1,
        'cheque.bankName': 1
      }
    )
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({ status: true, message: 'Deposit batch loaded', data: { batch, payments } });
  } catch (err) {
    return next(err);
  }
};

const removeChequeFromDepositBatch = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const depositBatchId = safeTrim(req.body?.depositBatchId);
    const paymentId = safeTrim(req.body?.paymentId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!depositBatchId) return res.status(400).json({ status: false, message: 'depositBatchId is required' });
    if (!paymentId) return res.status(400).json({ status: false, message: 'paymentId is required' });
    session.startTransaction();
    const batch = await DepositBatch.findOne({ tenantId, depositBatchId, isdeleted: false }).session(session);
    if (!batch) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: 'Deposit batch not found' });
    }
    const p = await Payment.findOne({ tenantId, paymentId, isdeleted: false, paymentType: 'CHEQUE' }).session(session);
    if (!p) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: 'Payment not found' });
    }
    if (String(p.depositBatchId || '') !== depositBatchId) {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'This cheque is not part of the given deposit batch' });
    }
    if (!['DEPOSITED'].includes(String(p.status || ''))) {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'Only DEPOSITED cheques can be removed from batch' });
    }
    batch.paymentIds = Array.isArray(batch.paymentIds) ? batch.paymentIds.filter((x) => String(x) !== paymentId) : [];
    batch.chequeCount = batch.paymentIds.length;
    const remaining = await Payment.find({ tenantId, paymentId: { $in: batch.paymentIds }, isdeleted: false }, { amount: 1 })
      .session(session)
      .lean();
    batch.totalAmount = Number(remaining.reduce((s, x) => s + toNum(x.amount), 0).toFixed(2));
    batch.updatedBy = userId || null;
    await batch.save({ session });
    p.status = 'PENDING';
    p.depositedOn = null;
    p.depositBatchId = null;
    p.updatedBy = userId || null;
    await p.save({ session });
    await session.commitTransaction();
    return res.status(200).json({ status: true, message: 'Cheque removed from deposit batch', data: { depositBatchId, paymentId } });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    return next(err);
  } finally {
    session.endSession();
  }
};

const reconcileCheque = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const paymentId = safeTrim(req.body?.paymentId);
    const action = safeTrim(req.body?.action).toUpperCase();
    const date = safeTrim(req.body?.date);
    const remarks = safeTrim(req.body?.remarks);
    const failureReason = safeTrim(req.body?.failureReason);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!paymentId) return res.status(400).json({ status: false, message: 'paymentId is required' });
    if (!['CLEAR', 'FAIL', 'CANCEL'].includes(action)) return res.status(400).json({ status: false, message: 'action must be CLEAR/FAIL/CANCEL' });
    if (date && !isValidYMD(date)) return res.status(400).json({ status: false, message: 'date must be yyyy-mm-dd' });
    const doc = await Payment.findOne({ tenantId, paymentId, isdeleted: false, paymentType: 'CHEQUE' });
    if (!doc) return res.status(404).json({ status: false, message: 'Cheque payment not found' });
    if (action === 'CLEAR' && doc.status !== 'DEPOSITED') return res.status(400).json({ status: false, message: 'Only DEPOSITED cheques can be CLEARED' });
    if (action === 'FAIL' && doc.status !== 'DEPOSITED') return res.status(400).json({ status: false, message: 'Only DEPOSITED cheques can be FAILED' });
    doc.cheque = doc.cheque || {};
    doc.cheque.reconcileRemarks = remarks || null;
    if (action === 'CLEAR') {
      doc.status = 'CLEARED';
      doc.clearedOn = date || doc.clearedOn || null;
      doc.failedOn = null;
      doc.failureReason = null;
    } else if (action === 'FAIL') {
      doc.status = 'FAILED';
      doc.failedOn = date || doc.failedOn || null;
      doc.failureReason = failureReason || 'Cheque bounced';
      doc.clearedOn = null;
    } else {
      doc.status = 'CANCELLED';
      doc.failureReason = failureReason || null;
    }
    doc.updatedBy = userId || null;
    await doc.save();
    if (doc.admissionNo && ['CLEAR', 'FAIL'].includes(action)) {
      triggerCommunicationEventSafe({
        tenantId,
        eventCode: action === 'CLEAR' ? 'CHEQUE_CLEARED' : 'CHEQUE_FAILED',
        admissionNo: doc.admissionNo,
        sourceModule: 'FEE',
        sourceRefId: paymentId,
        userId,
        extraData: {
          paymentId: doc.paymentId,
          paymentType: doc.paymentType,
          paymentStatus: doc.status,
          amount: doc.amount,
          chequeNo: doc?.cheque?.chequeNo || '',
          chequeDueDate: doc?.cheque?.dueDate || '',
          chequeBankName: doc?.cheque?.bankName || '',
          failureReason: doc.failureReason || ''
        }
      });
    }
    return res.status(200).json({ status: true, message: 'Cheque reconciled', data: { paymentId, status: doc.status } });
  } catch (err) {
    return next(err);
  }
};

const bulkReconcileCheques = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const paymentIds = Array.isArray(req.body?.paymentIds) ? req.body.paymentIds.map(safeTrim).filter(Boolean) : [];
    const action = safeTrim(req.body?.action).toUpperCase();
    const date = safeTrim(req.body?.date);
    const failureReason = safeTrim(req.body?.failureReason);
    const remarks = safeTrim(req.body?.remarks);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!paymentIds.length) return res.status(400).json({ status: false, message: 'paymentIds is required' });
    if (!['CLEAR', 'FAIL'].includes(action)) return res.status(400).json({ status: false, message: 'action must be CLEAR/FAIL' });
    if (date && !isValidYMD(date)) return res.status(400).json({ status: false, message: 'date must be yyyy-mm-dd' });
    const set = { updatedBy: userId || null };
    const unset = {};
    if (remarks) set['cheque.reconcileRemarks'] = remarks;
    if (action === 'CLEAR') {
      set.status = 'CLEARED';
      set.clearedOn = date || null;
      unset.failedOn = '';
      unset.failureReason = '';
      const result = await Payment.updateMany({ tenantId, paymentId: { $in: paymentIds }, isdeleted: false, paymentType: 'CHEQUE', status: 'DEPOSITED' }, { $set: set, $unset: unset });
      return res.status(200).json({ status: true, message: 'Bulk clear completed', data: { matched: result.matchedCount, modified: result.modifiedCount } });
    }
    set.status = 'FAILED';
    set.failedOn = date || null;
    set.failureReason = failureReason || 'Cheque bounced';
    unset.clearedOn = '';
    const result = await Payment.updateMany({ tenantId, paymentId: { $in: paymentIds }, isdeleted: false, paymentType: 'CHEQUE', status: 'DEPOSITED' }, { $set: set, $unset: unset });
    return res.status(200).json({ status: true, message: 'Bulk fail completed', data: { matched: result.matchedCount, modified: result.modifiedCount } });
  } catch (err) {
    return next(err);
  }
};

const requestChequeExtension = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const paymentId = safeTrim(req.body?.paymentId);
    const rawNewPlannedDepositDate = req.body?.newPlannedDepositDate;
    const newPlannedDepositDate = toEpochDate(rawNewPlannedDepositDate, false);
    const remarks = safeTrim(req.body?.remarks);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    if (!paymentId) {
      return res.status(400).json({ status: false, message: 'paymentId is required' });
    }
    if (newPlannedDepositDate === null) {
      return res.status(400).json({
        status: false,
        message: 'newPlannedDepositDate is required (epoch ms or yyyy-mm-dd)'
      });
    }
    if (!remarks) {
      return res.status(400).json({ status: false, message: 'remarks is required' });
    }
    if (!remarks) return res.status(400).json({ status: false, message: 'remarks is required' });
    const p = await Payment.findOne({ tenantId, paymentId, isdeleted: false, paymentType: 'CHEQUE' });
    if (!p) {
      return res.status(404).json({ status: false, message: 'Cheque payment not found' });
    }
    const planned = typeof p?.cheque?.plannedDepositDate === 'number' ? p.cheque.plannedDepositDate : toEpochDate(p?.cheque?.plannedDepositDate, false);
    const due = typeof p?.cheque?.dueDate === 'number' ? p.cheque.dueDate : toEpochDate(p?.cheque?.dueDate, false);
    const currentPlanned = planned || due || null;
    const doc = await ChequeExtensionRequest.create({
      tenantId,
      paymentId,
      oldPlannedDepositDate: currentPlanned,
      newPlannedDepositDate,
      remarks,
      status: 'PENDING',
      requestedBy: userId || null,
      requestedAt: Date.now(),
      approvedBy: null,
      approvedAt: null,
      approvalRemarks: null,
      isdeleted: false
    });
    p.status = 'EXTENTION_REQUESTED';
    p.updatedBy = userId;
    await p.save();
    return res.status(200).json({ status: true, message: 'Extension request submitted', data: { requestId: doc.requestId, paymentId } });
  } catch (err) {
    return next(err);
  }
};

const listChequeExtensions = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const q = req.query || {};
    const pageNum = Math.max(parseInt(q.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const status = safeTrim(q.status).toUpperCase();
    const search = safeTrim(q.search);
    const query = { tenantId, isdeleted: false };
    if (status && status !== 'ALL') query.status = status;
    if (search) {
      query.$or = [{ requestId: buildRegex(search) }, { paymentId: buildRegex(search) }, { remarks: buildRegex(search) }];
    }
    const [rows, total] = await Promise.all([ChequeExtensionRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(), ChequeExtensionRequest.countDocuments(query)]);
    return res.status(200).json({
      status: true,
      message: 'Extension requests fetched',
      data: { rows, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 0 }
    });
  } catch (err) {
    return next(err);
  }
};

const approveChequeExtension = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const requestId = safeTrim(req.body?.requestId);
    const approvalRemarks = safeTrim(req.body?.approvalRemarks);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!requestId) return res.status(400).json({ status: false, message: 'requestId is required' });
    session.startTransaction();
    const r = await ChequeExtensionRequest.findOne({ tenantId, requestId, isdeleted: false }).session(session);
    if (!r) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: 'Request not found' });
    }
    if (r.status !== 'PENDING') {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'Only PENDING requests can be approved' });
    }
    const p = await Payment.findOne({ tenantId, paymentId: r.paymentId, isdeleted: false, paymentType: 'CHEQUE' }).session(session);
    if (!p) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: 'Cheque payment not found' });
    }
    p.cheque = p.cheque || {};
    p.cheque.plannedDepositDate = r.newPlannedDepositDate;
    p.status = 'PENDING';
    p.updatedBy = userId || null;
    await p.save({ session });
    r.status = 'APPROVED';
    r.approvedBy = userId || null;
    r.approvedAt = Date.now();
    r.approvalRemarks = approvalRemarks || null;
    r.updatedBy = userId || null;
    await r.save({ session });
    await session.commitTransaction();
    if (p.admissionNo) {
      triggerCommunicationEventSafe({
        tenantId,
        eventCode: 'CHEQUE_EXTENSION_APPROVED',
        admissionNo: p.admissionNo,
        sourceModule: 'FEE',
        sourceRefId: requestId,
        userId,
        extraData: {
          paymentId: p.paymentId,
          chequeNo: p?.cheque?.chequeNo || '',
          oldPlannedDepositDate: r.oldPlannedDepositDate || '',
          newPlannedDepositDate: r.newPlannedDepositDate || '',
          approvalRemarks: r.approvalRemarks || ''
        }
      });
    }
    return res.status(200).json({ status: true, message: 'Request approved', data: { requestId, paymentId: r.paymentId, plannedDepositDate: r.newPlannedDepositDate } });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    return next(err);
  } finally {
    session.endSession();
  }
};

const rejectChequeExtension = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const requestId = safeTrim(req.body?.requestId);
    const approvalRemarks = safeTrim(req.body?.approvalRemarks);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!requestId) return res.status(400).json({ status: false, message: 'requestId is required' });
    if (!approvalRemarks) return res.status(400).json({ status: false, message: 'approvalRemarks is required' });
    const r = await ChequeExtensionRequest.findOne({ tenantId, requestId, isdeleted: false });
    if (!r) return res.status(404).json({ status: false, message: 'Request not found' });
    if (r.status !== 'PENDING') return res.status(400).json({ status: false, message: 'Only PENDING requests can be rejected' });
    r.status = 'REJECTED';
    r.approvedBy = userId || null;
    r.approvedAt = Date.now();
    r.approvalRemarks = approvalRemarks;
    r.updatedBy = userId || null;
    const p = await Payment.findOne({ tenantId, paymentId: r.paymentId, isdeleted: false, paymentType: 'CHEQUE' });
    if (!p) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: 'Cheque payment not found' });
    }
    p.status = 'PENDING';
    p.updatedBy = userId;
    await r.save();
    await p.save();
    if (p.admissionNo) {
      triggerCommunicationEventSafe({
        tenantId,
        eventCode: 'CHEQUE_EXTENSION_REJECTED',
        admissionNo: p.admissionNo,
        sourceModule: 'FEE',
        sourceRefId: requestId,
        userId,
        extraData: {
          paymentId: p.paymentId,
          chequeNo: p?.cheque?.chequeNo || '',
          approvalRemarks: r.approvalRemarks || ''
        }
      });
    }
    return res.status(200).json({ status: true, message: 'Request rejected', data: { requestId } });
  } catch (err) {
    return next(err);
  }
};

const viewChequeExtension = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const requestId = safeTrim(req.body?.requestId);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    if (!requestId) {
      return res.status(400).json({ status: false, message: 'requestId is required' });
    }
    const request = await ChequeExtensionRequest.findOne(
      { tenantId, requestId, isdeleted: false },
      {
        _id: 0,
        tenantId: 1,
        requestId: 1,
        paymentId: 1,
        oldPlannedDepositDate: 1,
        newPlannedDepositDate: 1,
        remarks: 1,
        status: 1,
        requestedBy: 1,
        requestedAt: 1,
        approvedBy: 1,
        approvedAt: 1,
        approvalRemarks: 1,
        createdAt: 1,
        updatedAt: 1
      }
    ).lean();
    if (!request) {
      return res.status(404).json({ status: false, message: 'Request not found' });
    }
    const payment = await Payment.findOne(
      { tenantId, paymentId: request.paymentId, isdeleted: false, paymentType: 'CHEQUE' },
      {
        _id: 0,
        paymentId: 1,
        admissionNo: 1,
        studentName: 1,
        centerName: 1,
        programName: 1,
        amount: 1,
        status: 1,
        depositedOn: 1,
        clearedOn: 1,
        failedOn: 1,
        failureReason: 1,
        'cheque.chequeNo': 1,
        'cheque.dueDate': 1,
        'cheque.plannedDepositDate': 1,
        'cheque.mode': 1,
        'cheque.bankName': 1
      }
    ).lean();
    return res.status(200).json({
      status: true,
      message: 'Request loaded',
      data: { request, payment: payment || null }
    });
  } catch (err) {
    return next(err);
  }
};

const requestChequeReplacement = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const oldPaymentId = safeTrim(req.body?.oldPaymentId);
    const replacement = req.body?.replacement || {};
    const remarks = safeTrim(req.body?.remarks);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!oldPaymentId) return res.status(400).json({ status: false, message: 'oldPaymentId is required' });
    const chequeNo = safeTrim(replacement?.chequeNo);
    const dueDate = safeTrim(replacement?.dueDate);
    const favourOf = safeTrim(replacement?.favourOf);
    const mode = safeTrim(replacement?.mode).toUpperCase();
    const amount = toNum(replacement?.amount);
    const chequeDate = safeTrim(replacement?.chequeDate) || null;
    const bankName = safeTrim(replacement?.bankName) || null;
    if (!chequeNo || !dueDate || !isValidYMD(dueDate) || !favourOf || !['PDC', 'CDC'].includes(mode) || amount <= 0) {
      return res.status(400).json({ status: false, message: 'replacement.chequeNo, dueDate(yyyy-mm-dd), favourOf, mode(PDC/CDC), amount are required' });
    }
    session.startTransaction();
    const oldP = await Payment.findOne({ tenantId, paymentId: oldPaymentId, isdeleted: false, paymentType: 'CHEQUE' }).session(session);
    if (!oldP) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: 'Old cheque payment not found' });
    }
    if (String(oldP.status || '') === 'CLEARED') {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'CLEARED cheque cannot be replaced' });
    }
    const newDoc = await Payment.create(
      [
        {
          tenantId,
          admissionId: oldP.admissionId,
          admissionNo: oldP.admissionNo || null,
          academicYear: oldP.academicYear || null,
          centerId: oldP.centerId || null,
          centerName: oldP.centerName,
          programId: oldP.programId || null,
          programName: oldP.programName,
          programCode: oldP.programCode || null,
          studentName: oldP.studentName,
          studentPhone: oldP.studentPhone || null,
          registrationNumber: oldP.registrationNumber || null,
          paymentType: 'CHEQUE',
          amount,
          remarks: remarks || oldP.remarks || null,
          status: 'PENDING',
          cheque: {
            sno: oldP?.cheque?.sno ?? null,
            chequeNo,
            chequeDate,
            dueDate,
            favourOf,
            mode,
            bankName,
            plannedDepositDate: dueDate,
            replacementOf: oldPaymentId,
            replacedBy: null,
            mergedGroupId: null,
            mergeRole: null,
            depositBatchId: null,
            depositBankName: null
          },
          batchId: oldP.batchId || null,
          statusFlag: 'Active',
          isdeleted: false,
          createdBy: userId || null,
          updatedBy: userId || null
        }
      ],
      { session }
    );
    const created = newDoc?.[0];
    oldP.status = 'CANCELLED';
    oldP.failureReason = safeTrim(req.body?.cancelReason) || 'Cheque replaced';
    oldP.cheque = oldP.cheque || {};
    oldP.cheque.replacedBy = created.paymentId;
    oldP.updatedBy = userId || null;
    await oldP.save({ session });
    await session.commitTransaction();
    return res.status(200).json({
      status: true,
      message: 'Cheque replaced',
      data: { oldPaymentId, newPaymentId: created.paymentId }
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    return next(err);
  } finally {
    session.endSession();
  }
};

const requestNeftReplacementForCheque = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const oldPaymentId = safeTrim(req.body?.oldPaymentId);
    const neftDetails = req.body?.neft || {};
    const remarks = safeTrim(req.body?.remarks);
    const cancelReason = safeTrim(req.body?.cancelReason);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!oldPaymentId) return res.status(400).json({ status: false, message: 'oldPaymentId is required' });
    const utr = safeTrim(neftDetails?.utr);
    const paidOn = toEpochDate(neftDetails?.paidOn, false);
    const bankName = safeTrim(neftDetails?.bankName) || null;
    const branchName = safeTrim(neftDetails?.branchName) || null;
    const referenceNote = safeTrim(neftDetails?.referenceNote) || null;
    const amount = toNum(req.body?.amount);
    if (!utr || amount <= 0) {
      return res.status(400).json({ status: false, message: 'neft.utr and amount are required' });
    }
    session.startTransaction();
    const oldP = await Payment.findOne({ tenantId, paymentId: oldPaymentId, isdeleted: false, paymentType: 'CHEQUE' }).session(session);
    if (!oldP) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: 'Old cheque payment not found' });
    }
    if (String(oldP.status || '') === 'CLEARED') {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'CLEARED cheque cannot be replaced' });
    }
    const newDoc = await Payment.create(
      [
        {
          tenantId,
          admissionId: oldP.admissionId,
          admissionNo: oldP.admissionNo || null,
          academicYear: oldP.academicYear || null,
          centerId: oldP.centerId || null,
          centerName: oldP.centerName,
          programId: oldP.programId || null,
          programName: oldP.programName,
          programCode: oldP.programCode || null,
          studentName: oldP.studentName,
          studentPhone: oldP.studentPhone || null,
          registrationNumber: oldP.registrationNumber || null,
          paymentType: 'NEFT',
          amount,
          remarks: remarks || oldP.remarks || null,
          status: 'SUBMITTED',
          neft: { utr, paidOn, bankName, branchName, referenceNote },
          replacement: { replacesPaymentId: oldPaymentId },
          batchId: oldP.batchId || null,
          statusFlag: 'Active',
          isdeleted: false,
          createdBy: userId || null,
          updatedBy: userId || null
        }
      ],
      { session }
    );
    const created = newDoc?.[0];
    oldP.status = 'CANCELLED';
    oldP.failureReason = cancelReason || 'Cheque replaced with NEFT';
    oldP.replacement = oldP.replacement || {};
    oldP.replacement.replacedByPaymentId = created.paymentId;
    oldP.replacement.reason = cancelReason || 'Cheque replaced with NEFT';
    oldP.replacement.replacedAt = Date.now();
    oldP.replacement.replacedBy = userId || null;
    oldP.updatedBy = userId || null;
    await oldP.save({ session });
    await session.commitTransaction();
    return res.status(200).json({
      status: true,
      message: 'Cheque replaced with NEFT',
      data: { oldPaymentId, newPaymentId: created.paymentId }
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    return next(err);
  } finally {
    session.endSession();
  }
};

const replacementHistory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const paymentId = safeTrim(req.body?.paymentId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!paymentId) return res.status(400).json({ status: false, message: 'paymentId is required' });
    const seen = new Set();
    const chain = [];
    let cur = await Payment.findOne({ tenantId, paymentId, isdeleted: false }).lean();
    if (!cur) return res.status(404).json({ status: false, message: 'Payment not found' });
    while (true) {
      const prevId = safeTrim(cur?.cheque?.replacementOf || cur?.replacement?.replacesPaymentId);
      if (!prevId || seen.has(prevId)) break;
      const prev = await Payment.findOne({ tenantId, paymentId: prevId, isdeleted: false }).lean();
      if (!prev) break;
      cur = prev;
    }
    while (cur && !seen.has(cur.paymentId)) {
      seen.add(cur.paymentId);
      chain.push(cur);
      const nextId = safeTrim(cur?.cheque?.replacedBy || cur?.replacement?.replacedByPaymentId);
      if (!nextId) break;
      const nxt = await Payment.findOne({ tenantId, paymentId: nextId, isdeleted: false }).lean();
      if (!nxt) break;
      cur = nxt;
    }
    return res.status(200).json({ status: true, message: 'Replacement history loaded', data: { chain } });
  } catch (err) {
    return next(err);
  }
};

const createChequeMerge = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const childPaymentIds = Array.isArray(req.body?.paymentIds) ? req.body.paymentIds.map(safeTrim).filter(Boolean) : [];
    const masterCheque = req.body?.masterCheque || {};
    const remarks = safeTrim(req.body?.remarks);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (childPaymentIds.length < 2) return res.status(400).json({ status: false, message: 'At least 2 paymentIds required to merge' });
    const chequeNo = safeTrim(masterCheque?.chequeNo);
    const dueDate = safeTrim(masterCheque?.dueDate);
    const favourOf = safeTrim(masterCheque?.favourOf);
    const mode = safeTrim(masterCheque?.mode).toUpperCase();
    const bankName = safeTrim(masterCheque?.bankName) || null;
    if (!chequeNo || !dueDate || !isValidYMD(dueDate) || !favourOf || !['PDC', 'CDC'].includes(mode)) {
      return res.status(400).json({ status: false, message: 'masterCheque.chequeNo, dueDate(yyyy-mm-dd), favourOf, mode(PDC/CDC) are required' });
    }
    session.startTransaction();
    const childs = await Payment.find({ tenantId, paymentId: { $in: childPaymentIds }, isdeleted: false, paymentType: 'CHEQUE' }, { paymentId: 1, amount: 1, status: 1 })
      .session(session)
      .lean();
    if (childs.length !== childPaymentIds.length) {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'Some paymentIds are invalid' });
    }
    const bad = childs.filter((c) => !['PENDING', 'SUBMITTED'].includes(String(c.status || '')));
    if (bad.length) {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: `Some cheques are not mergeable (${bad.map((x) => x.paymentId).join(', ')})` });
    }
    const totalAmount = Number(childs.reduce((s, x) => s + toNum(x.amount), 0).toFixed(2));
    const groupArr = await ChequeMergeGroup.create(
      [
        {
          tenantId,
          childPaymentIds,
          masterPaymentId: null,
          totalAmount,
          remarks: remarks || null,
          status: 'ACTIVE',
          createdBy: userId || null,
          updatedBy: userId || null,
          isdeleted: false
        }
      ],
      { session }
    );
    const groupDoc = groupArr?.[0];
    const masterPaymentArr = await Payment.create(
      [
        {
          tenantId,
          admissionId: 'MERGED',
          admissionNo: null,
          centerName: 'MERGED',
          programName: 'MERGED',
          studentName: 'MERGED',
          paymentType: 'CHEQUE',
          amount: totalAmount,
          remarks: remarks || 'Merged cheque',
          status: 'PENDING',
          mergeGroupId: groupDoc.mergeGroupId,
          cheque: {
            chequeNo,
            dueDate,
            favourOf,
            mode,
            bankName,
            plannedDepositDate: dueDate
          },
          statusFlag: 'Active',
          isdeleted: false,
          createdBy: userId || null,
          updatedBy: userId || null
        }
      ],
      { session }
    );
    const masterDoc = masterPaymentArr?.[0];
    groupDoc.masterPaymentId = masterDoc.paymentId;
    groupDoc.updatedBy = userId || null;
    await groupDoc.save({ session });
    await Payment.updateMany(
      { tenantId, paymentId: { $in: childPaymentIds }, isdeleted: false, paymentType: 'CHEQUE' },
      {
        $set: {
          status: 'CANCELLED',
          failureReason: 'Merged into master cheque',
          mergeGroupId: groupDoc.mergeGroupId,
          updatedBy: userId || null
        }
      },
      { session }
    );
    await session.commitTransaction();
    return res.status(200).json({
      status: true,
      message: 'Cheques merged',
      data: { mergeGroupId: groupDoc.mergeGroupId, masterPaymentId: masterDoc.paymentId, totalAmount, childCount: childPaymentIds.length }
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    return next(err);
  } finally {
    session.endSession();
  }
};

const viewChequeMerge = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const mergeGroupId = safeTrim(req.body?.mergeGroupId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!mergeGroupId) return res.status(400).json({ status: false, message: 'mergeGroupId is required' });
    const group = await ChequeMergeGroup.findOne({ tenantId, mergeGroupId, isdeleted: false }).lean();
    if (!group) return res.status(404).json({ status: false, message: 'Merge group not found' });
    const [master, childs] = await Promise.all([group.masterPaymentId ? Payment.findOne({ tenantId, paymentId: group.masterPaymentId, isdeleted: false }).lean() : Promise.resolve(null), Payment.find({ tenantId, paymentId: { $in: group.childPaymentIds || [] }, isdeleted: false }).lean()]);
    return res.status(200).json({ status: true, message: 'Merge group loaded', data: { group, master, childs } });
  } catch (err) {
    return next(err);
  }
};

const unmergeCheques = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const groupId = safeTrim(req.body?.groupId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!groupId) return res.status(400).json({ status: false, message: 'groupId is required' });
    session.startTransaction();
    const group = await ChequeMergeGroup.findOne({ tenantId, groupId, isdeleted: false }).session(session);
    if (!group) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: 'Merge group not found' });
    }
    const master = group.masterPaymentId ? await Payment.findOne({ tenantId, paymentId: group.masterPaymentId, isdeleted: false }).session(session) : null;
    if (!master) {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'Master payment missing' });
    }
    if (!['PENDING', 'SUBMITTED'].includes(String(master.status || ''))) {
      await session.abortTransaction();
      return res.status(400).json({ status: false, message: 'Cannot unmerge after deposit/reconcile' });
    }
    master.isdeleted = true;
    master.statusFlag = 'Inactive';
    master.updatedBy = userId || null;
    await master.save({ session });
    await Payment.updateMany(
      { tenantId, paymentId: { $in: group.childPaymentIds || [] }, isdeleted: false, paymentType: 'CHEQUE' },
      {
        $set: { status: 'PENDING', failureReason: null, updatedBy: userId || null },
        $unset: { 'cheque.mergedGroupId': '', 'cheque.mergeRole': '' }
      },
      { session }
    );
    group.status = 'CANCELLED';
    group.isdeleted = true;
    group.updatedBy = userId || null;
    await group.save({ session });
    await session.commitTransaction();
    return res.status(200).json({ status: true, message: 'Unmerge completed', data: { groupId } });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    return next(err);
  } finally {
    session.endSession();
  }
};

const listNeft = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const q = req.query || {};
    const pageNum = Math.max(parseInt(q.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const search = safeTrim(q.search);
    const status = safeTrim(q.status).toUpperCase();
    const includeInactive = safeTrim(q.includeInactive).toLowerCase() === 'yes';
    const query = { tenantId, isdeleted: false, paymentType: 'NEFT' };
    if (!includeInactive) query.statusFlag = 'Active';
    if (status && status !== 'ALL') query.status = status;
    if (search) {
      query.$or = [{ admissionNo: buildRegex(search) }, { studentName: buildRegex(search) }, { registrationNumber: buildRegex(search) }, { centerName: buildRegex(search) }, { programName: buildRegex(search) }, { 'neft.utr': buildRegex(search) }];
    }
    const sort = parseSort(q.sort || '-createdAt');
    const [rows, total] = await Promise.all([Payment.find(query).sort(sort).skip(skip).limit(limitNum).lean(), Payment.countDocuments(query)]);
    await populateAdmissionNo(tenantId, rows);
    return res.status(200).json({
      status: true,
      message: 'NEFT list fetched',
      data: { rows, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 0 }
    });
  } catch (err) {
    return next(err);
  }
};

const updateNeftStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = pickUserId(req);
    const paymentId = safeTrim(req.body?.paymentId);
    const status = safeTrim(req.body?.status).toUpperCase();
    const date = safeTrim(req.body?.date);
    const remarks = safeTrim(req.body?.remarks);
    const failureReason = safeTrim(req.body?.failureReason);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!paymentId) return res.status(400).json({ status: false, message: 'paymentId is required' });
    if (!['SUBMITTED', 'CLEARED', 'FAILED', 'CANCELLED'].includes(status)) return res.status(400).json({ status: false, message: 'Invalid status' });
    if (date && !isValidYMD(date)) return res.status(400).json({ status: false, message: 'date must be yyyy-mm-dd' });
    const doc = await Payment.findOne({ tenantId, paymentId, isdeleted: false, paymentType: 'NEFT' });
    if (!doc) return res.status(404).json({ status: false, message: 'NEFT payment not found' });
    doc.status = status;
    if (remarks !== undefined) doc.remarks = remarks || null;
    if (status === 'CLEARED') doc.clearedOn = date || doc.clearedOn || null;
    if (status === 'FAILED') {
      doc.failedOn = date || doc.failedOn || null;
      doc.failureReason = failureReason || 'NEFT failed';
    }
    doc.updatedBy = userId || null;
    await doc.save();
    if (doc.admissionNo && ['CLEARED', 'FAILED'].includes(status)) {
      triggerCommunicationEventSafe({
        tenantId,
        eventCode: status === 'CLEARED' ? 'PAYMENT_RECEIVED' : 'PAYMENT_FAILED',
        admissionNo: doc.admissionNo,
        sourceModule: 'FEE',
        sourceRefId: paymentId,
        userId,
        extraData: {
          paymentId: doc.paymentId,
          paymentType: doc.paymentType,
          paymentStatus: doc.status,
          amount: doc.amount,
          utr: doc?.neft?.utr || '',
          bankName: doc?.neft?.bankName || '',
          failureReason: doc.failureReason || ''
        }
      });
    }
    return res.status(200).json({ status: true, message: 'NEFT updated', data: { paymentId, status } });
  } catch (err) {
    return next(err);
  }
};

const listPayments = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const q = req.query || {};
    const pageNum = Math.max(parseInt(q.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const search = safeTrim(q.search);
    const paymentType = safeTrim(q.paymentType).toUpperCase();
    const status = safeTrim(q.status).toUpperCase();
    const includeInactive = safeTrim(q.includeInactive).toLowerCase() === 'yes';
    const fromDue = safeTrim(q.fromDue);
    const toDue = safeTrim(q.toDue);
    const fromPlanned = safeTrim(q.fromPlanned);
    const toPlanned = safeTrim(q.toPlanned);
    const fromPaid = safeTrim(q.fromPaid);
    const toPaid = safeTrim(q.toPaid);
    const fromDeposit = safeTrim(q.fromDeposit);
    const toDeposit = safeTrim(q.toDeposit);
    const centerId = safeTrim(q.centerId || req.body?.centerId);
    const programCode = safeTrim(q.programCode);
    const academicYear = safeTrim(q.academicYear);
    const query = { tenantId, isdeleted: false };
    if (!includeInactive) query.statusFlag = 'Active';
    if (paymentType && paymentType !== 'ALL') query.paymentType = paymentType;
    if (status && status !== 'ALL') query.status = status;
    if (academicYear) query.academicYear = academicYear;
    if (centerId) query.centerId = centerId;
    if (programCode) query.programCode = programCode;
    if (isValidYMD(fromDue) || isValidYMD(toDue)) {
      query['cheque.dueDate'] = {};
      if (isValidYMD(fromDue)) query['cheque.dueDate'].$gte = fromDue;
      if (isValidYMD(toDue)) query['cheque.dueDate'].$lte = toDue;
    }
    if (isValidYMD(fromPlanned) || isValidYMD(toPlanned)) {
      query['cheque.plannedDepositDate'] = {};
      if (isValidYMD(fromPlanned)) query['cheque.plannedDepositDate'].$gte = fromPlanned;
      if (isValidYMD(toPlanned)) query['cheque.plannedDepositDate'].$lte = toPlanned;
    }
    if (isValidYMD(fromDeposit) || isValidYMD(toDeposit)) {
      query.depositedOn = {};
      if (isValidYMD(fromDeposit)) query.depositedOn.$gte = fromDeposit;
      if (isValidYMD(toDeposit)) query.depositedOn.$lte = toDeposit;
    }
    if (isValidYMD(fromPaid) || isValidYMD(toPaid)) {
      query['neft.paidOn'] = {};
      if (isValidYMD(fromPaid)) query['neft.paidOn'].$gte = fromPaid;
      if (isValidYMD(toPaid)) query['neft.paidOn'].$lte = toPaid;
    }
    if (search) {
      query.$or = [
        { paymentId: buildRegex(search) },
        { admissionNo: buildRegex(search) },
        { studentName: buildRegex(search) },
        { registrationNumber: buildRegex(search) },
        { centerName: buildRegex(search) },
        { programName: buildRegex(search) },
        { programCode: buildRegex(search) },
        { 'neft.utr': buildRegex(search) },
        { 'cheque.chequeNo': buildRegex(search) },
        { 'cheque.bankName': buildRegex(search) },
        { 'neft.bankName': buildRegex(search) }
      ];
    }
    const listFull = safeTrim(q.list).toLowerCase() === 'full';
    const sort = parseSort(q.sort || '-createdAt');
    const baseFind = Payment.find(query, {
      _id: 0,
      paymentId: 1,
      paymentType: 1,
      status: 1,
      amount: 1,
      admissionNo: 1,
      studentName: 1,
      registrationNumber: 1,
      centerName: 1,
      programName: 1,
      programCode: 1,
      academicYear: 1,
      submittedOn: 1,
      depositedOn: 1,
      clearedOn: 1,
      failedOn: 1,
      failureReason: 1,
      depositBatchId: 1,
      'neft.utr': 1,
      'neft.paidOn': 1,
      'neft.bankName': 1,
      'cheque.chequeNo': 1,
      'cheque.dueDate': 1,
      'cheque.plannedDepositDate': 1,
      'cheque.mode': 1,
      'cheque.bankName': 1
    }).sort(sort);
    if (listFull) {
      const rows = await baseFind.lean();
      return res.status(200).json({
        status: true,
        message: 'Payments fetched',
        data: { rows, total: rows.length, page: 1, limit: rows.length, pages: 1 }
      });
    }
    const [rows, total] = await Promise.all([baseFind.skip(skip).limit(limitNum).lean(), Payment.countDocuments(query)]);
    return res.status(200).json({
      status: true,
      message: 'Payments fetched',
      data: { rows, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 0 }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  listCheques,
  viewCheque,
  updateChequeRemarks,
  createDepositBatch,
  listDepositBatches,
  viewDepositBatch,
  removeChequeFromDepositBatch,
  reconcileCheque,
  bulkReconcileCheques,
  requestChequeExtension,
  listChequeExtensions,
  viewChequeExtension,
  approveChequeExtension,
  rejectChequeExtension,
  requestChequeReplacement,
  requestNeftReplacementForCheque,
  replacementHistory,
  createChequeMerge,
  viewChequeMerge,
  unmergeCheques,
  listNeft,
  updateNeftStatus,
  listPayments
};

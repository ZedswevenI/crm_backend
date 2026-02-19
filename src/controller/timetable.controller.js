import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import TimeTable from '../models/timetable.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const isValidDay = (d) => DAYS.includes(String(d || '').toUpperCase());
const normDay = (d) => String(d || '').toUpperCase();

const getPreviousMonday = (epochMs) => {
  const d = new Date(epochMs);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const validateTimeRange = (t) => {
  const startMin = toInt(t?.startMin, -1);
  const endMin = toInt(t?.endMin, -1);
  if (startMin < 0 || startMin > 1439) return { ok: false, msg: 'Invalid time.startMin' };
  if (endMin < 0 || endMin > 1439) return { ok: false, msg: 'Invalid time.endMin' };
  if (endMin <= startMin) return { ok: false, msg: 'time.endMin must be greater than time.startMin' };
  return { ok: true, startMin, endMin };
};

const normalizePeriod = (p) => {
  const periodNo = toInt(p?.periodNo, 0);
  const day = normDay(p?.day);
  const time = p?.time || {};
  const vr = validateTimeRange(time);
  if (!vr.ok) return { ok: false, msg: vr.msg };
  const facultyId = safeTrim(p?.facultyId);
  if (!facultyId) return { ok: false, msg: 'facultyId is required' };
  if (periodNo <= 0) return { ok: false, msg: 'periodNo must be >= 1' };
  if (p?.day !== undefined && !isValidDay(day)) return { ok: false, msg: 'Invalid day' };
  return {
    ok: true,
    period: {
      periodNo,
      time: {
        startMin: vr.startMin,
        endMin: vr.endMin,
        startLabel: safeTrim(time?.startLabel) || null,
        endLabel: safeTrim(time?.endLabel) || null
      },
      facultyId,
      facultyName: safeTrim(p?.facultyName) || null,
      subjectId: safeTrim(p?.subjectId) || null,
      subjectCode: safeTrim(p?.subjectCode) || null,
      subjectName: safeTrim(p?.subjectName) || null,
      topic: safeTrim(p?.topic) || null,
      venue: safeTrim(p?.venue) || null,
      isCancelled: !!p?.isCancelled,
      cancelReason: safeTrim(p?.cancelReason) || null,
      rearrangedTo: safeTrim(p?.rearrangedTo) || null,
      replacementFacultyId: safeTrim(p?.replacementFacultyId) || null,
      replacementSubjectId: safeTrim(p?.replacementSubjectId) || null,
      notes: safeTrim(p?.notes) || null
    },
    day
  };
};

const findTemplatePeriod = (tt, day, periodNo) => {
  const d = (tt?.week || []).find((x) => String(x?.day) === day);
  if (!d) return null;
  return (d?.periods || []).find((x) => toInt(x?.periodNo, 0) === toInt(periodNo, 0));
};

const upsertOverride = (tt, ov) => {
  const date = toInt(ov?.date, 0);
  const day = ov?.day ? normDay(ov.day) : null;
  const periodNo = ov?.periodNo !== null && ov?.periodNo !== undefined ? toInt(ov.periodNo, null) : null;
  const action = safeTrim(ov?.action);
  const idx = (tt.overrides || []).findIndex((x) => toInt(x?.date, 0) === date && String(x?.day || '') === String(day || '') && String(x?.action || '') === action && (periodNo === null ? x?.periodNo == null : toInt(x?.periodNo, 0) === periodNo));
  if (idx >= 0) tt.overrides[idx] = ov;
  else tt.overrides.push(ov);
};

const createTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId)
      return res.status(400).json({
        status: false,
        message: 'tenantId is required'
      });
    const payload = req.body || {};
    const batchCode = safeTrim(payload.batchCode);
    const inputWeekStart = toInt(payload.wkStartOn, 0);
    if (!batchCode || !inputWeekStart)
      return res.status(400).json({
        status: false,
        message: 'batchCode and wkStartOn are required'
      });
    const correctedMonday = getPreviousMonday(inputWeekStart);
    const weekIn = Array.isArray(payload.week) ? payload.week : [];
    const week = [];
    for (const d of weekIn) {
      const day = normDay(d?.day);
      if (!isValidDay(day))
        return res.status(400).json({
          status: false,
          message: `Invalid day ${d?.day}`
        });
      const periodsIn = Array.isArray(d?.periods) ? d.periods : [];
      const periods = [];
      for (const p of periodsIn) {
        const np = normalizePeriod({ ...p, day });
        if (!np.ok)
          return res.status(400).json({
            status: false,
            message: np.msg
          });
        periods.push(np.period);
      }
      week.push({ day, periods });
    }
    const doc = await TimeTable.findOneAndUpdate(
      {
        tenantId,
        batchCode,
        wkStartOn: correctedMonday,
        isdeleted: false
      },
      {
        $set: {
          tenantId,
          batchCode,
          wkStartOn: correctedMonday,
          centerCode: safeTrim(payload.centerCode) || null,
          phase: safeTrim(payload.phase) || null,
          status: safeTrim(payload.status) || 'Active',
          week,
          updatedBy: payload.userId || null
        },
        $setOnInsert: {
          createdBy: payload.userId || null,
          isdeleted: false
        }
      },
      { new: true, upsert: true }
    );
    if (correctedMonday !== inputWeekStart) {
      let d = new Date(correctedMonday);
      const end = new Date(inputWeekStart);
      while (d < end) {
        const holidayDate = d.getTime();
        upsertOverride(doc, {
          date: holidayDate,
          day: DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1],
          periodNo: null,
          action: 'CANCEL_DAY',
          period: null,
          reason: 'Auto Holiday (Invalid Week Start)'
        });

        d.setDate(d.getDate() + 1);
      }

      await doc.save();
    }

    return res.status(200).json({
      status: true,
      message: 'Timetable saved',
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const cancelWholeDay = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const reason = safeTrim(req.body?.reason) || 'Holiday';

    if (!tenantId || !timetableId || !date)
      return res.status(400).json({
        status: false,
        message: 'tenantId, timetableId and date required'
      });

    const tt = await TimeTable.findOne({
      _id: timetableId,
      tenantId,
      isdeleted: false
    });

    if (!tt)
      return res.status(404).json({
        status: false,
        message: 'Timetable not found'
      });

    const d = new Date(date);
    const day = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];

    upsertOverride(tt, {
      date,
      day,
      periodNo: null,
      action: 'CANCEL_DAY',
      period: null,
      reason
    });

    await tt.save();

    return res.json({
      status: true,
      message: 'Whole day cancelled'
    });
  } catch (err) {
    return next(err);
  }
};

// ======================================================
// 🔹 EDIT WHOLE DAY
// ======================================================
const editWholeDay = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const periods = Array.isArray(req.body?.periods) ? req.body.periods : [];

    if (!tenantId || !timetableId || !date)
      return res.status(400).json({
        status: false,
        message: 'tenantId, timetableId and date required'
      });

    const tt = await TimeTable.findOne({
      _id: timetableId,
      tenantId,
      isdeleted: false
    });

    if (!tt)
      return res.status(404).json({
        status: false,
        message: 'Timetable not found'
      });

    const d = new Date(date);
    const day = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];

    const normalizedPeriods = [];

    for (const p of periods) {
      const np = normalizePeriod({ ...p, day });
      if (!np.ok)
        return res.status(400).json({
          status: false,
          message: np.msg
        });

      normalizedPeriods.push(np.period);
    }

    upsertOverride(tt, {
      date,
      day,
      periodNo: null,
      action: 'REPLACE_PERIOD',
      period: { periods: normalizedPeriods },
      reason: 'Whole day edited'
    });

    await tt.save();

    return res.json({
      status: true,
      message: 'Whole day updated'
    });
  } catch (err) {
    return next(err);
  }
};

const listTimeTables = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const skip = (page - 1) * limit;

    const list = safeTrim(req.query.list);
    const search = safeTrim(req.query.search);

    const batchCode = safeTrim(req.query.batchCode);
    const centerCode = safeTrim(req.query.centerCode);
    const phase = safeTrim(req.query.phase);
    const wkFrom = toInt(req.query.wkFrom, 0);
    const wkTo = toInt(req.query.wkTo, 0);

    const query = { tenantId, isdeleted: false };

    if (batchCode) query.batchCode = batchCode;
    if (centerCode) query.centerCode = centerCode;
    if (phase) query.phase = phase;

    if (wkFrom) query.wkStartOn = { ...(query.wkStartOn || {}), $gte: wkFrom };
    if (wkTo) query.wkStartOn = { ...(query.wkStartOn || {}), $lte: wkTo };

    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ batchCode: rx }, { centerCode: rx }, { phase: rx }];
    }

    if (list === 'full') {
      const rows = await TimeTable.find(query).sort({ wkStartOn: -1 }).lean();

      return res.json({ status: true, data: rows, count: rows.length });
    }

    const [rows, count] = await Promise.all([TimeTable.find(query).sort({ wkStartOn: -1 }).skip(skip).limit(limit).lean(), TimeTable.countDocuments(query)]);

    return res.json({ status: true, data: rows, count });
  } catch (err) {
    return next(err);
  }
};

const viewTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const timetableId = safeTrim(req.body?.timetableId);
    const batchCode = safeTrim(req.body?.batchCode);
    const wkStartOn = toInt(req.body?.wkStartOn, 0);

    const query = { tenantId, isdeleted: false };

    if (timetableId) {
      query._id = timetableId;
    } else {
      if (!batchCode || !wkStartOn)
        return res.status(400).json({
          status: false,
          message: 'Provide timetableId OR (batchCode + wkStartOn)'
        });

      query.batchCode = batchCode;
      query.wkStartOn = wkStartOn;
    }

    const doc = await TimeTable.findOne(query).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Timetable not found' });

    return res.json({ status: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

const listTimeTablesByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode);

    if (!tenantId || !batchCode)
      return res.status(400).json({
        status: false,
        message: 'tenantId and batchCode required'
      });

    const wkFrom = toInt(req.query.wkFrom, 0);
    const wkTo = toInt(req.query.wkTo, 0);

    const query = { tenantId, batchCode, isdeleted: false };

    if (wkFrom) query.wkStartOn = { ...(query.wkStartOn || {}), $gte: wkFrom };
    if (wkTo) query.wkStartOn = { ...(query.wkStartOn || {}), $lte: wkTo };

    const rows = await TimeTable.find(query).sort({ wkStartOn: -1 }).lean();

    return res.json({ status: true, data: rows, count: rows.length });
  } catch (err) {
    return next(err);
  }
};

const cancelPeriod = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const reason = safeTrim(req.body?.reason) || 'Cancelled';

    if (!tenantId || !timetableId || !date || !periodNo) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, periodNo);
    if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });

    upsertOverride(tt, {
      date,
      day,
      periodNo,
      action: 'CANCEL_PERIOD',
      period: {
        ...(base.toObject?.() ?? base),
        isCancelled: true,
        cancelReason: reason
      },
      reason
    });

    tt.updatedBy = userId;
    await tt.save();

    return res.json({ status: true, message: 'Period cancelled' });
  } catch (err) {
    return next(err);
  }
};

const rearrangeStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const newFacultyId = safeTrim(req.body?.newFacultyId);
    const newFacultyName = safeTrim(req.body?.newFacultyName);

    if (!tenantId || !timetableId || !date || !periodNo || !newFacultyId) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, periodNo);
    if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });

    upsertOverride(tt, {
      date,
      day,
      periodNo,
      action: 'REPLACE_PERIOD',
      period: {
        ...(base.toObject?.() ?? base),
        facultyId: newFacultyId,
        facultyName: newFacultyName || null,
        replacementFacultyId: newFacultyId,
        isCancelled: false
      },
      reason: 'Faculty rearranged'
    });

    await tt.save();

    return res.json({ status: true, message: 'Faculty updated' });
  } catch (err) {
    return next(err);
  }
};

const changePeriod = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const fromPeriodNo = toInt(req.body?.fromPeriodNo, 0);
    const toPeriodNo = toInt(req.body?.toPeriodNo, 0);

    if (!tenantId || !timetableId || !date || !fromPeriodNo || !toPeriodNo) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, fromPeriodNo);
    if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });

    upsertOverride(tt, {
      date,
      day,
      periodNo: fromPeriodNo,
      action: 'MOVE_PERIOD',
      period: {
        ...(base.toObject?.() ?? base),
        periodNo: toPeriodNo
      },
      reason: 'Period moved'
    });

    await tt.save();

    return res.json({ status: true, message: 'Period moved' });
  } catch (err) {
    return next(err);
  }
};

const replacePeriod = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const periodIn = req.body?.period || {};

    if (!tenantId || !timetableId || !date || !periodNo) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, periodNo);
    if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });

    const np = normalizePeriod({ ...base.toObject(), ...periodIn, periodNo, day });
    if (!np.ok) return res.status(400).json({ status: false, message: np.msg });

    upsertOverride(tt, {
      date,
      day,
      periodNo,
      action: 'REPLACE_PERIOD',
      period: np.period,
      reason: 'Period replaced'
    });

    await tt.save();

    return res.json({ status: true, message: 'Period replaced' });
  } catch (err) {
    return next(err);
  }
};

const bulkUploadTimeTables = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const data = Array.isArray(req.body?.data) ? req.body.data : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!data.length) return res.status(400).json({ status: false, message: 'No data provided for bulk upload' });
    const ops = [];
    for (const item of data) {
      const batchCode = safeTrim(item.batchCode);
      const inputWeekStart = toInt(item.wkStartOn, 0);
      if (!batchCode || !inputWeekStart) continue;
      const correctedMonday = getPreviousMonday(inputWeekStart);
      const weekIn = Array.isArray(item.week) ? item.week : [];
      const week = [];
      for (const d of weekIn) {
        const day = normDay(d?.day);
        if (!isValidDay(day)) continue;
        const periodsIn = Array.isArray(d?.periods) ? d.periods : [];
        const periods = [];
        for (const p of periodsIn) {
          const np = normalizePeriod({ ...p, day });
          if (np.ok) periods.push(np.period);
        }
        week.push({ day, periods });
      }
      ops.push({
        updateOne: {
          filter: { tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false },
          update: {
            $set: {
              centerCode: safeTrim(item.centerCode) || null,
              phase: safeTrim(item.phase) || null,
              status: safeTrim(item.status) || 'Active',
              week,
              updatedBy: userId || null
            },
            $setOnInsert: { createdBy: userId || null }
          },
          upsert: true
        }
      });
    }
    if (!ops.length) return res.status(400).json({ status: false, message: 'No valid timetable data found to process' });
    const result = await TimeTable.bulkWrite(ops, { ordered: false });
    return res.status(200).json({
      status: true,
      message: 'Bulk upload completed',
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      }
    });
  } catch (err) {
    return next(err);
  }
};

const logLateEntry = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { type, personId, personName, timetableId, batchCode, date, periodNo, scheduledStartMin, delayMinutes, reason } = req.body;
    if (!tenantId || !type || !personId || !timetableId || !date || !periodNo || scheduledStartMin === undefined || delayMinutes === undefined) {
      return res.status(400).json({ status: false, message: 'Missing required fields for late entry' });
    }
    if (!['STAFF', 'STUDENT'].includes(String(type).toUpperCase())) {
      return res.status(400).json({ status: false, message: 'Invalid type. Must be STAFF or STUDENT' });
    }
    const doc = await LateEntryLog.findOneAndUpdate(
      { tenantId, type: String(type).toUpperCase(), personId, date: toInt(date, 0), periodNo: toInt(periodNo, 0), isdeleted: false },
      {
        $set: {
          personName: safeTrim(personName),
          timetableId: safeTrim(timetableId),
          batchCode: safeTrim(batchCode),
          scheduledStartMin: toInt(scheduledStartMin, 0),
          actualEntryTime: Date.now(),
          delayMinutes: toInt(delayMinutes, 0),
          reason: safeTrim(reason) || null,
          updatedBy: userId
        },
        $setOnInsert: { createdBy: userId }
      },
      { new: true, upsert: true }
    );
    return res.status(200).json({
      status: true,
      message: `${type} late entry logged successfully`,
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const listStaffLateEntries = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const page = Math.max(parseInt(req.query.page || req.body.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || req.body.limit || '20', 10), 1), 200);
    const skip = (page - 1) * limit;

    const { personId, batchCode, dateFrom, dateTo, search } = req.body;

    const query = { tenantId, type: 'STAFF', isdeleted: false };

    if (personId) query.personId = safeTrim(personId);
    if (batchCode) query.batchCode = safeTrim(batchCode);
    if (dateFrom) query.date = { ...(query.date || {}), $gte: toInt(dateFrom, 0) };
    if (dateTo) query.date = { ...(query.date || {}), $lte: toInt(dateTo, 0) };
    if (search) query.personName = new RegExp(escapeRegex(search), 'i');

    const [rows, count] = await Promise.all([LateEntryLog.find(query).sort({ date: -1, actualEntryTime: -1 }).skip(skip).limit(limit).lean(), LateEntryLog.countDocuments(query)]);

    return res.json({ status: true, data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const listStudentLateEntries = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const page = Math.max(parseInt(req.query.page || req.body.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || req.body.limit || '20', 10), 1), 200);
    const skip = (page - 1) * limit;
    const { personId, batchCode, dateFrom, dateTo, search } = req.body;
    const query = { tenantId, type: 'STUDENT', isdeleted: false };
    if (personId) query.personId = safeTrim(personId);
    if (batchCode) query.batchCode = safeTrim(batchCode);
    if (dateFrom) query.date = { ...(query.date || {}), $gte: toInt(dateFrom, 0) };
    if (dateTo) query.date = { ...(query.date || {}), $lte: toInt(dateTo, 0) };
    if (search) query.personName = new RegExp(escapeRegex(search), 'i');
    const [rows, count] = await Promise.all([LateEntryLog.find(query).sort({ date: -1, actualEntryTime: -1 }).skip(skip).limit(limit).lean(), LateEntryLog.countDocuments(query)]);
    return res.json({ status: true, data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

export default {
  createTimeTable,
  cancelWholeDay,
  editWholeDay,
  listTimeTables,
  viewTimeTable,
  listTimeTablesByBatch,
  cancelPeriod,
  rearrangeStaff,
  changePeriod,
  replacePeriod,
  bulkUploadTimeTables,
  logLateEntry,
  listStudentLateEntries,
  listStaffLateEntries
};

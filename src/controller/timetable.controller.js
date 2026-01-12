import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import TimeTable from '../models/timetable.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const ACTIONS = ['CANCEL_DAY', 'CANCEL_PERIOD', 'REPLACE_PERIOD', 'ADD_PERIOD', 'MOVE_PERIOD'];

const isValidDay = (d) => DAYS.includes(String(d || '').toUpperCase());
const normDay = (d) => String(d || '').toUpperCase();

const minutesFromHHMM = (s) => {
  const x = safeTrim(s);
  const m = x.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = toInt(m[1], -1);
  const mm = toInt(m[2], -1);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
};

const validateTimeRange = (t) => {
  const startMin = toInt(t?.startMin, -1);
  const endMin = toInt(t?.endMin, -1);
  if (startMin < 0 || startMin > 1439) return { ok: false, msg: 'Invalid time.startMin' };
  if (endMin < 0 || endMin > 1439) return { ok: false, msg: 'Invalid time.endMin' };
  if (endMin <= startMin) return { ok: false, msg: 'time.endMin must be greater than time.startMin' };
  return { ok: true, msg: 'OK', startMin, endMin };
};

const normalizePeriod = (p) => {
  const periodNo = toInt(p?.periodNo, 0);
  const day = normDay(p?.day); // allow input with day in period payload
  const time = p?.time || {};
  const vr = validateTimeRange(time);
  if (!vr.ok) return { ok: false, msg: vr.msg };

  const facultyId = safeTrim(p?.facultyId);
  if (!facultyId) return { ok: false, msg: 'facultyId is required' };
  if (periodNo <= 0) return { ok: false, msg: 'periodNo must be >= 1' };
  if (p?.day !== undefined && !isValidDay(day)) return { ok: false, msg: 'Invalid day' };

  return {
    ok: true,
    msg: 'OK',
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
    day: p?.day !== undefined ? day : null
  };
};

const findTemplatePeriod = (tt, day, periodNo) => {
  const d = (tt?.week || []).find((x) => String(x?.day) === day);
  if (!d) return null;
  const p = (d?.periods || []).find((x) => toInt(x?.periodNo, 0) === toInt(periodNo, 0));
  return p || null;
};

const upsertOverride = (tt, ov) => {
  // uniqueness: date+day+periodNo+action. Replace if exists, else push.
  const date = toInt(ov?.date, 0);
  const day = ov?.day ? normDay(ov.day) : null;
  const periodNo = ov?.periodNo !== null && ov?.periodNo !== undefined ? toInt(ov.periodNo, null) : null;
  const action = safeTrim(ov?.action);

  const idx = (tt.overrides || []).findIndex((x) => toInt(x?.date, 0) === date && String(x?.day || '') === String(day || '') && String(x?.action || '') === String(action || '') && (periodNo === null ? x?.periodNo == null : toInt(x?.periodNo, 0) === periodNo));

  if (idx >= 0) tt.overrides[idx] = ov;
  else tt.overrides.push(ov);
};

// ---------------- CREATE / UPSERT WEEK ----------------
const createTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const payload = req.body || {};
    const batchCode = safeTrim(payload.batchCode);
    const wkStartOn = toInt(payload.wkStartOn, 0);
    if (!batchCode || !wkStartOn) {
      return res.status(400).json({ status: false, message: 'batchCode and wkStartOn are required' });
    }

    const weekIn = Array.isArray(payload.week) ? payload.week : [];
    // Expect format: [{day:'MONDAY', periods:[...]}]
    const week = [];
    for (const d of weekIn) {
      const day = normDay(d?.day);
      if (!isValidDay(day)) {
        return res.status(400).json({ status: false, message: `Invalid day in week: ${safeTrim(d?.day)}` });
      }
      const periodsIn = Array.isArray(d?.periods) ? d.periods : [];
      const periods = [];
      for (const p of periodsIn) {
        const np = normalizePeriod({ ...p, day });
        if (!np.ok) return res.status(400).json({ status: false, message: `Invalid period in ${day}: ${np.msg}` });
        periods.push(np.period);
      }

      // prevent duplicate periodNo inside a day
      const set = new Set();
      for (const p of periods) {
        const k = String(p.periodNo);
        if (set.has(k)) return res.status(400).json({ status: false, message: `Duplicate periodNo ${k} in ${day}` });
        set.add(k);
      }

      week.push({ day, periods });
    }

    const doc = await TimeTable.findOneAndUpdate(
      { tenantId, batchCode, wkStartOn, isdeleted: false },
      {
        $set: {
          tenantId,
          batchCode,
          wkStartOn,
          centerCode: safeTrim(payload.centerCode) || null,
          phase: safeTrim(payload.phase) || null,
          status: safeTrim(payload.status) || 'Active',
          week,
          updatedBy: payload.userId || null
        },
        $setOnInsert: { isdeleted: false, createdBy: payload.userId || null }
      },
      { new: true, upsert: true }
    ).lean();

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Timetable saved', data: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ status: false, message: 'Timetable already exists for this batch and week' });
    }
    return next(err);
  }
};

// ---------------- LIST (pagination + list=full) ----------------
const listTimeTables = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

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
      const rows = await TimeTable.find(query).sort({ wkStartOn: -1, createdAt: -1 }).lean();
      return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: rows, count: rows.length });
    }

    const [rows, count] = await Promise.all([
      TimeTable.find(query, {
        _id: 1,
        tenantId: 1,
        batchCode: 1,
        centerCode: 1,
        phase: 1,
        wkStartOn: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1
      })
        .sort({ wkStartOn: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TimeTable.countDocuments(query)
    ]);

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: rows, count });
  } catch (err) {
    return next(err);
  }
};

// ---------------- VIEW (by timetableId OR batchCode+wkStartOn) ----------------
const viewTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const timetableId = safeTrim(req.body?.timetableId);
    const batchCode = safeTrim(req.body?.batchCode);
    const wkStartOn = toInt(req.body?.wkStartOn, 0);

    const q = { tenantId, isdeleted: false };
    if (timetableId) q._id = timetableId;
    else {
      if (!batchCode || !wkStartOn) {
        return res.status(400).json({ status: false, message: 'timetableId OR (batchCode and wkStartOn) are required' });
      }
      q.batchCode = batchCode;
      q.wkStartOn = wkStartOn;
    }

    const doc = await TimeTable.findOne(q).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Timetable not found' });

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: doc });
  } catch (err) {
    return next(err);
  }
};

// ---------------- LIST by Batch (week range) ----------------
const listTimeTablesByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!batchCode) return res.status(400).json({ status: false, message: 'batchCode is required' });

    const wkFrom = toInt(req.query.wkFrom, 0);
    const wkTo = toInt(req.query.wkTo, 0);

    const query = { tenantId, isdeleted: false, batchCode };
    if (wkFrom) query.wkStartOn = { ...(query.wkStartOn || {}), $gte: wkFrom };
    if (wkTo) query.wkStartOn = { ...(query.wkStartOn || {}), $lte: wkTo };

    const rows = await TimeTable.find(query).sort({ wkStartOn: -1 }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: rows, count: rows.length });
  } catch (err) {
    return next(err);
  }
};

// ===================== Period Operations via OVERRIDES =====================
//
// All below will:
// 1) ensure timetable exists
// 2) validate day/periodNo/date
// 3) push/replace an override in overrides[]
//
// date: epoch ms for that day (00:00). We keep it as given (your choice).
//

const cancelPeriod = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const timetableId = safeTrim(req.body?.timetableId);
    const batchCode = safeTrim(req.body?.batchCode);
    const wkStartOn = toInt(req.body?.wkStartOn, 0);

    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const reason = safeTrim(req.body?.reason);

    if (!date) return res.status(400).json({ status: false, message: 'date (epoch ms) is required' });
    if (!isValidDay(day)) return res.status(400).json({ status: false, message: 'Valid day is required' });
    if (!periodNo) return res.status(400).json({ status: false, message: 'periodNo is required' });

    const q = { tenantId, isdeleted: false };
    if (timetableId) q._id = timetableId;
    else {
      if (!batchCode || !wkStartOn) return res.status(400).json({ status: false, message: 'timetableId OR (batchCode and wkStartOn) required' });
      q.batchCode = batchCode;
      q.wkStartOn = wkStartOn;
    }

    const tt = await TimeTable.findOne(q);
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, periodNo);
    if (!base) return res.status(400).json({ status: false, message: `No template period ${periodNo} found in ${day}` });

    const ov = {
      date,
      day,
      periodNo,
      action: 'CANCEL_PERIOD',
      period: {
        ...(base.toObject?.() ?? base),
        isCancelled: true,
        cancelReason: reason || 'Cancelled',
        notes: null
      },
      reason: reason || null
    };

    tt.overrides = tt.overrides || [];
    upsertOverride(tt, ov);
    tt.updatedBy = userId || tt.updatedBy;
    await tt.save();

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Period cancelled', data: { timetableId: tt._id, date, day, periodNo } });
  } catch (err) {
    return next(err);
  }
};

const rearrangeStaff = async (req, res, next) => {
  // change staff only = REPLACE_PERIOD override with facultyId replaced
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const timetableId = safeTrim(req.body?.timetableId);
    const batchCode = safeTrim(req.body?.batchCode);
    const wkStartOn = toInt(req.body?.wkStartOn, 0);

    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);

    const newFacultyId = safeTrim(req.body?.newFacultyId || req.body?.facultyId);
    const newFacultyName = safeTrim(req.body?.newFacultyName || req.body?.facultyName);
    const rearrangedTo = safeTrim(req.body?.rearrangedTo);
    const reason = safeTrim(req.body?.reason);

    if (!date) return res.status(400).json({ status: false, message: 'date (epoch ms) is required' });
    if (!isValidDay(day)) return res.status(400).json({ status: false, message: 'Valid day is required' });
    if (!periodNo) return res.status(400).json({ status: false, message: 'periodNo is required' });
    if (!newFacultyId) return res.status(400).json({ status: false, message: 'newFacultyId is required' });

    const q = { tenantId, isdeleted: false };
    if (timetableId) q._id = timetableId;
    else {
      if (!batchCode || !wkStartOn) return res.status(400).json({ status: false, message: 'timetableId OR (batchCode and wkStartOn) required' });
      q.batchCode = batchCode;
      q.wkStartOn = wkStartOn;
    }

    const tt = await TimeTable.findOne(q);
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, periodNo);
    if (!base) return res.status(400).json({ status: false, message: `No template period ${periodNo} found in ${day}` });

    const ov = {
      date,
      day,
      periodNo,
      action: 'REPLACE_PERIOD',
      period: {
        ...(base.toObject?.() ?? base),
        facultyId: newFacultyId,
        facultyName: newFacultyName || null,
        rearrangedTo: rearrangedTo || null,
        replacementFacultyId: newFacultyId,
        notes: reason || null,
        isCancelled: false,
        cancelReason: null
      },
      reason: reason || null
    };

    tt.overrides = tt.overrides || [];
    upsertOverride(tt, ov);
    tt.updatedBy = userId || tt.updatedBy;
    await tt.save();

    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Staff rearranged',
      data: { timetableId: tt._id, date, day, periodNo, newFacultyId }
    });
  } catch (err) {
    return next(err);
  }
};

const changePeriod = async (req, res, next) => {
  // move one period to another time/periodNo within same day/date
  // action MOVE_PERIOD (store period with updated periodNo/time, keep old in reason)
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const timetableId = safeTrim(req.body?.timetableId);
    const batchCode = safeTrim(req.body?.batchCode);
    const wkStartOn = toInt(req.body?.wkStartOn, 0);

    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const fromPeriodNo = toInt(req.body?.fromPeriodNo || req.body?.periodNo, 0);
    const toPeriodNo = toInt(req.body?.toPeriodNo, 0);
    const toTime = req.body?.toTime || null; // {startMin,endMin,startLabel,endLabel}
    const reason = safeTrim(req.body?.reason);

    if (!date) return res.status(400).json({ status: false, message: 'date (epoch ms) is required' });
    if (!isValidDay(day)) return res.status(400).json({ status: false, message: 'Valid day is required' });
    if (!fromPeriodNo) return res.status(400).json({ status: false, message: 'fromPeriodNo is required' });
    if (!toPeriodNo) return res.status(400).json({ status: false, message: 'toPeriodNo is required' });

    const q = { tenantId, isdeleted: false };
    if (timetableId) q._id = timetableId;
    else {
      if (!batchCode || !wkStartOn) return res.status(400).json({ status: false, message: 'timetableId OR (batchCode and wkStartOn) required' });
      q.batchCode = batchCode;
      q.wkStartOn = wkStartOn;
    }

    const tt = await TimeTable.findOne(q);
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, fromPeriodNo);
    if (!base) return res.status(400).json({ status: false, message: `No template period ${fromPeriodNo} found in ${day}` });

    let time = base.time;
    if (toTime) {
      const vr = validateTimeRange(toTime);
      if (!vr.ok) return res.status(400).json({ status: false, message: vr.msg });
      time = {
        startMin: vr.startMin,
        endMin: vr.endMin,
        startLabel: safeTrim(toTime?.startLabel) || null,
        endLabel: safeTrim(toTime?.endLabel) || null
      };
    }

    const ov = {
      date,
      day,
      periodNo: fromPeriodNo,
      action: 'MOVE_PERIOD',
      period: {
        ...(base.toObject?.() ?? base),
        periodNo: toPeriodNo,
        time,
        notes: reason || null
      },
      reason: reason || null
    };

    tt.overrides = tt.overrides || [];
    upsertOverride(tt, ov);
    tt.updatedBy = userId || tt.updatedBy;
    await tt.save();

    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Period moved',
      data: { timetableId: tt._id, date, day, fromPeriodNo, toPeriodNo }
    });
  } catch (err) {
    return next(err);
  }
};

const replacePeriod = async (req, res, next) => {
  // change everything of a period (faculty/subject/time/venue/topic etc.)
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const timetableId = safeTrim(req.body?.timetableId);
    const batchCode = safeTrim(req.body?.batchCode);
    const wkStartOn = toInt(req.body?.wkStartOn, 0);

    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const periodIn = req.body?.period || req.body; // allow direct fields

    if (!date) return res.status(400).json({ status: false, message: 'date (epoch ms) is required' });
    if (!isValidDay(day)) return res.status(400).json({ status: false, message: 'Valid day is required' });
    if (!periodNo) return res.status(400).json({ status: false, message: 'periodNo is required' });

    const q = { tenantId, isdeleted: false };
    if (timetableId) q._id = timetableId;
    else {
      if (!batchCode || !wkStartOn) return res.status(400).json({ status: false, message: 'timetableId OR (batchCode and wkStartOn) required' });
      q.batchCode = batchCode;
      q.wkStartOn = wkStartOn;
    }

    const tt = await TimeTable.findOne(q);
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, periodNo);
    if (!base) return res.status(400).json({ status: false, message: `No template period ${periodNo} found in ${day}` });

    const np = normalizePeriod({ ...(base.toObject?.() ?? base), ...periodIn, periodNo });
    if (!np.ok) return res.status(400).json({ status: false, message: np.msg });

    const ov = {
      date,
      day,
      periodNo,
      action: 'REPLACE_PERIOD',
      period: { ...np.period, notes: safeTrim(periodIn?.notes) || null },
      reason: safeTrim(req.body?.reason || periodIn?.notes) || null
    };

    tt.overrides = tt.overrides || [];
    upsertOverride(tt, ov);
    tt.updatedBy = userId || tt.updatedBy;
    await tt.save();

    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Period replaced',
      data: { timetableId: tt._id, date, day, periodNo }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createTimeTable,
  listTimeTables,
  viewTimeTable,
  listTimeTablesByBatch,
  rearrangeStaff,
  cancelPeriod,
  changePeriod,
  replacePeriod
};

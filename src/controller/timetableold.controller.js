import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import TimeTable from '../models/timetable.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import Attendance from '../models/attandence.model.js';
import Staff from '../models/staff.model.js';

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

// const getPreviousMonday = (epochMs) => {
//   const d = new Date(epochMs);
//   const day = d.getDay(); // 0=Sun
//   const diff = day === 0 ? -6 : 1 - day; // shift to monday
//   d.setDate(d.getDate() + diff);
//   d.setHours(0, 0, 0, 0);
//   return d.getTime();
// };

const getPreviousMonday = (epochMs) => {
  const d = new Date(epochMs);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};

// const getOffsetDate = (wkStartOn, dayName) => {
//   const offsets = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
//   const offsetMs = (offsets[dayName] || 0) * 24 * 60 * 60 * 1000;
//   return wkStartOn + offsetMs;
// };

const getOffsetDate = (wkStartOn, dayName) => {
  const offsets = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
  const offset = offsets[dayName] ?? 0;
  const d = new Date(wkStartOn);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);
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

  const periodType = safeTrim(p?.periodType) || 'LECTURE';
  const validPeriodTypes = ['LECTURE', 'EXAM', 'LAB', 'TUTORIAL', 'TEST', 'REVISION'];
  if (!validPeriodTypes.includes(periodType)) {
    return { ok: false, msg: `periodType must be one of: ${validPeriodTypes.join(', ')}` };
  }

  // const mode = safeTrim(p?.mode) || 'OFFLINE';
  // if (!['OFFLINE', 'ONLINE'].includes(mode)) {
  //   return { ok: false, msg: 'mode must be OFFLINE or ONLINE' };
  // }

  const mode = safeTrim(p?.mode) || 'OFFLINE';
  const validModes = ['OFFLINE', 'ONLINE'];
  if (!validModes.includes(mode)) {
    return { ok: false, msg: `mode must be one of: ${validModes.join(', ')}` };
  }

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
      periodType,
      examId: safeTrim(p?.examId) || null,
      examDescription: safeTrim(p?.examDescription) || null,
      mode,
      zoomUrl: safeTrim(p?.zoomUrl) || null,
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

const upsertDayOverride = (tt, ov) => {
  const date = toInt(ov?.date, 0);
  const day = normDay(ov?.day);
  const action = safeTrim(ov?.action);
  const idx = (tt.dayOverrides || []).findIndex((x) => toInt(x?.date, 0) === date && normDay(x?.day) === day && String(x?.action || '') === action);
  if (idx >= 0) tt.dayOverrides[idx] = { ...(tt.dayOverrides[idx].toObject?.() ?? tt.dayOverrides[idx]), ...ov };
  else tt.dayOverrides.push(ov);
};

const upsertPeriodOverride = (tt, ov) => {
  const date = toInt(ov?.date, 0);
  const day = normDay(ov?.day);
  const periodNo = toInt(ov?.periodNo, 0);
  const action = safeTrim(ov?.action);
  const idx = (tt.periodOverrides || []).findIndex((x) => toInt(x?.date, 0) === date && normDay(x?.day) === day && toInt(x?.periodNo, 0) === periodNo && String(x?.action || '') === action);
  if (idx >= 0) tt.periodOverrides[idx] = { ...(tt.periodOverrides[idx].toObject?.() ?? tt.periodOverrides[idx]), ...ov };
  else tt.periodOverrides.push(ov);
};

/**
 * Build actual periods for a given date:
 * 1) template day periods
 * 2) apply dayOverrides(CANCEL_DAY/REPLACE_DAY)
 * 3) apply periodOverrides(CANCEL/REPLACE/ADD/MOVE)
 */
const buildDaySchedule = (tt, dateEpochMs) => {
  const d = new Date(dateEpochMs);
  // const dayName = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
  const dayName = DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
  const baseDay = (tt.week || []).find((w) => w.day === dayName);
  let periods = baseDay ? JSON.parse(JSON.stringify(baseDay.periods || [])) : [];
  const dayOv = (tt.dayOverrides || []).find((o) => toInt(o?.date, 0) === toInt(dateEpochMs, 0) && normDay(o?.day) === dayName);
  if (dayOv) {
    if (dayOv.action === 'CANCEL_DAY') {
      return {
        date: dateEpochMs,
        day: dayName,
        isHoliday: true,
        holidayReason: dayOv.reason || 'Holiday',
        periods: []
      };
    }
    if (dayOv.action === 'REPLACE_DAY') {
      periods = Array.isArray(dayOv.periods) ? JSON.parse(JSON.stringify(dayOv.periods)) : [];
    }
  }
  const povs = (tt.periodOverrides || []).filter((o) => toInt(o?.date, 0) === toInt(dateEpochMs, 0) && normDay(o?.day) === dayName);
  for (const ov of povs) {
    const pno = toInt(ov?.periodNo, 0);
    if (!pno) continue;
    if (ov.action === 'CANCEL_PERIOD') {
      const idx = periods.findIndex((p) => toInt(p?.periodNo, 0) === pno);
      if (idx !== -1) periods[idx] = { ...periods[idx], isCancelled: true, cancelReason: ov.reason || periods[idx].cancelReason || null };
      continue;
    }
    if (ov.action === 'REPLACE_PERIOD') {
      const repl = ov.period ? JSON.parse(JSON.stringify(ov.period)) : null;
      if (!repl) continue;
      const idx = periods.findIndex((p) => toInt(p?.periodNo, 0) === pno);
      if (idx !== -1) periods[idx] = { ...periods[idx], ...repl, periodNo: pno };
      else periods.push({ ...repl, periodNo: pno });
      continue;
    }
    if (ov.action === 'ADD_PERIOD') {
      const add = ov.period ? JSON.parse(JSON.stringify(ov.period)) : null;
      if (!add) continue;
      const exists = periods.some((p) => toInt(p?.periodNo, 0) === pno);
      if (!exists) periods.push({ ...add, periodNo: pno });
      continue;
    }
  }
  for (const ov of povs.filter((x) => x.action === 'MOVE_PERIOD')) {
    const fromNo = toInt(ov?.periodNo, 0);
    const toNo = toInt(ov?.toPeriodNo, 0);
    if (!fromNo || !toNo) continue;
    const fromIdx = periods.findIndex((p) => toInt(p?.periodNo, 0) === fromNo);
    if (fromIdx === -1) continue;
    periods[fromIdx] = { ...periods[fromIdx], periodNo: toNo };
  }
  periods = periods.sort((a, b) => (toInt(a?.periodNo, 0) || 0) - (toInt(b?.periodNo, 0) || 0));
  return {
    date: dateEpochMs,
    day: dayName,
    isHoliday: false,
    holidayReason: null,
    periods
  };
};

const checkStaffConflicts = async (tenantId, facultyId, date, day, startMin, endMin, excludeTimetableId = null) => {
  const staff = await Staff.findOne({ staffId: facultyId, tenantId, isdeleted: false }).lean();
  if (staff && staff.weekoff && staff.weekoff.includes(day)) {
    return { conflict: true, message: `Faculty ${staff.name || facultyId} has a week-off on ${day}.` };
  }

  const wkStartOn = getPreviousMonday(date);
  const query = { tenantId, wkStartOn, isdeleted: false };
  if (excludeTimetableId) query._id = { $ne: excludeTimetableId };

  const timetables = await TimeTable.find(query).lean();

  for (const tt of timetables) {
    // Build the day schedule for that exact date so conflict check respects overrides
    const daySched = buildDaySchedule(tt, date);
    if (daySched.isHoliday) continue;

    for (const p of daySched.periods || []) {
      if (p.isCancelled) continue;
      const currentFaculty = p.replacementFacultyId || p.facultyId;
      if (currentFaculty === String(facultyId)) {
        const pStart = toInt(p.time?.startMin, 0);
        const pEnd = toInt(p.time?.endMin, 0);
        if (startMin < pEnd && endMin > pStart) {
          return {
            conflict: true,
            message: `Faculty is already booked in batch ${tt.batchCode} from ${p.time?.startLabel || pStart} to ${p.time?.endLabel || pEnd} mins.`
          };
        }
      }
    }
  }

  return { conflict: false };
};

const createTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const payload = req.body || {};
    const batchCode = safeTrim(payload.batchCode);
    const inputWeekStart = toInt(payload.wkStartOn, 0);

    if (!batchCode || !inputWeekStart) {
      return res.status(400).json({ status: false, message: 'batchCode and wkStartOn are required' });
    }

    const correctedMonday = getPreviousMonday(inputWeekStart);

    const weekIn = Array.isArray(payload.week) ? payload.week : [];
    const week = [];

    const existingDoc = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false }).lean();
    const excludeTimetableId = existingDoc ? existingDoc._id : null;

    for (const d of weekIn) {
      const day = normDay(d?.day);
      if (!isValidDay(day)) return res.status(400).json({ status: false, message: `Invalid day ${d?.day}` });

      const exactDate = getOffsetDate(correctedMonday, day);
      const periodsIn = Array.isArray(d?.periods) ? d.periods : [];
      const periods = [];

      for (const p of periodsIn) {
        const np = normalizePeriod({ ...p, day });
        if (!np.ok) return res.status(400).json({ status: false, message: np.msg });

        const check = await checkStaffConflicts(tenantId, np.period.facultyId, exactDate, day, np.period.time.startMin, np.period.time.endMin, excludeTimetableId);
        if (check.conflict) {
          return res.status(400).json({
            status: false,
            message: `Conflict on ${day} Period ${np.period.periodNo}: ${check.message}`
          });
        }

        periods.push(np.period);
      }

      week.push({ day, periods });
    }

    // const doc = await TimeTable.findOneAndUpdate(
    //   { tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false },
    //   {
    //     $set: {
    //       tenantId,
    //       batchCode,
    //       wkStartOn: correctedMonday,
    //       centerCode: safeTrim(payload.centerCode) || null,
    //       phase: safeTrim(payload.phase) || null,
    //       status: safeTrim(payload.status) || 'Active',
    //       week,
    //       updatedBy: payload.userId || null
    //     },
    //     $setOnInsert: { createdBy: payload.userId || null, isdeleted: false }
    //   },
    //   { new: true, upsert: true }
    // );

    let doc = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false });

    if (!doc) {
      doc = await TimeTable.create({
        tenantId,
        batchCode,
        wkStartOn: correctedMonday,
        centerCode: safeTrim(payload.centerCode) || null,
        phase: safeTrim(payload.phase) || null,
        status: safeTrim(payload.status) || 'Active',
        week,
        createdBy: payload.userId || null,
        updatedBy: payload.userId || null,
        isdeleted: false
      });
    } else {
      console.log('doc already there');
      const incomingDays = new Set(week.map((d) => d.day));
      const mergedWeek = [...doc.week.filter((d) => !incomingDays.has(d.day)), ...week];
      const dayOrder = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
      mergedWeek.sort((a, b) => (dayOrder[a.day] ?? 7) - (dayOrder[b.day] ?? 7));
      doc.week = mergedWeek;
      doc.centerCode = safeTrim(payload.centerCode) || doc.centerCode || null;
      doc.phase = safeTrim(payload.phase) || doc.phase || null;
      doc.status = safeTrim(payload.status) || doc.status || 'Active';
      doc.updatedBy = payload.userId || null;
      await doc.save();
    }

    if (correctedMonday !== inputWeekStart) {
      let d = new Date(correctedMonday);
      const end = new Date(inputWeekStart);
      while (d < end) {
        const holidayDate = d.getTime();
        const dayName = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];

        upsertDayOverride(doc, {
          date: holidayDate,
          day: dayName,
          action: 'CANCEL_DAY',
          periods: null,
          reason: 'Auto Holiday (Invalid Week Start)',
          updatedBy: payload.userId || null
        });

        d.setDate(d.getDate() + 1);
      }

      doc.markModified('dayOverrides');
      await doc.save();
    }

    return res.status(200).json({ status: true, message: 'Timetable saved', data: doc });
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
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !timetableId || !date) return res.status(400).json({ status: false, message: 'tenantId, timetableId and date required' });
    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
    const d = new Date(date);
    // const day = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
    const day = DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
    upsertDayOverride(tt, { date, day, action: 'CANCEL_DAY', periods: null, reason, updatedBy: userId || null });
    tt.markModified('dayOverrides');
    await tt.save();
    return res.json({ status: true, message: 'Whole day cancelled' });
  } catch (err) {
    return next(err);
  }
};

const editWholeDay = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const periodsIn = Array.isArray(req.body?.periods) ? req.body.periods : [];
    const day = normDay(req.body?.day);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !date || !day) return res.status(400).json({ status: false, message: 'tenantId, timetableId, date and day are required' });
    if (!isValidDay(day)) return res.status(400).json({ status: false, message: `Invalid day: ${day}` });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const normalizedPeriods = [];
    for (const p of periodsIn) {
      const np = normalizePeriod({ ...p, day });
      if (!np.ok) return res.status(400).json({ status: false, message: np.msg });

      const activeFacultyId = np.period.replacementFacultyId || np.period.facultyId;
      const conflictStatus = await checkStaffConflicts(tenantId, activeFacultyId, date, day, np.period.time.startMin, np.period.time.endMin, timetableId);
      if (conflictStatus.conflict) return res.status(400).json({ status: false, message: conflictStatus.message });

      normalizedPeriods.push(np.period);
    }

    upsertDayOverride(tt, {
      date,
      day,
      action: 'REPLACE_DAY',
      periods: normalizedPeriods,
      reason: 'Whole day edited',
      updatedBy: userId || null
    });

    tt.markModified('dayOverrides');
    await tt.save();

    return res.json({ status: true, message: 'Whole day updated successfully' });
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
      if (!batchCode || !wkStartOn) return res.status(400).json({ status: false, message: 'Provide timetableId OR (batchCode + wkStartOn)' });
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

    if (!tenantId || !batchCode) return res.status(400).json({ status: false, message: 'tenantId and batchCode required' });

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
    if (!tenantId || !timetableId || !date || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    // const base = findTemplatePeriod(tt, day, periodNo);
    // if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });

    const base = findTemplatePeriod(tt, day, periodNo) ?? (tt.periodOverrides || []).find((o) => normDay(o?.day) === day && toInt(o?.periodNo, 0) === periodNo && o.action === 'ADD_PERIOD')?.period;
    if (!base) return res.status(400).json({ status: false, message: 'Period not found in template or overrides' });

    upsertPeriodOverride(tt, {
      date,
      day,
      periodNo,
      action: 'CANCEL_PERIOD',
      period: null,
      toPeriodNo: null,
      reason,
      updatedBy: userId || null
    });

    tt.updatedBy = userId;
    tt.markModified('periodOverrides');
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
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !date || !periodNo || !newFacultyId || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    // const base = findTemplatePeriod(tt, day, periodNo);
    // if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });

    const base = findTemplatePeriod(tt, day, periodNo) ?? (tt.periodOverrides || []).find((o) => normDay(o?.day) === day && toInt(o?.periodNo, 0) === periodNo && o.action === 'ADD_PERIOD')?.period;
    if (!base) return res.status(400).json({ status: false, message: 'Period not found in template or overrides' });

    // conflict check
    const baseObj = base.toObject?.() ?? base;
    const startMin = toInt(baseObj?.time?.startMin, -1);
    const endMin = toInt(baseObj?.time?.endMin, -1);
    const check = await checkStaffConflicts(tenantId, newFacultyId, date, day, startMin, endMin, timetableId);
    if (check.conflict) return res.status(400).json({ status: false, message: check.message });

    upsertPeriodOverride(tt, {
      date,
      day,
      periodNo,
      action: 'REPLACE_PERIOD',
      period: {
        ...baseObj,
        periodNo,
        facultyId: newFacultyId,
        facultyName: newFacultyName || null,
        replacementFacultyId: newFacultyId,
        isCancelled: false
      },
      reason: 'Faculty rearranged',
      updatedBy: userId || null
    });

    tt.markModified('periodOverrides');
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
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !date || !fromPeriodNo || !toPeriodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const fromBase = findTemplatePeriod(tt, day, fromPeriodNo);
    if (!fromBase) return res.status(400).json({ status: false, message: 'Source period not found' });

    const toBase = findTemplatePeriod(tt, day, toPeriodNo); // may be null

    // Move: store mapping; rendering will apply
    const fromBaseObj = fromBase.toObject?.() ?? fromBase;
    const toBaseObj = toBase ? (toBase.toObject?.() ?? toBase) : null;

    // Check fromBase faculty at toBase's time slot (if toBase exists)
    if (toBaseObj) {
      const fromFaculty = fromBaseObj.replacementFacultyId || fromBaseObj.facultyId;
      const toTime = toBaseObj.time || {};
      const checkFrom = await checkStaffConflicts(tenantId, fromFaculty, date, day, toInt(toTime.startMin, -1), toInt(toTime.endMin, -1), timetableId);
      if (checkFrom.conflict) return res.status(400).json({ status: false, message: `Swap conflict for source faculty: ${checkFrom.message}` });

      const toFaculty = toBaseObj.replacementFacultyId || toBaseObj.facultyId;
      const fromTime = fromBaseObj.time || {};
      const checkTo = await checkStaffConflicts(tenantId, toFaculty, date, day, toInt(fromTime.startMin, -1), toInt(fromTime.endMin, -1), timetableId);
      if (checkTo.conflict) return res.status(400).json({ status: false, message: `Swap conflict for target faculty: ${checkTo.message}` });
    }

    // Move: store mapping; rendering will apply
    upsertPeriodOverride(tt, {
      date,
      day,
      periodNo: fromPeriodNo,
      action: 'MOVE_PERIOD',
      period: null,
      toPeriodNo,
      reason: 'Period moved',
      updatedBy: userId || null
    });
    if (toBase) {
      upsertPeriodOverride(tt, {
        date,
        day,
        periodNo: toPeriodNo,
        action: 'MOVE_PERIOD',
        period: null,
        toPeriodNo: fromPeriodNo,
        reason: 'Period swapped',
        updatedBy: userId || null
      });
    } else {
    }

    tt.markModified('periodOverrides');
    await tt.save();

    return res.json({ status: true, message: 'Period swapped' });
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
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !date || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, periodNo);
    if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });

    const np = normalizePeriod({ ...(base.toObject?.() ?? base), ...periodIn, periodNo, day });
    if (!np.ok) return res.status(400).json({ status: false, message: np.msg });

    // conflict check on active faculty
    const activeFacultyId = np.period.replacementFacultyId || np.period.facultyId;
    const check = await checkStaffConflicts(tenantId, activeFacultyId, date, day, np.period.time.startMin, np.period.time.endMin, timetableId);
    if (check.conflict) return res.status(400).json({ status: false, message: check.message });

    upsertPeriodOverride(tt, {
      date,
      day,
      periodNo,
      action: 'REPLACE_PERIOD',
      period: np.period,
      toPeriodNo: null,
      reason: 'Period replaced',
      updatedBy: userId || null
    });

    tt.markModified('periodOverrides');
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
    if (!data.length) return res.status(400).json({ status: false, message: 'No data provided' });

    const ops = [];
    const bulkErrors = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const batchCode = safeTrim(item.batchCode);
      const inputWeekStart = toInt(item.wkStartOn, 0);
      if (!batchCode || !inputWeekStart) continue;

      const correctedMonday = getPreviousMonday(inputWeekStart);

      const weekIn = Array.isArray(item.week) ? item.week : [];
      const week = [];
      let rowHasConflict = false;

      const existingDoc = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false }).lean();
      const excludeTimetableId = existingDoc ? existingDoc._id : null;

      for (const d of weekIn) {
        const day = normDay(d?.day);
        if (!isValidDay(day)) continue;

        const exactDate = getOffsetDate(correctedMonday, day);
        const periodsIn = Array.isArray(d?.periods) ? d.periods : [];
        const periods = [];

        for (const p of periodsIn) {
          const np = normalizePeriod({ ...p, day });
          if (np.ok) {
            const check = await checkStaffConflicts(tenantId, np.period.facultyId, exactDate, day, np.period.time.startMin, np.period.time.endMin, excludeTimetableId);

            if (check.conflict) {
              bulkErrors.push({
                batchCode,
                row: i + 1,
                message: `Conflict on ${day} Period ${np.period.periodNo}: ${check.message}`
              });
              rowHasConflict = true;
            } else {
              periods.push(np.period);
            }
          }
        }

        week.push({ day, periods });
      }

      // if (!rowHasConflict) {
      //   ops.push({
      //     updateOne: {
      //       filter: { tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false },
      //       update: {
      //         $set: {
      //           centerCode: safeTrim(item.centerCode) || null,
      //           phase: safeTrim(item.phase) || null,
      //           status: safeTrim(item.status) || 'Active',
      //           week,
      //           updatedBy: userId || null
      //         },
      //         $setOnInsert: { createdBy: userId || null }
      //       },
      //       upsert: true
      //     }
      //   });
      // }

      if (!rowHasConflict) {
        const existingForMerge = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false }).lean();
        let mergedWeek = week;
        if (existingForMerge?.week?.length) {
          const incomingDays = new Set(week.map((d) => d.day));
          const dayOrder = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
          mergedWeek = [...existingForMerge.week.filter((d) => !incomingDays.has(d.day)), ...week].sort((a, b) => (dayOrder[a.day] ?? 7) - (dayOrder[b.day] ?? 7));
        }
        ops.push({
          updateOne: {
            filter: { tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false },
            update: {
              $set: {
                centerCode: safeTrim(item.centerCode) || null,
                phase: safeTrim(item.phase) || null,
                status: safeTrim(item.status) || 'Active',
                week: mergedWeek,
                updatedBy: userId || null
              },
              $setOnInsert: { createdBy: userId || null }
            },
            upsert: true
          }
        });
      }
    }
    if (bulkErrors.length > 0) {
      return res.status(400).json({ status: false, message: 'Bulk upload aborted due to scheduling conflicts', conflicts: bulkErrors });
    }
    if (!ops.length) return res.status(400).json({ status: false, message: 'No valid timetable data found to process' });
    const result = await TimeTable.bulkWrite(ops, { ordered: false });
    return res.status(200).json({
      status: true,
      message: 'Bulk upload completed',
      data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, upsertedCount: result.upsertedCount }
    });
  } catch (err) {
    return next(err);
  }
};

const viewBatchScheduleByDate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, fromDate);

    if (!tenantId || !batchCode || !fromDate) {
      return res.status(400).json({ status: false, message: 'tenantId, batchCode, and fromDate are required' });
    }
    if (toDate < fromDate) return res.status(400).json({ status: false, message: 'toDate cannot be before fromDate' });

    const msPerDay = 24 * 60 * 60 * 1000;
    if (toDate - fromDate > 31 * msPerDay) return res.status(400).json({ status: false, message: 'Date range cannot exceed 31 days' });

    const weekStarts = new Set();
    let curr = fromDate;
    while (curr <= toDate) {
      weekStarts.add(getPreviousMonday(curr));
      curr += msPerDay;
    }

    const timetables = await TimeTable.find({
      tenantId,
      batchCode,
      wkStartOn: { $in: Array.from(weekStarts) },
      isdeleted: false
    }).lean();

    const ttMap = {};
    for (const tt of timetables) ttMap[tt.wkStartOn] = tt;

    const schedule = [];
    curr = fromDate;
    while (curr <= toDate) {
      const wkStart = getPreviousMonday(curr);
      const tt = ttMap[wkStart];

      if (!tt) {
        const d = new Date(curr);
        const dayName = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
        schedule.push({ date: curr, day: dayName, isHoliday: false, holidayReason: null, periods: [] });
        curr += msPerDay;
        continue;
      }

      schedule.push(buildDaySchedule(tt, curr));
      curr += msPerDay;
    }

    return res.status(200).json({ status: true, data: schedule });
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

    const upperType = String(type).toUpperCase();
    if (!['STAFF', 'STUDENT'].includes(upperType)) return res.status(400).json({ status: false, message: 'Invalid type. Must be STAFF or STUDENT' });

    const doc = await LateEntryLog.findOneAndUpdate(
      { tenantId, type: upperType, personId, date: toInt(date, 0), periodNo: toInt(periodNo, 0), isdeleted: false },
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

    if (upperType === 'STUDENT') {
      await Attendance.updateOne({ tenantId, batchCode, date: toInt(date, 0), periodNo: toInt(periodNo, 0), isdeleted: false, 'students.studentId': personId }, { $set: { 'students.$.status': 'LATE' } });
    }

    return res.status(200).json({ status: true, message: `${type} late entry logged and synced successfully`, data: doc });
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

const updateZoomLink = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const zoomUrl = safeTrim(req.body?.zoomUrl);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !date || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    // take existing override period if any, else template base
    const existing = (tt.periodOverrides || []).find((o) => toInt(o?.date, 0) === date && normDay(o?.day) === day && toInt(o?.periodNo, 0) === periodNo && (o.action === 'REPLACE_PERIOD' || o.action === 'ADD_PERIOD'));

    let baseObj;
    if (existing?.period) baseObj = existing.period.toObject?.() ?? existing.period;
    else {
      const base = findTemplatePeriod(tt, day, periodNo);
      if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });
      baseObj = base.toObject?.() ?? base;
    }

    const periodToSave = { ...baseObj, zoomUrl, mode: zoomUrl ? 'ONLINE' : baseObj.mode, periodNo };

    upsertPeriodOverride(tt, { date, day, periodNo, action: 'REPLACE_PERIOD', period: periodToSave, reason: 'Zoom link updated', updatedBy: userId || null });

    tt.updatedBy = userId || null;
    tt.markModified('periodOverrides');
    await tt.save();

    return res.json({ status: true, message: 'Zoom link updated successfully' });
  } catch (err) {
    return next(err);
  }
};

const convertToExam = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !date || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const existing = (tt.periodOverrides || []).find((o) => toInt(o?.date, 0) === date && normDay(o?.day) === day && toInt(o?.periodNo, 0) === periodNo && (o.action === 'REPLACE_PERIOD' || o.action === 'ADD_PERIOD'));

    let periodToSave;
    if (existing?.period) periodToSave = { ...(existing.period.toObject?.() ?? existing.period) };
    else {
      const base = findTemplatePeriod(tt, day, periodNo);
      if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });
      periodToSave = { ...(base.toObject?.() ?? base) };
    }

    periodToSave.periodNo = periodNo;
    periodToSave.periodType = 'EXAM';
    periodToSave.examId = safeTrim(req.body?.examId) || null;
    periodToSave.examDescription = safeTrim(req.body?.examDescription) || null;

    if (req.body?.facultyId) {
      periodToSave.facultyId = safeTrim(req.body.facultyId);
      periodToSave.facultyName = safeTrim(req.body.facultyName) || null;
    }
    if (req.body?.venue) periodToSave.venue = safeTrim(req.body.venue);
    if (req.body?.topic) periodToSave.topic = safeTrim(req.body.topic);

    // conflict check
    const activeFacultyId = periodToSave.replacementFacultyId || periodToSave.facultyId;
    const startMin = toInt(periodToSave?.time?.startMin, -1);
    const endMin = toInt(periodToSave?.time?.endMin, -1);
    if (activeFacultyId && startMin >= 0 && endMin >= 0) {
      const check = await checkStaffConflicts(tenantId, activeFacultyId, date, day, startMin, endMin, timetableId);
      if (check.conflict) return res.status(400).json({ status: false, message: check.message });
    }

    upsertPeriodOverride(tt, { date, day, periodNo, action: 'REPLACE_PERIOD', period: periodToSave, reason: 'Converted to Exam', updatedBy: userId || null });

    tt.updatedBy = userId || null;
    tt.markModified('periodOverrides');
    await tt.save();

    return res.json({ status: true, message: 'Period successfully converted to an Exam' });
  } catch (err) {
    return next(err);
  }
};

const bulkUpdateZoomLinks = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];

    if (!tenantId || !updates.length) return res.status(400).json({ status: false, message: 'tenantId and updates array required' });

    const fetchParams = updates.map((u) => ({ batchCode: safeTrim(u.batchCode), wkStartOn: getPreviousMonday(toInt(u.date, 0)) })).filter((u) => u.batchCode && u.wkStartOn);

    const uniqueFetchKeys = [...new Set(fetchParams.map((p) => `${p.batchCode}_${p.wkStartOn}`))];

    const ops = [];

    for (const key of uniqueFetchKeys) {
      const [batchCode, wkStartStr] = key.split('_');
      const wkStartOn = parseInt(wkStartStr, 10);

      const tt = await TimeTable.findOne({ tenantId, batchCode, wkStartOn, isdeleted: false });
      if (!tt) continue;

      const ttUpdates = updates.filter((u) => safeTrim(u.batchCode) === batchCode && getPreviousMonday(toInt(u.date, 0)) === wkStartOn);
      let modified = false;

      for (const u of ttUpdates) {
        const date = toInt(u.date, 0);
        const periodNo = toInt(u.periodNo, 0);
        const zoomUrl = safeTrim(u.zoomUrl);
        if (!date || !periodNo) continue;
        const d = new Date(date);
        // const day = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
        const day = DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
        const existing = (tt.periodOverrides || []).find((o) => toInt(o?.date, 0) === date && normDay(o?.day) === day && toInt(o?.periodNo, 0) === periodNo && (o.action === 'REPLACE_PERIOD' || o.action === 'ADD_PERIOD'));
        let baseObj;
        if (existing?.period) baseObj = existing.period.toObject?.() ?? existing.period;
        else {
          const base = findTemplatePeriod(tt, day, periodNo);
          if (!base) continue;
          baseObj = base.toObject?.() ?? base;
        }

        const periodToSave = { ...baseObj, periodNo, zoomUrl, mode: zoomUrl ? 'ONLINE' : baseObj.mode };

        upsertPeriodOverride(tt, { date, day, periodNo, action: 'REPLACE_PERIOD', period: periodToSave, reason: 'Bulk Zoom link upload', updatedBy: userId || null });
        modified = true;
      }

      if (modified) {
        ops.push({
          updateOne: {
            filter: { _id: tt._id },
            update: { $set: { periodOverrides: tt.periodOverrides, updatedBy: userId || null } }
          }
        });
      }
    }

    if (!ops.length) return res.status(400).json({ status: false, message: 'No valid records found to update' });

    const result = await TimeTable.bulkWrite(ops, { ordered: false });
    return res.json({ status: true, message: 'Bulk zoom links updated successfully', data: { modifiedCount: result.modifiedCount } });
  } catch (err) {
    return next(err);
  }
};

const validateSchedule = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const data = Array.isArray(req.body?.data) ? req.body.data : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!data.length) return res.status(400).json({ status: false, message: 'No schedule data provided for validation' });

    const conflicts = [];
    const proposedAssignments = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const batchCode = safeTrim(item.batchCode) || `Row ${i + 1}`;
      const inputWeekStart = toInt(item.wkStartOn, 0);
      const weekIn = Array.isArray(item.week) ? item.week : [];
      const timetableId = safeTrim(item.timetableId) || null;

      if (!inputWeekStart) {
        conflicts.push({ batchCode, message: 'wkStartOn is required' });
        continue;
      }

      const correctedMonday = getPreviousMonday(inputWeekStart);

      for (const d of weekIn) {
        const day = normDay(d?.day);
        if (!isValidDay(day)) continue;

        const exactDate = getOffsetDate(correctedMonday, day);
        const periodsIn = Array.isArray(d?.periods) ? d.periods : [];

        for (const p of periodsIn) {
          const facultyId = safeTrim(p?.facultyId);
          const facultyName = safeTrim(p?.facultyName);
          const startMin = toInt(p?.time?.startMin, -1);
          const endMin = toInt(p?.time?.endMin, -1);
          if (!facultyId || startMin < 0 || endMin < 0) continue;

          const dbCheck = await checkStaffConflicts(tenantId, facultyId, exactDate, day, startMin, endMin, timetableId);
          if (dbCheck.conflict) {
            conflicts.push({ batchCode, day, periodNo: p.periodNo, facultyId, facultyName, message: dbCheck.message });
          } else {
            const internalConflict = proposedAssignments.find((pa) => pa.facultyId === facultyId && pa.exactDate === exactDate && startMin < pa.endMin && endMin > pa.startMin);
            if (internalConflict) {
              conflicts.push({
                batchCode,
                day,
                periodNo: p.periodNo,
                facultyId,
                message: `Internal upload conflict: Faculty is already assigned to batch ${internalConflict.batchCode} in this upload file between ${p?.time?.startLabel || startMin} and ${p?.time?.endLabel || endMin} mins.`
              });
            } else {
              proposedAssignments.push({ facultyId, exactDate, startMin, endMin, batchCode });
            }
          }
        }
      }
    }

    if (conflicts.length > 0) return res.status(400).json({ status: false, message: 'Schedule conflicts detected', conflicts });
    return res.status(200).json({ status: true, message: 'All schedules are valid with no conflicts' });
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
  listStaffLateEntries,
  viewBatchScheduleByDate,
  updateZoomLink,
  convertToExam,
  bulkUpdateZoomLinks,
  validateSchedule
};

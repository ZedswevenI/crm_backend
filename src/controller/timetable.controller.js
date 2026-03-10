import mongoose from 'mongoose';
import TimeTable from '../models/timetable.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import Attendance from '../models/attandence.model.js';
import Staff from '../models/staff.model.js';
import Phase from '../models/phaseplan.model.js';
import Batch from '../models/batch.model.js';

// ─── Utilities ────────────────────────────────────────────────────────────────
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
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};

const getOffsetDate = (wkStartOn, dayName) => {
  const offsets = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
  const d = new Date(wkStartOn);
  d.setUTCDate(d.getUTCDate() + (offsets[dayName] ?? 0));
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};

const validateTimeRange = (t) => {
  const startMin = toInt(t?.startMin, -1);
  const endMin = toInt(t?.endMin, -1);
  if (startMin < 0 || startMin > 1439) return { ok: false, msg: 'Invalid time.startMin' };
  if (endMin < 0 || endMin > 1439) return { ok: false, msg: 'Invalid time.endMin' };
  if (endMin <= startMin) return { ok: false, msg: 'time.endMin must be > time.startMin' };
  return { ok: true, startMin, endMin };
};

// ─── Phase validation helper ──────────────────────────────────────────────────
// Fetches the programId from the batch, then checks the phase exists for that program.
const resolvePhaseForPeriod = async (tenantId, batchCode, phaseId, phaseName) => {
  if (!phaseId && !phaseName) return { ok: true, phaseId: null, phaseName: null };

  // Get programId from batch
  const batch = await Batch.findOne({ tenantId, batchCode, isdeleted: false }).lean();
  if (!batch) return { ok: false, msg: `Batch ${batchCode} not found` };
  const programId = safeTrim(batch.programId || batch.program || batch.programCode);
  if (!programId) return { ok: false, msg: `Batch ${batchCode} has no programId` };

  // Find phase
  const query = { tenantId, programId, isdeleted: false };
  if (phaseId) query.phaseId = phaseId;
  else if (phaseName) query.phaseName = new RegExp(`^${escapeRegex(phaseName)}$`, 'i');

  const phase = await Phase.findOne(query).lean();
  if (!phase) {
    return { ok: false, msg: `Phase "${phaseId || phaseName}" not found for program ${programId}` };
  }
  return { ok: true, phaseId: phase.phaseId, phaseName: phase.phaseName };
};

// ─── Period normalizer ────────────────────────────────────────────────────────
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
  if (!['LECTURE', 'EXAM', 'LAB', 'TUTORIAL', 'TEST', 'REVISION'].includes(periodType)) return { ok: false, msg: `periodType must be LECTURE|EXAM|LAB|TUTORIAL|TEST|REVISION` };

  const mode = safeTrim(p?.mode) || 'OFFLINE';
  if (!['OFFLINE', 'ONLINE'].includes(mode)) return { ok: false, msg: 'mode must be OFFLINE or ONLINE' };

  return {
    ok: true,
    period: {
      periodNo,
      time: { startMin: vr.startMin, endMin: vr.endMin, startLabel: safeTrim(time?.startLabel) || null, endLabel: safeTrim(time?.endLabel) || null },
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
      phaseId: safeTrim(p?.phaseId) || null,
      phaseName: safeTrim(p?.phaseName) || null,
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

// ─── Override helpers ─────────────────────────────────────────────────────────
const findTemplatePeriod = (tt, day, periodNo) => {
  const d = (tt?.week || []).find((x) => String(x?.day) === day);
  return (d?.periods || []).find((x) => toInt(x?.periodNo) === toInt(periodNo)) || null;
};

const upsertDayOverride = (tt, ov) => {
  const date = toInt(ov?.date, 0);
  const day = normDay(ov?.day);
  const action = safeTrim(ov?.action);
  const idx = (tt.dayOverrides || []).findIndex((x) => toInt(x?.date) === date && normDay(x?.day) === day && safeTrim(x?.action) === action);
  if (idx >= 0) tt.dayOverrides[idx] = { ...(tt.dayOverrides[idx].toObject?.() ?? tt.dayOverrides[idx]), ...ov };
  else tt.dayOverrides.push(ov);
};

const upsertPeriodOverride = (tt, ov) => {
  const date = toInt(ov?.date, 0);
  const day = normDay(ov?.day);
  const periodNo = toInt(ov?.periodNo, 0);
  const action = safeTrim(ov?.action);
  const idx = (tt.periodOverrides || []).findIndex((x) => toInt(x?.date) === date && normDay(x?.day) === day && toInt(x?.periodNo) === periodNo && safeTrim(x?.action) === action);
  if (idx >= 0) tt.periodOverrides[idx] = { ...(tt.periodOverrides[idx].toObject?.() ?? tt.periodOverrides[idx]), ...ov };
  else tt.periodOverrides.push(ov);
};

// ─── Build actual rendered schedule for a date (used by conflict checker + viewbybatch) ──
const buildDaySchedule = (tt, dateEpochMs) => {
  const d = new Date(dateEpochMs);
  const dayName = DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
  const baseDay = (tt.week || []).find((w) => w.day === dayName);
  let periods = baseDay ? JSON.parse(JSON.stringify(baseDay.periods || [])) : [];

  // Day-level override takes priority
  const dayOv = (tt.dayOverrides || []).find((o) => toInt(o?.date) === toInt(dateEpochMs) && normDay(o?.day) === dayName);
  if (dayOv) {
    if (dayOv.action === 'CANCEL_DAY') return { date: dateEpochMs, day: dayName, isHoliday: true, holidayReason: dayOv.reason || 'Holiday', periods: [] };
    if (dayOv.action === 'REPLACE_DAY') periods = Array.isArray(dayOv.periods) ? JSON.parse(JSON.stringify(dayOv.periods)) : [];
  }

  // Period-level overrides on top
  const povs = (tt.periodOverrides || []).filter((o) => toInt(o?.date) === toInt(dateEpochMs) && normDay(o?.day) === dayName);

  for (const ov of povs) {
    const pno = toInt(ov?.periodNo, 0);
    if (!pno) continue;
    if (ov.action === 'CANCEL_PERIOD') {
      const idx = periods.findIndex((p) => toInt(p?.periodNo) === pno);
      if (idx !== -1) periods[idx] = { ...periods[idx], isCancelled: true, cancelReason: ov.reason || null };
    } else if (ov.action === 'REPLACE_PERIOD') {
      const repl = ov.period ? JSON.parse(JSON.stringify(ov.period)) : null;
      if (!repl) continue;
      const idx = periods.findIndex((p) => toInt(p?.periodNo) === pno);
      if (idx !== -1) periods[idx] = { ...periods[idx], ...repl, periodNo: pno };
      else periods.push({ ...repl, periodNo: pno });
    } else if (ov.action === 'ADD_PERIOD') {
      const add = ov.period ? JSON.parse(JSON.stringify(ov.period)) : null;
      if (!add) continue;
      if (!periods.some((p) => toInt(p?.periodNo) === pno)) periods.push({ ...add, periodNo: pno });
    }
  }

  // MOVE_PERIOD: atomic swap — collect all moves first, then apply
  const moves = povs.filter((x) => x.action === 'MOVE_PERIOD');
  if (moves.length) {
    const snapshot = periods.map((p) => ({ ...p }));
    for (const ov of moves) {
      const fromNo = toInt(ov?.periodNo, 0);
      const toNo = toInt(ov?.toPeriodNo, 0);
      if (!fromNo || !toNo) continue;
      const src = snapshot.find((p) => toInt(p?.periodNo) === fromNo);
      if (!src) continue;
      const destIdx = periods.findIndex((p) => toInt(p?.periodNo) === toNo);
      if (destIdx !== -1) periods[destIdx] = { ...src, periodNo: toNo };
      else periods.push({ ...src, periodNo: toNo });
      // remove from-slot if nothing swapped into it
      const movedIntoFrom = moves.some((m) => toInt(m?.toPeriodNo) === fromNo);
      if (!movedIntoFrom) {
        const fromIdx = periods.findIndex((p) => toInt(p?.periodNo) === fromNo);
        if (fromIdx !== -1) periods.splice(fromIdx, 1);
      }
    }
  }

  periods.sort((a, b) => toInt(a?.periodNo) - toInt(b?.periodNo));
  return { date: dateEpochMs, day: dayName, isHoliday: false, holidayReason: null, periods };
};

// ─── Staff conflict checker ───────────────────────────────────────────────────
const checkStaffConflicts = async (tenantId, facultyId, date, day, startMin, endMin, excludeTimetableId = null) => {
  const staff = await Staff.findOne({ staffId: facultyId, tenantId, isdeleted: false }).lean();
  if (staff?.weekoff?.includes(day)) return { conflict: true, message: `Faculty ${staff.name || facultyId} has a week-off on ${day}.` };

  const wkStartOn = getPreviousMonday(date);
  const query = { tenantId, wkStartOn, isdeleted: false };
  if (excludeTimetableId) query._id = { $ne: excludeTimetableId };

  const timetables = await TimeTable.find(query).lean();
  for (const tt of timetables) {
    const daySched = buildDaySchedule(tt, date);
    if (daySched.isHoliday) continue;
    for (const p of daySched.periods || []) {
      if (p.isCancelled) continue;
      const currentFaculty = p.replacementFacultyId || p.facultyId;
      if (currentFaculty === String(facultyId)) {
        const pStart = toInt(p.time?.startMin);
        const pEnd = toInt(p.time?.endMin);
        if (startMin < pEnd && endMin > pStart) return { conflict: true, message: `Faculty already booked in batch ${tt.batchCode} from ${p.time?.startLabel || pStart} to ${p.time?.endLabel || pEnd}.` };
      }
    }
  }
  return { conflict: false };
};

// ─── Is timetable published? ──────────────────────────────────────────────────
const isPublished = (tt) => tt?.status === 'Active';

// ─── Write a day: DRAFT → mutate week[], Published → REPLACE_DAY override ────
const writeDayToTimetable = (tt, day, normalizedPeriods, userId) => {
  if (!isPublished(tt)) {
    // DRAFT: update week[] directly
    const idx = (tt.week || []).findIndex((d) => d.day === day);
    if (idx >= 0) tt.week[idx].periods = normalizedPeriods;
    else tt.week.push({ day, periods: normalizedPeriods });
    const dayOrder = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
    tt.week.sort((a, b) => (dayOrder[a.day] ?? 7) - (dayOrder[b.day] ?? 7));
    tt.markModified('week');
  }
  // Published: caller must also provide date epoch — handled in editWholeDay
};

// ─── ENDPOINTS ────────────────────────────────────────────────────────────────

// POST /timetable/create
const createTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const payload = req.body || {};
    const batchCode = safeTrim(payload.batchCode);
    const inputWeekStart = toInt(payload.wkStartOn, 0);
    if (!batchCode || !inputWeekStart) return res.status(400).json({ status: false, message: 'batchCode and wkStartOn are required' });

    const correctedMonday = getPreviousMonday(inputWeekStart);
    const weekIn = Array.isArray(payload.week) ? payload.week : [];
    const week = [];

    const existingDoc = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false }).lean();
    // DRAFT timetables: block conflict checks so you can freely draft
    // Published: check conflicts
    const skipConflicts = !isPublished(existingDoc);
    const excludeId = existingDoc?._id || null;

    for (const d of weekIn) {
      const day = normDay(d?.day);
      if (!isValidDay(day)) return res.status(400).json({ status: false, message: `Invalid day: ${d?.day}` });

      const exactDate = getOffsetDate(correctedMonday, day);
      const periodsIn = Array.isArray(d?.periods) ? d.periods : [];
      const periods = [];

      for (const p of periodsIn) {
        const np = normalizePeriod({ ...p, day });
        if (!np.ok) return res.status(400).json({ status: false, message: np.msg });

        // Phase validation
        if (np.period.phaseId || np.period.phaseName) {
          const pv = await resolvePhaseForPeriod(tenantId, batchCode, np.period.phaseId, np.period.phaseName);
          if (!pv.ok) return res.status(400).json({ status: false, message: pv.msg });
          np.period.phaseId = pv.phaseId;
          np.period.phaseName = pv.phaseName;
        }

        if (!skipConflicts) {
          const check = await checkStaffConflicts(tenantId, np.period.facultyId, exactDate, day, np.period.time.startMin, np.period.time.endMin, excludeId);
          if (check.conflict) return res.status(400).json({ status: false, message: `Conflict on ${day} Period ${np.period.periodNo}: ${check.message}` });
        }

        periods.push(np.period);
      }
      week.push({ day, periods });
    }

    let doc = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false });
    if (!doc) {
      doc = await TimeTable.create({
        tenantId,
        batchCode,
        wkStartOn: correctedMonday,
        centerCode: safeTrim(payload.centerCode) || null,
        phase: safeTrim(payload.phase) || null,
        status: 'DRAFT', // always start as DRAFT
        week,
        createdBy: payload.userId || null,
        updatedBy: payload.userId || null,
        isdeleted: false
      });
    } else {
      if (isPublished(doc)) return res.status(400).json({ status: false, message: 'Timetable is published. Use day/edit to modify individual days.' });
      const incomingDays = new Set(week.map((d) => d.day));
      const dayOrder = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
      const mergedWeek = [...doc.week.filter((d) => !incomingDays.has(d.day)), ...week].sort((a, b) => (dayOrder[a.day] ?? 7) - (dayOrder[b.day] ?? 7));
      doc.week = mergedWeek;
      doc.centerCode = safeTrim(payload.centerCode) || doc.centerCode || null;
      doc.phase = safeTrim(payload.phase) || doc.phase || null;
      doc.updatedBy = payload.userId || null;
      await doc.save();
    }

    return res.status(200).json({ status: true, message: 'Timetable saved', data: doc });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/publish
const publishTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !timetableId) return res.status(400).json({ status: false, message: 'tenantId and timetableId required' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
    if (isPublished(tt)) return res.status(400).json({ status: false, message: 'Timetable is already published' });

    // Run conflict checks for all periods now that it's being activated
    for (const dayObj of tt.week || []) {
      const day = dayObj.day;
      const exactDate = getOffsetDate(tt.wkStartOn, day);
      for (const p of dayObj.periods || []) {
        const check = await checkStaffConflicts(tenantId, p.facultyId, exactDate, day, p.time?.startMin, p.time?.endMin, tt._id);
        if (check.conflict) return res.status(400).json({ status: false, message: `Publish blocked — conflict on ${day} Period ${p.periodNo}: ${check.message}` });
      }
    }

    tt.status = 'Active';
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Timetable published successfully', data: { status: tt.status } });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/unpublish
const unpublishTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !timetableId) return res.status(400).json({ status: false, message: 'tenantId and timetableId required' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
    if (tt.status === 'DRAFT') return res.status(400).json({ status: false, message: 'Timetable is already a draft' });

    tt.status = 'DRAFT';
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Timetable reverted to DRAFT', data: { status: tt.status } });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/day/cancel
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
    const day = DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];

    if (!isPublished(tt)) {
      // DRAFT: mark each period in week[] as cancelled for this day
      const dayIdx = (tt.week || []).findIndex((wd) => wd.day === day);
      if (dayIdx >= 0) {
        tt.week[dayIdx].periods = tt.week[dayIdx].periods.map((p) => ({ ...(p.toObject?.() ?? p), isCancelled: true, cancelReason: reason }));
        tt.markModified('week');
      }
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Day cancelled (draft)' });
    }

    // Published: use dayOverride
    upsertDayOverride(tt, { date, day, action: 'CANCEL_DAY', periods: null, reason, updatedBy: userId || null });
    tt.markModified('dayOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Holiday declared' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/day/edit
// DRAFT → updates week[] directly. Published → REPLACE_DAY override.
const editWholeDay = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodsIn = Array.isArray(req.body?.periods) ? req.body.periods : [];
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !day) return res.status(400).json({ status: false, message: 'tenantId, timetableId, and day are required' });
    if (!isValidDay(day)) return res.status(400).json({ status: false, message: `Invalid day: ${day}` });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const batchCode = tt.batchCode;

    // For published timetable, date is required
    if (isPublished(tt) && !date) return res.status(400).json({ status: false, message: 'date is required for published timetable' });

    const exactDate = isPublished(tt) ? date : getOffsetDate(tt.wkStartOn, day);

    const normalizedPeriods = [];
    for (const p of periodsIn) {
      const np = normalizePeriod({ ...p, day });
      if (!np.ok) return res.status(400).json({ status: false, message: np.msg });

      // Phase validation
      if (np.period.phaseId || np.period.phaseName) {
        const pv = await resolvePhaseForPeriod(tenantId, batchCode, np.period.phaseId, np.period.phaseName);
        if (!pv.ok) return res.status(400).json({ status: false, message: pv.msg });
        np.period.phaseId = pv.phaseId;
        np.period.phaseName = pv.phaseName;
      }

      const activeFacultyId = np.period.replacementFacultyId || np.period.facultyId;
      const check = await checkStaffConflicts(tenantId, activeFacultyId, exactDate, day, np.period.time.startMin, np.period.time.endMin, timetableId);
      if (check.conflict) return res.status(400).json({ status: false, message: check.message });

      normalizedPeriods.push(np.period);
    }

    if (!isPublished(tt)) {
      // DRAFT: write straight into week[]
      const dayOrder = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
      const idx = (tt.week || []).findIndex((d) => d.day === day);
      if (idx >= 0) tt.week[idx].periods = normalizedPeriods;
      else {
        tt.week.push({ day, periods: normalizedPeriods });
        tt.week.sort((a, b) => (dayOrder[a.day] ?? 7) - (dayOrder[b.day] ?? 7));
      }
      tt.markModified('week');
    } else {
      // Published: REPLACE_DAY override
      upsertDayOverride(tt, { date, day, action: 'REPLACE_DAY', periods: normalizedPeriods, reason: 'Day edited', updatedBy: userId || null });
      tt.markModified('dayOverrides');
    }

    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Day schedule updated successfully' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/list
const listTimeTables = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const skip = (page - 1) * limit;

    const { list, search, batchCode, centerCode, phase, wkFrom, wkTo, status } = req.query;
    const query = { tenantId, isdeleted: false };
    if (batchCode) query.batchCode = safeTrim(batchCode);
    if (centerCode) query.centerCode = safeTrim(centerCode);
    if (phase) query.phase = safeTrim(phase);
    if (status) query.status = safeTrim(status);
    if (wkFrom) query.wkStartOn = { ...(query.wkStartOn || {}), $gte: toInt(wkFrom) };
    if (wkTo) query.wkStartOn = { ...(query.wkStartOn || {}), $lte: toInt(wkTo) };
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

// POST /timetable/view
const viewTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const timetableId = safeTrim(req.body?.timetableId);
    const batchCode = safeTrim(req.body?.batchCode);
    const wkStartOn = toInt(req.body?.wkStartOn, 0);

    const query = { tenantId, isdeleted: false };
    if (timetableId) query._id = timetableId;
    else {
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

// POST /timetable/delete
const deleteTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !timetableId) return res.status(400).json({ status: false, message: 'tenantId and timetableId required' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
    if (isPublished(tt)) return res.status(400).json({ status: false, message: 'Cannot delete a published timetable. Unpublish it first.' });

    tt.isdeleted = true;
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Timetable deleted' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/listbybatch
const listTimeTablesByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode);
    if (!tenantId || !batchCode) return res.status(400).json({ status: false, message: 'tenantId and batchCode required' });

    const query = { tenantId, batchCode, isdeleted: false };
    const wkFrom = toInt(req.query.wkFrom, 0);
    const wkTo = toInt(req.query.wkTo, 0);
    if (wkFrom) query.wkStartOn = { ...(query.wkStartOn || {}), $gte: wkFrom };
    if (wkTo) query.wkStartOn = { ...(query.wkStartOn || {}), $lte: wkTo };

    const rows = await TimeTable.find(query).sort({ wkStartOn: -1 }).lean();
    return res.json({ status: true, data: rows, count: rows.length });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/period/cancel
const cancelPeriod = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const reason = safeTrim(req.body?.reason) || 'Cancelled';
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !timetableId || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    if (!isPublished(tt)) {
      // DRAFT: cancel in week[] directly
      const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
      if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found in timetable` });
      const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
      if (pIdx < 0) return res.status(400).json({ status: false, message: 'Period not found' });
      tt.week[dayIdx].periods[pIdx].isCancelled = true;
      tt.week[dayIdx].periods[pIdx].cancelReason = reason;
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Period cancelled (draft)' });
    }

    if (!date) return res.status(400).json({ status: false, message: 'date is required for published timetable' });

    const base = findTemplatePeriod(tt, day, periodNo) ?? (tt.periodOverrides || []).find((o) => normDay(o?.day) === day && toInt(o?.periodNo) === periodNo && o.action === 'ADD_PERIOD')?.period;
    if (!base) return res.status(400).json({ status: false, message: 'Period not found in template or overrides' });

    upsertPeriodOverride(tt, { date, day, periodNo, action: 'CANCEL_PERIOD', period: null, toPeriodNo: null, reason, updatedBy: userId || null });
    tt.markModified('periodOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Period cancelled' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/period/rearrange-staff
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

    if (!tenantId || !timetableId || !periodNo || !newFacultyId || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    if (!isPublished(tt)) {
      // DRAFT: update week[] directly
      const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
      if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });
      const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
      if (pIdx < 0) return res.status(400).json({ status: false, message: 'Period not found' });
      tt.week[dayIdx].periods[pIdx].facultyId = newFacultyId;
      tt.week[dayIdx].periods[pIdx].facultyName = newFacultyName || null;
      tt.week[dayIdx].periods[pIdx].replacementFacultyId = newFacultyId;
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Staff updated (draft)' });
    }

    if (!date) return res.status(400).json({ status: false, message: 'date required for published timetable' });

    const base = findTemplatePeriod(tt, day, periodNo) ?? (tt.periodOverrides || []).find((o) => normDay(o?.day) === day && toInt(o?.periodNo) === periodNo && o.action === 'ADD_PERIOD')?.period;
    if (!base) return res.status(400).json({ status: false, message: 'Period not found' });

    const baseObj = base.toObject?.() ?? base;
    const check = await checkStaffConflicts(tenantId, newFacultyId, date, day, toInt(baseObj?.time?.startMin), toInt(baseObj?.time?.endMin), timetableId);
    if (check.conflict) return res.status(400).json({ status: false, message: check.message });

    upsertPeriodOverride(tt, {
      date,
      day,
      periodNo,
      action: 'REPLACE_PERIOD',
      period: { ...baseObj, periodNo, facultyId: newFacultyId, facultyName: newFacultyName || null, replacementFacultyId: newFacultyId, isCancelled: false },
      reason: 'Faculty rearranged',
      updatedBy: userId || null
    });
    tt.markModified('periodOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Faculty updated' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/period/move
const changePeriod = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const fromPeriodNo = toInt(req.body?.fromPeriodNo, 0);
    const toPeriodNo = toInt(req.body?.toPeriodNo, 0);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !fromPeriodNo || !toPeriodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });
    if (fromPeriodNo === toPeriodNo) return res.status(400).json({ status: false, message: 'fromPeriodNo and toPeriodNo must differ' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    if (!isPublished(tt)) {
      // DRAFT: swap period numbers in week[]
      const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
      if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });
      const periods = tt.week[dayIdx].periods;
      const fromIdx = periods.findIndex((p) => toInt(p?.periodNo) === fromPeriodNo);
      const toIdx = periods.findIndex((p) => toInt(p?.periodNo) === toPeriodNo);
      if (fromIdx < 0) return res.status(400).json({ status: false, message: 'Source period not found' });
      // Swap period numbers (content stays, slot numbers swap)
      const temp = periods[fromIdx].periodNo;
      periods[fromIdx].periodNo = periods[toIdx]?.periodNo ?? toPeriodNo;
      if (toIdx >= 0) periods[toIdx].periodNo = temp;
      periods.sort((a, b) => toInt(a?.periodNo) - toInt(b?.periodNo));
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Period moved (draft)' });
    }

    if (!date) return res.status(400).json({ status: false, message: 'date required for published timetable' });

    const fromBase = findTemplatePeriod(tt, day, fromPeriodNo);
    if (!fromBase) return res.status(400).json({ status: false, message: 'Source period not found' });
    const toBase = findTemplatePeriod(tt, day, toPeriodNo);

    const fromBaseObj = fromBase.toObject?.() ?? fromBase;
    const toBaseObj = toBase ? (toBase.toObject?.() ?? toBase) : null;

    if (toBaseObj) {
      const checkFrom = await checkStaffConflicts(tenantId, fromBaseObj.replacementFacultyId || fromBaseObj.facultyId, date, day, toInt(toBaseObj.time?.startMin), toInt(toBaseObj.time?.endMin), timetableId);
      if (checkFrom.conflict) return res.status(400).json({ status: false, message: `Swap conflict (source faculty): ${checkFrom.message}` });
      const checkTo = await checkStaffConflicts(tenantId, toBaseObj.replacementFacultyId || toBaseObj.facultyId, date, day, toInt(fromBaseObj.time?.startMin), toInt(fromBaseObj.time?.endMin), timetableId);
      if (checkTo.conflict) return res.status(400).json({ status: false, message: `Swap conflict (target faculty): ${checkTo.message}` });
    }

    // Store both sides of the swap atomically
    upsertPeriodOverride(tt, { date, day, periodNo: fromPeriodNo, action: 'MOVE_PERIOD', period: null, toPeriodNo, reason: 'Period moved', updatedBy: userId || null });
    if (toBase) upsertPeriodOverride(tt, { date, day, periodNo: toPeriodNo, action: 'MOVE_PERIOD', period: null, toPeriodNo: fromPeriodNo, reason: 'Period swapped', updatedBy: userId || null });

    tt.markModified('periodOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Period swapped' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/period/replace
const replacePeriod = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const periodIn = req.body?.period || {};
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const base = findTemplatePeriod(tt, day, periodNo);
    if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });

    const np = normalizePeriod({ ...(base.toObject?.() ?? base), ...periodIn, periodNo, day });
    if (!np.ok) return res.status(400).json({ status: false, message: np.msg });

    // Phase validation if provided
    if (np.period.phaseId || np.period.phaseName) {
      const pv = await resolvePhaseForPeriod(tenantId, tt.batchCode, np.period.phaseId, np.period.phaseName);
      if (!pv.ok) return res.status(400).json({ status: false, message: pv.msg });
      np.period.phaseId = pv.phaseId;
      np.period.phaseName = pv.phaseName;
    }

    if (!isPublished(tt)) {
      // DRAFT: update week[] directly
      const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
      if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });
      const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
      if (pIdx < 0) return res.status(400).json({ status: false, message: 'Period not found' });
      tt.week[dayIdx].periods[pIdx] = { ...(tt.week[dayIdx].periods[pIdx].toObject?.() ?? tt.week[dayIdx].periods[pIdx]), ...np.period };
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Period updated (draft)' });
    }

    if (!date) return res.status(400).json({ status: false, message: 'date required for published timetable' });

    const activeFacultyId = np.period.replacementFacultyId || np.period.facultyId;
    const check = await checkStaffConflicts(tenantId, activeFacultyId, date, day, np.period.time.startMin, np.period.time.endMin, timetableId);
    if (check.conflict) return res.status(400).json({ status: false, message: check.message });

    upsertPeriodOverride(tt, { date, day, periodNo, action: 'REPLACE_PERIOD', period: np.period, toPeriodNo: null, reason: 'Period replaced', updatedBy: userId || null });
    tt.markModified('periodOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Period replaced' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/update/zoomlink
const updateZoomLink = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const zoomUrl = safeTrim(req.body?.zoomUrl);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    if (!isPublished(tt)) {
      const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
      if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });
      const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
      if (pIdx < 0) return res.status(400).json({ status: false, message: 'Period not found' });
      tt.week[dayIdx].periods[pIdx].zoomUrl = zoomUrl || null;
      tt.week[dayIdx].periods[pIdx].mode = zoomUrl ? 'ONLINE' : tt.week[dayIdx].periods[pIdx].mode;
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Zoom link updated (draft)' });
    }

    if (!date) return res.status(400).json({ status: false, message: 'date required for published timetable' });

    const existing = (tt.periodOverrides || []).find((o) => toInt(o?.date) === date && normDay(o?.day) === day && toInt(o?.periodNo) === periodNo && ['REPLACE_PERIOD', 'ADD_PERIOD'].includes(o.action));
    let baseObj;
    if (existing?.period) baseObj = existing.period.toObject?.() ?? existing.period;
    else {
      const base = findTemplatePeriod(tt, day, periodNo);
      if (!base) return res.status(400).json({ status: false, message: 'Template period not found' });
      baseObj = base.toObject?.() ?? base;
    }

    upsertPeriodOverride(tt, { date, day, periodNo, action: 'REPLACE_PERIOD', period: { ...baseObj, zoomUrl, mode: zoomUrl ? 'ONLINE' : baseObj.mode, periodNo }, reason: 'Zoom link updated', updatedBy: userId || null });
    tt.markModified('periodOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Zoom link updated' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/convertToExam
const convertToExam = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodNo = toInt(req.body?.periodNo, 0);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !timetableId || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });

    const getPeriodBase = () => {
      const existing = (tt.periodOverrides || []).find((o) => toInt(o?.date) === date && normDay(o?.day) === day && toInt(o?.periodNo) === periodNo && ['REPLACE_PERIOD', 'ADD_PERIOD'].includes(o.action));
      if (existing?.period) return { ...(existing.period.toObject?.() ?? existing.period) };
      const base = findTemplatePeriod(tt, day, periodNo);
      return base ? { ...(base.toObject?.() ?? base) } : null;
    };

    if (!isPublished(tt)) {
      const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
      if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });
      const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
      if (pIdx < 0) return res.status(400).json({ status: false, message: 'Period not found' });
      const p = tt.week[dayIdx].periods[pIdx];
      p.periodType = 'EXAM';
      p.examId = safeTrim(req.body?.examId) || p.examId;
      p.examDescription = safeTrim(req.body?.examDescription) || p.examDescription;
      if (req.body?.facultyId) {
        p.facultyId = safeTrim(req.body.facultyId);
        p.facultyName = safeTrim(req.body.facultyName) || p.facultyName;
      }
      if (req.body?.venue) p.venue = safeTrim(req.body.venue);
      if (req.body?.topic) p.topic = safeTrim(req.body.topic);
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Period converted to Exam (draft)' });
    }

    if (!date) return res.status(400).json({ status: false, message: 'date required for published timetable' });

    const periodToSave = getPeriodBase();
    if (!periodToSave) return res.status(400).json({ status: false, message: 'Period not found' });

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

    const activeFacultyId = periodToSave.replacementFacultyId || periodToSave.facultyId;
    const startMin = toInt(periodToSave?.time?.startMin, -1);
    const endMin = toInt(periodToSave?.time?.endMin, -1);
    if (activeFacultyId && startMin >= 0 && endMin >= 0) {
      const check = await checkStaffConflicts(tenantId, activeFacultyId, date, day, startMin, endMin, timetableId);
      if (check.conflict) return res.status(400).json({ status: false, message: check.message });
    }

    upsertPeriodOverride(tt, { date, day, periodNo, action: 'REPLACE_PERIOD', period: periodToSave, reason: 'Converted to Exam', updatedBy: userId || null });
    tt.markModified('periodOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Period converted to Exam' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/bulk
const bulkUploadTimeTables = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const data = Array.isArray(req.body?.data) ? req.body.data : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!data.length) return res.status(400).json({ status: false, message: 'No data provided' });

    const ops = [],
      bulkErrors = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const batchCode = safeTrim(item.batchCode);
      const wkStart = toInt(item.wkStartOn, 0);
      if (!batchCode || !wkStart) continue;

      const correctedMonday = getPreviousMonday(wkStart);
      const weekIn = Array.isArray(item.week) ? item.week : [];
      const week = [];
      let rowHasConflict = false;

      const existingDoc = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false }).lean();
      if (existingDoc && isPublished(existingDoc)) {
        bulkErrors.push({ batchCode, row: i + 1, message: 'Timetable is published; cannot bulk-overwrite it.' });
        rowHasConflict = true;
      }
      const excludeId = existingDoc?._id || null;

      for (const d of weekIn) {
        const day = normDay(d?.day);
        if (!isValidDay(day)) continue;
        const exactDate = getOffsetDate(correctedMonday, day);
        const periods = [];
        for (const p of d?.periods || []) {
          const np = normalizePeriod({ ...p, day });
          if (!np.ok) continue;
          // Phase validation
          if (np.period.phaseId || np.period.phaseName) {
            const pv = await resolvePhaseForPeriod(tenantId, batchCode, np.period.phaseId, np.period.phaseName);
            if (!pv.ok) {
              bulkErrors.push({ batchCode, row: i + 1, message: pv.msg });
              rowHasConflict = true;
              continue;
            }
            np.period.phaseId = pv.phaseId;
            np.period.phaseName = pv.phaseName;
          }
          // Bulk uploads are DRAFT-first — skip conflict check; resolved on publish
          periods.push(np.period);
        }
        week.push({ day, periods });
      }

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
              $set: { centerCode: safeTrim(item.centerCode) || null, phase: safeTrim(item.phase) || null, status: 'DRAFT', week: mergedWeek, updatedBy: userId || null },
              $setOnInsert: { createdBy: userId || null }
            },
            upsert: true
          }
        });
      }
    }

    if (bulkErrors.length) return res.status(400).json({ status: false, message: 'Bulk upload errors', conflicts: bulkErrors });
    if (!ops.length) return res.status(400).json({ status: false, message: 'No valid timetable data found' });

    const result = await TimeTable.bulkWrite(ops, { ordered: false });
    return res.status(200).json({ status: true, message: 'Bulk upload completed', data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, upsertedCount: result.upsertedCount } });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/viewbybatch
const viewBatchScheduleByDate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, fromDate);

    if (!tenantId || !batchCode || !fromDate) return res.status(400).json({ status: false, message: 'tenantId, batchCode, and fromDate are required' });
    if (toDate < fromDate) return res.status(400).json({ status: false, message: 'toDate cannot be before fromDate' });

    const msPerDay = 24 * 60 * 60 * 1000;
    if (toDate - fromDate > 31 * msPerDay) return res.status(400).json({ status: false, message: 'Date range cannot exceed 31 days' });

    const weekStarts = new Set();
    let curr = fromDate;
    while (curr <= toDate) {
      weekStarts.add(getPreviousMonday(curr));
      curr += msPerDay;
    }

    const timetables = await TimeTable.find({ tenantId, batchCode, wkStartOn: { $in: [...weekStarts] }, isdeleted: false }).lean();
    const ttMap = {};
    for (const tt of timetables) ttMap[tt.wkStartOn] = tt;

    const schedule = [];
    curr = fromDate;
    while (curr <= toDate) {
      const wkStart = getPreviousMonday(curr);
      const tt = ttMap[wkStart];
      if (!tt) {
        const d = new Date(curr);
        schedule.push({ date: curr, day: DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1], isHoliday: false, holidayReason: null, periods: [] });
      } else {
        schedule.push(buildDaySchedule(tt, curr));
      }
      curr += msPerDay;
    }
    return res.status(200).json({ status: true, data: schedule });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/validate
const validateSchedule = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const data = Array.isArray(req.body?.data) ? req.body.data : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!data.length) return res.status(400).json({ status: false, message: 'No schedule data provided' });

    const conflicts = [],
      proposed = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const batchCode = safeTrim(item.batchCode) || `Row ${i + 1}`;
      const wkStart = toInt(item.wkStartOn, 0);
      const timetableId = safeTrim(item.timetableId) || null;
      if (!wkStart) {
        conflicts.push({ batchCode, message: 'wkStartOn is required' });
        continue;
      }
      const correctedMonday = getPreviousMonday(wkStart);

      for (const d of item.week || []) {
        const day = normDay(d?.day);
        if (!isValidDay(day)) continue;
        const exactDate = getOffsetDate(correctedMonday, day);
        for (const p of d?.periods || []) {
          const facultyId = safeTrim(p?.facultyId);
          const startMin = toInt(p?.time?.startMin, -1);
          const endMin = toInt(p?.time?.endMin, -1);
          if (!facultyId || startMin < 0 || endMin < 0) continue;

          const dbCheck = await checkStaffConflicts(tenantId, facultyId, exactDate, day, startMin, endMin, timetableId);
          if (dbCheck.conflict) {
            conflicts.push({ batchCode, day, periodNo: p.periodNo, facultyId, message: dbCheck.message });
          } else {
            const internal = proposed.find((pa) => pa.facultyId === facultyId && pa.exactDate === exactDate && startMin < pa.endMin && endMin > pa.startMin);
            if (internal) conflicts.push({ batchCode, day, periodNo: p.periodNo, facultyId, message: `Internal conflict with batch ${internal.batchCode}` });
            else proposed.push({ facultyId, exactDate, startMin, endMin, batchCode });
          }
        }
      }
    }

    if (conflicts.length) return res.status(400).json({ status: false, message: 'Conflicts detected', conflicts });
    return res.status(200).json({ status: true, message: 'All schedules valid' });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/lateentry/log
const logLateEntry = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { type, personId, personName, timetableId, batchCode, date, periodNo, scheduledStartMin, delayMinutes, reason } = req.body;

    if (!tenantId || !type || !personId || !timetableId || !date || !periodNo || scheduledStartMin === undefined || delayMinutes === undefined) return res.status(400).json({ status: false, message: 'Missing required fields for late entry' });

    const upperType = String(type).toUpperCase();
    if (!['STAFF', 'STUDENT'].includes(upperType)) return res.status(400).json({ status: false, message: 'type must be STAFF or STUDENT' });

    const doc = await LateEntryLog.findOneAndUpdate(
      { tenantId, type: upperType, personId, date: toInt(date), periodNo: toInt(periodNo), isdeleted: false },
      {
        $set: { personName: safeTrim(personName), timetableId: safeTrim(timetableId), batchCode: safeTrim(batchCode), scheduledStartMin: toInt(scheduledStartMin), actualEntryTime: Date.now(), delayMinutes: toInt(delayMinutes), reason: safeTrim(reason) || null, updatedBy: userId },
        $setOnInsert: { createdBy: userId }
      },
      { new: true, upsert: true }
    );

    if (upperType === 'STUDENT') await Attendance.updateOne({ tenantId, batchCode, date: toInt(date), periodNo: toInt(periodNo), isdeleted: false, 'students.studentId': personId }, { $set: { 'students.$.status': 'LATE' } });

    return res.status(200).json({ status: true, message: `${type} late entry logged`, data: doc });
  } catch (err) {
    return next(err);
  }
};

const listLateEntries = (type) => async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const page = Math.max(parseInt(req.query.page || req.body.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || req.body.limit || '20', 10), 1), 200);
    const { personId, batchCode, dateFrom, dateTo, search } = req.body;
    const query = { tenantId, type, isdeleted: false };
    if (personId) query.personId = safeTrim(personId);
    if (batchCode) query.batchCode = safeTrim(batchCode);
    if (dateFrom) query.date = { ...(query.date || {}), $gte: toInt(dateFrom) };
    if (dateTo) query.date = { ...(query.date || {}), $lte: toInt(dateTo) };
    if (search) query.personName = new RegExp(escapeRegex(search), 'i');
    const [rows, count] = await Promise.all([
      LateEntryLog.find(query)
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LateEntryLog.countDocuments(query)
    ]);
    return res.json({ status: true, data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

// POST /timetable/bulk/zoomlinks
const bulkUpdateZoomLinks = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (!tenantId || !updates.length) return res.status(400).json({ status: false, message: 'tenantId and updates[] required' });

    const ops = [];
    const keys = [...new Set(updates.map((u) => `${safeTrim(u.batchCode)}_${getPreviousMonday(toInt(u.date))}`).filter((k) => k !== '_0'))];

    for (const key of keys) {
      const [batchCode, wkStartStr] = key.split('_');
      const wkStartOn = parseInt(wkStartStr, 10);
      const tt = await TimeTable.findOne({ tenantId, batchCode, wkStartOn, isdeleted: false });
      if (!tt) continue;

      let modified = false;
      for (const u of updates.filter((u) => safeTrim(u.batchCode) === batchCode && getPreviousMonday(toInt(u.date)) === wkStartOn)) {
        const date = toInt(u.date);
        const periodNo = toInt(u.periodNo);
        const zoomUrl = safeTrim(u.zoomUrl);
        if (!date || !periodNo) continue;
        const d = new Date(date);
        const day = DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];

        if (!isPublished(tt)) {
          const dayIdx = (tt.week || []).findIndex((wd) => wd.day === day);
          if (dayIdx < 0) continue;
          const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
          if (pIdx < 0) continue;
          tt.week[dayIdx].periods[pIdx].zoomUrl = zoomUrl || null;
          tt.week[dayIdx].periods[pIdx].mode = zoomUrl ? 'ONLINE' : tt.week[dayIdx].periods[pIdx].mode;
          tt.markModified('week');
          modified = true;
        } else {
          const existing = (tt.periodOverrides || []).find((o) => toInt(o?.date) === date && normDay(o?.day) === day && toInt(o?.periodNo) === periodNo && ['REPLACE_PERIOD', 'ADD_PERIOD'].includes(o.action));
          let baseObj;
          if (existing?.period) baseObj = existing.period.toObject?.() ?? existing.period;
          else {
            const base = findTemplatePeriod(tt, day, periodNo);
            if (!base) continue;
            baseObj = base.toObject?.() ?? base;
          }
          upsertPeriodOverride(tt, { date, day, periodNo, action: 'REPLACE_PERIOD', period: { ...baseObj, periodNo, zoomUrl, mode: zoomUrl ? 'ONLINE' : baseObj.mode }, reason: 'Bulk Zoom', updatedBy: userId || null });
          tt.markModified('periodOverrides');
          modified = true;
        }
      }

      if (modified) {
        await tt.save();
        ops.push(tt._id);
      }
    }

    return res.json({ status: true, message: 'Bulk zoom links updated', data: { updatedCount: ops.length } });
  } catch (err) {
    return next(err);
  }
};

export default {
  createTimeTable,
  publishTimeTable,
  unpublishTimeTable,
  deleteTimeTable,
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
  listStaffLateEntries: listLateEntries('STAFF'),
  listStudentLateEntries: listLateEntries('STUDENT'),
  viewBatchScheduleByDate,
  updateZoomLink,
  convertToExam,
  bulkUpdateZoomLinks,
  validateSchedule
};

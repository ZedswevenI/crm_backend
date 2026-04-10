import mongoose from 'mongoose';
import TimeTable from '../models/timetable.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import Attendance from '../models/attandence.model.js';
import Staff from '../models/staff.model.js';
import Phase from '../models/phaseplan.model.js';
import Batch from '../models/batch.model.js';
import Subject from '../models/subject.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_ORDER = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };
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
  const d = new Date(wkStartOn);
  d.setUTCDate(d.getUTCDate() + (DAY_ORDER[dayName] ?? 0));
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
const isPublished = (tt) => tt?.status === 'Active';
const resolvePhaseForPeriod = async (tenantId, batchCode, phaseId, phaseName) => {
  if (!phaseId && !phaseName) return { ok: true, phaseId: null, phaseName: null };
  const batch = await Batch.findOne({ tenantId, batchCode, isdeleted: false }).lean();
  if (!batch) return { ok: false, msg: `Batch ${batchCode} not found` };
  const programId = safeTrim(batch.programId || batch.program || batch.programCode);
  if (!programId) return { ok: false, msg: `Batch ${batchCode} has no programId` };
  const query = { tenantId, programId, isdeleted: false };
  if (phaseId) query.phaseId = phaseId;
  else if (phaseName) query.phaseName = new RegExp(`^${escapeRegex(phaseName)}$`, 'i');
  const phase = await Phase.findOne(query).lean();
  if (!phase) return { ok: false, msg: `Phase "${phaseId || phaseName}" not found for program ${programId}` };
  return { ok: true, phaseId: phase.phaseId, phaseName: phase.phaseName };
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
  // if (!['LECTURE', 'EXAM', 'LAB', 'TUTORIAL', 'TEST', 'REVISION'].includes(periodType)) return { ok: false, msg: 'periodType must be LECTURE|EXAM|LAB|TUTORIAL|TEST|REVISION' };
  if (!['LECTURE', 'EXAM', 'LAB', 'TUTORIAL', 'TEST', 'REVISION', 'PT', 'YOGA'].includes(periodType)) return { ok: false, msg: 'periodType must be LECTURE|EXAM|LAB|TUTORIAL|TEST|REVISION|PT|YOGA' };
  let mode = safeTrim(p?.mode) || 'OFFLINE';
  if (!['OFFLINE', 'ONLINE'].includes(mode)) return { ok: false, msg: 'mode must be OFFLINE or ONLINE' };
  if (['PT', 'YOGA'].includes(periodType)) mode = 'OFFLINE';
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

const findTemplatePeriod = (tt, day, periodNo) => {
  const d = (tt?.week || []).find((x) => String(x?.day) === day);
  return (d?.periods || []).find((x) => toInt(x?.periodNo) === toInt(periodNo)) || null;
};

const findEffectivePeriodBase = (tt, day, periodNo, date = null) => {
  const template = findTemplatePeriod(tt, day, periodNo);
  if (template) return template.toObject?.() ?? template;
  const addOverrides = (tt.periodOverrides || []).filter((o) => normDay(o?.day) === day && toInt(o?.periodNo) === periodNo && o.action === 'ADD_PERIOD');
  if (!addOverrides.length) return null;
  const exact = date ? addOverrides.find((o) => toInt(o?.date) === toInt(date)) : null;
  const best = exact ?? addOverrides[addOverrides.length - 1];
  return best?.period ? (best.period.toObject?.() ?? best.period) : null;
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

const buildDaySchedule = (tt, dateEpochMs) => {
  const d = new Date(dateEpochMs);
  const dayName = DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
  const baseDay = (tt.week || []).find((w) => w.day === dayName);
  let periods = baseDay ? JSON.parse(JSON.stringify(baseDay.periods || [])) : [];
  const dayOv = (tt.dayOverrides || []).find((o) => toInt(o?.date) === toInt(dateEpochMs) && normDay(o?.day) === dayName);
  if (dayOv) {
    if (dayOv.action === 'CANCEL_DAY') return { date: dateEpochMs, day: dayName, isHoliday: true, holidayReason: dayOv.reason || 'Holiday', periods: [] };
    if (dayOv.action === 'REPLACE_DAY') periods = Array.isArray(dayOv.periods) && dayOv.periods.length ? JSON.parse(JSON.stringify(dayOv.periods)) : [];
  }
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
  const moves = povs.filter((x) => x.action === 'MOVE_PERIOD');
  if (moves.length) {
    const snapshot = periods.map((p) => ({ ...p }));
    for (const ov of moves) {
      const fromNo = toInt(ov?.periodNo, 0);
      const toNo = toInt(ov?.toPeriodNo, 0);
      if (!fromNo || !toNo) continue;
      const src = snapshot.find((p) => toInt(p?.periodNo) === fromNo);
      // FIX G8: skip if source period is cancelled
      if (!src || src.isCancelled) continue;
      const destIdx = periods.findIndex((p) => toInt(p?.periodNo) === toNo);
      if (destIdx !== -1) periods[destIdx] = { ...src, periodNo: toNo };
      else periods.push({ ...src, periodNo: toNo });
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

const checkStaffConflicts = async (tenantId, facultyId, date, day, startMin, endMin, excludeTimetableId = null, includeDrafts = false, periodType = null, mode = null) => {
  const incomingIsMass = safeTrim(mode).toUpperCase() === 'ONLINE' || safeTrim(periodType).toUpperCase() === 'PT' || safeTrim(periodType).toUpperCase() === 'YOGA';
  if (incomingIsMass) return { conflict: false, facultyName: null };
  const staff = await Staff.findOne({ staffId: facultyId, tenantId, isdeleted: false }).lean();
  if (staff?.weekoff?.includes(day))
    return {
      conflict: true,
      message: `Faculty ${staff.staffName || staff.name || facultyId} has a week-off on ${day}.`,
      facultyName: staff.staffName || staff.name || null
    };
  const wkStartOn = getPreviousMonday(date);
  const query = { tenantId, wkStartOn, isdeleted: false };
  if (!includeDrafts) query.status = 'Active';
  if (excludeTimetableId) query._id = { $ne: excludeTimetableId };
  const timetables = await TimeTable.find(query).lean();
  for (const tt of timetables) {
    const daySched = buildDaySchedule(tt, date);
    if (daySched.isHoliday) continue;
    for (const p of daySched.periods || []) {
      if (p.isCancelled) continue;
      const currentFaculty = p.replacementFacultyId || p.facultyId;
      // if (currentFaculty === String(facultyId)) {
      //   const pStart = toInt(p.time?.startMin);
      //   const pEnd = toInt(p.time?.endMin);
      //   if (startMin < pEnd && endMin > pStart)
      //     return {
      //       conflict: true,
      //       message: `Faculty already booked in batch ${tt.batchCode} from ${p.time?.startLabel || pStart} to ${p.time?.endLabel || pEnd}.`,
      //       facultyName: staff?.staffName || staff?.name || null
      //     };
      // }
      if (currentFaculty === String(facultyId)) {
        const existingIsMass = safeTrim(p.mode).toUpperCase() === 'ONLINE' || safeTrim(p.periodType).toUpperCase() === 'PT' || safeTrim(p.periodType).toUpperCase() === 'YOGA';
        if (existingIsMass) continue;
        const pStart = toInt(p.time?.startMin);
        const pEnd = toInt(p.time?.endMin);
        if (startMin < pEnd && endMin > pStart)
          return {
            conflict: true,
            message: `Faculty already booked in batch ${tt.batchCode} from ${p.time?.startLabel || pStart} to ${p.time?.endLabel || pEnd}.`,
            facultyName: staff?.staffName || staff?.name || null
          };
      }
    }
  }
  return { conflict: false, facultyName: staff?.staffName || staff?.name || null };
};

const validateStaffSubject = async (tenantId, batchCode, facultyId, subjectId, periodType) => {
  const pt = safeTrim(periodType).toUpperCase();
  if (['PT', 'YOGA'].includes(pt)) return { ok: true };
  if (!subjectId || !facultyId) return { ok: true };
  const [batch, staff, subjectDoc] = await Promise.all([
    Batch.findOne({ tenantId, batchCode, isdeleted: false }, { staffMap: 1 }).lean(),
    Staff.findOne({ tenantId, staffId: facultyId, isdeleted: false }, { staffName: 1, subject: 1, facultyType: 1 }).lean(),
    Subject.findOne({ _id: subjectId, isdeleted: false }, { subjectName: 1, subjectCode: 1 }).lean()
  ]);
  const subjectLabel = subjectDoc ? `"${subjectDoc.subjectName}${subjectDoc.subjectCode ? ' (' + subjectDoc.subjectCode + ')' : ''}"` : `ID: ${subjectId}`;
  if (!staff) return { ok: false, msg: `Staff ${facultyId} not found` };
  if (safeTrim(staff.facultyType).toUpperCase() !== 'TEACHING') {
    return { ok: false, msg: `${staff.staffName} is not a TEACHING staff` };
  }
  const staffMap = Array.isArray(batch?.staffMap) ? batch.staffMap : [];
  const hasBatchMap = staffMap.length > 0;
  if (hasBatchMap) {
    const batchEntry = staffMap.find((s) => safeTrim(s.subjectId) === subjectId);
    if (!batchEntry) {
      return {
        ok: false,
        msg: `Subject ${subjectLabel} is not mapped to batch ${batchCode}. Add it via batch staff mapping first.`
      };
    }
    if (safeTrim(batchEntry.staffId) !== facultyId) {
      return {
        ok: false,
        msg: `${staff.staffName} is not assigned to ${subjectLabel} in batch ${batchCode}. Mapped staff is ${batchEntry.staffName || batchEntry.staffId}.`
      };
    }
  }
  const staffSubjects = Array.isArray(staff.subject) ? staff.subject : [];
  if (!staffSubjects.some((sid) => String(sid) === subjectId)) {
    return {
      ok: false,
      msg: `${staff.staffName} does not have subject ${subjectLabel} in their profile.`
    };
  }

  return { ok: true };
};

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
    const existingDoc = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false });
    if (existingDoc && isPublished(existingDoc)) return res.status(400).json({ status: false, message: 'Timetable is published. Use day/edit to modify individual days.' });
    for (const d of weekIn) {
      const day = normDay(d?.day);
      if (!isValidDay(day)) return res.status(400).json({ status: false, message: `Invalid day: ${d?.day}` });
      const periodsIn = Array.isArray(d?.periods) ? d.periods : [];
      const periods = [];
      for (const p of periodsIn) {
        const np = normalizePeriod({ ...p, day });
        if (!np.ok) return res.status(400).json({ status: false, message: np.msg });
        if (np.period.phaseId || np.period.phaseName) {
          const pv = await resolvePhaseForPeriod(tenantId, batchCode, np.period.phaseId, np.period.phaseName);
          if (!pv.ok) return res.status(400).json({ status: false, message: pv.msg });
          np.period.phaseId = pv.phaseId;
          np.period.phaseName = pv.phaseName;
        }
        const ssCheck = await validateStaffSubject(tenantId, batchCode, np.period.facultyId, np.period.subjectId, np.period.periodType);
        if (!ssCheck.ok) {
          return res.status(400).json({
            status: false,
            message: `${day} Period ${np.period.periodNo}: ${ssCheck.msg}`
          });
        }
        periods.push(np.period);
      }
      week.push({ day, periods });
    }
    if (!existingDoc) {
      const doc = await TimeTable.create({
        tenantId,
        batchCode,
        wkStartOn: correctedMonday,
        centerCode: safeTrim(payload.centerCode) || null,
        phase: safeTrim(payload.phase) || null,
        status: 'DRAFT',
        week,
        createdBy: payload.userId || null,
        updatedBy: payload.userId || null,
        isdeleted: false
      });
      return res.status(200).json({ status: true, message: 'Timetable created', data: doc });
    }
    const incomingDays = new Set(week.map((d) => d.day));
    const mergedWeek = [...existingDoc.week.filter((d) => !incomingDays.has(d.day)), ...week].sort((a, b) => (DAY_ORDER[a.day] ?? 7) - (DAY_ORDER[b.day] ?? 7));
    existingDoc.week = mergedWeek;
    existingDoc.centerCode = safeTrim(payload.centerCode) || existingDoc.centerCode || null;
    existingDoc.phase = safeTrim(payload.phase) || existingDoc.phase || null;
    existingDoc.updatedBy = payload.userId || null;
    await existingDoc.save();
    return res.status(200).json({ status: true, message: 'Timetable updated', data: existingDoc });
  } catch (err) {
    return next(err);
  }
};

const publishTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !timetableId) return res.status(400).json({ status: false, message: 'tenantId and timetableId required' });
    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
    if (isPublished(tt)) return res.status(400).json({ status: false, message: 'Timetable is already published' });
    if (!tt.week?.length) return res.status(400).json({ status: false, message: 'Cannot publish an empty timetable' });
    for (const dayObj of tt.week || []) {
      const day = dayObj.day;
      const exactDate = getOffsetDate(tt.wkStartOn, day);
      for (const p of dayObj.periods || []) {
        if (p.isCancelled) continue;
        const check = await checkStaffConflicts(tenantId, p.facultyId, exactDate, day, p.time?.startMin, p.time?.endMin, tt._id, false, p.periodType, p.mode);
        if (check.conflict) return res.status(400).json({ status: false, message: `Publish blocked — conflict on ${day} Period ${p.periodNo}: ${check.message}` });
        const ssCheck = await validateStaffSubject(tenantId, tt.batchCode, p.facultyId, p.subjectId, p.periodType);
        if (!ssCheck.ok) {
          return res.status(400).json({
            status: false,
            message: `Publish blocked — ${day} Period ${p.periodNo}: ${ssCheck.msg}`
          });
        }
      }
    }
    tt.status = 'Active';
    tt.publishedAt = Date.now();
    tt.publishedBy = userId || null;
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Timetable published successfully', data: { status: tt.status } });
  } catch (err) {
    return next(err);
  }
};

const unpublishTimeTable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !timetableId) return res.status(400).json({ status: false, message: 'tenantId and timetableId required' });
    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
    if (tt.status === 'DRAFT') return res.status(400).json({ status: false, message: 'Timetable is already a draft' });
    const hadOverrides = (tt.dayOverrides?.length || 0) + (tt.periodOverrides?.length || 0);
    tt.dayOverrides = [];
    tt.periodOverrides = [];
    tt.status = 'DRAFT';
    tt.updatedBy = userId || null;
    tt.markModified('dayOverrides');
    tt.markModified('periodOverrides');
    await tt.save();

    return res.json({
      status: true,
      message: 'Timetable reverted to DRAFT',
      data: {
        status: tt.status,
        overridesCleared: hadOverrides
      }
    });
  } catch (err) {
    return next(err);
  }
};

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
    const dateWkStart = getPreviousMonday(date);
    if (dateWkStart !== toInt(tt.wkStartOn)) return res.status(400).json({ status: false, message: `Date does not belong to this timetable's week (wkStartOn: ${tt.wkStartOn})` });
    const d = new Date(date);
    const day = DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
    // if (!isPublished(tt)) {
    //   const dayIdx = (tt.week || []).findIndex((wd) => wd.day === day);
    //   if (dayIdx >= 0) {
    //     tt.week[dayIdx].periods = tt.week[dayIdx].periods.map((p) => ({
    //       ...(p.toObject?.() ?? p),
    //       isCancelled: true,
    //       cancelReason: reason
    //     }));
    //     tt.markModified('week');
    //   }
    //   tt.updatedBy = userId || null;
    //   await tt.save();
    //   return res.json({ status: true, message: 'Day cancelled (draft)' });
    // }
    if (!isPublished(tt)) {
      const dayIdx = (tt.week || []).findIndex((wd) => wd.day === day);
      if (dayIdx >= 0) {
        tt.week[dayIdx].periods = tt.week[dayIdx].periods.map((p) => ({
          ...(p.toObject?.() ?? p),
          isCancelled: true,
          cancelReason: reason
        }));
        tt.markModified('week');
      }
      upsertDayOverride(tt, { date, day, action: 'CANCEL_DAY', periods: [], reason, updatedBy: userId || null });
      tt.markModified('dayOverrides');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Day cancelled (draft)' });
    }
    upsertDayOverride(tt, { date, day, action: 'CANCEL_DAY', periods: [], reason, updatedBy: userId || null });
    tt.markModified('dayOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Holiday declared' });
  } catch (err) {
    return next(err);
  }
};

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
    if (isPublished(tt) && !date) return res.status(400).json({ status: false, message: 'date is required for published timetable' });
    if (isPublished(tt)) {
      const dateWkStart = getPreviousMonday(date);
      if (dateWkStart !== toInt(tt.wkStartOn)) return res.status(400).json({ status: false, message: `Date does not belong to this timetable's week` });
    }
    const exactDate = isPublished(tt) ? date : getOffsetDate(tt.wkStartOn, day);
    const batchCode = tt.batchCode;
    const normalizedPeriods = [];
    for (const p of periodsIn) {
      const np = normalizePeriod({ ...p, day });
      if (!np.ok) return res.status(400).json({ status: false, message: np.msg });
      if (np.period.phaseId || np.period.phaseName) {
        const pv = await resolvePhaseForPeriod(tenantId, batchCode, np.period.phaseId, np.period.phaseName);
        if (!pv.ok) return res.status(400).json({ status: false, message: pv.msg });
        np.period.phaseId = pv.phaseId;
        np.period.phaseName = pv.phaseName;
      }
      const ssCheck = await validateStaffSubject(tenantId, batchCode, np.period.facultyId, np.period.subjectId, np.period.periodType);
      if (!ssCheck.ok) {
        return res.status(400).json({
          status: false,
          message: `${day} Period ${np.period.periodNo}: ${ssCheck.msg}`
        });
      }
      if (isPublished(tt)) {
        const activeFacultyId = np.period.replacementFacultyId || np.period.facultyId;
        const check = await checkStaffConflicts(tenantId, activeFacultyId, exactDate, day, np.period.time.startMin, np.period.time.endMin, timetableId, false, np.period.periodType, np.period.mode);
        if (check.conflict) return res.status(400).json({ status: false, message: check.message });
      }
      normalizedPeriods.push(np.period);
    }
    if (!isPublished(tt)) {
      const idx = (tt.week || []).findIndex((d) => d.day === day);
      if (idx >= 0) tt.week[idx].periods = normalizedPeriods;
      else {
        tt.week.push({ day, periods: normalizedPeriods });
        tt.week.sort((a, b) => (DAY_ORDER[a.day] ?? 7) - (DAY_ORDER[b.day] ?? 7));
      }
      tt.markModified('week');
    } else {
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
    const base = findEffectivePeriodBase(tt, day, periodNo, date);
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

// const rearrangeStaff = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const timetableId = safeTrim(req.body?.timetableId);
//     const date = toInt(req.body?.date, 0);
//     const day = normDay(req.body?.day);
//     const periodNo = toInt(req.body?.periodNo, 0);
//     const newFacultyId = safeTrim(req.body?.newFacultyId);
//     const newFacultyName = safeTrim(req.body?.newFacultyName);
//     const userId = safeTrim(req.body?.userId);
//     if (!tenantId || !timetableId || !periodNo || !newFacultyId || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });
//     const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
//     if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
//     if (!isPublished(tt)) {
//       const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
//       if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });
//       const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
//       if (pIdx < 0) return res.status(400).json({ status: false, message: 'Period not found' });
//       tt.week[dayIdx].periods[pIdx].facultyId = newFacultyId;
//       tt.week[dayIdx].periods[pIdx].facultyName = newFacultyName || null;
//       tt.week[dayIdx].periods[pIdx].replacementFacultyId = newFacultyId;
//       tt.markModified('week');
//       tt.updatedBy = userId || null;
//       if (!isPublished(tt)) {
//         const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
//         if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });
//         const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
//         if (pIdx < 0) return res.status(400).json({ status: false, message: 'Period not found' });
//         const draftPeriod = tt.week[dayIdx].periods[pIdx];
//         const draftSubjectId = safeTrim(draftPeriod?.subjectId || '');
//         const draftPeriodType = safeTrim(draftPeriod?.periodType || '');
//         if (draftSubjectId && !['PT', 'YOGA'].includes(draftPeriodType.toUpperCase())) {
//           const [newStaff, subjectDoc] = await Promise.all([Staff.findOne({ tenantId, staffId: newFacultyId, isdeleted: false }, { staffName: 1, subject: 1, facultyType: 1 }).lean(), Subject.findOne({ _id: draftSubjectId, isdeleted: false }, { subjectName: 1, subjectCode: 1 }).lean()]);
//           if (!newStaff) {
//             return res.status(400).json({ status: false, message: `Replacement staff ${newFacultyId} not found` });
//           }
//           if (safeTrim(newStaff.facultyType).toUpperCase() !== 'TEACHING') {
//             return res.status(400).json({ status: false, message: `${newStaff.staffName} is not a TEACHING staff` });
//           }
//           const staffSubjects = Array.isArray(newStaff.subject) ? newStaff.subject : [];
//           if (!staffSubjects.some((sid) => String(sid) === draftSubjectId)) {
//             const subjectLabel = subjectDoc ? `"${subjectDoc.subjectName}${subjectDoc.subjectCode ? ' (' + subjectDoc.subjectCode + ')' : ''}"` : `ID: ${draftSubjectId}`;
//             return res.status(400).json({
//               status: false,
//               message: `${newStaff.staffName} does not have subject ${subjectLabel} in their profile. Cannot assign as replacement.`
//             });
//           }
//         }
//         tt.week[dayIdx].periods[pIdx].facultyId = newFacultyId;
//         tt.week[dayIdx].periods[pIdx].facultyName = newFacultyName || null;
//         tt.week[dayIdx].periods[pIdx].replacementFacultyId = newFacultyId;
//         tt.markModified('week');
//         tt.updatedBy = userId || null;
//         await tt.save();
//         return res.json({ status: true, message: 'Staff updated (draft)' });
//       }
//       await tt.save();
//       return res.json({ status: true, message: 'Staff updated (draft)' });
//     }
//     if (!date) return res.status(400).json({ status: false, message: 'date required for published timetable' });
//     const baseObj = findEffectivePeriodBase(tt, day, periodNo, date);
//     if (!baseObj) return res.status(400).json({ status: false, message: 'Period not found' });
//     const check = await checkStaffConflicts(tenantId, newFacultyId, date, day, toInt(baseObj?.time?.startMin), toInt(baseObj?.time?.endMin), timetableId, false, baseObj?.periodType, baseObj?.mode);
//     if (check.conflict) return res.status(400).json({ status: false, message: check.message });
//     const subjectIdForPeriod = safeTrim(baseObj?.subjectId || '');
//     const ptForPeriod = safeTrim(baseObj?.periodType || '');
//     if (subjectIdForPeriod && !['PT', 'YOGA'].includes(ptForPeriod.toUpperCase())) {
//       const [newStaff, subjectDoc] = await Promise.all([Staff.findOne({ tenantId, staffId: newFacultyId, isdeleted: false }, { staffName: 1, subject: 1, facultyType: 1 }).lean(), Subject.findOne({ _id: subjectIdForPeriod, isdeleted: false }, { subjectName: 1, subjectCode: 1 }).lean()]);
//       if (!newStaff) {
//         return res.status(400).json({ status: false, message: `Replacement staff ${newFacultyId} not found` });
//       }
//       if (safeTrim(newStaff.facultyType).toUpperCase() !== 'TEACHING') {
//         return res.status(400).json({ status: false, message: `${newStaff.staffName} is not a TEACHING staff` });
//       }
//       const staffSubjects = Array.isArray(newStaff.subject) ? newStaff.subject : [];
//       if (!staffSubjects.some((sid) => String(sid) === subjectIdForPeriod)) {
//         const subjectLabel = subjectDoc ? `"${subjectDoc.subjectName}${subjectDoc.subjectCode ? ' (' + subjectDoc.subjectCode + ')' : ''}"` : `ID: ${subjectIdForPeriod}`;
//         return res.status(400).json({
//           status: false,
//           message: `${newStaff.staffName} does not have subject ${subjectLabel} in their profile. Cannot assign as replacement.`
//         });
//       }
//     }
//     upsertPeriodOverride(tt, {
//       date,
//       day,
//       periodNo,
//       action: 'REPLACE_PERIOD',
//       period: { ...baseObj, periodNo, facultyId: newFacultyId, facultyName: newFacultyName || null, replacementFacultyId: newFacultyId, isCancelled: false },
//       reason: 'Faculty rearranged',
//       updatedBy: userId || null
//     });
//     tt.markModified('periodOverrides');
//     tt.updatedBy = userId || null;
//     await tt.save();
//     return res.json({ status: true, message: 'Faculty updated' });
//   } catch (err) {
//     return next(err);
//   }
// };

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

    // ── DRAFT PATH ────────────────────────────────────────────────────────────
    if (!isPublished(tt)) {
      const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
      if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });

      const pIdx = tt.week[dayIdx].periods.findIndex((p) => toInt(p?.periodNo) === periodNo);
      if (pIdx < 0) return res.status(400).json({ status: false, message: 'Period not found' });

      // ── Staff-subject check for draft ─────────────────────────────────────
      const draftPeriod = tt.week[dayIdx].periods[pIdx];
      const draftSubjectId = safeTrim(draftPeriod?.subjectId || '');
      const draftPeriodType = safeTrim(draftPeriod?.periodType || '');

      if (draftSubjectId && !['PT', 'YOGA'].includes(draftPeriodType.toUpperCase())) {
        const [newStaff, subjectDoc] = await Promise.all([Staff.findOne({ tenantId, staffId: newFacultyId, isdeleted: false }, { staffName: 1, subject: 1, facultyType: 1 }).lean(), Subject.findOne({ _id: draftSubjectId, isdeleted: false }, { subjectName: 1, subjectCode: 1 }).lean()]);

        if (!newStaff) {
          return res.status(400).json({ status: false, message: `Replacement staff ${newFacultyId} not found` });
        }
        if (safeTrim(newStaff.facultyType).toUpperCase() !== 'TEACHING') {
          return res.status(400).json({ status: false, message: `${newStaff.staffName} is not a TEACHING staff` });
        }
        const staffSubjects = Array.isArray(newStaff.subject) ? newStaff.subject : [];
        if (!staffSubjects.some((sid) => String(sid) === draftSubjectId)) {
          const subjectLabel = subjectDoc ? `"${subjectDoc.subjectName}${subjectDoc.subjectCode ? ' (' + subjectDoc.subjectCode + ')' : ''}"` : `ID: ${draftSubjectId}`;
          return res.status(400).json({
            status: false,
            message: `${newStaff.staffName} does not have subject ${subjectLabel} in their profile. Cannot assign as replacement.`
          });
        }
      }

      // ── All checks passed — update ────────────────────────────────────────
      tt.week[dayIdx].periods[pIdx].facultyId = newFacultyId;
      tt.week[dayIdx].periods[pIdx].facultyName = newFacultyName || null;
      tt.week[dayIdx].periods[pIdx].replacementFacultyId = newFacultyId;
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Staff updated (draft)' });
    }

    // ── PUBLISHED PATH ────────────────────────────────────────────────────────
    if (!date) return res.status(400).json({ status: false, message: 'date required for published timetable' });

    const baseObj = findEffectivePeriodBase(tt, day, periodNo, date);
    if (!baseObj) return res.status(400).json({ status: false, message: 'Period not found' });

    const check = await checkStaffConflicts(tenantId, newFacultyId, date, day, toInt(baseObj?.time?.startMin), toInt(baseObj?.time?.endMin), timetableId, false, baseObj?.periodType, baseObj?.mode);
    if (check.conflict) return res.status(400).json({ status: false, message: check.message });

    const subjectIdForPeriod = safeTrim(baseObj?.subjectId || '');
    const ptForPeriod = safeTrim(baseObj?.periodType || '');

    if (subjectIdForPeriod && !['PT', 'YOGA'].includes(ptForPeriod.toUpperCase())) {
      const [newStaff, subjectDoc] = await Promise.all([Staff.findOne({ tenantId, staffId: newFacultyId, isdeleted: false }, { staffName: 1, subject: 1, facultyType: 1 }).lean(), Subject.findOne({ _id: subjectIdForPeriod, isdeleted: false }, { subjectName: 1, subjectCode: 1 }).lean()]);

      if (!newStaff) {
        return res.status(400).json({ status: false, message: `Replacement staff ${newFacultyId} not found` });
      }
      if (safeTrim(newStaff.facultyType).toUpperCase() !== 'TEACHING') {
        return res.status(400).json({ status: false, message: `${newStaff.staffName} is not a TEACHING staff` });
      }
      const staffSubjects = Array.isArray(newStaff.subject) ? newStaff.subject : [];
      if (!staffSubjects.some((sid) => String(sid) === subjectIdForPeriod)) {
        const subjectLabel = subjectDoc ? `"${subjectDoc.subjectName}${subjectDoc.subjectCode ? ' (' + subjectDoc.subjectCode + ')' : ''}"` : `ID: ${subjectIdForPeriod}`;
        return res.status(400).json({
          status: false,
          message: `${newStaff.staffName} does not have subject ${subjectLabel} in their profile. Cannot assign as replacement.`
        });
      }
    }

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
      const dayIdx = (tt.week || []).findIndex((d) => d.day === day);
      if (dayIdx < 0) return res.status(400).json({ status: false, message: `Day ${day} not found` });
      const periods = tt.week[dayIdx].periods;
      const fromIdx = periods.findIndex((p) => toInt(p?.periodNo) === fromPeriodNo);
      const toIdx = periods.findIndex((p) => toInt(p?.periodNo) === toPeriodNo);
      if (fromIdx < 0) return res.status(400).json({ status: false, message: 'Source period not found' });
      const fromObj = { ...(periods[fromIdx].toObject?.() ?? periods[fromIdx]) };
      const fromNo = fromObj.periodNo;
      if (toIdx >= 0) {
        const toObj = { ...(periods[toIdx].toObject?.() ?? periods[toIdx]) };
        const toNo = toObj.periodNo;
        const fromTime = fromObj.time;
        const toTime = toObj.time;
        // periods[fromIdx] = { ...toObj, periodNo: fromNo, time: fromTime };
        // periods[toIdx] = { ...fromObj, periodNo: toNo, time: toTime };
        periods[fromIdx] = { ...toObj, periodNo: fromNo, time: fromTime, replacementFacultyId: null };
        periods[toIdx] = { ...fromObj, periodNo: toNo, time: toTime, replacementFacultyId: null };
      } else {
        periods.splice(fromIdx, 1);
        periods.push({ ...fromObj, periodNo: toPeriodNo });
      }
      periods.sort((a, b) => toInt(a?.periodNo) - toInt(b?.periodNo));
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Period moved (draft)' });
    }
    if (!date) return res.status(400).json({ status: false, message: 'date required for published timetable' });
    // const fromBase = findEffectivePeriodBase(tt, day, fromPeriodNo, date);
    // if (!fromBase) return res.status(400).json({ status: false, message: 'Source period not found' });
    // const toBase = findEffectivePeriodBase(tt, day, toPeriodNo, date);
    const daySchedule = buildDaySchedule(tt, date);
    const fromBase = (daySchedule.periods || []).find((p) => toInt(p?.periodNo) === fromPeriodNo && !p.isCancelled) || null;
    if (!fromBase) return res.status(400).json({ status: false, message: 'Source period not found or cancelled' });
    const toBase = (daySchedule.periods || []).find((p) => toInt(p?.periodNo) === toPeriodNo && !p.isCancelled) || null;
    if (toBase) {
      const checkFrom = await checkStaffConflicts(tenantId, fromBase.replacementFacultyId || fromBase.facultyId, date, day, toInt(toBase.time?.startMin), toInt(toBase.time?.endMin), timetableId, false, fromBase.periodType, fromBase.mode);
      if (checkFrom.conflict) return res.status(400).json({ status: false, message: `Swap conflict (source faculty): ${checkFrom.message}` });
      const checkTo = await checkStaffConflicts(tenantId, toBase.replacementFacultyId || toBase.facultyId, date, day, toInt(fromBase.time?.startMin), toInt(fromBase.time?.endMin), timetableId, false, toBase.periodType, toBase.mode);
      if (checkTo.conflict) return res.status(400).json({ status: false, message: `Swap conflict (target faculty): ${checkTo.message}` });
    }
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
    const base = findEffectivePeriodBase(tt, day, periodNo, date);
    if (!base) return res.status(400).json({ status: false, message: 'Period not found in template or overrides' });
    const np = normalizePeriod({ ...base, ...periodIn, periodNo, day });
    if (!np.ok) return res.status(400).json({ status: false, message: np.msg });
    if (np.period.phaseId || np.period.phaseName) {
      const pv = await resolvePhaseForPeriod(tenantId, tt.batchCode, np.period.phaseId, np.period.phaseName);
      if (!pv.ok) return res.status(400).json({ status: false, message: pv.msg });
      np.period.phaseId = pv.phaseId;
      np.period.phaseName = pv.phaseName;
    }
    const ssCheck = await validateStaffSubject(tenantId, tt.batchCode, np.period.facultyId, np.period.subjectId, np.period.periodType);
    if (!ssCheck.ok) {
      return res.status(400).json({
        status: false,
        message: `Period ${np.period.periodNo}: ${ssCheck.msg}`
      });
    }
    if (!isPublished(tt)) {
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
    const check = await checkStaffConflicts(tenantId, activeFacultyId, date, day, np.period.time.startMin, np.period.time.endMin, timetableId, false, np.period.periodType, np.period.mode);
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

const addPeriod = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const timetableId = safeTrim(req.body?.timetableId);
    const date = toInt(req.body?.date, 0);
    const day = normDay(req.body?.day);
    const periodIn = req.body?.period || {};
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !timetableId || !day) return res.status(400).json({ status: false, message: 'tenantId, timetableId, and day are required' });
    if (!isValidDay(day)) return res.status(400).json({ status: false, message: `Invalid day: ${day}` });
    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
    const np = normalizePeriod({ ...periodIn, day });
    if (!np.ok) return res.status(400).json({ status: false, message: np.msg });
    if (np.period.phaseId || np.period.phaseName) {
      const pv = await resolvePhaseForPeriod(tenantId, tt.batchCode, np.period.phaseId, np.period.phaseName);
      if (!pv.ok) return res.status(400).json({ status: false, message: pv.msg });
      np.period.phaseId = pv.phaseId;
      np.period.phaseName = pv.phaseName;
    }
    const ssCheck = await validateStaffSubject(tenantId, tt.batchCode, np.period.facultyId, np.period.subjectId, np.period.periodType);
    if (!ssCheck.ok) {
      return res.status(400).json({
        status: false,
        message: `Period ${np.period.periodNo}: ${ssCheck.msg}`
      });
    }
    if (!isPublished(tt)) {
      if (!date) return res.status(400).json({ status: false, message: 'date required to determine the day' });
      const idx = (tt.week || []).findIndex((d) => d.day === day);
      if (idx < 0) {
        tt.week.push({ day, periods: [np.period] });
        tt.week.sort((a, b) => (DAY_ORDER[a.day] ?? 7) - (DAY_ORDER[b.day] ?? 7));
      } else {
        const exists = tt.week[idx].periods.some((p) => toInt(p?.periodNo) === np.period.periodNo);
        if (exists) return res.status(400).json({ status: false, message: `Period ${np.period.periodNo} already exists on ${day}` });
        tt.week[idx].periods.push(np.period);
        tt.week[idx].periods.sort((a, b) => toInt(a?.periodNo) - toInt(b?.periodNo));
      }
      tt.markModified('week');
      tt.updatedBy = userId || null;
      await tt.save();
      return res.json({ status: true, message: 'Period added (draft)' });
    }
    if (!date) return res.status(400).json({ status: false, message: 'date is required for published timetable' });
    const dateWkStart = getPreviousMonday(date);
    if (dateWkStart !== toInt(tt.wkStartOn)) return res.status(400).json({ status: false, message: `Date does not belong to this timetable's week` });
    const rendered = buildDaySchedule(tt, date);
    const alreadyExists = rendered.periods.some((p) => toInt(p?.periodNo) === np.period.periodNo && !p.isCancelled);
    if (alreadyExists) return res.status(400).json({ status: false, message: `Period ${np.period.periodNo} already exists on this date` });
    const activeFacultyId = np.period.replacementFacultyId || np.period.facultyId;
    const check = await checkStaffConflicts(tenantId, activeFacultyId, date, day, np.period.time.startMin, np.period.time.endMin, timetableId, false, np.period.periodType, np.period.mode);
    if (check.conflict) return res.status(400).json({ status: false, message: check.message });
    upsertPeriodOverride(tt, { date, day, periodNo: np.period.periodNo, action: 'ADD_PERIOD', period: np.period, toPeriodNo: null, reason: 'Period added', updatedBy: userId || null });
    tt.markModified('periodOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Period added', data: { periodNo: np.period.periodNo } });
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
    const baseObj = findEffectivePeriodBase(tt, day, periodNo, date);
    if (!baseObj) return res.status(400).json({ status: false, message: 'Period not found' });
    upsertPeriodOverride(tt, { date, day, periodNo, action: 'REPLACE_PERIOD', period: { ...baseObj, zoomUrl, mode: zoomUrl ? 'ONLINE' : baseObj.mode, periodNo }, reason: 'Zoom link updated', updatedBy: userId || null });
    tt.markModified('periodOverrides');
    tt.updatedBy = userId || null;
    await tt.save();
    return res.json({ status: true, message: 'Zoom link updated' });
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
    if (!tenantId || !timetableId || !periodNo || !day) return res.status(400).json({ status: false, message: 'Missing required fields' });
    const tt = await TimeTable.findOne({ _id: timetableId, tenantId, isdeleted: false });
    if (!tt) return res.status(404).json({ status: false, message: 'Timetable not found' });
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
    const periodToSave = findEffectivePeriodBase(tt, day, periodNo, date);
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
      const check = await checkStaffConflicts(tenantId, activeFacultyId, date, day, startMin, endMin, timetableId, false, periodToSave.periodType, periodToSave.mode);
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

const listTimeTables = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const page = Math.max(parseInt(req.query.page || req.body.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || req.body.limit || '20', 10), 1), 200);
    const skip = (page - 1) * limit;

    const { list, search, batchCode, centerCode, phase, wkFrom, wkTo, status } = { ...req.query, ...req.body }; // FIX G14: accept filters from both query and body

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

const listTimeTablesByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode || req.query?.batchCode);
    if (!tenantId || !batchCode) return res.status(400).json({ status: false, message: 'tenantId and batchCode required' });
    const query = { tenantId, batchCode, isdeleted: false };
    const wkFrom = toInt(req.query.wkFrom || req.body.wkFrom, 0);
    const wkTo = toInt(req.query.wkTo || req.body.wkTo, 0);
    if (wkFrom) query.wkStartOn = { ...(query.wkStartOn || {}), $gte: wkFrom };
    if (wkTo) query.wkStartOn = { ...(query.wkStartOn || {}), $lte: wkTo };
    const rows = await TimeTable.find(query).sort({ wkStartOn: -1 }).lean();
    return res.json({ status: true, data: rows, count: rows.length });
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
      const wkStart = toInt(item.wkStartOn, 0);
      if (!batchCode || !wkStart) continue;
      const correctedMonday = getPreviousMonday(wkStart);
      const weekIn = Array.isArray(item.week) ? item.week : [];
      const week = [];
      let rowHasError = false;
      const existingDoc = await TimeTable.findOne({ tenantId, batchCode, wkStartOn: correctedMonday, isdeleted: false }).lean();
      if (existingDoc && isPublished(existingDoc)) {
        bulkErrors.push({ batchCode, row: i + 1, message: 'Timetable is published; cannot bulk-overwrite it.' });
        continue;
      }
      for (const d of weekIn) {
        const day = normDay(d?.day);
        if (!isValidDay(day)) continue;
        const periods = [];
        for (const p of d?.periods || []) {
          const np = normalizePeriod({ ...p, day });
          if (!np.ok) continue;
          if (np.period.phaseId || np.period.phaseName) {
            const pv = await resolvePhaseForPeriod(tenantId, batchCode, np.period.phaseId, np.period.phaseName);
            if (!pv.ok) {
              bulkErrors.push({ batchCode, row: i + 1, message: pv.msg });
              rowHasError = true;
              break;
            }
            np.period.phaseId = pv.phaseId;
            np.period.phaseName = pv.phaseName;
          }
          const ssCheck = await validateStaffSubject(tenantId, batchCode, np.period.facultyId, np.period.subjectId, np.period.periodType);
          if (!ssCheck.ok) {
            bulkErrors.push({ batchCode, row: i + 1, message: `${day} Period ${np.period.periodNo}: ${ssCheck.msg}` });
            rowHasError = true;
            break;
          }
          periods.push(np.period);
        }
        if (rowHasError) break;
        week.push({ day, periods });
      }
      if (rowHasError) continue;
      let mergedWeek = week;
      if (existingDoc?.week?.length) {
        const incomingDays = new Set(week.map((d) => d.day));
        mergedWeek = [...existingDoc.week.filter((d) => !incomingDays.has(d.day)), ...week].sort((a, b) => (DAY_ORDER[a.day] ?? 7) - (DAY_ORDER[b.day] ?? 7));
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
    if (bulkErrors.length) return res.status(400).json({ status: false, message: 'Bulk upload errors', conflicts: bulkErrors });
    if (!ops.length) return res.status(400).json({ status: false, message: 'No valid timetable data found' });
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
    const activeOnly = req.body?.activeOnly !== false;
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
    const ttQuery = { tenantId, batchCode, wkStartOn: { $in: [...weekStarts] }, isdeleted: false };
    if (activeOnly) ttQuery.status = 'Active';
    const timetables = await TimeTable.find(ttQuery).lean();
    const ttMap = {};
    for (const tt of timetables) ttMap[tt.wkStartOn] = tt;
    const schedule = [];
    curr = fromDate;
    while (curr <= toDate) {
      const wkStart = getPreviousMonday(curr);
      const tt = ttMap[wkStart];
      if (!tt) {
        const d = new Date(curr);
        schedule.push({ date: curr, day: DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1], isHoliday: false, holidayReason: null, periods: [], timetableId: null });
      } else {
        // schedule.push(buildDaySchedule(tt, curr));
        const daySchedule = buildDaySchedule(tt, curr);
        schedule.push({ ...daySchedule, timetableId: String(tt._id) });
      }
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
    const { type, personId, personName, timetableId, batchCode, date, periodNo, scheduledStartMin, delayMinutes, reason, entryType } = req.body;
    if (!tenantId || !type || !personId || !timetableId || !date || !periodNo || scheduledStartMin === undefined || delayMinutes === undefined) return res.status(400).json({ status: false, message: 'Missing required fields for late entry' });

    const upperType = String(type).toUpperCase();
    if (!['STAFF', 'STUDENT'].includes(upperType)) return res.status(400).json({ status: false, message: 'type must be STAFF or STUDENT' });
    const doc = await LateEntryLog.findOneAndUpdate(
      { tenantId, type: upperType, personId, date: toInt(date), periodNo: toInt(periodNo), isdeleted: false },
      {
        $set: {
          personName: safeTrim(personName),
          entryType: safeTrim(entryType),
          timetableId: safeTrim(timetableId),
          batchCode: safeTrim(batchCode),
          scheduledStartMin: toInt(scheduledStartMin),
          actualEntryTime: Date.now(),
          delayMinutes: toInt(delayMinutes),
          reason: safeTrim(reason) || null,
          updatedBy: userId
        },
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
          const baseObj = findEffectivePeriodBase(tt, day, periodNo, date);
          if (!baseObj) continue;
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

// const validateSchedule = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const data = Array.isArray(req.body?.data) ? req.body.data : [];
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
//     if (!data.length) return res.status(400).json({ status: false, message: 'No schedule data provided' });
//     const conflicts = [];
//     const proposed = [];
//     for (let i = 0; i < data.length; i++) {
//       const item = data[i];
//       const batchCode = safeTrim(item.batchCode) || `Row ${i + 1}`;
//       const wkStart = toInt(item.wkStartOn, 0);
//       const timetableId = safeTrim(item.timetableId) || null;
//       if (!wkStart) {
//         conflicts.push({ batchCode, message: 'wkStartOn is required' });
//         continue;
//       }
//       const correctedMonday = getPreviousMonday(wkStart);
//       const publishedTT = await TimeTable.findOne({
//         tenantId,
//         batchCode,
//         wkStartOn: correctedMonday,
//         isdeleted: false,
//         status: 'Active',
//         ...(timetableId ? { _id: { $ne: timetableId } } : {})
//       }).lean();
//       if (publishedTT) {
//         conflicts.push({
//           batchCode,
//           week: correctedMonday,
//           message: `Timetable already published for batch ${batchCode} for this week. Use day/edit to modify individual days.`,
//           publishedAt: publishedTT.publishedAt || null,
//           publishedTimetableId: publishedTT._id
//         });
//         continue;
//       }
//       let periodTimeError = false;
//       for (const d of item.week || []) {
//         const day = normDay(d?.day);
//         if (!isValidDay(day)) {
//           conflicts.push({ batchCode, day: d?.day, message: `Invalid day: ${d?.day}` });
//           periodTimeError = true;
//           break;
//         }
//         for (const p of d?.periods || []) {
//           const startMin = toInt(p?.time?.startMin, -1);
//           const endMin = toInt(p?.time?.endMin, -1);
//           if (startMin < 0 || startMin > 1439) {
//             conflicts.push({ batchCode, day, periodNo: p.periodNo, message: `Period ${p.periodNo} on ${day}: invalid startMin (${startMin})` });
//             periodTimeError = true;
//           } else if (endMin < 0 || endMin > 1439) {
//             conflicts.push({ batchCode, day, periodNo: p.periodNo, message: `Period ${p.periodNo} on ${day}: invalid endMin (${endMin})` });
//             periodTimeError = true;
//           } else if (endMin <= startMin) {
//             conflicts.push({ batchCode, day, periodNo: p.periodNo, message: `Period ${p.periodNo} on ${day}: endMin must be greater than startMin` });
//             periodTimeError = true;
//           }
//         }
//         if (periodTimeError) break;
//       }
//       if (periodTimeError) continue;
//       let hasDuplicate = false;
//       for (const d of item.week || []) {
//         const day = normDay(d?.day);
//         const seenPeriodNos = new Set();
//         for (const p of d?.periods || []) {
//           const pNo = toInt(p?.periodNo, 0);
//           if (!pNo) continue;
//           if (seenPeriodNos.has(pNo)) {
//             conflicts.push({ batchCode, day, periodNo: pNo, message: `Duplicate periodNo ${pNo} on ${day}` });
//             hasDuplicate = true;
//           }
//           seenPeriodNos.add(pNo);
//         }
//       }
//       if (hasDuplicate) continue;
//       for (const d of item.week || []) {
//         const day = normDay(d?.day);
//         if (!isValidDay(day)) continue;
//         const exactDate = getOffsetDate(correctedMonday, day);
//         for (const p of d?.periods || []) {
//           const facultyId = safeTrim(p?.facultyId);
//           const startMin = toInt(p?.time?.startMin, -1);
//           const endMin = toInt(p?.time?.endMin, -1);
//           const periodType = safeTrim(p?.periodType).toUpperCase();
//           const mode = safeTrim(p?.mode).toUpperCase();
//           if (!facultyId || startMin < 0 || endMin < 0) continue;
//           const isMassClass = mode === 'ONLINE' || periodType === 'PT' || periodType === 'YOGA';
//           if (isMassClass) continue;
//           const dbCheck = await checkStaffConflicts(tenantId, facultyId, exactDate, day, startMin, endMin, timetableId, false);
//           if (dbCheck.conflict) {
//             conflicts.push({
//               batchCode,
//               day,
//               periodNo: p.periodNo,
//               facultyId,
//               facultyName: dbCheck.facultyName || safeTrim(p?.facultyName) || null,
//               message: dbCheck.message
//             });
//           } else {
//             const internal = proposed.find((pa) => pa.facultyId === facultyId && pa.exactDate === exactDate && startMin < pa.endMin && endMin > pa.startMin);
//             if (internal) {
//               conflicts.push({
//                 batchCode,
//                 day,
//                 periodNo: p.periodNo,
//                 facultyId,
//                 facultyName: safeTrim(p?.facultyName) || null,
//                 message: `Internal conflict with batch ${internal.batchCode} on ${day} (Period ${internal.periodNo})`
//               });
//             } else {
//               proposed.push({
//                 facultyId,
//                 exactDate,
//                 startMin,
//                 endMin,
//                 batchCode,
//                 periodNo: p.periodNo,
//                 facultyName: safeTrim(p?.facultyName) || null
//               });
//             }
//           }
//         }
//       }
//     }
//     if (conflicts.length) return res.status(400).json({ status: false, message: 'Conflicts detected', conflicts });
//     return res.status(200).json({ status: true, message: 'All schedules valid' });
//   } catch (err) {
//     return next(err);
//   }
// };

const validateSchedule = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const data = Array.isArray(req.body?.data) ? req.body.data : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!data.length) return res.status(400).json({ status: false, message: 'No schedule data provided' });
    const conflicts = [];
    const proposed = [];
    const batchCache = new Map();
    const staffCache = new Map();
    const getBatch = async (batchCode) => {
      if (batchCache.has(batchCode)) return batchCache.get(batchCode);
      const b = await Batch.findOne({ tenantId, batchCode, isdeleted: false }, { staffMap: 1, batchId: 1, batchName: 1 }).lean();
      batchCache.set(batchCode, b || null);
      return b || null;
    };
    const getStaff = async (staffId) => {
      if (staffCache.has(staffId)) return staffCache.get(staffId);
      const s = await Staff.findOne({ tenantId, staffId, isdeleted: false }, { staffName: 1, staffCode: 1, subject: 1, weekoff: 1, facultyType: 1 }).lean();
      staffCache.set(staffId, s || null);
      return s || null;
    };
    const subjectCache = new Map();
    const getSubject = async (subjectId) => {
      if (subjectCache.has(subjectId)) return subjectCache.get(subjectId);
      const s = await Subject.findOne({ _id: subjectId, isdeleted: false }, { subjectName: 1, subjectCode: 1 }).lean();
      subjectCache.set(subjectId, s || null);
      return s || null;
    };
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
      const publishedTT = await TimeTable.findOne({
        tenantId,
        batchCode,
        wkStartOn: correctedMonday,
        isdeleted: false,
        status: 'Active',
        ...(timetableId ? { _id: { $ne: timetableId } } : {})
      }).lean();
      if (publishedTT) {
        conflicts.push({
          batchCode,
          week: correctedMonday,
          message: `Timetable already published for batch ${batchCode} for this week.`,
          publishedAt: publishedTT.publishedAt || null,
          publishedTimetableId: publishedTT._id
        });
        continue;
      }

      // ── Check 2: Fetch batch — must exist ─────────────────────────────────────
      const batch = await getBatch(batchCode);
      if (!batch) {
        conflicts.push({ batchCode, message: `Batch ${batchCode} not found` });
        continue;
      }
      const staffMap = Array.isArray(batch.staffMap) ? batch.staffMap : [];
      const hasBatchMap = staffMap.length > 0;

      for (const d of item.week || []) {
        const day = normDay(d?.day);

        // ── Check 3: Valid day ────────────────────────────────────────────────
        if (!isValidDay(day)) {
          conflicts.push({ batchCode, day: d?.day, message: `Invalid day: ${d?.day}` });
          continue;
        }

        const exactDate = getOffsetDate(correctedMonday, day);
        const seenPeriods = []; // for intra-day time overlap within same batch

        for (const p of d?.periods || []) {
          const periodNo = toInt(p?.periodNo, 0);
          const facultyId = safeTrim(p?.facultyId);
          const subjectId = safeTrim(p?.subjectId);
          const periodType = safeTrim(p?.periodType).toUpperCase() || 'LECTURE';
          const mode = safeTrim(p?.mode).toUpperCase() || 'OFFLINE';
          const startMin = toInt(p?.time?.startMin, -1);
          const endMin = toInt(p?.time?.endMin, -1);

          // ── Check 4: periodNo >= 1 ──────────────────────────────────────────
          if (periodNo < 1) {
            conflicts.push({ batchCode, day, periodNo: p?.periodNo, message: `periodNo must be >= 1` });
            continue;
          }

          // ── Check 5: Valid time range ───────────────────────────────────────
          if (startMin < 0 || startMin > 1439) {
            conflicts.push({ batchCode, day, periodNo, message: `Period ${periodNo}: invalid startMin (${startMin})` });
            continue;
          }
          if (endMin < 0 || endMin > 1439) {
            conflicts.push({ batchCode, day, periodNo, message: `Period ${periodNo}: invalid endMin (${endMin})` });
            continue;
          }
          if (endMin <= startMin) {
            conflicts.push({ batchCode, day, periodNo, message: `Period ${periodNo}: endMin must be > startMin` });
            continue;
          }

          // ── Check 6: facultyId required ─────────────────────────────────────
          if (!facultyId) {
            conflicts.push({ batchCode, day, periodNo, message: `Period ${periodNo}: facultyId is required` });
            continue;
          }

          // ── Check 7: Intra-batch same-day time overlap ──────────────────────
          const overlap = seenPeriods.find((sp) => startMin < sp.endMin && endMin > sp.startMin);
          if (overlap) {
            conflicts.push({
              batchCode,
              day,
              periodNo,
              message: `Period ${periodNo} overlaps with Period ${overlap.periodNo} on ${day} in the same batch (${startMin}-${endMin} vs ${overlap.startMin}-${overlap.endMin})`
            });
            continue;
          }
          seenPeriods.push({ periodNo, startMin, endMin });

          const isMassClass = mode === 'ONLINE' || periodType === 'PT' || periodType === 'YOGA';

          // ── Check 8: Staff exists ───────────────────────────────────────────
          const staff = await getStaff(facultyId);
          if (!staff) {
            conflicts.push({
              batchCode,
              day,
              periodNo,
              facultyId,
              message: `Period ${periodNo}: Staff ${facultyId} not found`
            });
            continue;
          }

          // ── Check 9: Staff must be TEACHING type ────────────────────────────
          if (safeTrim(staff.facultyType).toUpperCase() !== 'TEACHING') {
            conflicts.push({
              batchCode,
              day,
              periodNo,
              facultyId,
              facultyName: staff.staffName,
              message: `Period ${periodNo}: ${staff.staffName} is not a TEACHING staff (type: ${staff.facultyType})`
            });
            continue;
          }

          if (!isMassClass && subjectId) {
            // ── Check 10: Subject must be in batch staffMap ─────────────────────
            if (hasBatchMap) {
              const batchSubjectEntry = staffMap.find((s) => safeTrim(s.subjectId) === subjectId);

              if (!batchSubjectEntry) {
                // Fetch subject name for a clearer message
                const subjectDoc = await getSubject(subjectId);
                const subjectLabel = subjectDoc ? `"${subjectDoc.subjectName}${subjectDoc.subjectCode ? ' (' + subjectDoc.subjectCode + ')' : ''}"` : `ID: ${subjectId}`;
                conflicts.push({
                  batchCode,
                  day,
                  periodNo,
                  facultyId,
                  subjectId,
                  subjectName: subjectDoc?.subjectName || null,
                  message: `Period ${periodNo}: Subject ${subjectLabel} is not mapped to batch ${batchCode}. Add it via batch staff mapping first.`
                });
                continue;
              }
              if (safeTrim(batchSubjectEntry.staffId) !== facultyId) {
                conflicts.push({
                  batchCode,
                  day,
                  periodNo,
                  facultyId,
                  facultyName: staff.staffName,
                  subjectId,
                  subjectName: batchSubjectEntry.subjectName || null,
                  mappedStaffId: batchSubjectEntry.staffId,
                  mappedStaffName: batchSubjectEntry.staffName,
                  message: `Period ${periodNo}: ${staff.staffName} is not assigned to "${batchSubjectEntry.subjectName || subjectId}" in batch ${batchCode}. Mapped staff is ${batchSubjectEntry.staffName || batchSubjectEntry.staffId}.`
                });
                continue;
              }
            }
            const staffSubjects = Array.isArray(staff.subject) ? staff.subject : [];
            const staffTeachesSubject = staffSubjects.some((sid) => String(sid) === subjectId);
            if (!staffTeachesSubject) {
              const subjectDoc = await getSubject(subjectId);
              const subjectLabel = subjectDoc ? `"${subjectDoc.subjectName}${subjectDoc.subjectCode ? ' (' + subjectDoc.subjectCode + ')' : ''}"` : `ID: ${subjectId}`;
              conflicts.push({
                batchCode,
                day,
                periodNo,
                facultyId,
                facultyName: staff.staffName,
                subjectId,
                subjectName: subjectDoc?.subjectName || null,
                message: `Period ${periodNo}: ${staff.staffName} does not have subject ${subjectLabel} in their profile. Update staff subject mapping first.`
              });
              continue;
            }
          }
          if (!isMassClass) {
            const staffWeekoff = (staff.weekoff || []).map((w) => w.toUpperCase());
            if (staffWeekoff.includes(day)) {
              conflicts.push({
                batchCode,
                day,
                periodNo,
                facultyId,
                facultyName: staff.staffName,
                message: `Period ${periodNo}: ${staff.staffName} has a week-off on ${day}`
              });
              continue;
            }
          }
          if (!isMassClass) {
            const dbCheck = await checkStaffConflicts(tenantId, facultyId, exactDate, day, startMin, endMin, timetableId, false, periodType, mode);
            if (dbCheck.conflict) {
              conflicts.push({
                batchCode,
                day,
                periodNo,
                facultyId,
                facultyName: dbCheck.facultyName || staff.staffName || null,
                message: dbCheck.message
              });
              continue;
            }
            const intraConflict = proposed.find((pa) => pa.facultyId === facultyId && pa.exactDate === exactDate && startMin < pa.endMin && endMin > pa.startMin);
            if (intraConflict) {
              conflicts.push({
                batchCode,
                day,
                periodNo,
                facultyId,
                facultyName: staff.staffName || null,
                message: `Period ${periodNo}: ${staff.staffName || facultyId} already scheduled in batch ${intraConflict.batchCode} Period ${intraConflict.periodNo} on ${day}`
              });
              continue;
            }
            proposed.push({
              facultyId,
              exactDate,
              startMin,
              endMin,
              batchCode,
              periodNo,
              facultyName: staff.staffName || null
            });
          }
        }
        const periodNos = (d?.periods || []).map((p) => toInt(p?.periodNo, 0)).filter((n) => n >= 1);
        const seen = new Set();
        for (const n of periodNos) {
          if (seen.has(n)) {
            conflicts.push({
              batchCode,
              day,
              periodNo: n,
              message: `Duplicate periodNo ${n} on ${day} in batch ${batchCode}`
            });
          }
          seen.add(n);
        }
      }
    }
    if (conflicts.length) {
      return res.status(400).json({
        status: false,
        message: `Validation failed with ${conflicts.length} conflict(s)`,
        conflicts
      });
    }

    return res.status(200).json({
      status: true,
      message: 'All schedules valid'
    });
  } catch (err) {
    return next(err);
  }
};

const subjectHoursReport = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const phaseId = safeTrim(req.body?.phaseId) || null;
    if (!tenantId || !batchCode) return res.status(400).json({ status: false, message: 'tenantId and batchCode are required' });
    const timetables = await TimeTable.find({
      tenantId,
      batchCode,
      isdeleted: false,
      status: 'Active'
    }).lean();
    if (!timetables.length) return res.status(200).json({ status: true, data: [], count: 0, message: 'No published timetables found for this batch' });
    const subjectMins = new Map();
    const subjectMeta = new Map();
    const countSubjectPeriod = (p) => {
      if (p?.isCancelled) return;
      const sid = safeTrim(p?.subjectId);
      if (!sid) return;
      if (phaseId && safeTrim(p?.phaseId) !== phaseId) return;
      const start = toInt(p?.time?.startMin, -1);
      const end = toInt(p?.time?.endMin, -1);
      if (start < 0 || end <= start) return;
      const mins = end - start;
      subjectMins.set(sid, (subjectMins.get(sid) || 0) + mins);
      if (!subjectMeta.has(sid)) {
        subjectMeta.set(sid, {
          subjectCode: safeTrim(p?.subjectCode) || null,
          subjectName: safeTrim(p?.subjectName) || null
        });
      }
    };
    for (const tt of timetables) {
      for (const dayObj of tt.week || []) {
        for (const p of dayObj.periods || []) countSubjectPeriod(p);
      }
      for (const ov of tt.dayOverrides || []) {
        if (ov.action === 'CANCEL_DAY') continue;
        if (ov.action === 'REPLACE_DAY') {
          for (const p of ov.periods || []) countSubjectPeriod(p);
        }
      }
      const overrideMap = new Map();
      for (const ov of tt.periodOverrides || []) {
        const key = `${ov.date}_${normDay(ov.day)}_${ov.periodNo}`;
        overrideMap.set(key, ov);
      }
      for (const ov of overrideMap.values()) {
        if (ov.action === 'CANCEL_PERIOD') {
          const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
          const basePeriod = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
          if (basePeriod && !basePeriod?.isCancelled) {
            const sid = safeTrim(basePeriod?.subjectId);
            const start = toInt(basePeriod?.time?.startMin, -1);
            const end = toInt(basePeriod?.time?.endMin, -1);
            if (sid && start >= 0 && end > start) {
              if (!phaseId || safeTrim(basePeriod?.phaseId) === phaseId) {
                subjectMins.set(sid, Math.max(0, (subjectMins.get(sid) || 0) - (end - start)));
              }
            }
          }
        } else if (ov.action === 'REPLACE_PERIOD' && ov.period) {
          const dayObj = (tt.week || []).find((d) => normDay(d.day) === normDay(ov.day));
          const basePeriod = (dayObj?.periods || []).find((p) => toInt(p?.periodNo) === toInt(ov.periodNo));
          if (basePeriod && !basePeriod?.isCancelled) {
            const sid = safeTrim(basePeriod?.subjectId);
            const start = toInt(basePeriod?.time?.startMin, -1);
            const end = toInt(basePeriod?.time?.endMin, -1);
            if (sid && start >= 0 && end > start) {
              if (!phaseId || safeTrim(basePeriod?.phaseId) === phaseId) {
                subjectMins.set(sid, Math.max(0, (subjectMins.get(sid) || 0) - (end - start)));
              }
            }
          }
          countSubjectPeriod({ ...ov.period, periodNo: ov.periodNo });
        } else if (ov.action === 'ADD_PERIOD' && ov.period) {
          countSubjectPeriod({ ...ov.period, periodNo: ov.periodNo });
        }
      }
    }
    const toHours = (mins) => Math.round((mins / 60) * 100) / 100;
    const data = Array.from(subjectMins.entries())
      .map(([sid, mins]) => {
        const meta = subjectMeta.get(sid) || {};
        return {
          subjectId: sid,
          subjectCode: meta.subjectCode || null,
          subjectName: meta.subjectName || null,
          allottedHours: toHours(mins)
        };
      })
      .sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || ''));
    const totalAllottedHours = toHours(Array.from(subjectMins.values()).reduce((s, m) => s + m, 0));
    return res.status(200).json({
      status: true,
      data,
      count: data.length,
      summary: { totalAllottedHours }
    });
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
  addPeriod,
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
  validateSchedule,
  listTimeTables,
  viewTimeTable,
  listTimeTablesByBatch,
  subjectHoursReport
};

import Invigilation from '../models/invigilation.model.js';
import Staff from '../models/staff.model.js';
import { notifyStaff } from '../helpers/pushNotification.helper.js';
import logger from '../helpers/logger.js';

const pickTid = (req) => req.body?.entiId || req.query?.entiId || null;
const safeTrim = (v) => (typeof v === 'string' ? v.trim() : String(v ?? '').trim());

// const dateStrToEpoch = (str) => {
//   if (!str) return null;
//   const d = new Date(str);
//   return isNaN(d.getTime()) ? null : new Date(str).setHours(0, 0, 0, 0);
// };

const dateStrToEpoch = (str) => {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const formatDate = (epoch) => {
  if (!epoch) return '';
  return new Date(epoch).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatDay = (epoch) => {
  if (!epoch) return '';
  return new Date(epoch).toLocaleDateString('en-IN', { weekday: 'long' });
};

const resolveStaffCodes = async (tenantId, codes) => {
  const unique = [...new Set(codes.filter(Boolean).map((c) => c.toUpperCase()))];
  if (!unique.length) return {};
  const list = await Staff.find({ tenantId, staffCode: { $in: unique }, isdeleted: false }, { _id: 1, staffCode: 1, staffName: 1 }).lean();
  const map = {};
  for (const s of list) map[s.staffCode.toUpperCase()] = { staffId: s._id, staffName: s.staffName };
  return map;
};

const createInvigilation = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'entiId is required' });
    const { entiId, examName, examDate, session, examStartTime, examEndTime, slot1StartTime, slot1EndTime, slot2StartTime, slot2EndTime, rooms = [] } = req.body;
    if (!examName?.trim()) return res.status(400).json({ status: false, message: 'examName is required' });
    if (!examDate) return res.status(400).json({ status: false, message: 'examDate is required' });
    if (!session) return res.status(400).json({ status: false, message: 'session is required' });
    if (!rooms.length) return res.status(400).json({ status: false, message: 'At least one room is required' });
    const epochDate = typeof examDate === 'number' ? examDate : dateStrToEpoch(examDate);
    if (!epochDate) return res.status(400).json({ status: false, message: 'Invalid examDate' });
    const exists = await Invigilation.findOne({
      tenantId,
      isdeleted: false,
      examName: examName.trim(),
      examDate: epochDate,
      session
    });
    if (exists) {
      return res.status(409).json({
        status: false,
        message: `Invigilation for "${examName.trim()}" on this date and session already exists`
      });
    }
    const allCodes = rooms.flatMap((r) => [safeTrim(r.slot1StaffCode || '').toUpperCase(), safeTrim(r.slot2StaffCode || '').toUpperCase()]).filter(Boolean);
    const staffMap = await resolveStaffCodes(tenantId, allCodes);
    const resolvedRooms = rooms.map((r) => {
      const s1Code = safeTrim(r.slot1StaffCode || '').toUpperCase();
      const s2Code = safeTrim(r.slot2StaffCode || '').toUpperCase();
      const s1 = staffMap[s1Code] || {};
      const s2 = staffMap[s2Code] || {};
      return {
        roomNo: safeTrim(r.roomNo),
        slot1StaffCode: s1Code || null,
        slot1StaffId: s1.staffId || null,
        slot1StaffName: s1.staffName || null,
        slot2StaffCode: s2Code || null,
        slot2StaffId: s2.staffId || null,
        slot2StaffName: s2.staffName || null
      };
    });
    const record = await Invigilation.create({
      entiId,
      tenantId,
      examName: examName.trim(),
      examDate: epochDate,
      session,
      examStartTime: examStartTime || null,
      examEndTime: examEndTime || null,
      slot1StartTime: slot1StartTime || null,
      slot1EndTime: slot1EndTime || null,
      slot2StartTime: slot2StartTime || null,
      slot2EndTime: slot2EndTime || null,
      rooms: resolvedRooms
    });
    // Fire-and-forget push notification to assigned invigilators
    (async () => {
      try {
        // slot1StaffId and slot2StaffId are Staff ObjectIds — resolve to staffId UUIDs
        const assignedObjectIds = resolvedRooms.flatMap((r) => [r.slot1StaffId, r.slot2StaffId]).filter(Boolean);
        if (assignedObjectIds.length) {
          const staffDocs = await Staff.find({ _id: { $in: assignedObjectIds }, isdeleted: false }, { staffId: 1 }).lean();
          const staffIds = staffDocs.map((s) => s.staffId).filter(Boolean);
          await notifyStaff({
            tenantId,
            staffIds,
            title: 'Invigilation Assigned',
            body: `You have been assigned as invigilator for ${examName.trim()} on ${formatDate(epochDate)}`,
            data: { type: 'INVIGILATION', invigilationId: String(record._id) }
          });
        }
      } catch (e) {
        logger.error('[Invigilation] push notification failed:', e?.message);
      }
    })();
    return res.status(201).json({ status: true, message: 'Invigilation created', data: record });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate invigilation entry' });
    return next(err);
  }
};

const listInvigilation = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'entiId is required' });
    const { fromDate, toDate, session, examName, page = 1, limit = 50 } = req.body;
    const query = { tenantId, isdeleted: false };
    if (fromDate || toDate) {
      query.examDate = {};
      if (fromDate) query.examDate.$gte = Number(fromDate);
      if (toDate) query.examDate.$lte = Number(toDate);
    }
    if (session) query.session = session;
    if (examName) query.examName = { $regex: examName.trim(), $options: 'i' };
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Invigilation.countDocuments(query);
    const data = await Invigilation.find(query).sort({ examDate: -1, session: 1 }).skip(skip).limit(Number(limit)).lean();
    return res.status(200).json({
      status: true,
      total,
      count: data.length,
      data: data.map((d) => ({
        ...d,
        examDateFormatted: formatDate(d.examDate),
        examDay: formatDay(d.examDate),
        roomCount: (d.rooms || []).length
      }))
    });
  } catch (err) {
    return next(err);
  }
};

const getInvigilation = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const { id } = req.params;
    const record = await Invigilation.findOne({ _id: id, tenantId, isdeleted: false }).lean();
    if (!record) return res.status(404).json({ status: false, message: 'Not found' });
    return res.status(200).json({
      status: true,
      data: { ...record, examDateFormatted: formatDate(record.examDate), examDay: formatDay(record.examDate) }
    });
  } catch (err) {
    return next(err);
  }
};

const getByDate = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const { date } = req.params;
    const epoch = isNaN(Number(date)) ? dateStrToEpoch(date) : Number(date);
    if (!epoch) return res.status(400).json({ status: false, message: 'Invalid date' });
    // const startOfDay = new Date(epoch).setHours(0, 0, 0, 0);
    // const endOfDay = new Date(epoch).setHours(23, 59, 59, 999);
    // const records = await Invigilation.find({
    //   tenantId,
    //   isdeleted: false,
    //   examDate: { $gte: startOfDay, $lte: endOfDay }
    // }).lean();
    const d = new Date(epoch);
    const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const records = await Invigilation.find({
      tenantId,
      isdeleted: false,
      examDate: utcMidnight
    }).lean();
    if (!records.length) return res.status(404).json({ status: false, message: 'No records for this date' });
    const order = { MORNING: 1, AFTERNOON: 2, EVENING: 3 };
    records.sort((a, b) => (order[a.session] || 9) - (order[b.session] || 9));
    return res.status(200).json({
      status: true,
      date: epoch,
      dateFormatted: formatDate(epoch),
      day: formatDay(epoch),
      sessions: records.map((d) => ({ ...d, examDateFormatted: formatDate(d.examDate), examDay: formatDay(d.examDate) }))
    });
  } catch (err) {
    return next(err);
  }
};

const updateInvigilation = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const { id } = req.params;
    const record = await Invigilation.findOne({ _id: id, tenantId, isdeleted: false });
    if (!record) return res.status(404).json({ status: false, message: 'Not found' });
    const { examName, examDate, session, examStartTime, examEndTime, slot1StartTime, slot1EndTime, slot2StartTime, slot2EndTime, rooms } = req.body;
    const newName = examName?.trim() || record.examName;
    const newEpoch = examDate ? (typeof examDate === 'number' ? examDate : dateStrToEpoch(examDate)) : record.examDate;
    const newSession = session || record.session;
    const conflict = await Invigilation.findOne({
      tenantId,
      isdeleted: false,
      examName: newName,
      examDate: newEpoch,
      session: newSession,
      _id: { $ne: record._id }
    });
    if (conflict) return res.status(409).json({ status: false, message: 'Duplicate invigilation entry' });
    record.examName = newName;
    record.examDate = newEpoch;
    record.session = newSession;
    if (examStartTime !== undefined) record.examStartTime = examStartTime || null;
    if (examEndTime !== undefined) record.examEndTime = examEndTime || null;
    if (slot1StartTime !== undefined) record.slot1StartTime = slot1StartTime || null;
    if (slot1EndTime !== undefined) record.slot1EndTime = slot1EndTime || null;
    if (slot2StartTime !== undefined) record.slot2StartTime = slot2StartTime || null;
    if (slot2EndTime !== undefined) record.slot2EndTime = slot2EndTime || null;
    if (Array.isArray(rooms) && rooms.length) {
      const allCodes = rooms.flatMap((r) => [safeTrim(r.slot1StaffCode || '').toUpperCase(), safeTrim(r.slot2StaffCode || '').toUpperCase()]).filter(Boolean);
      const staffMap = await resolveStaffCodes(tenantId, allCodes);
      record.rooms = rooms.map((r) => {
        const s1Code = safeTrim(r.slot1StaffCode || '').toUpperCase();
        const s2Code = safeTrim(r.slot2StaffCode || '').toUpperCase();
        const s1 = staffMap[s1Code] || {};
        const s2 = staffMap[s2Code] || {};
        return {
          roomNo: safeTrim(r.roomNo),
          slot1StaffCode: s1Code || null,
          slot1StaffId: s1.staffId || null,
          slot1StaffName: s1.staffName || null,
          slot2StaffCode: s2Code || null,
          slot2StaffId: s2.staffId || null,
          slot2StaffName: s2.staffName || null
        };
      });
    }
    await record.save();
    return res.status(200).json({ status: true, message: 'Updated', data: record });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate entry' });
    return next(err);
  }
};

const deleteInvigilation = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const { id } = req.params;
    const record = await Invigilation.findOne({ _id: id, tenantId, isdeleted: false });
    if (!record) return res.status(404).json({ status: false, message: 'Not found' });
    record.isdeleted = true;
    await record.save();
    return res.status(200).json({ status: true, message: 'Deleted' });
  } catch (err) {
    return next(err);
  }
};

const listUpcoming = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'entiId is required' });
    const { staffId } = req.body;
    let staffDoc = null;
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const query = { tenantId, isdeleted: false, examDate: { $gte: todayUtc } };
    if (staffId) {
      staffDoc = await Staff.findOne({ tenantId, staffId, isdeleted: false }, { _id: 1 }).lean();
      if (!staffDoc) return res.status(404).json({ status: false, message: 'Staff not found' });
      query.$or = [{ 'rooms.slot1StaffId': staffDoc._id }, { 'rooms.slot2StaffId': staffDoc._id }];
    }
    const records = await Invigilation.find(query).sort({ examDate: 1, session: 1 }).lean();
    const data = records.map((rec) => {
      const base = {
        _id: rec._id,
        examName: rec.examName,
        examDate: rec.examDate,
        examDateFormatted: formatDate(rec.examDate),
        examDay: formatDay(rec.examDate),
        session: rec.session,
        examStartTime: rec.examStartTime,
        examEndTime: rec.examEndTime,
        slot1StartTime: rec.slot1StartTime,
        slot1EndTime: rec.slot1EndTime,
        slot2StartTime: rec.slot2StartTime,
        slot2EndTime: rec.slot2EndTime,
        roomCount: rec.rooms.length
      };
      if (staffId && staffDoc) {
        base.assignedRooms = rec.rooms
          .filter((r) => String(r.slot1StaffId) === String(staffDoc._id) || String(r.slot2StaffId) === String(staffDoc._id))
          .map((r) => {
            const isSlot1 = String(r.slot1StaffId) === String(staffDoc._id);
            return {
              roomNo: r.roomNo,
              slot: isSlot1 ? 'SLOT1' : 'SLOT2',
              slotStartTime: isSlot1 ? rec.slot1StartTime : rec.slot2StartTime,
              slotEndTime: isSlot1 ? rec.slot1EndTime : rec.slot2EndTime
            };
          });
      } else {
        base.rooms = rec.rooms;
      }
      return base;
    });
    return res.status(200).json({ status: true, count: data.length, data });
  } catch (err) {
    return next(err);
  }
};

export default { createInvigilation, listInvigilation, getInvigilation, getByDate, updateInvigilation, deleteInvigilation, listUpcoming };

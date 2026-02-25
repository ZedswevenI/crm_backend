import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import constants from '../helpers/constants.js';
import Phase from '../models/phaseplan.model.js';
import Topic from '../models/topic.model.js';
import Activity from '../models/activity.model.js';

const parseDateToEpoch = (dateString) => {
  if (!dateString) return null;
  const parsed = new Date(dateString).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const createPhase = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { phaseName, classNo, subjectId, sortOrder, topics } = req.body;
    if (!tenantId || !phaseName || !classNo || !subjectId) {
      return res.status(400).json({ status: false, message: 'Missing required fields' });
    }
    const inputTopics = Array.isArray(topics) ? topics : [];
    const incomingTopicIds = inputTopics.map((t) => safeTrim(t.topicId)).filter(Boolean);
    if (incomingTopicIds.length > 0) {
      const conflictPhase = await Phase.findOne({
        tenantId,
        classNo: toInt(classNo),
        subjectId,
        isdeleted: false,
        'topics.topicId': { $in: incomingTopicIds }
      }).lean();

      if (conflictPhase) {
        return res.status(400).json({
          status: false,
          message: `One or more topics are already assigned to '${conflictPhase.phaseName}'. Topics cannot overlap.`
        });
      }
    }
    const sortedTopics = inputTopics
      .map((t, idx) => ({
        topicId: safeTrim(t.topicId),
        topicName: safeTrim(t.topicName),
        estHours: toInt(t.estHours, null),
        sortOrder: toInt(t.sortOrder, idx + 1)
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const doc = await Phase.create({
      tenantId,
      phaseName: safeTrim(phaseName),
      classNo: toInt(classNo),
      subjectId,
      sortOrder: toInt(sortOrder, 1),
      topics: sortedTopics,
      createdBy: userId,
      updatedBy: userId
    });
    return res.status(201).json({ status: true, message: 'Phase created successfully', data: doc });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ status: false, message: 'Phase name already exists for this class and subject' });
    return next(err);
  }
};

const updatePhase = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { phaseId, phaseName, sortOrder, topics } = req.body;
    if (!tenantId || !phaseId) return res.status(400).json({ status: false, message: 'tenantId and phaseId are required' });
    const existingPhase = await Phase.findOne({ tenantId, phaseId, isdeleted: false });
    if (!existingPhase) return res.status(404).json({ status: false, message: 'Phase not found' });
    const inputTopics = Array.isArray(topics) ? topics : [];
    const incomingTopicIds = inputTopics.map((t) => safeTrim(t.topicId)).filter(Boolean);
    if (incomingTopicIds.length > 0) {
      const conflictPhase = await Phase.findOne({
        tenantId,
        classNo: existingPhase.classNo,
        subjectId: existingPhase.subjectId,
        phaseId: { $ne: phaseId },
        isdeleted: false,
        'topics.topicId': { $in: incomingTopicIds }
      }).lean();
      if (conflictPhase) {
        return res.status(400).json({
          status: false,
          message: `Topic overlap detected. A topic is already assigned to '${conflictPhase.phaseName}'.`
        });
      }
    }
    const sortedTopics = inputTopics
      .map((t, idx) => ({
        topicId: safeTrim(t.topicId),
        topicName: safeTrim(t.topicName),
        estHours: toInt(t.estHours, null),
        sortOrder: toInt(t.sortOrder, idx + 1)
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    existingPhase.phaseName = phaseName ? safeTrim(phaseName) : existingPhase.phaseName;
    existingPhase.sortOrder = sortOrder !== undefined ? toInt(sortOrder, existingPhase.sortOrder) : existingPhase.sortOrder;
    existingPhase.topics = sortedTopics;
    existingPhase.updatedBy = userId;
    await existingPhase.save();
    return res.status(200).json({ status: true, message: 'Phase updated successfully', data: existingPhase });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ status: false, message: 'Phase name already exists for this class and subject' });
    return next(err);
  }
};

const listPhases = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const classNo = safeTrim(req.query.classNo || req.body?.classNo);
    const subjectId = safeTrim(req.query.subjectId || req.body?.subjectId);
    if (!tenantId || !classNo || !subjectId) {
      return res.status(400).json({ status: false, message: 'tenantId, classNo, and subjectId are required' });
    }
    const phases = await Phase.find({
      tenantId,
      classNo: toInt(classNo),
      subjectId,
      isdeleted: false
    })
      .sort({ sortOrder: 1, phaseName: 1 })
      .populate('subjectId', 'subjectName subjectCode')
      .lean();
    return res.status(200).json({ status: true, data: phases, count: phases.length });
  } catch (err) {
    return next(err);
  }
};

const deletePhase = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const phaseId = safeTrim(req.body?.phaseId);
    if (!tenantId || !phaseId) return res.status(400).json({ status: false, message: 'tenantId and phaseId required' });
    await Phase.findOneAndUpdate({ tenantId, phaseId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: req.body.userId } });
    return res.status(200).json({ status: true, message: 'Phase deleted' });
  } catch (err) {
    return next(err);
  }
};

const getAvailableTopics = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { classNo, subjectId, editingPhaseId } = req.body;
    if (!tenantId || !classNo || !subjectId) return res.status(400).json({ status: false, message: 'Missing fields' });
    const phaseQuery = { tenantId, classNo: toInt(classNo), subjectId, isdeleted: false };
    if (editingPhaseId) phaseQuery.phaseId = { $ne: safeTrim(editingPhaseId) };
    const existingPhases = await Phase.find(phaseQuery, { 'topics.topicId': 1 }).lean();
    const usedTopicIds = [];
    existingPhases.forEach((p) => p.topics.forEach((t) => usedTopicIds.push(t.topicId)));
    const availableTopics = await Topic.find({
      tenantId,
      classNo: toInt(classNo),
      subjectId,
      isdeleted: false,
      topicId: { $nin: usedTopicIds }
    })
      .sort({ sortOrder: 1, topicName: 1 })
      .lean();
    return res.status(200).json({ status: true, data: availableTopics, count: availableTopics.length });
  } catch (err) {
    return next(err);
  }
};

const bulkUploadPhases = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const rows = req.body?.rows;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ status: false, message: 'rows array is required and cannot be empty' });
    }
    const grouped = {};
    for (const r of rows) {
      const pName = safeTrim(r.phaseName);
      const cNo = toInt(r.classNo);
      const sId = safeTrim(r.subjectId);
      if (!pName || !cNo || !sId) continue;
      const key = `${cNo}_${sId}_${pName.toLowerCase()}`;
      if (!grouped[key]) {
        grouped[key] = {
          phaseName: pName,
          classNo: cNo,
          subjectId: sId,
          sortOrder: toInt(r.phaseSortOrder || r.sortOrder, 1),
          topics: Array.isArray(r.topics) ? r.topics : []
        };
      }
      if (!Array.isArray(r.topics) && safeTrim(r.topicId)) {
        grouped[key].topics.push({
          topicId: safeTrim(r.topicId),
          topicName: safeTrim(r.topicName),
          estHours: toInt(r.estHours, null),
          sortOrder: toInt(r.topicSortOrder, grouped[key].topics.length + 1)
        });
      }
    }
    const phasesToProcess = Object.values(grouped);
    const report = { successCount: 0, failedCount: 0, errors: [] };
    for (const phaseData of phasesToProcess) {
      try {
        const inputTopics = phaseData.topics;
        const incomingTopicIds = inputTopics.map((t) => safeTrim(t.topicId)).filter(Boolean);
        const existingPhase = await Phase.findOne({
          tenantId,
          classNo: phaseData.classNo,
          subjectId: phaseData.subjectId,
          phaseName: phaseData.phaseName,
          isdeleted: false
        }).lean();
        if (incomingTopicIds.length > 0) {
          const conflictQuery = {
            tenantId,
            classNo: phaseData.classNo,
            subjectId: phaseData.subjectId,
            isdeleted: false,
            'topics.topicId': { $in: incomingTopicIds }
          };
          if (existingPhase) conflictQuery.phaseId = { $ne: existingPhase.phaseId };
          const conflictPhase = await Phase.findOne(conflictQuery).lean();
          if (conflictPhase) {
            throw new Error(`Topic overlap detected with an existing phase: '${conflictPhase.phaseName}'`);
          }
        }
        const sortedTopics = inputTopics
          .map((t, idx) => ({
            topicId: safeTrim(t.topicId),
            topicName: safeTrim(t.topicName),
            estHours: toInt(t.estHours, null),
            sortOrder: toInt(t.sortOrder, idx + 1)
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);

        if (existingPhase) {
          await Phase.findOneAndUpdate(
            { tenantId, phaseId: existingPhase.phaseId, isdeleted: false },
            {
              $set: {
                sortOrder: phaseData.sortOrder,
                topics: sortedTopics,
                updatedBy: userId
              }
            }
          );
        } else {
          await Phase.create({
            tenantId,
            phaseName: phaseData.phaseName,
            classNo: phaseData.classNo,
            subjectId: phaseData.subjectId,
            sortOrder: phaseData.sortOrder,
            topics: sortedTopics,
            createdBy: userId,
            updatedBy: userId
          });
        }
        report.successCount++;
      } catch (err) {
        report.failedCount++;
        report.errors.push({ phaseName: phaseData.phaseName, reason: err.message });
      }
    }
    return res.status(200).json({
      status: true,
      message: `Bulk upload completed. Success: ${report.successCount}, Failed: ${report.failedCount}`,
      data: report
    });
  } catch (error) {
    return next(error);
  }
};

const createActivity = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { batchCode, centerCode, activityName, sno, startDate, endDate, remarks, status } = req.body;
    if (!tenantId || !batchCode || !activityName || !startDate || !endDate) {
      return res.status(400).json({ status: false, message: 'Missing required fields' });
    }
    const newActivity = await Activity.create({
      tenantId,
      activityId: uuid(),
      batchCode: safeTrim(batchCode),
      centerCode: safeTrim(centerCode),
      activityName: safeTrim(activityName),
      sno: sno ? Number(sno) : null,
      startDate: Number(startDate),
      endDate: Number(endDate),
      remarks: safeTrim(remarks),
      status: status || 'PLANNED',
      createdBy: userId,
      updatedBy: userId
    });
    return res.status(201).json({ status: true, message: 'Activity created successfully', data: newActivity });
  } catch (err) {
    return next(err);
  }
};

const editActivity = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const activityId = safeTrim(req.body?.activityId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !activityId) return res.status(400).json({ status: false, message: 'tenantId and activityId required' });
    const updateData = { updatedBy: userId };
    const fields = ['activityName', 'batchCode', 'centerCode', 'remarks', 'status'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) updateData[f] = safeTrim(req.body[f]);
    });
    if (req.body.sno !== undefined) updateData.sno = Number(req.body.sno);
    if (req.body.startDate !== undefined) updateData.startDate = Number(req.body.startDate);
    if (req.body.endDate !== undefined) updateData.endDate = Number(req.body.endDate);
    if (req.body.actualStartDate !== undefined) updateData.actualStartDate = req.body.actualStartDate ? Number(req.body.actualStartDate) : null;
    if (req.body.actualEndDate !== undefined) updateData.actualEndDate = req.body.actualEndDate ? Number(req.body.actualEndDate) : null;
    const updated = await Activity.findOneAndUpdate({ tenantId, activityId, isdeleted: false }, { $set: updateData }, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Activity not found' });
    return res.status(200).json({ status: true, message: 'Activity updated', data: updated });
  } catch (err) {
    return next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const activityId = safeTrim(req.body?.activityId);
    const status = safeTrim(req.body?.status);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !activityId || !status) return res.status(400).json({ status: false, message: 'Missing required fields' });
    const validStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    const updated = await Activity.findOneAndUpdate({ tenantId, activityId, isdeleted: false }, { $set: { status, updatedBy: userId } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Activity not found' });
    return res.status(200).json({ status: true, message: `Activity status updated to ${status}`, data: updated });
  } catch (err) {
    return next(err);
  }
};

const viewActivity = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const activityId = safeTrim(req.body?.activityId || req.query?.activityId);
    if (!tenantId || !activityId) return res.status(400).json({ status: false, message: 'tenantId and activityId required' });
    const activity = await Activity.findOne({ tenantId, activityId, isdeleted: false }).lean();
    if (!activity) return res.status(404).json({ status: false, message: 'Activity not found' });
    return res.status(200).json({ status: true, message: 'Activity retrieved', data: activity });
  } catch (err) {
    return next(err);
  }
};

const deleteActivity = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const activityId = safeTrim(req.body?.activityId);
    if (!tenantId || !activityId) return res.status(400).json({ status: false, message: 'tenantId and activityId required' });
    const deleted = await Activity.findOneAndUpdate({ tenantId, activityId, isdeleted: false }, { $set: { isdeleted: true, status: 'CANCELLED', updatedBy: req.body.userId } }, { new: true }).lean();
    if (!deleted) return res.status(404).json({ status: false, message: 'Activity not found' });
    return res.status(200).json({ status: true, message: 'Activity deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

const listActivities = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || 'startDate';
    const search = req.query.search || '';
    const batchCode = req.query.batchCode;
    const centerCode = req.query.centerCode;
    const status = req.query.status;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const query = { tenantId, isdeleted: false };
    if (batchCode) query.batchCode = safeTrim(batchCode);
    if (centerCode) query.centerCode = safeTrim(centerCode);
    if (status) query.status = safeTrim(status);
    if (fromDate || toDate) {
      query.startDate = {};
      if (fromDate) query.startDate.$gte = Number(fromDate);
      if (toDate) query.startDate.$lte = Number(toDate);
    }
    if (search) {
      const rx = { $regex: safeTrim(search), $options: 'i' };
      query.$or = [{ activityName: rx }, { remarks: rx }];
    }
    const listMode = String(req.query.list || req.body.list || '').toLowerCase();
    if (listMode === 'full') {
      const rows = await Activity.find(query).sort(sort).lean();
      return res.status(constants.HTTPS_SUCCESS).send({ status: true, data: rows, count: rows.length, message: 'Activities retrieved' });
    }
    const [rows, count] = await Promise.all([Activity.find(query).sort(sort).skip(skip).limit(limit).lean(), Activity.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: rows,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0,
      message: 'Activities retrieved'
    });
  } catch (err) {
    next(err);
  }
};

const bulkUploadActivities = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const rows = req.body?.rows;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ status: false, message: 'rows array is required and cannot be empty' });
    }
    const report = { successCount: 0, failedCount: 0, errors: [] };
    const bulkOps = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const bCode = safeTrim(r.BatchCode);
      const actName = safeTrim(r.Activity);
      const startMs = parseDateToEpoch(r.StartDate);
      const endMs = parseDateToEpoch(r.EndDate);
      if (!bCode || !actName || !startMs || !endMs) {
        report.failedCount++;
        report.errors.push({ row: i + 1, BatchCode: bCode, reason: 'Missing mandatory fields (BatchCode, Activity, StartDate, EndDate)' });
        continue;
      }
      bulkOps.push({
        updateOne: {
          filter: {
            tenantId,
            batchCode: bCode,
            activityName: actName,
            startDate: startMs,
            isdeleted: false
          },
          update: {
            $setOnInsert: {
              activityId: uuid(),
              createdBy: userId
            },
            $set: {
              centerCode: safeTrim(r.CentCode) || null,
              sno: r.sno ? Number(r.sno) : null,
              endDate: endMs,
              remarks: safeTrim(r.Remarks) !== 'NULL' ? safeTrim(r.Remarks) : null,
              actualStartDate: parseDateToEpoch(r.ActualStartDate),
              actualEndDate: parseDateToEpoch(r.ActualEndDate),
              updatedBy: userId
            }
          },
          upsert: true
        }
      });
      report.successCount++;
    }
    if (bulkOps.length > 0) {
      await Activity.bulkWrite(bulkOps, { ordered: false });
    }
    return res.status(200).json({
      status: true,
      message: `Bulk upload processed. Success: ${report.successCount}, Failed: ${report.failedCount}`,
      data: report
    });
  } catch (err) {
    return next(err);
  }
};

export default { createPhase, updatePhase, listPhases, deletePhase, getAvailableTopics, bulkUploadPhases, createActivity, editActivity, changeStatus, viewActivity, deleteActivity, listActivities, bulkUploadActivities };

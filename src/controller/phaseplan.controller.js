import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import Phase from '../models/phaseplan.model.js';
import Topic from '../models/topic.model.js';

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

export default { createPhase, updatePhase, listPhases, deletePhase, getAvailableTopics, bulkUploadPhases };

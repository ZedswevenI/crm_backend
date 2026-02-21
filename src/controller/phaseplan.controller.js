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

export default { createPhase, updatePhase, listPhases, deletePhase, getAvailableTopics };

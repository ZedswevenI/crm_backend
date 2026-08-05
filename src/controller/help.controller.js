import Help from '../models/help.model.js';

const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const createHelp = async (req, res, next) => {
  try {
    const moduleName = safeTrim(req.body?.moduleName);
    const topic = safeTrim(req.body?.topic);
    const videoLink = safeTrim(req.body?.videoLink);
    const description = safeTrim(req.body?.description) || null;
    const userId = safeTrim(req.body?.userId) || null;
    if (!moduleName || !topic || !videoLink) {
      return res.status(400).json({ status: false, message: 'moduleName, topic and videoLink are required' });
    }
    let moduleSortOrder = req.body?.moduleSortOrder !== undefined ? toNum(req.body.moduleSortOrder) : null;
    if (moduleSortOrder === null) {
      const existing = await Help.findOne({ moduleName, isdeleted: false }, { moduleSortOrder: 1 }).lean();
      moduleSortOrder = existing ? existing.moduleSortOrder : 0;
    }
    const sortOrder = req.body?.sortOrder !== undefined ? toNum(req.body.sortOrder) : 0;
    const doc = await Help.create({
      moduleName,
      moduleSortOrder,
      topic,
      description,
      videoLink,
      sortOrder,
      status: safeTrim(req.body?.status) || 'active',
      createdBy: userId,
      updatedBy: userId
    });
    return res.status(200).json({ status: true, message: 'Help entry created', data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateHelp = async (req, res, next) => {
  try {
    const helpId = safeTrim(req.body?.helpId);
    if (!helpId) return res.status(400).json({ status: false, message: 'helpId is required' });
    const userId = safeTrim(req.body?.userId) || null;
    const update = { updatedBy: userId };
    if (req.body?.moduleName !== undefined) update.moduleName = safeTrim(req.body.moduleName);
    if (req.body?.topic !== undefined) update.topic = safeTrim(req.body.topic);
    if (req.body?.description !== undefined) update.description = safeTrim(req.body.description) || null;
    if (req.body?.videoLink !== undefined) update.videoLink = safeTrim(req.body.videoLink);
    if (req.body?.sortOrder !== undefined) update.sortOrder = toNum(req.body.sortOrder);
    if (req.body?.moduleSortOrder !== undefined) update.moduleSortOrder = toNum(req.body.moduleSortOrder);
    if (req.body?.status !== undefined) update.status = safeTrim(req.body.status);
    const doc = await Help.findOneAndUpdate({ helpId, isdeleted: false }, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ status: false, message: 'Help entry not found' });
    return res.status(200).json({ status: true, message: 'Help entry updated', data: doc });
  } catch (err) {
    return next(err);
  }
};

const deleteHelp = async (req, res, next) => {
  try {
    const helpId = safeTrim(req.body?.helpId);
    if (!helpId) return res.status(400).json({ status: false, message: 'helpId is required' });
    const userId = safeTrim(req.body?.userId) || null;
    const doc = await Help.findOneAndUpdate({ helpId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId } }, { new: true });
    if (!doc) return res.status(404).json({ status: false, message: 'Help entry not found' });
    return res.status(200).json({ status: true, message: 'Help entry deleted' });
  } catch (err) {
    return next(err);
  }
};

const viewHelp = async (req, res, next) => {
  try {
    const helpId = safeTrim(req.body?.helpId);
    if (!helpId) return res.status(400).json({ status: false, message: 'helpId is required' });
    const doc = await Help.findOne({ helpId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Help entry not found' });
    return res.status(200).json({ status: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

const listHelp = async (req, res, next) => {
  try {
    const q = { ...req.body, ...req.query };
    const moduleName = safeTrim(q.moduleName);
    const status = safeTrim(q.status);
    const search = safeTrim(q.search);
    const page = Math.max(parseInt(q.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 200);
    const skip = (page - 1) * limit;
    const query = { isdeleted: false };
    if (moduleName) query.moduleName = moduleName;
    if (status) query.status = status;
    if (search) {
      query.$or = [{ topic: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }, { moduleName: { $regex: search, $options: 'i' } }];
    }
    const sort = { moduleSortOrder: 1, sortOrder: 1, createdAt: 1 };
    const listFull = safeTrim(q.list).toLowerCase() === 'full';
    if (listFull) {
      const rows = await Help.find(query).sort(sort).lean();
      return res.status(200).json({ status: true, data: { rows, total: rows.length, page: 1, limit: rows.length, pages: 1 } });
    }
    const [rows, total] = await Promise.all([Help.find(query).sort(sort).skip(skip).limit(limit).lean(), Help.countDocuments(query)]);
    return res.status(200).json({ status: true, data: { rows, page, limit, total, pages: Math.ceil(total / limit) || 0 } });
  } catch (err) {
    return next(err);
  }
};

const listModules = async (req, res, next) => {
  try {
    const rows = await Help.aggregate([
      { $match: { isdeleted: false, status: 'active' } },
      {
        $group: {
          _id: '$moduleName',
          moduleSortOrder: { $first: '$moduleSortOrder' },
          topicCount: { $sum: 1 }
        }
      },
      { $project: { _id: 0, moduleName: '$_id', moduleSortOrder: 1, topicCount: 1 } },
      { $sort: { moduleSortOrder: 1, moduleName: 1 } }
    ]);
    return res.status(200).json({ status: true, data: rows, count: rows.length });
  } catch (err) {
    return next(err);
  }
};

const updateModuleSortOrder = async (req, res, next) => {
  try {
    const moduleName = safeTrim(req.body?.moduleName);
    const moduleSortOrder = req.body?.moduleSortOrder;
    if (!moduleName || moduleSortOrder === undefined) {
      return res.status(400).json({ status: false, message: 'moduleName and moduleSortOrder are required' });
    }
    const userId = safeTrim(req.body?.userId) || null;
    const result = await Help.updateMany({ moduleName, isdeleted: false }, { $set: { moduleSortOrder: toNum(moduleSortOrder), updatedBy: userId } });
    return res.status(200).json({ status: true, message: 'Module sort order updated', modifiedCount: result.modifiedCount });
  } catch (err) {
    return next(err);
  }
};

const updateTopicSortOrder = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ status: false, message: 'items[] ({helpId, sortOrder}) is required' });
    const userId = safeTrim(req.body?.userId) || null;
    const ops = items
      .map((it) => ({ helpId: safeTrim(it?.helpId), sortOrder: it?.sortOrder }))
      .filter((it) => it.helpId && it.sortOrder !== undefined)
      .map((it) => ({
        updateOne: {
          filter: { helpId: it.helpId, isdeleted: false },
          update: { $set: { sortOrder: toNum(it.sortOrder), updatedBy: userId } }
        }
      }));
    if (!ops.length) return res.status(400).json({ status: false, message: 'No valid items provided' });
    const result = await Help.bulkWrite(ops, { ordered: false });
    return res.status(200).json({ status: true, message: 'Topic sort order updated', modifiedCount: result.modifiedCount });
  } catch (err) {
    return next(err);
  }
};

export default {
  createHelp,
  updateHelp,
  deleteHelp,
  viewHelp,
  listHelp,
  listModules,
  updateModuleSortOrder,
  updateTopicSortOrder
};

import { v4 as uuid } from 'uuid';
import constants from '../helpers/constants.js';
import Task from '../models/task.model.js';
import { uploadFileToS3 } from '../middlewares/s3.service.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || req?.query?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const uploadTaskAttachment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!req.file) {
      return res.status(400).json({ status: false, message: 'No file provided for upload' });
    }
    const attachmentUrl = await uploadFileToS3(req.file, 'tasks');
    if (!attachmentUrl) {
      return res.status(500).json({ status: false, message: 'Failed to upload to S3' });
    }
    return res.status(200).json({
      status: true,
      message: 'File uploaded successfully',
      data: { attachmentUrl }
    });
  } catch (err) {
    return next(err);
  }
};

const createTask = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { taskName, description, staffId, dueDate, attachmentUrl } = req.body;
    if (!tenantId || !taskName || !staffId || !dueDate) {
      return res.status(400).json({ status: false, message: 'tenantId, taskName, staffId, and dueDate are required.' });
    }
    let formattedAttachments = [];
    if (Array.isArray(attachmentUrl)) {
      formattedAttachments = attachmentUrl.map((obj) => ({ url: safeTrim(obj?.url) })).filter((obj) => obj.url);
    }
    const newTask = await Task.create({
      tenantId,
      taskId: uuid(),
      taskName: safeTrim(taskName),
      description: safeTrim(description),
      staffId: safeTrim(staffId),
      dueDate: Number(dueDate),
      attachmentUrl: formattedAttachments,
      status: 'PENDING',
      isdeleted: false,
      createdBy: userId,
      updatedBy: userId
    });
    return res.status(201).json({
      status: true,
      message: 'Task created successfully',
      data: newTask
    });
  } catch (err) {
    return next(err);
  }
};

const editTask = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const taskId = safeTrim(req.body?.taskId);
    const userId = safeTrim(req.body?.userId);
    const { taskName, description, staffId, dueDate, attachmentUrl } = req.body;
    if (!tenantId || !taskId) {
      return res.status(400).json({ status: false, message: 'tenantId and taskId are required' });
    }
    const updateData = { updatedBy: userId };
    if (taskName) updateData.taskName = safeTrim(taskName);
    if (description !== undefined) updateData.description = safeTrim(description);
    if (staffId) updateData.staffId = safeTrim(staffId);
    if (dueDate) updateData.dueDate = Number(dueDate);
    if (Array.isArray(attachmentUrl)) {
      updateData.attachmentUrl = attachmentUrl.map((obj) => ({ url: safeTrim(obj?.url) })).filter((obj) => obj.url);
    }
    const updatedTask = await Task.findOneAndUpdate({ tenantId, taskId, isdeleted: false }, { $set: updateData }, { new: true }).lean();
    if (!updatedTask) return res.status(404).json({ status: false, message: 'Task not found' });
    return res.status(200).json({ status: true, message: 'Task updated successfully', data: updatedTask });
  } catch (err) {
    return next(err);
  }
};

const listTasks = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const list = req.query.list || '';
    const tenantId = req.body.entiId;
    const staffId = req.query.staffId || req.body.staffId || '';
    const status = req.query.status || req.body.status || '';
    const query = {
      tenantId: tenantId,
      isdeleted: false
    };
    if (staffId) query.staffId = staffId.trim();
    console.log('query ', query);
    if (status) query.status = status.trim();
    if (search) {
      const rx = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ taskName: rx }, { taskId: rx }, { description: rx }];
    }
    if (String(list).toLowerCase() === 'full') {
      const rows = await Task.find(query)
        .sort(sort)
        .populate({
          path: 'staffId',
          localField: 'staffId',
          foreignField: 'staffId',
          model: 'staff',
          justOne: true,
          select: 'staffName staffCode facultyType _id'
        })
        .lean();
      return res.status(constants.HTTPS_SUCCESS).send({
        status: true,
        data: rows,
        count: rows.length,
        message: 'Task details retrieved Successfully'
      });
    }
    const count = await Task.countDocuments(query);
    const rows = await Task.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'staffId',
        localField: 'staffId',
        foreignField: 'staffId',
        model: 'staff',
        justOne: true,
        select: 'staffName staffCode facultyType _id'
      })
      .lean();
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: rows,
      page: page,
      count: count,
      message: 'Task details retrieved Successfully'
    });
  } catch (err) {
    next(err);
  }
};

const updateTaskStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const taskId = safeTrim(req.body?.taskId);
    const status = safeTrim(req.body?.status);
    const remarks = safeTrim(req.body?.remarks);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !taskId || !status) {
      return res.status(400).json({ status: false, message: 'tenantId, taskId, and status are required' });
    }
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED', 'NEED_MORE_TIME'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    const updatedTask = await Task.findOneAndUpdate(
      { tenantId, taskId, isdeleted: false },
      {
        $set: {
          status,
          remarks: remarks || null,
          updatedBy: userId
        }
      },
      { new: true }
    ).lean();
    if (!updatedTask) {
      return res.status(404).json({ status: false, message: 'Task not found' });
    }
    return res.status(200).json({
      status: true,
      message: 'Task status updated successfully',
      data: updatedTask
    });
  } catch (err) {
    return next(err);
  }
};

const markTaskInProgress = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const taskId = safeTrim(req.body?.taskId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !taskId) {
      return res.status(400).json({ status: false, message: 'tenantId and taskId are required' });
    }
    const updatedTask = await Task.findOneAndUpdate(
      { tenantId, taskId, isdeleted: false },
      {
        $set: {
          status: 'IN_PROGRESS',
          updatedBy: userId
        }
      },
      { new: true }
    ).lean();
    if (!updatedTask) {
      return res.status(404).json({ status: false, message: 'Task not found' });
    }
    return res.status(200).json({
      status: true,
      message: 'Task marked as In Progress',
      data: updatedTask
    });
  } catch (err) {
    return next(err);
  }
};

const viewTask = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const taskId = safeTrim(req.query?.taskId || req.body?.taskId);
    if (!tenantId || !taskId) {
      return res.status(400).json({ status: false, message: 'tenantId and taskId are required' });
    }
    const task = await Task.findOne({ tenantId, taskId, isdeleted: false })
      .populate({
        path: 'staffId',
        localField: 'staffId',
        foreignField: 'staffId',
        model: 'staff',
        justOne: true,
        select: 'staffName staffCode facultyType _id'
      })
      .lean();
    if (!task) {
      return res.status(404).json({ status: false, message: 'Task not found' });
    }
    return res.status(200).json({
      status: true,
      message: 'Task retrieved successfully',
      data: task
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  uploadTaskAttachment,
  createTask,
  listTasks,
  updateTaskStatus,
  markTaskInProgress,
  editTask,
  viewTask
};

import { v4 as uuid } from 'uuid';
import constants from '../helpers/constants.js';
import StudyMaterial from '../models/studymaterial.model.js';
import { uploadFileToS3 } from '../middlewares/s3.service.js';
import StudentProfile from '../models/studentProfile.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || req?.query?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const uploadMaterialFile = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!req.file) {
      return res.status(400).json({ status: false, message: 'No file provided for upload' });
    }
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ status: false, message: 'Only PDF files are allowed for study materials.' });
    }
    const attachmentUrl = await uploadFileToS3(req.file, 'library');
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

const getStudyMaterialTargetStudents = async ({ tenantId, material }) => {
  const query = {
    tenantId,
    isdeleted: false,
    status: 'ACTIVE'
  };
  const studentIds = Array.isArray(material?.studentIds) ? material.studentIds.map(safeTrim).filter(Boolean) : [];
  const batchIds = Array.isArray(material?.batchIds) ? material.batchIds.map(safeTrim).filter(Boolean) : [];
  if (studentIds.length) {
    query.studentId = { $in: studentIds };
  } else if (batchIds.length) {
    query.batchId = { $in: batchIds };
  } else {
    query.classNo = Number(material?.classNo);
  }
  return await StudentProfile.find(query, {
    studentId: 1,
    admissionNo: 1,
    batchId: 1,
    batchCode: 1
  }).lean();
};

const createMaterial = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { title, description, classNo, subjectId, topicId, subTopicId, batchIds, studentIds, availableFrom, availableUntil, attachmentUrl, status } = req.body;
    if (!tenantId || !title || !classNo || !subjectId) {
      return res.status(400).json({ status: false, message: 'tenantId, title, classNo, and subjectId are required.' });
    }
    let formattedAttachments = [];
    if (Array.isArray(attachmentUrl)) {
      formattedAttachments = attachmentUrl.map((obj) => ({ url: safeTrim(obj?.url) })).filter((obj) => obj.url);
    }
    const newMaterial = await StudyMaterial.create({
      tenantId,
      materialId: uuid(),
      title: safeTrim(title),
      description: safeTrim(description),
      attachmentUrl: formattedAttachments,
      classNo: Number(classNo),
      subjectId: safeTrim(subjectId),
      topicId: safeTrim(topicId),
      subTopicId: safeTrim(subTopicId),
      batchIds: Array.isArray(batchIds) ? batchIds : [],
      studentIds: Array.isArray(studentIds) ? studentIds : [],
      availableFrom: availableFrom ? Number(availableFrom) : null,
      availableUntil: availableUntil ? Number(availableUntil) : null,
      status: status || 'Active',
      isdeleted: false,
      createdBy: userId,
      updatedBy: userId
    });
    if (safeTrim(newMaterial.status).toUpperCase() === 'ACTIVE') {
      const students = await getStudyMaterialTargetStudents({
        tenantId,
        material: newMaterial
      });
      for (const st of students || []) {
        triggerCommunicationEventSafe({
          tenantId,
          eventCode: 'STUDY_MATERIAL_UPLOADED',
          admissionNo: safeTrim(st?.admissionNo),
          studentId: safeTrim(st?.studentId),
          sourceModule: 'STUDY_MATERIAL',
          sourceRefId: newMaterial.materialId,
          userId,
          extraData: {
            materialId: newMaterial.materialId,
            materialTitle: newMaterial.title,
            materialDescription: newMaterial.description || '',
            classNo: newMaterial.classNo,
            subjectId: newMaterial.subjectId,
            topicId: newMaterial.topicId || '',
            subTopicId: newMaterial.subTopicId || '',
            batchId: safeTrim(st?.batchId),
            batchCode: safeTrim(st?.batchCode),
            availableFrom: newMaterial.availableFrom || '',
            availableUntil: newMaterial.availableUntil || '',
            attachmentCount: Array.isArray(newMaterial.attachmentUrl) ? newMaterial.attachmentUrl.length : 0
          }
        });
      }
    }
    return res.status(201).json({ status: true, message: 'Study material created successfully', data: newMaterial });
  } catch (err) {
    return next(err);
  }
};

const editMaterial = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const materialId = safeTrim(req.body?.materialId);
    const userId = safeTrim(req.body?.userId);
    const { title, description, classNo, subjectId, topicId, subTopicId, batchIds, studentIds, availableFrom, availableUntil, attachmentUrl, status } = req.body;
    if (!tenantId || !materialId) {
      return res.status(400).json({ status: false, message: 'tenantId and materialId are required' });
    }
    const updateData = { updatedBy: userId };
    if (title) updateData.title = safeTrim(title);
    if (description !== undefined) updateData.description = safeTrim(description);
    if (classNo) updateData.classNo = Number(classNo);
    if (subjectId) updateData.subjectId = safeTrim(subjectId);
    if (topicId !== undefined) updateData.topicId = safeTrim(topicId);
    if (subTopicId !== undefined) updateData.subTopicId = safeTrim(subTopicId);
    if (batchIds) updateData.batchIds = Array.isArray(batchIds) ? batchIds : [];
    if (studentIds) updateData.studentIds = Array.isArray(studentIds) ? studentIds : [];
    if (availableFrom !== undefined) updateData.availableFrom = availableFrom ? Number(availableFrom) : null;
    if (availableUntil !== undefined) updateData.availableUntil = availableUntil ? Number(availableUntil) : null;
    if (status) updateData.status = safeTrim(status);
    if (Array.isArray(attachmentUrl)) {
      updateData.attachmentUrl = attachmentUrl.map((obj) => ({ url: safeTrim(obj?.url) })).filter((obj) => obj.url);
    }
    const updatedMaterial = await StudyMaterial.findOneAndUpdate({ tenantId, materialId, isdeleted: false }, { $set: updateData }, { new: true }).lean();
    if (!updatedMaterial) return res.status(404).json({ status: false, message: 'Study material not found' });
    return res.status(200).json({ status: true, message: 'Study material updated successfully', data: updatedMaterial });
  } catch (err) {
    return next(err);
  }
};

const makeInactive = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const materialId = safeTrim(req.body?.materialId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !materialId) return res.status(400).json({ status: false, message: 'tenantId and materialId are required' });
    const updatedMaterial = await StudyMaterial.findOneAndUpdate({ tenantId, materialId, isdeleted: false }, { $set: { status: 'Inactive', updatedBy: userId } }, { new: true }).lean();
    if (!updatedMaterial) return res.status(404).json({ status: false, message: 'Study material not found' });
    return res.status(200).json({ status: true, message: 'Study material marked as inactive', data: updatedMaterial });
  } catch (err) {
    return next(err);
  }
};

const deleteMaterial = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const materialId = safeTrim(req.body?.materialId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !materialId) return res.status(400).json({ status: false, message: 'tenantId and materialId are required' });
    const deletedMaterial = await StudyMaterial.findOneAndUpdate({ tenantId, materialId, isdeleted: false }, { $set: { isdeleted: true, status: 'Inactive', updatedBy: userId } }, { new: true }).lean();
    if (!deletedMaterial) return res.status(404).json({ status: false, message: 'Study material not found' });
    return res.status(200).json({ status: true, message: 'Study material deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

const listMaterials = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const page = parseInt(req.query.page || req.body.page, 10) || 1;
    const limit = parseInt(req.query.limit || req.body.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || req.body.sort || '-createdAt';
    const search = req.query.search || '';
    const classNo = req.query.classNo;
    const subjectId = req.query.subjectId;
    const batchId = req.query.batchId;
    const studentId = req.query.studentId;
    const staffId = req.query.staffId;
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const query = { tenantId, isdeleted: false };
    if (classNo) query.classNo = Number(classNo);
    if (subjectId) query.subjectId = safeTrim(subjectId);
    if (status) query.status = safeTrim(status);
    if (batchId) query.batchIds = safeTrim(batchId);
    if (studentId) query.studentIds = safeTrim(studentId);
    if (staffId) query.createdBy = safeTrim(staffId);
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(Number(startDate));
      if (endDate) query.createdAt.$lte = new Date(Number(endDate));
    }
    if (search) {
      const rx = { $regex: safeTrim(search), $options: 'i' };
      query.$or = [{ title: rx }, { description: rx }];
    }
    const listMode = String(req.query.list || req.body.list || '').toLowerCase();
    if (listMode === 'full') {
      const rows = await StudyMaterial.find(query).sort(sort).populate('subjectId', 'subjectName subjectCode').lean();
      return res.status(constants.HTTPS_SUCCESS).send({ status: true, data: rows, count: rows.length, message: 'Materials retrieved' });
    }
    const [rows, count] = await Promise.all([StudyMaterial.find(query).sort(sort).skip(skip).limit(limit).populate('subjectId', 'subjectName subjectCode').lean(), StudyMaterial.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: rows,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0,
      message: 'Materials retrieved successfully'
    });
  } catch (err) {
    next(err);
  }
};

const viewMaterial = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const materialId = safeTrim(req.body?.materialId || req.query?.materialId);
    if (!tenantId || !materialId) {
      return res.status(400).json({ status: false, message: 'tenantId and materialId are required' });
    }
    const material = await StudyMaterial.findOne({ tenantId, materialId, isdeleted: false }).populate('subjectId', 'subjectName subjectCode').lean();
    if (!material) {
      return res.status(404).json({ status: false, message: 'Study material not found' });
    }
    return res.status(200).json({ status: true, message: 'Study material retrieved', data: material });
  } catch (err) {
    return next(err);
  }
};

export default {
  uploadMaterialFile,
  createMaterial,
  editMaterial,
  makeInactive,
  deleteMaterial,
  listMaterials,
  viewMaterial
};

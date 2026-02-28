import { v4 as uuid } from 'uuid';
import constants from '../helpers/constants.js';
import Circular from '../models/circular.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import { uploadFileToS3 } from '../middlewares/s3.service.js';

const picktenantId = (req) => String(req?.body?.tenantId || req?.body?.tenantId || req?.body?.entiId || req?.query?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const uploadCircularFile = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!req.file) {
      return res.status(400).json({ status: false, message: 'No file provided for upload' });
    }
    const attachmentUrl = await uploadFileToS3(req.file, 'circulars');
    if (!attachmentUrl) {
      return res.status(500).json({ status: false, message: 'Failed to upload to S3' });
    }
    return res.status(200).json({
      status: true,
      message: 'File uploaded successfully',
      data: { url: attachmentUrl }
    });
  } catch (err) {
    return next(err);
  }
};

const createCircular = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { category, scope, centerCode, batchCode, subject, details, files, status } = req.body;
    if (!tenantId || !category || !scope || !subject || !details) {
      return res.status(400).json({ status: false, message: 'tenantId, category, scope, subject, and details are required.' });
    }
    const upperScope = safeTrim(scope).toUpperCase();
    if (upperScope === 'CENTER' && !centerCode) {
      return res.status(400).json({ status: false, message: 'centerCode is required when scope is CENTER' });
    }
    if (upperScope === 'BATCH' && (!centerCode || !batchCode)) {
      return res.status(400).json({ status: false, message: 'centerCode and batchCode are required when scope is BATCH' });
    }
    const newCircular = await Circular.create({
      tenantId,
      circularId: uuid(),
      category: safeTrim(category).toUpperCase(),
      scope: upperScope,
      centerCode: centerCode ? safeTrim(centerCode) : null,
      batchCode: batchCode ? safeTrim(batchCode) : null,
      subject: safeTrim(subject),
      details: safeTrim(details),
      files: Array.isArray(files) ? files : [],
      status: status ? safeTrim(status).toUpperCase() : 'PUBLISHED',
      publishedAt: Date.now(),
      isdeleted: false,
      createdBy: userId,
      updatedBy: userId
    });
    return res.status(201).json({ status: true, message: 'Circular created successfully', data: newCircular });
  } catch (err) {
    return next(err);
  }
};

const listCirculars = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const page = parseInt(req.query.page || req.body.page, 10) || 1;
    const limit = parseInt(req.query.limit || req.body.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || req.body.sort || '-publishedAt';
    const search = safeTrim(req.query.search);

    const category = safeTrim(req.query.category);
    const scope = safeTrim(req.query.scope);
    const status = safeTrim(req.query.status);
    const centerCode = safeTrim(req.query.centerCode || req.body.centerCode);
    const batchCode = safeTrim(req.query.batchCode || req.body.batchCode);

    const query = { tenantId, isdeleted: false };

    if (category) query.category = category.toUpperCase();
    if (scope) query.scope = scope.toUpperCase();
    if (status) query.status = status.toUpperCase();
    if (centerCode) query.centerCode = centerCode;
    if (batchCode) query.batchCode = batchCode;

    if (search) {
      const rx = { $regex: search, $options: 'i' };
      query.$or = [{ subject: rx }, { details: rx }, { category: rx }];
    }

    const [rows, count] = await Promise.all([Circular.find(query).sort(sort).skip(skip).limit(limit).lean(), Circular.countDocuments(query)]);

    return res.status(constants.HTTPS_SUCCESS || 200).send({
      status: true,
      data: rows,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0,
      message: 'Circulars retrieved successfully'
    });
  } catch (err) {
    return next(err);
  }
};

const viewCircular = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    const circularId = safeTrim(req.body?.circularId || req.query?.circularId);

    if (!tenantId || !circularId) {
      return res.status(400).json({ status: false, message: 'tenantId and circularId are required' });
    }

    const circular = await Circular.findOne({ tenantId, circularId, isdeleted: false }).lean();
    if (!circular) return res.status(404).json({ status: false, message: 'Circular not found' });

    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, message: 'Circular retrieved', data: circular });
  } catch (err) {
    return next(err);
  }
};

const editCircular = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    const circularId = safeTrim(req.body?.circularId);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !circularId) {
      return res.status(400).json({ status: false, message: 'tenantId and circularId are required' });
    }

    const updateFields = { updatedBy: userId };

    if (req.body.subject !== undefined) updateFields.subject = safeTrim(req.body.subject);
    if (req.body.details !== undefined) updateFields.details = safeTrim(req.body.details);
    if (req.body.category !== undefined) updateFields.category = safeTrim(req.body.category).toUpperCase();
    if (req.body.status !== undefined) updateFields.status = safeTrim(req.body.status).toUpperCase();
    if (req.body.scope !== undefined) updateFields.scope = safeTrim(req.body.scope).toUpperCase();
    if (req.body.centerCode !== undefined) updateFields.centerCode = safeTrim(req.body.centerCode);
    if (req.body.batchCode !== undefined) updateFields.batchCode = safeTrim(req.body.batchCode);
    if (Array.isArray(req.body.files)) updateFields.files = req.body.files;

    const updatedCircular = await Circular.findOneAndUpdate({ tenantId, circularId, isdeleted: false }, { $set: updateFields }, { new: true }).lean();

    if (!updatedCircular) return res.status(404).json({ status: false, message: 'Circular not found' });

    return res.status(200).json({ status: true, message: 'Circular updated successfully', data: updatedCircular });
  } catch (err) {
    return next(err);
  }
};

const deleteCircular = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    const circularId = safeTrim(req.body?.circularId || req.query?.circularId);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !circularId) {
      return res.status(400).json({ status: false, message: 'tenantId and circularId are required' });
    }

    const deletedCircular = await Circular.findOneAndUpdate({ tenantId, circularId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId } }, { new: true }).lean();

    if (!deletedCircular) return res.status(404).json({ status: false, message: 'Circular not found or already deleted' });

    return res.status(200).json({ status: true, message: 'Circular deleted successfully', data: deletedCircular });
  } catch (err) {
    return next(err);
  }
};

const getCircularReports = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const matchStage = { tenantId, isdeleted: false };
    const [categoryReport, scopeReport, statusReport, totalCount] = await Promise.all([
      Circular.aggregate([{ $match: matchStage }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
      Circular.aggregate([{ $match: matchStage }, { $group: { _id: '$scope', count: { $sum: 1 } } }]),
      Circular.aggregate([{ $match: matchStage }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Circular.countDocuments(matchStage)
    ]);

    const formatReport = (data) => data.map((item) => ({ name: item._id, count: item.count }));

    return res.status(200).json({
      status: true,
      message: 'Circular reports generated successfully',
      data: {
        totalCirculars: totalCount,
        byCategory: formatReport(categoryReport),
        byScope: formatReport(scopeReport),
        byStatus: formatReport(statusReport)
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentCirculars = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    const studentNo = safeTrim(req.query.studentNo || req.body.studentNo);

    if (!tenantId || !studentNo) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }

    const student = await StudentProfile.findOne({
      tenantId: tenantId,
      isdeleted: false,
      $or: [{ studentId: studentNo }, { admissionNo: studentNo }, { registrationNumber: studentNo }]
    }).lean();

    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }

    const centerCode = safeTrim(student.centerCode);
    const batchCode = safeTrim(student.batchCode);

    const page = parseInt(req.query.page || req.body.page, 10) || 1;
    const limit = parseInt(req.query.limit || req.body.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || req.body.sort || '-publishedAt';

    const query = {
      tenantId,
      isdeleted: false,
      status: 'PUBLISHED',
      $or: [{ scope: 'INSTITUTE' }, { scope: 'CENTER', centerCode: centerCode }, { scope: 'BATCH', batchCode: batchCode }]
    };

    console.log(query);
    const [rows, count] = await Promise.all([Circular.find(query).sort(sort).skip(skip).limit(limit).lean(), Circular.countDocuments(query)]);

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Student circulars retrieved successfully',
      data: rows,
      meta: {
        studentId: student.studentId,
        centerCode: centerCode,
        batchCode: batchCode
      },
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0
    });
  } catch (err) {
    return next(err);
  }
};

const publishCircular = async (req, res, next) => {
  try {
    const tenantId = picktenantId(req);
    const circularId = safeTrim(req.body?.circularId);
    const userId = safeTrim(req.body?.userId);

    if (!tenantId || !circularId) {
      return res.status(400).json({ status: false, message: 'tenantId and circularId are required' });
    }

    const updatedCircular = await Circular.findOneAndUpdate(
      { tenantId, circularId, isdeleted: false },
      {
        $set: {
          status: 'PUBLISHED',
          publishedAt: Date.now(),
          updatedBy: userId
        }
      },
      { new: true }
    ).lean();

    if (!updatedCircular) {
      return res.status(404).json({ status: false, message: 'Circular not found or already deleted' });
    }

    return res.status(200).json({
      status: true,
      message: 'Circular published successfully',
      data: updatedCircular
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  uploadCircularFile,
  createCircular,
  listCirculars,
  viewCircular,
  editCircular,
  deleteCircular,
  getCircularReports,
  getStudentCirculars,
  publishCircular
};

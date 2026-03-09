import { v4 as uuid } from 'uuid';
import Package from '../models/package.model.js';
import PackageEnablement from '../models/packageEnablement.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import { uploadFileToS3 } from '../middlewares/s3.service.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || req?.query?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const uploadPackageFile = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId is required' });
    }
    if (!req.file) {
      return res.status(400).json({ status: false, message: 'No file provided for upload' });
    }
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ status: false, message: 'Only PDF files are allowed for packages.' });
    }
    const attachmentUrl = await uploadFileToS3(req.file, 'packages');
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

const createPackage = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { packageCode, classNo, subjectId, subjectName, title, description, attachmentUrl } = req.body;
    if (!tenantId || !packageCode || !classNo || !subjectId || !title || !attachmentUrl) {
      return res.status(400).json({ status: false, message: 'Missing mandatory fields' });
    }
    const existing = await Package.findOne({ tenantId, packageCode: safeTrim(packageCode), isdeleted: false }).lean();
    if (existing) {
      return res.status(409).json({ status: false, message: 'Package code already exists' });
    }
    const newPackage = await Package.create({
      tenantId,
      packageCode: safeTrim(packageCode),
      classNo: toInt(classNo),
      subjectId: safeTrim(subjectId),
      subjectName: safeTrim(subjectName),
      title: safeTrim(title),
      description: safeTrim(description),
      attachmentUrl: safeTrim(attachmentUrl),
      createdBy: userId,
      updatedBy: userId
    });
    return res.status(201).json({ status: true, message: 'Package created successfully', data: newPackage });
  } catch (err) {
    return next(err);
  }
};

// --- Edit Master Package ---
const editPackage = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { packageId, userId, packageCode, classNo, subjectId, subjectName, title, description, attachmentUrl, status } = req.body;

    if (!tenantId || !packageId) {
      return res.status(400).json({ status: false, message: 'tenantId and packageId are required' });
    }

    // If they are trying to change the packageCode, ensure it doesn't conflict with another package
    if (packageCode) {
      const existing = await Package.findOne({
        tenantId,
        packageCode: safeTrim(packageCode),
        packageId: { $ne: packageId },
        isdeleted: false
      }).lean();

      if (existing) {
        return res.status(409).json({ status: false, message: 'Package code already in use by another package' });
      }
    }

    const updateData = { updatedBy: safeTrim(userId) };
    if (packageCode) updateData.packageCode = safeTrim(packageCode);
    if (classNo) updateData.classNo = toInt(classNo);
    if (subjectId) updateData.subjectId = safeTrim(subjectId);
    if (subjectName) updateData.subjectName = safeTrim(subjectName);
    if (title) updateData.title = safeTrim(title);
    if (description !== undefined) updateData.description = safeTrim(description);
    if (attachmentUrl) updateData.attachmentUrl = safeTrim(attachmentUrl);
    if (status) updateData.status = safeTrim(status);

    const updated = await Package.findOneAndUpdate({ tenantId, packageId, isdeleted: false }, { $set: updateData }, { new: true }).lean();

    if (!updated) return res.status(404).json({ status: false, message: 'Package not found' });

    return res.status(200).json({ status: true, message: 'Package updated successfully', data: updated });
  } catch (err) {
    return next(err);
  }
};

const deletePackage = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { packageId, userId } = req.body;
    if (!tenantId || !packageId) {
      return res.status(400).json({ status: false, message: 'tenantId and packageId are required' });
    }
    const deleted = await Package.findOneAndUpdate({ tenantId, packageId, isdeleted: false }, { $set: { isdeleted: true, status: 'INACTIVE', updatedBy: safeTrim(userId) } }, { new: true }).lean();
    if (!deleted) return res.status(404).json({ status: false, message: 'Package not found' });
    await PackageEnablement.updateMany({ tenantId, packageId, isdeleted: false }, { $set: { isdeleted: true, status: 'REVOKED', updatedBy: safeTrim(userId) } });
    return res.status(200).json({ status: true, message: 'Package and its active assignments deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

const listPackages = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const page = toInt(req.query.page || req.body.page, 1);
    const limit = toInt(req.query.limit || req.body.limit, 10);
    const skip = (page - 1) * limit;
    const { classNo, subjectId, status, search } = req.body;
    const query = { tenantId, isdeleted: false };
    if (classNo) query.classNo = toInt(classNo);
    if (subjectId) query.subjectId = safeTrim(subjectId);
    if (status) query.status = safeTrim(status);
    if (search) {
      const rx = { $regex: safeTrim(search), $options: 'i' };
      query.$or = [{ title: rx }, { packageCode: rx }, { description: rx }];
    }
    const [rows, count] = await Promise.all([Package.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Package.countDocuments(query)]);
    return res.status(200).json({ status: true, data: rows, page, limit, count, pages: Math.ceil(count / limit) || 0 });
  } catch (err) {
    return next(err);
  }
};

const assignPackage = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { packageId, scope, targetIds, enableDate, disableDate } = req.body;
    if (!tenantId || !packageId || !scope || !Array.isArray(targetIds) || targetIds.length === 0 || !enableDate || !disableDate) {
      return res.status(400).json({ status: false, message: 'Missing mandatory fields or targetIds' });
    }
    if (Number(enableDate) >= Number(disableDate)) {
      return res.status(400).json({ status: false, message: 'Disable date must be after enable date' });
    }
    const pkg = await Package.findOne({ tenantId, packageId: safeTrim(packageId), isdeleted: false }).lean();
    if (!pkg) return res.status(404).json({ status: false, message: 'Package not found' });
    const enablement = await PackageEnablement.create({
      tenantId,
      packageId: safeTrim(packageId),
      scope: safeTrim(scope),
      targetIds: targetIds.map(safeTrim),
      enableDate: Number(enableDate),
      disableDate: Number(disableDate),
      createdBy: userId,
      updatedBy: userId
    });
    return res.status(201).json({ status: true, message: `Package enabled for ${targetIds.length} target(s)`, data: enablement });
  } catch (err) {
    return next(err);
  }
};

// --- Package Enablement Report (Updated to avoid ObjectId CastError) ---
const reportPackageEnablement = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { packageId, scope, targetId, status, staffId } = req.body;
    const page = toInt(req.query.page || req.body.page, 1);
    const limit = toInt(req.query.limit || req.body.limit, 10);
    const skip = (page - 1) * limit;

    const query = { tenantId, isdeleted: false };

    if (packageId) query.packageId = safeTrim(packageId);
    if (scope) query.scope = safeTrim(scope);
    if (targetId) query.targetIds = safeTrim(targetId);
    if (status) query.status = safeTrim(status);
    if (staffId) query.createdBy = safeTrim(staffId);

    // 1. Fetch enablements WITHOUT populate
    const [rows, count] = await Promise.all([PackageEnablement.find(query).sort({ enableDate: -1 }).skip(skip).limit(limit).lean(), PackageEnablement.countDocuments(query)]);

    if (rows.length > 0) {
      // 2. Manually fetch the Master Packages
      const packageIds = [...new Set(rows.map((r) => r.packageId))];
      const masterPackages = await Package.find(
        { tenantId, packageId: { $in: packageIds } },
        'packageId packageCode title classNo subjectName' // Only fetch needed fields
      ).lean();

      const packageMap = new Map(masterPackages.map((p) => [p.packageId, p]));

      // 3. Attach the package details to the report rows
      rows.forEach((r) => {
        r.packageId = packageMap.get(r.packageId) || null;
      });
    }

    return res.status(200).json({
      status: true,
      message: 'Enablement report fetched',
      data: rows,
      page,
      limit,
      count
    });
  } catch (err) {
    return next(err);
  }
};

const revokeEnablement = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { enablementId, userId } = req.body;
    if (!tenantId || !enablementId) return res.status(400).json({ status: false, message: 'tenantId and enablementId required' });
    const updated = await PackageEnablement.findOneAndUpdate({ tenantId, enablementId, isdeleted: false }, { $set: { status: 'REVOKED', updatedBy: safeTrim(userId) } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Enablement record not found' });
    return res.status(200).json({ status: true, message: 'Package access revoked successfully' });
  } catch (err) {
    return next(err);
  }
};

// const getStudentPackages = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
//     if (!tenantId || !identifier) {
//       return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
//     }
//     const student = await StudentProfile.findOne({
//       tenantId,
//       status: 'ACTIVE',
//       isdeleted: false,
//       $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
//     }).lean();
//     if (!student) {
//       return res.status(404).json({ status: false, message: 'Student profile not found' });
//     }
//     const now = Date.now();
//     const activeEnablements = await PackageEnablement.find({
//       tenantId,
//       isdeleted: false,
//       status: 'ACTIVE',
//       enableDate: { $lte: now },
//       disableDate: { $gte: now },
//       $or: [
//         { scope: 'PROGRAM', targetIds: student.programId },
//         { scope: 'BATCH', targetIds: student.batchCode },
//         { scope: 'BATCH', targetIds: student.batchId },
//         { scope: 'STUDENT', targetIds: student.studentId }
//       ]
//     }).lean();
//     if (!activeEnablements.length) {
//       return res.status(200).json({ status: true, data: { studentId: student.studentId, packagesCount: 0, packages: [] } });
//     }
//     const packageIds = [...new Set(activeEnablements.map((e) => e.packageId))];
//     const masterPackages = await Package.find({
//       tenantId,
//       packageId: { $in: packageIds },
//       isdeleted: false,
//       status: 'ACTIVE'
//     }).lean();
//     const packageMap = new Map(masterPackages.map((p) => [p.packageId, p]));
//     const availablePackages = [];
//     for (const e of activeEnablements) {
//       const pkg = packageMap.get(e.packageId);
//       if (pkg) {
//         availablePackages.push({
//           enablementId: e.enablementId,
//           scope: e.scope,
//           validUntil: e.disableDate,
//           package: pkg
//         });
//       }
//     }
//     return res.status(200).json({
//       status: true,
//       message: 'Student packages retrieved',
//       data: {
//         studentId: student.studentId,
//         packagesCount: availablePackages.length,
//         packages: availablePackages
//       }
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const getStudentPackageSubjects = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);

    if (!tenantId || !identifier) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }

    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
    }).lean();

    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }

    const now = Date.now();

    // 1. Get all active enablements mapping to this student
    const activeEnablements = await PackageEnablement.find({
      tenantId,
      isdeleted: false,
      status: 'ACTIVE',
      enableDate: { $lte: now },
      disableDate: { $gte: now },
      $or: [
        { scope: 'PROGRAM', targetIds: student.programId },
        { scope: 'BATCH', targetIds: student.batchCode },
        { scope: 'BATCH', targetIds: student.batchId },
        { scope: 'STUDENT', targetIds: student.studentId }
      ]
    }).lean();

    if (!activeEnablements.length) {
      return res.status(200).json({ status: true, data: { studentId: student.studentId, subjectsCount: 0, subjects: [] } });
    }

    // 2. Fetch only the subject details of the permitted packages
    const packageIds = [...new Set(activeEnablements.map((e) => e.packageId))];
    const masterPackages = await Package.find(
      {
        tenantId,
        packageId: { $in: packageIds },
        isdeleted: false,
        status: 'ACTIVE'
      },
      { subjectId: 1, subjectName: 1 }
    ).lean();

    // 3. Group and count by subjectId
    const subjectMap = new Map();
    for (const pkg of masterPackages) {
      if (!pkg.subjectId) continue;
      const subIdStr = String(pkg.subjectId);

      if (!subjectMap.has(subIdStr)) {
        subjectMap.set(subIdStr, {
          subjectId: subIdStr,
          subjectName: pkg.subjectName || 'Unknown Subject',
          packageCount: 0
        });
      }
      subjectMap.get(subIdStr).packageCount++;
    }

    const subjects = Array.from(subjectMap.values());

    return res.status(200).json({
      status: true,
      message: 'Subjects with packages retrieved successfully',
      data: {
        studentId: student.studentId,
        subjectsCount: subjects.length,
        subjects: subjects
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentPackages = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
    const subjectId = safeTrim(req.body?.subjectId);

    if (!tenantId || !identifier) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }
    if (!subjectId) {
      return res.status(400).json({ status: false, message: 'subjectId is required' });
    }

    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
    }).lean();

    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }

    const now = Date.now();
    const activeEnablements = await PackageEnablement.find({
      tenantId,
      isdeleted: false,
      status: 'ACTIVE',
      enableDate: { $lte: now },
      disableDate: { $gte: now },
      $or: [
        { scope: 'PROGRAM', targetIds: student.programId },
        { scope: 'BATCH', targetIds: student.batchCode },
        { scope: 'BATCH', targetIds: student.batchId },
        { scope: 'STUDENT', targetIds: student.studentId }
      ]
    }).lean();

    if (!activeEnablements.length) {
      return res.status(200).json({ status: true, data: { studentId: student.studentId, packagesCount: 0, packages: [] } });
    }

    const packageIds = [...new Set(activeEnablements.map((e) => e.packageId))];

    // Filter master packages by BOTH the permitted IDs and the requested subjectId
    const masterPackages = await Package.find({
      tenantId,
      packageId: { $in: packageIds },
      subjectId: subjectId,
      isdeleted: false,
      status: 'ACTIVE'
    }).lean();

    const packageMap = new Map(masterPackages.map((p) => [p.packageId, p]));
    const availablePackages = [];

    // Build final list (will skip any enablements that don't match the subject)
    for (const e of activeEnablements) {
      const pkg = packageMap.get(e.packageId);
      if (pkg) {
        availablePackages.push({
          enablementId: e.enablementId,
          scope: e.scope,
          validUntil: e.disableDate,
          package: pkg
        });
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Student packages retrieved successfully',
      data: {
        studentId: student.studentId,
        subjectId: subjectId,
        packagesCount: availablePackages.length,
        packages: availablePackages
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  uploadPackageFile,
  createPackage,
  listPackages,
  editPackage,
  deletePackage,
  assignPackage,
  reportPackageEnablement,
  revokeEnablement,
  getStudentPackages,
  getStudentPackageSubjects
};

// import constants from '../helpers/constants.js';
// import Program from '../models/program.model.js';

// const pickTenantId = (req) => (req.body?.entiId || '').toString().trim();
// const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();

// const createProgram = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
//     const payload = req.body || {};
//     const doc = await Program.create({
//       tenantId,
//       eligibleToClass: safeTrim(payload.eligibleToClass),
//       programName: safeTrim(payload.programName),
//       programCodes: safeTrim(payload.programCodes),
//       target: payload.target ? safeTrim(payload.target) : null,
//       duration: payload.duration ? safeTrim(payload.duration) : null,
//       version: safeTrim(payload.version),
//       programType: payload.programType ? safeTrim(payload.programType) : null,
//       excelId: payload.excelId ?? null,
//       status: payload.status || 'Active',
//       isdeleted: false
//     });
//     return res.status(constants.HTTPS_CREATED || 201).json({
//       status: true,
//       message: 'Program created successfully',
//       data: doc
//     });
//   } catch (err) {
//     console.log('err ', err);
//     if (err && err.code === 11000) {
//       const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
//       return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
//     }
//     return next(err);
//   }
// };

// const viewProgram = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const recId = req.body?.recId;
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
//     if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
//     const doc = await Program.findOne({ _id: recId, tenantId, isdeleted: false });
//     if (!doc) return res.status(404).json({ status: false, message: 'Program not found' });
//     return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, data: doc });
//   } catch (err) {
//     return next(err);
//   }
// };

// const updateProgram = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const recId = req.body?.recId;
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
//     if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
//     const payload = req.body || {};
//     const updateDoc = {};
//     if (payload.eligibleToClass !== undefined) updateDoc.eligibleToClass = safeTrim(payload.eligibleToClass);
//     if (payload.programName !== undefined) updateDoc.programName = safeTrim(payload.programName);
//     if (payload.programCodes !== undefined) updateDoc.programCodes = safeTrim(payload.programCodes);
//     if (payload.target !== undefined) updateDoc.target = payload.target ? safeTrim(payload.target) : null;
//     if (payload.duration !== undefined) updateDoc.duration = payload.duration ? safeTrim(payload.duration) : null;
//     if (payload.version !== undefined) updateDoc.version = safeTrim(payload.version);
//     if (payload.programType !== undefined) updateDoc.programType = payload.programType ? safeTrim(payload.programType) : null;
//     if (payload.excelId !== undefined) updateDoc.excelId = payload.excelId ?? null;
//     if (payload.status !== undefined) updateDoc.status = payload.status;
//     if (!Object.keys(updateDoc).length) {
//       return res.status(400).json({ status: false, message: 'No fields to update' });
//     }
//     const updated = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true, runValidators: true });
//     if (!updated) return res.status(404).json({ status: false, message: 'Program not found or already deleted' });
//     return res.status(constants.HTTPS_SUCCESS || 200).json({
//       status: true,
//       message: 'Program updated successfully',
//       data: updated
//     });
//   } catch (err) {
//     if (err && err.code === 11000) {
//       const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
//       return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
//     }
//     return next(err);
//   }
// };

// const deleteProgram = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const recId = req.body?.recId;
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
//     if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
//     const deleted = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true });
//     if (!deleted) return res.status(404).json({ status: false, message: 'Program not found or already deleted' });
//     return res.status(constants.HTTPS_SUCCESS || 200).json({
//       status: true,
//       message: 'Program deleted successfully',
//       data: deleted
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

// const listPrograms = async (req, res, next) => {
//   try {
//     const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required in body' });
//     const listType = req.query.list;
//     const sort = req.query.sort || '-createdAt';
//     const search = safeTrim(req.query.search);
//     const eligibleToClass = safeTrim(req.query.eligibleToClass);
//     const status = safeTrim(req.query.status);
//     const target = safeTrim(req.query.target);
//     const duration = safeTrim(req.query.duration);
//     const query = { tenantId, isdeleted: false };
//     if (eligibleToClass) query.eligibleToClass = eligibleToClass;
//     if (status) query.status = status;
//     if (target) query.target = target;
//     if (duration) query.duration = duration;
//     if (search) {
//       query.$or = [
//         { programName: { $regex: search, $options: 'i' } },
//         { programType: { $regex: search, $options: 'i' } },
//         { target: { $regex: search, $options: 'i' } },
//         { duration: { $regex: search, $options: 'i' } },
//         { programCodes: { $regex: search, $options: 'i' } },
//         { version: { $regex: search, $options: 'i' } }
//       ];
//     }
//     let data;
//     let count;
//     let page;
//     if (listType === 'full') {
//       data = await Program.find(query).sort('createdAt');
//       count = data.length;
//     } else {
//       page = parseInt(req.query.page, 10) || 1;
//       const limit = parseInt(req.query.limit, 10) || 10;
//       const skip = (page - 1) * limit;
//       count = await Program.countDocuments(query);
//       data = await Program.find(query).sort(sort).skip(skip).limit(limit);
//     }
//     return res.status(constants.HTTPS_SUCCESS || 200).json({
//       status: true,
//       message: 'Program list retrieved successfully',
//       data,
//       page,
//       count
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

// const importPrograms = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
//     const payload = req.body || {};
//     const rows = Array.isArray(payload.rows) ? payload.rows : [];
//     const mode = safeTrim(payload.mode || 'insert').toLowerCase();
//     if (!rows.length) {
//       return res.status(400).json({ status: false, message: 'rows must be a non-empty array' });
//     }
//     const docs = [];
//     const rowErrors = [];
//     for (let i = 0; i < rows.length; i++) {
//       const r = rows[i] || {};
//       const programName = safeTrim(r.programName);
//       const eligibleToClass = safeTrim(r.eligibleToClass);
//       const programCodes = safeTrim(r.programCodes);
//       const version = safeTrim(r.version);
//       if (!programName || !eligibleToClass || !programCodes || !version) {
//         rowErrors.push({
//           row: i + 1,
//           message: 'programName, eligibleToClass, programCodes, version are required'
//         });
//         continue;
//       }
//       docs.push({
//         tenantId,
//         excelId: r.excelId ?? null,
//         programName,
//         eligibleToClass,
//         programCodes,
//         target: r.target ? safeTrim(r.target) : null,
//         duration: r.duration ? safeTrim(r.duration) : null,
//         version,
//         programType: r.programType ? safeTrim(r.programType) : null,
//         status: r.status ? safeTrim(r.status) : 'Active',
//         isdeleted: false
//       });
//     }
//     if (!docs.length) {
//       return res.status(400).json({ status: false, message: 'No valid rows to import', rowErrors });
//     }
//     if (mode === 'upsert') {
//       const ops = docs.map((d) => ({
//         updateOne: {
//           filter: {
//             tenantId: d.tenantId,
//             eligibleToClass: d.eligibleToClass,
//             programName: d.programName,
//             version: d.version,
//             isdeleted: false
//           },
//           update: { $set: d },
//           upsert: true
//         }
//       }));
//       const result = await Program.bulkWrite(ops, { ordered: false });
//       return res.status(constants.HTTPS_SUCCESS || 200).json({
//         status: true,
//         message: 'Program import completed (upsert)',
//         rowErrors,
//         summary: {
//           received: rows.length,
//           valid: docs.length,
//           upserted: result.upsertedCount || 0,
//           modified: result.modifiedCount || 0,
//           matched: result.matchedCount || 0
//         }
//       });
//     }
//     let inserted = [];
//     let insertErrs = [];
//     try {
//       inserted = await Program.insertMany(docs, { ordered: false });
//     } catch (e) {
//       inserted = e?.insertedDocs || [];
//       insertErrs = Array.isArray(e?.writeErrors)
//         ? e.writeErrors.map((we) => ({
//             index: we.index,
//             code: we.code,
//             message: we.errmsg || we.message
//           }))
//         : [{ message: e?.message || 'Bulk insert error' }];
//     }
//     return res.status(constants.HTTPS_SUCCESS || 200).json({
//       status: true,
//       message: 'Program import completed (insert)',
//       rowErrors,
//       summary: {
//         received: rows.length,
//         valid: docs.length,
//         inserted: inserted.length,
//         failed: insertErrs.length
//       },
//       insertErrors: insertErrs
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

// export default {
//   createProgram,
//   viewProgram,
//   updateProgram,
//   deleteProgram,
//   listPrograms,
//   importPrograms
// };

import constants from '../helpers/constants.js';
import mongoose from 'mongoose';
import Program from '../models/program.model.js';

const pickTenantId = (req) => (req.body?.entiId || req.body?.tenantId || '').toString().trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

const normalizeSubjects = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = safeTrim(v);
  if (!s) return [];
  return s
    .split(',')
    .map((x) => String(x || '').trim())
    .filter(Boolean);
};

const createProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const payload = req.body || {};

    // ✅ numeric fields
    const eligibleToClass = toNum(payload.eligibleToClass);
    const startingClass = toNum(payload.startingClass);
    const duration = toNum(payload.duration);

    // ✅ subjects array (accept empty)
    const subjects = normalizeSubjects(payload.subjects);

    // validate subject ids format only (keep controller lean like your style)
    const badSub = subjects.find((x) => !isValidObjectId(x));
    if (badSub) return res.status(400).json({ status: false, message: 'Invalid subject id in subjects' });

    const doc = await Program.create({
      tenantId,
      eligibleToClass,
      startingClass,
      duration,

      programName: safeTrim(payload.programName),
      programCodes: safeTrim(payload.programCodes),

      target: payload.target ? safeTrim(payload.target) : null,
      version: safeTrim(payload.version),
      programType: payload.programType ? safeTrim(payload.programType) : null,
      excelId: payload.excelId ?? null,

      // ✅ new
      subjects,

      status: payload.status || 'Active',
      isdeleted: false
    });

    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Program created successfully',
      data: doc
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const viewProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const doc = await Program.findOne({ _id: recId, tenantId, isdeleted: false }).populate('subjects', 'subjectName subjectCode');
    if (!doc) return res.status(404).json({ status: false, message: 'Program not found' });

    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const payload = req.body || {};
    const updateDoc = {};

    // numeric fields
    if (payload.eligibleToClass !== undefined) updateDoc.eligibleToClass = toNum(payload.eligibleToClass);
    if (payload.startingClass !== undefined) updateDoc.startingClass = toNum(payload.startingClass);
    if (payload.duration !== undefined) updateDoc.duration = toNum(payload.duration);

    if (payload.programName !== undefined) updateDoc.programName = safeTrim(payload.programName);
    if (payload.programCodes !== undefined) updateDoc.programCodes = safeTrim(payload.programCodes);
    if (payload.target !== undefined) updateDoc.target = payload.target ? safeTrim(payload.target) : null;
    if (payload.version !== undefined) updateDoc.version = safeTrim(payload.version);
    if (payload.programType !== undefined) updateDoc.programType = payload.programType ? safeTrim(payload.programType) : null;
    if (payload.excelId !== undefined) updateDoc.excelId = payload.excelId ?? null;
    if (payload.status !== undefined) updateDoc.status = payload.status;

    // ✅ subjects allowed in update too (can be empty array)
    if (payload.subjects !== undefined) {
      const subjects = normalizeSubjects(payload.subjects);
      const badSub = subjects.find((x) => !isValidObjectId(x));
      if (badSub) return res.status(400).json({ status: false, message: 'Invalid subject id in subjects' });
      updateDoc.subjects = subjects;
    }

    if (!Object.keys(updateDoc).length) {
      return res.status(400).json({ status: false, message: 'No fields to update' });
    }

    const updated = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true, runValidators: true });

    if (!updated) return res.status(404).json({ status: false, message: 'Program not found or already deleted' });

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program updated successfully',
      data: updated
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const deleteProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const deleted = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true });
    if (!deleted) return res.status(404).json({ status: false, message: 'Program not found or already deleted' });

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program deleted successfully',
      data: deleted
    });
  } catch (err) {
    return next(err);
  }
};

const listPrograms = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required in body' });

    const listType = req.query.list;
    const sort = req.query.sort || '-createdAt';
    const search = safeTrim(req.query.search);

    // numeric filters
    const eligibleToClass = safeTrim(req.query.eligibleToClass);
    const startingClass = safeTrim(req.query.startingClass);
    const endingClass = safeTrim(req.query.endingClass);
    const duration = safeTrim(req.query.duration);

    const status = safeTrim(req.query.status);
    const target = safeTrim(req.query.target);

    const query = { tenantId, isdeleted: false };

    if (eligibleToClass) query.eligibleToClass = toNum(eligibleToClass);
    if (startingClass) query.startingClass = toNum(startingClass);
    if (endingClass) query.endingClass = toNum(endingClass);
    if (duration) query.duration = toNum(duration);

    if (status) query.status = status;
    if (target) query.target = target;

    if (search) {
      query.$or = [{ programName: { $regex: search, $options: 'i' } }, { programType: { $regex: search, $options: 'i' } }, { target: { $regex: search, $options: 'i' } }, { programCodes: { $regex: search, $options: 'i' } }, { version: { $regex: search, $options: 'i' } }];
    }

    let data;
    let count;
    let page;

    if (listType === 'full') {
      data = await Program.find(query).sort('createdAt');
      count = data.length;
    } else {
      page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;
      count = await Program.countDocuments(query);
      data = await Program.find(query).sort(sort).skip(skip).limit(limit);
    }

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program list retrieved successfully',
      data,
      page,
      count
    });
  } catch (err) {
    return next(err);
  }
};

// ✅ Separate method (as requested) - add/merge subjects later without touching other fields
const addProgramSubjects = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = safeTrim(req.body?.recId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const subjects = normalizeSubjects(req.body?.subjects);
    const badSub = subjects.find((x) => !isValidObjectId(x));
    if (badSub) return res.status(400).json({ status: false, message: 'Invalid subject id in subjects' });

    const updated = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $addToSet: { subjects: { $each: subjects } } }, { new: true });

    if (!updated) return res.status(404).json({ status: false, message: 'Program not found' });

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Subjects added to program',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const importPrograms = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const mode = safeTrim(payload.mode || 'insert').toLowerCase();
    if (!rows.length) {
      return res.status(400).json({ status: false, message: 'rows must be a non-empty array' });
    }
    const docs = [];
    const rowErrors = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const programName = safeTrim(r.programName);
      const programCodes = safeTrim(r.programCodes);
      const version = safeTrim(r.version);
      const eligibleToClass = toNum(r.eligibleToClass);
      const startingClass = toNum(r.startingClass);
      const duration = toNum(r.duration);
      const endingClass = toNum(r.endingClass);
      if (!programName || !programCodes || !version || !eligibleToClass || !startingClass || !duration) {
        rowErrors.push({
          row: i + 1,
          message: 'programName, programCodes, version, eligibleToClass, startingClass, duration are required'
        });
        continue;
      }
      const subjects = normalizeSubjects(r.subjects);
      const badSub = subjects.find((x) => !isValidObjectId(x));
      if (badSub) {
        rowErrors.push({ row: i + 1, message: 'Invalid subject id in subjects' });
        continue;
      }
      docs.push({
        tenantId,
        excelId: r.excelId ?? null,
        programName,
        programCodes,
        eligibleToClass,
        endingClass,
        startingClass,
        duration,
        target: r.target ? safeTrim(r.target) : null,
        version,
        programType: r.programType ? safeTrim(r.programType) : null,
        subjects,
        status: r.status ? safeTrim(r.status) : 'Active',
        isdeleted: false
      });
    }

    if (!docs.length) {
      return res.status(400).json({ status: false, message: 'No valid rows to import', rowErrors });
    }

    if (mode === 'upsert') {
      const ops = docs.map((d) => ({
        updateOne: {
          filter: {
            tenantId: d.tenantId,
            eligibleToClass: d.eligibleToClass,
            programName: d.programName,
            version: d.version,
            isdeleted: false
          },
          update: { $set: d },
          upsert: true
        }
      }));

      const result = await Program.bulkWrite(ops, { ordered: false });

      return res.status(constants.HTTPS_SUCCESS || 200).json({
        status: true,
        message: 'Program import completed (upsert)',
        rowErrors,
        summary: {
          received: rows.length,
          valid: docs.length,
          upserted: result.upsertedCount || 0,
          modified: result.modifiedCount || 0,
          matched: result.matchedCount || 0
        }
      });
    }

    let inserted = [];
    let insertErrs = [];

    try {
      inserted = await Program.insertMany(docs, { ordered: false });
    } catch (e) {
      inserted = e?.insertedDocs || [];
      insertErrs = Array.isArray(e?.writeErrors)
        ? e.writeErrors.map((we) => ({
            index: we.index,
            code: we.code,
            message: we.errmsg || we.message
          }))
        : [{ message: e?.message || 'Bulk insert error' }];
    }

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program import completed (insert)',
      rowErrors,
      summary: {
        received: rows.length,
        valid: docs.length,
        inserted: inserted.length,
        failed: insertErrs.length
      },
      insertErrors: insertErrs
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createProgram,
  viewProgram,
  updateProgram,
  deleteProgram,
  listPrograms,
  importPrograms,
  addProgramSubjects
};

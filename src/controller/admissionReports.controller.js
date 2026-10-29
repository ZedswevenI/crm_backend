import ScholarshipTest from '../models/scholarship.model.js';
import Admission from '../models/admission.model.js';
import StudentProfile from '../models/studentProfile.model.js';

const pickTid = (req) => String(req?.body?.entiId || req?.body?.tenantId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const EXPORTABLE_FIELD_REGEX = /^[a-zA-Z0-9_.]+$/;

const buildProjection = (fields, alwaysInclude = []) => {
  const projection = { _id: 0 };
  for (const f of fields) projection[f] = 1;
  for (const f of alwaysInclude) if (!projection[f]) projection[f] = 1;
  return projection;
};

// 1. Registration report — ScholarshipTest rows by testDate window, field-selectable export.
const getRegistrationReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const fields = Array.isArray(req.body?.fields) ? req.body.fields.map((f) => safeTrim(f)).filter((f) => f && EXPORTABLE_FIELD_REGEX.test(f)) : [];
    if (!fields.length) return res.status(400).json({ status: false, message: 'fields[] is required — list the field names to include in the export' });

    const query = { tenantId, isdeleted: false };
    const testDateFrom = req.body?.testDateFrom ? Number(req.body.testDateFrom) : null;
    const testDateTo = req.body?.testDateTo ? Number(req.body.testDateTo) : null;
    if (testDateFrom || testDateTo) {
      query.testDate = {};
      if (testDateFrom) query.testDate.$gte = testDateFrom;
      if (testDateTo) query.testDate.$lte = testDateTo;
    }
    if (safeTrim(req.body?.programCode)) query.programCode = safeTrim(req.body.programCode);
    if (safeTrim(req.body?.programOffered1)) query.programOffered1 = safeTrim(req.body.programOffered1);
    if (safeTrim(req.body?.testCity)) query.testCity = safeTrim(req.body.testCity);
    if (safeTrim(req.body?.testCentre)) query.testCentre = safeTrim(req.body.testCentre);
    if (safeTrim(req.body?.centerCode)) query.centerCode = safeTrim(req.body.centerCode);
    if (safeTrim(req.body?.testResultStatus)) query.testResultStatus = safeTrim(req.body.testResultStatus);

    const projection = buildProjection(fields, ['registrationNumber']);
    const rows = await ScholarshipTest.find(query, projection).sort({ testDate: -1 }).lean();
    return res.status(200).json({ status: true, message: 'Registration report loaded', count: rows.length, data: rows });
  } catch (err) {
    return next(err);
  }
};

// 1b. Registration report filter options — distinct values for the dropdowns on the filter panel.
const getRegistrationReportFilters = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const match = { tenantId, isdeleted: false };
    const clean = (values) => values.filter((v) => safeTrim(v)).sort((a, b) => a.localeCompare(b));

    const [programCode, programOffered, testCity, testCentre, centerCode, testResultStatus] = await Promise.all([
      ScholarshipTest.distinct('programCode', match),
      ScholarshipTest.distinct('programOffered1', match),
      ScholarshipTest.distinct('testCity', match),
      ScholarshipTest.distinct('testCentre', match),
      ScholarshipTest.distinct('centerCode', match),
      ScholarshipTest.distinct('testResultStatus', match)
    ]);

    return res.status(200).json({
      status: true,
      message: 'Registration report filter options loaded',
      data: {
        programCode: clean(programCode),
        programOffered: clean(programOffered),
        testCity: clean(testCity),
        testCentre: clean(testCentre),
        centerCode: clean(centerCode),
        testResultStatus: clean(testResultStatus)
      }
    });
  } catch (err) {
    return next(err);
  }
};

// 2. Enrollment report — StudentProfile rows (actually-joined students) by courseStartYear.
const getEnrollmentReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const courseStartYear = req.body?.courseStartYear ? Number(req.body.courseStartYear) : null;
    if (!courseStartYear) return res.status(400).json({ status: false, message: 'courseStartYear is required' });
    const fields = Array.isArray(req.body?.fields) ? req.body.fields.map((f) => safeTrim(f)).filter((f) => f && EXPORTABLE_FIELD_REGEX.test(f)) : [];
    if (!fields.length) return res.status(400).json({ status: false, message: 'fields[] is required — list the field names to include in the export' });

    const query = { tenantId, isdeleted: false, courseStartYear };
    if (safeTrim(req.body?.programId)) query.programId = safeTrim(req.body.programId);
    if (safeTrim(req.body?.centerId)) query.centerId = safeTrim(req.body.centerId);
    if (safeTrim(req.body?.batchId)) query.batchId = safeTrim(req.body.batchId);
    if (safeTrim(req.body?.academicYear)) query.academicYear = safeTrim(req.body.academicYear);
    if (req.body?.includeInactive !== true) query.status = 'ACTIVE';

    const projection = buildProjection(fields, ['admissionNo']);
    const rows = await StudentProfile.find(query, projection).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ status: true, message: 'Enrollment report loaded', count: rows.length, data: rows });
  } catch (err) {
    return next(err);
  }
};

// 3. SNJ report — ScholarshipTest candidates marked Selected with no CONFIRMED admission.
const getSnjReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const query = { tenantId, isdeleted: false, testResultStatus: 'PASS' };
    const testDateFrom = req.body?.testDateFrom ? Number(req.body.testDateFrom) : null;
    const testDateTo = req.body?.testDateTo ? Number(req.body.testDateTo) : null;
    if (testDateFrom || testDateTo) {
      query.testDate = {};
      if (testDateFrom) query.testDate.$gte = testDateFrom;
      if (testDateTo) query.testDate.$lte = testDateTo;
    }
    if (safeTrim(req.body?.programCode)) query.programCode = safeTrim(req.body.programCode);
    if (safeTrim(req.body?.programOffered1)) query.programOffered1 = safeTrim(req.body.programOffered1);

    const selected = await ScholarshipTest.find(query, {
      _id: 0,
      registrationNumber: 1,
      name: 1,
      email: 1,
      mobileNo: 1,
      city: 1,
      testDate: 1,
      testCity: 1,
      programOffered1: 1,
      programOffered2: 1,
      normalizedScore: 1,
      normalizedPercentage: 1,
      normalizedRank: 1,
      testResultStatus: 1
    }).lean();

    if (!selected.length) {
      return res.status(200).json({ status: true, message: 'SNJ report loaded', count: 0, data: [] });
    }

    const regNos = selected.map((s) => s.registrationNumber).filter(Boolean);
    const confirmed = await Admission.find({ tenantId, isdeleted: false, 'workflow.stage': 'CONFIRMED', registrationNumber: { $in: regNos } }, { _id: 0, registrationNumber: 1 }).lean();
    const confirmedSet = new Set(confirmed.map((a) => a.registrationNumber));

    const notJoined = selected.filter((s) => !confirmedSet.has(s.registrationNumber));
    return res.status(200).json({
      status: true,
      message: 'SNJ report loaded',
      summary: { totalSelected: selected.length, joined: selected.length - notJoined.length, notJoined: notJoined.length },
      count: notJoined.length,
      data: notJoined
    });
  } catch (err) {
    return next(err);
  }
};

// 4. Data analysis report — funnel + score-band + geography + program/center breakdowns in one pass.
const getAdmissionAnalysisReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const match = { tenantId, isdeleted: false };
    const testDateFrom = req.body?.testDateFrom ? Number(req.body.testDateFrom) : null;
    const testDateTo = req.body?.testDateTo ? Number(req.body.testDateTo) : null;
    if (testDateFrom || testDateTo) {
      match.testDate = {};
      if (testDateFrom) match.testDate.$gte = testDateFrom;
      if (testDateTo) match.testDate.$lte = testDateTo;
    }
    if (safeTrim(req.body?.programCode)) match.programCode = safeTrim(req.body.programCode);
    if (safeTrim(req.body?.testCity)) match.testCity = safeTrim(req.body.testCity);
    if (safeTrim(req.body?.centerCode)) match.centerCode = safeTrim(req.body.centerCode);

    const agg = await ScholarshipTest.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'admissions',
          let: { regNo: '$registrationNumber', tid: '$tenantId' },
          pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$tenantId', '$$tid'] }, { $eq: ['$registrationNumber', '$$regNo'] }, { $eq: ['$workflow.stage', 'CONFIRMED'] }, { $eq: ['$isdeleted', false] }] } } }, { $project: { admissionNo: 1, _id: 0 } }],
          as: 'confirmedAdmission'
        }
      },
      {
        $lookup: {
          from: 'studentprofiles',
          let: { admNo: { $arrayElemAt: ['$confirmedAdmission.admissionNo', 0] }, tid: '$tenantId' },
          pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$tenantId', '$$tid'] }, { $eq: ['$admissionNo', '$$admNo'] }, { $eq: ['$isdeleted', false] }] } } }, { $limit: 1 }],
          as: 'enrolledProfile'
        }
      },
      {
        $addFields: {
          isSelected: { $eq: ['$testResultStatus', 'PASS'] },
          isConfirmed: { $gt: [{ $size: '$confirmedAdmission' }, 0] },
          isEnrolled: { $gt: [{ $size: '$enrolledProfile' }, 0] },
          scorePct: { $convert: { input: '$normalizedPercentage', to: 'double', onError: null, onNull: null } },
          geoKey: { $trim: { input: { $toUpper: { $ifNull: ['$testCity', '$city'] } } } }
        }
      },
      {
        $facet: {
          funnel: [{ $group: { _id: null, registered: { $sum: 1 }, selected: { $sum: { $cond: ['$isSelected', 1, 0] } }, confirmed: { $sum: { $cond: ['$isConfirmed', 1, 0] } }, enrolled: { $sum: { $cond: ['$isEnrolled', 1, 0] } } } }],
          scoreBands: [
            { $bucket: { groupBy: '$scorePct', boundaries: [0, 50, 60, 70, 80, 90, 100.01], default: 'Unknown', output: { count: { $sum: 1 }, selected: { $sum: { $cond: ['$isSelected', 1, 0] } } } } }
          ],
          geography: [
            { $group: { _id: '$geoKey', registered: { $sum: 1 }, selected: { $sum: { $cond: ['$isSelected', 1, 0] } }, confirmed: { $sum: { $cond: ['$isConfirmed', 1, 0] } }, enrolled: { $sum: { $cond: ['$isEnrolled', 1, 0] } } } },
            { $sort: { registered: -1 } }
          ],
          programWise: [
            { $group: { _id: { program: '$programOffered1', center: '$centerCode' }, registered: { $sum: 1 }, selected: { $sum: { $cond: ['$isSelected', 1, 0] } }, confirmed: { $sum: { $cond: ['$isConfirmed', 1, 0] } }, enrolled: { $sum: { $cond: ['$isEnrolled', 1, 0] } } } },
            { $sort: { registered: -1 } }
          ]
        }
      }
    ]);

    const result = agg[0] || { funnel: [], scoreBands: [], geography: [], programWise: [] };
    const funnel = result.funnel[0] || { registered: 0, selected: 0, confirmed: 0, enrolled: 0 };

    return res.status(200).json({
      status: true,
      message: 'Admission analysis report loaded',
      data: {
        funnel,
        scoreBands: result.scoreBands,
        geography: result.geography,
        programWise: result.programWise.map(({ _id, ...p }) => ({ program: _id.program, center: _id.center, ...p }))
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default { getRegistrationReport, getRegistrationReportFilters, getEnrollmentReport, getSnjReport, getAdmissionAnalysisReport };

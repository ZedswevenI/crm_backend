import StudentProfile from '../models/studentProfile.model.js';
import Batch from '../models/batch.model.js';

const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const MDM_BASE_URL = () => (process.env.MDM_BASE_URL || '').replace(/\/$/, '');
const MDM_API_KEY = () => process.env.MDM_API_KEY || '';

const extListStudents = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.tenantId || '');
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId is required' });
    }

    const profiles = await StudentProfile.find(
      { tenantId, isdeleted: false, status: 'ACTIVE' },
      { admissionNo: 1, _id: 0 } // only admissionNo, nothing else
    ).lean();

    const admissionNos = profiles.map((p) => safeTrim(p.admissionNo)).filter(Boolean);

    return res.status(200).json({
      success: true,
      count: admissionNos.length,
      data: admissionNos
    });
  } catch (err) {
    return next(err);
  }
};

const extStudentProfile = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.tenantId || '');
    const admissionNo = safeTrim(req.body?.admissionNo || '');

    if (!tenantId || !admissionNo) {
      return res.status(400).json({ success: false, message: 'tenantId and admissionNo are required' });
    }

    const profile = await StudentProfile.findOne({ tenantId, admissionNo, isdeleted: false, status: 'ACTIVE' }).lean();

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // ── Fetch batch info if student is assigned to a batch ────────────────
    let batchInfo = null;
    if (profile.batchId) {
      const batch = await Batch.findOne({ tenantId, batchId: profile.batchId, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1, startDate: 1 }).lean();

      if (batch) {
        batchInfo = {
          batchId: batch.batchId || null,
          batchCode: batch.batchCode || null,
          batchName: batch.batchName || null,
          startDate: batch.startDate || null
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        // Core identity
        studentId: profile.studentId,
        admissionNo: profile.admissionNo,
        registrationNumber: profile.registrationNumber || null,
        portalStudentId: profile.portalStudentId || null,
        studentSchoolId: profile.studentSchoolId || null,

        // Student details
        name: profile.student?.name || null,
        phone: profile.student?.phone || null,
        email: profile.student?.email || null,
        parentName: profile.student?.parentName || null,
        parentPhone: profile.student?.parentPhone || null,

        // Academic context
        programId: profile.programId || null,
        programName: profile.programName || null,
        programCode: profile.programCode || null,
        centerId: profile.centerId || null,
        centerName: profile.centerName || null,
        centerCode: profile.centerCode || null,
        academicYear: profile.academicYear || null,
        currentAcademicYear: profile.currentAcademicYear || null,
        classNo: profile.classNo || null,
        yearNo: profile.yearNo || null,

        // Status
        status: profile.status,
        isTabletBlocked: profile.isTabletBlocked || false,
        photoUrl: profile.photoUrl || null,

        // Batch (populated)
        batch: batchInfo
      }
    });
  } catch (err) {
    return next(err);
  }
};

const lockStudentTablet = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId || '');
    const studentId = safeTrim(req.body?.studentId || '');
    const lockType = safeTrim(req.body?.lockType || 'SOFT_LOCK');
    const reason = safeTrim(req.body?.reason || '');

    if (!tenantId || !studentId) {
      return res.status(400).json({ status: false, message: 'entiId and studentId are required' });
    }
    if (!['SOFT_LOCK', 'HARD_LOCK'].includes(lockType)) {
      return res.status(400).json({ status: false, message: 'lockType must be SOFT_LOCK or HARD_LOCK' });
    }
    if (!MDM_BASE_URL()) {
      return res.status(500).json({ status: false, message: 'MDM backend URL not configured' });
    }

    // ── Find student profile to get admissionNo ───────────────────────────
    const profile = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false }, { admissionNo: 1, isTabletBlocked: 1 }).lean();

    if (!profile) {
      return res.status(404).json({ status: false, message: 'Student not found' });
    }

    // ── Call MDM backend ──────────────────────────────────────────────────
    const mdmResponse = await fetch(`${MDM_BASE_URL()}/api/ext/device/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MDM_API_KEY()
      },
      body: JSON.stringify({
        enrollmentNumber: profile.admissionNo,
        lockType,
        reason
      })
    });

    const mdmData = await mdmResponse.json().catch(() => ({}));

    if (!mdmResponse.ok) {
      return res.status(mdmResponse.status).json({
        status: false,
        message: mdmData?.message || 'MDM lock request failed',
        mdmError: mdmData
      });
    }

    // ── Update isTabletBlocked on StudentProfile ──────────────────────────
    await StudentProfile.updateOne({ tenantId, studentId }, { $set: { isTabletBlocked: true } });

    return res.status(200).json({
      status: true,
      message: `Tablet ${lockType === 'HARD_LOCK' ? 'hard' : 'soft'} locked successfully`,
      data: {
        studentId,
        admissionNo: profile.admissionNo,
        lockType,
        isTabletBlocked: true,
        mdm: mdmData?.data || null
      }
    });
  } catch (err) {
    // Network error reaching MDM backend
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      return res.status(502).json({ status: false, message: 'Could not reach MDM backend' });
    }
    return next(err);
  }
};

const unlockStudentTablet = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId || '');
    const studentId = safeTrim(req.body?.studentId || '');
    const reason = safeTrim(req.body?.reason || '');

    if (!tenantId || !studentId) {
      return res.status(400).json({ status: false, message: 'entiId and studentId are required' });
    }
    if (!MDM_BASE_URL()) {
      return res.status(500).json({ status: false, message: 'MDM backend URL not configured' });
    }

    // ── Find student profile ──────────────────────────────────────────────
    const profile = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false }, { admissionNo: 1, isTabletBlocked: 1 }).lean();

    if (!profile) {
      return res.status(404).json({ status: false, message: 'Student not found' });
    }

    // ── Call MDM backend ──────────────────────────────────────────────────
    const mdmResponse = await fetch(`${MDM_BASE_URL()}/api/ext/device/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MDM_API_KEY()
      },
      body: JSON.stringify({
        enrollmentNumber: profile.admissionNo,
        reason
      })
    });

    const mdmData = await mdmResponse.json().catch(() => ({}));

    if (!mdmResponse.ok) {
      return res.status(mdmResponse.status).json({
        status: false,
        message: mdmData?.message || 'MDM unlock request failed',
        mdmError: mdmData
      });
    }

    // ── Update isTabletBlocked on StudentProfile ──────────────────────────
    await StudentProfile.updateOne({ tenantId, studentId }, { $set: { isTabletBlocked: false } });

    return res.status(200).json({
      status: true,
      message: 'Tablet unlocked successfully',
      data: {
        studentId,
        admissionNo: profile.admissionNo,
        isTabletBlocked: false,
        mdm: mdmData?.data || null
      }
    });
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      return res.status(502).json({ status: false, message: 'Could not reach MDM backend' });
    }
    return next(err);
  }
};

export default {
  extListStudents,
  extStudentProfile,
  lockStudentTablet,
  unlockStudentTablet
};

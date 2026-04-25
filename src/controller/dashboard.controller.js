import StudentProfile from '../models/studentProfile.model.js';
import Staff from '../models/staff.model.js';
import User from '../models/users.model.js';
import Batch from '../models/batch.model.js';
import SchoolAttendance from '../models/schoolAttendance.model.js';
import PTM from '../models/ptm.model.js';
import Activity from '../models/activity.model.js';
import MockExamResult from '../models/mockExamResult.model.js';
import AssignmentResult from '../models/assignmentResult.model.js';
import StudentPerformance from '../models/studentperformance.model.js';
import Department from '../models/department.model.js';
import Staff_model from '../models/staff.model.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const startOfTodayMs = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const daysAgoMs = (days) => Date.now() - days * 24 * 60 * 60 * 1000;

const getPeriodRange = (period = 'week') => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (period === 'week') return { from: now - 7 * day, to: now, prevFrom: now - 14 * day, prevTo: now - 7 * day };
  if (period === 'month') return { from: now - 30 * day, to: now, prevFrom: now - 60 * day, prevTo: now - 30 * day };
  if (period === 'quarter') return { from: now - 90 * day, to: now, prevFrom: now - 180 * day, prevTo: now - 90 * day };
  return { from: now - 7 * day, to: now, prevFrom: now - 14 * day, prevTo: now - 7 * day };
};

// ─────────────────────────────────────────────────────────────────────────────
// API 1: KPI Cards — all 5 counts in one call
// POST /api/dashboard/kpis
// Body: { entiId }
// ─────────────────────────────────────────────────────────────────────────────
const getKpis = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const todayMs = startOfTodayMs();
    const threeDaysAgo = daysAgoMs(3);

    const [totalStudents, staffData, usersData, totalBatches, todayAttendance, upcomingPtmCount] = await Promise.all([
      // 1. Students — total active profiles
      StudentProfile.countDocuments({ tenantId, isdeleted: false, status: 'ACTIVE' }),

      // 2. Staff — total + teaching/non-teaching split
      Staff_model.aggregate([{ $match: { tenantId, isdeleted: false, status: 'Active' } }, { $group: { _id: '$facultyType', count: { $sum: 1 } } }]),

      // 3. Users — total active + inactive count
      Promise.all([
        User.countDocuments({ tenantId, isdeleted: false, status: 'Active' }),
        User.countDocuments({
          tenantId,
          isdeleted: false,
          status: 'Active',
          $or: [{ lastLoginAt: null }, { lastLoginAt: { $lt: new Date(threeDaysAgo) } }]
        })
      ]),

      // 4. Batches — active only
      Batch.countDocuments({ tenantId, isdeleted: false, status: 'ACTIVE' }),

      // 5. Today's attendance avg from SchoolAttendance
      SchoolAttendance.find({
        tenantId,
        date: { $gte: todayMs, $lt: todayMs + 86400000 },
        isdeleted: false
      }).lean(),

      // 6. Upcoming PTMs
      PTM.countDocuments({
        tenantId,
        ptmDate: { $gte: todayMs },
        status: { $in: ['SCHEDULED', 'COMPLETED'] },
        isdeleted: false
      })
    ]);

    // Staff breakdown
    const staffBreakdown = { TEACHING: 0, NON_TEACHING: 0, total: 0 };
    staffData.forEach(({ _id, count }) => {
      if (_id === 'TEACHING') staffBreakdown.TEACHING = count;
      else if (_id === 'NON_TEACHING') staffBreakdown.NON_TEACHING = count;
      staffBreakdown.total += count;
    });

    // Users breakdown
    const [totalUsers, inactiveUsersCount] = usersData;

    // Attendance avg for today
    let totalPresent = 0,
      totalStudentsMarked = 0;
    todayAttendance.forEach((rec) => {
      (rec.students || []).forEach((s) => {
        totalStudentsMarked++;
        if (s.status === 'PRESENT' || s.status === 'LATE') totalPresent++;
      });
    });
    const avgAttendancePct = totalStudentsMarked > 0 ? Math.round((totalPresent / totalStudentsMarked) * 100) : null;

    return res.status(200).json({
      status: true,
      message: 'KPIs loaded',
      data: {
        students: {
          total: totalStudents
        },
        staff: {
          total: staffBreakdown.total,
          teaching: staffBreakdown.TEACHING,
          nonTeaching: staffBreakdown.NON_TEACHING
        },
        users: {
          total: totalUsers,
          inactiveCount: inactiveUsersCount
        },
        batches: {
          total: totalBatches
        },
        attendance: {
          todayPct: avgAttendancePct,
          batchesMarked: todayAttendance.length
        },
        ptms: {
          upcoming: upcomingPtmCount
        }
      }
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 2: Attendance Trend — line chart (current + previous period)
// POST /api/dashboard/attendance-trend
// Body: { entiId, period } — period: 'week' | 'month' | 'quarter'
// ─────────────────────────────────────────────────────────────────────────────
const getAttendanceTrend = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const period = safeTrim(req.body?.period) || 'week';
    const { from, to, prevFrom, prevTo } = getPeriodRange(period);

    const [currentRecs, prevRecs] = await Promise.all([SchoolAttendance.find({ tenantId, date: { $gte: from, $lte: to }, isdeleted: false }).lean(), SchoolAttendance.find({ tenantId, date: { $gte: prevFrom, $lte: prevTo }, isdeleted: false }).lean()]);

    const aggregateByDate = (recs) => {
      const map = new Map();
      recs.forEach((rec) => {
        const key = rec.date;
        if (!map.has(key)) map.set(key, { present: 0, total: 0 });
        const entry = map.get(key);
        (rec.students || []).forEach((s) => {
          entry.total++;
          if (s.status === 'PRESENT' || s.status === 'LATE') entry.present++;
        });
      });
      return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([date, { present, total }]) => ({
          date,
          presentPct: total > 0 ? Math.round((present / total) * 100) : 0,
          totalStudents: total
        }));
    };

    return res.status(200).json({
      status: true,
      message: 'Attendance trend loaded',
      data: {
        period,
        current: aggregateByDate(currentRecs),
        previous: aggregateByDate(prevRecs)
      }
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 3: Students by Program — doughnut chart
// POST /api/dashboard/students-by-program
// Body: { entiId }
// ─────────────────────────────────────────────────────────────────────────────
const getStudentsByProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const data = await StudentProfile.aggregate([
      { $match: { tenantId, isdeleted: false, status: 'ACTIVE' } },
      {
        $group: {
          _id: { programId: '$programId', programName: '$programName', programCode: '$programCode' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          programId: '$_id.programId',
          programName: { $ifNull: ['$_id.programName', 'Unknown'] },
          programCode: { $ifNull: ['$_id.programCode', ''] },
          count: 1
        }
      }
    ]);

    return res.status(200).json({
      status: true,
      message: 'Students by program loaded',
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 4: Batch Performance — bar chart
// POST /api/dashboard/batch-performance
// Body: { entiId, limit }
// Uses MockExamResult for exam scores + AssignmentResult for CGPA
// ─────────────────────────────────────────────────────────────────────────────
const getBatchPerformance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const limit = Math.min(toInt(req.body?.limit, 10), 20);

    const [examPerf, assignPerf] = await Promise.all([
      // Mock exam avg score per batch
      MockExamResult.aggregate([
        { $match: { tenantId, isdeleted: false, status: { $in: ['evaluated', 'result_published'] }, batchId: { $ne: null } } },
        {
          $group: {
            _id: '$batchId',
            avgObtained: { $avg: '$obtainedMarks' },
            avgTotal: { $avg: '$totalMarks' },
            studentCount: { $addToSet: '$admissionNo' }
          }
        },
        {
          $project: {
            _id: 0,
            batchId: '$_id',
            avgExamScore: {
              $cond: [{ $gt: ['$avgTotal', 0] }, { $round: [{ $multiply: [{ $divide: ['$avgObtained', '$avgTotal'] }, 100] }, 1] }, 0]
            },
            studentCount: { $size: '$studentCount' }
          }
        }
      ]),

      // Assignment avg CGPA per batch (cgpa is 0-10, normalize to 0-100)
      AssignmentResult.aggregate([
        { $match: { tenantId, isdeleted: false, status: { $in: ['completed', 'evaluated'] }, batchId: { $ne: null } } },
        {
          $group: {
            _id: '$batchId',
            avgCgpa: { $avg: '$cgpa' }
          }
        },
        {
          $project: {
            _id: 0,
            batchId: '$_id',
            avgAssignmentScore: { $round: [{ $multiply: ['$avgCgpa', 10] }, 1] }
          }
        }
      ])
    ]);

    // Merge both by batchId
    const assignMap = new Map(assignPerf.map((a) => [a.batchId, a.avgAssignmentScore]));
    const merged = examPerf.map((e) => ({
      batchId: e.batchId,
      avgExamScore: e.avgExamScore,
      avgAssignmentScore: assignMap.get(e.batchId) ?? null,
      avgCombined: assignMap.has(e.batchId) ? Math.round((e.avgExamScore + assignMap.get(e.batchId)) / 2) : e.avgExamScore,
      studentCount: e.studentCount
    }));

    // Fetch batch names for the top N
    const topBatchIds = merged
      .sort((a, b) => b.avgCombined - a.avgCombined)
      .slice(0, limit)
      .map((x) => x.batchId);
    const batches = await Batch.find({ tenantId, batchId: { $in: topBatchIds }, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1 }).lean();
    const batchMap = new Map(batches.map((b) => [b.batchId, b]));

    const result = merged.slice(0, limit).map((x) => ({
      ...x,
      batchCode: batchMap.get(x.batchId)?.batchCode || x.batchId,
      batchName: batchMap.get(x.batchId)?.batchName || x.batchId
    }));

    return res.status(200).json({
      status: true,
      message: 'Batch performance loaded',
      data: result
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 5: Top Performers
// POST /api/dashboard/top-performers
// Body: { entiId, limit }
// ─────────────────────────────────────────────────────────────────────────────
const getTopPerformers = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const limit = Math.min(toInt(req.body?.limit, 5), 20);

    // Use combinedScore if available, else fall back to assignment.cgpa
    const performers = await StudentPerformance.aggregate([
      { $match: { tenantId, isdeleted: false } },
      {
        $group: {
          _id: '$studentId',
          admissionNo: { $first: '$admissionNo' },
          batchId: { $first: '$batchId' },
          score: {
            $avg: {
              $cond: [{ $gt: [{ $ifNull: ['$combinedScore', 0] }, 0] }, '$combinedScore', { $multiply: [{ $ifNull: ['$assignment.cgpa', 0] }, 10] }]
            }
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          studentId: '$_id',
          admissionNo: 1,
          batchId: 1,
          score: { $round: ['$score', 1] }
        }
      }
    ]);

    if (!performers.length) {
      return res.status(200).json({ status: true, message: 'No performers found', data: [] });
    }

    // Enrich with student name and batch code
    const studentIds = performers.map((p) => p.studentId);
    const batchIds = [...new Set(performers.map((p) => p.batchId).filter(Boolean))];

    const [profiles, batchList] = await Promise.all([
      StudentProfile.find({ tenantId, studentId: { $in: studentIds }, isdeleted: false }, { studentId: 1, 'student.name': 1, batchCode: 1, admissionNo: 1 }).lean(),
      Batch.find({ tenantId, batchId: { $in: batchIds }, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1 }).lean()
    ]);

    const profileMap = new Map(profiles.map((p) => [p.studentId, p]));
    const batchMap = new Map(batchList.map((b) => [b.batchId, b]));

    const data = performers.map((p, i) => {
      const profile = profileMap.get(p.studentId);
      const batch = batchMap.get(p.batchId);
      return {
        rank: i + 1,
        studentId: p.studentId,
        admissionNo: p.admissionNo,
        name: profile?.student?.name || p.admissionNo,
        batchCode: profile?.batchCode || batch?.batchCode || null,
        batchName: batch?.batchName || null,
        score: p.score,
        avatar: (profile?.student?.name || p.admissionNo || '')
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('')
      };
    });

    return res.status(200).json({ status: true, message: 'Top performers loaded', data });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 6: Inactive Users List (new card)
// POST /api/dashboard/inactive-users
// Body: { entiId, days, limit }
// ─────────────────────────────────────────────────────────────────────────────
const getInactiveUsers = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const days = toInt(req.body?.days, 3);
    const limit = Math.min(toInt(req.body?.limit, 10), 50);
    const cutoff = new Date(daysAgoMs(days));

    const query = {
      tenantId,
      isdeleted: false,
      status: 'Active',
      $or: [{ lastLoginAt: null }, { lastLoginAt: { $lt: cutoff } }]
    };

    const [users, totalInactiveCount] = await Promise.all([
      User.find(query, {
        userId: 1,
        name: 1,
        email: 1,
        roleLevel: 1,
        roleLabel: 1,
        centerId: 1,
        centerName: 1,
        lastLoginAt: 1,
        createdAt: 1
      })
        .sort({ lastLoginAt: 1 })
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);

    const data = users.map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      roleLevel: u.roleLevel,
      roleLabel: u.roleLabel,
      centerId: u.centerId || null,
      centerName: u.centerName || null,
      lastLoginAt: u.lastLoginAt || null,
      neverLoggedIn: !u.lastLoginAt,
      daysSinceLogin: u.lastLoginAt ? Math.floor((Date.now() - new Date(u.lastLoginAt).getTime()) / 86400000) : null,
      avatar: (u.name || '')
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('')
    }));

    return res.status(200).json({
      status: true,
      message: 'Inactive users loaded',
      data,
      totalInactiveCount,
      thresholdDays: days
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 7: Upcoming PTMs
// POST /api/dashboard/upcoming-ptms
// Body: { entiId, limit }
// ─────────────────────────────────────────────────────────────────────────────
const getUpcomingPtms = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const limit = Math.min(toInt(req.body?.limit, 5), 20);
    const todayMs = startOfTodayMs();

    const ptms = await PTM.find(
      {
        tenantId,
        ptmDate: { $gte: todayMs },
        status: { $in: ['SCHEDULED', 'COMPLETED'] },
        isdeleted: false
      },
      {
        ptmId: 1,
        studentName: 1,
        admissionNo: 1,
        batchCode: 1,
        centerCode: 1,
        ptmDate: 1,
        startTime: 1,
        endTime: 1,
        durationMins: 1,
        meetingMode: 1,
        venue: 1,
        status: 1
      }
    )
      .sort({ ptmDate: 1, startTime: 1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      message: 'Upcoming PTMs loaded',
      data: ptms,
      count: ptms.length
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 8: Upcoming Activities
// POST /api/dashboard/upcoming-activities
// Body: { entiId, limit, batchCode }
// ─────────────────────────────────────────────────────────────────────────────
const getUpcomingActivities = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const limit = Math.min(toInt(req.body?.limit, 5), 20);
    const batchCode = safeTrim(req.body?.batchCode) || null;
    const todayMs = startOfTodayMs();

    const query = {
      tenantId,
      startDate: { $gte: todayMs },
      status: { $in: ['PLANNED', 'IN_PROGRESS'] },
      isdeleted: false
    };
    if (batchCode) query.batchCode = batchCode;

    const activities = await Activity.find(query, {
      activityId: 1,
      activityName: 1,
      batchCode: 1,
      centerCode: 1,
      startDate: 1,
      endDate: 1,
      status: 1,
      remarks: 1
    })
      .sort({ startDate: 1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      message: 'Upcoming activities loaded',
      data: activities,
      count: activities.length
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 9: Staff by Department
// POST /api/dashboard/staff-by-department
// Body: { entiId }
// ─────────────────────────────────────────────────────────────────────────────
const getStaffByDepartment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const data = await Staff_model.aggregate([
      { $match: { tenantId, isdeleted: false, status: 'Active' } },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          teaching: {
            $sum: { $cond: [{ $eq: ['$facultyType', 'TEACHING'] }, 1, 0] }
          },
          nonTeaching: {
            $sum: { $cond: [{ $eq: ['$facultyType', 'NON_TEACHING'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Enrich with department names
    const deptIds = data.map((d) => d._id).filter(Boolean);
    const depts = await Department.find({ _id: { $in: deptIds } }, { _id: 1, departmentName: 1, departmentCode: 1 }).lean();
    const deptMap = new Map(depts.map((d) => [String(d._id), d]));

    const total = data.reduce((s, d) => s + d.count, 0);

    const result = data.map((d) => {
      const dept = deptMap.get(String(d._id));
      return {
        departmentId: d._id,
        departmentName: dept?.departmentName || 'Unknown',
        departmentCode: dept?.departmentCode || null,
        count: d.count,
        teaching: d.teaching,
        nonTeaching: d.nonTeaching,
        pct: total > 0 ? Math.round((d.count / total) * 100) : 0
      };
    });

    return res.status(200).json({
      status: true,
      message: 'Staff by department loaded',
      data: result,
      total
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 10: Recent Users
// POST /api/dashboard/recent-users
// Body: { entiId, limit }
// ─────────────────────────────────────────────────────────────────────────────
const getRecentUsers = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const limit = Math.min(toInt(req.body?.limit, 5), 20);

    const users = await User.find({ tenantId, isdeleted: false }, { userId: 1, name: 1, email: 1, roleLevel: 1, roleLabel: 1, status: 1, lastLoginAt: 1, createdAt: 1, centerId: 1, centerName: 1 }).sort({ createdAt: -1 }).limit(limit).lean();

    const data = users.map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      roleLevel: u.roleLevel,
      roleLabel: u.roleLabel,
      status: u.status,
      lastLoginAt: u.lastLoginAt || null,
      centerId: u.centerId || null,
      centerName: u.centerName || null,
      avatar: (u.name || '')
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('')
    }));

    return res.status(200).json({
      status: true,
      message: 'Recent users loaded',
      data
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API 11: Full Dashboard in one call (optional combined endpoint)
// POST /api/dashboard/summary
// Body: { entiId, period }
// Calls all sections in parallel — use this if you want one network request
// ─────────────────────────────────────────────────────────────────────────────
const getDashboardSummary = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    // Inject tenantId into req.body so sub-functions can use pickTenantId
    req.body.tenantId = tenantId;

    const todayMs = startOfTodayMs();
    const threeDaysAgo = daysAgoMs(3);
    const { from, to, prevFrom, prevTo } = getPeriodRange(req.body?.period || 'week');

    const [totalStudents, staffData, usersData, totalBatches, todayAttendance, upcomingPtmCount, studentsByProgram, examPerf, assignPerf, performers, inactiveUsers, upcomingPtms, upcomingActivities, staffByDept, recentUsers, currentAttRecs, prevAttRecs] = await Promise.all([
      StudentProfile.countDocuments({ tenantId, isdeleted: false, status: 'ACTIVE' }),
      Staff_model.aggregate([{ $match: { tenantId, isdeleted: false, status: 'Active' } }, { $group: { _id: '$facultyType', count: { $sum: 1 } } }]),
      Promise.all([User.countDocuments({ tenantId, isdeleted: false, status: 'Active' }), User.countDocuments({ tenantId, isdeleted: false, status: 'Active', $or: [{ lastLoginAt: null }, { lastLoginAt: { $lt: new Date(threeDaysAgo) } }] })]),
      Batch.countDocuments({ tenantId, isdeleted: false, status: 'ACTIVE' }),
      SchoolAttendance.find({ tenantId, date: { $gte: todayMs, $lt: todayMs + 86400000 }, isdeleted: false }).lean(),
      PTM.countDocuments({ tenantId, ptmDate: { $gte: todayMs }, status: { $in: ['SCHEDULED', 'COMPLETED'] }, isdeleted: false }),

      StudentProfile.aggregate([
        { $match: { tenantId, isdeleted: false, status: 'ACTIVE' } },
        { $group: { _id: { programId: '$programId', programName: '$programName', programCode: '$programCode' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, programId: '$_id.programId', programName: { $ifNull: ['$_id.programName', 'Unknown'] }, programCode: { $ifNull: ['$_id.programCode', ''] }, count: 1 } }
      ]),

      MockExamResult.aggregate([
        { $match: { tenantId, isdeleted: false, status: { $in: ['evaluated', 'result_published'] }, batchId: { $ne: null } } },
        { $group: { _id: '$batchId', avgObtained: { $avg: '$obtainedMarks' }, avgTotal: { $avg: '$totalMarks' }, studentCount: { $addToSet: '$admissionNo' } } },
        { $project: { _id: 0, batchId: '$_id', avgExamScore: { $cond: [{ $gt: ['$avgTotal', 0] }, { $round: [{ $multiply: [{ $divide: ['$avgObtained', '$avgTotal'] }, 100] }, 1] }, 0] }, studentCount: { $size: '$studentCount' } } }
      ]),

      AssignmentResult.aggregate([
        { $match: { tenantId, isdeleted: false, status: { $in: ['completed', 'evaluated'] }, batchId: { $ne: null } } },
        { $group: { _id: '$batchId', avgCgpa: { $avg: '$cgpa' } } },
        { $project: { _id: 0, batchId: '$_id', avgAssignmentScore: { $round: [{ $multiply: ['$avgCgpa', 10] }, 1] } } }
      ]),

      StudentPerformance.aggregate([
        { $match: { tenantId, isdeleted: false } },
        { $group: { _id: '$studentId', admissionNo: { $first: '$admissionNo' }, batchId: { $first: '$batchId' }, score: { $avg: { $cond: [{ $gt: [{ $ifNull: ['$combinedScore', 0] }, 0] }, '$combinedScore', { $multiply: [{ $ifNull: ['$assignment.cgpa', 0] }, 10] }] } } } },
        { $sort: { score: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, studentId: '$_id', admissionNo: 1, batchId: 1, score: { $round: ['$score', 1] } } }
      ]),

      User.find({ tenantId, isdeleted: false, status: 'Active', $or: [{ lastLoginAt: null }, { lastLoginAt: { $lt: new Date(threeDaysAgo) } }] }, { userId: 1, name: 1, email: 1, roleLevel: 1, roleLabel: 1, centerId: 1, centerName: 1, lastLoginAt: 1 })
        .sort({ lastLoginAt: 1 })
        .limit(10)
        .lean(),

      PTM.find({ tenantId, ptmDate: { $gte: todayMs }, status: { $in: ['SCHEDULED', 'COMPLETED'] }, isdeleted: false }, { ptmId: 1, studentName: 1, admissionNo: 1, batchCode: 1, centerCode: 1, ptmDate: 1, startTime: 1, endTime: 1, durationMins: 1, meetingMode: 1, venue: 1, status: 1 })
        .sort({ ptmDate: 1, startTime: 1 })
        .limit(5)
        .lean(),

      Activity.find({ tenantId, startDate: { $gte: todayMs }, status: { $in: ['PLANNED', 'IN_PROGRESS'] }, isdeleted: false }, { activityId: 1, activityName: 1, batchCode: 1, centerCode: 1, startDate: 1, endDate: 1, status: 1 })
        .sort({ startDate: 1 })
        .limit(5)
        .lean(),

      Staff_model.aggregate([
        { $match: { tenantId, isdeleted: false, status: 'Active' } },
        { $group: { _id: '$department', count: { $sum: 1 }, teaching: { $sum: { $cond: [{ $eq: ['$facultyType', 'TEACHING'] }, 1, 0] } }, nonTeaching: { $sum: { $cond: [{ $eq: ['$facultyType', 'NON_TEACHING'] }, 1, 0] } } } },
        { $sort: { count: -1 } }
      ]),

      User.find({ tenantId, isdeleted: false }, { userId: 1, name: 1, email: 1, roleLevel: 1, roleLabel: 1, status: 1, lastLoginAt: 1, createdAt: 1, centerId: 1, centerName: 1 }).sort({ createdAt: -1 }).limit(5).lean(),

      SchoolAttendance.find({ tenantId, date: { $gte: from, $lte: to }, isdeleted: false }).lean(),
      SchoolAttendance.find({ tenantId, date: { $gte: prevFrom, $lte: prevTo }, isdeleted: false }).lean()
    ]);

    // ── Process KPIs ──────────────────────────────────────────────────────────
    const staffBreakdown = { TEACHING: 0, NON_TEACHING: 0, total: 0 };
    staffData.forEach(({ _id, count }) => {
      if (_id === 'TEACHING') staffBreakdown.TEACHING = count;
      else if (_id === 'NON_TEACHING') staffBreakdown.NON_TEACHING = count;
      staffBreakdown.total += count;
    });
    const [totalUsers, inactiveCount] = usersData;
    let totalPresent = 0,
      totalMarked = 0;
    todayAttendance.forEach((rec) => {
      (rec.students || []).forEach((s) => {
        totalMarked++;
        if (s.status === 'PRESENT' || s.status === 'LATE') totalPresent++;
      });
    });

    // ── Process attendance trend ──────────────────────────────────────────────
    const aggregateByDate = (recs) => {
      const map = new Map();
      recs.forEach((rec) => {
        if (!map.has(rec.date)) map.set(rec.date, { present: 0, total: 0 });
        const e = map.get(rec.date);
        (rec.students || []).forEach((s) => {
          e.total++;
          if (s.status === 'PRESENT' || s.status === 'LATE') e.present++;
        });
      });
      return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([date, { present, total }]) => ({ date, presentPct: total > 0 ? Math.round((present / total) * 100) : 0, totalStudents: total }));
    };

    // ── Process batch performance ─────────────────────────────────────────────
    const assignMap = new Map(assignPerf.map((a) => [a.batchId, a.avgAssignmentScore]));
    const mergedPerf = examPerf
      .map((e) => ({
        batchId: e.batchId,
        avgExamScore: e.avgExamScore,
        avgAssignmentScore: assignMap.get(e.batchId) ?? null,
        avgCombined: assignMap.has(e.batchId) ? Math.round((e.avgExamScore + assignMap.get(e.batchId)) / 2) : e.avgExamScore,
        studentCount: e.studentCount
      }))
      .sort((a, b) => b.avgCombined - a.avgCombined)
      .slice(0, 8);

    const topBatchIds = mergedPerf.map((x) => x.batchId);
    const batchDocs = await Batch.find({ tenantId, batchId: { $in: topBatchIds }, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1 }).lean();
    const batchMap = new Map(batchDocs.map((b) => [b.batchId, b]));
    const batchPerf = mergedPerf.map((x) => ({ ...x, batchCode: batchMap.get(x.batchId)?.batchCode || x.batchId, batchName: batchMap.get(x.batchId)?.batchName || x.batchId }));

    // ── Process top performers ────────────────────────────────────────────────
    const perfStudentIds = performers.map((p) => p.studentId);
    const perfBatchIds = [...new Set(performers.map((p) => p.batchId).filter(Boolean))];
    const [perfProfiles, perfBatches] = await Promise.all([
      StudentProfile.find({ tenantId, studentId: { $in: perfStudentIds }, isdeleted: false }, { studentId: 1, 'student.name': 1, batchCode: 1 }).lean(),
      Batch.find({ tenantId, batchId: { $in: perfBatchIds }, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1 }).lean()
    ]);
    const profileMap = new Map(perfProfiles.map((p) => [p.studentId, p]));
    const perfBatchMap = new Map(perfBatches.map((b) => [b.batchId, b]));
    const topPerformers = performers.map((p, i) => {
      const profile = profileMap.get(p.studentId);
      const batch = perfBatchMap.get(p.batchId);
      return {
        rank: i + 1,
        studentId: p.studentId,
        admissionNo: p.admissionNo,
        name: profile?.student?.name || p.admissionNo,
        batchCode: profile?.batchCode || batch?.batchCode || null,
        score: p.score,
        avatar: (profile?.student?.name || p.admissionNo || '')
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('')
      };
    });

    // ── Process inactive users ────────────────────────────────────────────────
    const inactiveUsersList = inactiveUsers.map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      roleLevel: u.roleLevel,
      roleLabel: u.roleLabel,
      centerId: u.centerId || null,
      centerName: u.centerName || null,
      lastLoginAt: u.lastLoginAt || null,
      neverLoggedIn: !u.lastLoginAt,
      daysSinceLogin: u.lastLoginAt ? Math.floor((Date.now() - new Date(u.lastLoginAt).getTime()) / 86400000) : null,
      avatar: (u.name || '')
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('')
    }));

    // ── Process staff by dept ─────────────────────────────────────────────────
    const deptIds = staffByDept.map((d) => d._id).filter(Boolean);
    const deptDocs = await Department.find({ _id: { $in: deptIds } }, { _id: 1, departmentName: 1, departmentCode: 1 }).lean();
    const deptMap = new Map(deptDocs.map((d) => [String(d._id), d]));
    const totalStaffForDept = staffByDept.reduce((s, d) => s + d.count, 0);
    const staffDeptList = staffByDept.map((d) => {
      const dept = deptMap.get(String(d._id));
      return { departmentId: d._id, departmentName: dept?.departmentName || 'Unknown', departmentCode: dept?.departmentCode || null, count: d.count, teaching: d.teaching, nonTeaching: d.nonTeaching, pct: totalStaffForDept > 0 ? Math.round((d.count / totalStaffForDept) * 100) : 0 };
    });

    // ── Final response ────────────────────────────────────────────────────────
    return res.status(200).json({
      status: true,
      message: 'Dashboard summary loaded',
      data: {
        kpis: {
          students: { total: totalStudents },
          staff: { total: staffBreakdown.total, teaching: staffBreakdown.TEACHING, nonTeaching: staffBreakdown.NON_TEACHING },
          users: { total: totalUsers, inactiveCount },
          batches: { total: totalBatches },
          attendance: { todayPct: totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : null, batchesMarked: todayAttendance.length },
          ptms: { upcoming: upcomingPtmCount }
        },
        attendanceTrend: {
          period: req.body?.period || 'week',
          current: aggregateByDate(currentAttRecs),
          previous: aggregateByDate(prevAttRecs)
        },
        studentsByProgram,
        batchPerformance: batchPerf,
        topPerformers,
        inactiveUsers: { list: inactiveUsersList, totalCount: inactiveCount, thresholdDays: 3 },
        upcomingPtms: { data: upcomingPtms, count: upcomingPtms.length },
        upcomingActivities: { data: upcomingActivities, count: upcomingActivities.length },
        staffByDepartment: { data: staffDeptList, total: totalStaffForDept },
        recentUsers: recentUsers.map((u) => ({
          userId: u.userId,
          name: u.name,
          email: u.email,
          roleLevel: u.roleLevel,
          roleLabel: u.roleLabel,
          status: u.status,
          lastLoginAt: u.lastLoginAt || null,
          centerId: u.centerId || null,
          centerName: u.centerName || null,
          avatar: (u.name || '')
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() || '')
            .join('')
        }))
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  getKpis,
  getAttendanceTrend,
  getStudentsByProgram,
  getBatchPerformance,
  getTopPerformers,
  getInactiveUsers,
  getUpcomingPtms,
  getUpcomingActivities,
  getStaffByDepartment,
  getRecentUsers,
  getDashboardSummary
};

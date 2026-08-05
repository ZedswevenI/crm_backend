import { Router } from 'express';
const routes = Router();
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import performanceController from '../controller/performance.controller.js';


// ── Sync ──────────────────────────────────────────────────────────────────────
routes.post('/sync/assignment', validatetoken, requirePermission('performance:sync'), performanceController.syncAssignmentPerf);
routes.post('/sync/mock', validatetoken, requirePermission('performance:sync'), performanceController.syncMockExamPerf);
routes.post('/sync/school', validatetoken, requirePermission('performance:sync'), performanceController.syncSchoolExamPerf);
routes.post('/sync/all', validatetoken, requirePermission('performance:sync'), performanceController.syncAllPerformance);
routes.post('/sync/batch', validatetoken, requirePermission('performance:sync'), performanceController.syncBatchPerformance);

// ── Student read ──────────────────────────────────────────────────────────────
routes.post('/student/full', validatetoken, requirePermission('performance:view'), performanceController.getStudentPerformanceFull);
routes.post('/student/mock-list', validatetoken, requirePermission('performance:view'), performanceController.getStudentMockList);
routes.post('/student/school-list', validatetoken, requirePermission('performance:view'), performanceController.getStudentSchoolList);

// ── Batch read ────────────────────────────────────────────────────────────────
routes.post('/batch/list', validatetoken, requirePermission('performance:list'), performanceController.getBatchPerformanceList);
routes.post('/batch/leaderboard', validatetoken, requirePermission('performance:list'), performanceController.getBatchLeaderboard);
routes.post('/batch/report', validatetoken, requirePermission('performance:view'), performanceController.getBatchReport);

// ── Override ──────────────────────────────────────────────────────────────────
routes.post('/assignment/override', validatetoken, requirePermission('performance:override'), performanceController.overrideAssignmentPerf);

// ── Student staff feedback ────────────────────────────────────────────────────
routes.post('/student/feedback/add', validatetoken, requirePermission('performance:override'), performanceController.addStudentFeedback);
routes.post('/student/feedback/delete', validatetoken, requirePermission('performance:override'), performanceController.deleteStudentFeedback);

// ── Staff performance (rating) ────────────────────────────────────────────────
routes.post('/staff/feedback/add', validatetoken, requirePermission('performance:override'), performanceController.addStaffFeedback);
routes.post('/staff/feedback/list', validatetoken, requirePermission('performance:list'), performanceController.listStaffFeedback);
routes.post('/staff/feedback/update', validatetoken, requirePermission('performance:override'), performanceController.updateStaffFeedback);
routes.post('/staff/feedback/delete', validatetoken, requirePermission('performance:override'), performanceController.deleteStaffFeedback);
routes.post('/staff/list', validatetoken, requirePermission('performance:list'), performanceController.listAllStaffPerf);

routes.use('/', (req, res) => res.json({ message: 'Inside Performance routes' }));

export default routes;

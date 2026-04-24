import { Router } from 'express';
const routes = Router();
import validatetoken from '../middlewares/auth.js';
import performanceController from '../controller/performance.controller.js';

// ── Sync ──────────────────────────────────────────────────────────────────────
routes.post('/sync/assignment', validatetoken, performanceController.syncAssignmentPerf);
routes.post('/sync/mock', validatetoken, performanceController.syncMockExamPerf);
routes.post('/sync/school', validatetoken, performanceController.syncSchoolExamPerf);
routes.post('/sync/all', validatetoken, performanceController.syncAllPerformance);
routes.post('/sync/batch', validatetoken, performanceController.syncBatchPerformance);

// ── Student read ──────────────────────────────────────────────────────────────
routes.post('/student/full', validatetoken, performanceController.getStudentPerformanceFull);
routes.post('/student/mock-list', validatetoken, performanceController.getStudentMockList);
routes.post('/student/school-list', validatetoken, performanceController.getStudentSchoolList);

// ── Batch read ────────────────────────────────────────────────────────────────
routes.post('/batch/list', validatetoken, performanceController.getBatchPerformanceList);
routes.post('/batch/leaderboard', validatetoken, performanceController.getBatchLeaderboard);
routes.post('/batch/report', validatetoken, performanceController.getBatchReport);

// ── Override ──────────────────────────────────────────────────────────────────
routes.post('/assignment/override', validatetoken, performanceController.overrideAssignmentPerf);

// ── Student staff feedback ────────────────────────────────────────────────────
routes.post('/student/feedback/add', validatetoken, performanceController.addStudentFeedback);
routes.post('/student/feedback/delete', validatetoken, performanceController.deleteStudentFeedback);

// ── Staff performance (rating) ────────────────────────────────────────────────
routes.post('/staff/feedback/add', validatetoken, performanceController.addStaffFeedback);
routes.post('/staff/feedback/list', validatetoken, performanceController.listStaffFeedback);
routes.post('/staff/feedback/update', validatetoken, performanceController.updateStaffFeedback);
routes.post('/staff/feedback/delete', validatetoken, performanceController.deleteStaffFeedback);
routes.post('/staff/list', validatetoken, performanceController.listAllStaffPerf);

routes.use('/', (req, res) => res.json({ message: 'Inside Performance routes' }));

export default routes;

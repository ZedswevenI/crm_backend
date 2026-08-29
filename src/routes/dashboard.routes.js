import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import dashboardController from '../controller/dashboard.controller.js';

const dv = requirePermission('dashboard:view');

routes.post('/kpis', validatetoken, dv, dashboardController.getKpis);
routes.post('/attendance-trend', validatetoken, dv, dashboardController.getAttendanceTrend);
routes.post('/students-by-program', validatetoken, dv, dashboardController.getStudentsByProgram);
routes.post('/batch-performance', validatetoken, dv, dashboardController.getBatchPerformance);
routes.post('/top-performers', validatetoken, dv, dashboardController.getTopPerformers);
routes.post('/inactive-users', validatetoken, dv, dashboardController.getInactiveUsers);
routes.post('/upcoming-ptms', validatetoken, dv, dashboardController.getUpcomingPtms);
routes.post('/upcoming-activities', validatetoken, dv, dashboardController.getUpcomingActivities);
routes.post('/staff-by-department', validatetoken, dv, dashboardController.getStaffByDepartment);
routes.post('/recent-users', validatetoken, dv, dashboardController.getRecentUsers);
routes.post('/summary', validatetoken, dv, dashboardController.getDashboardSummary);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Batch routes' }));

export default routes;

import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import dashboardController from '../controller/dashboard.controller.js';

routes.post('/kpis', validatetoken, dashboardController.getKpis);
routes.post('/attendance-trend', validatetoken, dashboardController.getAttendanceTrend);
routes.post('/students-by-program', validatetoken, dashboardController.getStudentsByProgram);
routes.post('/batch-performance', validatetoken, dashboardController.getBatchPerformance);
routes.post('/top-performers', validatetoken, dashboardController.getTopPerformers);
routes.post('/inactive-users', validatetoken, dashboardController.getInactiveUsers);
routes.post('/upcoming-ptms', validatetoken, dashboardController.getUpcomingPtms);
routes.post('/upcoming-activities', validatetoken, dashboardController.getUpcomingActivities);
routes.post('/staff-by-department', validatetoken, dashboardController.getStaffByDepartment);
routes.post('/recent-users', validatetoken, dashboardController.getRecentUsers);
routes.post('/summary', validatetoken, dashboardController.getDashboardSummary);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Batch routes' }));

export default routes;

import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import timeTableController from '../controller/timetable.controller.js';

routes.post('/create', validatetoken, timeTableController.createTimeTable);
routes.post('/import', validatetoken, timeTableController.bulkUploadTimeTables);
routes.post('/view', validatetoken, timeTableController.viewTimeTable);
routes.post('/list-by-batch', validatetoken, timeTableController.listTimeTablesByBatch);
routes.post('/list', validatetoken, timeTableController.listTimeTables);
routes.post('/period/cancel', validatetoken, timeTableController.cancelPeriod);
routes.post('/period/rearrange-staff', validatetoken, timeTableController.rearrangeStaff);
routes.post('/period/move', validatetoken, timeTableController.changePeriod);
routes.post('/period/replace', validatetoken, timeTableController.replacePeriod);
routes.post('/day/cancel', validatetoken, timeTableController.cancelWholeDay);
routes.post('/day/edit', validatetoken, timeTableController.editWholeDay);

routes.post('/late-entry/log', validatetoken, timeTableController.logLateEntry);
routes.post('/late-entry/list/student', validatetoken, timeTableController.listStudentLateEntries);
routes.post('/late-entry/list/staff', validatetoken, timeTableController.listStaffLateEntries);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Timetable routes' }));

export default routes;

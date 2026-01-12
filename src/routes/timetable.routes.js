import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import timeTableController from '../controller/timetable.controller.js';

routes.post('/timetable/create', validatetoken, timeTableController.createTimeTable);
routes.post('/timetable/view', validatetoken, timeTableController.viewTimeTable);
routes.post('/timetable/list-by-batch', validatetoken, timeTableController.listTimeTablesByBatch);
routes.post('/timetable/list', validatetoken, timeTableController.listTimeTables);
routes.post('/timetable/period/cancel', validatetoken, timeTableController.cancelPeriod);
routes.post('/timetable/period/rearrange-staff', validatetoken, timeTableController.rearrangeStaff);
routes.post('/timetable/period/move', validatetoken, timeTableController.changePeriod);
routes.post('/timetable/period/replace', validatetoken, timeTableController.replacePeriod);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Timetable routes' }));

export default routes;

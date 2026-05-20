import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import timeTableController from '../controller/timetable.controller.js';

routes.post('/create', validatetoken, timeTableController.createTimeTable);
routes.post('/validate', validatetoken, timeTableController.validateSchedule);
routes.post('/import', validatetoken, timeTableController.bulkUploadTimeTables);
routes.post('/view', validatetoken, timeTableController.viewTimeTable);
routes.post('/viewbybatch', validatetoken, timeTableController.viewBatchScheduleByDate);
routes.post('/list-by-batch', validatetoken, timeTableController.listTimeTablesByBatch);
routes.post('/list', validatetoken, timeTableController.listTimeTables);
routes.post('/period/add', validatetoken, timeTableController.addPeriod);
routes.post('/period/cancel', validatetoken, timeTableController.cancelPeriod);
routes.post('/period/rearrange-staff', validatetoken, timeTableController.rearrangeStaff);
routes.post('/period/move', validatetoken, timeTableController.changePeriod);
routes.post('/period/replace', validatetoken, timeTableController.replacePeriod);
routes.post('/day/cancel', validatetoken, timeTableController.cancelWholeDay);
routes.post('/day/edit', validatetoken, timeTableController.editWholeDay);
routes.post('/update/zoomlink', validatetoken, timeTableController.updateZoomLink);
routes.post('/convertToExam', validatetoken, timeTableController.convertToExam);
routes.post('/bulk/zoomlink/upload', validatetoken, timeTableController.bulkUpdateZoomLinks);

routes.post('/late-entry/log', validatetoken, timeTableController.logLateEntry);
routes.post('/late-entry/list/student', validatetoken, timeTableController.listStudentLateEntries);
routes.post('/late-entry/list/staff', validatetoken, timeTableController.listStaffLateEntries);
routes.post('/subject/report', validatetoken, timeTableController.subjectHoursReport);

routes.post('/publish', validatetoken, timeTableController.publishTimeTable);
routes.post('/unpublish', validatetoken, timeTableController.unpublishTimeTable);
routes.post('/delete', validatetoken, timeTableController.deleteTimeTable);
routes.post('/clone-week', validatetoken, timeTableController.cloneWeek);
routes.post('/day/uncancel', validatetoken, timeTableController.uncancelDay);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Timetable routes' }));

export default routes;

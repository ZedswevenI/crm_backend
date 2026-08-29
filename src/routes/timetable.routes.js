import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import timeTableController from '../controller/timetable.controller.js';


routes.post('/create', validatetoken, requirePermission('timetable:create'), timeTableController.createTimeTable);
routes.post('/validate', validatetoken, requirePermission('timetable:create'), timeTableController.validateSchedule);
routes.post('/import', validatetoken, requirePermission('timetable:create'), timeTableController.bulkUploadTimeTables);
routes.post('/view', validatetoken, requirePermission('timetable:view'), timeTableController.viewTimeTable);
routes.post('/viewbybatch', validatetoken, requirePermission('timetable:view'), timeTableController.viewBatchScheduleByDate);
routes.post('/list-by-batch', validatetoken, requirePermission('timetable:list'), timeTableController.listTimeTablesByBatch);
routes.post('/list', validatetoken, requirePermission('timetable:list'), timeTableController.listTimeTables);
routes.post('/period/add', validatetoken, requirePermission('timetable:edit'), timeTableController.addPeriod);
routes.post('/period/cancel', validatetoken, requirePermission('timetable:edit'), timeTableController.cancelPeriod);
routes.post('/period/rearrange-staff', validatetoken, requirePermission('timetable:edit'), timeTableController.rearrangeStaff);
routes.post('/period/move', validatetoken, requirePermission('timetable:edit'), timeTableController.changePeriod);
routes.post('/period/replace', validatetoken, requirePermission('timetable:edit'), timeTableController.replacePeriod);
routes.post('/day/cancel', validatetoken, requirePermission('timetable:edit'), timeTableController.cancelWholeDay);
routes.post('/day/edit', validatetoken, requirePermission('timetable:edit'), timeTableController.editWholeDay);
routes.post('/update/zoomlink', validatetoken, requirePermission('timetable:edit'), timeTableController.updateZoomLink);
routes.post('/convertToExam', validatetoken, requirePermission('timetable:edit'), timeTableController.convertToExam);
routes.post('/bulk/zoomlink/upload', validatetoken, requirePermission('timetable:edit'), timeTableController.bulkUpdateZoomLinks);

routes.post('/late-entry/log', validatetoken, requirePermission('batch:logLateEntry'), timeTableController.logLateEntry);
routes.post('/late-entry/list/student', validatetoken, requirePermission('batch:view'), timeTableController.listStudentLateEntries);
routes.post('/late-entry/list/staff', validatetoken, requirePermission('batch:view'), timeTableController.listStaffLateEntries);
routes.post('/subject/report', validatetoken, requirePermission('timetable:export'), timeTableController.subjectHoursReport);

routes.post('/publish', validatetoken, requirePermission('timetable:publish'), timeTableController.publishTimeTable);
routes.post('/unpublish', validatetoken, requirePermission('timetable:revertDraft'), timeTableController.unpublishTimeTable);
routes.post('/delete', validatetoken, requirePermission('timetable:delete'), timeTableController.deleteTimeTable);
routes.post('/clone-week', validatetoken, requirePermission('timetable:create'), timeTableController.cloneWeek);
routes.post('/day/uncancel', validatetoken, requirePermission('timetable:edit'), timeTableController.uncancelDay);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Timetable routes' }));

export default routes;

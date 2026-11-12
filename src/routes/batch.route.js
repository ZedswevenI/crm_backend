import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import batchCtrl from '../controller/batch.controller.js';
import sclAtdnceCtrl from '../controller/schoolAttendance.controller.js';


routes.post('/create', validatetoken, requirePermission('batch:create'), batchCtrl.createBatch);
routes.post('/close', validatetoken, requirePermission('batch:close'), batchCtrl.closeBatch);
routes.post('/list', validatetoken, requirePermission('batch:list'), batchCtrl.listBatches);
routes.post('/view', validatetoken, requirePermission('batch:view'), batchCtrl.viewBatch);
routes.post('/update', validatetoken, requirePermission('batch:edit'), batchCtrl.updateBatch);
routes.post('/delete', validatetoken, requirePermission('batch:delete'), batchCtrl.deleteBatch);
routes.post('/staff/save', validatetoken, requirePermission('batch:assignFaculty'), batchCtrl.saveBatchStaffMap);
routes.post('/students/eligible', validatetoken, requirePermission('batch:list'), batchCtrl.listEligibleStudentsForBatch);
routes.post('/students/assign', validatetoken, requirePermission('batch:assignStudents'), batchCtrl.assignStudentsToBatch);
routes.post('/students/move', validatetoken, requirePermission('batch:assignStudents'), batchCtrl.moveStudentsToBatch);
routes.post('/students/remove', validatetoken, requirePermission('batch:assignStudents'), batchCtrl.removeStudentsFromBatch);
routes.post('/students/shuffle', validatetoken, requirePermission('batch:shuffleStudents'), batchCtrl.shuffleStudentsBetweenBatches);
routes.post('/recalc', validatetoken, requirePermission('batch:edit'), batchCtrl.recalcBatchStudentCount);
routes.post('/subjects', validatetoken, requirePermission('batch:view'), batchCtrl.getBatchSubjects);
routes.post('/ayinfo', validatetoken, requirePermission('batch:view'), batchCtrl.getBatchAyInfo);
routes.post('/promote', validatetoken, requirePermission('batch:promote'), batchCtrl.promoteBatch);
routes.post('/class-teacher/assign', validatetoken, requirePermission('batch:assignFaculty'), batchCtrl.assignClassTeacher);
routes.post('/staffmap-history', validatetoken, requirePermission('batch:view'), batchCtrl.getBatchStaffMapHistory);

routes.post('/school-attendance/batches', validatetoken, requirePermission('schoolAttendance:list'), sclAtdnceCtrl.listBatchesForSchoolAttendance);
routes.post('/school-attendance/students', validatetoken, requirePermission('schoolAttendance:list'), sclAtdnceCtrl.getSchoolAttendanceStudents);
routes.post('/school-attendance/mark', validatetoken, requirePermission('schoolAttendance:mark'), sclAtdnceCtrl.markSchoolAttendance);
routes.post('/school-attendance/summary', validatetoken, requirePermission('schoolAttendance:list'), sclAtdnceCtrl.getSchoolAttendanceSummary);
routes.post('/school-attendance/monthly-report', validatetoken, requirePermission('schoolAttendance:export'), sclAtdnceCtrl.getMonthlyAttendanceReport);
routes.post('/school-attendance/range-report', validatetoken, requirePermission('schoolAttendance:export'), sclAtdnceCtrl.getAttendanceRangeReport);
routes.post('/school-attendance/first-batch-report', validatetoken, requirePermission('schoolAttendance:export'), sclAtdnceCtrl.getFirstBatchAttendanceReport);
routes.post('/school-attendance/marked-check', validatetoken, requirePermission('schoolAttendance:list'), sclAtdnceCtrl.checkMarkedBatches);

routes.post('/school-attendance/holiday/declare', validatetoken, requirePermission('schoolAttendance:declareHoliday'), sclAtdnceCtrl.declareHoliday);
routes.post('/school-attendance/holiday/declare-all-batches', validatetoken, requirePermission('schoolAttendance:declareHoliday'), sclAtdnceCtrl.declareHolidayForAllBatches);
routes.post('/school-attendance/holiday/remove', validatetoken, requirePermission('schoolAttendance:removeHoliday'), sclAtdnceCtrl.removeHoliday);
routes.post('/school-attendance/holiday/list', validatetoken, requirePermission('schoolAttendance:list'), sclAtdnceCtrl.listHolidays);
routes.post('/school-attendance/finalise', validatetoken, requirePermission('schoolAttendance:finalise'), sclAtdnceCtrl.finaliseAttendance);
routes.post('/school-attendance/batch-status-report', validatetoken, requirePermission('schoolAttendance:export'), sclAtdnceCtrl.getBatchAttendanceStatusReport);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Batch routes' }));

export default routes;

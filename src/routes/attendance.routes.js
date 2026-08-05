import { Router } from 'express';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import attendanceController from '../controller/attendance.controller.js';

const routes = Router();

routes.post('/mark', validatetoken, requirePermission('attendance:mark'), attendanceController.markAttendance);
routes.post('/absentees', validatetoken, requirePermission('attendance:report'), attendanceController.getAbsenteesReport);
routes.post('/pending', validatetoken, requirePermission('attendance:list'), attendanceController.getPendingAttendance);
routes.post('/schedule/staff', validatetoken, requirePermission('attendance:list'), attendanceController.getStaffSchedule);
routes.post('/schedule/student', validatetoken, requirePermission('attendance:list'), attendanceController.getStudentSchedule);
routes.post('/students/list', validatetoken, requirePermission('attendance:list'), attendanceController.getStudentsForAttendance);
routes.post('/list', validatetoken, requirePermission('attendance:list'), attendanceController.listAttendanceByDate);
routes.post('/schedule/withattendance', validatetoken, requirePermission('attendance:list'), attendanceController.getScheduleWithAttendance);
routes.post('/schedule/withattendance-range', validatetoken, requirePermission('attendance:list'), attendanceController.getScheduleWithAttendanceRange);
routes.post('/remarks/period', validatetoken, requirePermission('attendance:edit'), attendanceController.updatePeriodAttendanceRemarks);
routes.post('/remarks/school', validatetoken, requirePermission('attendance:edit'), attendanceController.updateSchoolAttendanceRemarks);

export default routes;

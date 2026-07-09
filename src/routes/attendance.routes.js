import { Router } from 'express';
import validatetoken from '../middlewares/auth.js';
import attendanceController from '../controller/attendance.controller.js';

const routes = Router();

routes.post('/mark', validatetoken, attendanceController.markAttendance);
routes.post('/absentees', validatetoken, attendanceController.getAbsenteesReport);
routes.post('/pending', validatetoken, attendanceController.getPendingAttendance);
routes.post('/schedule/staff', validatetoken, attendanceController.getStaffSchedule);
routes.post('/schedule/student', validatetoken, attendanceController.getStudentSchedule);
routes.post('/students/list', validatetoken, attendanceController.getStudentsForAttendance);
routes.post('/list', validatetoken, attendanceController.listAttendanceByDate);
routes.post('/schedule/withattendance', validatetoken, attendanceController.getScheduleWithAttendance);
routes.post('/remarks/period', validatetoken, attendanceController.updatePeriodAttendanceRemarks);
routes.post('/remarks/school', validatetoken, attendanceController.updateSchoolAttendanceRemarks);

export default routes;

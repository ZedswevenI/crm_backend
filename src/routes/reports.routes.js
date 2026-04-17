import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import batchReCtrl from '../controller/batchReports.controller.js';
import studentReCtrl from '../controller/studentReports.controller.js';
import staffReCtrl from '../controller/teacherReports.controller.js';

routes.post('/batch/students', validatetoken, batchReCtrl.getStudentListReport);
routes.post('/batch/staff', validatetoken, batchReCtrl.getStaffListReport);
routes.post('/batch/late-entries', validatetoken, batchReCtrl.getLateEntryReport);
routes.post('/batch/timetable', validatetoken, batchReCtrl.getTimetableReport);
routes.post('/batch/phase-allotment', validatetoken, batchReCtrl.getPhaseAllotmentReport);
routes.post('/batch/assignments', validatetoken, batchReCtrl.getAssignmentCompletionReport);
routes.post('/batch/exams', validatetoken, batchReCtrl.getExamCompletionReport);
routes.post('/batch/batch-info', validatetoken, batchReCtrl.getBatchInfoReport);
routes.post('/batch/subject-hours', validatetoken, batchReCtrl.getSubjectHoursReport);
routes.post('/batch/feedback', validatetoken, batchReCtrl.getFeedbackReport);
routes.post('/batch/ptm', validatetoken, batchReCtrl.getBatchPtmReport);

routes.post('/student/attendance', validatetoken, studentReCtrl.getStudentAttendanceReport);
routes.post('/student/remarks', validatetoken, studentReCtrl.getStudentRemarksReport);
routes.post('/student/late-entries', validatetoken, studentReCtrl.getStudentLateEntryReport);

routes.post('/teacher/batches', validatetoken, staffReCtrl.getFacultyBatchReport);
routes.post('/teacher/tasks', validatetoken, staffReCtrl.getTaskReport);
routes.post('/teacher/late-entries', validatetoken, staffReCtrl.getStaffLateEntryReport);
routes.post('/teacher/early-leaving', validatetoken, staffReCtrl.getStaffEarlyLeavingReport);
routes.post('/teacher/assignments', validatetoken, staffReCtrl.getStaffAssignmentReport);
routes.post('/teacher/attendance', validatetoken, staffReCtrl.getStaffAttendanceReport);
routes.post('/teacher/feedback', validatetoken, staffReCtrl.getStaffFeedbackReport);
routes.post('/teacher/exams', validatetoken, staffReCtrl.getStaffExamReport);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Batch routes' }));

export default routes;

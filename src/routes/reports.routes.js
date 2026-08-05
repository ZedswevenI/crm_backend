import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import batchReCtrl from '../controller/batchReports.controller.js';
import studentReCtrl from '../controller/studentReports.controller.js';
import staffReCtrl from '../controller/teacherReports.controller.js';

const rv = requirePermission('reports:view');

routes.post('/batch/students', validatetoken, rv, batchReCtrl.getStudentListReport);
routes.post('/batch/staff', validatetoken, rv, batchReCtrl.getStaffListReport);
routes.post('/batch/late-entries', validatetoken, rv, batchReCtrl.getLateEntryReport);
routes.post('/batch/timetable', validatetoken, rv, batchReCtrl.getTimetableReport);
routes.post('/batch/phase-allotment', validatetoken, rv, batchReCtrl.getPhaseAllotmentReport);
routes.post('/batch/assignments', validatetoken, rv, batchReCtrl.getAssignmentCompletionReport);
routes.post('/batch/exams', validatetoken, rv, batchReCtrl.getExamCompletionReport);
routes.post('/batch/batch-info', validatetoken, rv, batchReCtrl.getBatchInfoReport);
routes.post('/batch/subject-hours', validatetoken, rv, batchReCtrl.getSubjectHoursReport);
routes.post('/batch/feedback', validatetoken, rv, batchReCtrl.getFeedbackReport);
routes.post('/batch/ptm', validatetoken, rv, batchReCtrl.getBatchPtmReport);
routes.post('/batch/cgpa', validatetoken, rv, batchReCtrl.getCgpaReport);
routes.post('/batch/slash', validatetoken, rv, batchReCtrl.getSlashReport);
routes.post('/batch/subjects-by-batch', validatetoken, rv, batchReCtrl.getSubjectsByBatch);
routes.post('/batch/assignment-report', validatetoken, rv, batchReCtrl.getAssignmentReport);
routes.post('/batch/slash-detail', validatetoken, rv, batchReCtrl.getSlashDetailReport);

routes.post('/student/attendance', validatetoken, rv, studentReCtrl.getStudentAttendanceReport);
routes.post('/student/remarks', validatetoken, rv, studentReCtrl.getStudentRemarksReport);
routes.post('/student/late-entries', validatetoken, rv, studentReCtrl.getStudentLateEntryReport);
routes.post('/student/attendance-bulk', validatetoken, rv, studentReCtrl.getStudentAttendanceBulkReport);
routes.post('/student/remarks-bulk', validatetoken, rv, studentReCtrl.getStudentRemarksBulkReport);
routes.post('/student/late-entries-bulk', validatetoken, rv, studentReCtrl.getStudentLateEntriesBulkReport);

routes.post('/teacher/batches', validatetoken, rv, staffReCtrl.getFacultyBatchReport);
routes.post('/teacher/tasks', validatetoken, rv, staffReCtrl.getTaskReport);
routes.post('/teacher/late-entries', validatetoken, rv, staffReCtrl.getStaffLateEntryReport);
routes.post('/teacher/early-leaving', validatetoken, rv, staffReCtrl.getStaffEarlyLeavingReport);
routes.post('/teacher/assignments', validatetoken, rv, staffReCtrl.getStaffAssignmentReport);
routes.post('/teacher/attendance', validatetoken, rv, staffReCtrl.getStaffAttendanceReport);
routes.post('/teacher/feedback', validatetoken, rv, staffReCtrl.getStaffFeedbackReport);
routes.post('/teacher/exams', validatetoken, rv, staffReCtrl.getStaffExamReport);
routes.post('/teacher/load', validatetoken, rv, staffReCtrl.getFacultyLoadReport);
routes.post('/teacher/faculty-report', validatetoken, rv, staffReCtrl.getFacultyReport);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Batch routes' }));

export default routes;

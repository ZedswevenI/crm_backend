import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import batchReCtrl from '../controller/batchReports.controller.js';

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

routes.use('/', (req, res, next) => res.json({ message: 'Inside Batch routes' }));

export default routes;

import { Router } from 'express';
import constants from '../helpers/constants.js';

const routes = Router();

import tenantRoute from './tenant.routes.js';
import admissionRoute from './admission.routes.js';
import accountsRoute from './accounts.routes.js';
import batchRoute from './batch.route.js';
import timetableRoute from './timetable.routes.js';
import studentRoute from './student.routes.js';
import assignmentRoute from './assignment.routes.js';
import attendanceRoute from './attendance.routes.js';
import teacherRoute from './teacher.routes.js';
import manageRoute from './manage.routes.js';
import mockexamRoute from './mockExam.routes.js';
import feedbackRoute from './feedback.routes.js';
import reportRoute from './reports.routes.js';
import dashboardRoute from './dashboard.routes.js';
import performanceRoute from './performance.routes.js';
import communicationRoutes from './communication.routes.js';

routes.post('/healthcheck', (req, res) => {
  try {
    return res.status(constants.HTTPS_SUCCESS).send({ status: true, message: `Z7I IMS API works!` });
  } catch (error) {
    return res.status(constants.HTTPS_INTERNAL_ERROR).send({ status: false, message: `Error in Z7I IMS API!`, error: error });
  }
});

routes.use('/ims', tenantRoute);
routes.use('/institue', manageRoute);
routes.use('/admi', admissionRoute);
routes.use('/dashboard', dashboardRoute);
routes.use('/accounts', accountsRoute);
routes.use('/batch', batchRoute);
routes.use('/timetable', timetableRoute);
routes.use('/student', studentRoute);
routes.use('/assignment', assignmentRoute);
routes.use('/attendance', attendanceRoute);
routes.use('/teacher', teacherRoute);
routes.use('/exam', mockexamRoute);
routes.use('/feedback', feedbackRoute);
routes.use('/reports', reportRoute);
routes.use('/performance', performanceRoute);
routes.use('/communication', communicationRoutes);

export default routes;

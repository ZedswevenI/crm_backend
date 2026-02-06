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

routes.post('/healthcheck', (req, res) => {
  try {
    return res.status(constants.HTTPS_SUCCESS).send({ status: true, message: `Z7I IMS API works!` });
  } catch (error) {
    return res.status(constants.HTTPS_INTERNAL_ERROR).send({ status: false, message: `Error in Z7I IMS API!`, error: error });
  }
});

routes.use('/ims', tenantRoute);
routes.use('/admi', admissionRoute);
routes.use('/accounts', accountsRoute);
routes.use('/batch', batchRoute);
routes.use('/timetable', timetableRoute);
routes.use('/student', studentRoute);
routes.use('/assignment', assignmentRoute);

export default routes;

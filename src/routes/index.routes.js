import { Router } from 'express';
import constants from '../helpers/constants.js';

const routes = Router();

import tenantRoute from './tenant.routes.js';
import admissionRoute from './admission.routes.js';

routes.post('/healthcheck', (req, res) => {
  try {
    return res.status(constants.HTTPS_SUCCESS).send({ status: true, message: `Z7I IMS API works!` });
  } catch (error) {
    return res.status(constants.HTTPS_INTERNAL_ERROR).send({ status: false, message: `Error in Z7I IMS API!`, error: error });
  }
});

routes.use('/ims', tenantRoute);
routes.use('/admi', admissionRoute);

export default routes;

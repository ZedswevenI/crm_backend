import { Router } from 'express';
import constants from '../helpers/constants.js';

const routes = Router();

import tenantRoute from './tenant.routes.js';

//HealthCheck
routes.post('/healthcheck', (req, res) => {
  try {
    return res.status(constants.HTTPS_SUCCESS).send({ status: true, message: `CMMS API works!` });
  } catch (error) {
    return res.status(constants.HTTPS_INTERNAL_ERROR).send({ status: false, message: `Error in CMMS API!`, error: error });
  }
});

// Other Routes
routes.use('/ims', tenantRoute);

export default routes;

import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import tenantCtrl from '../controller/tenant.controller.js';
import dashCtrl from '../controller/dashboard.controller.js';

routes.post('/register', tenantCtrl.createTenant);
routes.post('/login', tenantCtrl.Loginuser);
routes.post('/auth/refresh', tenantCtrl.refreshToken);
routes.post('/logout', validatetoken, tenantCtrl.logout);

routes.post('/create', validatetoken, tenantCtrl.createUser);
routes.post('/list', validatetoken, tenantCtrl.listUsers);
routes.post('/edit', validatetoken, tenantCtrl.updateUser);
routes.post('/delete', validatetoken, tenantCtrl.deleteUser);
routes.post('/view', validatetoken, tenantCtrl.viewUser);
routes.post('/change', validatetoken, tenantCtrl.changePassword);

routes.post('/dashboard', validatetoken, dashCtrl.questionDashboardSummary);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Tenant routes' }));

export default routes;

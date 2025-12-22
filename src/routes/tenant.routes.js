import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import tenantCtrl from '../controller/institute.controller.js';
import programCtrl from '../controller/program.controller.js';

routes.post('/register', tenantCtrl.createInstitute);
routes.post('/view', validatetoken, tenantCtrl.viewInstitute);
routes.post('/update', validatetoken, tenantCtrl.updateInstitute);

// Center Routes
routes.post('/center/create', validatetoken, tenantCtrl.createCenter);
routes.post('/center/list', validatetoken, tenantCtrl.listCenters);
routes.post('/center/edit', validatetoken, tenantCtrl.updateCenter);
routes.post('/center/delete', validatetoken, tenantCtrl.deleteCenter);
routes.post('/center/view', validatetoken, tenantCtrl.viewCenter);

// User Routes
routes.post('/user/login', tenantCtrl.Loginuser);
routes.post('/user/auth/refresh', tenantCtrl.refreshToken);
routes.post('/user/logout', validatetoken, tenantCtrl.logout);
routes.post('/user/change', validatetoken, tenantCtrl.changePassword);
routes.post('/user/create', validatetoken, tenantCtrl.createUser);
routes.post('/user/list', validatetoken, tenantCtrl.listUsers);
routes.post('/user/edit', validatetoken, tenantCtrl.updateUser);
routes.post('/user/delete', validatetoken, tenantCtrl.deleteUser);
routes.post('/user/view', validatetoken, tenantCtrl.viewUser);

// program Routes
routes.post('/program/create', validatetoken, programCtrl.createProgram);
routes.post('/program/list', validatetoken, programCtrl.listPrograms);
routes.post('/program/edit', validatetoken, programCtrl.updateProgram);
routes.post('/program/delete', validatetoken, programCtrl.deleteProgram);
routes.post('/program/view', validatetoken, programCtrl.viewProgram);

// Center Routes
routes.post('/feeplan/create', validatetoken, tenantCtrl.createFeePlan);
routes.post('/feeplan/list', validatetoken, tenantCtrl.listFeePlans);
routes.post('/feeplan/edit', validatetoken, tenantCtrl.updateFeePlan);
routes.post('/feeplan/delete', validatetoken, tenantCtrl.deleteFeePlan);
routes.post('/feeplan/view', validatetoken, tenantCtrl.viewFeePlan);
routes.post('/feeplan/bulkupload', validatetoken, tenantCtrl.bulkUpsertFeePlansFromRows);
routes.post('/feeplan/setstatus', validatetoken, tenantCtrl.setFeePlanStatus);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Tenant routes' }));

export default routes;

import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import tenantCtrl from '../controller/institute.controller.js';
import manageCtrl from '../controller/insorg.controller.js';
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
routes.post('/program/addsubjects', validatetoken, programCtrl.addProgramSubjects);
routes.post('/program/import', validatetoken, programCtrl.importPrograms);

// Center Routes
routes.post('/feeplan/create', validatetoken, tenantCtrl.createFeePlan);
routes.post('/feeplan/list', validatetoken, tenantCtrl.listFeePlans);
routes.post('/feeplan/edit', validatetoken, tenantCtrl.updateFeePlan);
routes.post('/feeplan/delete', validatetoken, tenantCtrl.deleteFeePlan);
routes.post('/feeplan/view', validatetoken, tenantCtrl.viewFeePlan);
routes.post('/feeplan/bulkupload', validatetoken, tenantCtrl.bulkUpsertFeePlansFromRows);
routes.post('/feeplan/setstatus', validatetoken, tenantCtrl.setFeePlanStatus);

// Center Routes
routes.post('/bankac/create', validatetoken, tenantCtrl.createBankAccount);
routes.post('/bankac/list', validatetoken, tenantCtrl.listBankAccounts);
routes.post('/bankac/edit', validatetoken, tenantCtrl.updateBankAccount);
routes.post('/bankac/delete', validatetoken, tenantCtrl.deleteBankAccount);
routes.post('/bankac/view', validatetoken, tenantCtrl.viewBankAccount);
routes.post('/bankac/bulkupload', validatetoken, tenantCtrl.bulkImportBankAccounts);

// Department Routes
routes.post('/dept/create', validatetoken, manageCtrl.createDepartment);
routes.post('/dept/list', validatetoken, manageCtrl.listDepartments);
routes.post('/dept/view', validatetoken, manageCtrl.viewDepartment);
routes.post('/dept/update', validatetoken, manageCtrl.updateDepartment);
routes.post('/dept/delete', validatetoken, manageCtrl.deleteDepartment);
routes.post('/dept/import', validatetoken, manageCtrl.bulkImportDepartments);

// Subject Routes
routes.post('/subject/create', validatetoken, manageCtrl.createSubject);
routes.post('/subject/list', validatetoken, manageCtrl.listSubject);
routes.post('/subject/view', validatetoken, manageCtrl.viewSubject);
routes.post('/subject/update', validatetoken, manageCtrl.updateSubject);
routes.post('/subject/delete', validatetoken, manageCtrl.deleteSubject);
routes.post('/subject/import', validatetoken, manageCtrl.bulkImportSubject);

// Staff Routes
routes.post('/staff/create', validatetoken, tenantCtrl.createStaff);
routes.post('/staff/list', validatetoken, tenantCtrl.listStaff);
routes.post('/staff/view', validatetoken, tenantCtrl.viewStaff);
routes.post('/staff/update', validatetoken, tenantCtrl.updateStaff);
routes.post('/staff/delete', validatetoken, tenantCtrl.deleteStaff);
routes.post('/staff/import', validatetoken, tenantCtrl.bulkImportStaff);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Tenant routes' }));

export default routes;

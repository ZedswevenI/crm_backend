import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import admisCtrl from '../controller/admission.controller.js';


routes.post('/portal/fetch', validatetoken, requirePermission('admission:create'), admisCtrl.fetchScholarshipRegistration);

routes.post('/create', validatetoken, requirePermission('admission:create'), admisCtrl.createAdmissionDraft);
routes.post('/payments/save', validatetoken, requirePermission('admission:create'), admisCtrl.saveAdmissionPayments);
routes.post('/submit-approval', validatetoken, requirePermission('admission:submitForApproval'), admisCtrl.submitForApproval);
routes.post('/approve', validatetoken, requirePermission('admission:approve'), admisCtrl.approveAdmission);
routes.post('/reject', validatetoken, requirePermission('admission:reject'), admisCtrl.rejectAdmission);
routes.post('/update', validatetoken, requirePermission('admission:update'), admisCtrl.updateAdmission);
routes.post('/view', validatetoken, requirePermission('admission:view'), admisCtrl.viewAdmission);
routes.post('/list', validatetoken, requirePermission('admission:list'), admisCtrl.listAdmissions);
routes.post('/export', validatetoken, requirePermission('admission:export'), admisCtrl.exportAdmissions);
routes.post('/paymenttemplate', validatetoken, requirePermission('admission:view'), admisCtrl.getPaymentTemplate);
routes.post('/bulkupload', validatetoken, requirePermission('admission:bulkUpload'), admisCtrl.bulkUploadStudents);
routes.post('/review', validatetoken, requirePermission('admission:review'), admisCtrl.putUnderReview);

routes.post('/create/student', validatetoken, requirePermission('admission:approve'), admisCtrl.createStudentProfileFromAdmission);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Admission routes' }));

export default routes;

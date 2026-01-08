import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import admisCtrl from '../controller/admission.controller.js';

routes.post('/portal/fetch', validatetoken, admisCtrl.fetchScholarshipRegistration);

routes.post('/create', validatetoken, admisCtrl.createAdmissionDraft);
routes.post('/payments/save', validatetoken, admisCtrl.saveAdmissionPayments);
routes.post('/submit-approval', validatetoken, admisCtrl.submitForApproval);
routes.post('/approve', validatetoken, admisCtrl.approveAdmission);
routes.post('/reject', validatetoken, admisCtrl.rejectAdmission);
routes.post('/update', validatetoken, admisCtrl.updateAdmission);
routes.post('/view', validatetoken, admisCtrl.viewAdmission);
routes.post('/list', validatetoken, admisCtrl.listAdmissions);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Admission routes' }));

export default routes;

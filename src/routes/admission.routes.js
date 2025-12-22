import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import admisCtrl from '../controller/admission.controller.js';

routes.post('/portal/fetch', admisCtrl.fetchScholarshipRegistration);

routes.post('/create', admisCtrl.createAdmissionDraft);
routes.post('/payments/save', admisCtrl.saveAdmissionPayments);
routes.post('/submit-approval', admisCtrl.submitForApproval);
routes.post('/approve', admisCtrl.approveAdmission);
routes.post('/view', admisCtrl.viewAdmission);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Admission routes' }));

export default routes;

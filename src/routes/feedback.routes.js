import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import feedbackCtrl from '../controller/feedback.controller.js';

routes.post('/template/create', validatetoken, requirePermission('feedbackTemplate:create'), feedbackCtrl.createTemplate);
routes.post('/template/list', validatetoken, requirePermission('feedbackTemplate:list'), feedbackCtrl.listTemplates);
routes.post('/template/active', validatetoken, requirePermission('feedbackTemplate:list'), feedbackCtrl.listActiveTemplates);
routes.post('/template/view', validatetoken, requirePermission('feedbackTemplate:list'), feedbackCtrl.viewTemplate);
routes.post('/template/update', validatetoken, requirePermission('feedbackTemplate:edit'), feedbackCtrl.updateTemplate);
routes.post('/template/togglestatus', validatetoken, requirePermission('feedbackTemplate:toggleStatus'), feedbackCtrl.toggleTemplateStatus);
routes.post('/template/delete', validatetoken, requirePermission('feedbackTemplate:delete'), feedbackCtrl.deleteTemplate);

routes.post('/create', validatetoken, requirePermission('feedback:create'), feedbackCtrl.createFeedbackForm);
routes.post('/list', validatetoken, requirePermission('feedback:list'), feedbackCtrl.listFeedbackForms);
routes.post('/view', validatetoken, requirePermission('feedback:list'), feedbackCtrl.viewFeedbackForm);
routes.post('/update', validatetoken, requirePermission('feedback:edit'), feedbackCtrl.updateFeedbackForm);
routes.post('/status', validatetoken, requirePermission('feedback:changeStatus'), feedbackCtrl.changeFeedbackFormStatus);
routes.post('/delete', validatetoken, requirePermission('feedback:delete'), feedbackCtrl.deleteFeedbackForm);
routes.post('/results', validatetoken, requirePermission('feedback:viewResults'), feedbackCtrl.viewFeedbackResults);
routes.post('/report', validatetoken, requirePermission('feedback:consolidatedReport'), feedbackCtrl.getConsolidatedReport);
routes.post('/student/active', feedbackCtrl.getActiveFormsForStudent);
routes.post('/student/submit', feedbackCtrl.submitFeedback);
routes.post('/student/submitted', feedbackCtrl.checkSubmitted);
routes.post('/report-staff-list', validatetoken, requirePermission('feedback:consolidatedReport'), feedbackCtrl.getReportStaffList);
routes.post('/consolidated-report', validatetoken, requirePermission('feedback:consolidatedReport'), feedbackCtrl.getConsolidatedStaffReport);
routes.post('/remarks-report', validatetoken, requirePermission('feedback:consolidatedReport'), feedbackCtrl.getStaffRemarksReport);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Feedback routes' }));

export default routes;

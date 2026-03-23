import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import feedbackCtrl from '../controller/feedback.controller.js';

routes.post('/template/create', validatetoken, feedbackCtrl.createTemplate);
routes.post('/template/list', validatetoken, feedbackCtrl.listTemplates);
routes.post('/template/active', validatetoken, feedbackCtrl.listActiveTemplates);
routes.post('/template/view', validatetoken, feedbackCtrl.viewTemplate);
routes.post('/template/update', validatetoken, feedbackCtrl.updateTemplate);
routes.post('/template/togglestatus', validatetoken, feedbackCtrl.toggleTemplateStatus);
routes.post('/template/delete', validatetoken, feedbackCtrl.deleteTemplate);

routes.post('/create', validatetoken, feedbackCtrl.createFeedbackForm);
routes.post('/list', validatetoken, feedbackCtrl.listFeedbackForms);
routes.post('/view', validatetoken, feedbackCtrl.viewFeedbackForm);
routes.post('/update', validatetoken, feedbackCtrl.updateFeedbackForm);
routes.post('/status', validatetoken, feedbackCtrl.changeFeedbackFormStatus);
routes.post('/delete', validatetoken, feedbackCtrl.deleteFeedbackForm);
routes.post('/results', validatetoken, feedbackCtrl.viewFeedbackResults);
routes.post('/student/forms', feedbackCtrl.getActiveFormsForStudent);
routes.post('/student/submit', feedbackCtrl.submitFeedback);
routes.post('/student/check', feedbackCtrl.checkSubmitted);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Feedback routes' }));

export default routes;

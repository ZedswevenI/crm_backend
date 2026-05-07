import { Router } from 'express';

const routes = Router();

import validatetoken from '../middlewares/auth.js';
import communicationCtrl from '../controller/communication.controller.js';

routes.post('/template/create', validatetoken, communicationCtrl.createTemplate);
routes.post('/template/update', validatetoken, communicationCtrl.updateTemplate);
routes.post('/template/list', validatetoken, communicationCtrl.listTemplates);
routes.post('/template/view', validatetoken, communicationCtrl.viewTemplate);
routes.post('/template/delete', validatetoken, communicationCtrl.deleteTemplate);
routes.post('/recipients/preview', validatetoken, communicationCtrl.previewRecipients);
routes.post('/send', validatetoken, communicationCtrl.sendCommunication);
routes.post('/campaign/list', validatetoken, communicationCtrl.listCampaigns);
routes.post('/logs/list', validatetoken, communicationCtrl.listLogs);
routes.post('/logs/view', validatetoken, communicationCtrl.viewLog);
routes.post('/logs/retry', validatetoken, communicationCtrl.retryFailedLog);

routes.post('/event-config/save', validatetoken, communicationCtrl.saveEventConfig);
routes.post('/event-config/list', validatetoken, communicationCtrl.listEventConfigs);
routes.post('/event-config/toggle', validatetoken, communicationCtrl.toggleEventConfig);
routes.post('/event-config/delete', validatetoken, communicationCtrl.deleteEventConfig);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Communication routes' }));

export default routes;

import { Router } from 'express';

const routes = Router();

import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import communicationCtrl from '../controller/communication.controller.js';
import { uploadQuestionImage } from '../middlewares/multer.js';

routes.post('/template/create', validatetoken, requirePermission('communicationTemplate:create'), communicationCtrl.createTemplate);
routes.post('/template/update', validatetoken, requirePermission('communicationTemplate:edit'), communicationCtrl.updateTemplate);
routes.post('/template/list', validatetoken, requirePermission('communicationTemplate:list'), communicationCtrl.listTemplates);
routes.post('/template/view', validatetoken, requirePermission('communicationTemplate:list'), communicationCtrl.viewTemplate);
routes.post('/template/delete', validatetoken, requirePermission('communicationTemplate:delete'), communicationCtrl.deleteTemplate);
routes.post('/recipients/preview', validatetoken, requirePermission('communication:previewRecipients'), communicationCtrl.previewRecipients);
routes.post('/send', validatetoken, requirePermission('communication:send'), communicationCtrl.sendCommunication);
routes.post('/send/batch', validatetoken, requirePermission('communication:send'), communicationCtrl.sendBatchCommunication);
routes.post('/exam-result/send', validatetoken, requirePermission('communication:send'), communicationCtrl.sendExamResultEmail);
routes.post('/campaign/list', validatetoken, requirePermission('communicationLog:list'), communicationCtrl.listCampaigns);
routes.post('/logs/list', validatetoken, requirePermission('communicationLog:list'), communicationCtrl.listLogs);
routes.post('/logs/view', validatetoken, requirePermission('communicationLog:view'), communicationCtrl.viewLog);
routes.post('/logs/retry', validatetoken, requirePermission('communicationLog:retry'), communicationCtrl.retryFailedLog);

routes.post('/event-config/save', validatetoken, requirePermission('communicationEvent:create'), communicationCtrl.saveEventConfig);
routes.post('/event-config/list', validatetoken, requirePermission('communicationEvent:list'), communicationCtrl.listEventConfigs);
routes.post('/event-config/toggle', validatetoken, requirePermission('communicationEvent:edit'), communicationCtrl.toggleEventConfig);
routes.post('/event-config/delete', validatetoken, requirePermission('communicationEvent:delete'), communicationCtrl.deleteEventConfig);

routes.post('/excel-bulk-mail/send', validatetoken, requirePermission('communicationBulkMail:send'), communicationCtrl.sendExcelBulkMail);
routes.post('/email-asset/upload', validatetoken, requirePermission('communication:create'), uploadQuestionImage, communicationCtrl.uploadEmailAsset);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Communication routes' }));

export default routes;

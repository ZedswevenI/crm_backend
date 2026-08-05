import { Router } from 'express';
import helpCtrl from '../controller/help.controller.js';

const routes = Router();

routes.post('/create', helpCtrl.createHelp);
routes.post('/update', helpCtrl.updateHelp);
routes.post('/delete', helpCtrl.deleteHelp);
routes.post('/view', helpCtrl.viewHelp);
routes.post('/list', helpCtrl.listHelp);
routes.post('/modules', helpCtrl.listModules);
routes.post('/module/sort-order', helpCtrl.updateModuleSortOrder);
routes.post('/topic/sort-order', helpCtrl.updateTopicSortOrder);

export default routes;

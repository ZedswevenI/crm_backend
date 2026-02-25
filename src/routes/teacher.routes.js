import { Router } from 'express';

const routes = Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
import validatetoken from '../middlewares/auth.js';
import taskCtrl from '../controller/task.controller.js';
import libraryCtrl from '../controller/material.controller.js';

routes.post('/task/upload', validatetoken, upload.single('file'), taskCtrl.uploadTaskAttachment);
routes.post('/task/create', validatetoken, taskCtrl.createTask);
routes.post('/task/edit', validatetoken, taskCtrl.editTask);
routes.post('/task/list', validatetoken, taskCtrl.listTasks);
routes.post('/task/update-status', validatetoken, taskCtrl.updateTaskStatus);
routes.post('/task/mark-in-progress', validatetoken, taskCtrl.markTaskInProgress);

routes.post('/library/upload', validatetoken, upload.single('file'), libraryCtrl.uploadMaterialFile);
routes.post('/library/create', validatetoken, libraryCtrl.createMaterial);
routes.post('/library/edit', validatetoken, libraryCtrl.editMaterial);
routes.post('/library/make-inactive', validatetoken, libraryCtrl.makeInactive);
routes.post('/library/delete', validatetoken, libraryCtrl.deleteMaterial);
routes.post('/library/list', validatetoken, libraryCtrl.listMaterials);
routes.post('/library/view', validatetoken, libraryCtrl.viewMaterial);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Teacher routes' }));

export default routes;

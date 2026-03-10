import { Router } from 'express';

const routes = Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
import validatetoken from '../middlewares/auth.js';
import taskCtrl from '../controller/task.controller.js';
import staffCtrl from '../controller/staff.controller.js';

routes.post('/task/upload', validatetoken, upload.single('file'), taskCtrl.uploadTaskAttachment);
routes.post('/task/create', validatetoken, taskCtrl.createTask);
routes.post('/task/edit', validatetoken, taskCtrl.editTask);
routes.post('/task/list', validatetoken, taskCtrl.listTasks);
routes.post('/task/update-status', validatetoken, taskCtrl.updateTaskStatus);
routes.post('/task/mark-in-progress', validatetoken, taskCtrl.markTaskInProgress);

routes.post('/list', validatetoken, staffCtrl.listTeachingStaff);
routes.post('/view', validatetoken, staffCtrl.viewTeachingStaff);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Teacher routes' }));

export default routes;

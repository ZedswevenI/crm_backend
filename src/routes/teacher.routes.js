import { Router } from 'express';

const routes = Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import taskCtrl from '../controller/task.controller.js';
import staffCtrl from '../controller/staff.controller.js';
import userCtrl from '../controller/user.controller.js';


routes.post('/task/upload', validatetoken, requirePermission('task:create'), upload.single('file'), taskCtrl.uploadTaskAttachment);
routes.post('/task/create', validatetoken, requirePermission('task:create'), taskCtrl.createTask);
routes.post('/task/edit', validatetoken, requirePermission('task:edit'), taskCtrl.editTask);
routes.post('/task/list', validatetoken, requirePermission('task:list'), taskCtrl.listTasks);
routes.post('/task/view', validatetoken, requirePermission('task:view'), taskCtrl.viewTask);
routes.post('/task/update-status', validatetoken, requirePermission('task:edit'), taskCtrl.updateTaskStatus);
routes.post('/task/mark-in-progress', validatetoken, requirePermission('task:edit'), taskCtrl.markTaskInProgress);

routes.post('/list', validatetoken, requirePermission('teacher:list'), staffCtrl.listTeachingStaff);
routes.post('/view', validatetoken, requirePermission('teacher:view'), staffCtrl.viewTeachingStaff);
routes.post('/getstaffmaps', validatetoken, requirePermission('teacher:view'), staffCtrl.getTeacherBatches);
routes.post('/dashboard', validatetoken, requirePermission('teacher:view'), staffCtrl.getTeacherDashboard);
// FCM token registration is self-service device management, not a business permission — no requirePermission gate.
routes.post('/fcm/register', validatetoken, userCtrl.registerFcmToken);
routes.post('/fcm/remove', validatetoken, userCtrl.removeFcmToken);
routes.post('/fcm/test', userCtrl.testFcmNotification);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Teacher routes' }));

export default routes;

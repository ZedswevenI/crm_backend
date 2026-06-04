import { Router } from 'express';
import extApiAuth from '../middlewares/extApiAuth.js';
import extStudentCtrl from '../controller/extStudent.controller.js';

const routes = Router();

routes.post('/list', extApiAuth, extStudentCtrl.extListStudents);
routes.post('/profile', extApiAuth, extStudentCtrl.extStudentProfile);

export default routes;

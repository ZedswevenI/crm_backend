import { Router } from 'express';

const routes = Router();
import validatetoken from '../middlewares/auth.js';
import studentCtrl from '../controller/student.controller.js';

routes.post('/list', validatetoken, studentCtrl.listStudents);
routes.post('/view', validatetoken, studentCtrl.viewProfile);
routes.post('/finance/summary', validatetoken, studentCtrl.viewFinancials);
routes.post('/academic/summary', validatetoken, studentCtrl.viewAcademicSummary);

routes.post('/login', studentCtrl.studentLogin);
routes.post('/get/assnsubjects', studentCtrl.getStudentSubjects);
routes.post('/get/assignments', studentCtrl.getAllClassSubjectTopics);
routes.post('/download/assignments', studentCtrl.getStudentTopicsTests);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Student routes' }));

export default routes;

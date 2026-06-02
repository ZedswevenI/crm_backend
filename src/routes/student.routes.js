import { Router } from 'express';

const routes = Router();
import validatetoken from '../middlewares/auth.js';
import studentCtrl from '../controller/student.controller.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

routes.post('/list', validatetoken, studentCtrl.listStudents);
routes.post('/view', validatetoken, studentCtrl.viewProfile);
routes.post('/finance/summary', validatetoken, studentCtrl.viewFinancials);
routes.post('/academic/summary', validatetoken, studentCtrl.viewAcademicSummary);

routes.post('/login', studentCtrl.studentLogin);
routes.post('/get/assnsubjects', studentCtrl.getStudentSubjects);
routes.post('/get/assignments', studentCtrl.getAllClassSubjectTopics);
routes.post('/download/assignments', studentCtrl.getStudentTopicsTests);

routes.post('/getimetable', studentCtrl.getStudentTimetable);
routes.post('/getattendance', studentCtrl.getStudentAttendance);
routes.post('/getmymaterials/report', studentCtrl.getStudentMaterialSubjects);
routes.post('/getmyprofile', studentCtrl.getStudentProfileView);
routes.post('/getmymaterials', studentCtrl.getStudentMaterials);
routes.post('/getattendance/report', studentCtrl.getStudentAttendanceReport);

routes.post('/remark/add', studentCtrl.addStudentRemark);
routes.post('/remark/list', studentCtrl.getStudentRemarks);
routes.post('/basic-details/update', studentCtrl.updateBasicDetails);
routes.post('/tablet-access/toggle', studentCtrl.toggleTabletAccess);
routes.post('/school-exam/marks/add', studentCtrl.addSchoolExamMarks);

routes.post('/bulk-update', studentCtrl.bulkUpdateStudents);
routes.post('/bulk-image-upload', upload.array('images', 100), studentCtrl.bulkUploadPhotos);
routes.post('/late-entries', studentCtrl.getStudentLateEntries);
routes.post('/rpa-import', validatetoken, studentCtrl.importStudentRpa);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Student routes' }));

export default routes;

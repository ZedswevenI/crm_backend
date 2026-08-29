import { Router } from 'express';

const routes = Router();
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import studentCtrl from '../controller/student.controller.js';
import extstudentCtrl from '../controller/extStudent.controller.js';

import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

routes.post('/list', validatetoken, requirePermission('student:list'), studentCtrl.listStudents);
routes.post('/export', validatetoken, requirePermission('student:export'), studentCtrl.exportStudents);
routes.post('/view', validatetoken, requirePermission('student:view'), studentCtrl.viewProfile);
routes.post('/finance/summary', validatetoken, requirePermission('student:view'), studentCtrl.viewFinancials);
routes.post('/academic/summary', validatetoken, requirePermission('student:view'), studentCtrl.viewAcademicSummary);
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
routes.post('/my-performance', studentCtrl.getStudentPerformance);
// routes.post('/school-exam/marks/add', studentCtrl.addSchoolExamMarks);
routes.post('/bulk-update', studentCtrl.bulkUpdateStudents);
routes.post('/bulk-image-upload', upload.array('images', 100), studentCtrl.bulkUploadPhotos);
routes.post('/zip-image-upload', validatetoken, requirePermission('student:imageUpload'), upload.single('zip'), studentCtrl.bulkUploadZipPhotos);
routes.post('/late-entries', studentCtrl.getStudentLateEntries);
routes.post('/rpa-import', validatetoken, requirePermission('student:rpaImport'), studentCtrl.importStudentRpa);
routes.post('/board-exam-import', validatetoken, requirePermission('student:boardImport'), studentCtrl.importBoardExamMarks);
routes.post('/alumni-import', validatetoken, requirePermission('student:alumniImport'), studentCtrl.importAlumniData);
routes.post('/alumni-data', validatetoken, requirePermission('student:alumniImport'), studentCtrl.getAlumniData);
routes.post('/tablet/lock', validatetoken, requirePermission('student:edit'), extstudentCtrl.lockStudentTablet);
routes.post('/tablet/unlock', validatetoken, requirePermission('student:edit'), extstudentCtrl.unlockStudentTablet);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Student routes' }));

export default routes;

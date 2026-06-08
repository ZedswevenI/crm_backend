import { Router } from 'express';

const routes = Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import tenantCtrl from '../controller/institute.controller.js';
import manageCtrl from '../controller/insorg.controller.js';
import programCtrl from '../controller/program.controller.js';
import academicYearCtrl from '../controller/academicyear.controller.js';
import packageCtrl from '../controller/package.controller.js';
import userCtrl from '../controller/user.controller.js';
import schlexamCtrl from '../controller/schoolExam.controller.js';

routes.post('/register', tenantCtrl.createInstitute);
routes.post('/view', validatetoken, tenantCtrl.viewInstitute);
routes.post('/update', validatetoken, tenantCtrl.updateInstitute);

// Center Routes
routes.post('/center/create', validatetoken, tenantCtrl.createCenter);
routes.post('/center/list', validatetoken, tenantCtrl.listCenters);
routes.post('/center/edit', validatetoken, tenantCtrl.updateCenter);
routes.post('/center/delete', validatetoken, tenantCtrl.deleteCenter);
routes.post('/center/view', validatetoken, tenantCtrl.viewCenter);

// Center Venue Routes
routes.post('/venue/create', validatetoken, tenantCtrl.createVenue);
routes.post('/venue/list', validatetoken, tenantCtrl.listVenues);
routes.post('/venue/edit', validatetoken, tenantCtrl.updateVenue);
routes.post('/venue/delete', validatetoken, tenantCtrl.deleteVenue);
routes.post('/venue/view', validatetoken, tenantCtrl.viewVenue);

// User Routes
routes.post('/user/login', userCtrl.Loginuser);
routes.post('/user/auth/refresh', userCtrl.refreshToken);
routes.post('/user/logout', validatetoken, userCtrl.logout);
routes.post('/user/change', validatetoken, userCtrl.changePassword);
routes.post('/user/create', validatetoken, userCtrl.createUser);
routes.post('/user/list', validatetoken, userCtrl.listUsers);
routes.post('/user/edit', validatetoken, userCtrl.updateUser);
routes.post('/user/delete', validatetoken, userCtrl.deleteUser);
routes.post('/user/view', validatetoken, userCtrl.viewUser);
routes.post('/user/import', validatetoken, userCtrl.importUsers);
routes.post('/user/link/staff', validatetoken, userCtrl.syncExistingUsersAndStaff);
routes.post('/user/forgot-password', userCtrl.forgotPassword);
routes.post('/user/verify-forgot-otp', userCtrl.verifyForgotOtp);
routes.post('/user/reset-password', userCtrl.resetPassword);

// program Routes
routes.post('/program/create', validatetoken, programCtrl.createProgram);
routes.post('/program/list', validatetoken, programCtrl.listPrograms);
routes.post('/program/edit', validatetoken, programCtrl.updateProgram);
routes.post('/program/delete', validatetoken, programCtrl.deleteProgram);
routes.post('/program/view', validatetoken, programCtrl.viewProgram);
routes.post('/program/addsubjects', validatetoken, programCtrl.addProgramSubjects);
routes.post('/program/removesubjects', validatetoken, programCtrl.removeSubjectsFromProgram);
routes.post('/program/import', validatetoken, programCtrl.importPrograms);
routes.post('/program/updateExamMappings', validatetoken, programCtrl.updateProgramExamMappings);

// Center Routes
routes.post('/feeplan/create', validatetoken, tenantCtrl.createFeePlan);
routes.post('/feeplan/list', validatetoken, tenantCtrl.listFeePlans);
routes.post('/feeplan/edit', validatetoken, tenantCtrl.updateFeePlan);
routes.post('/feeplan/delete', validatetoken, tenantCtrl.deleteFeePlan);
routes.post('/feeplan/view', validatetoken, tenantCtrl.viewFeePlan);
routes.post('/feeplan/bulkupload', validatetoken, tenantCtrl.bulkUpsertFeePlansFromRows);
routes.post('/feeplan/setstatus', validatetoken, tenantCtrl.setFeePlanStatus);

// Center Routes
routes.post('/bankac/create', validatetoken, tenantCtrl.createBankAccount);
routes.post('/bankac/list', validatetoken, tenantCtrl.listBankAccounts);
routes.post('/bankac/edit', validatetoken, tenantCtrl.updateBankAccount);
routes.post('/bankac/delete', validatetoken, tenantCtrl.deleteBankAccount);
routes.post('/bankac/view', validatetoken, tenantCtrl.viewBankAccount);
routes.post('/bankac/bulkupload', validatetoken, tenantCtrl.bulkImportBankAccounts);

// Department Routes
routes.post('/dept/create', validatetoken, manageCtrl.createDepartment);
routes.post('/dept/list', validatetoken, manageCtrl.listDepartments);
routes.post('/dept/view', validatetoken, manageCtrl.viewDepartment);
routes.post('/dept/update', validatetoken, manageCtrl.updateDepartment);
routes.post('/dept/delete', validatetoken, manageCtrl.deleteDepartment);
routes.post('/dept/import', validatetoken, manageCtrl.bulkImportDepartments);

// Subject Routes
routes.post('/subject/create', validatetoken, manageCtrl.createSubject);
routes.post('/subject/list', validatetoken, manageCtrl.listSubject);
routes.post('/subject/view', validatetoken, manageCtrl.viewSubject);
routes.post('/subject/update', validatetoken, manageCtrl.updateSubject);
routes.post('/subject/delete', validatetoken, manageCtrl.deleteSubject);
routes.post('/subject/import', validatetoken, manageCtrl.bulkImportSubject);

// Staff Routes
routes.post('/staff/create', validatetoken, tenantCtrl.createStaff);
routes.post('/staff/list', validatetoken, tenantCtrl.listStaff);
routes.post('/staff/view', validatetoken, tenantCtrl.viewStaff);
routes.post('/staff/update', validatetoken, tenantCtrl.updateStaff);
routes.post('/staff/delete', validatetoken, tenantCtrl.deleteStaff);
routes.post('/staff/import', validatetoken, tenantCtrl.bulkImportStaff);

// Academic Year Config
routes.post('/acyear/create', validatetoken, academicYearCtrl.createAcademicYear);
routes.post('/acyear/list', validatetoken, academicYearCtrl.listAcademicYears);
routes.post('/acyear/view', validatetoken, academicYearCtrl.viewAcademicYear);
routes.post('/acyear/update', validatetoken, academicYearCtrl.updateAcademicYear);
routes.post('/acyear/delete', validatetoken, academicYearCtrl.deleteAcademicYear);

// Topics
routes.post('/topic/create', validatetoken, manageCtrl.createTopic);
routes.post('/topic/list', validatetoken, manageCtrl.listTopics);
routes.post('/topic/delete', validatetoken, manageCtrl.deleteTopic);
routes.post('/topic/import', validatetoken, manageCtrl.bulkUpsertTopics);
routes.post('/topic/view', validatetoken, manageCtrl.viewTopic);
routes.post('/topic/update', validatetoken, manageCtrl.updateTopic);

// Sub Topics
routes.post('/subtopic/create', validatetoken, manageCtrl.createSubTopic);
routes.post('/subtopic/list', validatetoken, manageCtrl.listSubTopics);
routes.post('/subtopic/delete', validatetoken, manageCtrl.deleteSubTopic);
routes.post('/subtopic/import', validatetoken, manageCtrl.bulkUpsertSubTopics);
routes.post('/subtopic/view', validatetoken, manageCtrl.viewSubTopic);
routes.post('/subtopic/update', validatetoken, manageCtrl.updateSubTopic);

// Exam Category
routes.post('/exam/category/create', validatetoken, manageCtrl.createExamCategory);
routes.post('/exam/category/list', validatetoken, manageCtrl.listExamCategories);
routes.post('/exam/category/delete', validatetoken, manageCtrl.deleteExamCategory);
routes.post('/exam/category/update', validatetoken, manageCtrl.editExamCategory);
routes.post('/exam/category/import', validatetoken, manageCtrl.bulkUpsertExamCategories);
routes.post('/exam/category/view', validatetoken, manageCtrl.viewExamCategory);

// Sub Topics
routes.post('/exam/subcategory/create', validatetoken, manageCtrl.createExamSubCategory);
routes.post('/exam/subcategory/list', validatetoken, manageCtrl.listExamSubCategories);
routes.post('/exam/subcategory/delete', validatetoken, manageCtrl.deleteExamSubCategory);
routes.post('/exam/subcategory/update', validatetoken, manageCtrl.editExamSubCategory);
routes.post('/exam/subcategory/import', validatetoken, manageCtrl.bulkUpsertExamSubCategories);
routes.post('/exam/subcategory/view', validatetoken, manageCtrl.viewExamSubCategory);

// PTM Routes
routes.post('/ptm/schedule', validatetoken, programCtrl.schedulePTM);
routes.post('/ptm/schedule/import', validatetoken, programCtrl.bulkImportSchedule);
routes.post('/ptm/parent/feedback', programCtrl.submitParentPTMFeedback);
routes.post('/ptm/staff/feedback', validatetoken, programCtrl.submitStaffFeedback);
routes.post('/ptm/staff/feedback/import', validatetoken, programCtrl.bulkImportFeedback);
routes.post('/ptm/liststudents', programCtrl.listPTMs);
routes.post('/ptm/list', validatetoken, programCtrl.listPtmSessions);
routes.post('/ptm/view', programCtrl.viewPTM);
routes.post('/ptm/update', validatetoken, programCtrl.editPTM);
routes.post('/ptm/remove', validatetoken, programCtrl.removePTM);
routes.post('/ptm/togglepostfeedback', validatetoken, programCtrl.togglePostPtmFeedback);
routes.post('/ptm/student/add', validatetoken, programCtrl.addStudentsToPTM);
routes.post('/ptm/student/remove', validatetoken, programCtrl.removeStudentsFromPTM);
routes.post('/ptm/preptm/submit', programCtrl.submitPrePtmFeedback);
routes.post('/ptm/postptm/submit', programCtrl.submitPostPtmFeedback);

// Package Reports
routes.post('/package/upload', validatetoken, upload.single('file'), packageCtrl.uploadPackageFile);
routes.post('/package/create', validatetoken, packageCtrl.createPackage);
routes.post('/package/update', validatetoken, packageCtrl.editPackage);
routes.post('/package/delete', validatetoken, packageCtrl.deletePackage);
routes.post('/package/list', validatetoken, packageCtrl.listPackages);
routes.post('/package/enable', validatetoken, packageCtrl.assignPackage);
routes.post('/package/disable', validatetoken, packageCtrl.revokeEnablement);
routes.post('/package/enable/report', validatetoken, packageCtrl.reportPackageEnablement);
routes.post('/package/students/report', packageCtrl.getStudentPackageSubjects);
routes.post('/package/students', packageCtrl.getStudentPackages);
routes.post('/package/view', validatetoken, packageCtrl.viewPackage);
routes.post('/package/list/enadisa', validatetoken, packageCtrl.listPackageTargets);

// Package Reports
routes.post('/school/exam/import', validatetoken, schlexamCtrl.uploadExamMarks);
routes.post('/school/exam/view', validatetoken, schlexamCtrl.viewExam);
routes.post('/school/exam/delete', validatetoken, schlexamCtrl.deleteExam);
routes.post('/school/exam/list', validatetoken, schlexamCtrl.listExams);
routes.post('/school/exam/list/student', validatetoken, schlexamCtrl.listByStudent);

routes.post('/download', tenantCtrl.downloadFile);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Tenant routes' }));

export default routes;

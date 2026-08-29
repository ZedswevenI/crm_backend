import { Router } from 'express';

const routes = Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import tenantCtrl from '../controller/institute.controller.js';
import manageCtrl from '../controller/insorg.controller.js';
import programCtrl from '../controller/program.controller.js';
import academicYearCtrl from '../controller/academicyear.controller.js';
import packageCtrl from '../controller/package.controller.js';
import userCtrl from '../controller/user.controller.js';
import schlexamCtrl from '../controller/schoolExam.controller.js';
import notificationCtrl from '../controller/notification.controller.js';
import permissionCtrl from '../controller/permission.controller.js';


routes.post('/register', tenantCtrl.createInstitute);
// Institute settings themselves are intentionally not permission-gated (out of scope — "institute" excluded from the catalog).
routes.post('/view', validatetoken, tenantCtrl.viewInstitute);
routes.post('/update', validatetoken, tenantCtrl.updateInstitute);

// Center Routes
routes.post('/center/create', validatetoken, requirePermission('orgCenter:create'), tenantCtrl.createCenter);
routes.post('/center/list', validatetoken, requirePermission('orgCenter:list'), tenantCtrl.listCenters);
routes.post('/center/edit', validatetoken, requirePermission('orgCenter:edit'), tenantCtrl.updateCenter);
routes.post('/center/delete', validatetoken, requirePermission('orgCenter:delete'), tenantCtrl.deleteCenter);
routes.post('/center/view', validatetoken, requirePermission('orgCenter:view'), tenantCtrl.viewCenter);

// Center Venue Routes
routes.post('/venue/create', validatetoken, requirePermission('orgCenter:create'), tenantCtrl.createVenue);
routes.post('/venue/list', validatetoken, requirePermission('orgCenter:list'), tenantCtrl.listVenues);
routes.post('/venue/edit', validatetoken, requirePermission('orgCenter:edit'), tenantCtrl.updateVenue);
routes.post('/venue/delete', validatetoken, requirePermission('orgCenter:delete'), tenantCtrl.deleteVenue);
routes.post('/venue/view', validatetoken, requirePermission('orgCenter:view'), tenantCtrl.viewVenue);

// User Routes
routes.post('/user/login', userCtrl.Loginuser);
routes.post('/user/auth/refresh', userCtrl.refreshToken);
// Self-service — no permission gate.
routes.post('/user/logout', validatetoken, userCtrl.logout);
routes.post('/user/change', validatetoken, userCtrl.changePassword);
routes.post('/user/create', validatetoken, requirePermission('orgUser:create'), userCtrl.createUser);
routes.post('/user/list', validatetoken, requirePermission('orgUser:list'), userCtrl.listUsers);
routes.post('/user/edit', validatetoken, requirePermission('orgUser:edit'), userCtrl.updateUser);
routes.post('/user/delete', validatetoken, requirePermission('orgUser:delete'), userCtrl.deleteUser);
routes.post('/user/view', validatetoken, requirePermission('orgUser:view'), userCtrl.viewUser);
// Same as /user/view, keyed by targetUserId (the app-level userId) instead of recId (Mongo _id).
routes.post('/user/view-by-userid', validatetoken, requirePermission('orgUser:view'), userCtrl.viewUserByUserId);
// Self-service (own permissions) or admin-only (someone else's) — enforced inside the controller.
routes.post('/user/permissions', validatetoken, userCtrl.getUserPermissions);
routes.post('/user/import', validatetoken, requirePermission('orgUser:create'), userCtrl.importUsers);
routes.post('/user/link/staff', validatetoken, requirePermission('orgUser:edit'), userCtrl.syncExistingUsersAndStaff);
routes.post('/user/forgot-password', userCtrl.forgotPassword);
routes.post('/user/verify-forgot-otp', userCtrl.verifyForgotOtp);
routes.post('/user/reset-password', userCtrl.resetPassword);
// updateUserAccess additionally enforces isAdmin internally (stricter than any permission grant) — this is defense in depth.
routes.post('/user/access/update', validatetoken, requirePermission('orgUser:assignAccess'), userCtrl.updateUserAccess);

// Permission catalog (read-only, seeded) — reference data for the user-access picker UI, not itself gated.
routes.post('/permission/catalog', validatetoken, permissionCtrl.listCatalog);

// program Routes
routes.post('/program/create', validatetoken, requirePermission('orgProgram:create'), programCtrl.createProgram);
routes.post('/program/list', validatetoken, requirePermission('orgProgram:list'), programCtrl.listPrograms);
routes.post('/program/edit', validatetoken, requirePermission('orgProgram:edit'), programCtrl.updateProgram);
routes.post('/program/delete', validatetoken, requirePermission('orgProgram:delete'), programCtrl.deleteProgram);
routes.post('/program/view', validatetoken, requirePermission('orgProgram:view'), programCtrl.viewProgram);
routes.post('/program/addsubjects', validatetoken, requirePermission('orgProgram:addSubjects'), programCtrl.addProgramSubjects);
routes.post('/program/removesubjects', validatetoken, requirePermission('orgProgram:removeSubjects'), programCtrl.removeSubjectsFromProgram);
routes.post('/program/import', validatetoken, requirePermission('orgProgram:create'), programCtrl.importPrograms);
routes.post('/program/updateExamMappings', validatetoken, requirePermission('orgProgram:examMapping'), programCtrl.updateProgramExamMappings);

// Fee Plan Routes
routes.post('/feeplan/create', validatetoken, requirePermission('orgFeePlan:create'), tenantCtrl.createFeePlan);
routes.post('/feeplan/list', validatetoken, requirePermission('orgFeePlan:list'), tenantCtrl.listFeePlans);
routes.post('/feeplan/edit', validatetoken, requirePermission('orgFeePlan:edit'), tenantCtrl.updateFeePlan);
routes.post('/feeplan/delete', validatetoken, requirePermission('orgFeePlan:delete'), tenantCtrl.deleteFeePlan);
routes.post('/feeplan/view', validatetoken, requirePermission('orgFeePlan:view'), tenantCtrl.viewFeePlan);
routes.post('/feeplan/bulkupload', validatetoken, requirePermission('orgFeePlan:create'), tenantCtrl.bulkUpsertFeePlansFromRows);
routes.post('/feeplan/setstatus', validatetoken, requirePermission('orgFeePlan:edit'), tenantCtrl.setFeePlanStatus);

// Bank Account Routes
routes.post('/bankac/create', validatetoken, requirePermission('orgBankAccount:create'), tenantCtrl.createBankAccount);
routes.post('/bankac/list', validatetoken, requirePermission('orgBankAccount:list'), tenantCtrl.listBankAccounts);
routes.post('/bankac/edit', validatetoken, requirePermission('orgBankAccount:edit'), tenantCtrl.updateBankAccount);
routes.post('/bankac/delete', validatetoken, requirePermission('orgBankAccount:delete'), tenantCtrl.deleteBankAccount);
routes.post('/bankac/view', validatetoken, requirePermission('orgBankAccount:list'), tenantCtrl.viewBankAccount);
routes.post('/bankac/bulkupload', validatetoken, requirePermission('orgBankAccount:create'), tenantCtrl.bulkImportBankAccounts);

// Department Routes
routes.post('/dept/create', validatetoken, requirePermission('orgDept:create'), manageCtrl.createDepartment);
routes.post('/dept/list', validatetoken, requirePermission('orgDept:list'), manageCtrl.listDepartments);
routes.post('/dept/view', validatetoken, requirePermission('orgDept:list'), manageCtrl.viewDepartment);
routes.post('/dept/update', validatetoken, requirePermission('orgDept:edit'), manageCtrl.updateDepartment);
routes.post('/dept/delete', validatetoken, requirePermission('orgDept:delete'), manageCtrl.deleteDepartment);
routes.post('/dept/import', validatetoken, requirePermission('orgDept:create'), manageCtrl.bulkImportDepartments);

// Subject Routes
routes.post('/subject/create', validatetoken, requirePermission('orgSubject:create'), manageCtrl.createSubject);
routes.post('/subject/list', validatetoken, requirePermission('orgSubject:list'), manageCtrl.listSubject);
routes.post('/subject/view', validatetoken, requirePermission('orgSubject:list'), manageCtrl.viewSubject);
routes.post('/subject/update', validatetoken, requirePermission('orgSubject:edit'), manageCtrl.updateSubject);
routes.post('/subject/delete', validatetoken, requirePermission('orgSubject:delete'), manageCtrl.deleteSubject);
routes.post('/subject/import', validatetoken, requirePermission('orgSubject:create'), manageCtrl.bulkImportSubject);

// Staff Routes
routes.post('/staff/create', validatetoken, requirePermission('orgStaff:create'), tenantCtrl.createStaff);
routes.post('/staff/list', validatetoken, requirePermission('orgStaff:list'), tenantCtrl.listStaff);
routes.post('/staff/view', validatetoken, requirePermission('orgStaff:view'), tenantCtrl.viewStaff);
routes.post('/staff/update', validatetoken, requirePermission('orgStaff:edit'), tenantCtrl.updateStaff);
routes.post('/staff/delete', validatetoken, requirePermission('orgStaff:delete'), tenantCtrl.deleteStaff);
routes.post('/staff/import', validatetoken, requirePermission('orgStaff:create'), tenantCtrl.bulkImportStaff);

// Academic Year Config
routes.post('/acyear/create', validatetoken, requirePermission('orgAcademicYear:create'), academicYearCtrl.createAcademicYear);
routes.post('/acyear/list', validatetoken, requirePermission('orgAcademicYear:list'), academicYearCtrl.listAcademicYears);
routes.post('/acyear/view', validatetoken, requirePermission('orgAcademicYear:view'), academicYearCtrl.viewAcademicYear);
routes.post('/acyear/update', validatetoken, requirePermission('orgAcademicYear:edit'), academicYearCtrl.updateAcademicYear);
routes.post('/acyear/delete', validatetoken, requirePermission('orgAcademicYear:delete'), academicYearCtrl.deleteAcademicYear);

// Topics
routes.post('/topic/create', validatetoken, requirePermission('orgTopic:create'), manageCtrl.createTopic);
routes.post('/topic/list', validatetoken, requirePermission('orgTopic:list'), manageCtrl.listTopics);
routes.post('/topic/delete', validatetoken, requirePermission('orgTopic:delete'), manageCtrl.deleteTopic);
routes.post('/topic/import', validatetoken, requirePermission('orgTopic:create'), manageCtrl.bulkUpsertTopics);
routes.post('/topic/view', validatetoken, requirePermission('orgTopic:list'), manageCtrl.viewTopic);
routes.post('/topic/update', validatetoken, requirePermission('orgTopic:edit'), manageCtrl.updateTopic);

// Sub Topics
routes.post('/subtopic/create', validatetoken, requirePermission('orgSubTopic:create'), manageCtrl.createSubTopic);
routes.post('/subtopic/list', validatetoken, requirePermission('orgSubTopic:list'), manageCtrl.listSubTopics);
routes.post('/subtopic/delete', validatetoken, requirePermission('orgSubTopic:delete'), manageCtrl.deleteSubTopic);
routes.post('/subtopic/import', validatetoken, requirePermission('orgSubTopic:create'), manageCtrl.bulkUpsertSubTopics);
routes.post('/subtopic/view', validatetoken, requirePermission('orgSubTopic:list'), manageCtrl.viewSubTopic);
routes.post('/subtopic/update', validatetoken, requirePermission('orgSubTopic:edit'), manageCtrl.updateSubTopic);

// Exam Category
routes.post('/exam/category/create', validatetoken, requirePermission('orgExamCategory:create'), manageCtrl.createExamCategory);
routes.post('/exam/category/list', validatetoken, requirePermission('orgExamCategory:list'), manageCtrl.listExamCategories);
routes.post('/exam/category/delete', validatetoken, requirePermission('orgExamCategory:delete'), manageCtrl.deleteExamCategory);
routes.post('/exam/category/update', validatetoken, requirePermission('orgExamCategory:edit'), manageCtrl.editExamCategory);
routes.post('/exam/category/import', validatetoken, requirePermission('orgExamCategory:create'), manageCtrl.bulkUpsertExamCategories);
routes.post('/exam/category/view', validatetoken, requirePermission('orgExamCategory:list'), manageCtrl.viewExamCategory);

// Sub Categories
routes.post('/exam/subcategory/create', validatetoken, requirePermission('orgExamCategory:addSubCategories'), manageCtrl.createExamSubCategory);
routes.post('/exam/subcategory/list', validatetoken, requirePermission('orgExamCategory:list'), manageCtrl.listExamSubCategories);
routes.post('/exam/subcategory/delete', validatetoken, requirePermission('orgExamCategory:addSubCategories'), manageCtrl.deleteExamSubCategory);
routes.post('/exam/subcategory/update', validatetoken, requirePermission('orgExamCategory:addSubCategories'), manageCtrl.editExamSubCategory);
routes.post('/exam/subcategory/import', validatetoken, requirePermission('orgExamCategory:addSubCategories'), manageCtrl.bulkUpsertExamSubCategories);
routes.post('/exam/subcategory/view', validatetoken, requirePermission('orgExamCategory:list'), manageCtrl.viewExamSubCategory);

// PTM Routes
routes.post('/ptm/schedule', validatetoken, requirePermission('ptm:create'), programCtrl.schedulePTM);
routes.post('/ptm/schedule/import', validatetoken, requirePermission('ptm:create'), programCtrl.bulkImportSchedule);
routes.post('/ptm/parent/feedback', programCtrl.submitParentPTMFeedback);
routes.post('/ptm/staff/feedback', validatetoken, requirePermission('ptm:edit'), programCtrl.submitStaffFeedback);
routes.post('/ptm/staff/feedback/import', validatetoken, requirePermission('ptm:edit'), programCtrl.bulkImportFeedback);
routes.post('/ptm/liststudents', programCtrl.listPTMs);
routes.post('/ptm/list', validatetoken, requirePermission('ptm:list'), programCtrl.listPtmSessions);
routes.post('/ptm/view', programCtrl.viewPTM);
routes.post('/ptm/update', validatetoken, requirePermission('ptm:edit'), programCtrl.editPTM);
routes.post('/ptm/remove', validatetoken, requirePermission('ptm:delete'), programCtrl.removePTM);
routes.post('/ptm/session/remove', validatetoken, requirePermission('ptm:delete'), programCtrl.removePtmSession);
routes.post('/ptm/togglepostfeedback', validatetoken, requirePermission('ptm:edit'), programCtrl.togglePostPtmFeedback);
routes.post('/ptm/student/add', validatetoken, requirePermission('ptm:edit'), programCtrl.addStudentsToPTM);
routes.post('/ptm/student/remove', validatetoken, requirePermission('ptm:edit'), programCtrl.removeStudentsFromPTM);
routes.post('/ptm/preptm/submit', programCtrl.submitPrePtmFeedback);
routes.post('/ptm/postptm/submit', programCtrl.submitPostPtmFeedback);

routes.post('/notification/list', validatetoken, requirePermission('notification:list'), notificationCtrl.listNotifications);
routes.post('/notification/unread-count', validatetoken, requirePermission('notification:list'), notificationCtrl.getUnreadCount);
routes.post('/notification/mark-read', validatetoken, requirePermission('notification:markRead'), notificationCtrl.markAsRead);
routes.post('/notification/mark-all-read', validatetoken, requirePermission('notification:markAllRead'), notificationCtrl.markAllAsRead);
routes.post('/notification/remove', validatetoken, requirePermission('notification:remove'), notificationCtrl.removeNotification);

// Package Routes
routes.post('/package/upload', validatetoken, requirePermission('package:create'), upload.single('file'), packageCtrl.uploadPackageFile);
routes.post('/package/create', validatetoken, requirePermission('package:create'), packageCtrl.createPackage);
routes.post('/package/update', validatetoken, requirePermission('package:edit'), packageCtrl.editPackage);
routes.post('/package/delete', validatetoken, requirePermission('package:delete'), packageCtrl.deletePackage);
routes.post('/package/list', validatetoken, requirePermission('package:list'), packageCtrl.listPackages);
routes.post('/package/enable', validatetoken, requirePermission('package:enable'), packageCtrl.assignPackage);
routes.post('/package/disable', validatetoken, requirePermission('package:disable'), packageCtrl.revokeEnablement);
routes.post('/package/enable/report', validatetoken, requirePermission('package:list'), packageCtrl.reportPackageEnablement);
routes.post('/package/students/report', packageCtrl.getStudentPackageSubjects);
routes.post('/package/students', packageCtrl.getStudentPackages);
routes.post('/package/view', validatetoken, requirePermission('package:view'), packageCtrl.viewPackage);
routes.post('/package/list/enadisa', validatetoken, requirePermission('package:list'), packageCtrl.listPackageTargets);

// School Exam Routes
routes.post('/school/exam/import', validatetoken, requirePermission('orgSchoolExam:create'), schlexamCtrl.uploadExamMarks);
routes.post('/school/exam/view', validatetoken, requirePermission('orgSchoolExam:list'), schlexamCtrl.viewExam);
routes.post('/school/exam/delete', validatetoken, requirePermission('orgSchoolExam:delete'), schlexamCtrl.deleteExam);
routes.post('/school/exam/list', validatetoken, requirePermission('orgSchoolExam:list'), schlexamCtrl.listExams);
routes.post('/school/exam/list/student', validatetoken, requirePermission('orgSchoolExam:list'), schlexamCtrl.listByStudent);

routes.post('/download', tenantCtrl.downloadFile);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Tenant routes' }));

export default routes;

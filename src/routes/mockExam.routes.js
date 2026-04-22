import express from 'express';
import multer from 'multer';

import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';

import mockExamController from '../controller/mockExam.controller.js';
import mockExamBatchAssignController from '../controller/mockExambatchassign.controller.js';
import mockExamQnsController from '../controller/mockExamQns.controller.js';
import mockExamResultController from '../controller/mockExamResult.controller.js';
import bookmarkController from '../controller/mockExamQnsReport.controller.js';
import { instructionController, passageController } from '../controller/instructionpassage.controller.js';

const routes = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
import { uploadQuestionImage } from '../middlewares/multer.js';

routes.post('/create', validatetoken, mockExamController.createExam);
routes.post('/duplicate', validatetoken, mockExamController.duplicateExam);
routes.post('/update', validatetoken, mockExamController.updateExam);
routes.post('/list', validatetoken, mockExamController.listExams);
routes.post('/get', validatetoken, mockExamController.getExam);
routes.post('/delete', validatetoken, mockExamController.deleteExam);
routes.post('/publish', validatetoken, mockExamController.publishExam);
routes.post('/publish-result', validatetoken, mockExamController.publishResult);
// routes.post('/apply-grace', validatetoken, mockExamController.applyGrace);
// routes.post('/remove-grace', validatetoken, mockExamController.removeGrace);
routes.post('/auto-publish-check', validatetoken, mockExamController.checkAndAutoPublish);
routes.post('/student-list', mockExamController.listExamsForStudent);
routes.post('/grace/add', validatetoken, mockExamController.addGrace);
routes.post('/grace/remove', validatetoken, mockExamController.removeGrace);
routes.post('/grace/reevaluate', validatetoken, mockExamController.reevaluate);

routes.post('/batch/assign', validatetoken, mockExamBatchAssignController.assignToBatch);
routes.post('/batch/disable', validatetoken, mockExamBatchAssignController.disableFromBatch);
routes.post('/batch/list-by-exam', validatetoken, mockExamBatchAssignController.listBatchesByExam);
routes.post('/batch/list-by-batch', validatetoken, mockExamBatchAssignController.listExamsByBatch);
routes.post('/batch/student-status', validatetoken, mockExamBatchAssignController.getStudentStatus);
routes.post('/batch/sync-students', validatetoken, mockExamBatchAssignController.syncStudents);

routes.post('/questions/create', validatetoken, mockExamQnsController.createQuestion);
routes.post('/questions/bulk-create', validatetoken, mockExamQnsController.createQuestionsBulk);
routes.post('/questions/update', validatetoken, mockExamQnsController.updateQuestion);
routes.post('/questions/delete', validatetoken, mockExamQnsController.deleteQuestion);
routes.post('/questions/bulk-delete-section', validatetoken, mockExamQnsController.bulkDeleteBySection);
routes.post('/questions/list-by-section', validatetoken, mockExamQnsController.listQuestionsBySection);
routes.post('/questions/get-questions', mockExamQnsController.getQuestionsByCode);
routes.post('/questions/getallquestions', mockExamQnsController.getQuestionsByExam);
routes.post('/questions/view', validatetoken, mockExamQnsController.viewQuestion);
routes.post('/questions/sort-order', validatetoken, mockExamQnsController.updateSortOrder);
routes.post('/questions/upload-image', validatetoken, uploadQuestionImage, mockExamQnsController.uploadImage);
routes.post('/questions/image/download', mockExamQnsController.getImage);
routes.post('/questions/bulk-upload-answers', validatetoken, mockExamQnsController.bulkUploadAnswers);

// QUestion Bank Routes
routes.post('/questions/bank/create', validatetoken, mockExamQnsController.createQuestionInBank);
routes.post('/questions/bank/bulk-create', validatetoken, mockExamQnsController.createQuestionsBulkInBank);
routes.post('/questions/bank/list', validatetoken, mockExamQnsController.listQuestionBank);
routes.post('/questions/map', validatetoken, mockExamQnsController.mapQuestionToExam);
routes.post('/questions/unmap', validatetoken, mockExamQnsController.unmapQuestionFromExam);
routes.post('/questions/bulk-map', validatetoken, mockExamQnsController.bulkMapQuestionsToExam);

routes.post('/result/submit', mockExamResultController.submitResult);
routes.post('/result/my-result', mockExamResultController.getMyResult);
routes.post('/result/my-result/with/questions', mockExamResultController.getMyResultWithAnswers);
routes.post('/result/leaderboard', mockExamResultController.getLeaderboard);
routes.post('/result/list-by-exam', mockExamResultController.listResultsByExam);
routes.post('/result/list-by-batch', mockExamResultController.listResultsByBatch);
routes.post('/result/list-by-student', mockExamResultController.listResultsByStudent);
routes.post('/result/section-analytics', mockExamResultController.getSectionAnalytics);
routes.post('/result/analytics/timing', mockExamResultController.getQuestionTimingAnalytics);
routes.post('/result/analytics/attempts', mockExamResultController.getQuestionAttemptAnalytics);
routes.post('/result/batch-attendance', mockExamResultController.getBatchAttendanceReport);
routes.post('/result/batch-performance', mockExamResultController.getBatchPerformanceReport);
routes.post('/result/compare-topper', mockExamResultController.compareWithTopper);

routes.post('/instruction/create', validatetoken, instructionController.createInstruction);
routes.post('/instruction/update', validatetoken, instructionController.updateInstruction);
routes.post('/instruction/list', validatetoken, instructionController.listInstructions);
routes.post('/instruction/delete', validatetoken, instructionController.deleteInstruction);
routes.post('/instruction/upload-image', validatetoken, validatetoken, uploadQuestionImage, instructionController.uploadImageInstruction);

routes.post('/passage/create', validatetoken, passageController.createPassage);
routes.post('/passage/update', validatetoken, passageController.updatePassage);
routes.post('/passage/list', validatetoken, passageController.listPassages);
routes.post('/passage/delete', validatetoken, passageController.deletePassage);
routes.post('/passage/upload-image', validatetoken, validatetoken, uploadQuestionImage, passageController.uploadImagePassage);

routes.post('/bookmarkqns/create', bookmarkController.createBookmark);
routes.post('/bookmarkqns/list', bookmarkController.listBookmarks);
routes.post('/bookmarkqns/delete', bookmarkController.deleteBookmark);
routes.post('/reportqns/create', bookmarkController.createReport);
routes.post('/reportqns/list', bookmarkController.listReports);
routes.post('/reportqns/update/status', bookmarkController.updateReportStatus);

export default routes;

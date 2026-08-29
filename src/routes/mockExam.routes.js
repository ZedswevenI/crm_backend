import express from 'express';
import multer from 'multer';

import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';

import mockExamController from '../controller/mockExam.controller.js';
import mockExamBatchAssignController from '../controller/mockExambatchassign.controller.js';
import mockExamQnsController from '../controller/mockExamQns.controller.js';
import mockExamResultController from '../controller/mockExamResult.controller.js';
import bookmarkController from '../controller/mockExamQnsReport.controller.js';
import { instructionController, passageController } from '../controller/instructionpassage.controller.js';

const routes = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
import { uploadQuestionImage } from '../middlewares/multer.js';


routes.post('/create', validatetoken, requirePermission('exam:create'), mockExamController.createExam);
routes.post('/duplicate', validatetoken, requirePermission('exam:duplicate'), mockExamController.duplicateExam);
routes.post('/update', validatetoken, requirePermission('exam:edit'), mockExamController.updateExam);
routes.post('/list', validatetoken, requirePermission('exam:list'), mockExamController.listExams);
routes.post('/get', validatetoken, requirePermission('exam:view'), mockExamController.getExam);
routes.post('/delete', validatetoken, requirePermission('exam:delete'), mockExamController.deleteExam);
routes.post('/delete/import', validatetoken, requirePermission('examImport:delete'), mockExamController.deleteimportExam);
routes.post('/publish', validatetoken, requirePermission('exam:publish'), mockExamController.publishExam);
routes.post('/publish-result', validatetoken, requirePermission('exam:publishResult'), mockExamController.publishResult);
routes.post('/auto-publish-check', validatetoken, requirePermission('exam:publish'), mockExamController.checkAndAutoPublish);
routes.post('/student-list', mockExamController.listExamsForStudent);
routes.post('/grace/add', validatetoken, requirePermission('exam:graceMarks'), mockExamController.addGrace);
routes.post('/grace/remove', validatetoken, requirePermission('exam:graceMarks'), mockExamController.removeGrace);
routes.post('/grace/reevaluate', validatetoken, requirePermission('exam:reevaluate'), mockExamController.reevaluate);

routes.post('/batch/assign', validatetoken, requirePermission('exam:assignBatch'), mockExamBatchAssignController.assignToBatch);
routes.post('/batch/disable', validatetoken, requirePermission('exam:assignBatch'), mockExamBatchAssignController.disableFromBatch);
routes.post('/batch/list-by-exam', validatetoken, requirePermission('exam:view'), mockExamBatchAssignController.listBatchesByExam);
routes.post('/batch/list-by-batch', validatetoken, requirePermission('exam:view'), mockExamBatchAssignController.listExamsByBatch);
routes.post('/batch/student-status', validatetoken, requirePermission('exam:view'), mockExamBatchAssignController.getStudentStatus);
routes.post('/batch/sync-students', validatetoken, requirePermission('exam:assignBatch'), mockExamBatchAssignController.syncStudents);

routes.post('/questions/create', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.createQuestion);
routes.post('/questions/bulk-create', validatetoken, requirePermission('exam:importQuestions'), mockExamQnsController.createQuestionsBulk);
routes.post('/questions/update', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.updateQuestion);
routes.post('/questions/delete', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.deleteQuestion);
routes.post('/questions/bulk-delete-section', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.bulkDeleteBySection);
routes.post('/questions/list-by-section', validatetoken, requirePermission('exam:view'), mockExamQnsController.listQuestionsBySection);
routes.post('/questions/get-questions', mockExamQnsController.getQuestionsByCode);
routes.post('/questions/get-questions/absent', mockExamQnsController.getExamQuestionsWithAnswers);
routes.post('/questions/getallquestions', mockExamQnsController.getQuestionsByExam);
routes.post('/questions/view', validatetoken, requirePermission('exam:view'), mockExamQnsController.viewQuestion);
routes.post('/questions/sort-order', validatetoken, requirePermission('exam:rearrangeQuestions'), mockExamQnsController.updateSortOrder);
routes.post('/questions/upload-image', validatetoken, requirePermission('exam:addQuestion'), uploadQuestionImage, mockExamQnsController.uploadImage);
routes.post('/questions/image/download', mockExamQnsController.getImage);
routes.post('/questions/bulk-upload-answers', validatetoken, requirePermission('exam:importAnswers'), mockExamQnsController.bulkUploadAnswers);
routes.post('/questions/preview-question-no', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.previewNextQuestionNo);

// QUestion Bank Routes
routes.post('/questions/bank/create', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.createQuestionInBank);
routes.post('/questions/bank/bulk-create', validatetoken, requirePermission('exam:importQuestions'), mockExamQnsController.createQuestionsBulkInBank);
routes.post('/questions/bank/list', validatetoken, requirePermission('exam:view'), mockExamQnsController.listQuestionBank);
routes.post('/questions/map', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.mapQuestionToExam);
routes.post('/questions/unmap', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.unmapQuestionFromExam);
routes.post('/questions/bulk-map', validatetoken, requirePermission('exam:addQuestion'), mockExamQnsController.bulkMapQuestionsToExam);

routes.post('/result/submit', mockExamResultController.submitResult);
routes.post('/result/submit-offline', validatetoken, requirePermission('exam:offlineMarksEntry'), mockExamResultController.submitOfflineResult);
routes.post('/result/submit-offline/bulk', validatetoken, requirePermission('exam:offlineMarksEntry'), mockExamResultController.submitOfflineResultsBulk);
routes.post('/result/submit-offline/correct', validatetoken, requirePermission('exam:offlineMarksEntry'), mockExamResultController.correctOfflineResult);
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
routes.post('/result/analytics/question-wise', validatetoken, requirePermission('exam:view'), mockExamResultController.getExamQuestionWiseReport);
routes.post('/result/analytics/participants', validatetoken, requirePermission('exam:view'), mockExamResultController.getExamParticipantsReport);
routes.post('/result/bulk-upload-historical', validatetoken, requirePermission('exam:marksImport'), mockExamController.bulkUploadHistorical);
routes.post('/result/my-result/analysis', mockExamResultController.getStudentResultAdmin);

routes.post('/instruction/create', validatetoken, requirePermission('examContent:create'), instructionController.createInstruction);
routes.post('/instruction/update', validatetoken, requirePermission('examContent:edit'), instructionController.updateInstruction);
routes.post('/instruction/list', validatetoken, requirePermission('examContent:list'), instructionController.listInstructions);
routes.post('/instruction/delete', validatetoken, requirePermission('examContent:delete'), instructionController.deleteInstruction);
routes.post('/instruction/upload-image', validatetoken, requirePermission('examContent:edit'), uploadQuestionImage, instructionController.uploadImageInstruction);

routes.post('/passage/create', validatetoken, requirePermission('examContent:create'), passageController.createPassage);
routes.post('/passage/update', validatetoken, requirePermission('examContent:edit'), passageController.updatePassage);
routes.post('/passage/list', validatetoken, requirePermission('examContent:list'), passageController.listPassages);
routes.post('/passage/delete', validatetoken, requirePermission('examContent:delete'), passageController.deletePassage);
routes.post('/passage/upload-image', validatetoken, requirePermission('examContent:edit'), uploadQuestionImage, passageController.uploadImagePassage);

routes.post('/bookmarkqns/create', bookmarkController.createBookmark);
routes.post('/bookmarkqns/list', bookmarkController.listBookmarks);
routes.post('/bookmarkqns/delete', bookmarkController.deleteBookmark);
routes.post('/reportqns/create', bookmarkController.createReport);
routes.post('/reportqns/list', bookmarkController.listReports);
routes.post('/reportqns/update/status', bookmarkController.updateReportStatus);

routes.post('/result/batch-subject-stats', validatetoken, requirePermission('exam:view'), mockExamResultController.getBatchSubjectStats);

routes.post('/next-code', validatetoken, requirePermission('exam:create'), mockExamController.getNextExamCode);
routes.post('/disable', validatetoken, requirePermission('exam:disable'), mockExamController.disableExam);
routes.post('/enable', validatetoken, requirePermission('exam:enable'), mockExamController.enableExam);
routes.post('/result/participant-report', validatetoken, requirePermission('exam:view'), mockExamResultController.getParticipantReport);

export default routes;

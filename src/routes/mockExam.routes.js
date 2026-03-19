import express from 'express';
import multer from 'multer';

import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';

import mockExamController from '../controller/mockExam.controller.js';
import mockExamBatchAssignController from '../controller/mockExambatchassign.controller.js';
import mockExamQnsController from '../controller/mockExamQns.controller.js';
import mockExamResultController from '../controller/mockExamResult.controller.js';
import { instructionController, passageController } from '../controller/instructionpassage.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
import { uploadQuestionImage } from '../middlewares/multer.js';

router.post('/create', validatetoken, mockExamController.createExam);
router.post('/update', validatetoken, mockExamController.updateExam);
router.post('/list', validatetoken, mockExamController.listExams);
router.post('/get', validatetoken, mockExamController.getExam);
router.post('/delete', validatetoken, mockExamController.deleteExam);
router.post('/publish', validatetoken, mockExamController.publishExam);
router.post('/publish-result', validatetoken, mockExamController.publishResult);
router.post('/apply-grace', validatetoken, mockExamController.applyGrace);
router.post('/remove-grace', validatetoken, mockExamController.removeGrace);
router.post('/auto-publish-check', validatetoken, mockExamController.checkAndAutoPublish);
router.post('/student-list', mockExamController.listExamsForStudent);

router.post('/batch/assign', validatetoken, mockExamBatchAssignController.assignToBatch);
router.post('/batch/disable', validatetoken, mockExamBatchAssignController.disableFromBatch);
router.post('/batch/list-by-exam', validatetoken, mockExamBatchAssignController.listBatchesByExam);
router.post('/batch/list-by-batch', validatetoken, mockExamBatchAssignController.listExamsByBatch);
router.post('/batch/student-status', validatetoken, mockExamBatchAssignController.getStudentStatus);
router.post('/batch/sync-students', validatetoken, mockExamBatchAssignController.syncStudents);

router.post('/questions/create', validatetoken, mockExamQnsController.createQuestion);
router.post('/questions/bulk-create', validatetoken, mockExamQnsController.createQuestionsBulk);
router.post('/questions/update', validatetoken, mockExamQnsController.updateQuestion);
router.post('/questions/delete', validatetoken, mockExamQnsController.deleteQuestion);
router.post('/questions/bulk-delete-section', validatetoken, mockExamQnsController.bulkDeleteBySection);
router.post('/questions/list-by-section', validatetoken, mockExamQnsController.listQuestionsBySection);
router.post('/questions/get-questions', mockExamQnsController.getQuestionsByCode);
router.post('/questions/getallquestions', mockExamQnsController.getQuestionsByExam);
router.post('/questions/view', validatetoken, mockExamQnsController.viewQuestion);
router.post('/questions/sort-order', validatetoken, mockExamQnsController.updateSortOrder);
router.post('/questions/upload-image', validatetoken, validatetoken, uploadQuestionImage, mockExamQnsController.uploadImage);
router.post('/questions/image/download', mockExamQnsController.getImage);

router.post('/result/submit', mockExamResultController.submitResult);
router.post('/result/my-result', mockExamResultController.getMyResult);
router.post('/result/leaderboard', validatetoken, mockExamResultController.getLeaderboard);
router.post('/result/list-by-exam', validatetoken, mockExamResultController.listResultsByExam);
router.post('/result/list-by-batch', validatetoken, mockExamResultController.listResultsByBatch);
router.post('/result/list-by-student', validatetoken, mockExamResultController.listResultsByStudent);
router.post('/result/section-analytics', validatetoken, mockExamResultController.getSectionAnalytics);

router.post('/instruction/create', validatetoken, instructionController.createInstruction);
router.post('/instruction/update', validatetoken, instructionController.updateInstruction);
router.post('/instruction/list', validatetoken, instructionController.listInstructions);
router.post('/instruction/delete', validatetoken, instructionController.deleteInstruction);

router.post('/passage/create', validatetoken, passageController.createPassage);
router.post('/passage/update', validatetoken, passageController.updatePassage);
router.post('/passage/list', validatetoken, passageController.listPassages);
router.post('/passage/delete', validatetoken, passageController.deletePassage);

export default router;

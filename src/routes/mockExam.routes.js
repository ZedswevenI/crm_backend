import express from 'express';
import multer from 'multer';

import mockExamController from '../controller/mockExam.controller.js';
import mockExamBatchAssignController from '../controller/mockExambatchassign.controller.js';
import mockExamQnsController from '../controller/mockExamQns.controller.js';
import mockExamResultController from '../controller/mockExamResult.controller.js';
import { instructionController, passageController } from '../controller/instructionpassage.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/exam/create', mockExamController.createExam);
router.post('/exam/update', mockExamController.updateExam);
router.post('/exam/list', mockExamController.listExams);
router.post('/exam/get', mockExamController.getExam);
router.post('/exam/delete', mockExamController.deleteExam);
router.post('/exam/publish-result', mockExamController.publishResult);
router.post('/exam/apply-grace', mockExamController.applyGrace);
router.post('/exam/remove-grace', mockExamController.removeGrace);
router.post('/exam/auto-publish-check', mockExamController.checkAndAutoPublish);
router.post('/exam/student-list', mockExamController.listExamsForStudent);

router.post('/exambatch/assign', mockExamBatchAssignController.assignToBatch);
router.post('/exambatch/disable', mockExamBatchAssignController.disableFromBatch);
router.post('/exambatch/list-by-exam', mockExamBatchAssignController.listBatchesByExam);
router.post('/exambatch/list-by-batch', mockExamBatchAssignController.listExamsByBatch);
router.post('/exambatch/student-status', mockExamBatchAssignController.getStudentStatus);
router.post('/exambatch/sync-students', mockExamBatchAssignController.syncStudents);

router.post('/examqns/create', mockExamQnsController.createQuestion);
router.post('/examqns/bulk-create', mockExamQnsController.createQuestionsBulk);
router.post('/examqns/update', mockExamQnsController.updateQuestion);
router.post('/examqns/delete', mockExamQnsController.deleteQuestion);
router.post('/examqns/bulk-delete-section', mockExamQnsController.bulkDeleteBySection);
router.post('/examqns/list-by-section', mockExamQnsController.listQuestionsBySection);
router.post('/examqns/get-questions', mockExamQnsController.getQuestionsByExam);
router.post('/examqns/view', mockExamQnsController.viewQuestion);
router.post('/examqns/sort-order', mockExamQnsController.updateSortOrder);
router.post('/examqns/upload-image', upload.array('files'), mockExamQnsController.uploadImage);
router.get('/examqns/image', mockExamQnsController.getImage);

router.post('/examresult/submit', mockExamResultController.submitResult);
router.post('/examresult/my-result', mockExamResultController.getMyResult);
router.post('/examresult/leaderboard', mockExamResultController.getLeaderboard);
router.post('/examresult/list-by-exam', mockExamResultController.listResultsByExam);
router.post('/examresult/list-by-batch', mockExamResultController.listResultsByBatch);
router.post('/examresult/list-by-student', mockExamResultController.listResultsByStudent);
router.post('/examresult/section-analytics', mockExamResultController.getSectionAnalytics);

router.post('/instruction/create', instructionController.createInstruction);
router.post('/instruction/update', instructionController.updateInstruction);
router.post('/instruction/list', instructionController.listInstructions);
router.post('/instruction/delete', instructionController.deleteInstruction);

router.post('/passage/create', passageController.createPassage);
router.post('/passage/update', passageController.updatePassage);
router.post('/passage/list', passageController.listPassages);
router.post('/passage/delete', passageController.deletePassage);

export default router;

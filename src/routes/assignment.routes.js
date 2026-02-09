import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import assignCtrl from '../controller/assignment.controller.js';
import questionCtrl from '../controller/assignmentQns.controller.js';

import { uploadQuestionImage } from '../middlewares/multer.js';

routes.post('/create', validatetoken, assignCtrl.createAssignment);
routes.post('/edit', validatetoken, assignCtrl.updateAssignment);
routes.post('/list', validatetoken, assignCtrl.listAssignments);
routes.post('/delete', validatetoken, assignCtrl.deleteAssignment);
routes.post('/import', validatetoken, assignCtrl.importAssignments);

routes.post('/question/image/upload', validatetoken, uploadQuestionImage, questionCtrl.uploadSingleQuestionImage);
routes.post('/question/image/download', validatetoken, questionCtrl.getQuestionImage);

routes.post('/question/bulkcreate', questionCtrl.createQuestionsBulk);
routes.post('/question/list/bytopic', validatetoken, questionCtrl.listQuestionsByTopic);
routes.post('/question/list/bytest', validatetoken, questionCtrl.listQuestionsByTestId);
routes.post('/question/update/bulk/bytest', validatetoken, questionCtrl.bulkUpdateByTestId);
routes.post('/question/delete/bulk/bytest', validatetoken, questionCtrl.bulkSoftDeleteByTestId);
routes.post('/question/list', validatetoken, questionCtrl.listQuestionTests);
routes.post('/question/view', validatetoken, questionCtrl.viewQuestion);
routes.post('/question/update', validatetoken, questionCtrl.updateQuestion);
routes.post('/question/delete', validatetoken, questionCtrl.deleteQuestion);
routes.post('/question/create', validatetoken, questionCtrl.createQuestion);

routes.post('/enableto/batch', validatetoken, assignCtrl.enableTeststoBatch);
routes.post('/disableto/batch', validatetoken, assignCtrl.disableTeststoBatch);
routes.post('/enabledto/batch/list', validatetoken, assignCtrl.listEnabledTestsforBatch);

routes.post('/result/submit', assignCtrl.submitAssignmentResult);
routes.post('/result/list/student', assignCtrl.listResultsByStudent);
routes.post('/result/list/test', assignCtrl.listResultsByTest);
routes.post('/result/list/batch', assignCtrl.listResultsByBatch);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Admission routes' }));

export default routes;

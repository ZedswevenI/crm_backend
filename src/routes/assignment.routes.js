import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import assignCtrl from '../controller/assignment.controller.js';
import questionCtrl from '../controller/assignmentQns.controller.js';

import { uploadQuestionImage } from '../middlewares/multer.js';
import validateSchema from '../middlewares/validation.js';


routes.post('/create', validatetoken, requirePermission('test:create'), assignCtrl.createAssignment);
routes.post('/edit', validatetoken, requirePermission('test:edit'), assignCtrl.updateAssignment);
routes.post('/list', validatetoken, requirePermission('test:list'), assignCtrl.listAssignments);
routes.post('/delete', validatetoken, requirePermission('test:delete'), assignCtrl.deleteAssignment);
routes.post('/import', validatetoken, requirePermission('test:create'), assignCtrl.importAssignments);

routes.post('/question/image/upload', validatetoken, requirePermission('test:addQuestion'), uploadQuestionImage, questionCtrl.uploadSingleQuestionImage);
routes.post('/question/image/download', questionCtrl.getQuestionImage);

routes.post('/question/bulkcreate', questionCtrl.createQuestionsBulk);
routes.post('/question/list/bytopic', validatetoken, requirePermission('test:list'), questionCtrl.listQuestionsByTopic);
routes.post('/question/list/bytest', validatetoken, requirePermission('test:list'), questionCtrl.listQuestionsByTestId);
routes.post('/question/update/bulk/bytest', validatetoken, requirePermission('test:edit'), questionCtrl.bulkUpdateByTestId);
routes.post('/question/delete/bulk/bytest', validatetoken, requirePermission('test:delete'), questionCtrl.bulkSoftDeleteByTestId);
routes.post('/question/list', validatetoken, requirePermission('test:list'), questionCtrl.listQuestionTests);
routes.post('/question/view', validatetoken, requirePermission('test:view'), questionCtrl.viewQuestion);
routes.post('/question/update', validatetoken, requirePermission('test:edit'), questionCtrl.updateQuestion);
routes.post('/question/delete', validatetoken, requirePermission('test:delete'), questionCtrl.deleteQuestion);
routes.post('/question/create', validatetoken, requirePermission('test:addQuestion'), questionCtrl.createQuestion);
routes.post('/question/sortorder', validatetoken, requirePermission('test:rearrangeQuestions'), questionCtrl.updateQuestionSortOrder);

routes.post('/question/bookmark/create', questionCtrl.createBookmark);
routes.post('/question/bookmark/list', questionCtrl.listBookmarks);
routes.post('/question/bookmark/remove', questionCtrl.removeBookmark);
routes.post('/question/report/create', questionCtrl.createReport);
routes.post('/question/report/list', questionCtrl.listReports);
routes.post('/question/report/updatestatus', questionCtrl.updateReportStatus);

routes.post('/enableto/batch', validatetoken, requirePermission('assignmentBatch:assign'), assignCtrl.enableTeststoBatch);
routes.post('/disableto/batch', validatetoken, requirePermission('assignmentBatch:unassign'), assignCtrl.disableTeststoBatch);
routes.post('/enabledto/batch/list', validatetoken, requirePermission('assignmentBatch:list'), assignCtrl.listEnabledTestsforBatch);
routes.post('/topic/enablestatus', validatetoken, requirePermission('enableAssignment:list'), assignCtrl.listTopicEnableStatus);
routes.post('/enabled/tests/by-topic', validatetoken, requirePermission('enableAssignment:viewTests'), assignCtrl.enabledTestsByTopic);

routes.post('/result/submit', assignCtrl.submitAssignmentResult);
routes.post('/result/list/student', assignCtrl.listResultsByStudent);
routes.post('/result/list/test', assignCtrl.listResultsByTest);
routes.post('/result/list/batch', assignCtrl.listResultsByBatch);

routes.post('/gettestds', assignCtrl.getTestIds);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Admission routes' }));

export default routes;

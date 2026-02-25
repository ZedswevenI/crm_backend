import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import batchCtrl from '../controller/batch.controller.js';
import phaseCtrl from '../controller/phaseplan.controller.js';

routes.post('/create', validatetoken, batchCtrl.createBatch);
routes.post('/close', validatetoken, batchCtrl.closeBatch);
routes.post('/list', validatetoken, batchCtrl.listBatches);
routes.post('/view', validatetoken, batchCtrl.viewBatch);
routes.post('/update', validatetoken, batchCtrl.updateBatch);
routes.post('/delete', validatetoken, batchCtrl.deleteBatch);
routes.post('/staff/save', validatetoken, batchCtrl.saveBatchStaffMap);
routes.post('/students/eligible', validatetoken, batchCtrl.listEligibleStudentsForBatch);
routes.post('/students/assign', validatetoken, batchCtrl.assignStudentsToBatch);
routes.post('/students/move', validatetoken, batchCtrl.moveStudentsToBatch);
routes.post('/students/remove', validatetoken, batchCtrl.removeStudentsFromBatch);
routes.post('/students/shuffle', validatetoken, batchCtrl.shuffleStudentsBetweenBatches);
routes.post('/recalc', validatetoken, batchCtrl.recalcBatchStudentCount);
routes.post('/subjects', validatetoken, batchCtrl.getBatchSubjects);
routes.post('/ayinfo', validatetoken, batchCtrl.getBatchAyInfo);

routes.post('/phase/create', validatetoken, phaseCtrl.createPhase);
routes.post('/phase/update', validatetoken, phaseCtrl.updatePhase);
routes.post('/phase/delete', validatetoken, phaseCtrl.deletePhase);
routes.post('/phase/list', validatetoken, phaseCtrl.listPhases);
routes.post('/phase/available-topics', validatetoken, phaseCtrl.getAvailableTopics);
routes.post('/phase/bulkupload', validatetoken, phaseCtrl.bulkUploadPhases);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Batch routes' }));

export default routes;

import express from 'express';
import invigiCtrl from '../controller/invigilation.controller.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';

const router = express.Router();

router.post('/list', validatetoken, requirePermission('invigilation:list'), invigiCtrl.listInvigilation);
router.post('/create', validatetoken, requirePermission('invigilation:create'), invigiCtrl.createInvigilation);
router.post('/get/:id', validatetoken, requirePermission('invigilation:view'), invigiCtrl.getInvigilation);
router.post('/update/:id', validatetoken, requirePermission('invigilation:edit'), invigiCtrl.updateInvigilation);
router.post('/delete/:id', validatetoken, requirePermission('invigilation:delete'), invigiCtrl.deleteInvigilation);
router.post('/by-date/:date', validatetoken, requirePermission('invigilation:list'), invigiCtrl.getByDate);
router.post('/upcoming', validatetoken, requirePermission('invigilation:list'), invigiCtrl.listUpcoming);

export default router;

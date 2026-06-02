import express from 'express';
import invigiCtrl from '../controller/invigilation.controller.js';
import validatetoken from '../middlewares/auth.js';

const router = express.Router();

router.post('/list', validatetoken, invigiCtrl.listInvigilation);
router.post('/create', validatetoken, invigiCtrl.createInvigilation);
router.post('/get/:id', validatetoken, invigiCtrl.getInvigilation);
router.post('/update/:id', validatetoken, invigiCtrl.updateInvigilation);
router.post('/delete/:id', validatetoken, invigiCtrl.deleteInvigilation);
router.post('/by-date/:date', validatetoken, invigiCtrl.getByDate);

export default router;

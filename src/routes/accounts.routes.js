import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import accountsCtrl from '../controller/accounts.controller.js';

// -------- Cheque Register
routes.post('/payments/list', validatetoken, accountsCtrl.listPayments);
routes.post('/student-fee/add', validatetoken, accountsCtrl.addStudentFeePayments);
routes.post('/student-fee/add/bulk', validatetoken, accountsCtrl.addStudentFeePaymentsBulk);
routes.post('/cheque/list', validatetoken, accountsCtrl.listCheques);
routes.post('/cheque/view', validatetoken, accountsCtrl.viewCheque);
routes.post('/cheque/update-remarks', validatetoken, accountsCtrl.updateChequeRemarks);
routes.post('/deposit/create', validatetoken, accountsCtrl.createDepositBatch);
routes.post('/deposit/list', validatetoken, accountsCtrl.listDepositBatches);
routes.post('/deposit/view', validatetoken, accountsCtrl.viewDepositBatch);
routes.post('/deposit/remove-cheque', validatetoken, accountsCtrl.removeChequeFromDepositBatch);
routes.post('/cheque/reconcile', validatetoken, accountsCtrl.reconcileCheque);
routes.post('/cheque/bulk-reconcile', validatetoken, accountsCtrl.bulkReconcileCheques);
routes.post('/cheque/extension/request', validatetoken, accountsCtrl.requestChequeExtension);
routes.post('/cheque/extension/list', validatetoken, accountsCtrl.listChequeExtensions);
routes.post('/cheque/extension/view', validatetoken, accountsCtrl.viewChequeExtension);
routes.post('/cheque/extension/approve', validatetoken, accountsCtrl.approveChequeExtension);
routes.post('/cheque/extension/reject', validatetoken, accountsCtrl.rejectChequeExtension);
routes.post('/cheque/replacement/request', validatetoken, accountsCtrl.requestChequeReplacement);
routes.post('/cheque/replacement/request-neft', validatetoken, accountsCtrl.requestNeftReplacementForCheque);
routes.post('/cheque/replacement/history', validatetoken, accountsCtrl.replacementHistory);
routes.post('/cheque/merge/create', validatetoken, accountsCtrl.createChequeMerge);
routes.post('/cheque/merge/view', validatetoken, accountsCtrl.viewChequeMerge);
routes.post('/cheque/merge/unmerge', validatetoken, accountsCtrl.unmergeCheques);
routes.post('/neft/list', validatetoken, accountsCtrl.listNeft);
routes.post('/neft/update-status', validatetoken, accountsCtrl.updateNeftStatus);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Accounts routes' }));

export default routes;

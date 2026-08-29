import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import accountsCtrl from '../controller/accounts.controller.js';


// -------- Cheque Register
routes.post('/payments/list', validatetoken, requirePermission('accounts:listPayments'), accountsCtrl.listPayments);
routes.post('/student-fee/add', validatetoken, requirePermission('accounts:addPayment'), accountsCtrl.addStudentFeePayments);
routes.post('/student-fee/add/bulk', validatetoken, requirePermission('accounts:addPayment'), accountsCtrl.addStudentFeePaymentsBulk);
routes.post('/cheque/list', validatetoken, requirePermission('accounts:listCheques'), accountsCtrl.listCheques);
routes.post('/cheque/view', validatetoken, requirePermission('accounts:listCheques'), accountsCtrl.viewCheque);
routes.post('/cheque/update-remarks', validatetoken, requirePermission('accounts:listCheques'), accountsCtrl.updateChequeRemarks);
routes.post('/deposit/create', validatetoken, requirePermission('accounts:depositBatch'), accountsCtrl.createDepositBatch);
routes.post('/deposit/list', validatetoken, requirePermission('accounts:depositBatch'), accountsCtrl.listDepositBatches);
routes.post('/deposit/view', validatetoken, requirePermission('accounts:depositBatch'), accountsCtrl.viewDepositBatch);
routes.post('/deposit/remove-cheque', validatetoken, requirePermission('accounts:depositBatch'), accountsCtrl.removeChequeFromDepositBatch);
routes.post('/cheque/reconcile', validatetoken, requirePermission('accounts:reconcileCheque'), accountsCtrl.reconcileCheque);
routes.post('/cheque/bulk-reconcile', validatetoken, requirePermission('accounts:reconcileCheque'), accountsCtrl.bulkReconcileCheques);
routes.post('/cheque/extension/request', validatetoken, requirePermission('accounts:chequeExtension'), accountsCtrl.requestChequeExtension);
routes.post('/cheque/extension/list', validatetoken, requirePermission('accounts:chequeExtension'), accountsCtrl.listChequeExtensions);
routes.post('/cheque/extension/view', validatetoken, requirePermission('accounts:chequeExtension'), accountsCtrl.viewChequeExtension);
routes.post('/cheque/extension/approve', validatetoken, requirePermission('accounts:chequeExtension'), accountsCtrl.approveChequeExtension);
routes.post('/cheque/extension/reject', validatetoken, requirePermission('accounts:chequeExtension'), accountsCtrl.rejectChequeExtension);
routes.post('/cheque/replacement/request', validatetoken, requirePermission('accounts:chequeReplacement'), accountsCtrl.requestChequeReplacement);
routes.post('/cheque/replacement/request-neft', validatetoken, requirePermission('accounts:chequeReplacement'), accountsCtrl.requestNeftReplacementForCheque);
routes.post('/cheque/replacement/history', validatetoken, requirePermission('accounts:chequeReplacement'), accountsCtrl.replacementHistory);
routes.post('/cheque/merge/create', validatetoken, requirePermission('accounts:reconcileCheque'), accountsCtrl.createChequeMerge);
routes.post('/cheque/merge/view', validatetoken, requirePermission('accounts:listCheques'), accountsCtrl.viewChequeMerge);
routes.post('/cheque/merge/unmerge', validatetoken, requirePermission('accounts:reconcileCheque'), accountsCtrl.unmergeCheques);
routes.post('/neft/list', validatetoken, requirePermission('accounts:listNeft'), accountsCtrl.listNeft);
routes.post('/neft/update-status', validatetoken, requirePermission('accounts:updateNeftStatus'), accountsCtrl.updateNeftStatus);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Accounts routes' }));

export default routes;

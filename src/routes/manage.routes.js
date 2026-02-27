import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import supportCtrl from '../controller/supportTicket.controller.js';

routes.post('/support/create', supportCtrl.createTicket);
routes.post('/support/list', validatetoken, supportCtrl.listTickets);
routes.post('/support/list/student', supportCtrl.listTicketstudent);
routes.post('/support/assign', validatetoken, supportCtrl.assignTicket);
routes.post('/support/priority/update', validatetoken, supportCtrl.updateTicketPriority);
routes.post('/support/status/update', validatetoken, supportCtrl.updateTicketStatus);
routes.post('/support/view', validatetoken, supportCtrl.viewTicket);
routes.post('/support/report', validatetoken, supportCtrl.getTicketReports);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Timetable routes' }));

export default routes;

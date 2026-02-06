import { Router } from 'express';

const routes = Router();
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import assignCtrl from '../controller/assignment.controller.js';

routes.post('/create', validatetoken, assignCtrl.createAssignment);
routes.post('/edit', validatetoken, assignCtrl.updateAssignment);
routes.post('/list', validatetoken, assignCtrl.listAssignments);
routes.post('/delete', validatetoken, assignCtrl.deleteAssignment);
routes.post('/import', validatetoken, assignCtrl.importAssignments);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Admission routes' }));

export default routes;

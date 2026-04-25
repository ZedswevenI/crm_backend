import { Router } from 'express';

const routes = Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import supportCtrl from '../controller/supportTicket.controller.js';
import circularCtrl from '../controller/circular.controller.js';
import libraryCtrl from '../controller/material.controller.js';
import phaseCtrl from '../controller/phaseplan.controller.js';
import performanceCtrl from '../controller/performance.controller.js';

// Phase Plan
routes.post('/phase/create', validatetoken, phaseCtrl.createPhase);
routes.post('/phase/update', validatetoken, phaseCtrl.updatePhase);
routes.post('/phase/delete', validatetoken, phaseCtrl.deletePhase);
routes.post('/phase/list', validatetoken, phaseCtrl.listPhases);
routes.post('/phase/allotment/report', validatetoken, phaseCtrl.phasePlanReport);
routes.post('/phase/available-topics', validatetoken, phaseCtrl.getAvailableTopics);
routes.post('/phase/bulkupload', validatetoken, phaseCtrl.bulkUploadPhases);

// Calender Activities
routes.post('/activity/create', validatetoken, phaseCtrl.createActivity);
routes.post('/activity/update', validatetoken, phaseCtrl.editActivity);
routes.post('/activity/delete', validatetoken, phaseCtrl.deleteActivity);
routes.post('/activity/list', validatetoken, phaseCtrl.listActivities);
routes.post('/activity/view', validatetoken, phaseCtrl.viewActivity);
routes.post('/activity/bulkupload', validatetoken, phaseCtrl.bulkUploadActivities);
routes.post('/activity/changeStatus', validatetoken, phaseCtrl.changeStatus);
routes.post('/activity/list/student', phaseCtrl.listStudentActivities);

// library
routes.post('/library/upload', validatetoken, upload.single('file'), libraryCtrl.uploadMaterialFile);
routes.post('/library/create', validatetoken, libraryCtrl.createMaterial);
routes.post('/library/edit', validatetoken, libraryCtrl.editMaterial);
routes.post('/library/make-inactive', validatetoken, libraryCtrl.makeInactive);
routes.post('/library/delete', validatetoken, libraryCtrl.deleteMaterial);
routes.post('/library/list', validatetoken, libraryCtrl.listMaterials);
routes.post('/library/view', validatetoken, libraryCtrl.viewMaterial);

// Support Tickets
routes.post('/support/create', supportCtrl.createTicket);
routes.post('/support/list', validatetoken, supportCtrl.listTickets);
routes.post('/support/list/student', supportCtrl.listTicketstudent);
routes.post('/support/assign', validatetoken, supportCtrl.assignTicket);
routes.post('/support/priority/update', validatetoken, supportCtrl.updateTicketPriority);
routes.post('/support/status/update', validatetoken, supportCtrl.updateTicketStatus);
routes.post('/support/view', validatetoken, supportCtrl.viewTicket);
routes.post('/support/report', validatetoken, supportCtrl.getTicketReports);
routes.post('/support/reopen', supportCtrl.reopenTicket);

// Circular
routes.post('/circular/upload', validatetoken, upload.single('file'), circularCtrl.uploadCircularFile);
routes.post('/circular/create', validatetoken, circularCtrl.createCircular);
routes.post('/circular/list', validatetoken, circularCtrl.listCirculars);
routes.post('/circular/list/student', circularCtrl.getStudentCirculars);
routes.post('/circular/update', validatetoken, circularCtrl.editCircular);
routes.post('/circular/delete', validatetoken, circularCtrl.deleteCircular);
routes.post('/circular/view', validatetoken, circularCtrl.viewCircular);
routes.post('/circular/reports', validatetoken, circularCtrl.getCircularReports);
routes.post('/circular/publish', validatetoken, circularCtrl.publishCircular);
routes.post('/circular/markasread', circularCtrl.markCircularAsRead);
routes.post('/circular/getRead/list', validatetoken, circularCtrl.getCircularReadList);

// Staff Performance
routes.post('/staff/performance/add', validatetoken, performanceCtrl.addStaffFeedback);
routes.post('/staff/performance/list', validatetoken, performanceCtrl.listStaffFeedback);
routes.post('/staff/performance/list/all', validatetoken, performanceCtrl.listAllStaffPerf);
routes.post('/staff/performance/update', validatetoken, performanceCtrl.updateStaffFeedback);
routes.post('/staff/performance/delete', validatetoken, performanceCtrl.deleteStaffFeedback);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Timetable routes' }));

export default routes;

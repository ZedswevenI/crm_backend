import { Router } from 'express';

const routes = Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
import validate from '../middlewares/validation.js';
import constants from '../helpers/constants.js';
import validatetoken from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permission.js';
import supportCtrl from '../controller/supportTicket.controller.js';
import circularCtrl from '../controller/circular.controller.js';
import libraryCtrl from '../controller/material.controller.js';
import phaseCtrl from '../controller/phaseplan.controller.js';
import performanceCtrl from '../controller/performance.controller.js';


// Phase Plan
routes.post('/phase/create', validatetoken, requirePermission('phase:create'), phaseCtrl.createPhase);
routes.post('/phase/update', validatetoken, requirePermission('phase:edit'), phaseCtrl.updatePhase);
routes.post('/phase/delete', validatetoken, requirePermission('phase:delete'), phaseCtrl.deletePhase);
routes.post('/phase/list', validatetoken, requirePermission('phase:list'), phaseCtrl.listPhases);
routes.post('/phase/allotment/report', validatetoken, requirePermission('phase:view'), phaseCtrl.phasePlanReport);
routes.post('/phase/available-topics', validatetoken, requirePermission('phase:view'), phaseCtrl.getAvailableTopics);
routes.post('/phase/bulkupload', validatetoken, requirePermission('phase:create'), phaseCtrl.bulkUploadPhases);

// Calender Activities
routes.post('/activity/create', validatetoken, requirePermission('activity:create'), phaseCtrl.createActivity);
routes.post('/activity/update', validatetoken, requirePermission('activity:edit'), phaseCtrl.editActivity);
routes.post('/activity/delete', validatetoken, requirePermission('activity:delete'), phaseCtrl.deleteActivity);
routes.post('/activity/list', validatetoken, requirePermission('activity:list'), phaseCtrl.listActivities);
routes.post('/activity/view', validatetoken, requirePermission('activity:view'), phaseCtrl.viewActivity);
routes.post('/activity/bulkupload', validatetoken, requirePermission('activity:create'), phaseCtrl.bulkUploadActivities);
routes.post('/activity/changeStatus', validatetoken, requirePermission('activity:edit'), phaseCtrl.changeStatus);
routes.post('/activity/list/student', phaseCtrl.listStudentActivities);

// library
routes.post('/library/upload', validatetoken, requirePermission('knowledge:create'), upload.single('file'), libraryCtrl.uploadMaterialFile);
routes.post('/library/create', validatetoken, requirePermission('knowledge:create'), libraryCtrl.createMaterial);
routes.post('/library/edit', validatetoken, requirePermission('knowledge:edit'), libraryCtrl.editMaterial);
routes.post('/library/make-inactive', validatetoken, requirePermission('knowledge:edit'), libraryCtrl.makeInactive);
routes.post('/library/delete', validatetoken, requirePermission('knowledge:delete'), libraryCtrl.deleteMaterial);
routes.post('/library/list', validatetoken, requirePermission('knowledge:list'), libraryCtrl.listMaterials);
routes.post('/library/view', validatetoken, requirePermission('knowledge:view'), libraryCtrl.viewMaterial);

// Support Tickets
routes.post('/support/create', supportCtrl.createTicket);
routes.post('/support/list', validatetoken, requirePermission('support:list'), supportCtrl.listTickets);
routes.post('/support/list/student', supportCtrl.listTicketstudent);
routes.post('/support/assign', validatetoken, requirePermission('support:assignStaff'), supportCtrl.assignTicket);
routes.post('/support/priority/update', validatetoken, requirePermission('support:updatePriority'), supportCtrl.updateTicketPriority);
routes.post('/support/status/update', validatetoken, requirePermission('support:updateStatus'), supportCtrl.updateTicketStatus);
routes.post('/support/view', validatetoken, requirePermission('support:view'), supportCtrl.viewTicket);
routes.post('/support/report', validatetoken, requirePermission('support:list'), supportCtrl.getTicketReports);
routes.post('/support/reopen', supportCtrl.reopenTicket);

// Circular
routes.post('/circular/upload', validatetoken, requirePermission('circular:create'), upload.single('file'), circularCtrl.uploadCircularFile);
routes.post('/circular/create', validatetoken, requirePermission('circular:create'), circularCtrl.createCircular);
routes.post('/circular/list', validatetoken, requirePermission('circular:list'), circularCtrl.listCirculars);
routes.post('/circular/list/student', circularCtrl.getStudentCirculars);
routes.post('/circular/update', validatetoken, requirePermission('circular:edit'), circularCtrl.editCircular);
routes.post('/circular/delete', validatetoken, requirePermission('circular:delete'), circularCtrl.deleteCircular);
routes.post('/circular/view', validatetoken, requirePermission('circular:view'), circularCtrl.viewCircular);
routes.post('/circular/reports', validatetoken, requirePermission('circular:list'), circularCtrl.getCircularReports);
routes.post('/circular/publish', validatetoken, requirePermission('circular:publish'), circularCtrl.publishCircular);
routes.post('/circular/markasread', circularCtrl.markCircularAsRead);
routes.post('/circular/getRead/list', validatetoken, requirePermission('circular:list'), circularCtrl.getCircularReadList);

// Staff Performance
routes.post('/staff/performance/add', validatetoken, requirePermission('performance:override'), performanceCtrl.addStaffFeedback);
routes.post('/staff/performance/list', validatetoken, requirePermission('performance:list'), performanceCtrl.listStaffFeedback);
routes.post('/staff/performance/list/all', validatetoken, requirePermission('performance:list'), performanceCtrl.listAllStaffPerf);
routes.post('/staff/performance/update', validatetoken, requirePermission('performance:override'), performanceCtrl.updateStaffFeedback);
routes.post('/staff/performance/delete', validatetoken, requirePermission('performance:override'), performanceCtrl.deleteStaffFeedback);

routes.use('/', (req, res, next) => res.json({ message: 'Inside Timetable routes' }));

export default routes;

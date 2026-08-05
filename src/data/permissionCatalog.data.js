// Source-of-truth catalog for permission keys ("<module>:<action>").
// Consumed by scripts/seed-permissions.js to populate the Permission collection.
// Edit this file to add/remove permissions, then re-run the seed script.

export const PERMISSION_MODULES = [
  { module: 'dashboard', label: 'Dashboard', actions: ['view'] },

  { module: 'batch', label: 'Batch', actions: ['list', 'view', 'create', 'edit', 'delete', 'close', 'assignStudents', 'assignFaculty', 'promote', 'logLateEntry', 'addSpecialClass'] },
  { module: 'class', label: 'Class', actions: ['list', 'view'] },

  { module: 'timetable', label: 'Timetable', actions: ['list', 'create', 'view', 'edit', 'delete', 'publish', 'revertDraft', 'export'] },
  { module: 'attendance', label: 'Attendance', actions: ['list', 'mark', 'edit', 'export', 'report'] },
  { module: 'schoolAttendance', label: 'School Attendance', actions: ['list', 'mark', 'toggleStudent', 'declareHoliday', 'removeHoliday', 'finalise', 'submit', 'export', 'print'] },

  {
    module: 'exam',
    label: 'Exams',
    actions: ['list', 'create', 'view', 'edit', 'duplicate', 'delete', 'addQuestion', 'importQuestions', 'importAnswers', 'rearrangeQuestions', 'publish', 'publishResult', 'assignBatch', 'reevaluate', 'graceMarks', 'enable', 'disable', 'offlineMarksEntry', 'marksImport']
  },
  { module: 'examContent', label: 'Exam Instructions / Passage', actions: ['list', 'create', 'view', 'edit', 'delete'] },
  { module: 'examImport', label: 'Imported Exams', actions: ['list', 'view', 'delete'] },

  { module: 'test', label: 'Test (Assignments)', actions: ['list', 'create', 'view', 'edit', 'delete', 'addQuestion', 'importQuestions', 'rearrangeQuestions', 'report'] },
  { module: 'assignmentBatch', label: 'Assignment (per-batch)', actions: ['list', 'view', 'assign', 'unassign'] },
  { module: 'enableAssignment', label: 'Enable Assignment', actions: ['list', 'enableTopic', 'disableTopic', 'resetAll', 'viewTests'] },

  { module: 'student', label: 'Student', actions: ['list', 'view', 'create', 'edit', 'bulkUpload', 'imageUpload', 'rpaImport', 'boardImport', 'alumniImport', 'export'] },
  { module: 'teacher', label: 'Teachers', actions: ['list', 'view'] },

  { module: 'reports', label: 'Reports', actions: ['view', 'export'] },
  { module: 'performance', label: 'Performance', actions: ['list', 'view', 'sync', 'override'] },

  { module: 'communication', label: 'Communication (Compose)', actions: ['create', 'previewRecipients', 'send'] },
  { module: 'communicationTemplate', label: 'Communication Templates', actions: ['list', 'create', 'edit', 'delete'] },
  { module: 'communicationEvent', label: 'Communication Event Mapping', actions: ['list', 'create', 'edit', 'delete'] },
  { module: 'communicationBulkMail', label: 'Communication Bulk Mail (Excel)', actions: ['send', 'reset'] },
  { module: 'communicationLog', label: 'Communication Sent Logs', actions: ['list', 'view', 'retry'] },

  { module: 'chat', label: 'Chat', actions: ['list', 'send', 'search'] },

  { module: 'circular', label: 'Circular', actions: ['list', 'create', 'view', 'edit', 'publish', 'delete'] },
  { module: 'feedback', label: 'Feedback', actions: ['list', 'create', 'viewResults', 'consolidatedReport', 'edit', 'changeStatus', 'delete'] },
  { module: 'feedbackTemplate', label: 'Feedback Templates', actions: ['list', 'create', 'edit', 'toggleStatus', 'delete', 'export'] },

  { module: 'activity', label: 'Activity', actions: ['list', 'create', 'view', 'edit', 'delete', 'export'] },
  { module: 'ptm', label: 'PTM', actions: ['list', 'create', 'view', 'edit', 'delete'] },
  { module: 'phase', label: 'Phase', actions: ['list', 'create', 'view', 'edit', 'delete'] },
  { module: 'knowledge', label: 'Knowledge (Library)', actions: ['list', 'create', 'view', 'edit', 'delete'] },
  { module: 'package', label: 'Package', actions: ['list', 'create', 'view', 'edit', 'enable', 'disable', 'delete'] },
  { module: 'task', label: 'Task', actions: ['list', 'create', 'view', 'edit'] },
  { module: 'invigilation', label: 'Invigilation', actions: ['list', 'create', 'view', 'edit', 'print', 'delete'] },
  { module: 'inward', label: 'Inward', actions: ['list', 'create', 'view', 'edit', 'delete'] },
  { module: 'support', label: 'Support', actions: ['list', 'view', 'assignStaff', 'updatePriority', 'updateStatus'] },

  { module: 'orgCenter', label: 'Org Masters - Center', actions: ['list', 'create', 'view', 'edit', 'delete'] },
  { module: 'orgStaff', label: 'Org Masters - Staff', actions: ['list', 'create', 'view', 'edit', 'delete'] },
  { module: 'orgUser', label: 'Org Masters - Users', actions: ['list', 'create', 'view', 'edit', 'delete', 'assignAccess'] },
  { module: 'orgProgram', label: 'Org Masters - Program', actions: ['list', 'create', 'view', 'edit', 'addSubjects', 'removeSubjects', 'examMapping', 'delete'] },
  { module: 'orgDept', label: 'Org Masters - Department', actions: ['list', 'create', 'edit', 'delete'] },
  { module: 'orgSubject', label: 'Org Masters - Subject', actions: ['list', 'create', 'edit', 'delete'] },
  { module: 'orgBankAccount', label: 'Org Masters - Bank Accounts', actions: ['list', 'create', 'edit', 'delete'] },
  { module: 'orgFeePlan', label: 'Org Masters - Fee Plan', actions: ['list', 'create', 'edit', 'delete', 'view'] },
  { module: 'orgAcademicYear', label: 'Org Masters - Academic Year', actions: ['list', 'create', 'edit', 'delete', 'view'] },
  { module: 'orgTopic', label: 'Org Masters - Topic', actions: ['list', 'create', 'edit', 'delete', 'addSubTopics'] },
  { module: 'orgSubTopic', label: 'Org Masters - Sub-topic', actions: ['list', 'create', 'edit', 'delete'] },
  { module: 'orgExamCategory', label: 'Org Masters - Exam Category', actions: ['list', 'create', 'edit', 'delete', 'addSubCategories'] },
  { module: 'orgSchoolExam', label: 'Org Masters - School Exams', actions: ['list', 'create', 'edit', 'delete'] },
  { module: 'orgHelpCenter', label: 'Org Masters - Help Center', actions: ['list', 'create', 'edit', 'delete'] },

  { module: 'notification', label: 'Notification', actions: ['list', 'markRead', 'markAllRead', 'remove'] },

  { module: 'admission', label: 'Admission', actions: ['list', 'view', 'create', 'update', 'submitForApproval', 'approve', 'reject', 'export', 'bulkUpload', 'review'] },
  { module: 'accounts', label: 'Accounts', actions: ['listPayments', 'addPayment', 'listCheques', 'reconcileCheque', 'chequeExtension', 'chequeReplacement', 'depositBatch', 'listNeft', 'updateNeftStatus'] }
];

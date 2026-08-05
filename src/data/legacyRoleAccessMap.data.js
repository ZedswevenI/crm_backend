// DRAFT mapping used ONLY by scripts/migrate-user-access.js to seed initial `portal`/`permissions`
// values for existing users based on their legacy `roleLevel` (L1-L7).
// This is a starting point, not policy — review and adjust before running the migration for real.
// After migration, each user's permissions are independent and editable via /ims/user/access/update.

import { PERMISSION_MODULES } from './permissionCatalog.data.js';

const allKeysOf = (...modules) =>
  modules.flatMap((moduleKey) => {
    const entry = PERMISSION_MODULES.find((m) => m.module === moduleKey);
    return entry ? entry.actions.map((action) => `${moduleKey}:${action}`) : [];
  });

const allKeysOfEveryModule = () => PERMISSION_MODULES.flatMap((m) => m.actions.map((action) => `${m.module}:${action}`));

export const ROLE_PORTAL_MAP = {
  L1: ['CRM', 'ACADEMIC'], // Super Admin
  L2: ['CRM'], // Admissions
  L3: ['CRM', 'ACADEMIC'], // AO
  L4: ['ACADEMIC'], // Teacher
  L5: ['ACADEMIC'], // Exam
  L6: ['CRM'], // Account
  L7: ['CRM', 'ACADEMIC'] // EDP
};

export const ROLE_PERMISSION_MAP = {
  // L1 (Super Admin) users who are NOT the tenant's designated isAdmin=true user still get full
  // access explicitly, since isAdmin is limited to exactly one user per tenant.
  L1: allKeysOfEveryModule(),
  L2: allKeysOf('admission', 'student', 'dashboard', 'reports', 'orgCenter', 'notification'),
  L3: allKeysOf('orgCenter', 'orgStaff', 'orgProgram', 'orgDept', 'orgSubject', 'orgTopic', 'orgSubTopic', 'orgBankAccount', 'orgFeePlan', 'orgAcademicYear', 'orgExamCategory', 'orgSchoolExam', 'student', 'batch', 'class', 'dashboard', 'reports'),
  L4: allKeysOf('batch', 'class', 'timetable', 'attendance', 'schoolAttendance', 'test', 'assignmentBatch', 'task', 'ptm', 'activity', 'feedback', 'student', 'dashboard'),
  L5: allKeysOf('exam', 'examContent', 'examImport', 'invigilation', 'test', 'enableAssignment', 'assignmentBatch', 'reports', 'dashboard'),
  L6: allKeysOf('accounts', 'admission', 'dashboard', 'reports'),
  L7: allKeysOf('student', 'orgStaff', 'orgUser', 'communication', 'communicationTemplate', 'communicationEvent', 'communicationBulkMail', 'communicationLog', 'notification', 'reports', 'dashboard')
};

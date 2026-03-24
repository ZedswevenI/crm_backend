// import { v4 as uuid } from 'uuid';

// export const PRE_PTM_QUESTIONS = [
//   {
//     fieldId: 'pre_q1',
//     fieldType: 'text',
//     fieldText: 'What specific concerns do you have about your child?',
//     fieldOptions: [],
//     fieldValue: null
//   },
//   {
//     fieldId: 'pre_q2',
//     fieldType: 'radio',
//     fieldText: 'How is your child performing academically at home?',
//     fieldOptions: ['Excellent', 'Good', 'Average', 'Needs improvement'],
//     fieldValue: null
//   },
//   {
//     fieldId: 'pre_q3',
//     fieldType: 'checkbox',
//     fieldText: 'Which areas would you like to discuss in this meeting?',
//     fieldOptions: ['Academics', 'Behaviour', 'Attendance', 'Homework', 'Exams', 'Career guidance'],
//     fieldValue: null
//   },
//   {
//     fieldId: 'pre_q4',
//     fieldType: 'radio',
//     fieldText: 'Has your child shown any behavioural changes recently?',
//     fieldOptions: ['Yes, positive changes', 'Yes, concerning changes', 'No changes noticed'],
//     fieldValue: null
//   },
//   {
//     fieldId: 'pre_q5',
//     fieldType: 'text',
//     fieldText: 'Any additional information you want the teacher to know before the meeting?',
//     fieldOptions: [],
//     fieldValue: null
//   }
// ];

// export const POST_PTM_QUESTIONS = [
//   {
//     fieldId: 'post_q1',
//     fieldType: 'radio',
//     fieldText: "How satisfied are you with today's parent-teacher meeting?",
//     fieldOptions: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
//     fieldValue: null
//   },
//   {
//     fieldId: 'post_q2',
//     fieldType: 'checkbox',
//     fieldText: 'Which topics were covered in the meeting?',
//     fieldOptions: ['Academics', 'Behaviour', 'Attendance', 'Homework', 'Exams', 'Career guidance'],
//     fieldValue: null
//   },
//   {
//     fieldId: 'post_q3',
//     fieldType: 'radio',
//     fieldText: 'Did the teacher address your concerns clearly?',
//     fieldOptions: ['Yes, completely', 'Partially', 'No'],
//     fieldValue: null
//   },
//   {
//     fieldId: 'post_q4',
//     fieldType: 'radio',
//     fieldText: "Would you recommend this school to others based on today's experience?",
//     fieldOptions: ['Definitely yes', 'Probably yes', 'Not sure', 'No'],
//     fieldValue: null
//   },
//   {
//     fieldId: 'post_q5',
//     fieldType: 'text',
//     fieldText: 'Any suggestions or additional comments about the meeting?',
//     fieldOptions: [],
//     fieldValue: null
//   }
// ];

// export const getPrePtmQuestions = () => PRE_PTM_QUESTIONS.map((q) => ({ ...q, fieldValue: null }));

// export const getPostPtmQuestions = () => POST_PTM_QUESTIONS.map((q) => ({ ...q, fieldValue: null }));

import { v4 as uuid } from 'uuid';

// ── Marker to identify subject-expandable questions ──
// Any question with {subject} in fieldText gets expanded
// per subject in the batch's staffMap at schedule time

export const PRE_PTM_QUESTIONS = [
  // ── Fixed questions ──────────────────────────────
  {
    fieldId: 'pre_q1',
    fieldType: 'text',
    isSubjectBased: false,
    fieldText: 'What specific concerns do you have about your child?',
    fieldOptions: [],
    fieldValue: null
  },
  {
    fieldId: 'pre_q2',
    fieldType: 'radio',
    isSubjectBased: false,
    fieldText: 'How is your child performing academically at home?',
    fieldOptions: ['Excellent', 'Good', 'Average', 'Needs improvement'],
    fieldValue: null
  },
  {
    fieldId: 'pre_q3',
    fieldType: 'checkbox',
    isSubjectBased: false,
    fieldText: 'Which areas would you like to discuss in this meeting?',
    fieldOptions: ['Academics', 'Behaviour', 'Attendance', 'Homework', 'Exams', 'Career guidance'],
    fieldValue: null
  },
  {
    fieldId: 'pre_q4',
    fieldType: 'radio',
    isSubjectBased: false,
    fieldText: 'Has your child shown any behavioural changes recently?',
    fieldOptions: ['Yes, positive changes', 'Yes, concerning changes', 'No changes noticed'],
    fieldValue: null
  },

  // ── Subject-based questions (expand per subject) ──
  // {subject} is replaced with actual subject name at schedule time
  {
    fieldId: 'pre_sq1',
    fieldType: 'radio',
    isSubjectBased: true,
    fieldText: "How would you rate your child's performance in {subject}?",
    fieldOptions: ['Excellent', 'Good', 'Average', 'Poor'],
    fieldValue: null
  },
  {
    fieldId: 'pre_sq2',
    fieldType: 'radio',
    isSubjectBased: true,
    fieldText: "How is your child's interest level in {subject}?",
    fieldOptions: ['Very interested', 'Interested', 'Neutral', 'Not interested'],
    fieldValue: null
  },
  {
    fieldId: 'pre_sq3',
    fieldType: 'radio',
    isSubjectBased: true,
    fieldText: 'Does your child complete {subject} homework regularly?',
    fieldOptions: ['Always', 'Usually', 'Sometimes', 'Rarely'],
    fieldValue: null
  },
  {
    fieldId: 'pre_sq4',
    fieldType: 'text',
    isSubjectBased: true,
    fieldText: 'Any specific concerns about {subject} you want to discuss?',
    fieldOptions: [],
    fieldValue: null
  },

  // ── Final fixed question ─────────────────────────
  {
    fieldId: 'pre_q5',
    fieldType: 'text',
    isSubjectBased: false,
    fieldText: 'Any additional information you want the teacher to know before the meeting?',
    fieldOptions: [],
    fieldValue: null
  }
];

export const POST_PTM_QUESTIONS = [
  // ── Fixed questions ──────────────────────────────
  {
    fieldId: 'post_q1',
    fieldType: 'radio',
    isSubjectBased: false,
    fieldText: "How satisfied are you with today's parent-teacher meeting?",
    fieldOptions: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
    fieldValue: null
  },
  {
    fieldId: 'post_q2',
    fieldType: 'checkbox',
    isSubjectBased: false,
    fieldText: 'Which topics were covered in the meeting?',
    fieldOptions: ['Academics', 'Behaviour', 'Attendance', 'Homework', 'Exams', 'Career guidance'],
    fieldValue: null
  },
  {
    fieldId: 'post_q3',
    fieldType: 'radio',
    isSubjectBased: false,
    fieldText: 'Did the teacher address your concerns clearly?',
    fieldOptions: ['Yes, completely', 'Partially', 'No'],
    fieldValue: null
  },

  // ── Subject-based questions ───────────────────────
  {
    fieldId: 'post_sq1',
    fieldType: 'radio',
    isSubjectBased: true,
    fieldText: "How would you rate the {subject} teacher's teaching quality?",
    fieldOptions: ['Excellent', 'Good', 'Average', 'Poor'],
    fieldValue: null
  },
  {
    fieldId: 'post_sq2',
    fieldType: 'radio',
    isSubjectBased: true,
    fieldText: "Did the {subject} teacher explain your child's progress clearly?",
    fieldOptions: ['Yes, very clearly', 'Somewhat clearly', 'Not clearly'],
    fieldValue: null
  },
  {
    fieldId: 'post_sq3',
    fieldType: 'text',
    isSubjectBased: true,
    fieldText: 'Any suggestions for improvement in {subject}?',
    fieldOptions: [],
    fieldValue: null
  },

  // ── Final fixed question ─────────────────────────
  {
    fieldId: 'post_q4',
    fieldType: 'radio',
    isSubjectBased: false,
    fieldText: 'Would you recommend this school to others?',
    fieldOptions: ['Definitely yes', 'Probably yes', 'Not sure', 'No'],
    fieldValue: null
  },
  {
    fieldId: 'post_q5',
    fieldType: 'text',
    isSubjectBased: false,
    fieldText: 'Any additional comments about the meeting?',
    fieldOptions: [],
    fieldValue: null
  }
];

/**
 * Deep clone fixed questions — no subject expansion
 * Used when batch staffMap is empty or scope is not BATCH
 */
export const getPrePtmQuestions = () => PRE_PTM_QUESTIONS.filter((q) => !q.isSubjectBased).map((q) => ({ ...q, fieldOptions: [...q.fieldOptions], fieldValue: null }));

export const getPostPtmQuestions = () => POST_PTM_QUESTIONS.filter((q) => !q.isSubjectBased).map((q) => ({ ...q, fieldOptions: [...q.fieldOptions], fieldValue: null }));

/**
 * Expand subject-based questions using batch staffMap
 * staffMap: [{ subjectId, subjectName, staffId, staffName }]
 *
 * subjectName format from DB: "MATHS (MATH)"
 * We extract clean name: "MATHS" for question text
 * We use subjectCode: "MATH" for fieldId suffix
 */
const extractSubjectParts = (subjectName) => {
  // "MATHS (MATH)" → { displayName: "Maths", subjectCode: "MATH" }
  const match = String(subjectName || '').match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    const displayName = match[1].trim();
    const subjectCode = match[2].trim().toUpperCase();
    // Title case for display: "MATHS" → "Maths"
    const titleCase = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
    return { displayName: titleCase, subjectCode };
  }
  // Fallback — no brackets format
  const raw = String(subjectName || '').trim();
  const code = raw.replace(/\s+/g, '_').toUpperCase();
  return { displayName: raw, subjectCode: code };
};

export const expandQuestionsForBatch = (templateQuestions, staffMap) => {
  const result = [];

  for (const q of templateQuestions) {
    if (!q.isSubjectBased) {
      // Fixed question — copy as-is
      result.push({
        fieldId: q.fieldId,
        fieldType: q.fieldType,
        fieldText: q.fieldText,
        fieldOptions: [...q.fieldOptions],
        fieldValue: null,
        isSubjectBased: false,
        subjectCode: null,
        subjectName: null,
        staffId: null,
        staffName: null
      });
    } else {
      // Subject-based — expand one per subject in staffMap
      for (const sm of staffMap) {
        const { displayName, subjectCode } = extractSubjectParts(sm.subjectName);

        result.push({
          // fieldId: pre_sq1_MATH, pre_sq1_PHY etc — unique per subject
          fieldId: `${q.fieldId}_${subjectCode}`,
          fieldType: q.fieldType,
          // Replace {subject} with display name
          fieldText: q.fieldText.replace(/\{subject\}/g, displayName),
          fieldOptions: [...q.fieldOptions],
          fieldValue: null,
          isSubjectBased: true,
          subjectCode,
          subjectName: sm.subjectName,
          staffId: sm.staffId,
          staffName: sm.staffName,
          subjectId: sm.subjectId
        });
      }
    }
  }

  return result;
};

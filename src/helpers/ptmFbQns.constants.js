import { v4 as uuid } from 'uuid';

export const PRE_PTM_QUESTIONS = [
  {
    fieldId: 'pre_q1',
    fieldType: 'text',
    fieldText: 'What specific concerns do you have about your child?',
    fieldOptions: [],
    fieldValue: null
  },
  {
    fieldId: 'pre_q2',
    fieldType: 'radio',
    fieldText: 'How is your child performing academically at home?',
    fieldOptions: ['Excellent', 'Good', 'Average', 'Needs improvement'],
    fieldValue: null
  },
  {
    fieldId: 'pre_q3',
    fieldType: 'checkbox',
    fieldText: 'Which areas would you like to discuss in this meeting?',
    fieldOptions: ['Academics', 'Behaviour', 'Attendance', 'Homework', 'Exams', 'Career guidance'],
    fieldValue: null
  },
  {
    fieldId: 'pre_q4',
    fieldType: 'radio',
    fieldText: 'Has your child shown any behavioural changes recently?',
    fieldOptions: ['Yes, positive changes', 'Yes, concerning changes', 'No changes noticed'],
    fieldValue: null
  },
  {
    fieldId: 'pre_q5',
    fieldType: 'text',
    fieldText: 'Any additional information you want the teacher to know before the meeting?',
    fieldOptions: [],
    fieldValue: null
  }
];

export const POST_PTM_QUESTIONS = [
  {
    fieldId: 'post_q1',
    fieldType: 'radio',
    fieldText: "How satisfied are you with today's parent-teacher meeting?",
    fieldOptions: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
    fieldValue: null
  },
  {
    fieldId: 'post_q2',
    fieldType: 'checkbox',
    fieldText: 'Which topics were covered in the meeting?',
    fieldOptions: ['Academics', 'Behaviour', 'Attendance', 'Homework', 'Exams', 'Career guidance'],
    fieldValue: null
  },
  {
    fieldId: 'post_q3',
    fieldType: 'radio',
    fieldText: 'Did the teacher address your concerns clearly?',
    fieldOptions: ['Yes, completely', 'Partially', 'No'],
    fieldValue: null
  },
  {
    fieldId: 'post_q4',
    fieldType: 'radio',
    fieldText: "Would you recommend this school to others based on today's experience?",
    fieldOptions: ['Definitely yes', 'Probably yes', 'Not sure', 'No'],
    fieldValue: null
  },
  {
    fieldId: 'post_q5',
    fieldType: 'text',
    fieldText: 'Any suggestions or additional comments about the meeting?',
    fieldOptions: [],
    fieldValue: null
  }
];

/**
 * Returns deep clones so each student's PTM doc
 * gets its own independent copy — mutations never
 * bleed back into the constants.
 */
export const getPrePtmQuestions = () => PRE_PTM_QUESTIONS.map((q) => ({ ...q, fieldValue: null }));

export const getPostPtmQuestions = () => POST_PTM_QUESTIONS.map((q) => ({ ...q, fieldValue: null }));

import Batch from '../models/batch.model.js';

export const extractSubjectParts = (subjectName) => {
  const match = String(subjectName || '').match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    const raw = match[1].trim();
    const subjectCode = match[2].trim().toUpperCase();
    const displayName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    return { displayName, subjectCode };
  }
  const raw = String(subjectName || '').trim();
  const code = raw.replace(/\s+/g, '_').toUpperCase();
  return {
    displayName: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(),
    subjectCode: code
  };
};

export const expandQuestionsForStaffMap = (questions, staffMap) => {
  const result = [];
  for (const q of questions) {
    if (!q.isSubjectBased) {
      result.push({
        fieldId: q.fieldId,
        fieldType: q.fieldType,
        fieldText: q.fieldText,
        fieldOptions: [...(q.fieldOptions || [])],
        sortOrder: q.sortOrder || 0,
        isSubjectBased: false,
        subjectCode: null,
        subjectName: null,
        subjectId: null,
        staffId: null,
        staffName: null
      });
    } else {
      for (const sm of staffMap) {
        const { displayName, subjectCode } = extractSubjectParts(sm.subjectName);
        result.push({
          fieldId: `${q.fieldId}_${subjectCode}`,
          fieldType: q.fieldType,
          fieldText: q.fieldText.replace(/\{subject\}/g, displayName),
          fieldOptions: [...(q.fieldOptions || [])],
          sortOrder: q.sortOrder || 0,
          isSubjectBased: true,
          subjectCode,
          subjectName: sm.subjectName,
          subjectId: sm.subjectId || null,
          staffId: sm.staffId || null,
          staffName: sm.staffName || null
        });
      }
    }
  }

  return result;
};

export const buildBatchQuestionSnapshots = async (tenantId, batchCodes, templateQuestions) => {
  const hasSubjectQuestions = templateQuestions.some((q) => q.isSubjectBased);
  if (!hasSubjectQuestions) {
    const fixedQuestions = expandQuestionsForStaffMap(templateQuestions, []);
    return batchCodes.map((batchCode) => ({
      batchCode,
      batchName: null,
      questions: fixedQuestions
    }));
  }
  const batchDocs = await Batch.find({ tenantId, batchCode: { $in: batchCodes }, isdeleted: false }, { batchCode: 1, batchName: 1, staffMap: 1 }).lean();
  const batchDocMap = new Map(batchDocs.map((b) => [b.batchCode, b]));
  return batchCodes.map((batchCode) => {
    const batchDoc = batchDocMap.get(batchCode);
    const staffMap = batchDoc?.staffMap || [];
    const questions = expandQuestionsForStaffMap(templateQuestions, staffMap);
    return {
      batchCode,
      batchName: batchDoc?.batchName || null,
      questions
    };
  });
};

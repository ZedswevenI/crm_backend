const safeTrim = (v) => (v === null || v === undefined ? '' : String(v).trim());

export const renderTemplate = (content = '', data = {}) => {
  let output = String(content || '');
  Object.keys(data || {}).forEach((key) => {
    const value = safeTrim(data[key]);
    output = output.replaceAll(`{{${key}}}`, value);
  });
  return output;
};

export const buildTemplateDataFromStudent = (student = {}) => ({
  studentName: student.studentName || '',
  parentName: student.parentName || '',
  admissionNo: student.admissionNo || '',
  studentEmail: student.recipientEmail || '',
  studentPhone: student.studentPhone || '',
  classNo: student.classNo || '',
  batchCode: student.batchCode || '',
  centerName: student.centerName || '',
  programName: student.programName || '',
  academicYear: student.academicYear || ''
});

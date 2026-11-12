import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import connectDB from './src/config/connect.js';
import Batch from './src/models/batch.model.js';
import StudentProfile from './src/models/studentProfile.model.js';

// Batch mapping table based on Class and Section
const CLASS_SEC_TO_BATCH_CODE = {
  'IX_A1': 'COIFR260S01',   // SIGMA-9A1
  'IX_A2': 'COIFR260E01',   // EPSILON-9A2
  'IX_A3': 'COIFR260A01',   // ALPHA-9A3

  'X_A1': 'COIFR259P01',    // Pi-10A1
  'X_A2': 'COIFR259O01',    // Omega-10A2

  'XI_A1': 'COITR268R01',   // RAMANUJAN-11A1
  'XI_A2': 'COITR268K01',   // APJ KALAM-11A2
  'XI_A3': 'COITR268V01',   // CV RAMAN-11A3
  'XI_A4': 'COITR268S01',   // VIKRAM SARABHAI-11A4
  'XI_ZA1': 'COITM268S01',  // SUSRUTHA-11Z1
  'XI_ZA2': 'COITM268C01',  // CHARAKA-11Z2

  'XII_A1': 'COIXR257E01',  // EINSTEIN-12A1
  'XII_A2': 'COIXR257N01',  // NEWTON-12A2
  'XII_A3': 'COIXR257C01',  // CURIE-12A3
  'XII_A4': 'COIXR257T01',  // TESLA-12A4
  'XII_ZA1': 'COIXM257A01', // ARISTOTLE-12Z1
  'XII_ZA2': 'COIXM257D01'  // DARWIN-12Z2
};

const CLASS_NUM_MAP = {
  'IX': 9,
  'X': 10,
  'XI': 11,
  'XII': 12
};

async function run() {
  await connectDB();

  // Load all batches
  const batches = await Batch.find({ isdeleted: false }).lean();
  const batchByCode = new Map(batches.map(b => [b.batchCode, b]));

  // Read raw CSV text
  const rawCsvPath = path.resolve('scripts/students_raw.csv');
  if (!fs.existsSync(rawCsvPath)) {
    console.error('File scripts/students_raw.csv not found!');
    process.exit(1);
  }

  const lines = fs.readFileSync(rawCsvPath, 'utf8').split('\n').filter(l => l.trim().length > 0);
  console.log(`Read ${lines.length} lines from CSV (including header).`);

  const tenantId = '624158e2-41a0-416e-a08e-979f5a9858a0';
  const bulkOps = [];
  const compassBulkOps = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    if (parts.length < 7) continue;

    const [srNo, cls, sec, gender, admnId, enrollNo, studentName, dobD, dobM, dobY, fatherName, motherName] = parts;
    const key = `${cls}_${sec}`;
    const batchCode = CLASS_SEC_TO_BATCH_CODE[key];
    const batch = batchCode ? batchByCode.get(batchCode) : null;

    if (!batch) {
      console.warn(`Row ${i}: Could not find batch for ${key}`);
      continue;
    }

    const classNo = CLASS_NUM_MAP[cls] || batch.classNo;
    const admissionNo = admnId;
    const regNo = enrollNo && enrollNo !== 'NaN' ? enrollNo : `REG-${admnId}`;

    const updateDoc = {
      tenantId,
      admissionNo,
      registrationNumber: regNo,
      classNo,
      student: {
        name: studentName,
        gender: gender || 'M',
        parentName: fatherName || motherName || `${studentName}'s Parent`,
        city: 'Coimbatore',
        state: 'Tamil Nadu'
      },
      academicYear: batch.academicYear || '2026-2027',
      programId: batch.programId,
      programName: batch.programName,
      centerId: batch.centerId,
      centerCode: batch.centerCode,
      centerName: batch.centerName,
      batchId: batch.batchId,
      batchCode: batch.batchCode,
      firstBatchId: batch.batchId,
      firstBatchCode: batch.batchCode,
      firstBatchName: batch.batchName,
      currentAcademicYear: '2026-2027',
      status: 'ACTIVE',
      isdeleted: false
    };

    bulkOps.push({
      updateOne: {
        filter: { tenantId, admissionNo },
        update: {
          $set: updateDoc,
          $setOnInsert: {
            studentId: randomUUID(),
            admissionId: randomUUID(),
            createdAt: new Date()
          }
        },
        upsert: true
      }
    });

    compassBulkOps.push({
      updateOne: {
        filter: { tenantId, admissionNo },
        update: {
          $set: {
            admissionNo,
            registrationNumber: regNo,
            classNo,
            "student.name": studentName,
            "student.gender": gender || 'M',
            "student.parentName": fatherName || motherName || `${studentName}'s Parent`,
            batchId: batch.batchId,
            batchCode: batch.batchCode,
            firstBatchId: batch.batchId,
            firstBatchCode: batch.batchCode,
            firstBatchName: batch.batchName,
            status: 'ACTIVE',
            isdeleted: false
          },
          $setOnInsert: {
            studentId: randomUUID(),
            tenantId,
            academicYear: batch.academicYear || '2026-2027',
            currentAcademicYear: '2026-2027',
            programId: batch.programId,
            programName: batch.programName,
            centerId: batch.centerId,
            centerCode: batch.centerCode,
            centerName: batch.centerName,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    });
  }

  console.log(`Prepared ${bulkOps.length} student records for insertion/update.`);

  // Write MongoDB Compass executable query file
  const compassFileContent = `/**
 * Run this directly in MongoDB Compass (_MONGOSH tab)
 * Total students: ${compassBulkOps.length}
 */
db.studentprofiles.bulkWrite(
${JSON.stringify(compassBulkOps, null, 2)},
{ ordered: false }
);
`;

  fs.writeFileSync('scripts/insert_students_compass.js', compassFileContent, 'utf8');
  console.log(`Saved MongoDB Compass query file to: scripts/insert_students_compass.js (${(compassFileContent.length / 1024).toFixed(1)} KB)`);

  // Execute directly into DB
  const result = await StudentProfile.bulkWrite(bulkOps, { ordered: false });
  console.log(`Execution complete:`);
  console.log(`  Matched:  ${result.matchedCount}`);
  console.log(`  Modified: ${result.modifiedCount}`);
  console.log(`  Upserted: ${result.upsertedCount}`);

  const totalInDb = await StudentProfile.countDocuments({ tenantId, isdeleted: false });
  console.log(`Total active students now in database: ${totalInDb}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Import error:', err);
  process.exit(1);
});

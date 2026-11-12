import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import xlsx from 'xlsx';
import connectDB from '../src/config/connect.js';
import Batch from '../src/models/batch.model.js';
import StudentProfile from '../src/models/studentProfile.model.js';
import Admission from '../src/models/admission.model.js';

const EXCEL_PATH = 'C:/Users/VijayPC/.gemini/antigravity/brain/98b2b6cb-2ea3-407d-95d2-a7f31951b30d/.user_uploaded/media_1794464840650_d3176d47.xlsx';
const TENANT_ID = '624158e2-41a0-416e-a08e-979f5a9858a0';

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

async function processExcelAndImport() {
  await connectDB();

  console.log(`Reading Excel file from: ${EXCEL_PATH}`);
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`Loaded ${rawRows.length} rows from sheet "${sheetName}".`);

  // Load all batches
  const batches = await Batch.find({ isdeleted: false }).lean();
  const batchMap = new Map();
  for (const b of batches) {
    batchMap.set(b.batchCode, b);
  }

  // Check all mapped batches exist
  for (const [key, code] of Object.entries(CLASS_SEC_TO_BATCH_CODE)) {
    if (!batchMap.has(code)) {
      console.error(`ERROR: Batch code ${code} for ${key} not found in database!`);
      process.exit(1);
    }
  }

  const studentProfileBulk = [];
  const compassOps = [];
  let skipped = 0;

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const cls = String(row['Class'] || '').trim();
    const sec = String(row['Section'] || '').trim();
    const gender = String(row['Gender'] || 'M').trim().toUpperCase();
    const admnId = String(row['Admn ID Number'] || '').trim();
    let enrollNo = String(row['Enroll No'] || '').trim();
    const studentName = String(row['Student First Name'] || '').trim();
    const fatherName = String(row['Father Name'] || '').trim();
    const motherName = String(row['Mother Name'] || '').trim();

    if (!cls || !sec || !admnId || !studentName) {
      console.warn(`Row ${idx + 2}: Skipping due to missing essential fields.`, row);
      skipped++;
      continue;
    }

    const key = `${cls}_${sec}`;
    const batchCode = CLASS_SEC_TO_BATCH_CODE[key];
    const batch = batchMap.get(batchCode);

    if (!batch) {
      console.warn(`Row ${idx + 2}: Unknown mapping for ${key}`);
      skipped++;
      continue;
    }

    if (!enrollNo || enrollNo === 'NaN' || enrollNo === 'undefined') {
      enrollNo = `REG-${admnId}`;
    }

    const classNo = CLASS_NUM_MAP[cls] || batch.classNo || 10;
    const parentName = fatherName || motherName || `${studentName}'s Parent`;
    const studentUuid = randomUUID();
    const admissionUuid = randomUUID();

    // Mongoose bulk operation
    studentProfileBulk.push({
      updateOne: {
        filter: { tenantId: TENANT_ID, admissionNo: admnId },
        update: {
          $set: {
            tenantId: TENANT_ID,
            admissionNo: admnId,
            registrationNumber: enrollNo,
            classNo,
            'student.name': studentName,
            'student.gender': gender,
            'student.parentName': parentName,
            'student.city': 'Coimbatore',
            'student.state': 'Tamil Nadu',
            academicYear: batch.academicYear || '2026-2027',
            currentAcademicYear: '2026-2027',
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
            status: 'ACTIVE',
            isdeleted: false
          },
          $setOnInsert: {
            studentId: studentUuid,
            admissionId: admissionUuid,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    });

    // Mongosh Compass operation
    compassOps.push({
      updateOne: {
        filter: { tenantId: TENANT_ID, admissionNo: admnId },
        update: {
          $set: {
            tenantId: TENANT_ID,
            admissionNo: admnId,
            registrationNumber: enrollNo,
            classNo: classNo,
            "student.name": studentName,
            "student.gender": gender,
            "student.parentName": parentName,
            "student.city": "Coimbatore",
            "student.state": "Tamil Nadu",
            academicYear: batch.academicYear || "2026-2027",
            currentAcademicYear: "2026-2027",
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
            status: "ACTIVE",
            isdeleted: false
          },
          $setOnInsert: {
            studentId: studentUuid,
            admissionId: admissionUuid,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    });
  }

  console.log(`Successfully mapped ${studentProfileBulk.length} students (Skipped: ${skipped}).`);

  // Execute into DB
  console.log('Executing bulkWrite on studentprofiles collection in MongoDB...');
  const res = await StudentProfile.bulkWrite(studentProfileBulk, { ordered: false });
  console.log('Database Result:');
  console.log(`  Matched:  ${res.matchedCount}`);
  console.log(`  Modified: ${res.modifiedCount}`);
  console.log(`  Upserted: ${res.upsertedCount}`);

  const totalActive = await StudentProfile.countDocuments({ tenantId: TENANT_ID, isdeleted: false });
  console.log(`Total active students now in database: ${totalActive}`);

  // Create the single comprehensive release queries file for MongoDB Compass
  const releaseFilePath = 'scripts/release_first_batch_all_queries.mongodb.js';
  const fileHeader = `/**
 * =========================================================================================
 * RELEASE SCRIPT: FIRST BATCH ATTENDANCE & STUDENT DETAILS BULK UPSERT
 * Target Database: z7i_crm_dev (or your production MongoDB database)
 * Tenant ID: ${TENANT_ID}
 * Total Students from Excel (Class IX to XII): ${compassOps.length}
 * 
 * HOW TO RUN IN MONGODB COMPASS:
 * 1. Open MongoDB Compass and connect to your database.
 * 2. Select the database (e.g., 'z7i_crm_dev').
 * 3. Open the '_MONGOSH' console bar at the bottom or open a 'Saved Query' tab.
 * 4. Paste and execute this script.
 * =========================================================================================
 */

// STEP 1: CREATE INDEXES FOR FAST FIRST BATCH LOOKUPS
print("Creating indexes on studentprofiles...");
db.studentprofiles.createIndex(
  { tenantId: 1, firstBatchCode: 1, isdeleted: 1 },
  { name: "idx_tenant_firstbatchcode_del" }
);
db.studentprofiles.createIndex(
  { tenantId: 1, firstBatchId: 1, isdeleted: 1 },
  { name: "idx_tenant_firstbatchid_del" }
);

print("Creating indexes on admissions...");
db.admissions.createIndex(
  { tenantId: 1, firstBatchCode: 1, isdeleted: 1 },
  { name: "idx_tenant_firstbatchcode_del" }
);
db.admissions.createIndex(
  { tenantId: 1, firstBatchId: 1, isdeleted: 1 },
  { name: "idx_tenant_firstbatchid_del" }
);

// STEP 2: BACKFILL EXISTING STUDENTS WHO DON'T HAVE firstBatchId YET
print("Backfilling existing students without first batch...");
db.studentprofiles.updateMany(
  {
    tenantId: "${TENANT_ID}",
    $or: [
      { firstBatchCode: null },
      { firstBatchCode: { $exists: false } },
      { firstBatchCode: "" }
    ],
    batchCode: { $exists: true, $ne: null }
  },
  [
    {
      $set: {
        firstBatchId: "$batchId",
        firstBatchCode: "$batchCode"
      }
    }
  ]
);

// STEP 3: BULK UPSERT ALL ${compassOps.length} STUDENTS FROM EXCEL
print("Upserting ${compassOps.length} student records from Excel...");
const result = db.studentprofiles.bulkWrite(
`;

  const fileFooter = `,
  { ordered: false }
);

print("Bulk upsert completed:");
print("  Matched:  " + result.matchedCount);
print("  Modified: " + result.modifiedCount);
print("  Upserted: " + result.upsertedCount);

// STEP 4: VERIFICATION QUERIES
print("\\n--- VERIFICATION ---");
const totalStudents = db.studentprofiles.countDocuments({
  tenantId: "${TENANT_ID}",
  isdeleted: false
});
print("Total active students: " + totalStudents);

const firstBatchStats = db.studentprofiles.aggregate([
  {
    $match: {
      tenantId: "${TENANT_ID}",
      isdeleted: false
    }
  },
  {
    $group: {
      _id: {
        batchCode: "$firstBatchCode",
        batchName: "$firstBatchName",
        classNo: "$classNo"
      },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { "_id.classNo": 1, "_id.batchCode": 1 }
  }
]).toArray();

printjson(firstBatchStats);
`;

  const finalContent = fileHeader + JSON.stringify(compassOps, null, 2) + fileFooter;
  fs.writeFileSync(releaseFilePath, finalContent, 'utf8');
  console.log(`Saved comprehensive release file: ${releaseFilePath} (${(finalContent.length / 1024).toFixed(1)} KB)`);

  process.exit(0);
}

processExcelAndImport().catch(err => {
  console.error('Fatal error during processing:', err);
  process.exit(1);
});

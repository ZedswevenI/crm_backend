/**
 * ============================================================================
 * RELEASE MIGRATION SCRIPT: First Batch Student Mapping & Database Indexes
 * ============================================================================
 * 
 * Purpose:
 *   1. Ensures required compound indexes on studentprofiles collection:
 *        - { tenantId: 1, firstBatchCode: 1 }
 *        - { tenantId: 1, firstBatchId: 1 }
 *   2. Imports first-batch mappings from an Excel file (.xlsx / .xls), CSV, or JSON
 *      and bulk-updates both `studentprofiles` and `admissions`.
 *   3. Resolves batch details (batchId, batchName, batchCode) from the `batches`
 *      collection to ensure consistent referential integrity.
 *   4. Supports --backfill-missing to initialize any student without first-batch info
 *      using their current batch.
 *   5. Supports --dry-run to preview all changes safely before committing.
 * 
 * ----------------------------------------------------------------------------
 * USAGE EXAMPLES:
 * ----------------------------------------------------------------------------
 *   # 1. Preview changes from an Excel file (no database writes):
 *   node scripts/migrate-first-batch.js --file path/to/students_first_batch.xlsx --dry-run
 * 
 *   # 2. Execute migration with Excel file:
 *   node scripts/migrate-first-batch.js --file path/to/students_first_batch.xlsx
 * 
 *   # 3. Execute migration and also backfill any unmapped students to their current batch:
 *   node scripts/migrate-first-batch.js --file path/to/students_first_batch.xlsx --backfill-missing
 * 
 *   # 4. Only ensure indexes and backfill existing students from current batch (no Excel file):
 *   node scripts/migrate-first-batch.js --backfill-missing
 * 
 * ----------------------------------------------------------------------------
 * RAW MONGODB / MONGOSH QUERIES (for MongoDB Compass or mongosh CLI):
 * ----------------------------------------------------------------------------
 *   // A. Create indexes
 *   db.studentprofiles.createIndex({ tenantId: 1, firstBatchCode: 1 });
 *   db.studentprofiles.createIndex({ tenantId: 1, firstBatchId: 1 });
 * 
 *   // B. Bulk update sample query:
 *   db.studentprofiles.bulkWrite([
 *     { updateOne: { filter: { admissionNo: "ADM001" }, update: { $set: { firstBatchCode: "COIFR260A01", firstBatchName: "ALPHA-9A3" } } } },
 *     { updateOne: { filter: { admissionNo: "ADM002" }, update: { $set: { firstBatchCode: "COIFR260A01", firstBatchName: "ALPHA-9A3" } } } }
 *   ]);
 * 
 *   // C. Backfill students without first batch to their current batch:
 *   db.studentprofiles.updateMany(
 *     { $or: [{ firstBatchCode: null }, { firstBatchCode: { $exists: false } }, { firstBatchCode: "" }] },
 *     [{ $set: { firstBatchCode: "$batchCode", firstBatchId: "$batchId" } }]
 *   );
 * ============================================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI ||
  `mongodb+srv://${process.env.DBUSER}:${process.env.PASSWORD}@${process.env.HOST}/${process.env.DATABASE}`;

const DRY_RUN = process.argv.includes('--dry-run');
const BACKFILL_MISSING = process.argv.includes('--backfill-missing');

// Helper to parse --file <path> from arguments
const getFilePathArg = () => {
  const fileIdx = process.argv.indexOf('--file');
  if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
    return process.argv[fileIdx + 1];
  }
  const fileArg = process.argv.find((a) => a.startsWith('--file='));
  if (fileArg) {
    return fileArg.split('=')[1];
  }
  return null;
};

// Normalize and find column keys regardless of naming variations
const findKey = (row, candidates) => {
  const normalizedKeys = Object.keys(row).map((k) => ({
    orig: k,
    norm: k.trim().toLowerCase().replace(/[\s_\-]/g, '')
  }));
  for (const cand of candidates) {
    const target = cand.toLowerCase().replace(/[\s_\-]/g, '');
    const found = normalizedKeys.find((k) => k.norm === target);
    if (found && row[found.orig] !== undefined && row[found.orig] !== null) {
      return String(row[found.orig]).trim();
    }
  }
  return '';
};

// Parse Excel, CSV, or JSON file
const loadInputData = (filePath) => {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const ext = path.extname(resolved).toLowerCase();
  let rows = [];

  if (ext === '.json') {
    const raw = fs.readFileSync(resolved, 'utf8');
    rows = JSON.parse(raw);
  } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
    const wb = xlsx.readFile(resolved);
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
  } else {
    throw new Error(`Unsupported file extension: ${ext}. Please provide .xlsx, .xls, .csv, or .json`);
  }

  console.log(`Loaded ${rows.length} raw row(s) from ${resolved}`);

  const parsed = [];
  rows.forEach((r, idx) => {
    const admissionNo = findKey(r, [
      'admissionNo',
      'admission_no',
      'admission no',
      'adm no',
      'admno',
      'student id',
      'roll no',
      'reg no'
    ]);

    const firstBatchCode = findKey(r, [
      'firstBatchCode',
      'first_batch_code',
      'first batch code',
      'first batch',
      'batch code',
      'batchcode'
    ]);

    const firstBatchName = findKey(r, [
      'firstBatchName',
      'first_batch_name',
      'first batch name',
      'batch name',
      'batchname'
    ]);

    if (admissionNo && firstBatchCode) {
      parsed.push({
        rowNum: idx + 2,
        admissionNo,
        firstBatchCode,
        firstBatchName: firstBatchName || null
      });
    }
  });

  return parsed;
};

const run = async () => {
  console.log('='.repeat(70));
  console.log('  STARTING FIRST BATCH RELEASE MIGRATION');
  console.log(`  Mode: ${DRY_RUN ? 'DRY-RUN (No writes will be made)' : 'LIVE EXECUTION'}`);
  console.log(`  Backfill Missing: ${BACKFILL_MISSING}`);
  console.log('='.repeat(70));

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB successfully.\n');

  const db = mongoose.connection.db;
  const studentColl = db.collection('studentprofiles');
  const admissionColl = db.collection('admissions');
  const batchColl = db.collection('batches');

  // --------------------------------------------------------------------------
  // STEP 1: Ensure compound indexes on studentprofiles
  // --------------------------------------------------------------------------
  console.log('[STEP 1] Checking and creating compound indexes...');
  if (!DRY_RUN) {
    try {
      await studentColl.createIndex({ tenantId: 1, firstBatchCode: 1 }, { background: true });
      await studentColl.createIndex({ tenantId: 1, firstBatchId: 1 }, { background: true });
      console.log('  Indexes ensured: { tenantId: 1, firstBatchCode: 1 }, { tenantId: 1, firstBatchId: 1 }\n');
    } catch (idxErr) {
      console.warn('  Warning ensuring indexes:', idxErr.message, '\n');
    }
  } else {
    console.log('  [dry-run] Would create indexes: { tenantId: 1, firstBatchCode: 1 }, { tenantId: 1, firstBatchId: 1 }\n');
  }

  // --------------------------------------------------------------------------
  // STEP 2: Process Excel / CSV File (if provided)
  // --------------------------------------------------------------------------
  const filePath = getFilePathArg();
  let fileMappedCount = 0;

  if (filePath) {
    console.log(`[STEP 2] Processing input file: ${filePath}`);
    const mappings = loadInputData(filePath);
    console.log(`  Found ${mappings.length} valid student mapping record(s) to process.\n`);

    if (mappings.length > 0) {
      // Pre-fetch all referenced batches to get batchId and correct batchName
      const uniqueBatchCodes = Array.from(new Set(mappings.map((m) => m.firstBatchCode)));
      const batches = await batchColl
        .find({ batchCode: { $in: uniqueBatchCodes }, isdeleted: false })
        .project({ batchId: 1, batchCode: 1, batchName: 1, tenantId: 1 })
        .toArray();

      const batchMap = new Map();
      batches.forEach((b) => batchMap.set(b.batchCode, b));

      const studentBulkOps = [];
      const admissionBulkOps = [];
      let missingBatchCount = 0;

      mappings.forEach((m) => {
        const batchDoc = batchMap.get(m.firstBatchCode);
        const resolvedBatchId = batchDoc ? batchDoc.batchId : null;
        const resolvedBatchName = m.firstBatchName || (batchDoc ? batchDoc.batchName : null);

        if (!batchDoc) {
          missingBatchCount++;
        }

        const updateFields = {
          firstBatchCode: m.firstBatchCode,
          firstBatchName: resolvedBatchName
        };
        if (resolvedBatchId) {
          updateFields.firstBatchId = resolvedBatchId;
        }

        studentBulkOps.push({
          updateMany: {
            filter: { admissionNo: m.admissionNo, isdeleted: false },
            update: { $set: updateFields }
          }
        });

        admissionBulkOps.push({
          updateMany: {
            filter: { admissionNo: m.admissionNo, isdeleted: false },
            update: { $set: updateFields }
          }
        });
      });

      console.log(`  Batches resolved: ${batches.length} / ${uniqueBatchCodes.length} referenced codes.`);
      if (missingBatchCount > 0) {
        console.warn(`  Notice: ${missingBatchCount} record(s) reference batchCode(s) not currently found in batches collection.`);
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] Would execute ${studentBulkOps.length} updates on studentprofiles.`);
        console.log(`  [dry-run] Would execute ${admissionBulkOps.length} updates on admissions.\n`);
      } else {
        if (studentBulkOps.length > 0) {
          const sRes = await studentColl.bulkWrite(studentBulkOps, { ordered: false });
          const aRes = await admissionColl.bulkWrite(admissionBulkOps, { ordered: false });
          fileMappedCount = sRes.modifiedCount || sRes.matchedCount;
          console.log(`  studentprofiles updated: matched=${sRes.matchedCount}, modified=${sRes.modifiedCount}`);
          console.log(`  admissions updated:      matched=${aRes.matchedCount}, modified=${aRes.modifiedCount}\n`);
        }
      }
    }
  } else {
    console.log('[STEP 2] No --file argument provided. Skipping Excel import.');
    console.log('  (To import from Excel, run: node scripts/migrate-first-batch.js --file <path_to_excel>)\n');
  }

  // --------------------------------------------------------------------------
  // STEP 3: Optional Backfill of Remaining Students
  // --------------------------------------------------------------------------
  if (BACKFILL_MISSING) {
    console.log('[STEP 3] Checking for active students with uninitialized firstBatchCode...');
    const filter = {
      isdeleted: false,
      status: 'ACTIVE',
      batchCode: { $ne: null, $nin: ['', null] },
      $or: [
        { firstBatchCode: null },
        { firstBatchCode: { $exists: false } },
        { firstBatchCode: '' }
      ]
    };

    const count = await studentColl.countDocuments(filter);
    console.log(`  Found ${count} active student(s) currently missing firstBatchCode.`);

    if (count > 0) {
      if (DRY_RUN) {
        console.log(`  [dry-run] Would set firstBatchCode=$batchCode and firstBatchId=$batchId on ${count} student(s).\n`);
      } else {
        // Use aggregation pipeline update to copy batchCode -> firstBatchCode
        const result = await studentColl.updateMany(filter, [
          {
            $set: {
              firstBatchCode: '$batchCode',
              firstBatchId: '$batchId'
            }
          }
        ]);
        console.log(`  Backfilled ${result.modifiedCount} student(s) from their current batch.\n`);
      }
    } else {
      console.log('  No students required backfilling.\n');
    }
  }

  // --------------------------------------------------------------------------
  // STEP 4: Verification Summary
  // --------------------------------------------------------------------------
  console.log('[STEP 4] Database Verification:');
  const totalStudents = await studentColl.countDocuments({ isdeleted: false });
  const mappedStudents = await studentColl.countDocuments({
    isdeleted: false,
    firstBatchCode: { $ne: null, $nin: ['', null] }
  });

  console.log(`  Total Active Students in DB : ${totalStudents}`);
  console.log(`  Students with firstBatchCode: ${mappedStudents} (${Math.round((mappedStudents / (totalStudents || 1)) * 100)}%)\n`);

  console.log('='.repeat(70));
  console.log('  MIGRATION SCRIPT FINISHED SUCCESSFULLY');
  console.log('='.repeat(70));

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('\n Migration failed with error:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

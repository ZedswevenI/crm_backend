/**
 * ============================================================================
 * RELEASE MONGODB QUERIES: First Batch Attendance Feature
 * Database: z7i_crm_dev (or production database)
 * 
 * You can execute these queries in:
 *   - MongoDB Compass (Mongosh tab)
 *   - mongosh CLI (`mongosh <connection_string> release_first_batch_queries.mongodb.js`)
 *   - MongoDB VS Code Extension
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. CREATE COMPOUND INDEXES
// Optimizes First Batch queries on studentprofiles collection by tenant.
// ----------------------------------------------------------------------------
db.studentprofiles.createIndex(
  { tenantId: 1, firstBatchCode: 1 },
  { name: "tenantId_1_firstBatchCode_1", background: true }
);

db.studentprofiles.createIndex(
  { tenantId: 1, firstBatchId: 1 },
  { name: "tenantId_1_firstBatchId_1", background: true }
);

// ----------------------------------------------------------------------------
// 2. BACKFILL QUERY: Initialize any unmapped student to their current batch
// Run this to ensure all existing active students have firstBatch populated.
// ----------------------------------------------------------------------------
db.studentprofiles.updateMany(
  {
    isdeleted: false,
    status: "ACTIVE",
    batchCode: { $ne: null, $nin: ["", null] },
    $or: [
      { firstBatchCode: null },
      { firstBatchCode: { $exists: false } },
      { firstBatchCode: "" }
    ]
  },
  [
    {
      $set: {
        firstBatchCode: "$batchCode",
        firstBatchId: "$batchId",
        firstBatchName: "$batchName"
      }
    }
  ]
);

// ----------------------------------------------------------------------------
// 3. EXCEL / CUSTOM BULK MAPPING TEMPLATE
// When updating specific students from an Excel file, use bulkWrite:
// ----------------------------------------------------------------------------
db.studentprofiles.bulkWrite([
  {
    updateMany: {
      filter: { admissionNo: "SAMPLE_ADM_001", isdeleted: false },
      update: {
        $set: {
          firstBatchCode: "COIFR260A01",
          firstBatchName: "ALPHA-9A3"
          // firstBatchId: "optional-uuid"
        }
      }
    }
  }
  // Add additional student entries here...
]);

// ----------------------------------------------------------------------------
// 4. VERIFICATION / AUDIT QUERIES
// ----------------------------------------------------------------------------
// Check count of students with firstBatchCode populated vs total:
print("Total Active Students:", db.studentprofiles.countDocuments({ isdeleted: false }));
print("Students with firstBatchCode:", db.studentprofiles.countDocuments({ isdeleted: false, firstBatchCode: { $ne: null, $nin: ["", null] } }));

// Sample check: view first batch details of 5 students
db.studentprofiles.find(
  { isdeleted: false },
  { admissionNo: 1, "student.name": 1, batchCode: 1, firstBatchCode: 1, firstBatchName: 1 }
).limit(5).pretty();

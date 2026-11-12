/**
 * =========================================================================================
 * RELEASE SCRIPT: FIRST BATCH ATTENDANCE & STUDENT DETAILS BULK UPSERT
 * Target Database: z7i_crm_dev (or your production MongoDB database)
 * Tenant ID: 624158e2-41a0-416e-a08e-979f5a9858a0
 * Total Students from Excel (Class IX to XII): 547
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
    tenantId: "624158e2-41a0-416e-a08e-979f5a9858a0",
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

// STEP 3: BULK UPSERT ALL 547 STUDENTS FROM EXCEL
print("Upserting 547 student records from Excel...");
const result = db.studentprofiles.bulkWrite(
[
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7924"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7924",
          "registrationNumber": "9020642600003",
          "classNo": 9,
          "student.name": "AADHAV S",
          "student.gender": "M",
          "student.parentName": "SURESH M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "fd55fd03-b46a-4126-8fb2-c9ad11913ed0",
          "admissionId": "9ffa498b-9c12-46ed-8de3-a6d74ba0ff17",
          "createdAt": "2026-11-12T06:35:16.303Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6506"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6506",
          "registrationNumber": "9020642600087",
          "classNo": 9,
          "student.name": "ABHINAV PINACHO GANESH AMUTHA",
          "student.gender": "M",
          "student.parentName": "GANESH PARTHASARATHY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c723525f-237f-47cf-99df-fb1ad00348de",
          "admissionId": "391452a9-2739-4dd8-a3e7-188b5c54f03e",
          "createdAt": "2026-11-12T06:35:16.303Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3833"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3833",
          "registrationNumber": "9020642600004",
          "classNo": 9,
          "student.name": "ADDHANA R",
          "student.gender": "F",
          "student.parentName": "ROHIT B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3e44e7da-128a-41e3-88c8-4db05a4b0dae",
          "admissionId": "b357855f-e57b-4908-8bbc-c9fb9ba229a2",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4537"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4537",
          "registrationNumber": "9020642600024",
          "classNo": 9,
          "student.name": "AMRITA MOHAPATRA",
          "student.gender": "F",
          "student.parentName": "SUKANTA KUMAR MOHAPATRA",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d6f7f51e-3463-4593-b779-c44124b80c9b",
          "admissionId": "38b5b21f-8105-4e55-9444-a9d5398d4ec7",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2809"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2809",
          "registrationNumber": "9020642600062",
          "classNo": 9,
          "student.name": "DAKSHENYA S R",
          "student.gender": "F",
          "student.parentName": "RAJENDRAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c75264cc-a5cb-419f-a076-de6b65c9c1bb",
          "admissionId": "d78b72c3-8ff1-44f9-93a8-a73a13010a92",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2918"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2918",
          "registrationNumber": "9020642600036",
          "classNo": 9,
          "student.name": "DHARSHIK RAJESHKUMAR",
          "student.gender": "M",
          "student.parentName": "RAJESHKUMAR VENGADAPATHY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ed16fe3f-3f8a-472b-891f-e2e3b8a5408e",
          "admissionId": "f1438d21-7dc2-47d0-9665-34c0047c296b",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8032"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8032",
          "registrationNumber": "9020642600034",
          "classNo": 9,
          "student.name": "DHARUK ADITHYA K G",
          "student.gender": "M",
          "student.parentName": "GUNASEELAN K R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ec25169b-6013-4eaf-99ab-90a2979d3e4a",
          "admissionId": "c024efbc-e3c9-4ba8-8899-719a4c5f603a",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7871"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7871",
          "registrationNumber": "9020642600037",
          "classNo": 9,
          "student.name": "DIVITOLIRVAN K",
          "student.gender": "M",
          "student.parentName": "KIRUPA VASANTHAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4ddbcf07-7471-47a4-9cda-716a46d7e58c",
          "admissionId": "796d3b7a-0883-4c66-85a6-6fb4a4e586e6",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4033"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4033",
          "registrationNumber": "9020642600038",
          "classNo": 9,
          "student.name": "EDRIC ANTONY JESURAJ",
          "student.gender": "M",
          "student.parentName": "DR M LAWRANCE JESURAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e796447a-2d10-4337-88a0-025af43b8f84",
          "admissionId": "66f82f60-e3ba-4ff4-b1d6-e9fc13321d56",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8117"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8117",
          "registrationNumber": "9020642600074",
          "classNo": 9,
          "student.name": "HARSHITHAA S B",
          "student.gender": "F",
          "student.parentName": "SANKARAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c1772d8f-ea55-4567-b76d-6e903f793c61",
          "admissionId": "2af28499-dc6e-4f34-8d11-b00456f2bf59",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8169"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8169",
          "registrationNumber": "9020642600063",
          "classNo": 9,
          "student.name": "HEMANYA R",
          "student.gender": "F",
          "student.parentName": "RAJKUMAR R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ee73f5ca-afb5-4ebe-b6ba-d0a9d0e596b2",
          "admissionId": "f7bede7a-c34a-4445-b276-65ebece5244f",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2865"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2865",
          "registrationNumber": "9020642600090",
          "classNo": 9,
          "student.name": "HRISH ABINAND J",
          "student.gender": "M",
          "student.parentName": "JAGANIVAS S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e1bf6441-01f3-4f1a-8fc0-19591c19247a",
          "admissionId": "69521011-8366-4329-b597-12898d922d82",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8073"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8073",
          "registrationNumber": "9020642600058",
          "classNo": 9,
          "student.name": "JEYANYAA G",
          "student.gender": "F",
          "student.parentName": "GANDHI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "12de7aa4-72b0-43e5-8b7a-ef7a6dc3d4bf",
          "admissionId": "669e81d1-732f-4d64-a71d-7292cddd62e1",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8019"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8019",
          "registrationNumber": "9020642600013",
          "classNo": 9,
          "student.name": "JIYA RITVI",
          "student.gender": "F",
          "student.parentName": "SARAVANAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ca1618d1-ce92-4cd4-a36f-45c15fcc3c39",
          "admissionId": "63cd5d06-d41c-49f1-8e91-7b345a05436d",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5644"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5644",
          "registrationNumber": "9020642600056",
          "classNo": 9,
          "student.name": "KAARTHI RETHINAVELU",
          "student.gender": "M",
          "student.parentName": "RETHINAVELU PERIYASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4275c5fe-06be-44f6-b53d-10ff429c9fd6",
          "admissionId": "bb6837d9-0a85-4c2c-a8a1-c6853ceccd85",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8102"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8102",
          "registrationNumber": "9020642600061",
          "classNo": 9,
          "student.name": "KRISHMA S S",
          "student.gender": "F",
          "student.parentName": "SARAVANAN B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7856138c-863a-43bd-8b3c-f15d82cbde10",
          "admissionId": "30f7036f-269b-4299-b933-6860f30b00fe",
          "createdAt": "2026-11-12T06:35:16.304Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2870"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2870",
          "registrationNumber": "9020642600039",
          "classNo": 9,
          "student.name": "PRANEETHA K S",
          "student.gender": "F",
          "student.parentName": "SIVAKUMAR K G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "76809c80-ede2-4242-bd4b-f5a544cc3f35",
          "admissionId": "61b16be6-36bd-4e7f-aac5-56876defc49f",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8014"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8014",
          "registrationNumber": "9020642600032",
          "classNo": 9,
          "student.name": "PRATHIK A",
          "student.gender": "M",
          "student.parentName": "ASHOKKUMAR DURAISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f063fe43-4feb-4f20-9c3b-600ee0ee74a2",
          "admissionId": "f0d7c823-11f5-44e7-929f-f74c12c2806a",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7974"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7974",
          "registrationNumber": "9020642600044",
          "classNo": 9,
          "student.name": "SANJANA S",
          "student.gender": "F",
          "student.parentName": "SENTHIL KUMAR N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "331e887d-4bcc-43b1-b823-d2430542de82",
          "admissionId": "568d240f-de77-49fa-bde8-f2368caa6e66",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7973"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7973",
          "registrationNumber": "9020642600008",
          "classNo": 9,
          "student.name": "SHAMYUKTHA S",
          "student.gender": "F",
          "student.parentName": "SANTHOSH P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "27f39c4d-1572-4ba3-b909-726f2f60fe0b",
          "admissionId": "e5ec7963-33f3-4118-bcfd-09cfd2e70e95",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7931"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7931",
          "registrationNumber": "9020642600019",
          "classNo": 9,
          "student.name": "SIDDHARTH GOWRISHANKAR",
          "student.gender": "M",
          "student.parentName": "GOWRISHANKAR ERODE SINGARAVELU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bb315854-a96d-4caf-8f23-77354d2541f8",
          "admissionId": "fd6ace1b-290c-43ff-abae-7bce134fb461",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8132"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8132",
          "registrationNumber": "9020642600068",
          "classNo": 9,
          "student.name": "SOOMI ZIONAH VAZ A",
          "student.gender": "F",
          "student.parentName": "ANTO VAZ S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0c3fda3f-c0f4-4a35-b786-0373e862c938",
          "admissionId": "237ca1a7-fe6a-4254-bdb5-52b7f550e639",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8018"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8018",
          "registrationNumber": "9020642600033",
          "classNo": 9,
          "student.name": "VIBHAV G",
          "student.gender": "M",
          "student.parentName": "GURUANAND C",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "batchCode": "COIFR260S01",
          "firstBatchId": "4e28813e-a544-4a46-b281-73f290740f8c",
          "firstBatchCode": "COIFR260S01",
          "firstBatchName": "SIGMA-9A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "42de2f55-f089-4bf8-8060-44794a6f3308",
          "admissionId": "787f47c0-68bb-4233-a763-db9ad9462c58",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8042"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8042",
          "registrationNumber": "9020642600070",
          "classNo": 9,
          "student.name": "ABINESH K",
          "student.gender": "M",
          "student.parentName": "KATHIRVEL S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8ed6baf6-a002-4359-8a6c-2ca7ac9155f3",
          "admissionId": "ee84ee9f-fa59-414f-8bd1-f8a0a3df173d",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8092"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8092",
          "registrationNumber": "9020642600091",
          "classNo": 9,
          "student.name": "AHARSHAN RAVI",
          "student.gender": "M",
          "student.parentName": "RAVI K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4342448a-0772-4a9c-adc5-74a2a97d4ab3",
          "admissionId": "bb6eb45d-5978-47f8-9e45-588ccb260341",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5579"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5579",
          "registrationNumber": "9020642600015",
          "classNo": 9,
          "student.name": "ANVITA HARIHARAN",
          "student.gender": "F",
          "student.parentName": "HARIHARAN SEKAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "24b43e71-b89f-417f-9135-e78932c00102",
          "admissionId": "c4cafba7-66b4-4838-b633-59c0b3135cc7",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8022"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8022",
          "registrationNumber": "9020642600079",
          "classNo": 9,
          "student.name": "BALA ADITHYA S",
          "student.gender": "M",
          "student.parentName": "SHEEVAKUMAR K G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "75988d36-0cf3-4cf2-9cb7-91ae170125f6",
          "admissionId": "69f82f21-dd84-4ae9-8ae1-323247aa1e83",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7917"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7917",
          "registrationNumber": "9020642600028",
          "classNo": 9,
          "student.name": "BALASUBRAMANIAN V",
          "student.gender": "M",
          "student.parentName": "VAIDYANATHAN B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f3167443-022e-4ac4-8b4e-9bdd90af239e",
          "admissionId": "9263b9bd-dd01-4a98-86af-40fa34aa1527",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8153"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8153",
          "registrationNumber": "9020642600089",
          "classNo": 9,
          "student.name": "DHAVANANTHAN L",
          "student.gender": "M",
          "student.parentName": "LOGANATHAN P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4aa9562b-3989-4546-9dde-f8c9587e43e7",
          "admissionId": "88b303f8-f382-4154-b7b5-dfea3ad46f28",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8067"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8067",
          "registrationNumber": "9020642600027",
          "classNo": 9,
          "student.name": "HARIRAM M",
          "student.gender": "M",
          "student.parentName": "MURALIKRISHNAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "faeb8250-a018-4e27-ba45-3f56c3d35f38",
          "admissionId": "3fc1fd45-06de-483f-9853-a8258cce1c90",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7945"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7945",
          "registrationNumber": "9020642600007",
          "classNo": 9,
          "student.name": "HARSHADA N",
          "student.gender": "F",
          "student.parentName": "NANDAKUMAR S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "48c0db33-fea0-47f6-b5b6-d8995f324499",
          "admissionId": "e60bc566-1d76-4558-a36e-f6e6c09542f2",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4204"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4204",
          "registrationNumber": "9020642600057",
          "classNo": 9,
          "student.name": "HARSHITHA VIJAYAKUMAR",
          "student.gender": "F",
          "student.parentName": "DR R VIJAYAKUMAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "57be1b26-92ac-4c2a-856e-e9ec6fa31574",
          "admissionId": "fd7c97a1-8a8a-45a1-b549-0deab775973d",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5640"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5640",
          "registrationNumber": "9020642600047",
          "classNo": 9,
          "student.name": "INIYA ELANKUMAR",
          "student.gender": "F",
          "student.parentName": "ELANKUMAR SUBBARAYAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "839f8870-bc74-4ef4-9d18-4c5bebe16d08",
          "admissionId": "9e75b03a-0c86-4cdb-a8cc-f1f093f91f32",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7967"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7967",
          "registrationNumber": "9020642600081",
          "classNo": 9,
          "student.name": "JAICHARAN S",
          "student.gender": "M",
          "student.parentName": "SANTHANAKRISHNAN P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "99b7143b-424a-4097-9378-1d7479870fdb",
          "admissionId": "e4ea93cd-c2b8-40c7-94d3-354c845ae187",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8015"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8015",
          "registrationNumber": "9020642600006",
          "classNo": 9,
          "student.name": "KAUSHIC P D",
          "student.gender": "M",
          "student.parentName": "DHANASEKARAN RADHAKRISHNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "39795ee4-2aa5-4563-85fb-53be963d07e5",
          "admissionId": "599ce105-77cc-4551-85c4-6054eaa73d06",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5620"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5620",
          "registrationNumber": "9020642600041",
          "classNo": 9,
          "student.name": "KAVIN MURALI",
          "student.gender": "M",
          "student.parentName": "MURALI MUTHUMANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "53f91590-3e1a-4be5-8ef0-6c9a0b0f4983",
          "admissionId": "16d59cee-61c6-43fe-94b1-69c4bfa74e31",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5634"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5634",
          "registrationNumber": "9020642600035",
          "classNo": 9,
          "student.name": "KRISSHIVVARSHAN MAHESHKUMAR",
          "student.gender": "M",
          "student.parentName": "MAHESHKUMAR SUBRAMANIAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "db0e5519-18fc-42af-9818-40c122d4aa25",
          "admissionId": "d74ead76-02af-4400-bd33-d2ac945a87fb",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8111"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8111",
          "registrationNumber": "9020642600066",
          "classNo": 9,
          "student.name": "LAKSHA SRI M S",
          "student.gender": "F",
          "student.parentName": "MANRAJAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7014366e-1a5f-493d-a979-dac5743587a2",
          "admissionId": "0bccbcf9-782b-4e1d-b1d3-7fbb43e2131a",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8009"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8009",
          "registrationNumber": "9020642600017",
          "classNo": 9,
          "student.name": "MITHRA S J",
          "student.gender": "F",
          "student.parentName": "JAYAKUMAR N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "09987eb9-83a9-46bf-98e0-6284fcde6fea",
          "admissionId": "02f43f01-e75a-4847-b8ea-fe6681800ed3",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3856"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3856",
          "registrationNumber": "9020642600065",
          "classNo": 9,
          "student.name": "MUGIL PRAMODH S",
          "student.gender": "M",
          "student.parentName": "DR.N.SENTHIL KUMAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "235f119a-6263-4071-8ffe-bc2c9c5a4d1b",
          "admissionId": "1bd7cd4a-cca0-490d-8dde-d7eebf7819c7",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4019"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4019",
          "registrationNumber": "9020642600014",
          "classNo": 9,
          "student.name": "NETRA A R",
          "student.gender": "F",
          "student.parentName": "ARULPRAKASH L",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c20167d6-935b-4157-859c-e6bc77b742d3",
          "admissionId": "abc400ef-caa9-4ee9-9ad0-e67edd610c3c",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8118"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8118",
          "registrationNumber": "9020642600076",
          "classNo": 9,
          "student.name": "NILAN DHANASEKAR",
          "student.gender": "M",
          "student.parentName": "DHANASEKAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "255a4cdc-ed10-47fe-b27a-18830dbaab07",
          "admissionId": "a549d57e-8a9e-4d93-91da-229c88492af3",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8021"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8021",
          "registrationNumber": "9020642600048",
          "classNo": 9,
          "student.name": "NITHIN T S",
          "student.gender": "M",
          "student.parentName": "THANGAVELU C",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c80331be-7f31-40d3-98b4-08cc1fc03875",
          "admissionId": "d48db8e8-54b7-44a1-9d63-1c094ee21316",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7907"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7907",
          "registrationNumber": "9020642600049",
          "classNo": 9,
          "student.name": "NITHYA SREE P",
          "student.gender": "F",
          "student.parentName": "PREMNATH R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4c0d05ab-a7ae-4393-8465-f364fb7a3c54",
          "admissionId": "3ee25e8d-c54d-4320-964d-d9c0cbc78d88",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4616"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4616",
          "registrationNumber": "9020642600010",
          "classNo": 9,
          "student.name": "NITISH DHARANIPATHI",
          "student.gender": "M",
          "student.parentName": "DHARANIPATHI JAYAGOPAL",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "07ed50e1-4a7e-4341-8fa4-52ad00c217a4",
          "admissionId": "ea1aebdf-3729-4fa8-bf39-071334de69fe",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8116"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8116",
          "registrationNumber": "9020642600077",
          "classNo": 9,
          "student.name": "PAVISHYA S M",
          "student.gender": "F",
          "student.parentName": "SENTHIL KUMAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "882a93a8-9579-4ce9-be07-1d47dbc5ed16",
          "admissionId": "22ca149a-9914-45e2-8d76-e236b509f7b1",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5624"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5624",
          "registrationNumber": "9020642600021",
          "classNo": 9,
          "student.name": "PRANAV RAJESWARI BALASUNDARAM",
          "student.gender": "M",
          "student.parentName": "BALASUNDARAM ARUKUTTI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "fedd23c7-8914-4a89-9875-be7b0f28ec57",
          "admissionId": "c4f94943-a724-44db-a169-c378464d7f07",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8112"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8112",
          "registrationNumber": "9020642600029",
          "classNo": 9,
          "student.name": "PRANESH T P",
          "student.gender": "M",
          "student.parentName": "PERIYASAMY S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "aaa1f4d2-bf80-4196-8108-a9abd73b87f9",
          "admissionId": "6f650604-2f6f-4c4f-87b6-41320480e375",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5866"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5866",
          "registrationNumber": "9020642600012",
          "classNo": 9,
          "student.name": "RAKSHAN KRISHNA JAGADEESAN",
          "student.gender": "M",
          "student.parentName": "JAGADEESAN SRINIVASAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3d8ee62a-826d-4504-89dd-c180e3e11774",
          "admissionId": "38821733-a61d-42cc-b67d-7fb2200146af",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4022"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4022",
          "registrationNumber": "9020642600055",
          "classNo": 9,
          "student.name": "RUDRAKSHA SHARMA",
          "student.gender": "M",
          "student.parentName": "DR ASHISH SHARMA",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3125647f-38a5-4aac-b558-3f843d0cbb5d",
          "admissionId": "e24218b1-526a-433d-b22f-817a9d5ff929",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5745"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5745",
          "registrationNumber": "9020642600009",
          "classNo": 9,
          "student.name": "SANJAY BALAJI",
          "student.gender": "M",
          "student.parentName": "BALAJI NAMADEVAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "46d3fa4c-bb25-46cc-88a9-b7b60960f1a0",
          "admissionId": "044974a6-a18f-4b31-93c7-7a894b8ce122",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4063"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4063",
          "registrationNumber": "9020642600020",
          "classNo": 9,
          "student.name": "SANJAY K",
          "student.gender": "M",
          "student.parentName": "KARTHI KUMAR P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ab1e9fa4-c928-44b4-badb-241573cef36c",
          "admissionId": "88fcfd51-1510-49bf-ab2f-f24158b6b9d0",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8161"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8161",
          "registrationNumber": "9020642600075",
          "classNo": 9,
          "student.name": "SOWBARNIKA K",
          "student.gender": "F",
          "student.parentName": "KUPPUSAMY V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "515aa971-a0d5-47b9-b226-0e415531073e",
          "admissionId": "083913c4-8608-4086-8b48-d1f3ed0eb305",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2851"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2851",
          "registrationNumber": "9020642600022",
          "classNo": 9,
          "student.name": "SRIVATSAN PRABHU",
          "student.gender": "M",
          "student.parentName": "PRABHU DEVARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a4c73fb9-03bd-4b19-9713-1a0147e454ae",
          "admissionId": "cb3a914d-b7fe-4a5e-90e3-bdcff4013774",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2828"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2828",
          "registrationNumber": "9020642600051",
          "classNo": 9,
          "student.name": "SWETHA S",
          "student.gender": "F",
          "student.parentName": "SHANMUGARAJA L",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "30b91896-c264-45f9-bb02-4ca7cd97c305",
          "admissionId": "c2c23539-7ebb-49ab-9e3a-90bfd2315a89",
          "createdAt": "2026-11-12T06:35:16.305Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4165"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4165",
          "registrationNumber": "9020642600086",
          "classNo": 9,
          "student.name": "VIKESH S",
          "student.gender": "M",
          "student.parentName": "DR V SUNDARARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "df78ed29-18dc-492e-a295-28a4dd187fcb",
          "admissionId": "88957667-6b18-4017-b337-10604cfbb772",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7899"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7899",
          "registrationNumber": "9020642600016",
          "classNo": 9,
          "student.name": "VINAYA A",
          "student.gender": "F",
          "student.parentName": "ARULRAJ P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "batchCode": "COIFR260E01",
          "firstBatchId": "1dc9c594-cc51-4aed-85c2-a2b45fa8731f",
          "firstBatchCode": "COIFR260E01",
          "firstBatchName": "EPSILON-9A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b6ae2449-d84f-47a4-baf7-168ee69cba2c",
          "admissionId": "e28d3d2b-569d-4d65-a826-099dc75d2611",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5643"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5643",
          "registrationNumber": "9020642600080",
          "classNo": 9,
          "student.name": "AADHAV RAMESH",
          "student.gender": "M",
          "student.parentName": "RAMESH RANGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ed60715a-6c51-4213-9613-a86c2c3754d3",
          "admissionId": "f13e0b2e-071e-49d7-b67f-e63648de05bf",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2868"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2868",
          "registrationNumber": "9020642600053",
          "classNo": 9,
          "student.name": "AARAV RAAM",
          "student.gender": "M",
          "student.parentName": "RAMMOHAN P M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b3b40443-7fca-4c4d-8893-ea2fdae19bc4",
          "admissionId": "6b746755-4d58-4d50-a35c-a589cb5f04f5",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8076"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8076",
          "registrationNumber": "9020642600073",
          "classNo": 9,
          "student.name": "ABHINAV G",
          "student.gender": "M",
          "student.parentName": "GANESHMOORTHY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f1d18a03-6bdc-43bd-bdee-41da770b9161",
          "admissionId": "f82d75dc-f91e-4ea1-9075-ab0f49a8eb4a",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7960"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7960",
          "registrationNumber": "9020642600031",
          "classNo": 9,
          "student.name": "ABHINAV K",
          "student.gender": "M",
          "student.parentName": "KARTHIK P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "db86cd91-2e71-4b53-a6dd-b6b7be42bbd3",
          "admissionId": "8644c518-f4a6-490c-82fd-cb8c1b1d7add",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2835"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2835",
          "registrationNumber": "9020642600002",
          "classNo": 9,
          "student.name": "ABIYNAV B T",
          "student.gender": "M",
          "student.parentName": "THIYAGARAJ D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0957aa4e-cba0-45f6-8c5a-f942e65d496e",
          "admissionId": "ab4d91d4-e694-4e46-a331-95eb182a308d",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8079"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8079",
          "registrationNumber": "9020642600054",
          "classNo": 9,
          "student.name": "ANIVARTHNY K",
          "student.gender": "F",
          "student.parentName": "KARTHIKEYAN S B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b4b48208-15d8-407a-8b53-12747517dc19",
          "admissionId": "f820bfee-4f65-48aa-a596-ec8157fc6229",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5194"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5194",
          "registrationNumber": "9020642600005",
          "classNo": 9,
          "student.name": "ARADHANA PARTHIBAN",
          "student.gender": "F",
          "student.parentName": "PARTHIBAN ARUMUGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b420d418-7fb0-4ff1-8853-90fbb00e035f",
          "admissionId": "99c9cf57-f4fc-4d1e-b72e-42c24260a1ae",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2867"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2867",
          "registrationNumber": "9020642600052",
          "classNo": 9,
          "student.name": "ARNAV RAAM",
          "student.gender": "M",
          "student.parentName": "RAMMOHAN P M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "785cfcda-7f51-4480-9fa3-a130a3023ece",
          "admissionId": "d416c1f9-8de8-4f25-948d-d2c3b6b82ed3",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7976"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7976",
          "registrationNumber": "9020642600001",
          "classNo": 9,
          "student.name": "BARGAV ADITYA V",
          "student.gender": "M",
          "student.parentName": "VENKAT RAHAVAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "97fac66c-1d2a-44e5-8132-0a9f1938d298",
          "admissionId": "54f1d941-9974-46f3-8009-45e952781705",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8172"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8172",
          "registrationNumber": "9020642600078",
          "classNo": 9,
          "student.name": "CHARUNETHRA S",
          "student.gender": "F",
          "student.parentName": "SARAVANAN P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e8812c48-12e2-4e00-8772-271cec0257c2",
          "admissionId": "93918d83-6473-4601-96a3-53386a4fc1a5",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8142"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8142",
          "registrationNumber": "9020642600045",
          "classNo": 9,
          "student.name": "DARSHAN G",
          "student.gender": "M",
          "student.parentName": "GOBI M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c7bddff6-90ce-4b71-a5f8-41c544b5048f",
          "admissionId": "8c22c440-12ef-4811-844b-24892bd27c60",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8016"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8016",
          "registrationNumber": "9020642600069",
          "classNo": 9,
          "student.name": "INTHIRESH VASAN M",
          "student.gender": "M",
          "student.parentName": "MARISANKAR D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6b444b27-6608-4a1b-9ca2-1e25c10c5b8e",
          "admissionId": "2a14f49c-1185-45eb-809b-642eb7f2d538",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8126"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8126",
          "registrationNumber": "9020642600072",
          "classNo": 9,
          "student.name": "JAI AKASH C",
          "student.gender": "M",
          "student.parentName": "CHINNA KALIYAPPAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "53b4eac4-4769-43f8-b52d-e29e6d2d2511",
          "admissionId": "2e6b8e66-7392-4383-b96d-f80d1c78eef0",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2842"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2842",
          "registrationNumber": "9020642600050",
          "classNo": 9,
          "student.name": "KAVYANANDHINI S",
          "student.gender": "F",
          "student.parentName": "SIVAKUMAR P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "05b7720c-ae7e-4240-8650-cd338ef100e4",
          "admissionId": "81da026f-9704-4d9d-8339-f8d58a90bf27",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2784"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2784",
          "registrationNumber": "9020642600042",
          "classNo": 9,
          "student.name": "KRISHNA VENI R V",
          "student.gender": "F",
          "student.parentName": "RAJESH M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "19d70585-8caa-4c0f-be90-003b2885af77",
          "admissionId": "3c4cc8cc-c41d-4021-ab87-d6bf4373e613",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5038"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5038",
          "registrationNumber": "9020642600025",
          "classNo": 9,
          "student.name": "LAKSIKA RAJALAKSHMI VIKRAMAN",
          "student.gender": "F",
          "student.parentName": "VIKRAMAN GOPALAKRISHNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0a1673f4-538b-48ca-94f8-5bb9c364d4e3",
          "admissionId": "ad5e3fb4-bbf4-4261-a1be-52958a5bc1d1",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7966"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7966",
          "registrationNumber": "9020642600030",
          "classNo": 9,
          "student.name": "NIDHIN K",
          "student.gender": "M",
          "student.parentName": "KATHIRESAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "30d75362-a791-472c-9559-0fcb8516f8d8",
          "admissionId": "c041b349-c29f-42ca-9a8d-f3a88e5947a2",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2849"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2849",
          "registrationNumber": "9020642600059",
          "classNo": 9,
          "student.name": "NIKESH S",
          "student.gender": "M",
          "student.parentName": "DR.D.SENTHIL KUMAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9ff09a31-82ae-47ef-834b-5d62fd7f94b3",
          "admissionId": "dfe75ef6-bbbf-466c-8060-b1c4c2934e69",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7964"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7964",
          "registrationNumber": "9020642600026",
          "classNo": 9,
          "student.name": "PRAGADHI G E",
          "student.gender": "F",
          "student.parentName": "ESWARASAMY G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2e35aae2-58f2-4b69-b174-1453d8d6b1f3",
          "admissionId": "41763286-0fb9-4159-a784-fc3f1431770f",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7890"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7890",
          "registrationNumber": "9020642600067",
          "classNo": 9,
          "student.name": "PRRAVIN R",
          "student.gender": "M",
          "student.parentName": "RAMESH  G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ca9484b1-46a6-4598-87b5-fb96bb5b36a0",
          "admissionId": "0243daa6-2f27-49bc-8929-355ee6d06125",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3853"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3853",
          "registrationNumber": "9020642600083",
          "classNo": 9,
          "student.name": "RISHIPRIYAN S",
          "student.gender": "M",
          "student.parentName": "SELVAM G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a4a2ab83-89cb-4625-ad44-59883fee0c67",
          "admissionId": "6f14afa8-7918-46fc-8578-ce618abcd59e",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7935"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7935",
          "registrationNumber": "9020642600040",
          "classNo": 9,
          "student.name": "RITHVIK R",
          "student.gender": "M",
          "student.parentName": "RAMKUMAR R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "133f39c5-27e5-4702-88e8-a7e21cbcb469",
          "admissionId": "cdbfe143-dd3c-4114-8636-40a72183d350",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4543"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4543",
          "registrationNumber": "9020642600088",
          "classNo": 9,
          "student.name": "SARADA SAILESWARAN",
          "student.gender": "F",
          "student.parentName": "SAILESWARAN JAGATHEES",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "fa20d589-ec66-4372-8536-f0b1e6eed0b5",
          "admissionId": "1479741a-9ee9-4ab4-b243-a4ee2d9ebeee",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8026"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8026",
          "registrationNumber": "9020642600023",
          "classNo": 9,
          "student.name": "SASHWIN JAYASAKTHIVEL",
          "student.gender": "M",
          "student.parentName": "JAYASAKTHIVEL A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "301458f5-7b46-4e36-94a8-c994bafd9f6a",
          "admissionId": "f27acb99-ac48-4aa0-b335-27c445e385af",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2875"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2875",
          "registrationNumber": "9020642600082",
          "classNo": 9,
          "student.name": "SASMITHA R P",
          "student.gender": "F",
          "student.parentName": "RANGARAJ G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "43b18953-e9d2-40f2-b5d6-29274d673c6a",
          "admissionId": "b7d0e58e-91c9-41ce-adb2-9460406b642c",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5615"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5615",
          "registrationNumber": "9020642600043",
          "classNo": 9,
          "student.name": "SHERIN KARUNYA AMBROSE KANNAIAH",
          "student.gender": "F",
          "student.parentName": "AMBROSE KANNAIAH PRINCE JAYASELAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e4b3cb5a-4033-4f47-866e-079c671f1683",
          "admissionId": "71a30ffb-40d1-436b-9d24-b278b13c5093",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4753"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4753",
          "registrationNumber": "9020642600018",
          "classNo": 9,
          "student.name": "SRIDHANAA ELANGOVAN",
          "student.gender": "F",
          "student.parentName": "ELANGOVAN SHANMUGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "16a9dc08-d62e-4aeb-a042-25251bed15be",
          "admissionId": "7acabf55-7182-424f-99dd-95762ad5c554",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8008"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8008",
          "registrationNumber": "9020642600060",
          "classNo": 9,
          "student.name": "TARUN RAM K S",
          "student.gender": "M",
          "student.parentName": "SRIRAM K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c631a31d-7abb-44fd-b9f2-4563b082a984",
          "admissionId": "1abd7ee0-088e-4add-9577-67c526fdfd37",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7987"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7987",
          "registrationNumber": "9020642600046",
          "classNo": 9,
          "student.name": "THANVANGTH T G",
          "student.gender": "M",
          "student.parentName": "THANGAVEL C",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2009513f-9a4c-4dbb-aba9-a2edbd8aa8f8",
          "admissionId": "4b0956b9-0b05-4f7b-b2f1-664f9f364a69",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8170"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8170",
          "registrationNumber": "9020642600071",
          "classNo": 9,
          "student.name": "TIYAASH G S",
          "student.gender": "M",
          "student.parentName": "GNANA SUNDARA PANDIAN N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a251cdd7-5817-4e07-8448-c838d2c1b303",
          "admissionId": "37c37553-9dd0-4869-91f7-2409fc4b1802",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7978"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7978",
          "registrationNumber": "9020642600064",
          "classNo": 9,
          "student.name": "VHEDHANTH S S",
          "student.gender": "M",
          "student.parentName": "SUDHAKAR K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "177d7ab4-c3fc-4b05-a844-e3b2b6e54c2f",
          "admissionId": "68831f28-078c-48f0-bceb-75aa098c06c8",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8025"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8025",
          "registrationNumber": "9020642600011",
          "classNo": 9,
          "student.name": "VIYAN SANJEEVAN M",
          "student.gender": "M",
          "student.parentName": "MUTHU VENKHAT S S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "batchCode": "COIFR260A01",
          "firstBatchId": "366434f2-bbd2-4fe2-875a-93e663c22b38",
          "firstBatchCode": "COIFR260A01",
          "firstBatchName": "ALPHA-9A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ded6dc89-866b-4d6a-ad21-eefaad26639b",
          "admissionId": "2e7db66c-a293-4033-a575-0e2d7bb76982",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2391"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2391",
          "registrationNumber": "9020642590042",
          "classNo": 10,
          "student.name": "AKILESH A S",
          "student.gender": "M",
          "student.parentName": "ARAVINTH N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9cf98de1-92f5-4f38-a4fc-87bde74338dd",
          "admissionId": "b9b34cea-c6b3-4013-878e-9fe3814b1c4c",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7328"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7328",
          "registrationNumber": "9020642590029",
          "classNo": 10,
          "student.name": "AKSHAYAA SRI V S",
          "student.gender": "F",
          "student.parentName": "VELUSAMY S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "111da285-9471-46dd-baac-68d8e17fa332",
          "admissionId": "70c14d71-71e9-4571-993f-42995fa1aa38",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7430"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7430",
          "registrationNumber": "9020642590005",
          "classNo": 10,
          "student.name": "ANGELIN MIRIAM A",
          "student.gender": "F",
          "student.parentName": "AROCKIA SAGAYARAJ D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "361e45f7-0374-4687-bd99-ee6d40ff97f1",
          "admissionId": "20aefcd0-60cb-45f9-9e7b-cf7c9d59bf67",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5506"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5506",
          "registrationNumber": "9020642590032",
          "classNo": 10,
          "student.name": "ANJALI RAKSHAMBIKAI A",
          "student.gender": "F",
          "student.parentName": "ALAGARRAJ M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "525f4c4f-841d-4890-998d-0336bc532b77",
          "admissionId": "bc1532c3-07e0-4cc7-a9d8-3ee8ed983b19",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5499"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5499",
          "registrationNumber": "9020642590044",
          "classNo": 10,
          "student.name": "DHANVANTH V",
          "student.gender": "M",
          "student.parentName": "VARATHARAJ PERIYASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "fb27dff8-3366-4900-88c2-7ccfd5a094f7",
          "admissionId": "d577c32e-8d14-406d-8b12-1a3fc76318cb",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6227"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6227",
          "registrationNumber": "9020642590045",
          "classNo": 10,
          "student.name": "DHANVIN S S",
          "student.gender": "M",
          "student.parentName": "SATHIYAKUMAR K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7af5b467-6206-46d1-8a5d-cb9c9667123e",
          "admissionId": "7dc12265-360c-4878-960e-34e60e104d08",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7434"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7434",
          "registrationNumber": "9020642590037",
          "classNo": 10,
          "student.name": "DHARSHAN S T",
          "student.gender": "M",
          "student.parentName": "SEKAR A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0a0890bc-9361-44f7-84e5-e81926f042dd",
          "admissionId": "106a9d4b-07c0-4f43-b56c-103fc61338c6",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7332"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7332",
          "registrationNumber": "9020642590009",
          "classNo": 10,
          "student.name": "DHEEKSHA BALAMURUGAN",
          "student.gender": "F",
          "student.parentName": "BALAMURUGAN M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5c8bcaad-7524-40d5-8f55-d2ef89ccf79a",
          "admissionId": "62699ec0-e206-4481-a173-106790f3fbc9",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4565"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4565",
          "registrationNumber": "9020642590030",
          "classNo": 10,
          "student.name": "JASHVANA A",
          "student.gender": "F",
          "student.parentName": "ASHOK D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "33b4b1cd-e4e3-43c1-bd92-85001b22bcfd",
          "admissionId": "8603821d-3d8d-46af-a6e5-91966ee85926",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7312"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7312",
          "registrationNumber": "9020642590024",
          "classNo": 10,
          "student.name": "JAYENDRA S",
          "student.gender": "M",
          "student.parentName": "SRIRAM D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b231743a-56eb-4d8a-985a-aeec7139dee3",
          "admissionId": "4577837a-ec99-4611-8704-af850cdd3799",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2367"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2367",
          "registrationNumber": "9020642590012",
          "classNo": 10,
          "student.name": "KAASNI K P",
          "student.gender": "F",
          "student.parentName": "PRABHAKARAN K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f79d369d-a5d6-4f23-ac2d-4b638f4a2d70",
          "admissionId": "df3d8732-e591-4034-b59f-bb5f504f0fff",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7356"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7356",
          "registrationNumber": "9020642590017",
          "classNo": 10,
          "student.name": "KANUJA S M",
          "student.gender": "F",
          "student.parentName": "SAMIDURAI D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c8cf3231-bb75-450b-b137-2ebc68918134",
          "admissionId": "b83145ab-0a2f-4d5d-98d8-b93be161915f",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7343"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7343",
          "registrationNumber": "9020642590049",
          "classNo": 10,
          "student.name": "KARTHIK R",
          "student.gender": "M",
          "student.parentName": "RAMKUMAR S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "21dc1f2b-b9ef-45da-99a3-2776c3dc7e31",
          "admissionId": "74619e91-8e63-4bf3-9547-e3686ee7bad1",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7355"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7355",
          "registrationNumber": "9020642590016",
          "classNo": 10,
          "student.name": "KAVIN NILAVAN S",
          "student.gender": "M",
          "student.parentName": "SELVARAJ N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "48c17a5a-1fda-43d7-8c0f-fbd9dbb44480",
          "admissionId": "cd48842a-6f9a-4134-bfb5-06a2ee05b890",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7345"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7345",
          "registrationNumber": "9020642590036",
          "classNo": 10,
          "student.name": "KRINISHA S",
          "student.gender": "F",
          "student.parentName": "SHANKAR E",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bbd6d9bb-8d34-4eff-8fc9-c0e7263f32cd",
          "admissionId": "c540a9ce-a10a-4742-9045-f3f8d76f8a19",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7421"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7421",
          "registrationNumber": "9020642590014",
          "classNo": 10,
          "student.name": "KRISHIV VIGNESH",
          "student.gender": "M",
          "student.parentName": "VIGNESH R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f7ecac74-7a0a-4294-9570-d1fac5ddcc2d",
          "admissionId": "970727d3-591c-4840-8135-faca794fc2ed",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7368"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7368",
          "registrationNumber": "9020642590027",
          "classNo": 10,
          "student.name": "KRITHIIK HARIPRASAD",
          "student.gender": "M",
          "student.parentName": "HARIPRASAD D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f742e93c-3255-4235-89d6-6ebc540a1bbc",
          "admissionId": "7af487ac-2f18-4b66-9c37-4f6fe3629438",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7420"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7420",
          "registrationNumber": "9020642590001",
          "classNo": 10,
          "student.name": "KRITHIV VIGNESH",
          "student.gender": "M",
          "student.parentName": "VIGNESH R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ff797030-591a-4ab6-9763-274933d7b759",
          "admissionId": "65ccc00c-17ce-4c90-bc65-86fe37f6a70c",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5546"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5546",
          "registrationNumber": "9020642590025",
          "classNo": 10,
          "student.name": "MAHATHI R",
          "student.gender": "F",
          "student.parentName": "RAMESH K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ae8669fb-e8ee-4a44-8ce6-649b1fbbb2bb",
          "admissionId": "53b2e3b8-c8f0-48e5-9026-aaf04e7840bf",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7322"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7322",
          "registrationNumber": "9020642590033",
          "classNo": 10,
          "student.name": "MOGANAPRASATH ARUNKUMAR",
          "student.gender": "M",
          "student.parentName": "ARUNKUMAR MANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "165dbcce-f3a7-4093-8c2d-d6147d030925",
          "admissionId": "fa7282d8-2370-47cb-8939-e288e86d533f",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7324"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7324",
          "registrationNumber": "9020642590046",
          "classNo": 10,
          "student.name": "MUKUUNTH S",
          "student.gender": "M",
          "student.parentName": "SATHISH KUMAR N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9b91b847-fa1e-4993-aa5a-e69a9c73863f",
          "admissionId": "819b4eff-9e33-488f-97db-7c09dbed7a64",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7357"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7357",
          "registrationNumber": "9020642590038",
          "classNo": 10,
          "student.name": "NITHIN SANJEEV P R",
          "student.gender": "M",
          "student.parentName": "RAMA KRISHNAN T C R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "06279473-7fb2-409e-92e2-c08b48c8aa04",
          "admissionId": "22087d8c-e326-4e3d-94eb-7ba5357dcdba",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7338"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7338",
          "registrationNumber": "9020642590003",
          "classNo": 10,
          "student.name": "PRAANESH S M",
          "student.gender": "M",
          "student.parentName": "MUTHUKRISHNAVEL MYLSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bd6d8160-8385-45b1-b5fd-dc0649bce59f",
          "admissionId": "32187acc-63fe-4e65-81a4-307df0d08dd7",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7344"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7344",
          "registrationNumber": "9020642590048",
          "classNo": 10,
          "student.name": "PRAJITHA SRI S",
          "student.gender": "F",
          "student.parentName": "SADHASIVAM R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "fdd9a121-0cc0-4b7b-b61b-44844d4e68f3",
          "admissionId": "69fdcbd6-69f2-4455-86ac-c2bdf31956aa",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2370"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2370",
          "registrationNumber": "9020642590018",
          "classNo": 10,
          "student.name": "PRANEETHA G R",
          "student.gender": "F",
          "student.parentName": "GURU ANANDAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c3d78d55-5f53-43ea-ba50-8fe8097250a4",
          "admissionId": "6d9c6d32-d181-461a-a4da-efa44a0307a3",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5964"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5964",
          "registrationNumber": "9020642590051",
          "classNo": 10,
          "student.name": "RITHIEKA RAGAVAN",
          "student.gender": "F",
          "student.parentName": "RAGAVAN ALAGUVELU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7963dc44-0074-4310-907d-578480690470",
          "admissionId": "9929b378-ef3a-447f-8a56-77750ee142b1",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5682"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5682",
          "registrationNumber": "9020642590013",
          "classNo": 10,
          "student.name": "SAARAL LIBBY PALANIAPPAN",
          "student.gender": "F",
          "student.parentName": "PALANIAPPAN M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "20c3667e-013f-4621-8ca0-8c1e5ac8b452",
          "admissionId": "30e5cbdc-6f4d-461a-a4ac-1a5e1d5ff48f",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7463"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7463",
          "registrationNumber": "9020642590023",
          "classNo": 10,
          "student.name": "SANTOSH KANNAN R",
          "student.gender": "M",
          "student.parentName": "RAMANI RAMALINGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "554ef7a9-1e45-46a2-a2a2-96d68a217fd3",
          "admissionId": "502e0c5c-6b4e-4122-8a7e-0ea354fccfbe",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7412"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7412",
          "registrationNumber": "9020642590010",
          "classNo": 10,
          "student.name": "SIDDHARTH S",
          "student.gender": "M",
          "student.parentName": "SRINIVASAN L",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d61ca967-a534-4c3f-b286-68940dbc7a23",
          "admissionId": "24b27693-2716-41b6-ae25-288e6cd159f3",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7398"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7398",
          "registrationNumber": "9020642590011",
          "classNo": 10,
          "student.name": "SRI AARADHANA V S",
          "student.gender": "F",
          "student.parentName": "SANKAR V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ad1d7fb4-cd98-4e6f-8ffc-f37140289cf9",
          "admissionId": "db5b33b5-06d0-4a43-8b04-3d1a565034ac",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7392"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7392",
          "registrationNumber": "9020642590040",
          "classNo": 10,
          "student.name": "TRISSHIV T",
          "student.gender": "M",
          "student.parentName": "THANGARAJ NANJUKUTTY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "42e8b7da-5a80-4c17-aefb-72bc83e74586",
          "admissionId": "85c74595-973e-4402-ade7-27cfc5143092",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7390"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7390",
          "registrationNumber": "9020642590047",
          "classNo": 10,
          "student.name": "VIDHUN LOGAKARTHI DEEPAK",
          "student.gender": "M",
          "student.parentName": "LOGAKARTHIDEEPAK KOOTHAMBI PONNUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "batchCode": "COIFR259P01",
          "firstBatchId": "1cf410c6-e307-4eb7-8198-2749cac814b1",
          "firstBatchCode": "COIFR259P01",
          "firstBatchName": "Pi-10A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ea1db811-e4c9-4109-8568-d4d57c897846",
          "admissionId": "994cffae-897d-43a0-87e6-9ca7ba06424d",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7292"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7292",
          "registrationNumber": "9020642600085",
          "classNo": 10,
          "student.name": "AARAV M VELAYUTHAM",
          "student.gender": "M",
          "student.parentName": "MANIVANNAN V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e8cc284f-7580-4ea2-88b3-ca27c8dde8df",
          "admissionId": "12bc6c02-a728-4011-9fcf-3bfc04c18ce5",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7383"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7383",
          "registrationNumber": "9020642590026",
          "classNo": 10,
          "student.name": "AARIYA K",
          "student.gender": "M",
          "student.parentName": "KARTHIKEYAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "06fbfb21-528a-49a6-bd1d-ec0ea7ee0a13",
          "admissionId": "c6c5dd0e-4867-48b4-981e-0b5554a388a7",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2355"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2355",
          "registrationNumber": "9020642590008",
          "classNo": 10,
          "student.name": "ABHINAV S",
          "student.gender": "M",
          "student.parentName": "SARAVANAKUMAR R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0c3c3916-c8fa-4ac8-ab63-004e47480c36",
          "admissionId": "940dd70f-6136-4544-b79c-f20555f6abad",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2387"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2387",
          "registrationNumber": "9020642590050",
          "classNo": 10,
          "student.name": "AKASH G D",
          "student.gender": "M",
          "student.parentName": "GUNASEKARAN M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "12de3ca9-8866-4841-9db1-5e4dbb8a9666",
          "admissionId": "a5611765-9bc5-4c64-9a4b-0cba90bc59b9",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7438"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7438",
          "registrationNumber": "9020642590064",
          "classNo": 10,
          "student.name": "AKSHATH U",
          "student.gender": "M",
          "student.parentName": "UGAMURTHY DURAISWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8254bf29-6bd0-4be8-9475-0bf3ca1a3af4",
          "admissionId": "03b4eeed-5864-40af-a0c6-09fa0dd0fb47",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7327"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7327",
          "registrationNumber": "9020642590058",
          "classNo": 10,
          "student.name": "ANANYA S",
          "student.gender": "F",
          "student.parentName": "SENTHILKUMAR MUTHUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "84fa6c87-d5ca-444e-b073-d441c1ccbebf",
          "admissionId": "ef14d41c-afc2-49b8-b0d0-dd217489dfd3",
          "createdAt": "2026-11-12T06:35:16.306Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7453"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7453",
          "registrationNumber": "9020642590053",
          "classNo": 10,
          "student.name": "AREVAN A S",
          "student.gender": "M",
          "student.parentName": "ARUNACHALAM P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "725a3971-bb2e-421e-b7db-918475ae5262",
          "admissionId": "4111fa33-909e-4bbe-bb9e-c37ad7d8b6af",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7362"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7362",
          "registrationNumber": "9020642590057",
          "classNo": 10,
          "student.name": "ARJUN NANDHA RISHI MUGESH KANNA",
          "student.gender": "M",
          "student.parentName": "RISHI MUGESH KANNA PRATHIBAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1aa7b58e-d95d-49b6-95d2-1f3e16fb11ae",
          "admissionId": "2a386c6f-fa88-4f59-887e-5edc7e81b113",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4025"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4025",
          "registrationNumber": "9020642590056",
          "classNo": 10,
          "student.name": "ARYA NARAYAN",
          "student.gender": "F",
          "student.parentName": "NAVED NARAYAN K T P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "00e9b71b-7b97-4c77-b07f-89290efaa321",
          "admissionId": "0fc77a1f-2aeb-423f-ace9-03a5f0c6555d",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7340"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7340",
          "registrationNumber": "9020642590015",
          "classNo": 10,
          "student.name": "ASMITHA R B",
          "student.gender": "F",
          "student.parentName": "BALAJI R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ef50fc7c-533a-49e3-bdf8-b511100d6edc",
          "admissionId": "b1cc825a-1d90-460b-ab6c-3cb602650d3d",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5494"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5494",
          "registrationNumber": "9020642590034",
          "classNo": 10,
          "student.name": "ASWATH GAUTAM KATHIRAVAN",
          "student.gender": "M",
          "student.parentName": "KATHIRAVAN RENGARAJU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7b8ea2bd-7b52-41bf-8ccf-ea7192cd1fae",
          "admissionId": "85268833-faca-4686-938d-275f2b6e826c",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7378"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7378",
          "registrationNumber": "9020642590054",
          "classNo": 10,
          "student.name": "CHARANKUMAR K",
          "student.gender": "M",
          "student.parentName": "KRISHNAKUMAR T",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "dc2ac6ec-15a5-460f-89a3-fa38541e8f77",
          "admissionId": "992684b8-559d-4846-b32d-1968c6460356",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2349"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2349",
          "registrationNumber": "9020642590022",
          "classNo": 10,
          "student.name": "DHANYA SHREE K R",
          "student.gender": "F",
          "student.parentName": "RAVICHANDRAN V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "524152f0-5ac3-41b2-b1f6-3cf89b40b5c9",
          "admissionId": "884a01f0-c9b4-4d7c-9466-a7800fc584a7",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3033"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3033",
          "registrationNumber": "9020642590019",
          "classNo": 10,
          "student.name": "GREGORIE PAUL",
          "student.gender": "M",
          "student.parentName": "BINU PAULOSE",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6efbc073-fce1-4873-b2c1-cefccd6bf1eb",
          "admissionId": "e14c0fd0-12d8-495a-9105-c6ef3b5e0be4",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5070"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5070",
          "registrationNumber": "9020642590060",
          "classNo": 10,
          "student.name": "HANUMESH KANNA R",
          "student.gender": "M",
          "student.parentName": "RAMESH KANNA M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3dea109f-6f87-47dd-b94a-dbfcb47ea375",
          "admissionId": "6173c777-e3ed-4da1-a51a-10ed7889c491",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2411"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2411",
          "registrationNumber": "9020642590039",
          "classNo": 10,
          "student.name": "HARICHARAN R",
          "student.gender": "M",
          "student.parentName": "RAMESH A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c227130b-b387-4902-88f7-4dfead45ce56",
          "admissionId": "74c69046-f359-4deb-aa87-322bbc6633fc",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4610"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4610",
          "registrationNumber": "9020642590059",
          "classNo": 10,
          "student.name": "HARINESH S",
          "student.gender": "M",
          "student.parentName": "SATHEESH",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "47fd9887-f73e-47c9-8d51-e8c7920778bf",
          "admissionId": "2730ccc2-0e8c-4dbb-9845-aa4df5b9f6d8",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7388"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7388",
          "registrationNumber": "9020642590002",
          "classNo": 10,
          "student.name": "HARSHIT S",
          "student.gender": "M",
          "student.parentName": "SRIDHAR G J",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0cbcc236-66ca-4297-a87d-e5cee597eb5d",
          "admissionId": "5a59a871-b42f-4c38-9974-62783f026901",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7450"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7450",
          "registrationNumber": "9020642590063",
          "classNo": 10,
          "student.name": "JHYOTSNA M A",
          "student.gender": "F",
          "student.parentName": "MANIKANDAN D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8caffc7b-6f72-4a97-8067-a4274b2f2e98",
          "admissionId": "397f35c4-41b6-43e7-a8af-e8fcef854dec",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2375"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2375",
          "registrationNumber": "9020642590028",
          "classNo": 10,
          "student.name": "KRITHIK B",
          "student.gender": "M",
          "student.parentName": "BALAKUMAR S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "da97fa97-f638-4f7f-8e66-f7a528763121",
          "admissionId": "b5f31a94-6d46-4fdc-bc50-ddc7c527d5ce",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7418"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7418",
          "registrationNumber": "9061662590003",
          "classNo": 10,
          "student.name": "MADIHAH ISHRATH",
          "student.gender": "F",
          "student.parentName": "SYED UMMAR I",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1b135382-ae1d-41f8-8600-69056269ab6b",
          "admissionId": "b1bf8322-9e46-402f-829e-d1464d9fa282",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7462"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7462",
          "registrationNumber": "9020642590020",
          "classNo": 10,
          "student.name": "MITHILESH K",
          "student.gender": "M",
          "student.parentName": "KARUPPUSAMY S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "aeba3c16-c6f9-4537-83a3-4dd0228edf0f",
          "admissionId": "e880b3f9-ff9e-446a-bfdb-d535d75e942c",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5549"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5549",
          "registrationNumber": "9020642590006",
          "classNo": 10,
          "student.name": "NITISH R",
          "student.gender": "M",
          "student.parentName": "RAJADURAIMURUGAN M C",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ec95559b-93ea-42b0-a6d6-d2af2383712a",
          "admissionId": "5ead0aeb-a827-47fa-92cf-66a73e3b373b",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5530"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5530",
          "registrationNumber": "9020642590007",
          "classNo": 10,
          "student.name": "SAI DHANVANTH M U",
          "student.gender": "M",
          "student.parentName": "MADHAN K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9ad62977-546d-4d1a-88ee-708818774467",
          "admissionId": "1ec0950b-0b81-4e7d-b998-93d83b835341",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7490"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7490",
          "registrationNumber": "9020642590065",
          "classNo": 10,
          "student.name": "SAMYUKTHA SHANKAR",
          "student.gender": "F",
          "student.parentName": "SHANKAR DHANDAPANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5623a9ec-8692-4fb0-a5a0-8415f39226f1",
          "admissionId": "628eabe1-13af-4c4e-82ac-6a739dd8d5b9",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7326"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7326",
          "registrationNumber": "9020642590035",
          "classNo": 10,
          "student.name": "SASHVANTHIKKA RAJESH",
          "student.gender": "F",
          "student.parentName": "RAJESH",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f5656e07-048f-45c7-8955-a74144cbe468",
          "admissionId": "c51d53ef-3aad-46c4-bfa7-92ee11ce5af1",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2364"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2364",
          "registrationNumber": "9020642590043",
          "classNo": 10,
          "student.name": "SHARVESH V",
          "student.gender": "M",
          "student.parentName": "VINODH KUMAR B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0fb7baf8-2bd6-4f34-b66f-7cce6a5e2894",
          "admissionId": "1aa49632-1ff1-4a50-8950-b04e46248c34",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7314"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7314",
          "registrationNumber": "9020642590061",
          "classNo": 10,
          "student.name": "SIVANI D S",
          "student.gender": "F",
          "student.parentName": "DHARMAMURTHY A V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0e954a79-ce18-4573-a3bf-9d941d22dce6",
          "admissionId": "bedcb195-0687-44d9-b008-7053a7b994b0",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2379"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2379",
          "registrationNumber": "9020642590004",
          "classNo": 10,
          "student.name": "SRIYANT RAMPRAKASH",
          "student.gender": "M",
          "student.parentName": "RAMPRAKASH B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "19591d03-5867-4da6-97ef-79053af02301",
          "admissionId": "9ddef5bc-63d2-4b25-baaa-05a0e82bf870",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7379"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7379",
          "registrationNumber": "9020642590021",
          "classNo": 10,
          "student.name": "THANVANTH LENIN",
          "student.gender": "M",
          "student.parentName": "LENIN K K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b0749f28-1e6c-4b71-b5d8-6910ff84b384",
          "admissionId": "8879bd16-f2a4-4356-8a57-768052a54a98",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7374"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7374",
          "registrationNumber": "9020642590055",
          "classNo": 10,
          "student.name": "THIRIVICRAM G",
          "student.gender": "M",
          "student.parentName": "GOVINDARAJAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "47abc4f7-77e7-4c31-9ebe-99e6c44ddc60",
          "admissionId": "e560899c-6810-4f0f-9c35-6b6f50dfd6a7",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7416"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7416",
          "registrationNumber": "9020642590041",
          "classNo": 10,
          "student.name": "YOOGESH PAPPANNAN GUNASEKARAN",
          "student.gender": "M",
          "student.parentName": "GUNASEKARAN PAPPANNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "c2278bd1-55ee-4614-a667-33b91b0b5604",
          "programName": "ASPIRE - Four Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "batchCode": "COIFR259O01",
          "firstBatchId": "2dbb6d5d-154b-4519-a30b-90b8707abd36",
          "firstBatchCode": "COIFR259O01",
          "firstBatchName": "Omega-10A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f0991e2a-d784-42fa-ac69-8345243c1d53",
          "admissionId": "4de06242-9d3b-4577-a678-f1786c4a9e77",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6989"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6989",
          "registrationNumber": "9020642480020",
          "classNo": 11,
          "student.name": "AAKAASH ANESHPRABU",
          "student.gender": "M",
          "student.parentName": "ANESHPRABU SUBRAMANIAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9cb4266d-99ab-453a-ae2c-4e313a137aa9",
          "admissionId": "0c9c28dd-b779-45d8-aca2-003cfe3b1d84",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6985"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6985",
          "registrationNumber": "9020642480016",
          "classNo": 11,
          "student.name": "ARJUN VENKATESH",
          "student.gender": "M",
          "student.parentName": "VENKATESH BALASUBRAMANIAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "07ca8608-e33e-47d1-a142-bc5115e3f5d7",
          "admissionId": "12f428ef-e856-4b2e-81f8-a9edc0771440",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6855"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6855",
          "registrationNumber": "9020642480009",
          "classNo": 11,
          "student.name": "BARATH THIRUVENGADACHETTY HARIHARAN",
          "student.gender": "M",
          "student.parentName": "HARIHARAN THIRUVENGADACHETTY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e16115f7-a893-431c-950e-7a4c576e4082",
          "admissionId": "381e3fc7-fc49-432b-86ca-389eab55b91f",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6146"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6146",
          "registrationNumber": "9020642480015",
          "classNo": 11,
          "student.name": "DHAKSHRITH NANDHAGOPAL",
          "student.gender": "M",
          "student.parentName": "NANDHAGOPAL RANGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "31873327-a3e9-452a-8434-f6a3b495261b",
          "admissionId": "debb8c35-1e45-488b-b6a0-95f4a9d099b0",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3791"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3791",
          "registrationNumber": "9020642480006",
          "classNo": 11,
          "student.name": "HIRITHIC SELVAM KATHIRESAN",
          "student.gender": "M",
          "student.parentName": "KATHIRESAN SAMARASAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ab76b84f-05ce-4a58-8e05-987bb54c673d",
          "admissionId": "41bd381d-32e8-4168-bc64-61cba93f3b51",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6945"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6945",
          "registrationNumber": "9020642480004",
          "classNo": 11,
          "student.name": "KAVIN SRI VISHNU THULASIRAMAN",
          "student.gender": "M",
          "student.parentName": "THULASIRAMAN COIMBATORE KRISHNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0a1bc7ab-90db-4724-a0a1-197ef0d8448e",
          "admissionId": "0d1a74bf-3461-4bfe-8440-6621ffe28afa",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2731"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2731",
          "registrationNumber": "9020642480022",
          "classNo": 11,
          "student.name": "MITHUN SHANMUGASEKAR",
          "student.gender": "M",
          "student.parentName": "SHANMUGASEKAR CHANDRASEKARAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "68322d21-28d4-48a0-810d-c11ecf09d085",
          "admissionId": "39ee9bde-bad2-4935-848e-14d7d8da8396",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6869"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6869",
          "registrationNumber": "9020642480042",
          "classNo": 11,
          "student.name": "MUKILAN KRISHNAMOORTHI",
          "student.gender": "M",
          "student.parentName": "KRISHNAMOORTHI PALANISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9038fb7f-fa42-4e2d-8ff3-419306a77e19",
          "admissionId": "ffabbe64-f17f-491c-be64-3aba1912b2e2",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7957"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7957",
          "registrationNumber": "9062662480002",
          "classNo": 11,
          "student.name": "NISHAANT M",
          "student.gender": "M",
          "student.parentName": "MEENACHI SUNDARAM R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1163da54-ad8f-4a90-af97-22d5b42e1552",
          "admissionId": "e37345fb-9da6-4dbb-85bd-f657d49ea689",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6924"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6924",
          "registrationNumber": "9020642480005",
          "classNo": 11,
          "student.name": "NITHEESH SANKARASUBRAMANIAN VANUMAMALAI",
          "student.gender": "M",
          "student.parentName": "VANUMAMALAI SANKARASUBRAMANIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4756660a-1d5a-4846-8387-4d989bc31ffa",
          "admissionId": "7b438697-62cd-43ba-a430-3e5073019ca3",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4726"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4726",
          "registrationNumber": "9020642480017",
          "classNo": 11,
          "student.name": "NITHIN BALACHANDRAN",
          "student.gender": "M",
          "student.parentName": "BALACHANDRAN DURAISWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "db4ea663-9389-4403-85f4-a069d65d2290",
          "admissionId": "35816777-a8f5-44e5-8c1a-ba5ca4d44ab1",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6861"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6861",
          "registrationNumber": "9020642480040",
          "classNo": 11,
          "student.name": "SAMANYU BALU",
          "student.gender": "M",
          "student.parentName": "BALU KUPPUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "batchCode": "COITR268R01",
          "firstBatchId": "1d1349d6-0038-43bf-9547-668fab280ba8",
          "firstBatchCode": "COITR268R01",
          "firstBatchName": "RAMANUJAN-11A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bed2376d-869a-439f-aae9-3a1a3cd868b4",
          "admissionId": "31b0e97b-1868-46b0-a397-23746649a12d",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6921"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6921",
          "registrationNumber": "9020642480066",
          "classNo": 11,
          "student.name": "AARIYA PALANIVEL RAJAN",
          "student.gender": "M",
          "student.parentName": "PALANIVEL RAJAN SUBRAMANIAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "45edc13d-4e1a-43cc-9e12-ed02273ff01f",
          "admissionId": "ef4705c8-c1f7-41bc-8005-e84d71503564",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6903"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6903",
          "registrationNumber": "9020642480034",
          "classNo": 11,
          "student.name": "ABHINAV MOHAN KUMAR",
          "student.gender": "M",
          "student.parentName": "MOHAN KUMAR SETHULAKSHMANAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bc80503a-b6f9-4b56-9513-4190d90707bc",
          "admissionId": "bd9d3535-bd68-4199-9fd5-5f47486a357c",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8086"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8086",
          "registrationNumber": "9020642480076",
          "classNo": 11,
          "student.name": "ABINAV S",
          "student.gender": "M",
          "student.parentName": "SURESH P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c7ec666b-6fa1-450c-a31a-bf8ed88347db",
          "admissionId": "77952df2-c4ac-47e8-8b09-e1fbe8d715ad",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6907"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6907",
          "registrationNumber": "9020642480035",
          "classNo": 11,
          "student.name": "ABINAYAA VENKATAKRISHNAN",
          "student.gender": "F",
          "student.parentName": "VENKATAKRISHNAN PALANISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b5497aec-9a3e-47fc-8b8c-c933e1d3f40f",
          "admissionId": "aa889686-f2ed-4ff2-b167-8e05f9004662",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2690"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2690",
          "registrationNumber": "9020642480065",
          "classNo": 11,
          "student.name": "ARUNCHUTHAN SHANTHAKUMAR",
          "student.gender": "M",
          "student.parentName": "SHANTHAKUMAR SUBRAMANIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "45eb0ba5-a4db-4e04-b7cc-eabb0045f017",
          "admissionId": "1e5e2e56-a745-4859-b608-446255f65310",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8129"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8129",
          "registrationNumber": "1110642680032",
          "classNo": 11,
          "student.name": "BHUVANESH S",
          "student.gender": "M",
          "student.parentName": "SENTHILKUMAR D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a4df04d2-a472-4ec9-b5a5-de654050c0dd",
          "admissionId": "70560a7a-cfcc-479d-b345-4b2fc66e79c5",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4729"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4729",
          "registrationNumber": "9020642480071",
          "classNo": 11,
          "student.name": "DARSHAN KAARTHIK GOKULAKRISHNAN",
          "student.gender": "M",
          "student.parentName": "GOKULAKRISHNAN THIRUGNANAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a153b8ff-8221-4466-acc2-2f10672582a5",
          "admissionId": "9394a8bc-3fe0-45bd-bd37-eb2cd3597069",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2763"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2763",
          "registrationNumber": "9020642480031",
          "classNo": 11,
          "student.name": "DEVADARSHAAN INBASAKAR",
          "student.gender": "M",
          "student.parentName": "INBASAKAR VARATHARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0224efcd-7976-42dd-8006-85debabbffe1",
          "admissionId": "c334bbae-6abe-4406-9bce-b9aa3cdf3f16",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8115"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8115",
          "registrationNumber": "9020642480077",
          "classNo": 11,
          "student.name": "DHIBESH S M",
          "student.gender": "M",
          "student.parentName": "MURUGARAJ S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "569fc90b-a4d8-4a19-b8e8-b77668b27bed",
          "admissionId": "91753754-d102-4315-a9df-65792d67fd80",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6952"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6952",
          "registrationNumber": "9020642480044",
          "classNo": 11,
          "student.name": "DHIVYESH ARULANANTHAN",
          "student.gender": "M",
          "student.parentName": "ARULANANTHAN THANJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3abc7599-22a3-4f4a-afcc-e0334bdedbe8",
          "admissionId": "8de757f1-3ad9-48cc-801b-e7f866f2d192",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6960"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6960",
          "registrationNumber": "9020642480019",
          "classNo": 11,
          "student.name": "DIYA PRABU",
          "student.gender": "F",
          "student.parentName": "PRABU KALIAPPAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "71cd127b-0d81-4cfb-b646-53a4cf4d786f",
          "admissionId": "5e59b75b-df55-4529-aa37-17a8e157369e",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5051"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5051",
          "registrationNumber": "9020642480051",
          "classNo": 11,
          "student.name": "HARISUDARSHAN SOMANUR MUTHUKRISHNAN",
          "student.gender": "M",
          "student.parentName": "MUTHUKRISHNAN CHINNAPPAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f1aace19-166c-4ca7-88c1-5735f06cbfcd",
          "admissionId": "9b210308-2040-4c09-9013-84a2efaa2e95",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7972"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7972",
          "registrationNumber": "1110642680025",
          "classNo": 11,
          "student.name": "ILAN SENTHIL",
          "student.gender": "M",
          "student.parentName": "SENTHILKUMARAN KULANDAIVELAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "163afdf6-0d8e-48ce-811a-2d0446afa57f",
          "admissionId": "15334743-4d51-4ba6-aedc-0999d6c9ff05",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7067"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7067",
          "registrationNumber": "9020642480089",
          "classNo": 11,
          "student.name": "JAYANTH KRISHNAA A R",
          "student.gender": "M",
          "student.parentName": "ARUNKUMAR GOPAL",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6678552f-4473-4e24-9121-af1ceba8f1a7",
          "admissionId": "2faedf83-6114-4354-ac3a-814a8aec83c7",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6930"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6930",
          "registrationNumber": "9020642480043",
          "classNo": 11,
          "student.name": "KEVIN VINOD",
          "student.gender": "M",
          "student.parentName": "VINOD GOVINDHARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5000e9eb-bb27-4f78-bd63-b6fd967b6164",
          "admissionId": "a1dfc51e-4b78-42de-be3a-e89739e33635",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8013"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8013",
          "registrationNumber": "1110642680026",
          "classNo": 11,
          "student.name": "NIPUN NARENDRAN",
          "student.gender": "M",
          "student.parentName": "NARENDRAN BHOJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a8e62f27-92dd-40c3-87db-7e0a288832e8",
          "admissionId": "e83cb09b-d0e6-4d0c-a301-8b8a1974701c",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8006"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8006",
          "registrationNumber": "9020642480067",
          "classNo": 11,
          "student.name": "NIRANJANA SHREE S",
          "student.gender": "F",
          "student.parentName": "SRINIVASAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7a27f99e-6903-4973-8c97-6ecf66db6869",
          "admissionId": "172bc4de-72ca-495e-b657-d7c214b2260a",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2735"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2735",
          "registrationNumber": "1110642680063",
          "classNo": 11,
          "student.name": "NITHIK SAI VEDIK SHAMILI RAM MOHAN",
          "student.gender": "M",
          "student.parentName": "RAM MOHAN DEVARAJULU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4f8ead82-4235-4cdb-8e70-a1612277fdb3",
          "admissionId": "935d46ce-eb3c-408e-82c7-9b35221ed4c9",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5054"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5054",
          "registrationNumber": "9020642480029",
          "classNo": 11,
          "student.name": "PRANAV ESWARAN",
          "student.gender": "M",
          "student.parentName": "ESWARAN ANGAPPAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e53d3924-e4a3-4a2d-90d4-60c563b84e17",
          "admissionId": "80ae4bbd-8a51-47bf-9615-4a508c255ca4",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7000"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7000",
          "registrationNumber": "9020642480021",
          "classNo": 11,
          "student.name": "PRAVITH YUVAN SURESH KUMAR",
          "student.gender": "M",
          "student.parentName": "SURESH KUMAR PALANISAMY RASIAPPAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "53748c3b-92a2-4d3a-99b1-9cb9767d9bc5",
          "admissionId": "5437fcee-acc4-483a-867b-5ed4a3d952ae",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7996"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7996",
          "registrationNumber": "1110642680029",
          "classNo": 11,
          "student.name": "RAAGESH RAJ",
          "student.gender": "M",
          "student.parentName": "MAGESH GANESAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0823f290-4db9-4d02-a2bd-68ed4b1f8c96",
          "admissionId": "10ff8327-c398-4510-b661-df0ade985905",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4540"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4540",
          "registrationNumber": "9020642480032",
          "classNo": 11,
          "student.name": "RITUPARNA K L",
          "student.gender": "F",
          "student.parentName": "KALIMUTHU KALAIMANICKAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "555d2392-a6dc-4ce3-9cb8-6dcec80e9232",
          "admissionId": "85e2a718-b518-4c7d-a4b8-e188b81cea23",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8155"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8155",
          "registrationNumber": "1110642680040",
          "classNo": 11,
          "student.name": "ROSHAN ASHIEK J",
          "student.gender": "M",
          "student.parentName": "JAVID M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1a0b7a7c-d4fa-4f8b-b59b-e5e5afd6c75b",
          "admissionId": "66119d73-1ed1-48cf-980f-04ccac8aee61",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6996"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6996",
          "registrationNumber": "9020642480012",
          "classNo": 11,
          "student.name": "SAI ARJUN PRASANNA KUMAR",
          "student.gender": "M",
          "student.parentName": "PRASANNA KUMAR MARIMUTHU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7194c0c8-d1ff-488e-9f1b-6b2dc88a54e1",
          "admissionId": "05621aad-75c8-4049-9c15-941e78335f83",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4184"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4184",
          "registrationNumber": "9062662480016",
          "classNo": 11,
          "student.name": "SAI SANJNA SHRIKANTH",
          "student.gender": "F",
          "student.parentName": "SHRIKANTH DURAISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "675781a3-dadd-4de3-a6fa-84c2fbd5eb71",
          "admissionId": "a85155ed-bdff-49f9-8836-ddca7a9e9bb0",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7882"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7882",
          "registrationNumber": "1110642680031",
          "classNo": 11,
          "student.name": "SAKTHI KIRUSH R",
          "student.gender": "M",
          "student.parentName": "RATHINAM M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "96dac5ee-53ff-426f-bbc3-18cede91a876",
          "admissionId": "46c89596-39c3-4afb-905e-2a97e1162525",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2740"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2740",
          "registrationNumber": "9020642480073",
          "classNo": 11,
          "student.name": "SARVESH PRABHU",
          "student.gender": "M",
          "student.parentName": "PRABHU NARAYANASAMI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7f5f60e5-507f-4142-ab7b-6dc36b49386a",
          "admissionId": "ea82b62c-87aa-495b-a45b-cd6085a410fd",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8162"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8162",
          "registrationNumber": "1110642680051",
          "classNo": 11,
          "student.name": "SHARVESH S P",
          "student.gender": "M",
          "student.parentName": "PARAMAGURU PACHIYANNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ad65e48c-0087-411d-a7be-b9c95a215da9",
          "admissionId": "b5205b04-5a9c-4261-a868-1935a716614a",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8135"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8135",
          "registrationNumber": "1110642680053",
          "classNo": 11,
          "student.name": "SIDHVIN DEV R",
          "student.gender": "M",
          "student.parentName": "RAMESH MUTHUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "79a76324-b88b-4099-8285-448886735175",
          "admissionId": "d18db949-dd6e-42c5-abfe-f0200fedabe3",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2672"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2672",
          "registrationNumber": "9020642480001",
          "classNo": 11,
          "student.name": "SRIHARI VIJAYANATHAN",
          "student.gender": "M",
          "student.parentName": "VIJAYANATHAN PRABHAKARAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5a68c76f-401f-4f9e-8b4b-655b4c98d727",
          "admissionId": "ac917447-2dc1-4fe6-a0af-b6b2055cebc9",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6900"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6900",
          "registrationNumber": "9020642480050",
          "classNo": 11,
          "student.name": "SUTHEEKSHAN ARUNKUMAR",
          "student.gender": "M",
          "student.parentName": "ARUNKUMAR RAJU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "adcd4d3b-95a9-45b1-8f27-762f66cb66fb",
          "admissionId": "9897fe7d-3298-4e49-8976-2d9b7afcf163",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7060"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7060",
          "registrationNumber": "9020642480085",
          "classNo": 11,
          "student.name": "VINUSHKAA PALANISWAMY SUNDARARAJ",
          "student.gender": "F",
          "student.parentName": "PALANISWAMY SUNDARARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d883ca24-4ffd-4832-8b74-c2a85424b297",
          "admissionId": "81dc7004-9fdc-423b-afdd-252eb3283a34",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2710"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2710",
          "registrationNumber": "9020642480092",
          "classNo": 11,
          "student.name": "VISHNU VARNAA LAKSHMINARAYANAN",
          "student.gender": "M",
          "student.parentName": "LAKSHMINARAYANAN KONDASAMY NAIDU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "91e936cf-1b46-4a58-be5a-4032a2d7c25f",
          "admissionId": "36bb110d-2ea3-4322-8a44-b33d957d0593",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6906"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6906",
          "registrationNumber": "9020642480070",
          "classNo": 11,
          "student.name": "VISHNURAM CHANDRASEKAR",
          "student.gender": "M",
          "student.parentName": "CHANDRASEKAR RAJAGOPAL",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "dd5cf74e-0d0c-4668-a658-07f52c36775e",
          "admissionId": "5afea149-de6b-4090-aa72-1deabcb7c0b4",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7997"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7997",
          "registrationNumber": "1110642680009",
          "classNo": 11,
          "student.name": "YUKADHAKSHINA U S",
          "student.gender": "F",
          "student.parentName": "SELVARAJ P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "696f241d-67f4-4138-a439-9cb9498c4b6d",
          "admissionId": "fbfd8e34-59ec-48d5-b5bf-607dff9eb798",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2737"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2737",
          "registrationNumber": "1110642680024",
          "classNo": 11,
          "student.name": "ZIEGEN DAVIS JOSHUA",
          "student.gender": "M",
          "student.parentName": "JOSHUA MOSES",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "batchCode": "COITR268K01",
          "firstBatchId": "2f0772af-c18f-4903-92d9-4794dabb334c",
          "firstBatchCode": "COITR268K01",
          "firstBatchName": "APJ KALAM-11A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7339b29b-d1ec-4d6b-8386-6a6a6b60691e",
          "admissionId": "e50f1bdc-1190-468d-83af-474e0db3610e",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8031"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8031",
          "registrationNumber": "1110642680018",
          "classNo": 11,
          "student.name": "AADHI SHANKAR M A",
          "student.gender": "M",
          "student.parentName": "ARUNSHANKAR G M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "16a31fc0-0f5d-4ba9-b823-3ba6751013e6",
          "admissionId": "51c4836a-e084-4572-9606-0b0c58762579",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8087"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8087",
          "registrationNumber": "1110642680022",
          "classNo": 11,
          "student.name": "AAKASH S",
          "student.gender": "M",
          "student.parentName": "SENTHILKUMAR N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6f5f0a53-1d75-44a4-a28d-c56c0e1816e4",
          "admissionId": "3ff1003b-3dc1-4ed7-ac8c-c5f218972feb",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7002"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7002",
          "registrationNumber": "9020642480052",
          "classNo": 11,
          "student.name": "ABHINAV RAVISANKAR",
          "student.gender": "M",
          "student.parentName": "RAVISANKAR THIRUMALAISAMY THONDAMUTHUR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c776e045-787e-4e9e-9ca5-5619dc4c8d02",
          "admissionId": "953dec48-6386-42f6-a6de-c7f815b5fa87",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8096"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8096",
          "registrationNumber": "1110642680039",
          "classNo": 11,
          "student.name": "ADVIK VIJAY",
          "student.gender": "M",
          "student.parentName": "VIJAYAKUMAR GANAPATHY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "31f3abe1-00c7-4d9a-87a3-346f1c0bc88d",
          "admissionId": "1a302344-0aa0-4b1b-b905-33176d03eab1",
          "createdAt": "2026-11-12T06:35:16.307Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5853"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5853",
          "registrationNumber": "1110642680023",
          "classNo": 11,
          "student.name": "AJAY RAVIKUMAR",
          "student.gender": "M",
          "student.parentName": "RAVIKUMAR NACHIMUTHU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9bf86b01-05e2-4c25-834f-88a946ff9084",
          "admissionId": "e04dadcb-c6fc-4948-a766-8f64d1d80ee4",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8148"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8148",
          "registrationNumber": "1110642680042",
          "classNo": 11,
          "student.name": "ANTHIKA RAMESH",
          "student.gender": "F",
          "student.parentName": "RAMESH P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f882dba1-f0bc-4173-b8d9-f618e7c52f85",
          "admissionId": "67ddcbab-ddba-489e-a517-7c16b59a778e",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7906"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7906",
          "registrationNumber": "9062662480006",
          "classNo": 11,
          "student.name": "ANUSH AATHITHYAN K",
          "student.gender": "M",
          "student.parentName": "KARTHIKEYAN K S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1bdb5f8f-1c14-436a-a37a-901e864daf6e",
          "admissionId": "fcfb59df-98d8-420f-9db5-735bc2c5587c",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8059"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8059",
          "registrationNumber": "1110642680060",
          "classNo": 11,
          "student.name": "CIBISARAN K",
          "student.gender": "M",
          "student.parentName": "KANNAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "31405514-8b22-45cf-a142-287dc1bbdad3",
          "admissionId": "2665303b-ab08-470d-b095-35803a57160f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7956"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7956",
          "registrationNumber": "1110642680033",
          "classNo": 11,
          "student.name": "DHARSHIKA S",
          "student.gender": "F",
          "student.parentName": "SENTHILKUMAR G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "927f57cc-5058-4153-8893-7d485c9841f9",
          "admissionId": "5efadcab-fcd9-402d-ad1e-62b3c19ac784",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4366"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4366",
          "registrationNumber": "9020642480030",
          "classNo": 11,
          "student.name": "INTHRESH ESWAR RAJESH KUMAR",
          "student.gender": "M",
          "student.parentName": "RAJESH KUMAR VEERASIGAMANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "46ec6095-410d-4a88-9b53-85a06e2f8452",
          "admissionId": "6032a4f3-62ad-49f0-a649-e2166329c6a3",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8100"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8100",
          "registrationNumber": "9020642480094",
          "classNo": 11,
          "student.name": "JAY ADITHYAA B",
          "student.gender": "M",
          "student.parentName": "BALAJI S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "cffbd2ab-84e1-48ec-8266-47917cea8aab",
          "admissionId": "40cb45bb-64fd-440e-899d-b23751b00628",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6922"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6922",
          "registrationNumber": "9020642480053",
          "classNo": 11,
          "student.name": "JAYAN ATHMITHAN BALA KAARTHIK",
          "student.gender": "M",
          "student.parentName": "BALA KAARTHIK VEERAPPAN BALASUBRAMANIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "24ff7f64-3dcc-44e7-8ce3-b65d55e51855",
          "admissionId": "8a9429bb-67b8-46ff-ad49-a451c51bbf20",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7079"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7079",
          "registrationNumber": "9020642480079",
          "classNo": 11,
          "student.name": "JAYYWIN MANI SIVAKUMAR",
          "student.gender": "M",
          "student.parentName": "SIVAKUMAR PAPUSAMY MANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "828b77fc-c379-4ed5-875c-316f4be6100b",
          "admissionId": "54c4c4a3-9420-4f4e-a3b1-bc88f2133658",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8081"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8081",
          "registrationNumber": "1110642680010",
          "classNo": 11,
          "student.name": "KARTHICK M",
          "student.gender": "M",
          "student.parentName": "MURUGANANTHAM R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "08c95167-8305-47aa-be05-063d4a202d6b",
          "admissionId": "a1c091f1-07e6-4d6c-9a46-e644816ef985",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8145"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8145",
          "registrationNumber": "1110642680001",
          "classNo": 11,
          "student.name": "KRITHICK RAJ S",
          "student.gender": "M",
          "student.parentName": "SENTHILKUMAR P V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "76e72ef2-fda6-4713-8dd7-f8cbd87968b3",
          "admissionId": "77dc0e36-e3fb-4998-badc-1eda0100a1ea",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7981"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7981",
          "registrationNumber": "1110642680011",
          "classNo": 11,
          "student.name": "MANISH SANKAR T",
          "student.gender": "M",
          "student.parentName": "THIRUMALAISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7f5b1900-0288-47f8-8310-537e5d8625a9",
          "admissionId": "37c1efd7-2c0e-4e89-b793-53653749fd7c",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2722"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2722",
          "registrationNumber": "9020642480088",
          "classNo": 11,
          "student.name": "MEHUL VADASITHUR SADHANAND",
          "student.gender": "M",
          "student.parentName": "SADHANAND VADASITHUR PALANISWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "cdb50771-6691-46bb-92f0-8eb67aa50c59",
          "admissionId": "b6da98f1-643a-4cf2-b9ae-529d6fae4c1c",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8058"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8058",
          "registrationNumber": "9020642480074",
          "classNo": 11,
          "student.name": "MITHUN S",
          "student.gender": "M",
          "student.parentName": "SENTHIL KUMAR N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6a1397b6-3477-47db-bdeb-35365cb78b36",
          "admissionId": "6fa97c3f-1faf-443d-b28e-f6cac6e07c0a",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2730"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2730",
          "registrationNumber": "1110642680021",
          "classNo": 11,
          "student.name": "NEHA SANJEEVKUMAR",
          "student.gender": "F",
          "student.parentName": "SANJEEVKUMAR SHANMUGAVADIVEL",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d297c9f3-2d23-45fd-8c97-4a28bc00cdd7",
          "admissionId": "ea7f6a02-b536-47a8-9d45-83138ac5e08b",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8147"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8147",
          "registrationNumber": "1110642680056",
          "classNo": 11,
          "student.name": "NIGILESH N R",
          "student.gender": "M",
          "student.parentName": "RAMARAAJAN N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b9236c0d-01d1-4a63-8cb6-c1aaf375a3a2",
          "admissionId": "6e10b1d3-cb8f-4944-bbe3-4ca0743d2bec",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7065"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7065",
          "registrationNumber": "9020642480080",
          "classNo": 11,
          "student.name": "NIKHITHAN MAHESH KUMAR",
          "student.gender": "M",
          "student.parentName": "MAHESH KUMAR VISWANATHAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "77645ff4-63cc-47ea-ae90-86618b6b0a88",
          "admissionId": "d3530a79-7878-4ab3-bad4-28c166da246f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8146"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8146",
          "registrationNumber": "1110642680054",
          "classNo": 11,
          "student.name": "NITHILEESH N R",
          "student.gender": "M",
          "student.parentName": "RAMARAAJAN N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "21f3f3ba-f8f9-4daa-9a7b-67ca74d82a15",
          "admissionId": "4a898283-54bd-450f-8243-82100e7bc371",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8084"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8084",
          "registrationNumber": "1110642680006",
          "classNo": 11,
          "student.name": "PRANAV VISHNU KANTH",
          "student.gender": "M",
          "student.parentName": "VISHNU KANTH V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "43a14328-18ff-4135-8914-63fdafe4501e",
          "admissionId": "76238d78-733b-445d-a07f-8e9cfb4f9c17",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6879"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6879",
          "registrationNumber": "9020642480003",
          "classNo": 11,
          "student.name": "PRANEETKRISHNA KAPILAN",
          "student.gender": "M",
          "student.parentName": "KAPILAN CHINNASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "442d43e4-49d8-44ae-96c0-adf9db67dbd8",
          "admissionId": "cd30541a-cb68-4141-9f16-53e0e904f821",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7954"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7954",
          "registrationNumber": "9020642480058",
          "classNo": 11,
          "student.name": "RAGHAV NARAYANAN",
          "student.gender": "M",
          "student.parentName": "NARAYANAN MAHALINGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9ecf2aed-afab-4346-ba6f-aca5daee86cb",
          "admissionId": "6e1e77f1-f7e2-4be3-9914-8278cd59f8ae",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7920"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7920",
          "registrationNumber": "1110642680014",
          "classNo": 11,
          "student.name": "RITHISH NOBEL B",
          "student.gender": "M",
          "student.parentName": "BAKYARAJ S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "884e04b2-9a2a-4aaf-9c67-4714749214c3",
          "admissionId": "e6fed2eb-3e54-4b8b-9a52-ae3169524671",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8089"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8089",
          "registrationNumber": "1110642680007",
          "classNo": 11,
          "student.name": "SAIPRABHAV S",
          "student.gender": "M",
          "student.parentName": "SANTHALINGAM P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b36ec256-df5b-4330-b948-a267248dea9b",
          "admissionId": "3b20fb5d-4080-4dfe-b9c5-aed3c760b8f5",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5652"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5652",
          "registrationNumber": "9020642480082",
          "classNo": 11,
          "student.name": "SHAKTHI VAKESWARAN",
          "student.gender": "M",
          "student.parentName": "VAKESWARAN VENKATASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0b5147dd-d535-46c1-b8b7-e8061aa51e69",
          "admissionId": "320c348c-f4f0-44ce-bf98-aba0885fe79e",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6884"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6884",
          "registrationNumber": "9020642480048",
          "classNo": 11,
          "student.name": "SHANKAR RAJA CHITRAPPOO",
          "student.gender": "M",
          "student.parentName": "RAJA CHITRAPPOO KUMAR LEEPO",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "569bd773-a51c-45a4-9ca0-675ccfd4ae3a",
          "admissionId": "b0b8bfb6-b33f-4b59-b489-26b37b8639b7",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8144"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8144",
          "registrationNumber": "1110642680045",
          "classNo": 11,
          "student.name": "SUJAI S P",
          "student.gender": "M",
          "student.parentName": "SARAVANAN K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c8bb8a03-6082-44fb-b864-e71000ce5777",
          "admissionId": "bdda702a-9391-45af-84e7-41010fe65db1",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7910"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7910",
          "registrationNumber": "1110642680030",
          "classNo": 11,
          "student.name": "THANISHKA A",
          "student.gender": "F",
          "student.parentName": "ASHOKBALAJI R M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5083967e-88e7-4617-95b9-f00922305db0",
          "admissionId": "0d5cacd0-87e8-44fd-a58c-cb9f6b465f3e",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8163"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8163",
          "registrationNumber": "1110642680046",
          "classNo": 11,
          "student.name": "THARUN VARSHAN B K",
          "student.gender": "M",
          "student.parentName": "BALASUBRAMANIAM S R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1147ea9f-1f29-4983-b04a-5eeb460d0c77",
          "admissionId": "be9c0849-875b-4e67-9e5f-641861ba2d09",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7992"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7992",
          "registrationNumber": "1110642680012",
          "classNo": 11,
          "student.name": "VARSHIKA S",
          "student.gender": "F",
          "student.parentName": "SELVARAJ M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5bd6246b-cd11-4e64-befe-eb48e93e9e3b",
          "admissionId": "8e6f70b6-4825-47ca-8146-797566272912",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5314"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5314",
          "registrationNumber": "9020642480046",
          "classNo": 11,
          "student.name": "VARSHITHA CHARANYA KARTHI",
          "student.gender": "F",
          "student.parentName": "KARTHI NATARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d79d7f1f-a1bd-4902-ab3e-96e35d44cc50",
          "admissionId": "e52af621-7732-43ff-94f5-42afce8b7d8f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8151"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8151",
          "registrationNumber": "1110642680041",
          "classNo": 11,
          "student.name": "VIBHUL PRATHYUSH G P",
          "student.gender": "M",
          "student.parentName": "GANESAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d04e8df1-4f85-44e3-be1e-bd4c68c30a0b",
          "admissionId": "ed61ef8c-02d0-40ad-801b-5f99de27552b",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8165"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8165",
          "registrationNumber": "1110642680057",
          "classNo": 11,
          "student.name": "VIKUNTHAN SHRI P",
          "student.gender": "M",
          "student.parentName": "PARAMESWARAN L",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "batchCode": "COITR268V01",
          "firstBatchId": "4d8596f9-72d0-4f73-ad3a-933137465f57",
          "firstBatchCode": "COITR268V01",
          "firstBatchName": "CV RAMAN-11A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6895368e-3d5e-47fa-a3a1-69e502bc6876",
          "admissionId": "5876cc97-b334-4085-93ad-4d6246783839",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3983"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3983",
          "registrationNumber": "9020642480063",
          "classNo": 11,
          "student.name": "AADHAV SARVESH SENTHILNATHAN",
          "student.gender": "M",
          "student.parentName": "SENTHILNATHAN DHAMODHARAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "01fb6ca1-732e-42d8-89b6-faf1bb7e507c",
          "admissionId": "ce5c4345-b43c-4764-af33-9d5bb87ecae3",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8104"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8104",
          "registrationNumber": "1110642680047",
          "classNo": 11,
          "student.name": "ADARSH P D",
          "student.gender": "M",
          "student.parentName": "PERIYASAMY T",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "286c12a4-19eb-4e41-8666-95c72d38498a",
          "admissionId": "40f49405-d031-4ed3-8160-0c041838d60a",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8108"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8108",
          "registrationNumber": "1110642680005",
          "classNo": 11,
          "student.name": "AGALYA M",
          "student.gender": "F",
          "student.parentName": "MUTHUKUMAR K S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "36048534-55d1-4345-b6a8-3ed8842f4a4f",
          "admissionId": "77bf8f88-a77f-4575-8020-32797d120e9d",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6888"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6888",
          "registrationNumber": "9020642480024",
          "classNo": 11,
          "student.name": "ANANYA SIVASHANMUGAVEL",
          "student.gender": "F",
          "student.parentName": "SIVASHANMUGAVEL MASILAMANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7345aaf4-e382-486b-8c37-df2095b61cad",
          "admissionId": "9c717b79-1245-41c3-8730-de9e1f913fe9",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6889"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6889",
          "registrationNumber": "9020642480037",
          "classNo": 11,
          "student.name": "DHAKKSHIN RAGHAV PALANISAMY",
          "student.gender": "M",
          "student.parentName": "PALANISAMY CHAIRMANDURAI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "920e9196-522a-4eec-957c-55d9ed5fe40a",
          "admissionId": "75f2509f-f7ca-49bc-a374-53e9ec0f0ea5",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7994"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7994",
          "registrationNumber": "1110642680059",
          "classNo": 11,
          "student.name": "JANAV RAVI",
          "student.gender": "M",
          "student.parentName": "RAVI KANNIAH",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b732c885-59e1-4d24-9082-28c7a0c3484a",
          "admissionId": "4bdfba43-6130-432f-baaa-22c539c28b8c",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8098"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8098",
          "registrationNumber": "1110642680016",
          "classNo": 11,
          "student.name": "KANIMOZHI R A A",
          "student.gender": "F",
          "student.parentName": "ANAND RAMASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6a3ec7dc-96a1-4a13-87da-2342e09fb216",
          "admissionId": "9e18a01d-afa5-4007-a8b8-94d0b4577788",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7898"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7898",
          "registrationNumber": "1110642680017",
          "classNo": 11,
          "student.name": "KAVIN R S",
          "student.gender": "M",
          "student.parentName": "SARAVANAN M R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4bf62d6d-7e66-4519-b084-870dbd45b423",
          "admissionId": "89ac6e93-7c84-4a8d-b249-c7f4af42cc00",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5690"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5690",
          "registrationNumber": "1110642680062",
          "classNo": 11,
          "student.name": "LAYASREE DHINAKARAN",
          "student.gender": "F",
          "student.parentName": "DHINAKARAN DHEENADAYALAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ee84c863-1a59-4547-b3f2-a5ee26220ea3",
          "admissionId": "43f60665-11bb-4982-9e6b-2abc729a6b60",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8109"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8109",
          "registrationNumber": "1110642680003",
          "classNo": 11,
          "student.name": "LOKA JANANI V",
          "student.gender": "F",
          "student.parentName": "VIJESWARAN D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "91f58813-9a99-4379-894f-8d74ae031a22",
          "admissionId": "29db2282-7135-4737-9566-71f39dfde426",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7909"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7909",
          "registrationNumber": "1110642680020",
          "classNo": 11,
          "student.name": "LOSITH VARSHAN R",
          "student.gender": "M",
          "student.parentName": "RANADIVE R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a097a5a3-9fec-4547-9afa-3f80134c516c",
          "admissionId": "67ed4ddd-e0f9-4b1f-8dee-b25881af5552",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7970"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7970",
          "registrationNumber": "9020642480060",
          "classNo": 11,
          "student.name": "MADHU PRAGADEESH K",
          "student.gender": "M",
          "student.parentName": "KALYANA SUNDARAM K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "535b2dca-5180-4c30-bf7c-9776e2743062",
          "admissionId": "3ef486bf-d8c1-44e6-9bee-7595c8abd1c8",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7893"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7893",
          "registrationNumber": "1110642680035",
          "classNo": 11,
          "student.name": "NITTHIL KARTHEESAN",
          "student.gender": "M",
          "student.parentName": "KARTHEESAN G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bc792889-9aa3-4bea-b53c-19de8673b2f0",
          "admissionId": "b612df93-e1e9-46dd-ac71-b660023b5ca4",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7988"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7988",
          "registrationNumber": "1110642680028",
          "classNo": 11,
          "student.name": "PRADAKSHANA M",
          "student.gender": "F",
          "student.parentName": "MAGES KUMAR K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "065684df-0cb7-48e1-afd6-5ce4301449b4",
          "admissionId": "420693ea-671a-4279-98c3-7055273e2785",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5777"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5777",
          "registrationNumber": "REG-5777",
          "classNo": 11,
          "student.name": "RAKSHITHA SENTHILKUMAR USHA",
          "student.gender": "F",
          "student.parentName": "SENTHILKUMAR CHANDRASEKARAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c2dc07ae-6afe-4a72-908e-947aec2cce82",
          "admissionId": "c94f1c5c-f941-4aba-8a52-e76ecf993f57",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7914"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7914",
          "registrationNumber": "1110642680049",
          "classNo": 11,
          "student.name": "RITUVARSHINI T",
          "student.gender": "F",
          "student.parentName": "THANGAMANI MUTHUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c62e89ae-d794-4d4c-aac4-90d81d0150dd",
          "admissionId": "1edaf034-45ef-4dbe-ae52-27df69e2e112",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5050"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5050",
          "registrationNumber": "9020642480056",
          "classNo": 11,
          "student.name": "SAMPRINCE AMBROSE KANNAIAH",
          "student.gender": "M",
          "student.parentName": "AMBROSE KANNAIAH PRINCE JAYASEELAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2a31fc6c-1377-44f7-a9e6-a7ce46583b33",
          "admissionId": "41a4da4f-b189-414b-9bda-1a6c85c21978",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8154"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8154",
          "registrationNumber": "1110642680048",
          "classNo": 11,
          "student.name": "SARVESH S",
          "student.gender": "M",
          "student.parentName": "SENTHILKUMAR M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "33b2db47-73a6-4acf-ac57-e914a1e1cc9d",
          "admissionId": "9aea4abf-3836-4f16-985d-06c32b4ad889",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8083"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8083",
          "registrationNumber": "1110642680037",
          "classNo": 11,
          "student.name": "SASTI RAM T",
          "student.gender": "M",
          "student.parentName": "TAMILARASAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "efb338b7-9ea2-44e5-a381-37a245b24c37",
          "admissionId": "5f728ad3-3e4b-40be-906e-2ae75bbf84f3",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8056"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8056",
          "registrationNumber": "1110642680050",
          "classNo": 11,
          "student.name": "SHARAN K",
          "student.gender": "M",
          "student.parentName": "KATHIRESAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "566bfdec-6213-4097-917b-e8a57080aa75",
          "admissionId": "3548e0f2-7af9-4c0d-a210-4533b831ebc4",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8094"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8094",
          "registrationNumber": "1110642680019",
          "classNo": 11,
          "student.name": "SHRIHARI S",
          "student.gender": "M",
          "student.parentName": "SENTHILKUMAR R S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "10528f10-628b-4f1e-b6de-d4aab6899abe",
          "admissionId": "e6ec7c4c-b83b-4ae6-82e5-f8c398238ef3",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8024"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8024",
          "registrationNumber": "1110642680052",
          "classNo": 11,
          "student.name": "SHRIRAM B",
          "student.gender": "M",
          "student.parentName": "BALAJI R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f85281bf-e99d-4e50-b8fc-521df97a5ce5",
          "admissionId": "0aa62da6-9718-44f9-9969-cfe928c35321",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7866"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7866",
          "registrationNumber": "1110642680027",
          "classNo": 11,
          "student.name": "SRI NIVRITHI B",
          "student.gender": "F",
          "student.parentName": "BALAJI R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1ab3e253-c049-490e-9353-2a730a78b0d2",
          "admissionId": "a626ca25-46d1-40e4-90f2-8a0c726e0028",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8168"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8168",
          "registrationNumber": "1110642680002",
          "classNo": 11,
          "student.name": "SRI SUDEENTH P V",
          "student.gender": "M",
          "student.parentName": "PONVEL SARAVANAN T P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "00b98863-e847-4bac-95ed-906da0484c2e",
          "admissionId": "8724b725-6b9a-4761-9e9d-95556574056f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8029"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8029",
          "registrationNumber": "1110642680013",
          "classNo": 11,
          "student.name": "SWAMINATHAN R",
          "student.gender": "M",
          "student.parentName": "RAMASUBRAMANIAM R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3a6867cc-cd41-48be-b921-fc13b76b3267",
          "admissionId": "d3c4c27e-c5c9-4655-bed6-02ff9d8a8d11",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8093"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8093",
          "registrationNumber": "1110642680008",
          "classNo": 11,
          "student.name": "THEKSANAA S",
          "student.gender": "F",
          "student.parentName": "SATHISH KUMAR S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b8068829-ba4e-4a73-9af5-5aefcde30081",
          "admissionId": "7abb6740-dc0d-4921-b2df-d0ce70e25624",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8066"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8066",
          "registrationNumber": "1110642680061",
          "classNo": 11,
          "student.name": "THILAK BAABU B K",
          "student.gender": "M",
          "student.parentName": "KATHIRAVAN B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "617bbea1-0525-4e08-80b9-24577b212e3d",
          "admissionId": "3cbee38f-4fb4-45c6-95e1-88244506148f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8097"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8097",
          "registrationNumber": "1110642680034",
          "classNo": 11,
          "student.name": "VIKRAM S D",
          "student.gender": "M",
          "student.parentName": "DHINAKAR S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e3ae62a2-820e-4e11-b745-a75468a2c4fe",
          "admissionId": "57d81c98-ed06-4b97-b281-fd6d640657bf",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7051"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7051",
          "registrationNumber": "9020642480075",
          "classNo": 11,
          "student.name": "VINAYDHARAN KUMAR",
          "student.gender": "M",
          "student.parentName": "KUMAR MANICKAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "62108ade-2a7a-4635-8bd0-1cca27998121",
          "admissionId": "126d9059-7637-414a-b7dd-5c4953b6c098",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8103"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8103",
          "registrationNumber": "1110642680043",
          "classNo": 11,
          "student.name": "VIRAT VISVAJIT M",
          "student.gender": "M",
          "student.parentName": "MANOGAR RHAJ D A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d34dd36f-09c1-469f-ba3d-e4fdb49870f4",
          "admissionId": "61f26cf3-e62a-475c-8e06-1bf7b5a2b449",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6991"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6991",
          "registrationNumber": "9020642480055",
          "classNo": 11,
          "student.name": "VYOMESH KANNA JEYAKUMAR",
          "student.gender": "M",
          "student.parentName": "JEYAKUMAR RAMASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "batchCode": "COITR268S01",
          "firstBatchId": "e1f1e8d2-6205-403e-a6be-a1adc400babc",
          "firstBatchCode": "COITR268S01",
          "firstBatchName": "VIKRAM SARABHAI-11A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a57ed4bb-d1df-4d87-956f-afa7f9bc18ab",
          "admissionId": "c981f3aa-e915-426a-adaf-04e6917d3964",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5409"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5409",
          "registrationNumber": "9020642480013",
          "classNo": 11,
          "student.name": "ADITYA GUHAN",
          "student.gender": "M",
          "student.parentName": "GUHAN MATHIYALAGAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9ea1bcb2-2f37-43cf-9d6e-3f784ec8216a",
          "admissionId": "9b66d48a-f644-46c9-a0d6-1081b28a277d",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6987"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6987",
          "registrationNumber": "9020642480008",
          "classNo": 11,
          "student.name": "AJITNARAYAN KUPPURAJAN",
          "student.gender": "M",
          "student.parentName": "KUPPURAJAN NARAYANASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "37faea93-0784-48c2-a177-eb5da88a0aa6",
          "admissionId": "3fc1bea3-eb8c-41eb-a194-f50f32cf8960",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7913"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7913",
          "registrationNumber": "1130642680010",
          "classNo": 11,
          "student.name": "AKSHAY ARAVINDAN",
          "student.gender": "M",
          "student.parentName": "ARAVINDAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "539580cf-0c88-4adf-b677-f2c968a06dfe",
          "admissionId": "2f4b0060-55cc-400c-bdcd-4174f2ce7549",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2688"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2688",
          "registrationNumber": "9020642480039",
          "classNo": 11,
          "student.name": "AKSHAY JAGADEESH",
          "student.gender": "M",
          "student.parentName": "JAGADEESH NATESAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "92f2c542-6cef-4c40-8b22-0ced717428a9",
          "admissionId": "444b767f-95ee-428d-92a8-54c8fb897804",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2687"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2687",
          "registrationNumber": "9020642480007",
          "classNo": 11,
          "student.name": "AKSHITHA JAGADEESH",
          "student.gender": "F",
          "student.parentName": "JAGADEESH NATESAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ae3fabb0-72de-409b-9445-dca1b5cdfe44",
          "admissionId": "3b195717-bc9a-40e8-a21e-1c6b2a55859b",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4718"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4718",
          "registrationNumber": "9020642480041",
          "classNo": 11,
          "student.name": "ANANYA MEKALA VIJAYANAND",
          "student.gender": "F",
          "student.parentName": "VIJAY ANAND NATARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "91d2512b-eab3-4897-ad49-5decde934fcb",
          "admissionId": "ccf4a38c-8371-4927-9b03-8fcc4d208c14",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6165"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6165",
          "registrationNumber": "9020642480054",
          "classNo": 11,
          "student.name": "ASHWIN RAGHAV SENTHIL",
          "student.gender": "M",
          "student.parentName": "SENTHIL ATTAYAMPALAYAM NALLASWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "71255e93-d5a1-462e-937f-1e655834c0a9",
          "admissionId": "5ee0f64f-02fb-4a58-a1b9-1407aec5564a",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6856"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6856",
          "registrationNumber": "9017642480001",
          "classNo": 11,
          "student.name": "CHARUMATI PRAKASH",
          "student.gender": "F",
          "student.parentName": "PRAKASH SUBRAMANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "09cc8c61-ef78-44bb-a1cf-d0f8e4e6435d",
          "admissionId": "d019f93f-d071-4835-a845-ab86dd063cab",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7975"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7975",
          "registrationNumber": "9020642480078",
          "classNo": 11,
          "student.name": "DAKSITA S M",
          "student.gender": "F",
          "student.parentName": "SENTHILKUMAR RAMASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e63b2726-b7b2-4046-94bb-80fd5971d767",
          "admissionId": "f1993bd1-98db-4cc6-b0c8-a638ec100626",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2677"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2677",
          "registrationNumber": "9020642480068",
          "classNo": 11,
          "student.name": "DARSHANA RENGANAYAGAN",
          "student.gender": "F",
          "student.parentName": "RENGANAYAGAN RAMANUJAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3dc23037-6b05-4be1-963d-c855dd7dea87",
          "admissionId": "3fbfa42f-78ee-4929-b129-9fee8cac9491",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6898"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6898",
          "registrationNumber": "9020642480018",
          "classNo": 11,
          "student.name": "DHAKSHEN MAHENDRAN",
          "student.gender": "M",
          "student.parentName": "MAHENDRAN KANDASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ec27fe8f-a01a-4075-8784-360149b706c9",
          "admissionId": "f4924e46-e783-407c-9689-857ae3652583",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7951"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7951",
          "registrationNumber": "1130642680032",
          "classNo": 11,
          "student.name": "GHARRISON J",
          "student.gender": "M",
          "student.parentName": "JOHN RAVINDRAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8cdc9353-0b36-4afb-b07e-160cd30ac7eb",
          "admissionId": "270b2604-c937-49c7-ac29-609fd0326d32",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6950"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6950",
          "registrationNumber": "9020642480011",
          "classNo": 11,
          "student.name": "HRITHICK NAVANEETHA KRISHNAN",
          "student.gender": "M",
          "student.parentName": "NAVANEETHA KRISHNANA VISWANATHAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ecf21403-4515-4895-85b7-64cbddc350fe",
          "admissionId": "ea1e6090-57b9-4274-8cf5-460bd1f18736",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8007"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8007",
          "registrationNumber": "1130642680018",
          "classNo": 11,
          "student.name": "KANNAN V",
          "student.gender": "M",
          "student.parentName": "VADIVELAN T",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9a51c075-7f89-4f52-bd43-cc788b274638",
          "admissionId": "52dbfa93-030e-4a26-bc71-624d5edf1eb4",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6908"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6908",
          "registrationNumber": "9017642480002",
          "classNo": 11,
          "student.name": "KHANUSH SIVAKUMAR SAPNA RANJANI",
          "student.gender": "M",
          "student.parentName": "SIVAKUMAR DHARMALINGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e4524b1c-4c23-42e9-b0dc-bc1c9acc4db3",
          "admissionId": "0233ff3c-3225-4e0f-b792-0179f8a2f263",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7985"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7985",
          "registrationNumber": "1130642680045",
          "classNo": 11,
          "student.name": "KRRUTHI LUCKY",
          "student.gender": "F",
          "student.parentName": "LUCKY THIAGARASU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6d4373ef-24ff-4166-b8ff-0fa4017ad0ef",
          "admissionId": "9d1ca614-9d69-4ef1-a12d-ca662af0e8b1",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6897"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6897",
          "registrationNumber": "9020642480027",
          "classNo": 11,
          "student.name": "LAKSHITA SENTHILKUMAR",
          "student.gender": "F",
          "student.parentName": "SENTHILKUMAR ARUMUGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ff737be0-d2d0-4101-8baf-2a7abbb24408",
          "admissionId": "36dc1a95-22ab-492a-96e3-599230211e00",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6166"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6166",
          "registrationNumber": "9020642480086",
          "classNo": 11,
          "student.name": "NANDITHAA DHANASEKAR VAIJAYANTHIMALA",
          "student.gender": "F",
          "student.parentName": "DHANASEKAR PONNUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "08aac0f7-0b8f-4649-bc5a-e89e009dfd60",
          "admissionId": "6c8cdfdc-6ee9-4e16-8729-d4f0300c53d5",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4012"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4012",
          "registrationNumber": "9020642480002",
          "classNo": 11,
          "student.name": "NEHA RAMESH",
          "student.gender": "F",
          "student.parentName": "RAMESH NATARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b0e74c35-f2ba-4c9a-b97a-92be52c9ba36",
          "admissionId": "a2b13c24-e238-492d-9fa4-f02bb0344106",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7894"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7894",
          "registrationNumber": "1130642680043",
          "classNo": 11,
          "student.name": "NIKKIL KARTHEESAN",
          "student.gender": "M",
          "student.parentName": "KARTHEESAN G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e9d57789-1c74-4311-ba7f-a948ffc573d9",
          "admissionId": "5c7cdbe8-8d19-43fd-80f9-a2bde0d99b3c",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6860"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6860",
          "registrationNumber": "9020642480028",
          "classNo": 11,
          "student.name": "PRANAV KRISHNA SAKTHIKUMAR",
          "student.gender": "M",
          "student.parentName": "SAKTHIKUMAR PALANISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2f3d9786-7d7b-45f2-8c78-2d5cd4efdaad",
          "admissionId": "66f2f10c-9adf-4bc0-b6d8-088f5ebe39cf",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6183"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6183",
          "registrationNumber": "9020642480045",
          "classNo": 11,
          "student.name": "PRIYANKA GOPINATHAN",
          "student.gender": "F",
          "student.parentName": "GOPINATHAN THANGARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6c3514c0-8ba2-4937-a1b7-2b96f690e6cf",
          "admissionId": "f5d02db6-be5a-4fce-ba4d-b0c65095e7ba",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2685"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2685",
          "registrationNumber": "1130642680014",
          "classNo": 11,
          "student.name": "PRRISHITA NAGARAJA",
          "student.gender": "F",
          "student.parentName": "NAGARAJA PANDIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6f308196-df5c-46ab-860d-da9900a4a23b",
          "admissionId": "71f979e6-c06a-402c-902a-4edd05b29a0e",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7986"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7986",
          "registrationNumber": "1130642680019",
          "classNo": 11,
          "student.name": "RATHEE LUCKY",
          "student.gender": "F",
          "student.parentName": "LUCKY THIAGARASU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5aa00c8e-bd2e-4bd4-9c1a-daaff19e807e",
          "admissionId": "0e25e75d-6717-46ba-a560-b85bc32f0078",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6878"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6878",
          "registrationNumber": "9020642480036",
          "classNo": 11,
          "student.name": "RITESH K A",
          "student.gender": "M",
          "student.parentName": "KUMAR RAMALINGAPURAM VIVEKANANDAMOORTHY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a48b7be4-cdc5-4275-8b9e-8b3f70f3b02d",
          "admissionId": "225a37a6-65a8-41ed-9bd8-014288df1172",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6859"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6859",
          "registrationNumber": "9017642480003",
          "classNo": 11,
          "student.name": "RIYA SURESH",
          "student.gender": "F",
          "student.parentName": "SURESH SHANMUGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5bc04a67-3ce1-44b0-b928-434b1f6f7f83",
          "admissionId": "fff17cbb-3b5f-43a7-a95a-b55fb5884b0b",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2734"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2734",
          "registrationNumber": "9020642480010",
          "classNo": 11,
          "student.name": "SARVESH SHANMUGASUNDARAM",
          "student.gender": "M",
          "student.parentName": "SHANMUGA SUNDARAM RATHAKRISHNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "24b452c2-c57f-4313-ac75-639c7a8e07ee",
          "admissionId": "0ef5f7d7-2b80-432c-90ee-a7082bb0c456",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3922"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3922",
          "registrationNumber": "1130642680034",
          "classNo": 11,
          "student.name": "SHARMESH MOHAN",
          "student.gender": "M",
          "student.parentName": "MOHAN RAJENDRAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "eb80e2a2-73c4-4ca1-a802-a8d0cb793213",
          "admissionId": "1a8420f9-898f-4c78-8aa2-0f6085afa1cb",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4437"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4437",
          "registrationNumber": "9020642480064",
          "classNo": 11,
          "student.name": "SHIVESH PALANI MANICK",
          "student.gender": "M",
          "student.parentName": "MANICKAVASAGAM SHUNMUGAMPALANICHAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "33828e45-140a-481a-b4cd-0327217c036e",
          "admissionId": "2dae6cf5-d41b-4ec9-8fd0-e9fce281e111",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6887"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6887",
          "registrationNumber": "9020642480025",
          "classNo": 11,
          "student.name": "SOLAI SUDHAKARAN",
          "student.gender": "F",
          "student.parentName": "SUDHAKARAN PALANISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c2f36a98-2fd9-4662-8017-d4e12d0ad4d3",
          "admissionId": "b36c7a5f-0f66-4184-b06b-f977960841fe",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6877"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6877",
          "registrationNumber": "9020642480038",
          "classNo": 11,
          "student.name": "SRINITHIN SIVAKUMAR",
          "student.gender": "M",
          "student.parentName": "SIVAKUMAR GOVINDARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ffa35dcb-d4a1-4962-b380-fd8eaa79d9c5",
          "admissionId": "d2718bc5-0c44-4cd9-8125-b4658de5d673",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4593"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4593",
          "registrationNumber": "1130642680013",
          "classNo": 11,
          "student.name": "SUTHARSAN SIVAKUMAR",
          "student.gender": "M",
          "student.parentName": "SIVAKUMAR THANGAVEL",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "82df3be9-4785-43cc-8cfc-8a90cd8003b9",
          "admissionId": "f1352061-42c8-40e2-a649-df98ea8a00fd",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7870"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7870",
          "registrationNumber": "1130642680031",
          "classNo": 11,
          "student.name": "TANIA MITRA V B",
          "student.gender": "F",
          "student.parentName": "VIJAYAVEL S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "64c92b98-7bbf-46d7-a0a2-c8ab4ba0757a",
          "admissionId": "53b99712-f8f8-426d-a0cf-6f268dce9537",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2712"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2712",
          "registrationNumber": "9020642480091",
          "classNo": 11,
          "student.name": "UDHAVA VENKAT",
          "student.gender": "M",
          "student.parentName": "VENKAT AVINASHI BALAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "fcc6f6ac-894c-4b4a-8f98-4caf988785cd",
          "admissionId": "8e4c8f43-8c20-4280-a93d-d693b90f16a5",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4549"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4549",
          "registrationNumber": "9020642480090",
          "classNo": 11,
          "student.name": "VARNIKA VADIVEL",
          "student.gender": "F",
          "student.parentName": "VADIVEL RANGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f7df95c5-63ad-4d81-8708-054180917e9e",
          "admissionId": "d0919975-93b6-4c60-b4d5-e1bc5ccc9783",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2733"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2733",
          "registrationNumber": "9020642480069",
          "classNo": 11,
          "student.name": "VARSHITHA PRABURAM",
          "student.gender": "F",
          "student.parentName": "PRABURAM DHALI  RANGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4820050f-7465-4f2c-a8a1-3ced111cbc26",
          "admissionId": "19cd6efa-4578-4a86-8451-0ce6af5d795c",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6983"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6983",
          "registrationNumber": "9020642480049",
          "classNo": 11,
          "student.name": "YOGITH VIJAYAKUMAR",
          "student.gender": "M",
          "student.parentName": "VIJAYAKUMAR ESWARAMOORTHY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "batchCode": "COITM268S01",
          "firstBatchId": "b76de44b-64db-4e37-b2b7-4e754c20b4ef",
          "firstBatchCode": "COITM268S01",
          "firstBatchName": "SUSRUTHA-11Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9997572d-0b2a-4697-93d7-8b6781829c3f",
          "admissionId": "7129210a-0729-4f7c-a0fe-0c4383573419",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8138"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8138",
          "registrationNumber": "1130642680001",
          "classNo": 11,
          "student.name": "ABHINAV G",
          "student.gender": "M",
          "student.parentName": "GOVINDASAMY P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7a49a448-7faf-4b8e-aa38-efd39cee9b88",
          "admissionId": "dfb2ab0c-c21a-4460-b4e5-bbe915c7f242",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8046"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8046",
          "registrationNumber": "111064268003",
          "classNo": 11,
          "student.name": "ADHISH PRAVEEN",
          "student.gender": "M",
          "student.parentName": "PRAVEEN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "56e0f450-bc4a-4509-958c-1a2cb174ff1c",
          "admissionId": "bccd4735-f3c0-4416-988b-09e828a200bd",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7977"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7977",
          "registrationNumber": "1130642680025",
          "classNo": 11,
          "student.name": "ANINI V",
          "student.gender": "F",
          "student.parentName": "VIJAYA CHANDRAN M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f2c2517c-8199-4df2-a7cb-680ce4dcfac0",
          "admissionId": "51493893-df4d-4a99-831a-435b3a2c32ab",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7971"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7971",
          "registrationNumber": "1130642680017",
          "classNo": 11,
          "student.name": "ANU S",
          "student.gender": "F",
          "student.parentName": "SENTHIL S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "decb0ccb-de3a-4a07-a84a-e10aea87c467",
          "admissionId": "c12fa9fc-f6b6-4e21-a94f-85e0081cc4aa",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8000"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8000",
          "registrationNumber": "1130642680040",
          "classNo": 11,
          "student.name": "ARUN KRUTHIK G R",
          "student.gender": "M",
          "student.parentName": "GOBI V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f1c78de8-bc42-48d2-b3ff-8b8f7382b282",
          "admissionId": "0a358198-1db9-4644-b651-376963aa5fac",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8063"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8063",
          "registrationNumber": "1130642680024",
          "classNo": 11,
          "student.name": "ARUNDATHI S",
          "student.gender": "F",
          "student.parentName": "SATHYAMURTHY N S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "efe15ba5-93f1-4ba4-8d92-d7274742ce9e",
          "admissionId": "c4196482-12fa-4fd9-88ff-af4c362f1369",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8005"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8005",
          "registrationNumber": "1130642680039",
          "classNo": 11,
          "student.name": "ASWATH KHANNA V S",
          "student.gender": "M",
          "student.parentName": "VIJAY ANAND P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0782380e-909e-4df6-bb7d-9b973a69e965",
          "admissionId": "f39306ef-c696-45ab-934b-8b4d81fc7ff4",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8060"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8060",
          "registrationNumber": "1130642680020",
          "classNo": 11,
          "student.name": "AVINASH M U",
          "student.gender": "M",
          "student.parentName": "MOORTHY K P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d9e66715-2bad-4722-915e-bae5e1b92f3a",
          "admissionId": "b00d9f51-2ec5-404e-8e0b-2e8b37cce0e1",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7984"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7984",
          "registrationNumber": "1130642680012",
          "classNo": 11,
          "student.name": "BHAGATSINGH G",
          "student.gender": "M",
          "student.parentName": "GANESAN N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "cc3a85f0-e7c1-4d72-aae8-bdcd42046dcb",
          "admissionId": "4c0fc55f-c43c-4554-8c51-5d3cdb140568",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8164"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8164",
          "registrationNumber": "1130642680048",
          "classNo": 11,
          "student.name": "DHANVANTH V",
          "student.gender": "M",
          "student.parentName": "VIJAI O L S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "894ac40f-3c07-4d21-afe6-756fbf217bcd",
          "admissionId": "69852642-6bb0-476b-84ca-26ac2fa913c7",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4868"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4868",
          "registrationNumber": "1130642680023",
          "classNo": 11,
          "student.name": "DHARSHANA SIVARAM",
          "student.gender": "F",
          "student.parentName": "SIVARAM ARUMUGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "07d76986-74c8-488c-bb96-705c0384756e",
          "admissionId": "fa89098e-02a4-4c95-814d-d84732ea3b47",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8113"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8113",
          "registrationNumber": "1130642680044",
          "classNo": 11,
          "student.name": "DIVAKAR N A",
          "student.gender": "M",
          "student.parentName": "AMMASAIGOUNDAN V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "416d647c-cefc-4ce1-a2eb-92d649a11ecd",
          "admissionId": "09271cf4-dc70-4d93-bee0-6ff8c3da6b40",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6249"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6249",
          "registrationNumber": "1130642680005",
          "classNo": 11,
          "student.name": "GUHANEESHVAR JAGADEES",
          "student.gender": "M",
          "student.parentName": "JAGADESWARABABU NACHIMUTHU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8f1fd3bf-de0d-4243-98a3-433a625f47e7",
          "admissionId": "aeab0c76-8fb4-4f3e-9880-e73b1c3bcac0",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7963"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7963",
          "registrationNumber": "1130642680033",
          "classNo": 11,
          "student.name": "HARITHA SHIVRAM",
          "student.gender": "F",
          "student.parentName": "KATHIRVELU R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "465ec027-4d54-48d6-8286-8944aeb76a36",
          "admissionId": "bb73923a-7763-49c0-bdb6-abf4cbfe9e1f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7708"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7708",
          "registrationNumber": "1130642680049",
          "classNo": 11,
          "student.name": "INIYA P",
          "student.gender": "F",
          "student.parentName": "PACKIARAJ K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c1230311-4d44-43d5-96d2-df6f2c9bbd77",
          "admissionId": "6792fdd6-5b3a-4270-925e-4badb526f2f1",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2760"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2760",
          "registrationNumber": "1130642680015",
          "classNo": 11,
          "student.name": "KANEESHASRI RAJKUMAR",
          "student.gender": "F",
          "student.parentName": "RAJKUMAR BALAKRISHNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "37a57c9a-9d20-4c4b-9658-3387c0221291",
          "admissionId": "2361fd09-8db6-4967-8176-921bed4067e6",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7995"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7995",
          "registrationNumber": "1130642680021",
          "classNo": 11,
          "student.name": "KANISHHKAA EZHILARASU",
          "student.gender": "F",
          "student.parentName": "EZHILARASU P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2a3a896a-17e8-4258-b0e9-ebb190766799",
          "admissionId": "d5631ed5-bdd5-4a1e-90bc-5aca387d8408",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8023"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8023",
          "registrationNumber": "1130642680041",
          "classNo": 11,
          "student.name": "KANISHKA M",
          "student.gender": "F",
          "student.parentName": "MURUGESAN V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5858b105-423f-4c05-8974-789d1834b935",
          "admissionId": "c837df99-1dc2-4765-a696-447ccd1f188a",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8091"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8091",
          "registrationNumber": "1130642680046",
          "classNo": 11,
          "student.name": "KANISHKA RAVI",
          "student.gender": "F",
          "student.parentName": "RAVI K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c65640bf-9639-48dc-9170-83abf52e2448",
          "admissionId": "9832dd30-01b8-4820-9bb8-ce710bc606be",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6204"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6204",
          "registrationNumber": "113064268001",
          "classNo": 11,
          "student.name": "LAKSHANA MURALI",
          "student.gender": "F",
          "student.parentName": "MURALI ARUMUGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "333453e8-6ea2-46b0-b247-6799b147df8a",
          "admissionId": "fabd72df-6da1-46c1-bc5a-90015784db4b",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4728"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4728",
          "registrationNumber": "1130642680029",
          "classNo": 11,
          "student.name": "LAKSHANA SENTHILKUMAARAN",
          "student.gender": "F",
          "student.parentName": "SENTHILKUMAARAN SUBRAMANIAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "928e66cb-c281-4169-b2bc-7f4038afdefd",
          "admissionId": "3e96f835-76b8-4333-a31c-f1d47c67ac61",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4041"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4041",
          "registrationNumber": "1130642680030",
          "classNo": 11,
          "student.name": "LAKSHITHA ITHAYAVENTHAN",
          "student.gender": "F",
          "student.parentName": "ITHAYAVENTHAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4cf97f02-f415-467e-b4ea-9670aecde0e6",
          "admissionId": "91af0ca9-02c3-4b44-82b5-41d6b8d0134f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8143"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8143",
          "registrationNumber": "1130642680038",
          "classNo": 11,
          "student.name": "MARLIYA M",
          "student.gender": "F",
          "student.parentName": "MOHAMED AURIFF S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "029c3b94-71df-4ccd-b371-61e256fd399a",
          "admissionId": "6fe5eb00-891a-4a46-a090-cb889b252c05",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6206"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6206",
          "registrationNumber": "1130642680036",
          "classNo": 11,
          "student.name": "MEETH AADHAV VINOTHKUMAR MENAKA",
          "student.gender": "M",
          "student.parentName": "VINOTH KUMAR SUNDARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8bc5d0ce-da59-4748-8244-b3739da6500a",
          "admissionId": "997273e8-f60d-4d81-8cce-2925c1b19515",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8122"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8122",
          "registrationNumber": "1130642680028",
          "classNo": 11,
          "student.name": "NEHA PRAVEEN",
          "student.gender": "F",
          "student.parentName": "PRAVEENKUMAR P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ec4e9b32-e65f-484e-b8b4-bda65b7cb70c",
          "admissionId": "bb91a32e-cd3d-4b69-b542-ca173d465602",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7980"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7980",
          "registrationNumber": "1130642680022",
          "classNo": 11,
          "student.name": "NIDHI K",
          "student.gender": "F",
          "student.parentName": "KRISHNA KUMAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3a3b7cd6-8bce-444f-9e00-e70b357d5ace",
          "admissionId": "48e1e035-9913-41b7-92d1-98a182f195cc",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8020"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8020",
          "registrationNumber": "1130642680009",
          "classNo": 11,
          "student.name": "POOJA PRIYAMVADHA R",
          "student.gender": "F",
          "student.parentName": "RAGHU PRASANN AG",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ac0c993f-637a-4101-9e92-4510eeadc957",
          "admissionId": "6a139829-1aae-4fbe-afe1-99090c65712a",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8085"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8085",
          "registrationNumber": "1130642680006",
          "classNo": 11,
          "student.name": "PRARTHANA VISHNU KANTH",
          "student.gender": "F",
          "student.parentName": "VISHNU KANTH V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2b96ddb0-1e86-4016-9e4d-e68cba1cc0db",
          "admissionId": "ac11928b-57cc-4a65-8ba7-def733c0fa94",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4622"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4622",
          "registrationNumber": "1130642680004",
          "classNo": 11,
          "student.name": "PRATEKA SRI JAYAPRAKASH GUNASUNDARI",
          "student.gender": "F",
          "student.parentName": "JAYAPRAKASH MURUGESH",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7e355c7d-d7a3-47bd-915a-f8c3bb9ffe12",
          "admissionId": "200e4be7-80af-41d5-b258-a700d3225b6a",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8045"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8045",
          "registrationNumber": "1130642680042",
          "classNo": 11,
          "student.name": "PRITIKA LAKSHMI M",
          "student.gender": "F",
          "student.parentName": "MURUGAN V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "96a6113a-3466-45d9-a1b8-43adda712cf0",
          "admissionId": "ca7377a0-3822-407b-b497-2f88531fe4a8",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7982"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7982",
          "registrationNumber": "1130642680008",
          "classNo": 11,
          "student.name": "RISHI KARTHIK R V",
          "student.gender": "M",
          "student.parentName": "VIJAY SARAVANAN S P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "471ae066-fe85-48cc-aeee-e1d2b3e22ac0",
          "admissionId": "b3f30719-52ef-4542-b2eb-8dd7d4b70487",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8134"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8134",
          "registrationNumber": "1130642680035",
          "classNo": 11,
          "student.name": "SAMUEL SUVITH X",
          "student.gender": "M",
          "student.parentName": "XAVIER SANTHA L",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9e27168a-cf99-40b8-9369-80b1c6e20837",
          "admissionId": "5224b03f-9ba4-4e65-9c0c-87bee2445843",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7902"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7902",
          "registrationNumber": "9020642480059",
          "classNo": 11,
          "student.name": "SHAMYUTHA R",
          "student.gender": "F",
          "student.parentName": "RAJESHBALASUBRAMANIAN G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "18cdbe73-b3f7-4c4c-9fff-7253293e02f7",
          "admissionId": "74bc946f-9120-4ce1-a5da-870e186605b1",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8106"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8106",
          "registrationNumber": "1130642680003",
          "classNo": 11,
          "student.name": "SHREYA G S",
          "student.gender": "F",
          "student.parentName": "GANESAN A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "dbc1afee-c3de-4e57-b7fb-5125999ce6af",
          "admissionId": "0121a8b4-7e9f-46a0-a5e5-98de6f619702",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7961"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7961",
          "registrationNumber": "1130642680026",
          "classNo": 11,
          "student.name": "SIVA DHARSANA A S",
          "student.gender": "F",
          "student.parentName": "ASHOK KUMAR SELVARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c1b4945f-8dab-4b5d-a750-c6794f325616",
          "admissionId": "9b63f7bb-6874-40e3-89c0-014666dcb68d",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8037"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8037",
          "registrationNumber": "1130642680037",
          "classNo": 11,
          "student.name": "SREE VARSHA MEENAKSHI K R",
          "student.gender": "F",
          "student.parentName": "RAJAMANICKAM K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "00104722-db46-4987-8881-efcd2f12e85d",
          "admissionId": "7d6b1618-26dd-4b8e-87d3-963b5343b425",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8017"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8017",
          "registrationNumber": "1130642680027",
          "classNo": 11,
          "student.name": "SRIRAM D",
          "student.gender": "M",
          "student.parentName": "DURAIRAJ K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6fce0f33-17cb-42a5-9294-2d70fdc23d8b",
          "admissionId": "97d0957e-54a3-40ed-b01d-028aa1046591",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8141"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8141",
          "registrationNumber": "1130642680002",
          "classNo": 11,
          "student.name": "SUYASH B S",
          "student.gender": "M",
          "student.parentName": "BALAMURUGAN P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c484de9c-4c3d-4300-b7b5-d75694c15cd0",
          "admissionId": "6e4aaac6-2edf-4814-8794-10f46d7a8a33",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2765"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2765",
          "registrationNumber": "1130642680016",
          "classNo": 11,
          "student.name": "TANISKA KARTHIKEYAN",
          "student.gender": "F",
          "student.parentName": "KARTHIKEYAN PALANISWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "116b4fa3-df80-44e6-85d0-e9f57d92d883",
          "admissionId": "ebc74144-a0b2-4893-b038-3deb50357397",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8152"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8152",
          "registrationNumber": "1130642680047",
          "classNo": 11,
          "student.name": "UDHAI KANNAN K",
          "student.gender": "M",
          "student.parentName": "KANNAN K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7a4e92bc-64e1-4733-9299-a4cd5f647037",
          "admissionId": "a1bc2934-ae26-4cf6-9722-70f19d9e806c",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "8095"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "8095",
          "registrationNumber": "1130642680007",
          "classNo": 11,
          "student.name": "UVEDIKHA S P",
          "student.gender": "F",
          "student.parentName": "SIVAKUMAR B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "batchCode": "COITM268C01",
          "firstBatchId": "739697dd-085e-4506-b1a0-dd15fa12249e",
          "firstBatchCode": "COITM268C01",
          "firstBatchName": "CHARAKA-11Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a388eedb-d6b3-4643-865c-99bbdcec9d58",
          "admissionId": "9e1a3d32-6fd8-4615-b4a5-bc6832617da6",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6458"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6458",
          "registrationNumber": "1110642570027",
          "classNo": 12,
          "student.name": "AADIT SHIVRAM",
          "student.gender": "M",
          "student.parentName": "KATHIRVELU RAMASWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "46ca5f2a-fd0d-4e3e-8894-cdabd8870058",
          "admissionId": "901e7127-6dbf-4f63-8c42-1929c35265c8",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7354"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7354",
          "registrationNumber": "1110642570035",
          "classNo": 12,
          "student.name": "ABISHEK VELAN S",
          "student.gender": "M",
          "student.parentName": "SARAVANAKUMAR G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "481d6dea-a5e5-41be-b5eb-618993b96a87",
          "admissionId": "0d62cf68-455e-4c0b-b061-622e09f5708f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7321"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7321",
          "registrationNumber": "1110642570019",
          "classNo": 12,
          "student.name": "AKILAN R",
          "student.gender": "M",
          "student.parentName": "RAJESH KANNA S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "737aaa7a-8a61-4c07-b643-08552d079025",
          "admissionId": "860c6a10-95bd-470e-a5e1-c52e077708bd",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7364"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7364",
          "registrationNumber": "1110642570039",
          "classNo": 12,
          "student.name": "DARSHAN K",
          "student.gender": "M",
          "student.parentName": "KAMARAJ K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9e6eb401-54af-4a5f-9bd2-1a857014a359",
          "admissionId": "1051fb60-d494-4ae6-8162-75c24f61247f",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6303"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6303",
          "registrationNumber": "9020642370022",
          "classNo": 12,
          "student.name": "DEEBAK ARESH  RAMARAJ MUTHUPPANDI",
          "student.gender": "M",
          "student.parentName": "MUTHUPPANDI RAMARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0ee3cc80-c189-4f7b-b6de-b05a4542e3dd",
          "admissionId": "0fe51111-309b-4ee9-81cc-3a78f367c16c",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7353"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7353",
          "registrationNumber": "1110642570044",
          "classNo": 12,
          "student.name": "DHANVANTH S",
          "student.gender": "M",
          "student.parentName": "SREEKANTH V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2f4ce11e-b35f-453f-9b4f-aa96e5778fc7",
          "admissionId": "0f21eb40-4585-4114-a268-97ac64ed13f8",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7393"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7393",
          "registrationNumber": "1110642570067",
          "classNo": 12,
          "student.name": "DHARANIDHARAN D",
          "student.gender": "M",
          "student.parentName": "DEVARAJ P K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f85ebd6a-1a60-470f-a55d-1d665fb6dd14",
          "admissionId": "d75ffc09-f15d-45d8-b6b7-0c862890d2d0",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6305"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6305",
          "registrationNumber": "9020642370009",
          "classNo": 12,
          "student.name": "GAUTAM RAMESH KUMAR",
          "student.gender": "M",
          "student.parentName": "RAMESH KUMAR BALASUBRAMANIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "22723749-c3e1-4e9b-8da2-b765afd77190",
          "admissionId": "ce48d662-f194-4da2-a318-73b92d3f3d14",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6382"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6382",
          "registrationNumber": "9020642370065",
          "classNo": 12,
          "student.name": "HARSHIT GOPINATHAN",
          "student.gender": "M",
          "student.parentName": "GOPINATHAN THANGARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "077ee59d-4cba-43f2-9787-2430e6840960",
          "admissionId": "349c0100-cf89-4210-a6f7-669bbcf38a7b",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6401"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6401",
          "registrationNumber": "9020642370053",
          "classNo": 12,
          "student.name": "JAYANTH SHARAN RAJENDRAN",
          "student.gender": "M",
          "student.parentName": "RAJENDRAN DEVARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "54c850de-2b0b-4a89-a8dd-96c192fbb533",
          "admissionId": "7e8f0664-9b36-4d1b-8630-ab2eb7fe21d2",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7443"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7443",
          "registrationNumber": "1110642570079",
          "classNo": 12,
          "student.name": "JINESH A R",
          "student.gender": "M",
          "student.parentName": "RAMESH A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8cc6221c-9998-4fc9-a1fd-77a3420c8ca9",
          "admissionId": "56db4d4b-ea5c-4c1e-b678-d4ef82bd7210",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7472"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7472",
          "registrationNumber": "9061642370014",
          "classNo": 12,
          "student.name": "KHAVIYAN K",
          "student.gender": "M",
          "student.parentName": "KUMARAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2588b6d3-180c-41ea-a830-29caac0d69da",
          "admissionId": "8669a6e2-574f-4551-8f06-2d584bbb0bf3",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6295"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6295",
          "registrationNumber": "9020642370036",
          "classNo": 12,
          "student.name": "KRISH VIJAYASARATHY",
          "student.gender": "M",
          "student.parentName": "VIJAYASARATHY GURUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "53a053ea-15a2-4417-a95e-6afdfebad51a",
          "admissionId": "0b0f40ea-cbe8-49c3-82a0-ce45b93186e1",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6414"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6414",
          "registrationNumber": "9020642370073",
          "classNo": 12,
          "student.name": "KRITHIC JAYASAKTHIVEL",
          "student.gender": "M",
          "student.parentName": "JAYASAKTHIVEL ANGAMUTHU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "33d8f182-330b-4bd8-ba5a-8dd9227543c6",
          "admissionId": "68743c8c-0175-4a6c-8da3-7a8d2c6db775",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3714"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3714",
          "registrationNumber": "9020642370004",
          "classNo": 12,
          "student.name": "LOKADESH RAMESH BABU",
          "student.gender": "M",
          "student.parentName": "RAMESH BABU SEERAPALAYAM PALANISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e20971da-9a52-4349-b12c-a8a8598feb58",
          "admissionId": "ecac603a-861e-4bff-8ef6-2138299ca1cc",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6265"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6265",
          "registrationNumber": "9020642370055",
          "classNo": 12,
          "student.name": "MRITYUNJAY KRISHNA RISHI MUGESH KANNA",
          "student.gender": "M",
          "student.parentName": "RISHI MUGESH KANNA PARTHIBAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "257620cc-dc8c-4e1e-97eb-24518e0cb641",
          "admissionId": "0e112794-52ca-42b9-9786-c463d47d8190",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6451"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6451",
          "registrationNumber": "9020642370072",
          "classNo": 12,
          "student.name": "NAGULAN PRAKASAM",
          "student.gender": "M",
          "student.parentName": "PRAKASAM RASIYANA GOUNDER",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "17f3e12a-c979-44e2-be9e-ba8676d1f918",
          "admissionId": "8e7dc05e-13cc-4c19-b5ca-7ffb4f8281de",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6375"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6375",
          "registrationNumber": "9020642370061",
          "classNo": 12,
          "student.name": "NAKHULAADAV SAKTHIVEL JAYANTHI",
          "student.gender": "M",
          "student.parentName": "SAKTHIVEL CHINNUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "cbc43fc4-61b6-473f-8ac5-9d77d57aedc3",
          "admissionId": "4cb6a106-7cb3-4c94-9b3b-cb6974dd78b4",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6340"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6340",
          "registrationNumber": "9020642370057",
          "classNo": 12,
          "student.name": "NILA KARTHIKEYAN",
          "student.gender": "F",
          "student.parentName": "KARTHIKEYAN SOMAIANUR MARUTHAIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "40309a6f-430c-4e08-82d5-2b0b42127ab4",
          "admissionId": "8291319f-e4a3-4d9a-8137-f1c3a5b8f39e",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7365"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7365",
          "registrationNumber": "1110642570061",
          "classNo": 12,
          "student.name": "NITHISH B",
          "student.gender": "M",
          "student.parentName": "BALAMURUGAN K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7a17805c-2160-4416-be06-68eed36d596c",
          "admissionId": "642f9400-f28d-45bc-be85-2bd994da3f50",
          "createdAt": "2026-11-12T06:35:16.308Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7317"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7317",
          "registrationNumber": "1110642570026",
          "classNo": 12,
          "student.name": "NITILAN S J",
          "student.gender": "M",
          "student.parentName": "SATHYABALAN P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6f23498b-4fbd-4ec5-9d82-da50ef4fb5ff",
          "admissionId": "e8bb77c7-b97d-4124-9516-1aed038e7805",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7323"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7323",
          "registrationNumber": "1110642570062",
          "classNo": 12,
          "student.name": "PRANAV S V",
          "student.gender": "M",
          "student.parentName": "SABARINATHAN N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "685d6a2d-5e22-4030-90b5-580bca065f5b",
          "admissionId": "1d11a675-681a-40a9-b24a-e431ebf98e35",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7478"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7478",
          "registrationNumber": "9062642370001",
          "classNo": 12,
          "student.name": "PRANESHRAM K S",
          "student.gender": "M",
          "student.parentName": "KAMALAKANNAN M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9cfce6b0-8ee0-4950-82df-2164e824a0c8",
          "admissionId": "2b9446ad-dbf1-4215-9733-95b91645e16a",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6298"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6298",
          "registrationNumber": "9020642370051",
          "classNo": 12,
          "student.name": "PRITESH RAAGAV MARISANKAR",
          "student.gender": "M",
          "student.parentName": "MARISANKAR DESIGANATHAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f776df58-3b26-498c-bc59-94b4f62f9a15",
          "admissionId": "52fe11d7-8484-4c3b-aabc-00ce44a430e1",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6330"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6330",
          "registrationNumber": "9020642370054",
          "classNo": 12,
          "student.name": "SABAREESHWARAN SELVAM",
          "student.gender": "M",
          "student.parentName": "SELVAM SUBRAMANIYA MUDALI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e208518b-c0ce-4c71-ad0e-962f5f524e3a",
          "admissionId": "248340a9-1295-43c7-9bfc-3702e2acd8f0",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7319"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7319",
          "registrationNumber": "1110642570063",
          "classNo": 12,
          "student.name": "SAMRRIDH NAGAVIJAY",
          "student.gender": "M",
          "student.parentName": "NAGAVIJAY SIVAKUMAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "dabe3ce2-ecdd-466f-a25f-6350e8adb2c1",
          "admissionId": "bbff602d-2315-4aa8-af18-ea7d561a975e",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7330"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7330",
          "registrationNumber": "1110642570056",
          "classNo": 12,
          "student.name": "SANJAYKUMAR K",
          "student.gender": "M",
          "student.parentName": "KALIMUTHU M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ee1cda98-8aae-42d7-89ca-252195161e68",
          "admissionId": "d833ad4e-e2bd-4333-a618-d63fbc115577",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6419"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6419",
          "registrationNumber": "9020642370049",
          "classNo": 12,
          "student.name": "SANJITHKRISHNA RAMASAMY",
          "student.gender": "M",
          "student.parentName": "RAMASAMY KATCHAMANAICKER",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "432351cd-e09e-4d58-a75b-a525e76a70d8",
          "admissionId": "aa75f4c4-0661-4fd7-9a0e-99d40166bac4",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6257"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6257",
          "registrationNumber": "9020642370012",
          "classNo": 12,
          "student.name": "SREEHARI GOTHANDARAMAN",
          "student.gender": "M",
          "student.parentName": "GOTHANDARAMAN SRINIVASAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c3f3abd1-68e5-44f4-bd48-517602a88e40",
          "admissionId": "2613f3a0-23f1-47c8-ae7e-630379c8fcda",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7359"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7359",
          "registrationNumber": "1110642570013",
          "classNo": 12,
          "student.name": "SRIVARDHINI K",
          "student.gender": "F",
          "student.parentName": "KESAVAMOORTHY VENKATACHALAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "fb8bb5d7-ddb1-4ab7-9496-a8803489c68f",
          "admissionId": "efcc0c42-dcbb-4626-a7bf-42cc58d456c6",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6421"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6421",
          "registrationNumber": "9020642370060",
          "classNo": 12,
          "student.name": "SURYA RAMANATHAN",
          "student.gender": "M",
          "student.parentName": "RAMANATHAN SOMASUNDARAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f97d02e7-55b7-4c50-83fa-a44c96d2420b",
          "admissionId": "27fc0d36-1346-4759-a8ea-913d85976ac8",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7469"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7469",
          "registrationNumber": "1061662470003",
          "classNo": 12,
          "student.name": "YADAV R",
          "student.gender": "M",
          "student.parentName": "RANJITH KUMAR R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "91a5a828-f073-4c66-9ff6-9df88c12b6b0",
          "admissionId": "63215454-8887-4cbe-9a8b-9d11d2737538",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7483"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7483",
          "registrationNumber": "1062662470003",
          "classNo": 12,
          "student.name": "YADHUNANDHAN M",
          "student.gender": "M",
          "student.parentName": "MOHANRAJ M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "batchCode": "COIXR257E01",
          "firstBatchId": "301e6841-04aa-460e-93f1-0372d6397e2e",
          "firstBatchCode": "COIXR257E01",
          "firstBatchName": "EINSTEIN-12A1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d61b39fe-897f-4379-aee8-45ea02364e33",
          "admissionId": "cf8d478f-8f20-4a9d-89ee-dfe8fcbe602f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7480"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7480",
          "registrationNumber": "1110642570087",
          "classNo": 12,
          "student.name": "AADHAVAN A",
          "student.gender": "M",
          "student.parentName": "ATHISIVAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "65df9541-70b1-4e8b-9951-f6f7fbe56958",
          "admissionId": "27cee9f9-7ef4-40d8-a5a5-d869ac974917",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6301"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6301",
          "registrationNumber": "9020642370056",
          "classNo": 12,
          "student.name": "AARUSHI TALAPADY",
          "student.gender": "F",
          "student.parentName": "HAREESHA TALAPADY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "00b411bd-2782-481b-95f0-406884768908",
          "admissionId": "e3b59367-6b1d-466a-a6ac-59511b973730",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6420"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6420",
          "registrationNumber": "9020642370074",
          "classNo": 12,
          "student.name": "ABINANDH MARUSAMY SARAVANAN",
          "student.gender": "M",
          "student.parentName": "SARAVANAN RAMASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "878cfb71-2798-4b36-a50c-1298222bd235",
          "admissionId": "330ab8c3-cd0a-4921-9f16-630318d3e6bf",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6368"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6368",
          "registrationNumber": "9020642370076",
          "classNo": 12,
          "student.name": "ARJUN ANANDAKUMAR",
          "student.gender": "M",
          "student.parentName": "ANANDAKUMAR KRISHNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "aeec961f-f160-4b83-af37-4bb340d998b8",
          "admissionId": "cc176ed4-1dae-4387-99a0-ad9337a4f488",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7394"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7394",
          "registrationNumber": "1110642570072",
          "classNo": 12,
          "student.name": "ARNAV PASRICHA",
          "student.gender": "M",
          "student.parentName": "ASHISH PASRICHA",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e69b34df-f979-40a9-a62b-9270fbf87c9e",
          "admissionId": "7de7bc81-b29e-4f71-aaf7-038cbeeb439f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7476"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7476",
          "registrationNumber": "9062642370012",
          "classNo": 12,
          "student.name": "ASWANTH K",
          "student.gender": "M",
          "student.parentName": "KARTHIKEYAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1c308a3f-1b7c-4d70-86bc-fb25b3fb6708",
          "admissionId": "e426df30-8fe2-44e0-ae8e-257998a8b354",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7414"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7414",
          "registrationNumber": "1110642570011",
          "classNo": 12,
          "student.name": "BADHRUHARISH V R",
          "student.gender": "M",
          "student.parentName": "VIDYA SAKAR R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "78a2a27d-b25e-4884-b93d-939fd34d2c86",
          "admissionId": "e2fa3ac1-55df-4825-a847-3768f20e63a5",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2449"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2449",
          "registrationNumber": "9020642370083",
          "classNo": 12,
          "student.name": "CHATTHRESH GNANASHANMUGAM ANGULAXMI",
          "student.gender": "M",
          "student.parentName": "GNANASHANMUGAM GNANAGURUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "481f41b8-490d-4d29-8ed7-5b855210b902",
          "admissionId": "68d4a00e-b5d5-48df-8c3b-47429a4f3daf",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6233"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6233",
          "registrationNumber": "9020642370010",
          "classNo": 12,
          "student.name": "DEERAJ DHIWAKAR",
          "student.gender": "M",
          "student.parentName": "MUTHUSWAMY DHIWAKAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0d338744-2c7c-419f-9817-68a7e1ac70d3",
          "admissionId": "6e592234-13d6-4224-aff7-43956f1f46c4",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7399"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7399",
          "registrationNumber": "1110642570059",
          "classNo": 12,
          "student.name": "DHARANIDHARAN A S",
          "student.gender": "M",
          "student.parentName": "ASHOK KUMAR P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "98011dc1-a461-4909-b692-aafa1f33d5df",
          "admissionId": "44ff7111-020a-463d-a9fe-3c95768f460e",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7417"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7417",
          "registrationNumber": "1110642570029",
          "classNo": 12,
          "student.name": "DHARSHINEE V",
          "student.gender": "F",
          "student.parentName": "VENKATESH S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "66b78db8-52a1-45cf-b74f-d39a97910f61",
          "admissionId": "cdad7ca2-5fa5-4833-b4d0-e3388edb7803",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7334"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7334",
          "registrationNumber": "1110642570031",
          "classNo": 12,
          "student.name": "DIVYA DHARSHAN B",
          "student.gender": "M",
          "student.parentName": "BABU V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8f31c293-ca08-45b3-bf96-8304e944029a",
          "admissionId": "314a9716-0a01-451e-a8fc-babd85fa504b",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7396"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7396",
          "registrationNumber": "1110642570046",
          "classNo": 12,
          "student.name": "DWARAGA B",
          "student.gender": "F",
          "student.parentName": "BALAMURUGAN A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a30554b0-169a-498d-a4ce-0d49a1a9bf80",
          "admissionId": "7de5b265-1942-4b1d-98c8-e5b13ee4f3ae",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7491"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7491",
          "registrationNumber": "9061642370019",
          "classNo": 12,
          "student.name": "ELAMUKIL INIYAN S N",
          "student.gender": "M",
          "student.parentName": "SENTHILKUMAR P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "983dd00f-41ca-49dc-8682-2bae64b8632f",
          "admissionId": "244fff1d-5192-4700-a7f5-a552eee5248c",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7367"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7367",
          "registrationNumber": "1110642570003",
          "classNo": 12,
          "student.name": "HARIPRASANNAA C S",
          "student.gender": "M",
          "student.parentName": "SANKAR C",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6f1cded2-4cac-431a-bee5-a8d0f6a8d036",
          "admissionId": "bcc0d2f3-2765-4a74-8f97-04ad85c0181d",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6362"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6362",
          "registrationNumber": "9020642370043",
          "classNo": 12,
          "student.name": "HARSIITH KATHIRAVAN",
          "student.gender": "M",
          "student.parentName": "KATHIRAVAN PALANISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "15dfecec-7871-42e1-b92a-ce80e791f5a8",
          "admissionId": "beedd2bc-d3a1-447c-a5a0-60eb6af66009",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7466"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7466",
          "registrationNumber": "9061642370009",
          "classNo": 12,
          "student.name": "HRITHIK NARAYAN V",
          "student.gender": "M",
          "student.parentName": "VIMALNATH NARAYANASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "59a6a618-70ad-4902-9c70-6716676fc009",
          "admissionId": "3a44608e-7bed-44bf-8eed-cb48419f551c",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6237"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6237",
          "registrationNumber": "9020642370028",
          "classNo": 12,
          "student.name": "JAGATH RAMASAMY RAMESH",
          "student.gender": "M",
          "student.parentName": "RAMESH SUBBAYHAGOWDER RAMASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6624e61b-01bf-4fc7-9dc7-b02272537a09",
          "admissionId": "15d85dca-b62d-4876-88db-08a3b1f3e106",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6415"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6415",
          "registrationNumber": "9020642370066",
          "classNo": 12,
          "student.name": "JOSWAA MOHANA DEVAN",
          "student.gender": "M",
          "student.parentName": "DEVAN PALANIAPPAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "10b6fc4e-2784-43e3-9603-538370595be9",
          "admissionId": "79cd35b8-698b-4d63-b28b-33225bf72930",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2282"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2282",
          "registrationNumber": "1110642570047",
          "classNo": 12,
          "student.name": "MITHUN MOHITH GUNASEKARAN",
          "student.gender": "M",
          "student.parentName": "GUNASEKARAN VELLINGIRI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "79e86e70-1abf-469a-931e-85ccc12002e7",
          "admissionId": "3288b053-e88d-4c76-9f45-51ca0b255771",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7377"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7377",
          "registrationNumber": "1110642570038",
          "classNo": 12,
          "student.name": "MITHUN PRAKASH",
          "student.gender": "M",
          "student.parentName": "PRAKASH KOLATHUPALAYAM SUBBANNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f8632772-e8e8-497f-8047-53ff2d636f76",
          "admissionId": "df0da662-a633-4d1d-aa28-9cbcb86b7d65",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7458"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7458",
          "registrationNumber": "1110642570069",
          "classNo": 12,
          "student.name": "MONISHRAJ N",
          "student.gender": "M",
          "student.parentName": "NANDAKUMAR NAMASU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d262719c-8d6c-4424-969f-21f5092a6902",
          "admissionId": "51c700e5-8313-4090-a471-9e53dabaee38",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7424"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7424",
          "registrationNumber": "1110642570070",
          "classNo": 12,
          "student.name": "NANDHINI V G A",
          "student.gender": "F",
          "student.parentName": "ASHOKKUMAR G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "81aec9d0-6770-489c-8203-027879c01d53",
          "admissionId": "33860dbb-d8c2-412c-85a4-4170ade02c20",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7351"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7351",
          "registrationNumber": "1110642570005",
          "classNo": 12,
          "student.name": "NITHIK NATARAJAN",
          "student.gender": "M",
          "student.parentName": "NATARAJAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "20948b46-e29b-4f1c-bb2a-e906ac2041ac",
          "admissionId": "4c8fbe49-8982-4043-9b89-9d0bb8d0ad6d",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6392"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6392",
          "registrationNumber": "9020642370045",
          "classNo": 12,
          "student.name": "NITHIN SHAKTHI VIJI SAKTHIVEL",
          "student.gender": "M",
          "student.parentName": "SAKTHIVEL VENKATACHALAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "41724043-0603-4eb7-966f-a6cf52160cfd",
          "admissionId": "a52c6256-9a7f-4ae7-a65e-fc20ef433468",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6403"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6403",
          "registrationNumber": "9020642370048",
          "classNo": 12,
          "student.name": "PONHAREESH NANDAGIRI",
          "student.gender": "M",
          "student.parentName": "NANDAGIRI ARUMUGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ba80dfa1-9ff2-4047-8ecc-c6ad48b122e4",
          "admissionId": "d42c76e1-178a-42b8-9296-b49e44c75acd",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2254"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2254",
          "registrationNumber": "1110642570017",
          "classNo": 12,
          "student.name": "PRAHDEESH SELVARAJ",
          "student.gender": "M",
          "student.parentName": "SELVARAJ RAMASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "337d1a6f-495d-409a-94f4-c1476f3de0d1",
          "admissionId": "b9ae2321-1652-4250-9fa7-9a45d0bd47f3",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7346"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7346",
          "registrationNumber": "1110642570064",
          "classNo": 12,
          "student.name": "PRAJESH P",
          "student.gender": "M",
          "student.parentName": "PREMNATH R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ffcf349e-6170-4c82-9209-d199b40221e9",
          "admissionId": "133be3a4-3b7e-4503-bdd5-009df73b8414",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7470"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7470",
          "registrationNumber": "9062642370004",
          "classNo": 12,
          "student.name": "PRATHAP S",
          "student.gender": "M",
          "student.parentName": "SARAVANAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f5728ac5-8708-48a4-b2d3-f500060789ee",
          "admissionId": "ed39d653-de4b-4a7c-ada1-3a3e04e765a6",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6318"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6318",
          "registrationNumber": "9020642370041",
          "classNo": 12,
          "student.name": "PRITHIN ADHITHYA LOGANATHAN",
          "student.gender": "M",
          "student.parentName": "LOGANATHAN VELUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6eb88d05-7542-46b8-8ea8-5c0119085f90",
          "admissionId": "6c35bc76-96c2-40ac-8072-029f486efdb3",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7468"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7468",
          "registrationNumber": "1110642570082",
          "classNo": 12,
          "student.name": "RAKSHAMBIKHA A S",
          "student.gender": "F",
          "student.parentName": "SENTHIL KUMAR  K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "25ed3ca6-00d5-4acc-b581-96169ac2b08e",
          "admissionId": "4a080309-6190-445f-a41d-64793edf5598",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2906"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2906",
          "registrationNumber": "1110642570054",
          "classNo": 12,
          "student.name": "RITIKAA MOHAN",
          "student.gender": "F",
          "student.parentName": "MOHAN KRISHNASWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4b1329d1-6a82-4a17-8b35-2c4c65e3e946",
          "admissionId": "660d911f-11b0-4cec-87b9-499be130ff50",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7519"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7519",
          "registrationNumber": "1110642570089",
          "classNo": 12,
          "student.name": "SACHITHA S R",
          "student.gender": "F",
          "student.parentName": "RAMAKRISHNAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5e4cfb8f-00a9-40ee-86d3-690bd94897cd",
          "admissionId": "6430fb21-c06e-41bc-bcc8-5050b121c853",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7361"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7361",
          "registrationNumber": "1110642570030",
          "classNo": 12,
          "student.name": "SANGAMITHRAA A",
          "student.gender": "F",
          "student.parentName": "ANANDARAJ S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "42a0dab0-8d25-4a92-9e0d-846725f82b2d",
          "admissionId": "5818e24d-ea31-4075-8e9a-918972468b76",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6348"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6348",
          "registrationNumber": "9020642370037",
          "classNo": 12,
          "student.name": "SANJITH SELVARAJ",
          "student.gender": "M",
          "student.parentName": "SELVARAJ SADAIYAPPAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d8c947b3-0ea5-4ad7-9398-bc17acc25ba8",
          "admissionId": "82caa7d5-605d-4d0f-994c-ec66daa51f01",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7366"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7366",
          "registrationNumber": "1110642570043",
          "classNo": 12,
          "student.name": "SRI HARI SUDARSHAN S B",
          "student.gender": "M",
          "student.parentName": "BHOOPATHY S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d45f7622-7849-448b-a951-360642d1b7ff",
          "admissionId": "757f53b2-6639-4a62-9aa0-d77c63ea4595",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6319"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6319",
          "registrationNumber": "9020642370058",
          "classNo": 12,
          "student.name": "SRIVANTH VENKIDUSAMY",
          "student.gender": "M",
          "student.parentName": "VENKIDUSAMY MURUGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8a3ebe3f-a03f-4322-8982-ff6c8a0ef03c",
          "admissionId": "364bcc4b-3e81-4371-b00f-a0a53f57b91f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5044"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5044",
          "registrationNumber": "1110642570004",
          "classNo": 12,
          "student.name": "VARSHITA KUMARAGURU",
          "student.gender": "F",
          "student.parentName": "KUMARAGURU SUBRAMANIAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "03311082-fc3c-4a91-9cf1-d85ff078e694",
          "admissionId": "4551807e-9fea-4966-a36e-7706fb4864cc",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5199"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5199",
          "registrationNumber": "9020642370062",
          "classNo": 12,
          "student.name": "VIDYUT LAKSHMI NARAYANAN",
          "student.gender": "M",
          "student.parentName": "LAKSHMI NARAYANAN DHAMODHARAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "batchCode": "COIXR257N01",
          "firstBatchId": "1ad4c342-f16d-4c95-97cd-f72683f64d07",
          "firstBatchCode": "COIXR257N01",
          "firstBatchName": "NEWTON-12A2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "396a08e2-5766-47d8-ad4e-4763e09b3f45",
          "admissionId": "ebb978d9-045e-42f9-ac09-cd5de13a575f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6254"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6254",
          "registrationNumber": "9020642370017",
          "classNo": 12,
          "student.name": "AATISH ANANDRAJAN",
          "student.gender": "M",
          "student.parentName": "ANANDRAJAN RAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2e299d04-f4f0-41b9-914e-bb238aa9a892",
          "admissionId": "262c00d5-584c-4f1f-92b8-50c3c6566277",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7400"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7400",
          "registrationNumber": "1110642570041",
          "classNo": 12,
          "student.name": "ADHITHYA NATARAJAN V",
          "student.gender": "M",
          "student.parentName": "VIDHYA SAGAR NATARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ea3fa8f1-fb13-4aa7-ae02-14d9343a9bc8",
          "admissionId": "4c476473-a124-441a-a3b9-4eae67b984bc",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7331"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7331",
          "registrationNumber": "1110642570048",
          "classNo": 12,
          "student.name": "ADITYA REDDY C",
          "student.gender": "M",
          "student.parentName": "CHINNASAMY SUBRAMANIAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d11d8c47-a3c5-4129-b9ca-70f682eba48b",
          "admissionId": "12ccea68-f236-474e-be5b-f72ac9c42d0b",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7402"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7402",
          "registrationNumber": "1110642570068",
          "classNo": 12,
          "student.name": "AJJHAY K S",
          "student.gender": "M",
          "student.parentName": "SUNDARA MOORTHI K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bd2586e2-de84-4f7b-b5d9-33e6e5a90885",
          "admissionId": "5318e91d-f041-4eee-8a96-065c736e50c7",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7381"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7381",
          "registrationNumber": "1110642570075",
          "classNo": 12,
          "student.name": "AKSAI G T",
          "student.gender": "M",
          "student.parentName": "GANESH KUMAR M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9d579941-01a8-47ee-beef-5390e19a68e0",
          "admissionId": "43cbeea2-f669-4c6c-b2ce-c07ad8796fad",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2283"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2283",
          "registrationNumber": "1110642570007",
          "classNo": 12,
          "student.name": "AKSHAY DHINESH KUMAR",
          "student.gender": "M",
          "student.parentName": "DHINESH KUMAR KONDASWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e33ee6f9-0fc1-4dff-8ef7-5c4240fefc36",
          "admissionId": "826353ce-cef4-4ab7-acb5-275f46de6cef",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7429"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7429",
          "registrationNumber": "1110642570001",
          "classNo": 12,
          "student.name": "ANTONY NAVEEN A",
          "student.gender": "M",
          "student.parentName": "AROCKIA SAGAYARAJ D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "01d1b702-0c08-42de-89ab-3ce003cda2e4",
          "admissionId": "8232a11d-aee5-4034-a228-34f2bcdb536f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6307"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6307",
          "registrationNumber": "9020642370018",
          "classNo": 12,
          "student.name": "BHAVAN RAJ BASKAR",
          "student.gender": "M",
          "student.parentName": "BASKAR BAGAVATHIE",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "03f1bc55-540c-44a6-bf9c-19f748716dd6",
          "admissionId": "ae30d291-ac8a-4547-9b0c-13e755b626db",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7318"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7318",
          "registrationNumber": "1110642570015",
          "classNo": 12,
          "student.name": "DEEBAVARMAN N",
          "student.gender": "M",
          "student.parentName": "NESAMANI M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2a55e3c5-dd9e-4aab-bffd-c5d7cfb21f2b",
          "admissionId": "19eca771-9185-40be-9652-f3af33444110",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7313"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7313",
          "registrationNumber": "1110642570057",
          "classNo": 12,
          "student.name": "DEENA L",
          "student.gender": "F",
          "student.parentName": "LEONARD ASHOK M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9e1a8917-28da-4be8-8c6b-dcbb682b6b2b",
          "admissionId": "e83ad59b-400d-409d-b243-a19ab50c0592",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7335"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7335",
          "registrationNumber": "1110642570012",
          "classNo": 12,
          "student.name": "GIRIVARSSHAN S",
          "student.gender": "M",
          "student.parentName": "SARAVANAKUMAR R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2e4eb93a-2853-4831-993b-bbf19f4c475c",
          "admissionId": "a3100ecf-f8f7-494d-9bed-8f1d53fa1050",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7477"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7477",
          "registrationNumber": "1062662470004",
          "classNo": 12,
          "student.name": "HARSHAN VEL",
          "student.gender": "M",
          "student.parentName": "PALANIVELRAJA ARUMUGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b86b168b-3994-4759-92ff-d1c26c0ad3c9",
          "admissionId": "87b10a65-22b1-4043-ae71-0808e3fbe185",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7413"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7413",
          "registrationNumber": "1110642570021",
          "classNo": 12,
          "student.name": "HEMANTH S",
          "student.gender": "M",
          "student.parentName": "SRINIVASAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2f6e3a8c-b0b7-4213-8c04-39243bf3bfd9",
          "admissionId": "bba27338-c667-4f6f-85f3-fc729c67cd08",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7411"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7411",
          "registrationNumber": "1110642570053",
          "classNo": 12,
          "student.name": "INIYAA K K",
          "student.gender": "F",
          "student.parentName": "KATHIRESAN P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9cdab72c-1171-45b1-9eb2-43fb7ba1db6c",
          "admissionId": "80ade2eb-6aa7-4a3b-be72-3de958b78f9c",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7376"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7376",
          "registrationNumber": "1110642570009",
          "classNo": 12,
          "student.name": "JAIKRISH G",
          "student.gender": "M",
          "student.parentName": "GOPALAKRISHNAN M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8d357dd6-4a8e-4ed1-93ee-423977ffd3c4",
          "admissionId": "ae95f8c5-d8ef-4651-afbe-010c52017c06",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7371"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7371",
          "registrationNumber": "1110642570076",
          "classNo": 12,
          "student.name": "JAYABRAGADEESH B",
          "student.gender": "M",
          "student.parentName": "BALAMURUGAN N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4aa76008-8209-437b-9f51-df75cc73e541",
          "admissionId": "e259c5d8-f936-4a26-aba1-330fe969afa4",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7489"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7489",
          "registrationNumber": "1061662470002",
          "classNo": 12,
          "student.name": "JEET VEESHAL BAFNA",
          "student.gender": "M",
          "student.parentName": "VEESHAL S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "61f7ef31-b1d0-49dd-8d3b-fab966f66fad",
          "admissionId": "4aaa713a-4d10-44fa-ae2b-21c572003f97",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7380"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7380",
          "registrationNumber": "1110642570074",
          "classNo": 12,
          "student.name": "MADAN KUMAR S",
          "student.gender": "M",
          "student.parentName": "SAKTHIVEL L",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ea4f3060-deca-438f-8434-4312135e1264",
          "admissionId": "03bf11e1-e727-47b5-afd3-2b8eba74acbb",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7452"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7452",
          "registrationNumber": "1110642570008",
          "classNo": 12,
          "student.name": "MIHIR SHRIDHAR AVACHAT",
          "student.gender": "M",
          "student.parentName": "SHRIDHAR ASHOK AVACHAT",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c1b22d71-72a6-44a8-82ab-dc02b5941488",
          "admissionId": "3ae635e9-610c-43c7-8d01-a88ebc73c39a",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7484"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7484",
          "registrationNumber": "9062642370014",
          "classNo": 12,
          "student.name": "MITHUN A S",
          "student.gender": "M",
          "student.parentName": "SOCKALINGAM A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "95808b81-782f-4794-9c91-5a678bbbea1d",
          "admissionId": "e06a6a88-0a4d-4050-8adf-f76a1feafdcb",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7448"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7448",
          "registrationNumber": "1110642570049",
          "classNo": 12,
          "student.name": "NAREN RAGAV",
          "student.gender": "M",
          "student.parentName": "RAM DHINESH V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ac6dff9c-fdc2-4677-89f3-045cb60942d9",
          "admissionId": "4211ab4a-e839-45fe-9532-820f4dcd7582",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7339"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7339",
          "registrationNumber": "1110642570023",
          "classNo": 12,
          "student.name": "NAREN T",
          "student.gender": "M",
          "student.parentName": "THIYAGARAJAN D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a41b1194-5df9-4724-a51d-cf95a2716fd7",
          "admissionId": "f328f1e4-4124-4a72-af26-cecee4d2def8",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7433"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7433",
          "registrationNumber": "1110642570080",
          "classNo": 12,
          "student.name": "PRADHYUN BALA P S",
          "student.gender": "M",
          "student.parentName": "SANTHOSH P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "fad789f8-a224-49be-81ef-6baef997fd0f",
          "admissionId": "3f3afc1a-e237-479d-a96a-b32cc2ccc4a5",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3415"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3415",
          "registrationNumber": "9020642370001",
          "classNo": 12,
          "student.name": "RAHUL VETRIVEL",
          "student.gender": "M",
          "student.parentName": "VETRIVEL DURAISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "99d2dd76-1073-4a28-823f-6f3e1f3b43ae",
          "admissionId": "670f1d5a-4a49-452c-84be-498eb68fa276",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7369"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7369",
          "registrationNumber": "1110642570077",
          "classNo": 12,
          "student.name": "REMIYAN K K",
          "student.gender": "M",
          "student.parentName": "KATHIRVEL K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "95ca411f-9a14-49ff-a2a7-cc077057f14f",
          "admissionId": "c7be8579-e906-4ec1-b5ae-66e5352b8017",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7404"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7404",
          "registrationNumber": "1062662470001",
          "classNo": 12,
          "student.name": "RIDDHI K",
          "student.gender": "F",
          "student.parentName": "KARTHIKEYAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8471c391-cbab-4b35-8011-fafd22a52f03",
          "admissionId": "f3a586c3-0604-4705-beed-2b303e3c2d77",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6315"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6315",
          "registrationNumber": "9020642370014",
          "classNo": 12,
          "student.name": "RIYA TOLSTOY",
          "student.gender": "F",
          "student.parentName": "TOLSTOY KALAI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "cadfe933-9a40-4dcf-85cd-8ca6aaeafe24",
          "admissionId": "8111abae-3a26-482f-aed9-5e3fcbf303be",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6174"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6174",
          "registrationNumber": "1110642570042",
          "classNo": 12,
          "student.name": "ROHITH SOMASUNDARAM",
          "student.gender": "M",
          "student.parentName": "SOMASUNDARAM PALANISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2e9d2f8a-1472-4777-b926-ce3e3ec1a800",
          "admissionId": "5e136f77-b2c2-4c51-a15e-4d89827ec9a9",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7372"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7372",
          "registrationNumber": "1110642570045",
          "classNo": 12,
          "student.name": "SAI KRISHNA R",
          "student.gender": "M",
          "student.parentName": "RAJESH K",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2bb8cb88-364f-4e6a-8de5-a096a15447a9",
          "admissionId": "ddb90621-c7b6-4cfe-91d7-2f0aed41c633",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7407"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7407",
          "registrationNumber": "1110642570051",
          "classNo": 12,
          "student.name": "SELVA SARVANTHIKA R",
          "student.gender": "F",
          "student.parentName": "RAVIKUMAR SIVASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9a8247ab-535c-46df-b53a-f64b5a83584e",
          "admissionId": "5474243f-6104-459e-a17c-137c8edf1192",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7336"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7336",
          "registrationNumber": "1110642570022",
          "classNo": 12,
          "student.name": "SHANTHOSH V",
          "student.gender": "M",
          "student.parentName": "VENUGOPAL D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bca98156-8495-4593-8905-aaf152f1831f",
          "admissionId": "abdda2a9-7530-4647-8983-79b0daacd84f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6360"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6360",
          "registrationNumber": "9020642370035",
          "classNo": 12,
          "student.name": "SREEHARAN SHIVKUMAR",
          "student.gender": "M",
          "student.parentName": "SHIVKUMAR KANDASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7277435b-e89e-442e-979d-844a42467367",
          "admissionId": "9f804ea9-4832-452f-bfe9-887c29becff0",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6285"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6285",
          "registrationNumber": "9020642370064",
          "classNo": 12,
          "student.name": "SRINATH BOOPALAN",
          "student.gender": "M",
          "student.parentName": "BOOPALAN  DEIVAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e8a18be0-f591-4be1-bb68-a7706edcc6c6",
          "admissionId": "9a4cbdee-915c-495d-8fb1-b129fe4cbd6f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7342"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7342",
          "registrationNumber": "1110642570040",
          "classNo": 12,
          "student.name": "SUDHAN L S",
          "student.gender": "M",
          "student.parentName": "LOKESH R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bb9cae83-c8b5-46c3-a2b8-233a952b17c8",
          "admissionId": "67ca793e-0677-4cba-92b6-06dd4c6da561",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6402"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6402",
          "registrationNumber": "9020642370047",
          "classNo": 12,
          "student.name": "SUKANT RAMESH",
          "student.gender": "M",
          "student.parentName": "RAMESH SULTANPET RANGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ba4e6aba-88db-4e06-a89d-e19e87364974",
          "admissionId": "3a404aa0-86ca-4555-9785-9eb378261562",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7437"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7437",
          "registrationNumber": "1110642570078",
          "classNo": 12,
          "student.name": "TEJASH RAJA",
          "student.gender": "M",
          "student.parentName": "RAJA ARUMUGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2ca5a420-99a3-43a7-9ac3-d8c9caff5b82",
          "admissionId": "b8ccad34-9f23-4930-8c7a-51e704bcb324",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6316"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6316",
          "registrationNumber": "9020642370021",
          "classNo": 12,
          "student.name": "THARUN TOLSTOY",
          "student.gender": "M",
          "student.parentName": "TOLSTOY KALAI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a851ffc9-1d8c-4cf1-bfd9-1862f6220cc3",
          "admissionId": "821516f0-d085-48fb-9ef1-97f6b66cf8f5",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7471"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7471",
          "registrationNumber": "1061662470004",
          "classNo": 12,
          "student.name": "VIWINDURAI",
          "student.gender": "M",
          "student.parentName": "PANDIDURAI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8139b08b-f259-4765-a69f-96da5e444fc5",
          "admissionId": "bd20c261-1330-4b9e-849d-8b277b17fc7f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6399"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6399",
          "registrationNumber": "9020642370067",
          "classNo": 12,
          "student.name": "YAAZHVENDHAN MAHADEVAN",
          "student.gender": "M",
          "student.parentName": "MAHADEVAN APPUKUTTY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6f3c756c-92e0-4f3f-858e-9789447f2a50",
          "admissionId": "4a5c9ec0-5940-4fee-be99-0d00320ed599",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7389"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7389",
          "registrationNumber": "1110642570028",
          "classNo": 12,
          "student.name": "YAJNESH S",
          "student.gender": "M",
          "student.parentName": "SUDHARSAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "batchCode": "COIXR257C01",
          "firstBatchId": "23b61a74-3b9d-424f-a786-4399eb3e451b",
          "firstBatchCode": "COIXR257C01",
          "firstBatchName": "CURIE-12A3",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "efd56170-fdc7-43cd-b1b6-f86b9fd1608d",
          "admissionId": "f804d2fb-c7b1-4589-8ce6-749d5ed920ad",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7333"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7333",
          "registrationNumber": "1110642570032",
          "classNo": 12,
          "student.name": "ABHINANDAN LAKSHMANASAMY",
          "student.gender": "M",
          "student.parentName": "LAKSHMANASAMY P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "987210b4-7f90-4ba9-accd-ee898917638e",
          "admissionId": "30ba0b92-8a53-4c54-b72d-712ca12ac718",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7479"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7479",
          "registrationNumber": "1110642570086",
          "classNo": 12,
          "student.name": "AKILAN A",
          "student.gender": "M",
          "student.parentName": "ATHISIVAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "705253e0-9f22-4ca3-8ccb-6dceeb4e76fc",
          "admissionId": "4f34b3b7-cf04-4475-ae3b-6f15be77f537",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6251"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6251",
          "registrationNumber": "9020642370069",
          "classNo": 12,
          "student.name": "AKSHATHH SATHISH SANGEETHA",
          "student.gender": "M",
          "student.parentName": "SATHISH NALLASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "698297fe-b59f-44dd-84dc-261889ad9130",
          "admissionId": "61461f9b-5b70-4c5b-857c-a6434d7bc126",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2480"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2480",
          "registrationNumber": "9020642370075",
          "classNo": 12,
          "student.name": "ARVIND SEYON RAVICHANDHAR",
          "student.gender": "M",
          "student.parentName": "RAVICHANDHAR SUBRAMANIAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6459fc30-aeb2-40c9-a00f-c531db73fedd",
          "admissionId": "d1176bc3-c0ae-4117-81c1-68afe803cb65",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7415"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7415",
          "registrationNumber": "1110642570065",
          "classNo": 12,
          "student.name": "ASWIN P",
          "student.gender": "M",
          "student.parentName": "PALANIVEL D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "655e4b1a-f126-4ecc-b572-d6c3532d4e60",
          "admissionId": "a0a36834-1e7f-4efb-9916-e413ed5f156d",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7386"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7386",
          "registrationNumber": "1110642570055",
          "classNo": 12,
          "student.name": "BASAVI S",
          "student.gender": "F",
          "student.parentName": "SANTHANAKRISHNAN D",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c7091f2a-d1ec-406d-ae63-5aa1955ed039",
          "admissionId": "f11f69e5-73d7-44e3-b414-2f3ef500f790",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7473"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7473",
          "registrationNumber": "1110642570083",
          "classNo": 12,
          "student.name": "DHARSHINI S S",
          "student.gender": "F",
          "student.parentName": "SATHIYAMOORTHY S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "053ec543-cb9e-4302-9c53-36790d20ad6f",
          "admissionId": "da4214c0-bed6-4b03-ae66-d32c5658a316",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7311"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7311",
          "registrationNumber": "1110642570018",
          "classNo": 12,
          "student.name": "DHEERENDERA R J",
          "student.gender": "M",
          "student.parentName": "RAMASAMY KONDAMA NAICKER",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "35a088f8-85b0-42d7-890b-ff2142d61c30",
          "admissionId": "8bbd6df5-25ec-4b65-bb23-8b0f04e6f6c1",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6391"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6391",
          "registrationNumber": "9020642370059",
          "classNo": 12,
          "student.name": "HARISH RAJKUMAR",
          "student.gender": "M",
          "student.parentName": "RAJKUMAR MANICKAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "044fc796-ef2d-4456-86f9-4d6acbfef336",
          "admissionId": "14e84891-f95e-4bd2-a402-72e334bbbafc",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7410"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7410",
          "registrationNumber": "1110642570010",
          "classNo": 12,
          "student.name": "JAI HARSHATH A R",
          "student.gender": "M",
          "student.parentName": "ARIVOLI A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "18b18e53-eccb-4c0c-9ef8-83fcf498ead4",
          "admissionId": "15da4803-c17d-41cf-b626-4d8b058e36cb",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7375"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7375",
          "registrationNumber": "1110642570002",
          "classNo": 12,
          "student.name": "JAISHREE G",
          "student.gender": "F",
          "student.parentName": "GOPALAKRISHNAN M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "77b400d6-08f2-44ea-ba15-33a47d1ede2f",
          "admissionId": "74eb685c-e50b-4246-bf10-4a145eb10faa",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4176"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4176",
          "registrationNumber": "9020642370005",
          "classNo": 12,
          "student.name": "JAIVANTH GUHAAN VIDHYAPRABHA",
          "student.gender": "M",
          "student.parentName": "GUHAAN SUBRAMANIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e58f3911-231d-4fd7-951c-71be87ba37ce",
          "admissionId": "a118fce8-977f-4953-8b54-dcb64f116acb",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7382"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7382",
          "registrationNumber": "1110642570066",
          "classNo": 12,
          "student.name": "JEEVAPRASATH T",
          "student.gender": "M",
          "student.parentName": "THAMARAISELVAN G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6c1961b8-0b2b-47f6-a4c3-60cbc66f6c5b",
          "admissionId": "e6a4d4de-1603-452c-9d57-9798bdcbc6f8",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7465"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7465",
          "registrationNumber": "1110642570036",
          "classNo": 12,
          "student.name": "KALANITHI K P",
          "student.gender": "M",
          "student.parentName": "PERIASAMI K P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bf306685-2d8e-416d-8204-9f6683e5c20c",
          "admissionId": "aedcf289-7305-4558-bca4-761b3d34b98b",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7385"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7385",
          "registrationNumber": "1110642570071",
          "classNo": 12,
          "student.name": "KARTHIKEYA V S",
          "student.gender": "M",
          "student.parentName": "VIJAYAKUMAR P D R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c5d27021-99ed-4198-8302-d573638f6cc2",
          "admissionId": "f373dfa9-d1ad-493e-96f1-9e0f031dbe04",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7457"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7457",
          "registrationNumber": "1110642570081",
          "classNo": 12,
          "student.name": "KEERTIVARSAN K R",
          "student.gender": "M",
          "student.parentName": "RAJASEKARAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c6f99365-306e-410e-b875-0a5f76223a10",
          "admissionId": "159d93ca-66c5-4c09-a79e-6f39f689a1ce",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6269"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6269",
          "registrationNumber": "9020642370033",
          "classNo": 12,
          "student.name": "MAHASREE JAYAVANJESWARARAJ",
          "student.gender": "F",
          "student.parentName": "JAYAVANJESWARARAJ DHARMARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "07a921fd-4ffe-4a76-8a77-7aeca9cfa495",
          "admissionId": "0327b060-1da4-4eea-9b95-e16068188a91",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6374"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6374",
          "registrationNumber": "9020642370039",
          "classNo": 12,
          "student.name": "NAKHUL KARTHIKEYAN",
          "student.gender": "M",
          "student.parentName": "KARTHIKEYAN PALANIYAPPAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "309f8491-3110-4b7f-846b-97b59a24f605",
          "admissionId": "836030b5-e1f0-4a03-90f1-b8027dbf7768",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7492"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7492",
          "registrationNumber": "1110642570085",
          "classNo": 12,
          "student.name": "NITHISH P K",
          "student.gender": "M",
          "student.parentName": "PONNAIAH A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7f9ab366-97f1-4ff4-b09e-7f57a9f824eb",
          "admissionId": "f9839f77-aaa9-4cbf-bd1b-5ab13c88eed7",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7360"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7360",
          "registrationNumber": "1110642570024",
          "classNo": 12,
          "student.name": "NITHISH SANDRON S",
          "student.gender": "M",
          "student.parentName": "SRINIVASAN A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "81825ae9-337a-47f0-8245-8f60f2b702b1",
          "admissionId": "3f99ac8f-38c3-4bdd-9ae4-08973a39460b",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7474"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7474",
          "registrationNumber": "1110642570088",
          "classNo": 12,
          "student.name": "PAVAN R",
          "student.gender": "M",
          "student.parentName": "RAMARAJ RAMASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "3e58b9da-0166-4f4d-b408-dfaf312cf4ae",
          "admissionId": "a09c54d1-9d41-421b-b568-34d7f6b420a6",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7320"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7320",
          "registrationNumber": "1110642570050",
          "classNo": 12,
          "student.name": "PRASHANTH S",
          "student.gender": "M",
          "student.parentName": "SARAVANAN S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2d54f2ca-6b4b-4acb-b612-f063617b9203",
          "admissionId": "19723d0c-bf62-4e2d-bdca-b1c2aca7aeb7",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6279"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6279",
          "registrationNumber": "9020642370077",
          "classNo": 12,
          "student.name": "RAKHUL VINAAYAK SANTHANALAKSHMI VENKIDUSAMY",
          "student.gender": "M",
          "student.parentName": "VENKIDUSAMY SELVARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a39ed148-ba99-45b0-bce6-10e777a2a2a2",
          "admissionId": "adf6b689-c1b5-4756-b3d2-ef5577084188",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7387"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7387",
          "registrationNumber": "1110642570006",
          "classNo": 12,
          "student.name": "RAMKISHVANTH P G",
          "student.gender": "M",
          "student.parentName": "GANESH K P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "495f6f50-5523-4ea9-8833-c5f908c8ad0b",
          "admissionId": "c6468d44-a940-434d-a8c0-5be49f5e2ab7",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7501"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7501",
          "registrationNumber": "1110642570084",
          "classNo": 12,
          "student.name": "RISHIKESAVAN S",
          "student.gender": "M",
          "student.parentName": "SELVAM A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "19f36682-3308-4a19-8670-a0d533e7bf13",
          "admissionId": "45063b8a-a959-4f7a-9dad-94f195641d3e",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7370"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7370",
          "registrationNumber": "1110642570014",
          "classNo": 12,
          "student.name": "RUHAN SELVAKUMAR",
          "student.gender": "M",
          "student.parentName": "SELVAKUMAR NADARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "8aaf1a58-93b2-422e-9022-4499f00c15a5",
          "admissionId": "edac5ff1-0861-4051-a987-268497d77ff3",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5642"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5642",
          "registrationNumber": "9020642370068",
          "classNo": 12,
          "student.name": "SACHIV RAMESH SUMITRA",
          "student.gender": "M",
          "student.parentName": "RAMESH RANGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "eac39e62-e23e-4ecb-89db-39199d1713b9",
          "admissionId": "59a49f75-84c6-48c8-bf16-941211621add",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7460"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7460",
          "registrationNumber": "9062642370016",
          "classNo": 12,
          "student.name": "SARVESH D M",
          "student.gender": "M",
          "student.parentName": "DURAISWAMY N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "47117cdb-1f62-42dd-a900-730fcfcad5e3",
          "admissionId": "e2031655-7ca2-4acd-8211-f09073352508",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6143"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6143",
          "registrationNumber": "1110642570016",
          "classNo": 12,
          "student.name": "SIDDHARTH SARAVANAKUMAR",
          "student.gender": "M",
          "student.parentName": "SARAVANAKUMAR MANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d9b6c0ee-ce18-401e-bce1-54d32c61e6f7",
          "admissionId": "b75a0791-b543-47ea-b72d-17856cbb63d4",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7401"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7401",
          "registrationNumber": "1110642570052",
          "classNo": 12,
          "student.name": "SUJAN V A",
          "student.gender": "M",
          "student.parentName": "ASHOK V",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5029fcb5-b0af-4e28-8e91-c36227879c7c",
          "admissionId": "cee826af-0d73-4177-b2af-e2cc71275f79",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6220"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6220",
          "registrationNumber": "9020642370027",
          "classNo": 12,
          "student.name": "SUKRIT GURUSWAMY SENTHILKUMAR",
          "student.gender": "M",
          "student.parentName": "SENTHILKUMAR GURUSWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "52838322-0ef4-4f23-8f7f-b7bed1ee1f29",
          "admissionId": "423378c5-46c0-41fc-8994-0ea3b564a63d",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7325"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7325",
          "registrationNumber": "1110642570060",
          "classNo": 12,
          "student.name": "VETTRI RAVISANKAR",
          "student.gender": "M",
          "student.parentName": "RAVISANKAR KANDASAMYRENGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "d417692d-75af-49d2-8a90-d99a10863494",
          "programName": "ELEVATE - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "batchCode": "COIXR257T01",
          "firstBatchId": "5a02b40e-0ec8-4ac8-a30a-6cecba0f951f",
          "firstBatchCode": "COIXR257T01",
          "firstBatchName": "TESLA-12A4",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "12c7ef7e-7aab-49da-9bbe-6bfcc7355cbd",
          "admissionId": "ced0f7ec-a506-4277-beb6-685357b646ac",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "3779"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "3779",
          "registrationNumber": "9020642370016",
          "classNo": 12,
          "student.name": "AARUSHI DEVI KEERTHHI DHEVI ARAVINDH",
          "student.gender": "F",
          "student.parentName": "ARAVINDH SOMASUNDARAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f41b563b-8201-4e9e-ae44-49f886af5146",
          "admissionId": "f6e543f5-cefd-4fc4-9655-8d987b4b1109",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7358"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7358",
          "registrationNumber": "1130642570019",
          "classNo": 12,
          "student.name": "ABIDEJASWINI P",
          "student.gender": "F",
          "student.parentName": "PRAVEEN PRABU G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a9cb73e0-e00b-4ffe-a4a6-da2e2cee97cf",
          "admissionId": "b4b72744-9508-4bd2-951c-d35a4fd7cce0",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2238"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2238",
          "registrationNumber": "1130642570024",
          "classNo": 12,
          "student.name": "ADHIDTH HARISHBABU PRIYA",
          "student.gender": "M",
          "student.parentName": "HARISH BABU SUBBAIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ce8067d6-7094-42fe-8bef-abdb54665631",
          "admissionId": "b639d8bd-6663-468d-afe1-80ba0b9aa827",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4205"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4205",
          "registrationNumber": "9020642370024",
          "classNo": 12,
          "student.name": "ANUNITHA SHRI VIJAYAKUMAR",
          "student.gender": "F",
          "student.parentName": "VIJAYAKUMAR RAJU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e6a7f21d-d2be-4e1d-b311-b684f8f4857f",
          "admissionId": "38a6f23c-628f-4edb-9395-2a5f2d19f0b9",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6284"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6284",
          "registrationNumber": "9020642370026",
          "classNo": 12,
          "student.name": "ASHWIN KARTHICK RAJASEKARAN",
          "student.gender": "M",
          "student.parentName": "RAJASEKARAN DEVARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c8351b86-c151-457c-8129-4a693e0d9cb3",
          "admissionId": "bddff928-cdef-4546-85d5-4e4ec8ee9f0d",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6238"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6238",
          "registrationNumber": "9020642370025",
          "classNo": 12,
          "student.name": "DEEPA PALANISAMY",
          "student.gender": "F",
          "student.parentName": "PALANISAMY SUNDARARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a4df97d8-e60c-4769-b32b-f36232248f37",
          "admissionId": "d62f6a00-5951-4c40-ad32-32b9d1dcae7e",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6245"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6245",
          "registrationNumber": "9020642370008",
          "classNo": 12,
          "student.name": "FARIHAH THASNEEM SYED UMMAR",
          "student.gender": "F",
          "student.parentName": "SYED UMMAR IBRAHIM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "0a1c90b1-3f07-4e42-b161-f785f9201b4f",
          "admissionId": "54f7b33c-4aa8-4e44-becb-a320cf9f6f01",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7395"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7395",
          "registrationNumber": "1130642570003",
          "classNo": 12,
          "student.name": "GAUTAM DHANASEKARAN",
          "student.gender": "M",
          "student.parentName": "DHANASEKARAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1ec8fda5-be55-4b41-87ff-46f6257b2f2a",
          "admissionId": "b11f62ab-c645-4b5e-b6d0-53da43ce8cb6",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6299"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6299",
          "registrationNumber": "9020642370032",
          "classNo": 12,
          "student.name": "HAAVISH AMBALAM UMASHANKAR CHITRA",
          "student.gender": "M",
          "student.parentName": "UMASHANKAR AMBALAM MANICKAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a462608b-0a6b-4ec6-8efc-70e714ef28f3",
          "admissionId": "04efb4aa-3fd7-43fa-a064-9b56ec6142d3",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7363"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7363",
          "registrationNumber": "1130642570013",
          "classNo": 12,
          "student.name": "HARAN S CHINNASWAMY",
          "student.gender": "M",
          "student.parentName": "CHINNASWAMY SHANTHAKUMAR",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9be4b7af-fdf3-462b-adb9-2d5150128c9a",
          "admissionId": "21c646a3-38df-4a1a-ae6e-d6569bcd6bb8",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2280"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2280",
          "registrationNumber": "1130642570010",
          "classNo": 12,
          "student.name": "ILANGKUMARAN ARUL PRASAD",
          "student.gender": "M",
          "student.parentName": "ARUL PRASAD PERIYASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7711377d-16e8-4f4a-a838-6914c5f1e49c",
          "admissionId": "e7bfacd3-bb19-484b-8898-8ec5de572bff",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2907"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2907",
          "registrationNumber": "9020642370015",
          "classNo": 12,
          "student.name": "JIA BIVIN",
          "student.gender": "F",
          "student.parentName": "BIVIN WILSON",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f736b7dd-05bf-4dd8-a352-9ef651c0465f",
          "admissionId": "9ce97544-9a99-4034-9356-e8610b39da29",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6390"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6390",
          "registrationNumber": "9020642370042",
          "classNo": 12,
          "student.name": "KAVYASRI RAMESHKUMAR",
          "student.gender": "F",
          "student.parentName": "RAMESHKUMAR THANGAVEL",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b8100dfb-f8df-45b3-8116-d36584693840",
          "admissionId": "bbd5a6fb-873b-4204-a12b-91bb978115f1",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7391"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7391",
          "registrationNumber": "1130642570004",
          "classNo": 12,
          "student.name": "KHAVIN SIDDHARTH R",
          "student.gender": "M",
          "student.parentName": "RAVINDRAN RANGASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "92ab3ab4-da4a-4525-8c07-5e3ca70c9187",
          "admissionId": "c8c8644e-00e7-4c17-a155-c8a483377050",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2230"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2230",
          "registrationNumber": "1130642570006",
          "classNo": 12,
          "student.name": "KIRUTHI SHRAVAN MUTHUKUMAR",
          "student.gender": "M",
          "student.parentName": "MUTHUKUMAR PONNUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "51633551-4da3-46ec-9e73-96a220c43858",
          "admissionId": "b35ef4f5-6e2a-4819-aede-f0626d3ee3a6",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6311"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6311",
          "registrationNumber": "9020642370007",
          "classNo": 12,
          "student.name": "KRISHAN MUTHU",
          "student.gender": "M",
          "student.parentName": "MUTHU KALIYAMOORTHY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6c162b20-8c71-4216-aa44-89d7331a9916",
          "admissionId": "72d821df-ea31-484f-a33a-2ae10b5f7dfc",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6222"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6222",
          "registrationNumber": "9020642370013",
          "classNo": 12,
          "student.name": "NEHA ARUN",
          "student.gender": "F",
          "student.parentName": "ARUN KUMAR DURAIRAJU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "815d0c11-d7a8-4dc5-acd8-277cb33a4b9d",
          "admissionId": "2fd56dbe-85a8-4af8-a97b-57939eaabbd7",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6304"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6304",
          "registrationNumber": "9020642370046",
          "classNo": 12,
          "student.name": "NETHRA KARTHIGEYAN",
          "student.gender": "F",
          "student.parentName": "KARTHIGEYAN KANDASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c0c990d5-5ef5-4e87-b049-b9079f026208",
          "admissionId": "baa7d75e-bb5c-4e6d-b418-f440ca5cf06f",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2237"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2237",
          "registrationNumber": "1130642570007",
          "classNo": 12,
          "student.name": "NETHRA LAKSHMI SATHISH KUMAR",
          "student.gender": "F",
          "student.parentName": "SATHISH KUMAR THIRUVENKATASAMY GOVINDARAJU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "35b8e448-418f-4a78-94de-fcbd3fcf28bb",
          "admissionId": "7186f9b1-9333-4ccc-8fcd-708c2f8051c8",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2440"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2440",
          "registrationNumber": "1130642570020",
          "classNo": 12,
          "student.name": "NETHRA PALANISAMY",
          "student.gender": "F",
          "student.parentName": "PALANISAMY SRINIVASAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "694c3a82-d92c-4cdc-9504-2490ed3d4df2",
          "admissionId": "b1ad3e6b-d505-40dc-8ef9-3de00a53ac56",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7408"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7408",
          "registrationNumber": "1130642570002",
          "classNo": 12,
          "student.name": "NITHIN S",
          "student.gender": "M",
          "student.parentName": "SREENATH P G",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "7383aaad-e35c-40c4-8e78-c80262d26276",
          "admissionId": "e0a7d891-5734-4d53-a337-6ae13ea352f9",
          "createdAt": "2026-11-12T06:35:16.309Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2483"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2483",
          "registrationNumber": "1130642570022",
          "classNo": 12,
          "student.name": "RITHANYA SAKTHIVEL",
          "student.gender": "F",
          "student.parentName": "SAKTHIVEL ANANTHARAJ",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "00760fbe-9435-4304-85a9-29c9cb156cd8",
          "admissionId": "a3c9f9d4-36a1-4d07-8cf4-bcc060469a17",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2446"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2446",
          "registrationNumber": "9020642370052",
          "classNo": 12,
          "student.name": "SARAH NATHALYA JESURAJ",
          "student.gender": "F",
          "student.parentName": "LAWRANCE JESURAJ  MASILAMANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1cb0bc80-26a7-46bc-baa6-ebeff8ca22f9",
          "admissionId": "ee25c604-ee01-49e2-a0b1-bdc2f668de4c",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2487"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2487",
          "registrationNumber": "1130642570005",
          "classNo": 12,
          "student.name": "SHRAVVANTHY CHANDRAPRIYA SIVAKUMAR",
          "student.gender": "F",
          "student.parentName": "SIVAKUMAR SUBRAMANIAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e2318293-3531-4b40-a8cf-711a9435c6b6",
          "admissionId": "797b0598-800f-410a-b966-caa2344a45ec",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7316"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7316",
          "registrationNumber": "1130642570009",
          "classNo": 12,
          "student.name": "SIDDHARTH S",
          "student.gender": "M",
          "student.parentName": "SELVAKUMAR SOUNDARARAJAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9f80b0ba-c6f7-4116-b607-e26cc331db76",
          "admissionId": "232ea99e-073d-47c0-bbc1-5ae82ec31bf9",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6283"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6283",
          "registrationNumber": "9020642370063",
          "classNo": 12,
          "student.name": "SIDDHARTH SENTHIL KUMAR JOTHIMANI",
          "student.gender": "M",
          "student.parentName": "SENTHIL KUMAR KALIAPPAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "221e5f5c-e752-48b4-a41d-1135c86444ca",
          "admissionId": "94782584-07bd-4ee7-abb4-33647f7eca62",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4028"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4028",
          "registrationNumber": "1130642570015",
          "classNo": 12,
          "student.name": "SRINIDHI DEEPAK JAYAPRIYA",
          "student.gender": "F",
          "student.parentName": "DEEPAK PALANISWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1c12506c-0119-4d7d-8888-e72000979fed",
          "admissionId": "1d6a2223-7915-4331-beda-80848fb1c56b",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6417"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6417",
          "registrationNumber": "9020642370080",
          "classNo": 12,
          "student.name": "SRISANTH SAKTHIVADIVEL",
          "student.gender": "M",
          "student.parentName": "SAKTHIVADIVEL SANTHANAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b165a9e7-7ab3-41d5-b455-81b22b2678e2",
          "admissionId": "5fdd8e95-2007-464d-804d-b0df021e21aa",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7350"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7350",
          "registrationNumber": "1130642570021",
          "classNo": 12,
          "student.name": "SRIYA SIVAKUMAR",
          "student.gender": "F",
          "student.parentName": "SIVAKUMAR SOMASUNDARAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b703359a-2708-4470-9b7f-b6b22305a8f6",
          "admissionId": "3a5e4daf-83a6-4240-bb80-df26e7fed936",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7384"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7384",
          "registrationNumber": "1130642570016",
          "classNo": 12,
          "student.name": "VIVASVATH HAREN J K",
          "student.gender": "M",
          "student.parentName": "KANNAN R",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "batchCode": "COIXM257A01",
          "firstBatchId": "303718ac-0b1c-4981-8e89-d528083557ef",
          "firstBatchCode": "COIXM257A01",
          "firstBatchName": "ARISTOTLE-12Z1",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "060d33a6-922d-4b9a-93fd-efa70bbc7684",
          "admissionId": "23956b05-dd9b-48ea-9f07-75bf7fbb39f0",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7447"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7447",
          "registrationNumber": "1130642570025",
          "classNo": 12,
          "student.name": "AADEVAN BOSE",
          "student.gender": "M",
          "student.parentName": "VENKATESH",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "2786095d-b7bc-4d72-b82c-7ec0ef6165fd",
          "admissionId": "908e6dcb-2048-4560-a983-6bb9ab66da95",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7464"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7464",
          "registrationNumber": "1130642570026",
          "classNo": 12,
          "student.name": "AAKSHAYA ALAMEL R",
          "student.gender": "F",
          "student.parentName": "RAMESH N",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "1ec8f3c0-55f2-430b-b537-8773896de178",
          "admissionId": "83af932d-1872-4e3c-94de-0f820616c132",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2236"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2236",
          "registrationNumber": "9020642370082",
          "classNo": 12,
          "student.name": "AJAI KRISHNA RAJASEKAR",
          "student.gender": "M",
          "student.parentName": "RAJASEKAR JAGADEESAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9da61929-5e08-45a4-ba21-e9f1ca7015b9",
          "admissionId": "c5113107-e907-484c-908b-44632d60be34",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7486"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7486",
          "registrationNumber": "1130642570031",
          "classNo": 12,
          "student.name": "ALVIN S B",
          "student.gender": "M",
          "student.parentName": "SURESH BABU",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a7abefd4-1827-48e4-869f-82fc1faf1fe3",
          "admissionId": "5e122c34-0f34-4017-8ee3-93c809e7a22f",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6139"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6139",
          "registrationNumber": "1130642570012",
          "classNo": 12,
          "student.name": "ANANYA SATHIYANATHAN",
          "student.gender": "F",
          "student.parentName": "SATHIYANATHAN DURAISAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6848c555-636b-4384-be11-81e20c7b0f04",
          "admissionId": "b5c990d0-668b-49df-b51a-c5c9651f1edb",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7315"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7315",
          "registrationNumber": "1130642570017",
          "classNo": 12,
          "student.name": "ANNIE SUSAN A",
          "student.gender": "F",
          "student.parentName": "ANILKUMAR P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "cbaa77e5-d793-43e7-8eee-5d50156af1ed",
          "admissionId": "97679142-e28c-4f4e-bb1b-4e630bef56b7",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6287"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6287",
          "registrationNumber": "9020642370081",
          "classNo": 12,
          "student.name": "BHARATH NARENDRAN DEVAPRASATH",
          "student.gender": "M",
          "student.parentName": "DEVAPRASATH SIVALINGAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "5783bccd-ecd0-45b2-b924-241c9c0a960f",
          "admissionId": "07b2d290-d7d5-4606-aa5e-cd3bf9e874c1",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7497"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7497",
          "registrationNumber": "1130642570008",
          "classNo": 12,
          "student.name": "DARSHAN R",
          "student.gender": "M",
          "student.parentName": "RAVICHANDRAN P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "dc856300-6e72-438d-a5b3-185a18d2e902",
          "admissionId": "a4d7a4b5-82db-4c9c-b081-b3d15332309d",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7467"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7467",
          "registrationNumber": "1130642570029",
          "classNo": 12,
          "student.name": "DAYANAND B",
          "student.gender": "M",
          "student.parentName": "BALAKRISHNAN KUMARASAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ff366fa6-8ab0-4613-870b-9d47aa48a588",
          "admissionId": "0812002d-9b69-4149-8950-7effce761661",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7373"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7373",
          "registrationNumber": "1130642570014",
          "classNo": 12,
          "student.name": "DEEKSHA K",
          "student.gender": "F",
          "student.parentName": "KANNABIRAN B",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "a4c7ca40-debb-4fac-8ab1-fc23b329117d",
          "admissionId": "2a4d030e-4637-4d9d-9703-432e630dd29f",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7482"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7482",
          "registrationNumber": "1130642570023",
          "classNo": 12,
          "student.name": "DISHA R",
          "student.gender": "F",
          "student.parentName": "RAJESH KANNAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "b2000799-7d2e-4a24-ab00-48587b3f4b42",
          "admissionId": "2b6d30b3-371d-478b-9cdc-84c7a6255b2f",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4402"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4402",
          "registrationNumber": "9020642370029",
          "classNo": 12,
          "student.name": "DIYANITHRA PRABU",
          "student.gender": "F",
          "student.parentName": "PRABU SUBRAMANIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "d0c1213f-8860-483d-a4f7-d9ba4b3235e9",
          "admissionId": "6c679a8b-0b68-4578-a9ad-ab6a19a92ab4",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6345"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6345",
          "registrationNumber": "9017642370001",
          "classNo": 12,
          "student.name": "GURUCHARAN SARANATH",
          "student.gender": "M",
          "student.parentName": "SARANATH KANCHIPURAM POOVARAGAVAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6c398494-81c3-473f-85c3-d79dc3fd3394",
          "admissionId": "fe705d3e-bb0b-403c-b250-13a869359b0d",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "5525"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "5525",
          "registrationNumber": "9020642370050",
          "classNo": 12,
          "student.name": "HARSHAD BALASUDHAKAR",
          "student.gender": "M",
          "student.parentName": "BALASUDHAKAR CHINNUSAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "f1622ff6-5cda-4066-889c-1f867e61a509",
          "admissionId": "d86c3ec4-8dd1-4d01-bd96-cbc297aaa742",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7409"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7409",
          "registrationNumber": "1130642570001",
          "classNo": 12,
          "student.name": "HARSITHAA SRI A R",
          "student.gender": "F",
          "student.parentName": "ARIVOLI A",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6907a9bd-38fb-4471-a0c8-4ef0f95b6ca2",
          "admissionId": "e7953845-72a3-480e-b66c-73cc68403e21",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6447"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6447",
          "registrationNumber": "9020642370084",
          "classNo": 12,
          "student.name": "JAIRO JO WINSLINE",
          "student.gender": "M",
          "student.parentName": "WINSLINE CHANDRA CHANDRAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "c78470ac-cda6-47e8-926c-eb7f8c2508d3",
          "admissionId": "18d445a4-5b73-43fc-8be3-ba97894059bd",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7461"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7461",
          "registrationNumber": "1130642570028",
          "classNo": 12,
          "student.name": "JOSHUA DANY PRAVEEN",
          "student.gender": "M",
          "student.parentName": "PRAVEEN PRINCE",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "ab394da6-869a-4644-b39e-07e52b86594c",
          "admissionId": "42e18409-7fa6-4c2e-ba15-91bff26bc1b6",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7498"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7498",
          "registrationNumber": "1130642570033",
          "classNo": 12,
          "student.name": "PRADEEP KANNA R",
          "student.gender": "M",
          "student.parentName": "RAMAKRISHNAN P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "6f36fd57-c696-4b69-a493-13261565678b",
          "admissionId": "a6c41c86-7e34-4580-99f5-43664f364397",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7496"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7496",
          "registrationNumber": "1130642570027",
          "classNo": 12,
          "student.name": "PRASHANASRI S",
          "student.gender": "F",
          "student.parentName": "SHANMUGAM P",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "bffc615c-5cd2-43be-8c63-5ca24b4f00ec",
          "admissionId": "b1cfb34e-a937-4674-8615-1b667240657f",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6379"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6379",
          "registrationNumber": "9020642370078",
          "classNo": 12,
          "student.name": "RITHVIK AARYAN VIJAYPRAKASH",
          "student.gender": "M",
          "student.parentName": "VIJAYPRAKASH DAMODARAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "313dd828-1384-4d45-bb8f-6739adf7cf76",
          "admissionId": "8e85c659-1af6-4502-9fd1-f945cc55f9c3",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7475"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7475",
          "registrationNumber": "1130642570032",
          "classNo": 12,
          "student.name": "SANJAY S",
          "student.gender": "M",
          "student.parentName": "SADHASIVAM S",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "aaef7ab1-d789-4635-88bb-83ff3d89523f",
          "admissionId": "3e48efc2-1c86-4dbd-81a8-5beeda8fd5e8",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "2468"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "2468",
          "registrationNumber": "9020642370038",
          "classNo": 12,
          "student.name": "SHRUTHY RAJA ELAVARASAN",
          "student.gender": "F",
          "student.parentName": "RAJA ELAVARASAN DHANDAYUTHAPANI",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9f881a70-2e27-4ab8-ac77-3cf9ce420d4f",
          "admissionId": "053ac032-98b2-4535-b1d5-5a61d28053c2",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "4678"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "4678",
          "registrationNumber": "1130642570011",
          "classNo": 12,
          "student.name": "SIMRAH AIMEN KUTHBUDEEN",
          "student.gender": "F",
          "student.parentName": "KUTHBUDEEN TAJUDEEN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "460f5b68-40a9-4a5f-879f-be55875839af",
          "admissionId": "e97fe233-00de-4156-85b4-7b013faf068b",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6282"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6282",
          "registrationNumber": "9020642370031",
          "classNo": 12,
          "student.name": "SRINANDHANA MANIKANDAN",
          "student.gender": "F",
          "student.parentName": "MANIKANDAN SIVASUBRAMANIAN",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "e5e8d82d-008d-4113-9f04-d69aa493398a",
          "admissionId": "74579ffc-52c9-4db9-b51a-991a2ba4dc92",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6342"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6342",
          "registrationNumber": "9020642370034",
          "classNo": 12,
          "student.name": "TARINI VIVEKANANTHAN",
          "student.gender": "F",
          "student.parentName": "VIVEKANANTHAN POONGAVANAM",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "9132d4ed-f953-4feb-874a-45cc0cfaeb91",
          "admissionId": "bd8be57c-7480-4205-9a90-5083577b366e",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "6364"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "6364",
          "registrationNumber": "9020642370044",
          "classNo": 12,
          "student.name": "VARSHA KARTHIYAINI AHILAN",
          "student.gender": "F",
          "student.parentName": "AHILAN KUMARASWAMY",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "44851af4-702f-449a-a8e3-031d3a0f0c7b",
          "admissionId": "31160307-b565-4619-b83f-095f3ff8aa7e",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  },
  {
    "updateOne": {
      "filter": {
        "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
        "admissionNo": "7349"
      },
      "update": {
        "$set": {
          "tenantId": "624158e2-41a0-416e-a08e-979f5a9858a0",
          "admissionNo": "7349",
          "registrationNumber": "1130642570018",
          "classNo": 12,
          "student.name": "VINAYA SELVARAJ",
          "student.gender": "F",
          "student.parentName": "SELVARAJ M",
          "student.city": "Coimbatore",
          "student.state": "Tamil Nadu",
          "academicYear": "2026-2027",
          "currentAcademicYear": "2026-2027",
          "programId": "14833cc7-0828-4f94-829f-e1ba847bce54",
          "programName": "MAGNUM - Two Year Integrated School Program",
          "centerId": "052e9d74-ee2a-423a-be74-46c27028406b",
          "centerCode": "64",
          "centerName": "Nehru Nagar Branch",
          "batchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "batchCode": "COIXM257D01",
          "firstBatchId": "ddc33c06-d30c-493b-90c9-6cd1369ee3ac",
          "firstBatchCode": "COIXM257D01",
          "firstBatchName": "DARWIN-12Z2",
          "status": "ACTIVE",
          "isdeleted": false
        },
        "$setOnInsert": {
          "studentId": "4cba7d7f-3497-4123-b73c-ca1c959962eb",
          "admissionId": "1728d960-1672-4f58-bc22-8da4904f91f1",
          "createdAt": "2026-11-12T06:35:16.310Z"
        }
      },
      "upsert": true
    }
  }
],
  { ordered: false }
);

print("Bulk upsert completed:");
print("  Matched:  " + result.matchedCount);
print("  Modified: " + result.modifiedCount);
print("  Upserted: " + result.upsertedCount);

// STEP 4: VERIFICATION QUERIES
print("\n--- VERIFICATION ---");
const totalStudents = db.studentprofiles.countDocuments({
  tenantId: "624158e2-41a0-416e-a08e-979f5a9858a0",
  isdeleted: false
});
print("Total active students: " + totalStudents);

const firstBatchStats = db.studentprofiles.aggregate([
  {
    $match: {
      tenantId: "624158e2-41a0-416e-a08e-979f5a9858a0",
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

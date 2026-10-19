import assert from 'node:assert';
import dns from 'node:dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dns.setServers(['1.1.1.1', '8.8.8.8']);
dotenv.config();

import Student from './models/Student.js';
import Company from './models/Company.js';
import Placement from './models/Placement.js';
import { addPlacement, updatePlacement } from './controllers/placementController.js';
import { calculatePlacementAnalytics } from './controllers/analyticsController.js';

// Helper to simulate Express req/res
function mockReqRes(body = {}, params = {}) {
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  return {
    req: { body, params },
    res,
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  };
}

async function runPlacementDuplicatesSuite() {
  console.log('=== RUNNING PLACEMENT DUPLICATE INTEGRITY & REGRESSION TESTS ===\n');

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing from environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas.\n');

  // Ensure indexes are synced
  await Placement.syncIndexes();

  // 1. Verify Unique Compound Index on MongoDB
  console.log('[Test 1] Verifying Unique Compound Index in MongoDB...');
  const indexes = await Placement.collection.indexes();
  const compoundIndex = indexes.find(
    (idx) => idx.key?.student === 1 && idx.key?.company === 1 && idx.unique === true
  );
  assert.ok(
    compoundIndex,
    'MongoDB Placement collection MUST have a unique compound index on { student: 1, company: 1 }'
  );
  console.log('  ✓ 1.1: Unique compound index { student: 1, company: 1 } confirmed on MongoDB collection.');

  // Setup isolated test entities
  const timestamp = Date.now();
  const testStudent = await Student.create({
    name: `Test Candidate ${timestamp}`,
    email: `dup_test_${timestamp}@college.edu`,
    rollNo: `DUP-${timestamp}`,
    branch: 'CSE',
    year: 4,
    cgpa: 8.5,
    phone: '9000000010',
    placementStatus: 'Not Placed',
  });

  const testCompanyA = await Company.create({
    companyName: `Test Company Alpha ${timestamp}`,
    packageOffered: 9.5,
    location: 'Bangalore',
    jobRole: 'Software Engineer',
    eligibilityCGPA: 7.0,
    driveDate: new Date(),
    driveStatus: 'Open',
  });

  const testCompanyB = await Company.create({
    companyName: `Test Company Beta ${timestamp}`,
    packageOffered: 14.0,
    location: 'Hyderabad',
    jobRole: 'Cloud Engineer',
    eligibilityCGPA: 7.5,
    driveDate: new Date(),
    driveStatus: 'Open',
  });

  let createdPlacementAId = null;
  let createdPlacementBId = null;

  try {
    // 2. Add first placement for (Student, Company A) -> Must SUCCEED
    console.log('\n[Test 2] Adding Initial Placement for (Student, Company A)...');
    const { req: req1, res: res1, getStatusCode: status1, getResponseData: data1 } = mockReqRes({
      student: String(testStudent._id),
      company: String(testCompanyA._id),
      placementDate: '2026-10-15',
      packageOffered: 9.5,
      status: 'Selected',
    });

    await addPlacement(req1, res1);
    assert.strictEqual(status1(), 201, `Initial placement must be created with HTTP 201, got ${status1()}`);
    createdPlacementAId = data1()._id;
    assert.ok(createdPlacementAId, 'Created placement must return an _id');
    console.log(`  ✓ 2.1: Initial placement created successfully (ID: ${createdPlacementAId}).`);

    // 3. Attempt duplicate placement for (Student, Company A) -> Must FAIL with 400
    console.log('\n[Test 3] Attempting Duplicate Placement for Same (Student, Company A)...');
    const { req: req2, res: res2, getStatusCode: status2, getResponseData: data2 } = mockReqRes({
      student: String(testStudent._id),
      company: String(testCompanyA._id),
      placementDate: '2026-10-16',
      packageOffered: 11.0,
      status: 'Selected',
    });

    await addPlacement(req2, res2);
    assert.strictEqual(
      status2(),
      400,
      `Duplicate placement attempt must return HTTP 400, got ${status2()}`
    );
    assert.strictEqual(
      data2().message,
      'A placement record already exists for this student and company. Please edit the existing record instead.',
      `Expected specific duplicate error message, got: ${data2().message}`
    );
    console.log('  ✓ 3.1: Duplicate placement correctly rejected with HTTP 400 and clear instruction to edit existing record.');

    // 4. Same student with a DIFFERENT company (Company B) -> Must SUCCEED
    console.log('\n[Test 4] Adding Placement for Same Student with a DIFFERENT Company (Company B)...');
    const { req: req3, res: res3, getStatusCode: status3, getResponseData: data3 } = mockReqRes({
      student: String(testStudent._id),
      company: String(testCompanyB._id),
      placementDate: '2026-10-18',
      packageOffered: 14.0,
      status: 'Selected',
    });

    await addPlacement(req3, res3);
    assert.strictEqual(
      status3(),
      201,
      `Placement for same student with different company must SUCCEED with HTTP 201, got ${status3()}`
    );
    createdPlacementBId = data3()._id;
    console.log(`  ✓ 4.1: Same student with different company succeeded cleanly (ID: ${createdPlacementBId}).`);

    // 5. Updating Placement A to collide with Placement B's company -> Must FAIL with 400
    console.log('\n[Test 5] Updating Placement A to point to Company B (Collision Test)...');
    const { req: req4, res: res4, getStatusCode: status4, getResponseData: data4 } = mockReqRes(
      {
        company: String(testCompanyB._id),
      },
      { id: String(createdPlacementAId) }
    );

    await updatePlacement(req4, res4);
    assert.strictEqual(
      status4(),
      400,
      `Updating to collide with existing student-company pair must return HTTP 400, got ${status4()}`
    );
    assert.ok(
      data4().message.includes('already exists for this student and company'),
      `Expected collision error message, got: ${data4().message}`
    );
    console.log('  ✓ 5.1: Cross-record collision update rejected with HTTP 400.');

    // 6. Updating Placement A's package without collision -> Must SUCCEED
    console.log('\n[Test 6] Updating Placement A package (Non-colliding update)...');
    const { req: req5, res: res5, getStatusCode: status5, getResponseData: data5 } = mockReqRes(
      {
        packageOffered: 10.5,
      },
      { id: String(createdPlacementAId) }
    );

    await updatePlacement(req5, res5);
    assert.strictEqual(status5(), 200, `Non-colliding update must succeed with HTTP 200, got ${status5()}`);
    assert.strictEqual(data5().packageOffered, 10.5, 'Package must update to 10.5');
    console.log('  ✓ 6.1: Legitimate update on existing placement succeeded.');

    // 7. Verify Concurrent Duplicate Submissions (Simulating race conditions)
    console.log('\n[Test 7] Testing Concurrent Duplicate Submissions (Race Condition)...');
    const testStudentConcurrent = await Student.create({
      name: `Concurrent Student ${timestamp}`,
      email: `conc_${timestamp}@college.edu`,
      rollNo: `CONC-${timestamp}`,
      branch: 'IT',
      year: 4,
      cgpa: 8.0,
      phone: '9000000020',
      placementStatus: 'Not Placed',
    });

    // Run two identical addPlacement requests concurrently
    const [mockA, mockB] = [
      mockReqRes({
        student: String(testStudentConcurrent._id),
        company: String(testCompanyA._id),
        placementDate: '2026-10-19',
        packageOffered: 9.5,
        status: 'Selected',
      }),
      mockReqRes({
        student: String(testStudentConcurrent._id),
        company: String(testCompanyA._id),
        placementDate: '2026-10-19',
        packageOffered: 9.5,
        status: 'Selected',
      }),
    ];

    await Promise.all([addPlacement(mockA.req, mockA.res), addPlacement(mockB.req, mockB.res)]);

    const statuses = [mockA.getStatusCode(), mockB.getStatusCode()].sort();
    assert.deepStrictEqual(
      statuses,
      [201, 400],
      `Concurrent requests must yield exactly one success (201) and one duplicate rejection (400), got ${statuses}`
    );

    const countInDb = await Placement.countDocuments({
      student: testStudentConcurrent._id,
      company: testCompanyA._id,
    });
    assert.strictEqual(countInDb, 1, `Exactly 1 placement document must exist in DB, found ${countInDb}`);
    console.log('  ✓ 7.1: Concurrent duplicate submissions handled safely (1 saved, 1 rejected with HTTP 400).');

    // 8. Cleanup test entities
    await Placement.deleteMany({ student: { $in: [testStudent._id, testStudentConcurrent._id] } });
    await Student.deleteMany({ _id: { $in: [testStudent._id, testStudentConcurrent._id] } });
    await Company.deleteMany({ _id: { $in: [testCompanyA._id, testCompanyB._id] } });
    console.log('\n  ✓ 8.1: Test artifacts cleaned up successfully.');

    // 9. Verify live database status sync and unified analytics remain intact
    console.log('\n[Test 9] Verifying Live Unified Analytics & Status Sync...');
    const liveAnalytics = await calculatePlacementAnalytics();
    assert.strictEqual(liveAnalytics.totals.placedStudents, 9, 'Live placed students must remain 9');
    assert.strictEqual(liveAnalytics.totals.totalStudents, 307, 'Live total students must remain 307');
    console.log('  ✓ 9.1: Live database state and unified analytics verified completely intact.');

    console.log('\n=============================================================');
    console.log('ALL PLACEMENT DUPLICATE INTEGRITY TESTS PASSED SUCCESSFULLY!');
    console.log('=============================================================');
  } catch (err) {
    // Attempt cleanup on failure
    await Placement.deleteMany({ student: testStudent._id });
    await Student.findByIdAndDelete(testStudent._id);
    await Company.deleteMany({ _id: { $in: [testCompanyA._id, testCompanyB._id] } });
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

runPlacementDuplicatesSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

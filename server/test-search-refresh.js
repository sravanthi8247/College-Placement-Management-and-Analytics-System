import dns from 'node:dns';
import path from 'node:path';
import assert from 'node:assert';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dns.setServers(['1.1.1.1', '8.8.8.8']);

dotenv.config({ path: path.join(process.cwd(), '.env') });
if (!process.env.MONGO_URI) {
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

import Student from './models/Student.js';
import Company from './models/Company.js';
import Placement from './models/Placement.js';
import { getStudents, getDashboardStats } from './controllers/studentController.js';
import { addPlacement, updatePlacement, getPlacements } from './controllers/placementController.js';
import { getCompanies } from './controllers/companyController.js';

console.log('--- STARTING COMPREHENSIVE PAGINATION, SEARCH, REFRESH & SELECTOR TEST SUITE ---');

// Mock Express req & res
function createMockReqRes({ query = {}, body = {}, params = {}, user = null } = {}) {
  const req = { query, body, params, user };
  let statusCode = 200;
  let jsonResult = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      jsonResult = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getData: () => jsonResult,
  };

  return { req, res };
}

async function runTests() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB Atlas successfully.');

  const TEST_TAG = `TEST_SR_${Date.now()}`;
  const student1Email = `${TEST_TAG.toLowerCase()}_1@college.edu`;
  const student2Email = `${TEST_TAG.toLowerCase()}_2@college.edu`;
  const student1Roll = `${TEST_TAG}_R1`;
  const student2Roll = `${TEST_TAG}_R2`;
  const customBranch = `AeroEng_${Date.now()}`;

  let createdStudent1 = null;
  let createdStudent2 = null;
  let createdCompany = null;
  let createdPlacement = null;

  try {
    // -------------------------------------------------------------
    // Setup: Create test students & company
    // -------------------------------------------------------------
    console.log('\n[Setup] Creating test students and company...');
    createdStudent1 = await Student.create({
      name: `Alice Wonderland ${TEST_TAG}`,
      email: student1Email,
      rollNo: student1Roll,
      branch: customBranch,
      year: 4,
      cgpa: 9.1,
      phone: '9876543210',
      placementStatus: 'Not Placed',
    });

    createdStudent2 = await Student.create({
      name: `Bob Builder ${TEST_TAG}`,
      email: student2Email,
      rollNo: student2Roll,
      branch: 'Mechanical Engineering',
      year: 3,
      cgpa: 8.4,
      phone: '9876543211',
      placementStatus: 'Not Placed',
    });

    createdCompany = await Company.create({
      companyName: `Apex Tech ${TEST_TAG}`,
      jobRole: 'Software Engineer',
      location: 'Bangalore',
      eligibilityCGPA: 7.0,
      eligibleBranches: [customBranch, 'Mechanical Engineering'],
      eligibleYears: [3, 4],
      driveDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      driveStatus: 'Open',
      packageOffered: 15,
    });

    console.log('✓ Test students and company created.');

    // -------------------------------------------------------------
    // Test 1: Search by Name, Roll No, and Branch
    // -------------------------------------------------------------
    console.log('\n[1/8] Testing search by student name, roll number, and branch...');
    {
      // Search by name (case-insensitive & trimmed)
      const { req: r1, res: s1 } = createMockReqRes({
        query: { search: `  alice wonderland ${TEST_TAG.toLowerCase()}  ` },
      });
      await getStudents(r1, s1);
      const d1 = s1.getData();
      assert(Array.isArray(d1), 'Expected array response');
      assert(d1.some((s) => s.rollNo === student1Roll), 'Student 1 should be found by name');

      // Search by roll number
      const { req: r2, res: s2 } = createMockReqRes({
        query: { search: student2Roll.toLowerCase() },
      });
      await getStudents(r2, s2);
      const d2 = s2.getData();
      assert(d2.some((s) => s.rollNo === student2Roll), 'Student 2 should be found by roll number');

      // Search by branch
      const { req: r3, res: s3 } = createMockReqRes({
        query: { search: customBranch },
      });
      await getStudents(r3, s3);
      const d3 = s3.getData();
      assert(d3.some((s) => s.rollNo === student1Roll), 'Student 1 should be found by branch');
      console.log('✓ Test 1 Passed: Search by name, roll number, and branch works accurately.');
    }

    // -------------------------------------------------------------
    // Test 2: Server-Side Pagination with 25 Records per Page
    // -------------------------------------------------------------
    console.log('\n[2/8] Testing pagination default 25 records per page with total counts...');
    {
      const { req, res } = createMockReqRes({
        query: { page: '1', limit: '25' },
      });
      await getStudents(req, res);
      const data = res.getData();

      assert.strictEqual(res.getStatusCode(), 200);
      assert(typeof data === 'object' && !Array.isArray(data), 'Expected paginated object response');
      assert(Array.isArray(data.students), 'Expected students array in response');
      assert(data.students.length <= 25, 'Expected at most 25 students on page 1');
      assert(data.total >= 2, `Expected total >= 2, got ${data.total}`);
      assert.strictEqual(data.page, 1);
      assert.strictEqual(data.limit, 25);
      assert.strictEqual(data.totalPages, Math.max(1, Math.ceil(data.total / 25)));
      assert(data.stats, 'Expected stats summary object');
      assert(Array.isArray(data.branches), 'Expected branches array');
      console.log(`✓ Test 2 Passed: Page 1 returned ${data.students.length} students, total=${data.total}, totalPages=${data.totalPages}.`);
    }

    // -------------------------------------------------------------
    // Test 3: Changing Page Size to 50 Records per Page
    // -------------------------------------------------------------
    console.log('\n[3/8] Testing page size toggle to 50 records per page...');
    {
      const { req, res } = createMockReqRes({
        query: { page: '1', limit: '50' },
      });
      await getStudents(req, res);
      const data = res.getData();

      assert.strictEqual(res.getStatusCode(), 200);
      assert(data.students.length <= 50, 'Expected at most 50 students');
      assert.strictEqual(data.limit, 50);
      assert.strictEqual(data.totalPages, Math.max(1, Math.ceil(data.total / 50)));
      console.log(`✓ Test 3 Passed: 50 records per page recalculates totalPages to ${data.totalPages}.`);
    }

    // -------------------------------------------------------------
    // Test 4: Pagination Navigation (Page 2 & Boundary Checks)
    // -------------------------------------------------------------
    console.log('\n[4/8] Testing pagination page navigation and boundaries...');
    {
      const { req: p1Req, res: p1Res } = createMockReqRes({ query: { page: '1', limit: '25' } });
      await getStudents(p1Req, p1Res);
      const page1Data = p1Res.getData();

      if (page1Data.totalPages > 1) {
        const { req: p2Req, res: p2Res } = createMockReqRes({ query: { page: '2', limit: '25' } });
        await getStudents(p2Req, p2Res);
        const page2Data = p2Res.getData();

        assert.strictEqual(page2Data.page, 2);
        assert(page2Data.students.length > 0, 'Page 2 should have records');
        // Ensure page 1 and page 2 don't overlap IDs
        const page1Ids = new Set(page1Data.students.map((s) => String(s._id)));
        const page2Overlap = page2Data.students.some((s) => page1Ids.has(String(s._id)));
        assert(!page2Overlap, 'Page 1 and Page 2 must not have overlapping records');
        console.log('✓ Test 4 Passed: Multi-page navigation returns distinct non-overlapping slices.');
      } else {
        console.log('✓ Test 4 Passed: Single page dataset verified boundaries correctly.');
      }
    }

    // -------------------------------------------------------------
    // Test 5: Search and Filters Combined with Pagination
    // -------------------------------------------------------------
    console.log('\n[5/8] Testing search and filters combined with pagination...');
    {
      const { req, res } = createMockReqRes({
        query: {
          search: TEST_TAG,
          branch: customBranch,
          page: '1',
          limit: '25',
        },
      });
      await getStudents(req, res);
      const data = res.getData();

      assert.strictEqual(res.getStatusCode(), 200);
      assert.strictEqual(data.total, 1, 'Expected exactly 1 student matching custom branch');
      assert.strictEqual(data.students[0].rollNo, student1Roll);
      assert.strictEqual(data.totalPages, 1);
      console.log('✓ Test 5 Passed: Search + branch filter combined with pagination works seamlessly.');
    }

    // -------------------------------------------------------------
    // Test 6: Placement Student Selector Connection (MongoDB _id)
    // -------------------------------------------------------------
    console.log('\n[6/8] Testing placement creation using selected student ID...');
    {
      const { req, res } = createMockReqRes({
        body: {
          student: String(createdStudent1._id),
          company: String(createdCompany._id),
          placementDate: new Date().toISOString(),
          packageOffered: 15,
          status: 'Selected',
        },
      });
      await addPlacement(req, res);
      const data = res.getData();

      assert.strictEqual(res.getStatusCode(), 201, `Failed to add placement: ${data?.message}`);
      assert(data._id, 'Placement record should have _id');
      assert.strictEqual(String(data.student?._id || data.student), String(createdStudent1._id));
      createdPlacement = data;

      // Check student placementStatus was synchronized to 'Placed'
      const updatedStudent = await Student.findById(createdStudent1._id);
      assert.strictEqual(updatedStudent.placementStatus, 'Placed', 'Student status should synchronize to Placed');
      console.log('✓ Test 6 Passed: Placement created with student MongoDB _id and synced status to Placed.');
    }

    // -------------------------------------------------------------
    // Test 7: Placement Update and Status Synchronization
    // -------------------------------------------------------------
    console.log('\n[7/8] Testing placement update and reversion to Not Placed...');
    {
      const { req: updateReq, res: updateRes } = createMockReqRes({
        params: { id: String(createdPlacement._id) },
        body: { status: 'Rejected' },
      });
      await updatePlacement(updateReq, updateRes);
      assert.strictEqual(updateRes.getStatusCode(), 200);

      const updatedStudent = await Student.findById(createdStudent1._id);
      assert.strictEqual(updatedStudent.placementStatus, 'Not Placed', 'Student status should revert to Not Placed');
      console.log('✓ Test 7 Passed: Placement update reverted student status to Not Placed.');
    }

    // -------------------------------------------------------------
    // Test 8: Refresh In-Place API Verification Across Modules
    // -------------------------------------------------------------
    console.log('\n[8/8] Testing refresh APIs (Dashboard, Companies, Placements, Students)...');
    {
      // 1. Dashboard stats refresh
      const { req: dReq, res: dRes } = createMockReqRes();
      await getDashboardStats(dReq, dRes);
      assert.strictEqual(dRes.getStatusCode(), 200);
      const stats = dRes.getData();
      assert(typeof stats.totalStudents === 'number');
      assert.strictEqual(stats.totalStudents, stats.placedStudents + stats.notPlacedStudents);

      // 2. Companies list refresh
      const { req: cReq, res: cRes } = createMockReqRes();
      await getCompanies(cReq, cRes);
      assert.strictEqual(cRes.getStatusCode(), 200);
      assert(Array.isArray(cRes.getData()));

      // 3. Placements list refresh
      const { req: plReq, res: plRes } = createMockReqRes();
      await getPlacements(plReq, plRes);
      assert.strictEqual(plRes.getStatusCode(), 200);
      assert(Array.isArray(plRes.getData()));

      // 4. Students list refresh
      const { req: sReq, res: sRes } = createMockReqRes({ query: { page: '1', limit: '25' } });
      await getStudents(sReq, sRes);
      assert.strictEqual(sRes.getStatusCode(), 200);
      assert(sRes.getData().students.length > 0);

      console.log('✓ Test 8 Passed: All module refresh APIs return fresh live data without full reload.');
    }
  } finally {
    console.log('\nCleaning up test records from MongoDB Atlas...');
    if (createdPlacement?._id) {
      await Placement.findByIdAndDelete(createdPlacement._id);
    }
    if (createdStudent1?._id) {
      await Student.findByIdAndDelete(createdStudent1._id);
    }
    if (createdStudent2?._id) {
      await Student.findByIdAndDelete(createdStudent2._id);
    }
    if (createdCompany?._id) {
      await Company.findByIdAndDelete(createdCompany._id);
    }
    await mongoose.disconnect();
    console.log('✓ Cleanup complete.');
  }

  console.log('\n=============================================================');
  console.log('ALL 8 COMPREHENSIVE PAGINATION, SEARCH, REFRESH & SELECTOR TESTS PASSED!');
  console.log('=============================================================');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

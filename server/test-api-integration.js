import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Ensure isolated test JWT secret (never connects to production DB)
process.env.JWT_SECRET = 'test_isolated_secret_key_for_api_pipeline_32bytes!!';

import User from './models/User.js';
import Student from './models/Student.js';
import Company from './models/Company.js';
import Application from './models/Application.js';
import { protect, authorize } from './middleware/authMiddleware.js';
import { applyToDrive } from './controllers/applicationController.js';
import { checkMyEligibility, getEligibleStudents } from './controllers/companyController.js';

console.log('=== RUNNING ISOLATED API PIPELINE INTEGRATION TESTS ===\n');

// Valid MongoDB ObjectIds for testing
const STUDENT_USER_ID = new mongoose.Types.ObjectId().toString();
const ATTACKER_TARGET_STUDENT_ID = new mongoose.Types.ObjectId().toString();
const ADMIN_USER_ID = new mongoose.Types.ObjectId().toString();
const STUDENT_ID = new mongoose.Types.ObjectId().toString();
const OPEN_DRIVE_ID = new mongoose.Types.ObjectId().toString();
const CLOSED_DRIVE_ID = new mongoose.Types.ObjectId().toString();
const COMPLETED_DRIVE_ID = new mongoose.Types.ObjectId().toString();
const EXPIRED_DRIVE_ID = new mongoose.Types.ObjectId().toString();

// Generate real JWT tokens
const studentToken = jwt.sign({ id: STUDENT_USER_ID, role: 'student' }, process.env.JWT_SECRET);
const adminToken = jwt.sign({ id: ADMIN_USER_ID, role: 'admin' }, process.env.JWT_SECRET);

// In-memory test fixtures
const usersDb = {
  [STUDENT_USER_ID]: {
    _id: STUDENT_USER_ID,
    name: 'Sravanthi Student',
    email: 'sravanthi.student@college.edu',
    role: 'student',
  },
  [ADMIN_USER_ID]: {
    _id: ADMIN_USER_ID,
    name: 'Placement Admin',
    email: 'admin@college.edu',
    role: 'admin',
  },
};

const studentsDb = {
  [STUDENT_ID]: {
    _id: STUDENT_ID,
    user: STUDENT_USER_ID,
    name: 'Sravanthi Student',
    email: 'sravanthi.student@college.edu',
    rollNo: '2023CSE001',
    branch: 'Computer Science',
    year: 4,
    cgpa: 8.5,
    placementStatus: 'Not Placed',
  },
};

const tomorrow = new Date(Date.now() + 86400000);
const yesterday = new Date(Date.now() - 86400000);

const companiesDb = {
  [OPEN_DRIVE_ID]: {
    _id: OPEN_DRIVE_ID,
    companyName: 'Open Apex Tech',
    jobRole: 'Software Engineer',
    eligibilityCGPA: 7.5,
    eligibleBranches: ['CSE', 'IT'],
    eligibleYears: ['4th Year'],
    driveStatus: 'Open',
    applicationDeadline: tomorrow,
  },
  [CLOSED_DRIVE_ID]: {
    _id: CLOSED_DRIVE_ID,
    companyName: 'Closed Apex Tech',
    jobRole: 'Software Engineer',
    eligibilityCGPA: 7.5,
    eligibleBranches: ['CSE'],
    eligibleYears: ['4th Year'],
    driveStatus: 'Closed',
    applicationDeadline: tomorrow,
  },
  [COMPLETED_DRIVE_ID]: {
    _id: COMPLETED_DRIVE_ID,
    companyName: 'Completed Apex Tech',
    jobRole: 'Software Engineer',
    eligibilityCGPA: 7.5,
    eligibleBranches: ['CSE'],
    eligibleYears: ['4th Year'],
    driveStatus: 'Completed',
    applicationDeadline: tomorrow,
  },
  [EXPIRED_DRIVE_ID]: {
    _id: EXPIRED_DRIVE_ID,
    companyName: 'Expired Apex Tech',
    jobRole: 'Software Engineer',
    eligibilityCGPA: 7.5,
    eligibleBranches: ['CSE'],
    eligibleYears: ['4th Year'],
    driveStatus: 'Open',
    applicationDeadline: yesterday,
  },
};

// In-memory simulated application store
const applicationsDb = new Map();

// Save original Mongoose methods
const origUserFindById = User.findById;
const origStudentFindOne = Student.findOne;
const origStudentFind = Student.find;
const origStudentFindById = Student.findById;
const origCompanyFindById = Company.findById;
const origAppFindOne = Application.findOne;
const origAppCreate = Application.create;
const origAppFindById = Application.findById;

// Stub Mongoose models to use isolated in-memory fixtures (NO live DB)
User.findById = (id) => {
  const user = usersDb[String(id)];
  return {
    select: () => Promise.resolve(user || null),
  };
};

Student.findOne = (query) => {
  if (query.user) {
    const student = Object.values(studentsDb).find((s) => String(s.user) === String(query.user));
    return Promise.resolve(student || null);
  }
  if (query.email) {
    const student = Object.values(studentsDb).find((s) => String(s.email).toLowerCase() === String(query.email).toLowerCase());
    return Promise.resolve(student || null);
  }
  return Promise.resolve(null);
};

Student.find = () => Promise.resolve(Object.values(studentsDb));

Student.findById = (id) => Promise.resolve(studentsDb[String(id)] || null);

Company.findById = (id) => Promise.resolve(companiesDb[String(id)] || null);

Application.findOne = (query) => {
  const key = `${query.student}_${query.company}`;
  const app = applicationsDb.get(key);
  return Promise.resolve(app || null);
};

Application.create = async (doc) => {
  const key = `${doc.student}_${doc.company}`;
  if (applicationsDb.has(key)) {
    const err = new Error('Duplicate application');
    err.code = 11000;
    throw err;
  }
  const created = {
    _id: new mongoose.Types.ObjectId().toString(),
    ...doc,
    appliedAt: new Date(),
  };
  applicationsDb.set(key, created);
  return created;
};

Application.findById = (id) => {
  let matched = null;
  for (const app of applicationsDb.values()) {
    if (String(app._id) === String(id)) {
      matched = app;
      break;
    }
  }
  const queryObj = {
    populate: () => queryObj,
    then: (resolve) => resolve(matched),
  };
  return queryObj;
};

// Dispatch helper that executes the exact Express middleware pipeline
async function executePipeline(middlewares, { method = 'POST', headers = {}, body = {}, params = {}, query = {} } = {}) {
  const lowerHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  const req = {
    method,
    headers: lowerHeaders,
    body: { ...body },
    params: { ...params },
    query: { ...query },
  };

  let statusCode = 200;
  let jsonResult = null;
  let finished = false;

  return new Promise((resolvePipeline) => {
    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        jsonResult = data;
        finished = true;
        resolvePipeline({ statusCode, data: jsonResult });
        return res;
      },
      getStatusCode: () => statusCode,
      getData: () => jsonResult,
      isFinished: () => finished,
    };

    let idx = 0;
    function next(err) {
      if (err) {
        statusCode = 500;
        jsonResult = { message: err.message };
        return resolvePipeline({ statusCode, data: jsonResult });
      }
      if (finished || idx >= middlewares.length) {
        return resolvePipeline({ statusCode, data: jsonResult });
      }
      const mw = middlewares[idx++];
      try {
        const result = mw(req, res, next);
        if (result && typeof result.catch === 'function') {
          result.catch((asyncErr) => {
            if (!finished) {
              statusCode = 500;
              jsonResult = { message: asyncErr.message };
              resolvePipeline({ statusCode, data: jsonResult });
            }
          });
        }
      } catch (syncErr) {
        if (!finished) {
          statusCode = 500;
          jsonResult = { message: syncErr.message };
          resolvePipeline({ statusCode, data: jsonResult });
        }
      }
    }

    next();
  });
}

// Pipelines identical to Express route mountings
const applyPipeline = [protect, authorize('student'), applyToDrive];
const checkMyEligibilityPipeline = [protect, checkMyEligibility];
const getEligibleStudentsPipeline = [protect, authorize('admin'), getEligibleStudents];

async function runApiIntegrationTests() {
  try {
    console.log('[Setup] In-memory isolated pipeline initialized (zero production DB access).\n');

    // ------------------------------------------------------------------------
    // Test 1: Unauthenticated application submission is rejected (401)
    // ------------------------------------------------------------------------
    console.log('[1/9] Testing unauthenticated application submission rejection...');
    {
      const { statusCode, data } = await executePipeline(applyPipeline, {
        method: 'POST',
        headers: {}, // No Authorization header
        body: { companyId: OPEN_DRIVE_ID },
      });
      assert.strictEqual(statusCode, 401, 'Unauthenticated request must return HTTP 401');
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Not authorized'), 'Expected "Not authorized" message');
      console.log('  ✓ 1.1: Unauthenticated application submission rejected with HTTP 401.');
    }

    // ------------------------------------------------------------------------
    // Test 2: Authenticated students cannot impersonate another student
    // ------------------------------------------------------------------------
    console.log('\n[2/9] Testing student impersonation prevention in application submission...');
    {
      const { statusCode, data } = await executePipeline(applyPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          companyId: OPEN_DRIVE_ID,
          studentId: ATTACKER_TARGET_STUDENT_ID, // Malicious spoof attempt
          student: ATTACKER_TARGET_STUDENT_ID,
        },
      });
      assert.strictEqual(statusCode, 201, 'Valid application by authenticated student should succeed');
      assert.strictEqual(
        String(data.student?._id || data.student),
        STUDENT_ID,
        'Application must be bound strictly to authenticated student, ignoring request body studentId'
      );
      assert.notStrictEqual(String(data.student), ATTACKER_TARGET_STUDENT_ID);
      console.log('  ✓ 2.1: Pipeline bound application to JWT student session; request body studentId was ignored.');
    }

    // ------------------------------------------------------------------------
    // Test 3: Duplicate submissions are rejected (400)
    // ------------------------------------------------------------------------
    console.log('\n[3/9] Testing duplicate application rejection...');
    {
      const { statusCode, data } = await executePipeline(applyPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: { companyId: OPEN_DRIVE_ID },
      });
      assert.strictEqual(statusCode, 400, 'Duplicate submission must return HTTP 400');
      assert.ok(data.message.includes('already applied'), 'Expected duplicate application error message');
      console.log('  ✓ 3.1: Duplicate application rejected with HTTP 400 Bad Request.');
    }

    // ------------------------------------------------------------------------
    // Test 4: Concurrent duplicate submissions are safely rejected
    // ------------------------------------------------------------------------
    console.log('\n[4/9] Testing concurrent duplicate submissions race-condition safety...');
    {
      const newDriveId = new mongoose.Types.ObjectId().toString();
      companiesDb[newDriveId] = {
        _id: newDriveId,
        companyName: 'Concurrent Race Tech',
        eligibilityCGPA: 7.0,
        eligibleBranches: ['CSE'],
        eligibleYears: ['4th Year'],
        driveStatus: 'Open',
        applicationDeadline: tomorrow,
      };

      // Execute 3 concurrent pipeline calls
      const [r1, r2, r3] = await Promise.all([
        executePipeline(applyPipeline, {
          method: 'POST',
          headers: { Authorization: `Bearer ${studentToken}` },
          body: { companyId: newDriveId },
        }),
        executePipeline(applyPipeline, {
          method: 'POST',
          headers: { Authorization: `Bearer ${studentToken}` },
          body: { companyId: newDriveId },
        }),
        executePipeline(applyPipeline, {
          method: 'POST',
          headers: { Authorization: `Bearer ${studentToken}` },
          body: { companyId: newDriveId },
        }),
      ]);

      const statuses = [r1.statusCode, r2.statusCode, r3.statusCode];
      const successCount = statuses.filter((s) => s === 201).length;
      const duplicateCount = statuses.filter((s) => s === 400).length;

      assert.strictEqual(successCount, 1, 'Exactly one concurrent request must succeed with 201');
      assert.strictEqual(duplicateCount, 2, 'The remaining concurrent requests must be rejected with 400');
      console.log('  ✓ 4.1: Exactly 1 concurrent request succeeded (201); 2 duplicates blocked (400).');
    }

    // ------------------------------------------------------------------------
    // Test 5: Ineligible applications rejected by actual endpoint (400)
    // ------------------------------------------------------------------------
    console.log('\n[5/9] Testing ineligible application rejection by the actual endpoint...');
    {
      // Create a high-cutoff drive (CGPA 9.0 required, student has 8.5)
      const strictDriveId = new mongoose.Types.ObjectId().toString();
      companiesDb[strictDriveId] = {
        _id: strictDriveId,
        companyName: 'Ultra High Cutoff Co',
        eligibilityCGPA: 9.0,
        eligibleBranches: ['CSE'],
        eligibleYears: ['4th Year'],
        driveStatus: 'Open',
        applicationDeadline: tomorrow,
      };

      const { statusCode, data } = await executePipeline(applyPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: { companyId: strictDriveId },
      });
      assert.strictEqual(statusCode, 400, 'Ineligible application must return HTTP 400');
      assert.ok(data.message.includes('not eligible'));
      assert.ok(Array.isArray(data.reasons) && data.reasons.length > 0);
      assert.ok(data.reasons.some((r) => r.includes('CGPA')));
      console.log('  ✓ 5.1: Ineligible application blocked by POST /api/applications with 400 and structured reasons.');
    }

    // ------------------------------------------------------------------------
    // Test 6: Closed, completed, and expired drives reject applications
    // ------------------------------------------------------------------------
    console.log('\n[6/9] Testing closed, completed, and expired drives rejection...');
    {
      // Closed drive
      const rClosed = await executePipeline(applyPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: { companyId: CLOSED_DRIVE_ID },
      });
      assert.strictEqual(rClosed.statusCode, 400);
      assert.ok(rClosed.data.reasons.some((r) => r.includes('closed')));

      // Completed drive
      const rCompleted = await executePipeline(applyPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: { companyId: COMPLETED_DRIVE_ID },
      });
      assert.strictEqual(rCompleted.statusCode, 400);
      assert.ok(rCompleted.data.reasons.some((r) => r.includes('completed')));

      // Expired deadline drive
      const rExpired = await executePipeline(applyPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: { companyId: EXPIRED_DRIVE_ID },
      });
      assert.strictEqual(rExpired.statusCode, 400);
      assert.ok(rExpired.data.reasons.some((r) => r.includes('deadline')));
      console.log('  ✓ 6.1: Closed, Completed, and Expired drives all returned HTTP 400 with specific reasons.');
    }

    // ------------------------------------------------------------------------
    // Test 7: Missing or invalid student profile cannot bypass evaluator
    // ------------------------------------------------------------------------
    console.log('\n[7/9] Testing missing/invalid profile enforcement through HTTP pipeline...');
    {
      // Temporarily set student CGPA to null
      const originalCgpa = studentsDb[STUDENT_ID].cgpa;
      studentsDb[STUDENT_ID].cgpa = null;

      const newDriveId = new mongoose.Types.ObjectId().toString();
      companiesDb[newDriveId] = {
        _id: newDriveId,
        companyName: 'Profile Check Tech',
        eligibilityCGPA: 0,
        driveStatus: 'Open',
        applicationDeadline: tomorrow,
      };

      const { statusCode, data } = await executePipeline(applyPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: { companyId: newDriveId },
      });
      assert.strictEqual(statusCode, 400, 'Student with missing CGPA must be rejected');
      assert.ok(data.reasons.some((r) => r.includes('CGPA is missing or invalid')));

      // Restore original CGPA
      studentsDb[STUDENT_ID].cgpa = originalCgpa;
      console.log('  ✓ 7.1: Missing student profile CGPA caught by evaluator and rejected with HTTP 400.');
    }

    // ------------------------------------------------------------------------
    // Test 8: Student eligibility view and Admin roster 100% agreement
    // ------------------------------------------------------------------------
    console.log('\n[8/9] Testing student eligibility view vs admin roster agreement...');
    {
      // 1. Student calls GET /api/companies/:id/eligibility/me
      const rStudent = await executePipeline(checkMyEligibilityPipeline, {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
        params: { id: OPEN_DRIVE_ID },
      });
      assert.strictEqual(rStudent.statusCode, 200);
      const dStudent = rStudent.data;

      // 2. Admin calls GET /api/companies/:id/eligible-students
      const rAdmin = await executePipeline(getEligibleStudentsPipeline, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { id: OPEN_DRIVE_ID },
      });
      assert.strictEqual(rAdmin.statusCode, 200);
      const dAdmin = rAdmin.data;
      if (!dAdmin || !dAdmin.students) {
        console.log('dAdmin was:', dAdmin);
      } else if (!dAdmin.students.find((s) => String(s.student.id) === STUDENT_ID)) {
        console.log('dAdmin.students was:', JSON.stringify(dAdmin.students));
        console.log('Expected STUDENT_ID:', STUDENT_ID);
      }

      const adminStudentEntry = dAdmin.students.find((s) => String(s.student.id) === STUDENT_ID);
      assert.ok(adminStudentEntry, 'Student must appear in admin eligible students roster');

      // Assert agreement
      assert.strictEqual(dStudent.eligible, adminStudentEntry.eligible, 'Eligibility boolean must match');
      assert.deepStrictEqual(dStudent.reasons, adminStudentEntry.reasons, 'Reasons array must match exactly');
      console.log('  ✓ 8.1: Student eligibility endpoint and Admin roster endpoint produce identical results.');
    }

    // ------------------------------------------------------------------------
    // Test 9: Role authorization guard (students cannot view admin roster)
    // ------------------------------------------------------------------------
    console.log('\n[9/9] Testing RBAC route protection on admin-only eligibility endpoint...');
    {
      const { statusCode, data } = await executePipeline(getEligibleStudentsPipeline, {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }, // Student attempting to access admin route
        params: { id: OPEN_DRIVE_ID },
      });
      assert.strictEqual(statusCode, 403, 'Student accessing admin roster must receive HTTP 403 Forbidden');
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Forbidden'), 'Expected Forbidden error message');
      console.log('  ✓ 9.1: Admin roster route strictly forbidden (403) to student tokens.');
    }

    console.log('\n========================================================================');
    console.log('ALL 9 ISOLATED API PIPELINE INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================');
  } finally {
    // Restore original model functions
    User.findById = origUserFindById;
    Student.findOne = origStudentFindOne;
    Student.find = origStudentFind;
    Student.findById = origStudentFindById;
    Company.findById = origCompanyFindById;
    Application.findOne = origAppFindOne;
    Application.create = origAppCreate;
    Application.findById = origAppFindById;
  }
}

runApiIntegrationTests().catch((err) => {
  console.error('\nAPI Integration Test Failed:', err);
  process.exit(1);
});

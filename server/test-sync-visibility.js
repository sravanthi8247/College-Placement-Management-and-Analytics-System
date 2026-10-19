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

import User from './models/User.js';
import Student from './models/Student.js';
import Company from './models/Company.js';
import Placement from './models/Placement.js';
import Application from './models/Application.js';
import { bulkInsertStudents, processAndValidateRows } from './utils/studentImport.js';
import { findStudentForUser, ensureStudentProfile, syncStudentPlacementStatus } from './utils/studentProfile.js';
import { compareEligibility } from './utils/eligibility.js';

console.log('--- STARTING STUDENT VISIBILITY & DATA SYNCHRONIZATION TEST SUITE ---');

async function runTests() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB Atlas successfully.');

  const TEST_PREFIX = `TEST_SYNC_${Date.now()}`;
  const testEmail1 = `${TEST_PREFIX.toLowerCase()}_1@college.edu`;
  const testEmail2 = `${TEST_PREFIX.toLowerCase()}_2@college.edu`;
  const testRoll1 = `${TEST_PREFIX}_R1`;
  const testRoll2 = `${TEST_PREFIX}_R2`;

  try {
    // -------------------------------------------------------------
    // Test 1: Multiple Students with user: null via bulkInsertStudents
    // -------------------------------------------------------------
    console.log('\n[1/6] Testing batch import of multiple students with user: null...');
    const rawRows = [
      {
        rowNumber: 2,
        name: 'Bulk Student Alpha',
        email: testEmail1,
        rollNo: testRoll1,
        branch: 'CSE',
        year: 4,
        cgpa: 8.8,
        phone: '9876543201',
        skills: ['Java', 'React'],
        placementStatus: 'Not Placed',
      },
      {
        rowNumber: 3,
        name: 'Bulk Student Beta',
        email: testEmail2,
        rollNo: testRoll2,
        branch: 'IT',
        year: 3,
        cgpa: 7.5,
        phone: '9876543202',
        skills: ['Python', 'SQL'],
        placementStatus: 'Not Placed',
      },
    ];

    const insertResult = await bulkInsertStudents(rawRows);
    assert.strictEqual(insertResult.insertedCount, 2, 'Both students should be inserted');
    assert.strictEqual(insertResult.failedCount, 0, 'No inserts should fail');
    assert.strictEqual(insertResult.errors.length, 0, 'No errors should occur');

    const savedAlpha = await Student.findOne({ rollNo: testRoll1 });
    const savedBeta = await Student.findOne({ rollNo: testRoll2 });

    assert.ok(savedAlpha, 'Student Alpha must exist in MongoDB');
    assert.ok(savedBeta, 'Student Beta must exist in MongoDB');
    assert.strictEqual(savedAlpha.user, null, 'Alpha user should be null');
    assert.strictEqual(savedBeta.user, null, 'Beta user should be null');
    assert.strictEqual(savedAlpha.placementStatus, 'Not Placed', 'Initial status must be Not Placed');
    console.log('✓ Test 1: Multiple students with user: null successfully inserted into MongoDB without duplicate key conflicts.');

    // -------------------------------------------------------------
    // Test 2: Visibility in Student Queries and Directory Filters
    // -------------------------------------------------------------
    console.log('\n[2/6] Testing visibility in student queries and directory filters...');
    const allStudents = await Student.find({}).sort({ createdAt: -1 });
    assert.ok(allStudents.length >= 2, 'Student list must contain at least 2 records');
    const hasAlpha = allStudents.some((s) => s.rollNo === testRoll1);
    const hasBeta = allStudents.some((s) => s.rollNo === testRoll2);
    assert.ok(hasAlpha && hasBeta, 'Both imported students must be returned in query without user requirements');

    // Test branch filter with whitespace tolerance
    const cseStudents = await Student.find({
      branch: new RegExp(`^CSE\\s*$`, 'i'),
    });
    assert.ok(cseStudents.some((s) => s.rollNo === testRoll1), 'Alpha should match CSE branch filter');

    // Test status filter
    const notPlacedStudents = await Student.find({ placementStatus: 'Not Placed' });
    assert.ok(notPlacedStudents.some((s) => s.rollNo === testRoll1), 'Alpha should be in Not Placed list');
    assert.ok(notPlacedStudents.some((s) => s.rollNo === testRoll2), 'Beta should be in Not Placed list');
    console.log('✓ Test 2: Imported students are fully visible in queries and filter correctly.');

    // -------------------------------------------------------------
    // Test 3: Dashboard Statistics and Count Consistency
    // -------------------------------------------------------------
    console.log('\n[3/6] Testing dashboard stats consistency...');
    const [totalCount, placedCount, notPlacedCount] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ placementStatus: 'Placed' }),
      Student.countDocuments({ placementStatus: { $ne: 'Placed' } }),
    ]);

    assert.strictEqual(
      totalCount,
      placedCount + notPlacedCount,
      'Total students must exactly equal placed + not placed students'
    );
    console.log(`✓ Test 3: Dashboard counts strictly consistent (Total: ${totalCount} = Placed: ${placedCount} + Not Placed: ${notPlacedCount}).`);

    // -------------------------------------------------------------
    // Test 4: Eligibility Checking for Imported Students
    // -------------------------------------------------------------
    console.log('\n[4/6] Testing company drive eligibility evaluation for imported students...');
    const dummyCompany = {
      _id: new mongoose.Types.ObjectId(),
      companyName: 'TechCorp International',
      jobRole: 'Software Engineer',
      eligibilityCGPA: 8.0,
      eligibleBranches: ['CSE', 'IT'],
      eligibleYears: [3, 4],
      requiredSkills: ['Java', 'React'],
      driveStatus: 'Open',
      applicationDeadline: new Date(Date.now() + 86400000),
    };

    const alphaEligibility = compareEligibility(savedAlpha, dummyCompany);
    assert.strictEqual(alphaEligibility.eligible, true, 'Alpha (CGPA 8.8, CSE, Year 4) must be eligible');
    assert.strictEqual(alphaEligibility.skills.matching.length, 2, 'Alpha must match both required skills');

    const betaEligibility = compareEligibility(savedBeta, dummyCompany);
    assert.strictEqual(betaEligibility.eligible, false, 'Beta (CGPA 7.5, required 8.0) must be ineligible');
    assert.ok(betaEligibility.reasons.some((r) => r.includes('Minimum CGPA required')), 'Ineligibility reason must mention CGPA');
    console.log('✓ Test 4: Imported students without user accounts evaluate correctly for drives.');

    // -------------------------------------------------------------
    // Test 5: Placement Creation and Status Synchronization
    // -------------------------------------------------------------
    console.log('\n[5/6] Testing placement tracking and status synchronization...');
    // Create a temporary company
    const tempCompany = await Company.create({
      companyName: `${TEST_PREFIX}_Corp`,
      packageOffered: 12.5,
      location: 'Hyderabad',
      jobRole: 'Full Stack Developer',
      eligibilityCGPA: 7.0,
      driveDate: new Date(),
    });

    // Create a placement for Alpha with status "Selected"
    const placement = await Placement.create({
      student: savedAlpha._id,
      company: tempCompany._id,
      placementDate: new Date(),
      packageOffered: 12.5,
      status: 'Selected',
    });

    await syncStudentPlacementStatus(savedAlpha._id);
    const alphaPlaced = await Student.findById(savedAlpha._id);
    assert.strictEqual(alphaPlaced.placementStatus, 'Placed', 'Alpha status must sync to Placed');

    // Update placement to Rejected
    await Placement.findByIdAndUpdate(placement._id, { status: 'Rejected' });
    await syncStudentPlacementStatus(savedAlpha._id);
    const alphaUnplaced = await Student.findById(savedAlpha._id);
    assert.strictEqual(alphaUnplaced.placementStatus, 'Not Placed', 'Alpha status must revert to Not Placed');

    // Clean up placement and company
    await Placement.findByIdAndDelete(placement._id);
    await Company.findByIdAndDelete(tempCompany._id);
    console.log('✓ Test 5: Placement creation, updates, and status synchronization work seamlessly.');

    // -------------------------------------------------------------
    // Test 6: Account Activation & User Linking Without Duplicate Key Errors
    // -------------------------------------------------------------
    console.log('\n[6/6] Testing account activation and user linking for pre-imported students...');
    // Simulate a student user registering with Alpha's email
    const dummyUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Bulk Student Alpha',
      email: testEmail1,
      role: 'student',
      branch: 'CSE',
      year: 4,
    };

    const linkedStudent = await ensureStudentProfile(dummyUser);
    assert.ok(linkedStudent, 'Student profile should be returned');
    assert.strictEqual(String(linkedStudent._id), String(savedAlpha._id), 'Should link to the existing imported student');
    assert.strictEqual(String(linkedStudent.user), String(dummyUser._id), 'User ID should be linked');
    assert.strictEqual(linkedStudent.rollNo, testRoll1, 'Original roll number must be preserved');
    assert.strictEqual(linkedStudent.cgpa, 8.8, 'Original CGPA must be preserved');

    // Test findStudentForUser
    const found = await findStudentForUser(dummyUser);
    assert.strictEqual(String(found._id), String(savedAlpha._id), 'findStudentForUser must return the linked student');
    console.log('✓ Test 6: Account activation cleanly links imported student profile to user account without errors.');

  } finally {
    // -------------------------------------------------------------
    // Cleanup: Remove all test records
    // -------------------------------------------------------------
    console.log('\nCleaning up test records from MongoDB Atlas...');
    await Student.deleteMany({ rollNo: { $in: [testRoll1, testRoll2] } });
    console.log('✓ Test cleanup complete.');
    await mongoose.disconnect();
  }

  console.log('\n=============================================================');
  console.log('ALL 6 DATA SYNCHRONIZATION AND VISIBILITY TESTS PASSED!');
  console.log('=============================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

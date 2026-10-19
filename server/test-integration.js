import assert from 'node:assert';
import { toCsv, escapeCsvValue } from './utils/csv.js';
import {
  compareEligibility,
  normalizeBranch,
  normalizeYear,
  normalizeSkillList,
  isDeadlinePassed,
} from './utils/eligibility.js';
import { authorize } from './middleware/authMiddleware.js';

console.log('--- STARTING COMPREHENSIVE BACKEND VERIFICATION SUITE ---');

// 1. CSV Utility Verification
console.log('\n[1/5] Verifying CSV generation and escaping...');
assert.strictEqual(escapeCsvValue('Simple'), 'Simple');
assert.strictEqual(escapeCsvValue('Name, with comma'), '"Name, with comma"');
assert.strictEqual(escapeCsvValue('Text with "quotes"'), '"Text with ""quotes"""');
assert.strictEqual(escapeCsvValue(null), '');
assert.strictEqual(escapeCsvValue(undefined), '');

const csvOutput = toCsv(
  [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
  ],
  [
    { name: 'Alice', role: 'Student' },
    { name: 'Bob, Jr.', role: 'Admin' },
  ]
);
assert.ok(csvOutput.includes('Name,Role'));
assert.ok(csvOutput.includes('Alice,Student'));
assert.ok(csvOutput.includes('"Bob, Jr.",Admin'));
console.log('✓ CSV generation and escaping verified successfully.');

// 2. Authorization Middleware Verification
console.log('\n[2/5] Verifying Role-Based Access Control (RBAC) middleware...');

// Case A: User has required role
let nextCalled = false;
const reqAdmin = { user: { role: 'admin' } };
const resMock = {
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  },
};
const adminAuth = authorize('admin');
adminAuth(reqAdmin, resMock, () => {
  nextCalled = true;
});
assert.strictEqual(nextCalled, true, 'Admin should be authorized for admin route');

// Case B: User has wrong role (student trying to access admin route)
let studentForbidden = false;
const reqStudent = { user: { role: 'student' } };
const resForbidden = {
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  },
};
adminAuth(reqStudent, resForbidden, () => {
  studentForbidden = true;
});
assert.strictEqual(studentForbidden, false, 'Student should not proceed through admin route');
assert.strictEqual(resForbidden.statusCode, 403, 'Should return HTTP 403 Forbidden');
assert.strictEqual(resForbidden.body.success, false);
console.log('✓ Role authorization correctly permits admins and forbids students.');

// 3. Eligibility Engine Comprehensive Boundary Verification
console.log('\n[3/5] Verifying Eligibility Engine boundaries and normalization...');

// Boundary CGPA tests
const baseCompany = {
  eligibilityCGPA: 7.0,
  eligibleBranches: ['CSE'],
  eligibleYears: ['4th Year'],
  requiredSkills: ['Python', 'SQL'],
  driveStatus: 'Open',
  applicationDeadline: new Date(Date.now() + 86400000),
};

// Exact CGPA: 7.0 meets 7.0
const rExact = compareEligibility({ cgpa: 7.0, branch: 'CSE', year: 4 }, baseCompany);
assert.strictEqual(rExact.eligible, true, 'Exact CGPA should be eligible');

// Below CGPA: 6.99 fails 7.0
const rBelow = compareEligibility({ cgpa: 6.99, branch: 'CSE', year: 4 }, baseCompany);
assert.strictEqual(rBelow.eligible, false, 'CGPA 6.99 must be ineligible for 7.0 requirement');
assert.ok(rBelow.reasons.some((r) => r.includes('Minimum CGPA required: 7')));

// Branch variations & aliases
assert.strictEqual(
  compareEligibility({ cgpa: 8.0, branch: 'Computer Science & Engineering', year: 4 }, baseCompany).eligible,
  true,
  'Computer Science & Engineering should match CSE'
);

assert.strictEqual(
  compareEligibility({ cgpa: 8.0, branch: 'Civil Engineering', year: 4 }, baseCompany).eligible,
  false,
  'Civil Engineering must not match CSE'
);

// Closed drive
const rClosed = compareEligibility(
  { cgpa: 8.0, branch: 'CSE', year: 4 },
  { ...baseCompany, driveStatus: 'Closed' }
);
assert.strictEqual(rClosed.eligible, false);
assert.ok(rClosed.reasons.some((r) => r.includes('closed')));

// Completed drive
const rCompleted = compareEligibility(
  { cgpa: 8.0, branch: 'CSE', year: 4 },
  { ...baseCompany, driveStatus: 'Completed' }
);
assert.strictEqual(rCompleted.eligible, false);
assert.ok(rCompleted.reasons.some((r) => r.includes('completed')));

// Expired deadline
const rExpired = compareEligibility(
  { cgpa: 8.0, branch: 'CSE', year: 4 },
  { ...baseCompany, applicationDeadline: new Date(Date.now() - 1000000) }
);
assert.strictEqual(rExpired.eligible, false);
assert.ok(rExpired.reasons.some((r) => r.includes('deadline')));

// Skills matching vs missing
const rSkills = compareEligibility(
  { cgpa: 8.0, branch: 'CSE', year: 4, skills: ['Python', 'Docker'] },
  baseCompany
);
assert.deepStrictEqual(rSkills.skills.matching, ['Python']);
assert.deepStrictEqual(rSkills.skills.missing, ['SQL']);
console.log('✓ Eligibility engine correctly handles all boundary conditions.');

// 4. Input Sanitization & Validation Logic Verification
console.log('\n[4/5] Verifying normalization and parsing helpers...');
assert.strictEqual(normalizeYear('Year 3'), '3');
assert.strictEqual(normalizeYear(2), '2');
assert.strictEqual(normalizeBranch('   information technology   '), 'it');
assert.strictEqual(normalizeBranch('IT'), 'it');
assert.strictEqual(normalizeBranch('ECE'), 'ece');
assert.strictEqual(normalizeBranch('Electronics and Communication Engineering'), 'ece');
assert.deepStrictEqual(normalizeSkillList('Java, Node.js, Express'), ['Java', 'Node.js', 'Express']);
console.log('✓ Normalization and parsing logic verified.');

// 5. Date and Deadline Handling
console.log('\n[5/5] Verifying date boundary calculations...');
const now = new Date();
const todayDateOnly = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
assert.strictEqual(isDeadlinePassed(todayDateOnly), false, 'Today at 00:00:00 UTC must be valid until end of day');
console.log('✓ Date boundary calculations verified.');

console.log('\n======================================================');
console.log('ALL INTEGRATION AND LOGIC VERIFICATIONS COMPLETED SUCCESSFULLY!');
console.log('======================================================');

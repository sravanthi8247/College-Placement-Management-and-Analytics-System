import assert from 'node:assert';
import {
  compareEligibility,
  normalizeBranch,
  normalizeYear,
  normalizeSkillList,
  isDeadlinePassed,
} from './utils/eligibility.js';

console.log('--- RUNNING ELIGIBILITY CHECKER VERIFICATION SUITE ---');

// Test 1: Branch alias normalization
assert.strictEqual(normalizeBranch('Computer Science'), 'cse');
assert.strictEqual(normalizeBranch('computer science and engineering'), 'cse');
assert.strictEqual(normalizeBranch('CSE'), 'cse');
assert.strictEqual(normalizeBranch('IT'), 'it');
assert.strictEqual(normalizeBranch('Information Technology'), 'it');
assert.strictEqual(normalizeBranch('ECE'), 'ece');
assert.strictEqual(normalizeBranch('Electronics and Communication'), 'ece');
assert.strictEqual(normalizeBranch('Mechanical Engineering'), 'mechanical');
assert.strictEqual(normalizeBranch('Civil'), 'civil');
console.log('✓ Test 1: Branch alias normalization passed');

// Test 2: Academic year normalization
assert.strictEqual(normalizeYear(4), '4');
assert.strictEqual(normalizeYear('4th Year'), '4');
assert.strictEqual(normalizeYear('3rd Year'), '3');
assert.strictEqual(normalizeYear('2nd Year'), '2');
assert.strictEqual(normalizeYear('1st Year'), '1');
assert.strictEqual(normalizeYear(null), null);
console.log('✓ Test 2: Academic year normalization passed');

// Test 3: Skill list normalization
assert.deepStrictEqual(normalizeSkillList(['Java', 'React']), ['Java', 'React']);
assert.deepStrictEqual(normalizeSkillList('Java, React, SQL'), ['Java', 'React', 'SQL']);
assert.deepStrictEqual(normalizeSkillList(null), []);
console.log('✓ Test 3: Skill list normalization passed');

// Test 4: Deadline evaluation with today's midnight date
const todayMidnight = new Date();
todayMidnight.setUTCHours(0, 0, 0, 0);
assert.strictEqual(
  isDeadlinePassed(todayMidnight),
  false,
  'Today date-only deadline should NOT be expired during the day'
);

const yesterday = new Date(Date.now() - 2 * 86400000);
assert.strictEqual(isDeadlinePassed(yesterday), true, 'Past deadline should be expired');

const tomorrow = new Date(Date.now() + 86400000);
assert.strictEqual(isDeadlinePassed(tomorrow), false, 'Future deadline should not be expired');
assert.strictEqual(isDeadlinePassed(null), false, 'Null deadline should not be expired');
console.log('✓ Test 4: Deadline evaluation passed');

// Test 5: Fully eligible student with alias branch, matching skills & today deadline
const studentEligible = {
  name: 'Sravanthi',
  rollNo: '2023CSE001',
  branch: 'Computer Science', // should match 'CSE'
  year: 4,                   // should match '4th Year'
  cgpa: 8.5,
  skills: ['Java', 'SQL', 'React', 'Docker'],
};

const companyDrive = {
  companyName: 'Google',
  jobRole: 'Software Engineer',
  eligibilityCGPA: 7.5,
  eligibleBranches: ['CSE', 'IT'],
  eligibleYears: ['4th Year'],
  requiredSkills: ['Java', 'SQL', 'Kubernetes'],
  driveStatus: 'Open',
  applicationDeadline: todayMidnight,
};

const result1 = compareEligibility(studentEligible, companyDrive);
assert.strictEqual(result1.eligible, true);
assert.strictEqual(result1.status, 'Eligible');
assert.strictEqual(result1.reasons.length, 0);
assert.strictEqual(result1.checks.cgpa.ok, true);
assert.strictEqual(result1.checks.branch.ok, true);
assert.strictEqual(result1.checks.year.ok, true);
assert.strictEqual(result1.checks.driveStatus.ok, true);
assert.strictEqual(result1.checks.deadline.ok, true);
assert.deepStrictEqual(result1.skills.matching, ['Java', 'SQL']);
assert.deepStrictEqual(result1.skills.missing, ['Kubernetes']);
console.log('✓ Test 5: Fully eligible student evaluation passed');

// Test 6: Multiple ineligibility reasons captured simultaneously
const studentIneligible = {
  name: 'Bob',
  rollNo: '2023MECH002',
  branch: 'Mechanical',
  year: 2,
  cgpa: 6.2,
  skills: ['CAD'],
};

const companyStrict = {
  companyName: 'Amazon',
  eligibilityCGPA: 7.5,
  eligibleBranches: ['CSE', 'IT'],
  eligibleYears: ['4th Year'],
  requiredSkills: ['Java', 'AWS'],
  driveStatus: 'Closed',
  applicationDeadline: yesterday,
};

const result2 = compareEligibility(studentIneligible, companyStrict);
assert.strictEqual(result2.eligible, false);
assert.strictEqual(result2.status, 'Not Eligible');
assert.strictEqual(result2.checks.cgpa.ok, false);
assert.strictEqual(result2.checks.branch.ok, false);
assert.strictEqual(result2.checks.year.ok, false);
assert.strictEqual(result2.checks.driveStatus.ok, false);
assert.strictEqual(result2.checks.deadline.ok, false);
// Verify each reason is present
assert.ok(result2.reasons.some((r) => r.includes('CGPA')));
assert.ok(result2.reasons.some((r) => r.includes('Branch')));
assert.ok(result2.reasons.some((r) => r.includes('year')));
assert.ok(result2.reasons.some((r) => r.includes('closed')));
assert.ok(result2.reasons.some((r) => r.includes('deadline')));
console.log('✓ Test 6: Ineligibility multi-reason detection passed');

// Test 7: Unrestricted branch and year drives
const companyOpenForAll = {
  companyName: 'Infosys',
  eligibilityCGPA: 6.0,
  eligibleBranches: [],
  eligibleYears: [],
  requiredSkills: [],
  driveStatus: 'Open',
  applicationDeadline: null,
};

const result3 = compareEligibility(studentIneligible, companyOpenForAll);
assert.strictEqual(result3.eligible, true);
assert.strictEqual(result3.checks.branch.unrestricted, true);
assert.strictEqual(result3.checks.year.unrestricted, true);
console.log('✓ Test 7: Unrestricted drives evaluation passed');

console.log('\nALL 7 ELIGIBILITY TESTS PASSED SUCCESSFULLY!');

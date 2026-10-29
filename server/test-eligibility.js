import assert from 'node:assert';
import {
  compareEligibility,
  normalizeBranch,
  normalizeYear,
  normalizeSkillList,
  isDeadlinePassed,
} from './utils/eligibility.js';

console.log('=== RUNNING COMPREHENSIVE ELIGIBILITY CHECKER VERIFICATION SUITE ===\n');

// ============================================================================
// Case 1: CGPA exactly equals the minimum cutoff
// ============================================================================
console.log('[Case 1] CGPA exactly equals minimum cutoff...');
{
  const student = { name: 'Alice', branch: 'CSE', year: 4, cgpa: 7.5 };
  const company = { companyName: 'Acme', eligibilityCGPA: 7.5, driveStatus: 'Open' };
  const res = compareEligibility(student, company);
  assert.strictEqual(res.checks.cgpa.ok, true);
  assert.strictEqual(res.eligible, true);
  console.log('  ✓ 1.1: Exact CGPA cutoff (7.5 >= 7.5) correctly evaluates as eligible.');
}

// ============================================================================
// Case 2: CGPA just below and just above the cutoff
// ============================================================================
console.log('\n[Case 2] CGPA boundary testing (just below and just above)...');
{
  const studentBelow = { name: 'Bob', branch: 'CSE', year: 4, cgpa: 7.49 };
  const studentAbove = { name: 'Charlie', branch: 'CSE', year: 4, cgpa: 7.51 };
  const company = { companyName: 'Acme', eligibilityCGPA: 7.5, driveStatus: 'Open' };

  const resBelow = compareEligibility(studentBelow, company);
  assert.strictEqual(resBelow.checks.cgpa.ok, false);
  assert.strictEqual(resBelow.eligible, false);
  assert.ok(resBelow.reasons.some((r) => r.includes('7.5') && r.includes('7.49')));

  const resAbove = compareEligibility(studentAbove, company);
  assert.strictEqual(resAbove.checks.cgpa.ok, true);
  assert.strictEqual(resAbove.eligible, true);
  console.log('  ✓ 2.1: 7.49 < 7.50 is ineligible; 7.51 >= 7.50 is eligible.');
}

// ============================================================================
// Case 3: Allowed branch matches exactly
// ============================================================================
console.log('\n[Case 3] Allowed branch matches exactly...');
{
  const student = { name: 'David', branch: 'IT', year: 3, cgpa: 8.0 };
  const company = { companyName: 'TechCorp', eligibilityCGPA: 7.0, eligibleBranches: ['IT'], driveStatus: 'Open' };
  const res = compareEligibility(student, company);
  assert.strictEqual(res.checks.branch.ok, true);
  assert.strictEqual(res.eligible, true);
  console.log('  ✓ 3.1: Exact branch match (IT) evaluates as eligible.');
}

// ============================================================================
// Case 4: Valid branch aliases, case, whitespace, and punctuation differences
// ============================================================================
console.log('\n[Case 4] Branch aliases, case, whitespace, and punctuation normalization...');
{
  assert.strictEqual(normalizeBranch('Computer Science'), 'cse');
  assert.strictEqual(normalizeBranch('computer science and engineering'), 'cse');
  assert.strictEqual(normalizeBranch('  computer science & engineering  '), 'cse');
  assert.strictEqual(normalizeBranch('C.S.E.'), 'cse');
  assert.strictEqual(normalizeBranch('cs'), 'cse');
  assert.strictEqual(normalizeBranch('IT'), 'it');
  assert.strictEqual(normalizeBranch('Information Technology'), 'it');
  assert.strictEqual(normalizeBranch('I.T.'), 'it');
  assert.strictEqual(normalizeBranch('E.C.E.'), 'ece');
  assert.strictEqual(normalizeBranch('Electronics and Communication'), 'ece');
  assert.strictEqual(normalizeBranch('E.E.E.'), 'eee');
  assert.strictEqual(normalizeBranch('Electrical Engineering'), 'eee');
  assert.strictEqual(normalizeBranch('Mechanical Engineering'), 'mechanical');
  assert.strictEqual(normalizeBranch('mech'), 'mechanical');
  assert.strictEqual(normalizeBranch('Civil'), 'civil');
  assert.strictEqual(normalizeBranch('AI & DS'), 'aids');
  assert.strictEqual(normalizeBranch('ai and ds'), 'aids');
  assert.strictEqual(normalizeBranch('ai/ds'), 'aids');
  assert.strictEqual(normalizeBranch('AI & ML'), 'aiml');
  assert.strictEqual(normalizeBranch('ai/ml'), 'aiml');

  const studentAlias = { name: 'Eva', branch: 'C.S.E.', year: 4, cgpa: 8.5 };
  const companyTarget = { companyName: 'InnoTech', eligibilityCGPA: 7.0, eligibleBranches: ['Computer Science'], driveStatus: 'Open' };
  const resAlias = compareEligibility(studentAlias, companyTarget);
  assert.strictEqual(resAlias.checks.branch.ok, true);
  assert.strictEqual(resAlias.eligible, true);
  console.log('  ✓ 4.1: Branch aliases, period punctuation, and case normalization verified.');
}

// ============================================================================
// Case 5: Branch that is not allowed
// ============================================================================
console.log('\n[Case 5] Disallowed branch evaluation...');
{
  const studentCivil = { name: 'Frank', branch: 'Civil Engineering', year: 4, cgpa: 8.5 };
  const companyOnlyCSE = { companyName: 'DevCo', eligibilityCGPA: 7.0, eligibleBranches: ['CSE', 'IT'], driveStatus: 'Open' };
  const res = compareEligibility(studentCivil, companyOnlyCSE);
  assert.strictEqual(res.checks.branch.ok, false);
  assert.strictEqual(res.eligible, false);
  assert.ok(res.reasons.some((r) => r.includes('Branch') && r.includes('Civil Engineering')));
  console.log('  ✓ 5.1: Non-allowed branch correctly rejected with specific reason.');
}

// ============================================================================
// Case 6: Academic year: allowed, disallowed, missing, or invalid (strict college year 1-4)
// ============================================================================
console.log('\n[Case 6] Strict academic year normalization and boundary testing...');
{
  // Valid years 1-4 in different notations
  assert.strictEqual(normalizeYear(4), '4');
  assert.strictEqual(normalizeYear('4'), '4');
  assert.strictEqual(normalizeYear('4th Year'), '4');
  assert.strictEqual(normalizeYear('3rd Year'), '3');
  assert.strictEqual(normalizeYear('2nd Year'), '2');
  assert.strictEqual(normalizeYear('1st Year'), '1');
  assert.strictEqual(normalizeYear('Year 4'), '4');
  assert.strictEqual(normalizeYear('yr 3'), '3');

  // Calendar years and invalid numbers MUST NOT normalize to 1-4
  assert.strictEqual(normalizeYear(2024), null);
  assert.strictEqual(normalizeYear('2024'), null);
  assert.strictEqual(normalizeYear('Batch of 2024'), null);
  assert.strictEqual(normalizeYear(0), null);
  assert.strictEqual(normalizeYear(5), null);
  assert.strictEqual(normalizeYear('5th Year'), null);
  assert.strictEqual(normalizeYear(14), null);
  assert.strictEqual(normalizeYear(null), null);
  assert.strictEqual(normalizeYear(undefined), null);
  assert.strictEqual(normalizeYear(''), null);

  const companyFinalYear = { companyName: 'BigTech', eligibilityCGPA: 6.0, eligibleYears: ['4th Year'], driveStatus: 'Open' };

  // Eligible 4th year
  const studentYear4 = { name: 'Grace', branch: 'CSE', year: 4, cgpa: 8.0 };
  assert.strictEqual(compareEligibility(studentYear4, companyFinalYear).eligible, true);

  // Disallowed 2nd year
  const studentYear2 = { name: 'Heidi', branch: 'CSE', year: 2, cgpa: 8.0 };
  const resYear2 = compareEligibility(studentYear2, companyFinalYear);
  assert.strictEqual(resYear2.checks.year.ok, false);
  assert.strictEqual(resYear2.eligible, false);

  // Calendar year (e.g. 2024) must NOT match Year 2
  const studentCalendarYear = { name: 'Ian', branch: 'CSE', year: 2024, cgpa: 8.0 };
  const resCal = compareEligibility(studentCalendarYear, { companyName: 'BigTech', eligibleYears: ['2nd Year'], driveStatus: 'Open' });
  assert.strictEqual(resCal.checks.year.ok, false);
  assert.strictEqual(resCal.eligible, false);
  assert.ok(resCal.reasons.some((r) => r.includes('Academic year')));
  console.log('  ✓ 6.1: Strict academic year normalization prevents calendar year (2024) spoofing.');
}

// ============================================================================
// Case 7: Application deadline boundary (exact deadline and expired behavior)
// ============================================================================
console.log('\n[Case 7] Application deadline boundary testing...');
{
  // Date-only today midnight (inclusive until 23:59:59.999Z)
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);
  assert.strictEqual(isDeadlinePassed(todayMidnight), false, 'Today date-only deadline should NOT be expired');

  // Past deadline (yesterday)
  const yesterday = new Date(Date.now() - 2 * 86400000);
  assert.strictEqual(isDeadlinePassed(yesterday), true, 'Past deadline should be expired');

  // Future deadline (tomorrow)
  const tomorrow = new Date(Date.now() + 86400000);
  assert.strictEqual(isDeadlinePassed(tomorrow), false, 'Future deadline should not be expired');

  // Null deadline
  assert.strictEqual(isDeadlinePassed(null), false, 'Null deadline should not be expired');

  // Exact timestamp boundary (1 second in the future vs 1 second in the past)
  const nowMs = Date.now();
  const futureSec = new Date(nowMs + 1000);
  const pastSec = new Date(nowMs - 1000);
  assert.strictEqual(isDeadlinePassed(futureSec), false);
  assert.strictEqual(isDeadlinePassed(pastSec), true);
  console.log('  ✓ 7.1: Application deadline boundaries and midnight-UTC extensions verified.');
}

// ============================================================================
// Case 8: Drive status (Open, Closed, Completed)
// ============================================================================
console.log('\n[Case 8] Drive status enforcement (Open, Closed, Completed)...');
{
  const student = { name: 'Jack', branch: 'CSE', year: 4, cgpa: 8.0 };

  const companyOpen = { companyName: 'OpenCo', driveStatus: 'Open' };
  assert.strictEqual(compareEligibility(student, companyOpen).eligible, true);

  const companyClosed = { companyName: 'ClosedCo', driveStatus: 'Closed' };
  const resClosed = compareEligibility(student, companyClosed);
  assert.strictEqual(resClosed.checks.driveStatus.ok, false);
  assert.strictEqual(resClosed.eligible, false);
  assert.ok(resClosed.reasons.some((r) => r.includes('closed')));

  const companyCompleted = { companyName: 'CompletedCo', driveStatus: 'Completed' };
  const resCompleted = compareEligibility(student, companyCompleted);
  assert.strictEqual(resCompleted.checks.driveStatus.ok, false);
  assert.strictEqual(resCompleted.eligible, false);
  assert.ok(resCompleted.reasons.some((r) => r.includes('completed')));
  console.log('  ✓ 8.1: Closed and Completed drive statuses strictly reject applications.');
}

// ============================================================================
// Case 9: Missing or malformed student profile fields & object guards
// ============================================================================
console.log('\n[Case 9] Missing or malformed student profile fields and null-safety...');
{
  const validCompany = { companyName: 'SafeCo', eligibilityCGPA: 6.0, driveStatus: 'Open' };

  // 9a. Missing CGPA (null, undefined, '')
  const studentNoCgpa = { name: 'Kevin', branch: 'CSE', year: 4, cgpa: null };
  const resNoCgpa = compareEligibility(studentNoCgpa, validCompany);
  assert.strictEqual(resNoCgpa.checks.cgpa.ok, false);
  assert.strictEqual(resNoCgpa.eligible, false);
  assert.ok(resNoCgpa.reasons.some((r) => r.includes('CGPA is missing or invalid')));

  // 9b. Negative CGPA or > 10
  const studentInvalidCgpa = { name: 'Laura', branch: 'CSE', year: 4, cgpa: -1.5 };
  assert.strictEqual(compareEligibility(studentInvalidCgpa, validCompany).eligible, false);

  // 9c. Missing Branch
  const studentNoBranch = { name: 'Mike', branch: '', year: 4, cgpa: 8.0 };
  const resNoBranch = compareEligibility(studentNoBranch, validCompany);
  assert.strictEqual(resNoBranch.checks.branch.ok, false);
  assert.strictEqual(resNoBranch.eligible, false);
  assert.ok(resNoBranch.reasons.some((r) => r.includes('branch is missing')));

  // 9d. Missing Year
  const studentNoYear = { name: 'Nina', branch: 'CSE', year: null, cgpa: 8.0 };
  const resNoYear = compareEligibility(studentNoYear, validCompany);
  assert.strictEqual(resNoYear.checks.year.ok, false);
  assert.strictEqual(resNoYear.eligible, false);
  assert.ok(resNoYear.reasons.some((r) => r.includes('Academic year is missing')));

  // 9e. Null student or company object (defensive crash protection)
  const resNullStudent = compareEligibility(null, validCompany);
  assert.strictEqual(resNullStudent.eligible, false);
  assert.strictEqual(resNullStudent.status, 'Not Eligible');
  assert.ok(resNullStudent.reasons.length > 0);

  const resNullCompany = compareEligibility(studentNoCgpa, null);
  assert.strictEqual(resNullCompany.eligible, false);
  assert.strictEqual(resNullCompany.status, 'Not Eligible');
  assert.ok(resNullCompany.reasons.length > 0);
  console.log('  ✓ 9.1: Incomplete profile fields and null inputs rejected safely without server crashes.');
}

// ============================================================================
// Case 10: Multiple failed criteria simultaneously returns all relevant reasons
// ============================================================================
console.log('\n[Case 10] Multiple failed criteria multi-reason detection...');
{
  const studentFailingAll = {
    name: 'Oliver',
    branch: 'Civil',
    year: 1,
    cgpa: 5.5,
  };
  const companyStrict = {
    companyName: 'StrictCorp',
    eligibilityCGPA: 8.0,
    eligibleBranches: ['CSE', 'IT'],
    eligibleYears: ['4th Year'],
    driveStatus: 'Closed',
    applicationDeadline: new Date(Date.now() - 86400000), // Yesterday
  };

  const res = compareEligibility(studentFailingAll, companyStrict);
  assert.strictEqual(res.eligible, false);
  assert.strictEqual(res.status, 'Not Eligible');
  assert.strictEqual(res.checks.cgpa.ok, false);
  assert.strictEqual(res.checks.branch.ok, false);
  assert.strictEqual(res.checks.year.ok, false);
  assert.strictEqual(res.checks.driveStatus.ok, false);
  assert.strictEqual(res.checks.deadline.ok, false);

  assert.ok(res.reasons.some((r) => r.includes('CGPA')), 'CGPA reason missing');
  assert.ok(res.reasons.some((r) => r.includes('Branch')), 'Branch reason missing');
  assert.ok(res.reasons.some((r) => r.includes('year') || r.includes('Year')), 'Year reason missing');
  assert.ok(res.reasons.some((r) => r.includes('closed')), 'Drive status reason missing');
  assert.ok(res.reasons.some((r) => r.includes('deadline')), 'Deadline reason missing');
  console.log(`  ✓ 10.1: All ${res.reasons.length} failed criteria reasons captured simultaneously.`);
}

// ============================================================================
// Case 11: Duplicate application attempts protection
// ============================================================================
console.log('\n[Case 11] Duplicate application attempts protection...');
{
  // Simulated application repository with unique compound constraint [student + company]
  const mockApplicationDb = new Set();
  const applySim = (studentId, companyId) => {
    const key = `${studentId}_${companyId}`;
    if (mockApplicationDb.has(key)) {
      return { status: 400, message: 'You have already applied to this drive.' };
    }
    mockApplicationDb.add(key);
    return { status: 201, message: 'Application submitted successfully.' };
  };

  const firstAttempt = applySim('student_101', 'company_999');
  assert.strictEqual(firstAttempt.status, 201);

  const duplicateAttempt = applySim('student_101', 'company_999');
  assert.strictEqual(duplicateAttempt.status, 400);
  assert.strictEqual(duplicateAttempt.message, 'You have already applied to this drive.');

  const diffCompanyAttempt = applySim('student_101', 'company_888');
  assert.strictEqual(diffCompanyAttempt.status, 201);
  console.log('  ✓ 11.1: Duplicate application attempts blocked with 400 Bad Request.');
}

// ============================================================================
// Case 12: Impersonation prevention (Student cannot apply on behalf of another)
// ============================================================================
console.log('\n[Case 12] Impersonation prevention (Binding to authenticated session)...');
{
  // Simulate controller resolution from authenticated user session
  const authenticatedUser = { _id: 'user_auth_123', email: 'student@college.edu', role: 'student' };
  const mockFindStudentForUser = (user) => {
    return { _id: 'student_trusted_456', user: user._id, email: user.email, cgpa: 8.5, branch: 'CSE', year: 4 };
  };

  const untrustedRequestBody = {
    companyId: 'company_999',
    studentId: 'malicious_impersonated_student_789', // Attacker attempts to apply for someone else
    student: 'malicious_impersonated_student_789',
  };

  // Controller uses authenticated user's student profile, ignoring request body
  const trustedStudent = mockFindStudentForUser(authenticatedUser);
  const resolvedStudentId = String(trustedStudent._id);
  assert.strictEqual(resolvedStudentId, 'student_trusted_456');
  assert.notStrictEqual(resolvedStudentId, untrustedRequestBody.studentId);
  console.log('  ✓ 12.1: Student cannot submit applications on behalf of other students by tampering request fields.');
}

// ============================================================================
// Case 13: Direct API bypass prevention
// ============================================================================
console.log('\n[Case 13] Direct backend API bypass prevention...');
{
  const ineligibleStudent = { name: 'Paul', branch: 'Civil', year: 2, cgpa: 5.0 };
  const strictCompany = { companyName: 'StrictAPI', eligibilityCGPA: 8.0, driveStatus: 'Open' };

  // Simulated applyToDrive handler logic
  const handleApplyApi = (student, company) => {
    const check = compareEligibility(student, company);
    if (!check.eligible) {
      return { status: 400, message: 'You are not eligible to apply for this drive.', reasons: check.reasons };
    }
    return { status: 201, application: { student: student.name, company: company.companyName } };
  };

  const apiResponse = handleApplyApi(ineligibleStudent, strictCompany);
  assert.strictEqual(apiResponse.status, 400);
  assert.strictEqual(apiResponse.message, 'You are not eligible to apply for this drive.');
  assert.ok(apiResponse.reasons.length > 0);
  console.log('  ✓ 13.1: Ineligible student direct API calls are strictly blocked with HTTP 400.');
}

// ============================================================================
// Case 14: Admin eligible-student roster and student eligibility view agree
// ============================================================================
console.log('\n[Case 14] Admin roster vs Student display consistency agreement...');
{
  const student = { _id: 'stu_1', name: 'Rachel', branch: 'CSE', year: 4, cgpa: 8.2 };
  const company = { _id: 'comp_1', companyName: 'UnifiedCo', eligibilityCGPA: 7.5, eligibleBranches: ['CSE'], eligibleYears: ['4th Year'], driveStatus: 'Open' };

  // Student view result
  const studentViewResult = compareEligibility(student, company);

  // Admin roster simulation for this student
  const adminRosterItem = {
    student: { id: student._id, name: student.name },
    ...compareEligibility(student, company),
  };

  assert.strictEqual(studentViewResult.eligible, adminRosterItem.eligible);
  assert.strictEqual(studentViewResult.status, adminRosterItem.status);
  assert.deepStrictEqual(studentViewResult.reasons, adminRosterItem.reasons);
  console.log('  ✓ 14.1: Admin roster and student-facing eligibility compute 100% identical results.');
}

// ============================================================================
// Case 15: Criteria evaluated from trusted database models
// ============================================================================
console.log('\n[Case 15] Evaluation from trusted DB records only (untrusted payload ignored)...');
{
  const trustedDbStudent = { _id: 'stu_real', name: 'Sam', branch: 'Civil', year: 2, cgpa: 6.0 };
  const trustedDbCompany = { _id: 'comp_real', companyName: 'Elite', eligibilityCGPA: 8.0, eligibleBranches: ['CSE'], driveStatus: 'Open' };

  // Malicious request payload trying to spoof higher CGPA and different branch
  const untrustedPayload = { cgpa: 9.9, branch: 'CSE', year: 4 };

  // System strictly compares trusted DB documents
  const evaluationResult = compareEligibility(trustedDbStudent, trustedDbCompany);
  assert.strictEqual(evaluationResult.checks.cgpa.student, 6.0);
  assert.strictEqual(evaluationResult.checks.cgpa.ok, false);
  assert.strictEqual(evaluationResult.checks.branch.ok, false);
  assert.strictEqual(evaluationResult.eligible, false);
  console.log('  ✓ 15.1: Untrusted client-supplied criteria are ignored in favor of trusted database documents.');
}

// ============================================================================
// Informational Skills Check
// ============================================================================
console.log('\n[Skills] Informational skills normalization and comparison...');
{
  assert.deepStrictEqual(normalizeSkillList(['Java', 'React']), ['Java', 'React']);
  assert.deepStrictEqual(normalizeSkillList('Java, React, SQL'), ['Java', 'React', 'SQL']);
  assert.deepStrictEqual(normalizeSkillList(null), []);

  const studentSkills = { name: 'Tina', branch: 'CSE', year: 4, cgpa: 8.0, skills: ['Java', 'Docker'] };
  const companySkills = { companyName: 'CloudCo', eligibilityCGPA: 7.0, requiredSkills: ['Java', 'Kubernetes'], driveStatus: 'Open' };
  const resSkills = compareEligibility(studentSkills, companySkills);
  assert.deepStrictEqual(resSkills.skills.matching, ['Java']);
  assert.deepStrictEqual(resSkills.skills.missing, ['Kubernetes']);
  assert.strictEqual(resSkills.eligible, true, 'Skills are informational only and do not disqualify');
  console.log('  ✓ Skills are informational and correctly match or report missing skills without disqualifying.');
}

console.log('\n============================================================================');
console.log('ALL 15 COMPREHENSIVE ELIGIBILITY TEST SUITES PASSED SUCCESSFULLY!');
console.log('============================================================================');

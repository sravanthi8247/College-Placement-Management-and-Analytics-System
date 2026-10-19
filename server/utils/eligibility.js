export function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

const BRANCH_ALIASES = {
  cse: 'cse',
  cs: 'cse',
  'computer science': 'cse',
  'computer science and engineering': 'cse',
  'computer science & engineering': 'cse',
  'computer science engineering': 'cse',
  it: 'it',
  'information technology': 'it',
  ece: 'ece',
  'electronics and communication': 'ece',
  'electronics and communication engineering': 'ece',
  'electronics & communication engineering': 'ece',
  eee: 'eee',
  'electrical and electronics': 'eee',
  'electrical and electronics engineering': 'eee',
  'electrical & electronics engineering': 'eee',
  mechanical: 'mechanical',
  'mechanical engineering': 'mechanical',
  mech: 'mechanical',
  civil: 'civil',
  'civil engineering': 'civil',
  aids: 'aids',
  'ai & ds': 'aids',
  'ai and ds': 'aids',
  'artificial intelligence and data science': 'aids',
  aiml: 'aiml',
  'ai & ml': 'aiml',
  'ai and ml': 'aiml',
  'artificial intelligence and machine learning': 'aiml',
};

export function normalizeBranch(value) {
  const text = normalizeText(value);
  return BRANCH_ALIASES[text] || text;
}

export function normalizeYear(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const text = String(value).trim().toLowerCase();
  const match = text.match(/[1-4]/);
  return match ? match[0] : text;
}

export function normalizeSkillList(skills) {
  if (typeof skills === 'string') {
    return skills
      .split(',')
      .map((skill) => String(skill).trim())
      .filter(Boolean);
  }

  return (Array.isArray(skills) ? skills : [])
    .map((skill) => String(skill).trim())
    .filter(Boolean);
}

export function isDeadlinePassed(deadlineValue) {
  if (!deadlineValue) return false;
  const deadline = new Date(deadlineValue);
  if (Number.isNaN(deadline.getTime())) return false;

  let expiryTime = deadline.getTime();
  // If stored as date-only (midnight 00:00:00.000 UTC), allow until the end of that day
  if (
    deadline.getUTCHours() === 0 &&
    deadline.getUTCMinutes() === 0 &&
    deadline.getUTCSeconds() === 0 &&
    deadline.getUTCMilliseconds() === 0
  ) {
    expiryTime += 24 * 60 * 60 * 1000 - 1;
  }

  return Date.now() > expiryTime;
}

export function compareEligibility(student, company) {
  const reasons = [];
  const matchingSkills = [];
  const missingSkills = [];

  const requiredCgpa = Number(company.eligibilityCGPA ?? 0);
  const studentCgpa = Number(student.cgpa ?? 0);
  const cgpaOk = !Number.isNaN(studentCgpa) && studentCgpa >= requiredCgpa;

  if (!cgpaOk) {
    reasons.push(
      `Minimum CGPA required: ${requiredCgpa}. Student CGPA: ${studentCgpa}.`
    );
  }

  const eligibleBranches = (company.eligibleBranches || [])
    .map(normalizeBranch)
    .filter(Boolean);
  const studentBranch = normalizeBranch(student.branch);
  const branchUnrestricted = eligibleBranches.length === 0;
  const branchOk = branchUnrestricted || eligibleBranches.includes(studentBranch);

  if (!branchOk) {
    reasons.push(
      `Branch (${student.branch || 'not set'}) is not eligible for this drive.`
    );
  }

  const eligibleYears = (company.eligibleYears || [])
    .map((year) => normalizeYear(year))
    .filter(Boolean);
  const studentYear = normalizeYear(student.year);
  const yearUnrestricted = eligibleYears.length === 0;
  const yearOk = yearUnrestricted || eligibleYears.includes(studentYear);

  if (!yearOk) {
    reasons.push(
      `Academic year (${student.year ?? 'not set'}) is not eligible for this drive.`
    );
  }

  const driveStatus = company.driveStatus || 'Open';
  const driveOpen = driveStatus === 'Open';

  if (!driveOpen) {
    reasons.push(`This drive is ${String(driveStatus).toLowerCase()}.`);
  }

  const deadline = company.applicationDeadline
    ? new Date(company.applicationDeadline)
    : null;
  const deadlineValid = deadline && !Number.isNaN(deadline.getTime());
  const deadlinePassed = deadlineValid && isDeadlinePassed(company.applicationDeadline);

  if (deadlinePassed) {
    reasons.push('The application deadline has passed.');
  }

  const studentSkills = normalizeSkillList(student.skills).map(normalizeText);
  const requiredSkills = normalizeSkillList(company.requiredSkills);

  requiredSkills.forEach((skill) => {
    if (studentSkills.includes(normalizeText(skill))) {
      matchingSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  const eligible = reasons.length === 0;

  return {
    eligible,
    status: eligible ? 'Eligible' : 'Not Eligible',
    checks: {
      cgpa: {
        ok: cgpaOk,
        required: requiredCgpa,
        student: studentCgpa,
      },
      branch: {
        ok: branchOk,
        unrestricted: branchUnrestricted,
        required: company.eligibleBranches || [],
        student: student.branch || null,
      },
      year: {
        ok: yearOk,
        unrestricted: yearUnrestricted,
        required: company.eligibleYears || [],
        student: student.year ?? null,
      },
      driveStatus: {
        ok: driveOpen,
        value: driveStatus,
      },
      deadline: {
        ok: !deadlinePassed,
        value: company.applicationDeadline || null,
        passed: deadlinePassed,
      },
    },
    reasons,
    skills: {
      matching: matchingSkills,
      missing: missingSkills,
      note: 'Skills are informational and do not determine eligibility.',
    },
  };
}

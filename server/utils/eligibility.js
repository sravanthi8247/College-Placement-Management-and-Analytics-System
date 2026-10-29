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
  'comp sci': 'cse',
  it: 'it',
  'information technology': 'it',
  'information science': 'it',
  ise: 'it',
  ece: 'ece',
  'electronics and communication': 'ece',
  'electronics and communication engineering': 'ece',
  'electronics & communication engineering': 'ece',
  eee: 'eee',
  'electrical and electronics': 'eee',
  'electrical and electronics engineering': 'eee',
  'electrical & electronics engineering': 'eee',
  'electrical engineering': 'eee',
  electrical: 'eee',
  mechanical: 'mechanical',
  'mechanical engineering': 'mechanical',
  mech: 'mechanical',
  civil: 'civil',
  'civil engineering': 'civil',
  aids: 'aids',
  'ai & ds': 'aids',
  'ai and ds': 'aids',
  'ai/ds': 'aids',
  'artificial intelligence and data science': 'aids',
  aiml: 'aiml',
  'ai & ml': 'aiml',
  'ai and ml': 'aiml',
  'ai/ml': 'aiml',
  'artificial intelligence and machine learning': 'aiml',
};

export function normalizeBranch(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return '';
  }
  const rawText = normalizeText(value);
  // Strip periods for acronyms like "C.S.E." -> "cse", "E.C.E." -> "ece"
  const strippedText = rawText.replace(/\./g, '').trim();

  return BRANCH_ALIASES[rawText] || BRANCH_ALIASES[strippedText] || strippedText;
}

export function normalizeYear(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const text = String(value).trim().toLowerCase();

  // Strict single digit 1 to 4: "1", "2", "3", "4"
  if (/^[1-4]$/.test(text)) {
    return text;
  }

  // Strict ordinal patterns: "1st", "2nd", "3rd", "4th" optionally with "year" / "yr"
  const ordinalMatch = text.match(/^([1-4])(?:st|nd|rd|th)?(?:\s*(?:year|yr))?$/);
  if (ordinalMatch) {
    return ordinalMatch[1];
  }

  // Strict prefix patterns: "year 1", "year 2", "yr 3", "year-4"
  const prefixMatch = text.match(/^(?:year|yr)[-\s]*([1-4])$/);
  if (prefixMatch) {
    return prefixMatch[1];
  }

  // Calendar years (e.g. 2024), numbers outside 1-4, or arbitrary strings do not match
  return null;
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
  // If stored as date-only (midnight 00:00:00.000 UTC), allow until the end of that day (23:59:59.999Z)
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
  // Defensive guard against null/undefined student object
  if (!student || typeof student !== 'object') {
    return {
      eligible: false,
      status: 'Not Eligible',
      checks: {
        cgpa: { ok: false, required: Number(company?.eligibilityCGPA ?? 0), student: null },
        branch: { ok: false, unrestricted: false, required: company?.eligibleBranches || [], student: null },
        year: { ok: false, unrestricted: false, required: company?.eligibleYears || [], student: null },
        driveStatus: { ok: false, value: company?.driveStatus || 'Unknown' },
        deadline: { ok: false, value: company?.applicationDeadline || null, passed: true },
      },
      reasons: ['Student profile is missing or invalid.'],
      skills: { matching: [], missing: [], note: 'Skills are informational and do not determine eligibility.' },
    };
  }

  // Defensive guard against null/undefined company object
  if (!company || typeof company !== 'object') {
    return {
      eligible: false,
      status: 'Not Eligible',
      checks: {
        cgpa: { ok: false, required: 0, student: student.cgpa ?? null },
        branch: { ok: false, unrestricted: false, required: [], student: student.branch ?? null },
        year: { ok: false, unrestricted: false, required: [], student: student.year ?? null },
        driveStatus: { ok: false, value: 'Unknown' },
        deadline: { ok: false, value: null, passed: true },
      },
      reasons: ['Placement drive details are missing or invalid.'],
      skills: { matching: [], missing: [], note: 'Skills are informational and do not determine eligibility.' },
    };
  }

  const reasons = [];
  const matchingSkills = [];
  const missingSkills = [];

  // 1. CGPA Evaluation & Validation
  const requiredCgpa = Number(company.eligibilityCGPA ?? 0);
  const rawStudentCgpa = student.cgpa;
  const isCgpaProvided =
    rawStudentCgpa !== undefined &&
    rawStudentCgpa !== null &&
    String(rawStudentCgpa).trim() !== '' &&
    !Number.isNaN(Number(rawStudentCgpa));

  let studentCgpa = null;
  let cgpaOk = false;

  if (!isCgpaProvided) {
    reasons.push('Student CGPA is missing or invalid.');
  } else {
    studentCgpa = Number(rawStudentCgpa);
    if (studentCgpa < 0 || studentCgpa > 10) {
      reasons.push('Student CGPA is missing or invalid.');
    } else if (studentCgpa < requiredCgpa) {
      reasons.push(
        `Minimum CGPA required: ${requiredCgpa}. Student CGPA: ${studentCgpa}.`
      );
    } else {
      cgpaOk = true;
    }
  }

  // 2. Branch Evaluation & Validation
  const eligibleBranches = (company.eligibleBranches || [])
    .map(normalizeBranch)
    .filter(Boolean);
  const studentBranch = normalizeBranch(student.branch);
  const branchUnrestricted = eligibleBranches.length === 0;

  let branchOk = false;
  if (!studentBranch) {
    reasons.push('Student branch is missing or not set.');
  } else if (branchUnrestricted || eligibleBranches.includes(studentBranch)) {
    branchOk = true;
  } else {
    reasons.push(
      `Branch (${student.branch || 'not set'}) is not eligible for this drive.`
    );
  }

  // 3. Academic Year Evaluation & Validation
  const eligibleYears = (company.eligibleYears || [])
    .map((year) => normalizeYear(year))
    .filter(Boolean);
  const studentYearNormalized = normalizeYear(student.year);
  const yearUnrestricted = eligibleYears.length === 0;

  let yearOk = false;
  if (student.year === undefined || student.year === null || String(student.year).trim() === '') {
    reasons.push('Academic year is missing or not set.');
  } else if (!studentYearNormalized) {
    reasons.push(`Academic year (${student.year}) is invalid for college eligibility.`);
  } else if (yearUnrestricted || eligibleYears.includes(studentYearNormalized)) {
    yearOk = true;
  } else {
    reasons.push(
      `Academic year (${student.year ?? 'not set'}) is not eligible for this drive.`
    );
  }

  // 4. Drive Status Evaluation
  const driveStatus = String(company.driveStatus || 'Open').trim();
  const driveOpen = driveStatus.toLowerCase() === 'open';

  if (!driveOpen) {
    reasons.push(`This drive is ${driveStatus.toLowerCase()}.`);
  }

  // 5. Application Deadline Evaluation
  const deadline = company.applicationDeadline
    ? new Date(company.applicationDeadline)
    : null;
  const deadlineValid = deadline && !Number.isNaN(deadline.getTime());
  const deadlinePassed = deadlineValid && isDeadlinePassed(company.applicationDeadline);

  if (deadlinePassed) {
    reasons.push('The application deadline has passed.');
  }

  // 6. Informational Skills Comparison (Does not disqualify)
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
        passed: Boolean(deadlinePassed),
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

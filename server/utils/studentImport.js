import * as XLSX from 'xlsx';
import Student from '../models/Student.js';
import { normalizeYear, normalizeSkillList } from './eligibility.js';
import { toCsv } from './csv.js';

const HEADER_MAP = {
  name: 'name',
  'student name': 'name',
  'full name': 'name',

  email: 'email',
  'email address': 'email',
  'student email': 'email',

  rollno: 'rollNo',
  'roll no': 'rollNo',
  'roll number': 'rollNo',
  'roll_no': 'rollNo',
  roll: 'rollNo',

  branch: 'branch',
  department: 'branch',
  stream: 'branch',

  year: 'year',
  'academic year': 'year',
  'current year': 'year',

  cgpa: 'cgpa',
  gpa: 'cgpa',

  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  'mobile number': 'phone',
  contact: 'phone',

  skills: 'skills',
  skill: 'skills',
  technologies: 'skills',
  'technical skills': 'skills',

  'placement status': 'placementStatus',
  placementstatus: 'placementStatus',
  status: 'placementStatus',
};

export const TEMPLATE_COLUMNS = [
  { key: 'name', label: 'Student Name' },
  { key: 'email', label: 'Email' },
  { key: 'rollNo', label: 'Roll Number' },
  { key: 'branch', label: 'Branch' },
  { key: 'year', label: 'Year' },
  { key: 'cgpa', label: 'CGPA' },
  { key: 'phone', label: 'Phone' },
  { key: 'skills', label: 'Skills' },
  { key: 'placementStatus', label: 'Placement Status' },
];

export const TEMPLATE_SAMPLE_ROWS = [
  {
    name: 'Sravanthi Sharma',
    email: 'sravanthi.sharma@college.edu',
    rollNo: '2023CSE001',
    branch: 'CSE',
    year: 4,
    cgpa: 8.75,
    phone: '9876543210',
    skills: 'Java, React, SQL',
    placementStatus: 'Not Placed',
  },
  {
    name: 'Rahul Verma',
    email: 'rahul.verma@college.edu',
    rollNo: '2023IT002',
    branch: 'IT',
    year: 3,
    cgpa: 7.8,
    phone: '9876543211',
    skills: 'Python, Django, AWS',
    placementStatus: 'Not Placed',
  },
  {
    name: 'Ananya Patel',
    email: 'ananya.patel@college.edu',
    rollNo: '2023ECE003',
    branch: 'ECE',
    year: 4,
    cgpa: 9.1,
    phone: '9876543212',
    skills: 'Embedded C, IoT, Python',
    placementStatus: 'Not Placed',
  },
];

export function generateTemplate(format = 'csv') {
  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(
      TEMPLATE_SAMPLE_ROWS.map((row) => ({
        'Student Name': row.name,
        Email: row.email,
        'Roll Number': row.rollNo,
        Branch: row.branch,
        Year: row.year,
        CGPA: row.cgpa,
        Phone: row.phone,
        Skills: row.skills,
        'Placement Status': row.placementStatus,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  return toCsv(
    TEMPLATE_COLUMNS,
    TEMPLATE_SAMPLE_ROWS.map((row) => ({
      ...row,
      skills: row.skills,
    }))
  );
}

export function parseSpreadsheetBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Spreadsheet does not contain any sheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('No data rows found in the uploaded file.');
  }

  return rawRows.map((rawRow, index) => {
    const normalized = {};
    for (const [key, value] of Object.entries(rawRow)) {
      const cleanKey = String(key).trim().toLowerCase();
      const standardKey = HEADER_MAP[cleanKey];
      if (standardKey) {
        normalized[standardKey] = typeof value === 'string' ? value.trim() : value;
      }
    }
    return {
      rowNumber: index + 2, // 1-indexed header + data rows
      ...normalized,
    };
  });
}

export function validateParsedRow(row) {
  const errors = [];

  // Name
  const name = String(row.name ?? '').trim();
  if (!name) {
    errors.push('Name is required.');
  } else if (name.length < 2) {
    errors.push('Name must be at least 2 characters.');
  }

  // Email
  const email = String(row.email ?? '').trim().toLowerCase();
  if (!email) {
    errors.push('Email is required.');
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('Please provide a valid email format.');
  }

  // Roll Number
  const rollNo = String(row.rollNo ?? '').trim();
  if (!rollNo) {
    errors.push('Roll number is required.');
  }

  // Branch
  const branch = String(row.branch ?? '').trim();
  if (!branch) {
    errors.push('Branch is required.');
  }

  // Year
  const yearText = String(row.year ?? '').trim();
  const yearNorm = normalizeYear(yearText);
  const yearNum = yearNorm ? Number(yearNorm) : null;
  if (!yearText) {
    errors.push('Year is required.');
  } else if (!yearNum || Number.isNaN(yearNum) || yearNum < 1 || yearNum > 4) {
    errors.push('Year must be between 1 and 4.');
  }

  // CGPA
  const cgpaRaw = row.cgpa !== undefined && row.cgpa !== null ? String(row.cgpa).trim() : '';
  const cgpa = Number(cgpaRaw);
  if (cgpaRaw === '') {
    errors.push('CGPA is required.');
  } else if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
    errors.push('CGPA must be a number between 0 and 10.');
  }

  // Phone
  const phone = String(row.phone ?? '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone) {
    errors.push('Phone is required.');
  } else if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.push('Phone number must contain between 10 and 15 digits.');
  }

  // Placement Status
  const placementStatusRaw = String(row.placementStatus ?? '').trim();
  const placementStatus =
    placementStatusRaw.toLowerCase() === 'placed' ? 'Placed' : 'Not Placed';

  // Skills
  const skills = normalizeSkillList(row.skills);

  return {
    valid: errors.length === 0,
    errors,
    data: {
      rowNumber: row.rowNumber,
      name,
      email,
      rollNo,
      branch,
      year: yearNum || 1,
      cgpa: Number.isNaN(cgpa) ? 0 : Number(cgpa.toFixed(2)),
      phone,
      skills,
      placementStatus,
    },
  };
}

export async function processAndValidateRows(rows) {
  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];

  const seenEmails = new Map();
  const seenRollNos = new Map();

  // Step 1: Check schema constraints & in-file duplicates
  for (const rawRow of rows) {
    const { valid, errors, data } = validateParsedRow(rawRow);

    if (!valid) {
      invalidRows.push({
        rowNumber: rawRow.rowNumber,
        name: data.name || '—',
        email: data.email || '—',
        rollNo: data.rollNo || '—',
        issues: errors,
      });
      continue;
    }

    // Check duplicate email in this file
    if (seenEmails.has(data.email)) {
      duplicateRows.push({
        rowNumber: data.rowNumber,
        name: data.name,
        email: data.email,
        rollNo: data.rollNo,
        issues: [`Duplicate email in file (first seen at row ${seenEmails.get(data.email)}).`],
      });
      continue;
    }

    // Check duplicate roll number in this file
    if (seenRollNos.has(data.rollNo)) {
      duplicateRows.push({
        rowNumber: data.rowNumber,
        name: data.name,
        email: data.email,
        rollNo: data.rollNo,
        issues: [`Duplicate roll number in file (first seen at row ${seenRollNos.get(data.rollNo)}).`],
      });
      continue;
    }

    seenEmails.set(data.email, data.rowNumber);
    seenRollNos.set(data.rollNo, data.rowNumber);
    validRows.push(data);
  }

  // Step 2: Check database duplicates in a single query
  if (validRows.length > 0) {
    const emailsToCheck = validRows.map((r) => r.email);
    const rollNosToCheck = validRows.map((r) => r.rollNo);

    const existingRecords = await Student.find({
      $or: [{ email: { $in: emailsToCheck } }, { rollNo: { $in: rollNosToCheck } }],
    }).select('email rollNo');

    const existingEmails = new Set(existingRecords.map((r) => r.email.toLowerCase()));
    const existingRollNos = new Set(existingRecords.map((r) => r.rollNo));

    const finalValid = [];
    for (const record of validRows) {
      const dbErrors = [];
      if (existingEmails.has(record.email)) {
        dbErrors.push('Student with this email already exists in the database.');
      }
      if (existingRollNos.has(record.rollNo)) {
        dbErrors.push('Student with this roll number already exists in the database.');
      }

      if (dbErrors.length > 0) {
        duplicateRows.push({
          rowNumber: record.rowNumber,
          name: record.name,
          email: record.email,
          rollNo: record.rollNo,
          issues: dbErrors,
        });
      } else {
        finalValid.push(record);
      }
    }

    return {
      totalRows: rows.length,
      validRecords: finalValid,
      invalidRecords: invalidRows,
      duplicateRecords: duplicateRows,
    };
  }

  return {
    totalRows: rows.length,
    validRecords: [],
    invalidRecords: invalidRows,
    duplicateRecords: duplicateRows,
  };
}

export async function bulkInsertStudents(validRecords, batchSize = 500) {
  if (!validRecords || validRecords.length === 0) {
    return {
      totalAttempted: 0,
      insertedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  let insertedCount = 0;
  const errors = [];

  for (let i = 0; i < validRecords.length; i += batchSize) {
    const chunk = validRecords.slice(i, i + batchSize);
    const operations = chunk.map((record) => ({
      insertOne: {
        document: {
          user: null, // Unlinked initially; activated when student registers with this email
          name: record.name,
          email: record.email,
          rollNo: record.rollNo,
          branch: record.branch,
          year: record.year,
          cgpa: record.cgpa,
          skills: record.skills,
          phone: record.phone,
          placementStatus: record.placementStatus || 'Not Placed',
        },
      },
    }));

    try {
      const result = await Student.bulkWrite(operations, { ordered: false });
      insertedCount += result.insertedCount || result.nInserted || chunk.length;
    } catch (bulkError) {
      // Handle partial failures within the batch
      if (bulkError.result) {
        insertedCount += bulkError.result.insertedCount || bulkError.result.nInserted || 0;
      }
      if (bulkError.writeErrors) {
        bulkError.writeErrors.forEach((err) => {
          errors.push({
            index: i + err.index,
            message: err.errmsg || 'Failed to insert row.',
          });
        });
      } else {
        errors.push({
          batchIndex: i,
          message: bulkError.message || 'Bulk write batch failure.',
        });
      }
    }
  }

  return {
    totalAttempted: validRecords.length,
    insertedCount,
    failedCount: validRecords.length - insertedCount,
    errors,
  };
}

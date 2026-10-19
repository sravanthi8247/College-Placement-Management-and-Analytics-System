import assert from 'node:assert';
import * as XLSX from 'xlsx';
import {
  generateTemplate,
  parseSpreadsheetBuffer,
  validateParsedRow,
  processAndValidateRows,
  bulkInsertStudents,
} from './utils/studentImport.js';
import { authorize } from './middleware/authMiddleware.js';

console.log('--- STARTING BULK STUDENT IMPORT TEST SUITE ---');

// -------------------------------------------------------------
// Test 1: Template Generation (CSV and Excel)
// -------------------------------------------------------------
console.log('\n[1/6] Testing template generation...');
const csvTemplate = generateTemplate('csv');
assert.ok(typeof csvTemplate === 'string', 'CSV template should be a string');
assert.ok(csvTemplate.includes('Student Name,Email,Roll Number,Branch,Year,CGPA,Phone,Skills,Placement Status'));
assert.ok(csvTemplate.includes('Sravanthi Sharma'));

const xlsxTemplate = generateTemplate('xlsx');
assert.ok(Buffer.isBuffer(xlsxTemplate), 'XLSX template should be a Buffer');
const parsedWorkbook = XLSX.read(xlsxTemplate, { type: 'buffer' });
assert.ok(parsedWorkbook.SheetNames.includes('Students_Template'));
console.log('✓ Test 1: CSV and Excel templates generated successfully.');

// -------------------------------------------------------------
// Test 2: Parsing CSV and Excel Buffers
// -------------------------------------------------------------
console.log('\n[2/6] Testing spreadsheet parsing with CSV and XLSX...');
const sampleRows = [
  {
    'Student Name': 'Alice Smith',
    'Email Address': 'alice@college.edu',
    'Roll Number': '2023CSE101',
    Branch: 'CSE',
    Year: '4th Year',
    CGPA: '8.45',
    'Phone Number': '9876543210',
    Skills: 'Java, Spring, MySQL',
  },
  {
    'Student Name': 'Bob Jones',
    'Email Address': 'bob@college.edu',
    'Roll Number': '2023IT102',
    Branch: 'IT',
    Year: 3,
    CGPA: 7.9,
    'Phone Number': '+91 9876543211',
    Skills: 'Python, Flask',
  },
];

const ws = XLSX.utils.json_to_sheet(sampleRows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

const parsed = parseSpreadsheetBuffer(xlsxBuffer);
assert.strictEqual(parsed.length, 2);
assert.strictEqual(parsed[0].name, 'Alice Smith');
assert.strictEqual(parsed[0].email, 'alice@college.edu');
assert.strictEqual(parsed[0].rollNo, '2023CSE101');
assert.strictEqual(parsed[0].branch, 'CSE');
assert.strictEqual(parsed[1].name, 'Bob Jones');
assert.strictEqual(parsed[1].rollNo, '2023IT102');
console.log('✓ Test 2: Spreadsheet parsing with header variation mapping passed.');

// -------------------------------------------------------------
// Test 3: Row Schema Validation
// -------------------------------------------------------------
console.log('\n[3/6] Testing row schema validation and constraints...');
// Valid row
const vGood = validateParsedRow({
  rowNumber: 2,
  name: 'Charlie Brown',
  email: 'charlie@college.edu',
  rollNo: '2023ECE103',
  branch: 'ECE',
  year: '4',
  cgpa: '9.2',
  phone: '9876543212',
  skills: 'C++, Verilog',
});
assert.strictEqual(vGood.valid, true);
assert.strictEqual(vGood.errors.length, 0);
assert.strictEqual(vGood.data.cgpa, 9.2);
assert.strictEqual(vGood.data.year, 4);
assert.deepStrictEqual(vGood.data.skills, ['C++', 'Verilog']);

// Invalid rows
const vBadEmail = validateParsedRow({
  rowNumber: 3,
  name: 'David',
  email: 'not-an-email',
  rollNo: '2023ME104',
  branch: 'Mechanical',
  year: 2,
  cgpa: 7.5,
  phone: '9876543213',
});
assert.strictEqual(vBadEmail.valid, false);
assert.ok(vBadEmail.errors.some((e) => e.includes('valid email format')));

const vBadCgpa = validateParsedRow({
  rowNumber: 4,
  name: 'Emma',
  email: 'emma@college.edu',
  rollNo: '2023CIVIL105',
  branch: 'Civil',
  year: 3,
  cgpa: '11.5', // Out of bounds
  phone: '9876543214',
});
assert.strictEqual(vBadCgpa.valid, false);
assert.ok(vBadCgpa.errors.some((e) => e.includes('CGPA must be a number between 0 and 10')));

const vBadPhone = validateParsedRow({
  rowNumber: 5,
  name: 'Frank',
  email: 'frank@college.edu',
  rollNo: '2023CSE106',
  branch: 'CSE',
  year: 4,
  cgpa: 8.0,
  phone: '123', // Too short
});
assert.strictEqual(vBadPhone.valid, false);
assert.ok(vBadPhone.errors.some((e) => e.includes('Phone number must contain between 10 and 15 digits')));

const vMissingName = validateParsedRow({
  rowNumber: 6,
  name: '',
  email: 'noname@college.edu',
  rollNo: '2023CSE107',
  branch: 'CSE',
  year: 1,
  cgpa: 6.5,
  phone: '9876543215',
});
assert.strictEqual(vMissingName.valid, false);
assert.ok(vMissingName.errors.some((e) => e.includes('Name is required')));
console.log('✓ Test 3: Schema validation accurately caught all constraint violations.');

// -------------------------------------------------------------
// Test 4: Duplicate Detection (within file and database)
// -------------------------------------------------------------
console.log('\n[4/6] Testing duplicate detection...');
const testRowsWithDuplicates = [
  {
    rowNumber: 2,
    name: 'George First',
    email: 'george@college.edu',
    rollNo: '2023CSE108',
    branch: 'CSE',
    year: 4,
    cgpa: 8.0,
    phone: '9876543216',
  },
  {
    rowNumber: 3,
    name: 'George Duplicate Email',
    email: 'george@college.edu', // Duplicate email
    rollNo: '2023CSE109',
    branch: 'CSE',
    year: 4,
    cgpa: 8.2,
    phone: '9876543217',
  },
  {
    rowNumber: 4,
    name: 'Harry Duplicate Roll',
    email: 'harry@college.edu',
    rollNo: '2023CSE108', // Duplicate rollNo
    branch: 'CSE',
    year: 4,
    cgpa: 7.9,
    phone: '9876543218',
  },
  {
    rowNumber: 5,
    name: 'Ian Valid',
    email: 'ian@college.edu',
    rollNo: '2023CSE110',
    branch: 'CSE',
    year: 4,
    cgpa: 8.5,
    phone: '9876543219',
  },
];

// Mock Student.find for database duplicate check
const originalFind = (await import('./models/Student.js')).default.find;
try {
  (await import('./models/Student.js')).default.find = () => ({
    select: async () => [
      // Simulate that 'ian@college.edu' already exists in MongoDB
      { email: 'ian@college.edu', rollNo: 'DIFFERENT_ROLL' },
    ],
  });

  const processed = await processAndValidateRows(testRowsWithDuplicates);
  assert.strictEqual(processed.totalRows, 4);

  // Row 2 is valid and not in DB
  assert.strictEqual(processed.validRecords.length, 1);
  assert.strictEqual(processed.validRecords[0].name, 'George First');

  // Rows 3, 4, 5 are duplicates (2 in-file, 1 in DB)
  assert.strictEqual(processed.duplicateRecords.length, 3);
  assert.ok(processed.duplicateRecords[0].issues[0].includes('Duplicate email in file'));
  assert.ok(processed.duplicateRecords[1].issues[0].includes('Duplicate roll number in file'));
  assert.ok(processed.duplicateRecords[2].issues[0].includes('already exists in the database'));
  console.log('✓ Test 4: Both in-file and database duplicates accurately detected and isolated.');
} finally {
  (await import('./models/Student.js')).default.find = originalFind;
}

// -------------------------------------------------------------
// Test 5: Role-based Authorization Enforcement
// -------------------------------------------------------------
console.log('\n[5/6] Testing admin authorization for bulk import routes...');
const adminGuard = authorize('admin');

// Admin token
let adminAllowed = false;
adminGuard({ user: { role: 'admin' } }, {}, () => {
  adminAllowed = true;
});
assert.strictEqual(adminAllowed, true, 'Admin must be granted access');

// Student token
let studentAllowed = false;
const resStudent = {
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
adminGuard({ user: { role: 'student' } }, resStudent, () => {
  studentAllowed = true;
});
assert.strictEqual(studentAllowed, false, 'Student must be denied access');
assert.strictEqual(resStudent.statusCode, 403);
assert.strictEqual(resStudent.body.success, false);
console.log('✓ Test 5: Admin route protection verified; unauthorized access prevented.');

// -------------------------------------------------------------
// Test 6: Bulk Inserter with Batching and Error Isolation
// -------------------------------------------------------------
console.log('\n[6/6] Testing bulk insert batching and partial failure isolation...');
const StudentModel = (await import('./models/Student.js')).default;
const originalBulkWrite = StudentModel.bulkWrite;

try {
  let callCount = 0;
  const batchRecords = Array.from({ length: 25 }, (_, i) => ({
    name: `Student ${i}`,
    email: `student${i}@college.edu`,
    rollNo: `2023BATCH${i}`,
    branch: 'CSE',
    year: 4,
    cgpa: 8.0,
    phone: '9876543210',
    skills: ['Java'],
    placementStatus: 'Not Placed',
  }));

  // Mock bulkWrite with batchSize = 10 (should execute 3 batches for 25 records: 10 + 10 + 5)
  StudentModel.bulkWrite = async (operations) => {
    callCount += 1;
    // Simulate batch 2 having 1 write error
    if (callCount === 2) {
      const err = new Error('E11000 duplicate key');
      err.result = { insertedCount: 9 };
      err.writeErrors = [{ index: 4, errmsg: 'Duplicate key in MongoDB' }];
      throw err;
    }
    return { insertedCount: operations.length };
  };

  const importResult = await bulkInsertStudents(batchRecords, 10);
  assert.strictEqual(callCount, 3, '25 records with batchSize 10 should produce 3 batches');
  assert.strictEqual(importResult.totalAttempted, 25);
  assert.strictEqual(importResult.insertedCount, 24); // 10 + 9 + 5 = 24
  assert.strictEqual(importResult.failedCount, 1);
  assert.strictEqual(importResult.errors.length, 1);
  console.log('✓ Test 6: Configurable batch execution and partial failure handling verified.');
} finally {
  StudentModel.bulkWrite = originalBulkWrite;
}

console.log('\n=============================================================');
console.log('ALL 6 BULK IMPORT TEST SUITES PASSED SUCCESSFULLY!');
console.log('=============================================================');

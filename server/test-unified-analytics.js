import assert from 'node:assert';
import dns from 'node:dns';
import { Writable } from 'node:stream';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dns.setServers(['1.1.1.1', '8.8.8.8']);
dotenv.config();

import { calculatePlacementAnalytics } from './controllers/analyticsController.js';
import { generatePlacementPdf } from './utils/pdfReport.js';
import Student from './models/Student.js';
import Company from './models/Company.js';
import Application from './models/Application.js';
import Placement from './models/Placement.js';
import { syncStudentPlacementStatus } from './utils/studentProfile.js';

class MemoryWritable extends Writable {
  constructor() {
    super();
    this.chunks = [];
  }
  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    callback();
  }
  toBuffer() {
    return Buffer.concat(this.chunks);
  }
}

async function runUnifiedAnalyticsTests() {
  console.log('=== RUNNING UNIFIED PLACEMENT ANALYTICS TESTS ===\n');

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing from environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas.\n');

  // -------------------------------------------------------------
  // TEST SUITE 1: Live Analytics on Existing Test Database
  // -------------------------------------------------------------
  console.log('[Suite 1] Verifying Current Test Database State...');
  const analytics = await calculatePlacementAnalytics();

  console.log('  Totals:', analytics.totals);
  console.log('  Company Placements:', analytics.companyPlacements);
  console.log('  Application Status:', analytics.applicationStatus);
  console.log('  Package Stats:', analytics.packageStats);

  // 1.1 Unique placed students
  assert.strictEqual(
    analytics.totals.placedStudents,
    9,
    `Expected exactly 9 unique placed students, got ${analytics.totals.placedStudents}`
  );
  assert.strictEqual(
    analytics.totals.totalStudents,
    307,
    `Expected 307 total students, got ${analytics.totals.totalStudents}`
  );
  assert.strictEqual(
    analytics.totals.placementPercentage,
    2.9,
    `Expected 2.9% placement rate, got ${analytics.totals.placementPercentage}`
  );
  console.log('  ✓ 1.1: Unique placed students (9/307 = 2.9%) confirmed.');

  // 1.2 Company-wise counts
  const virtusa = analytics.companyPlacements.find((c) => c.companyName === 'Virtusa');
  assert.ok(virtusa, 'Virtusa must be in company placements');
  assert.strictEqual(
    virtusa.count,
    2,
    `Virtusa must have 2 selections (Sania from Placement + Sai from Application), got ${virtusa.count}`
  );

  const infosys = analytics.companyPlacements.find((c) => c.companyName === 'Infosys');
  assert.ok(infosys, 'Infosys must be in company placements');
  assert.strictEqual(
    infosys.count,
    3,
    `Infosys must have 3 selections (Kalpana, Mitrabindu, Deepika), got ${infosys.count}`
  );

  const tcs = analytics.companyPlacements.find((c) => c.companyName === 'TCS');
  assert.ok(tcs, 'TCS must be in company placements');
  assert.strictEqual(
    tcs.count,
    3,
    `TCS must have 3 selections (Sravanthi, Yasaswitha, Kalpana), got ${tcs.count}`
  );
  console.log('  ✓ 1.2: Company selections reflect unified selections without dropping application drives.');

  // 1.3 Application Pipeline
  const appSelected = analytics.applicationStatus.find((s) => s.status === 'Selected');
  const appShortlisted = analytics.applicationStatus.find((s) => s.status === 'Shortlisted');
  assert.strictEqual(appSelected?.count, 1, 'Application pipeline must have 1 Selected');
  assert.strictEqual(appShortlisted?.count, 1, 'Application pipeline must have 1 Shortlisted');
  console.log('  ✓ 1.3: Application pipeline statuses preserved accurately (1 Selected, 1 Shortlisted).');

  // 1.4 Package Statistics
  assert.ok(analytics.packageStats, 'Package stats must be defined');
  assert.strictEqual(analytics.packageStats.highest, 27, 'Highest package must be 27 LPA');
  assert.strictEqual(analytics.packageStats.lowest, 5.6, 'Lowest package must be 5.6 LPA');
  assert.strictEqual(analytics.packageStats.averagePerOffer, 8.84, 'Average per offer must be 8.84 LPA');
  assert.strictEqual(analytics.packageStats.averagePerStudent, 9.3, 'Average per student must be 9.3 LPA');
  assert.strictEqual(analytics.packageStats.validOfferCount, 11, 'Must have 11 valid confirmed offers');
  assert.strictEqual(analytics.packageStats.placedStudentCount, 9, 'Must have 9 unique placed students with package');
  console.log('  ✓ 1.4: Dual package metrics verified (8.84 LPA per offer, 9.30 LPA per student).');

  // -------------------------------------------------------------
  // TEST SUITE 2: Edge-case Scenarios using Temporary Isolated Documents
  // -------------------------------------------------------------
  console.log('\n[Suite 2] Testing Business Rule Edge Cases with Isolated Test Records...');

  const timestamp = Date.now();
  const testStudentA = await Student.create({
    name: `Test MultiOffer Student ${timestamp}`,
    email: `multioffer_${timestamp}@college.edu`,
    rollNo: `MULTI-${timestamp}`,
    branch: 'CSE',
    year: 4,
    cgpa: 9.0,
    phone: '9000000001',
    placementStatus: 'Not Placed',
  });

  const testCompany1 = await Company.create({
    companyName: `Test Alpha Corp ${timestamp}`,
    packageOffered: 12,
    location: 'Hyderabad',
    jobRole: 'Software Engineer',
    eligibilityCGPA: 7.0,
    driveDate: new Date(),
    driveStatus: 'Open',
  });

  const testCompany2 = await Company.create({
    companyName: `Test Beta Tech ${timestamp}`,
    packageOffered: 18,
    location: 'Bangalore',
    jobRole: 'Full Stack Engineer',
    eligibilityCGPA: 7.5,
    driveDate: new Date(),
    driveStatus: 'Open',
  });

  try {
    // 2.1 Multi-company offers: Student placed in Company 1 and Company 2
    const p1 = await Placement.create({
      student: testStudentA._id,
      company: testCompany1._id,
      status: 'Selected',
      packageOffered: 12,
      placementDate: new Date(),
    });
    const p2 = await Placement.create({
      student: testStudentA._id,
      company: testCompany2._id,
      status: 'Selected',
      packageOffered: 18,
      placementDate: new Date(),
    });
    await syncStudentPlacementStatus(testStudentA._id);

    const afterMulti = await calculatePlacementAnalytics();
    // Placed count should increase by exactly 1 (not 2)
    assert.strictEqual(
      afterMulti.totals.placedStudents,
      10,
      `Student with offers from 2 companies must increment placedStudents by 1, got ${afterMulti.totals.placedStudents}`
    );

    const comp1Count = afterMulti.companyPlacements.find((c) => c.companyName === testCompany1.companyName)?.count;
    const comp2Count = afterMulti.companyPlacements.find((c) => c.companyName === testCompany2.companyName)?.count;
    assert.strictEqual(comp1Count, 1, 'Company 1 must have 1 selection');
    assert.strictEqual(comp2Count, 1, 'Company 2 must have 1 selection');
    console.log('  ✓ 2.1: Multi-company offers: student counted once overall, separately per company.');

    // 2.2 Student in BOTH Placement and Application for the same company (Deduplication)
    const appDuplicate = await Application.create({
      student: testStudentA._id,
      company: testCompany1._id,
      status: 'Selected',
      remarks: 'Application selected',
    });

    const afterDup = await calculatePlacementAnalytics();
    const comp1DupCount = afterDup.companyPlacements.find((c) => c.companyName === testCompany1.companyName)?.count;
    assert.strictEqual(
      comp1DupCount,
      1,
      `Student represented in both Placement and Application for same company must be counted ONCE, got ${comp1DupCount}`
    );
    assert.strictEqual(
      afterDup.totals.placedStudents,
      10,
      'Placed students must remain 10 after duplicate student+company entry'
    );
    console.log('  ✓ 2.2: Student in both Placement & Application for same company is deduplicated cleanly.');

    // 2.3 Shortlisted Application must NOT be counted as a confirmed selection or placement
    const testStudentB = await Student.create({
      name: `Test Shortlisted Student ${timestamp}`,
      email: `shortlist_${timestamp}@college.edu`,
      rollNo: `SHORT-${timestamp}`,
      branch: 'ECE',
      year: 4,
      cgpa: 8.0,
      phone: '9000000002',
      placementStatus: 'Not Placed',
    });

    const appShort = await Application.create({
      student: testStudentB._id,
      company: testCompany1._id,
      status: 'Shortlisted',
      remarks: 'Candidate shortlisted for interview round 2',
    });
    await syncStudentPlacementStatus(testStudentB._id);

    const studentBReloaded = await Student.findById(testStudentB._id);
    assert.strictEqual(studentBReloaded.placementStatus, 'Not Placed', 'Shortlisted application must leave student Not Placed');

    const afterShort = await calculatePlacementAnalytics();
    const comp1AfterShort = afterShort.companyPlacements.find((c) => c.companyName === testCompany1.companyName)?.count;
    assert.strictEqual(comp1AfterShort, 1, 'Shortlisted application must NOT increment company selection count');
    assert.strictEqual(afterShort.totals.placedStudents, 10, 'Placed students must remain 10');
    console.log('  ✓ 2.3: Shortlisted application is excluded from company selections and placed student counts.');

    // 2.4 Missing, zero, and negative package exclusion test
    const testCompanyZero = await Company.create({
      companyName: `Test Zero Package Company ${timestamp}`,
      packageOffered: 0,
      location: 'Online',
      jobRole: 'Intern',
      eligibilityCGPA: 6.0,
      driveDate: new Date(),
      driveStatus: 'Open',
    });

    const pZero = await Placement.create({
      student: testStudentB._id,
      company: testCompanyZero._id,
      status: 'Selected',
      packageOffered: 0,
      placementDate: new Date(),
    });
    await syncStudentPlacementStatus(testStudentB._id);

    const afterZero = await calculatePlacementAnalytics();
    // Zero package must NOT pull down lowest package to 0
    assert.ok(afterZero.packageStats.lowest > 0, `Lowest package must be > 0, got ${afterZero.packageStats.lowest}`);
    console.log(`  ✓ 2.4: Zero/invalid package values are excluded from package metrics (lowest remained ${afterZero.packageStats.lowest} LPA).`);

    // Cleanup all test documents
    await Placement.findByIdAndDelete(p1._id);
    await Placement.findByIdAndDelete(p2._id);
    await Placement.findByIdAndDelete(pZero._id);
    await Application.findByIdAndDelete(appDuplicate._id);
    await Application.findByIdAndDelete(appShort._id);
    await Company.findByIdAndDelete(testCompany1._id);
    await Company.findByIdAndDelete(testCompany2._id);
    await Company.findByIdAndDelete(testCompanyZero._id);
    await Student.findByIdAndDelete(testStudentA._id);
    await Student.findByIdAndDelete(testStudentB._id);
    console.log('  ✓ 2.5: Test edge-case documents successfully cleaned up.');
  } catch (err) {
    // Attempt cleanup on failure
    await Student.deleteMany({ email: new RegExp(String(timestamp)) });
    await Company.deleteMany({ companyName: new RegExp(String(timestamp)) });
    throw err;
  }

  // -------------------------------------------------------------
  // TEST SUITE 3: PDF Report Output Verification
  // -------------------------------------------------------------
  console.log('\n[Suite 3] Verifying PDF Generation with Live Unified Analytics...');
  const finalAnalytics = await calculatePlacementAnalytics();
  const pdfStream = new MemoryWritable();
  await generatePlacementPdf(finalAnalytics, pdfStream);
  const pdfBuf = pdfStream.toBuffer();

  assert.ok(pdfBuf.length > 2000, 'PDF buffer must be > 2000 bytes');
  assert.strictEqual(pdfBuf.subarray(0, 4).toString('utf-8'), '%PDF', 'Buffer must have %PDF header');

  const pdfStr = pdfBuf.toString('latin1');
  const pageMatches = pdfStr.match(/\/Type\s*\/Page\b/g) || [];
  assert.strictEqual(
    pageMatches.length,
    1,
    `Live dataset PDF report must be exactly 1 physical page without blank pages, found ${pageMatches.length}`
  );

  // Decode compressed PDF text stream to verify rendered text content
  const zlib = (await import('node:zlib')).default;
  const streamMarker = Buffer.from('stream\n');
  const endStreamMarker = Buffer.from('endstream');
  let pos = 0;
  let decodedPdfText = '';
  while ((pos = pdfBuf.indexOf(streamMarker, pos)) !== -1) {
    const start = pos + streamMarker.length;
    const end = pdfBuf.indexOf(endStreamMarker, start);
    if (end !== -1) {
      let streamData = pdfBuf.subarray(start, end);
      if (streamData[streamData.length - 1] === 0x0a) streamData = streamData.subarray(0, -1);
      if (streamData[streamData.length - 1] === 0x0d) streamData = streamData.subarray(0, -1);
      try {
        const decomp = zlib.inflateSync(streamData).toString('latin1');
        const tjMatches = decomp.match(/\[(.*?)\]\s*TJ/g) || [];
        for (const m of tjMatches) {
          const hexParts = m.match(/<([0-9a-fA-F]+)>/g) || [];
          for (const h of hexParts) {
            decodedPdfText += Buffer.from(h.slice(1, -1), 'hex').toString('utf-8');
          }
          decodedPdfText += ' ';
        }
      } catch (e) {
        // non-compressed or different filter
      }
      pos = end + endStreamMarker.length;
    } else {
      break;
    }
  }

  assert.ok(
    decodedPdfText.includes('AVG / PLACED CANDIDATE'),
    'PDF must include AVG / PLACED CANDIDATE label'
  );
  assert.ok(
    decodedPdfText.includes('AVG / CONFIRMED OFFER'),
    'PDF must include AVG / CONFIRMED OFFER label'
  );
  assert.ok(
    decodedPdfText.includes('Virtusa'),
    'PDF must list Virtusa in company selections'
  );
  assert.ok(
    decodedPdfText.includes('Page 1 of 1'),
    'PDF must show Page 1 of 1 in running footer'
  );
  console.log(`  ✓ 3.1: Live PDF generated cleanly (${pdfBuf.length} bytes, exactly ${pageMatches.length} physical page, 0 blank pages, all text verified).`);

  console.log('\n=============================================================');
  console.log('ALL UNIFIED PLACEMENT ANALYTICS TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================================');

  await mongoose.disconnect();
}

runUnifiedAnalyticsTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

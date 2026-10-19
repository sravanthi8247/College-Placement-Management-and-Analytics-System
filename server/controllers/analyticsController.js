import Student from '../models/Student.js';
import Company from '../models/Company.js';
import Placement from '../models/Placement.js';
import Application from '../models/Application.js';
import { toCsv } from '../utils/csv.js';
import { generatePlacementPdf } from '../utils/pdfReport.js';

const sendCsv = (res, filename, csv) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
};

export const calculatePlacementAnalytics = async () => {
  const [
    totalStudents,
    placedStudents,
    notPlacedStudents,
    totalCompanies,
    totalDrivesOpen,
    totalApplications,
    branchStats,
    applicationStatus,
    unifiedSelections,
    recentDrives,
  ] = await Promise.all([
    Student.countDocuments(),
    Student.countDocuments({ placementStatus: 'Placed' }),
    Student.countDocuments({ placementStatus: { $ne: 'Placed' } }),
    Company.countDocuments(),
    Company.countDocuments({ driveStatus: 'Open' }),
    Application.countDocuments(),
    Student.aggregate([
      {
        $project: {
          trimmedBranch: { $trim: { input: '$branch' } },
          placementStatus: 1,
        },
      },
      {
        $group: {
          _id: '$trimmedBranch',
          total: { $sum: 1 },
          placed: {
            $sum: {
              $cond: [{ $eq: ['$placementStatus', 'Placed'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Placement.aggregate([
      { $match: { status: 'Selected' } },
      {
        $project: {
          student: 1,
          company: 1,
          packageOffered: 1,
          priority: { $literal: 1 },
        },
      },
      {
        $unionWith: {
          coll: 'applications',
          pipeline: [
            { $match: { status: 'Selected' } },
            {
              $lookup: {
                from: 'companies',
                localField: 'company',
                foreignField: '_id',
                as: 'companyDoc',
              },
            },
            { $unwind: { path: '$companyDoc', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                student: 1,
                company: 1,
                packageOffered: '$companyDoc.packageOffered',
                priority: { $literal: 2 },
              },
            },
          ],
        },
      },
      // Sort priority ascending so Placement (priority 1) takes precedence over Application (priority 2)
      { $sort: { priority: 1 } },
      // Deduplicate confirmed selections by student ID + company ID
      {
        $group: {
          _id: { student: '$student', company: '$company' },
          packageOffered: { $first: '$packageOffered' },
          priority: { $first: '$priority' },
        },
      },
      {
        $lookup: {
          from: 'companies',
          localField: '_id.company',
          foreignField: '_id',
          as: 'company',
        },
      },
      { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'students',
          localField: '_id.student',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentId: '$_id.student',
          studentName: '$student.name',
          companyId: '$_id.company',
          companyName: '$company.companyName',
          packageOffered: 1,
          priority: 1,
        },
      },
    ]),
    Company.find().sort({ driveDate: 1 }).limit(6).select(
      'companyName jobRole driveDate driveStatus packageOffered'
    ),
  ]);

  const placementPercentage =
    totalStudents === 0
      ? 0
      : Number(((placedStudents / totalStudents) * 100).toFixed(1));

  // Company-wise selection counts with deduplicated student selections
  const companyCountsMap = new Map();
  for (const item of unifiedSelections) {
    const name = item.companyName || 'Unknown company';
    companyCountsMap.set(name, (companyCountsMap.get(name) || 0) + 1);
  }

  const companyPlacements = Array.from(companyCountsMap.entries())
    .map(([companyName, count]) => ({ companyName, count }))
    .sort((a, b) => b.count - a.count || a.companyName.localeCompare(b.companyName))
    .slice(0, 8);

  // Package statistics: strictly exclude invalid, zero, or negative package numbers
  const validOffers = unifiedSelections.filter(
    (s) =>
      typeof s.packageOffered === 'number' &&
      !Number.isNaN(s.packageOffered) &&
      s.packageOffered > 0
  );

  let packageStats = null;
  if (validOffers.length > 0) {
    const offerPackages = validOffers.map((s) => s.packageOffered);
    const sumOfferPackages = offerPackages.reduce((acc, val) => acc + val, 0);
    const avgOffer = sumOfferPackages / offerPackages.length;
    const highest = Math.max(...offerPackages);
    const lowest = Math.min(...offerPackages);

    // Calculate highest valid offer per unique placed student
    const studentHighestMap = new Map();
    for (const s of validOffers) {
      const studentKey = String(s.studentId);
      const currentHigh = studentHighestMap.get(studentKey);
      if (currentHigh === undefined || s.packageOffered > currentHigh) {
        studentHighestMap.set(studentKey, s.packageOffered);
      }
    }

    const studentPackages = Array.from(studentHighestMap.values());
    const sumStudentPackages = studentPackages.reduce((acc, val) => acc + val, 0);
    const avgStudent = sumStudentPackages / studentPackages.length;

    const ambiguousCount = unifiedSelections.length - validOffers.length;

    packageStats = {
      average: Number(avgOffer.toFixed(2)),
      averagePerOffer: Number(avgOffer.toFixed(2)),
      averagePerStudent: Number(avgStudent.toFixed(2)),
      highest: Number(highest.toFixed(2)),
      lowest: Number(lowest.toFixed(2)),
      validOfferCount: validOffers.length,
      placedStudentCount: studentPackages.length,
      ambiguousPackageCount: ambiguousCount,
    };
  }

  return {
    totals: {
      totalStudents,
      placedStudents,
      notPlacedStudents,
      placementPercentage,
      totalCompanies,
      totalDrivesOpen,
      totalApplications,
    },
    branchStats: branchStats.map((item) => ({
      branch: item._id || 'Unspecified',
      total: item.total,
      placed: item.placed,
      percentage:
        item.total === 0
          ? 0
          : Number(((item.placed / item.total) * 100).toFixed(1)),
    })),
    applicationStatus: applicationStatus.map((item) => ({
      status: item._id || 'Unknown',
      count: item.count,
    })),
    companyPlacements,
    packageStats,
    upcomingDrives: recentDrives,
    notes: {
      placementPercentage:
        'Placement percentage = unique placed students / total registered students.',
      packageStatistics:
        'Average per offer represents all valid confirmed offers (> 0 LPA). Average per student uses each unique placed student\'s highest confirmed offer.',
    },
  };
};

export const getAnalytics = async (_req, res) => {
  try {
    const data = await calculatePlacementAnalytics();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load analytics.' });
  }
};

export const exportStudentsCsv = async (_req, res) => {
  try {
    const students = await Student.find().sort({ branch: 1, name: 1 });

    if (!students.length) {
      return res.status(200).json({ message: 'No student data available to export.' });
    }

    const csv = toCsv(
      [
        { key: 'name', label: 'Student Name' },
        { key: 'email', label: 'Email' },
        { key: 'rollNo', label: 'Roll Number' },
        { key: 'branch', label: 'Branch' },
        { key: 'year', label: 'Year' },
        { key: 'cgpa', label: 'CGPA' },
        { key: 'phone', label: 'Phone' },
        { key: 'skills', label: 'Skills' },
        { key: 'placementStatus', label: 'Placement Status' },
      ],
      students.map((student) => ({
        name: student.name,
        email: student.email,
        rollNo: student.rollNo,
        branch: student.branch,
        year: student.year,
        cgpa: student.cgpa,
        phone: student.phone,
        skills: (student.skills || []).join('; '),
        placementStatus: student.placementStatus,
      }))
    );

    return sendCsv(res, 'students-report.csv', csv);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to export students.' });
  }
};

export const exportApplicationsCsv = async (_req, res) => {
  try {
    const applications = await Application.find()
      .populate('student', 'name rollNo branch email')
      .populate('company', 'companyName jobRole')
      .sort({ createdAt: -1 });

    if (!applications.length) {
      return res.status(200).json({ message: 'No application data available to export.' });
    }

    const csv = toCsv(
      [
        { key: 'studentName', label: 'Student Name' },
        { key: 'rollNo', label: 'Roll Number' },
        { key: 'branch', label: 'Branch' },
        { key: 'email', label: 'Email' },
        { key: 'companyName', label: 'Company' },
        { key: 'jobRole', label: 'Job Role' },
        { key: 'status', label: 'Application Status' },
        { key: 'appliedAt', label: 'Applied On' },
        { key: 'remarks', label: 'Admin Remarks' },
      ],
      applications.map((application) => ({
        studentName: application.student?.name,
        rollNo: application.student?.rollNo,
        branch: application.student?.branch,
        email: application.student?.email,
        companyName: application.company?.companyName,
        jobRole: application.company?.jobRole,
        status: application.status,
        appliedAt: application.appliedAt
          ? new Date(application.appliedAt).toISOString().slice(0, 10)
          : '',
        remarks: application.remarks || '',
      }))
    );

    return sendCsv(res, 'applications-report.csv', csv);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to export applications.' });
  }
};

export const exportPlacementsCsv = async (_req, res) => {
  try {
    const placements = await Placement.find()
      .populate('student', 'name rollNo branch')
      .populate('company', 'companyName')
      .sort({ placementDate: -1 });

    if (!placements.length) {
      return res.status(200).json({ message: 'No placement data available to export.' });
    }

    const csv = toCsv(
      [
        { key: 'studentName', label: 'Student Name' },
        { key: 'rollNo', label: 'Roll Number' },
        { key: 'branch', label: 'Branch' },
        { key: 'companyName', label: 'Company' },
        { key: 'packageOffered', label: 'Package (LPA)' },
        { key: 'placementDate', label: 'Placement Date' },
        { key: 'status', label: 'Status' },
      ],
      placements.map((placement) => ({
        studentName: placement.student?.name,
        rollNo: placement.student?.rollNo,
        branch: placement.student?.branch,
        companyName: placement.company?.companyName,
        packageOffered: placement.packageOffered,
        placementDate: placement.placementDate
          ? new Date(placement.placementDate).toISOString().slice(0, 10)
          : '',
        status: placement.status,
      }))
    );

    return sendCsv(res, 'placements-report.csv', csv);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to export placements.' });
  }
};

export const exportPlacementReportPdf = async (_req, res) => {
  try {
    const data = await calculatePlacementAnalytics();

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Placement_Report_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await generatePlacementPdf(data, res);
  } catch (error) {
    console.error('Error generating PDF report:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Failed to generate PDF report.' });
    }
  }
};


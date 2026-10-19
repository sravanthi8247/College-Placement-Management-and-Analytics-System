import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import Student from '../models/Student.js';
import Company from '../models/Company.js';
import Placement from '../models/Placement.js';
import Application from '../models/Application.js';
import { findStudentForUser, ensureStudentProfile } from '../utils/studentProfile.js';
import {
  generateTemplate,
  parseSpreadsheetBuffer,
  processAndValidateRows,
  bulkInsertStudents,
} from '../utils/studentImport.js';
import { toCsv } from '../utils/csv.js';
import { RESUME_UPLOAD_DIR } from '../middleware/uploadMiddleware.js';

const duplicateMessage = (error) => {
  const field = Object.keys(error.keyPattern || {})[0];
  if (field === 'rollNo') return 'Roll number already exists.';
  if (field === 'email') return 'Email already registered.';
  if (field === 'user') return 'This account is already linked to a student profile.';
  return 'A record with these details already exists.';
};

const parseSkills = (skills) => {
  if (Array.isArray(skills)) {
    return skills.map((skill) => String(skill).trim()).filter(Boolean);
  }

  if (typeof skills === 'string') {
    return skills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);
  }

  return [];
};

const validateStudentInput = (body, { partial = false } = {}) => {
  const errors = [];
  const {
    name,
    email,
    rollNo,
    branch,
    year,
    cgpa,
    phone,
    placementStatus,
  } = body;

  const requireField = (value, label) => {
    if (!partial && (value === undefined || value === null || String(value).trim() === '')) {
      errors.push(`${label} is required.`);
    }
  };

  requireField(name, 'Name');
  requireField(email, 'Email');
  requireField(rollNo, 'Roll number');
  requireField(branch, 'Branch');
  requireField(year, 'Year');
  requireField(cgpa, 'CGPA');
  requireField(phone, 'Phone');

  if (email !== undefined && email !== '' && !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    errors.push('Please provide a valid email.');
  }

  if (year !== undefined && year !== '') {
    const yearNum = Number(year);
    if (Number.isNaN(yearNum) || yearNum < 1 || yearNum > 4) {
      errors.push('Year must be a number between 1 and 4.');
    }
  }

  if (cgpa !== undefined && cgpa !== '') {
    const cgpaNum = Number(cgpa);
    if (Number.isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
      errors.push('CGPA must be between 0 and 10.');
    }
  }

  if (phone !== undefined && phone !== '' && !/^[0-9+\-\s]{10,15}$/.test(String(phone).trim())) {
    errors.push('Please provide a valid phone number.');
  }

  if (
    placementStatus !== undefined &&
    placementStatus !== '' &&
    !['Placed', 'Not Placed'].includes(placementStatus)
  ) {
    errors.push('Placement status must be Placed or Not Placed.');
  }

  return errors;
};

const studentPayload = (body, { includeStatus = true } = {}) => {
  const payload = {};

  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.email !== undefined) payload.email = String(body.email).toLowerCase().trim();
  if (body.rollNo !== undefined) payload.rollNo = String(body.rollNo).trim();
  if (body.branch !== undefined) payload.branch = String(body.branch).trim();
  if (body.year !== undefined && body.year !== '') payload.year = Number(body.year);
  if (body.cgpa !== undefined && body.cgpa !== '') payload.cgpa = Number(body.cgpa);
  if (body.phone !== undefined) payload.phone = String(body.phone).trim();
  if (body.skills !== undefined) payload.skills = parseSkills(body.skills);
  if (includeStatus && body.placementStatus !== undefined) {
    payload.placementStatus = body.placementStatus;
  }

  return payload;
};

export const addStudent = async (req, res) => {
  try {
    const errors = validateStudentInput(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const student = await Student.create(studentPayload(req.body));
    return res.status(201).json(student);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: duplicateMessage(error) });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to add student.' });
  }
};

export const getStudents = async (req, res) => {
  try {
    const { search, branch, year, status, minCgpa, maxCgpa, limit, page } = req.query;
    const filter = {};

    if (search) {
      const query = String(search).trim();
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { rollNo: { $regex: escaped, $options: 'i' } },
        { branch: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (branch && branch !== 'All') {
      const escaped = String(branch).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.branch = new RegExp(`^${escaped}\\s*$`, 'i');
    }
    if (year && year !== 'All') filter.year = Number(year);
    if (status && status !== 'All') filter.placementStatus = status;
    if (minCgpa || maxCgpa) {
      filter.cgpa = {};
      if (minCgpa) filter.cgpa.$gte = Number(minCgpa);
      if (maxCgpa) filter.cgpa.$lte = Number(maxCgpa);
    }

    if (page !== undefined && page !== null && page !== '') {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 25);
      const skip = (pageNum - 1) * limitNum;

      const [students, total, totalAllStudents, totalPlaced, distinctBranches] = await Promise.all([
        Student.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limitNum),
        Student.countDocuments(filter),
        Student.countDocuments({}),
        Student.countDocuments({ placementStatus: 'Placed' }),
        Student.distinct('branch'),
      ]);

      return res.status(200).json({
        students,
        total,
        page: pageNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        limit: limitNum,
        stats: {
          totalStudents: totalAllStudents,
          placedCount: totalPlaced,
          notPlacedCount: Math.max(0, totalAllStudents - totalPlaced),
        },
        branches: distinctBranches.filter(Boolean).sort(),
      });
    }

    let queryExec = Student.find(filter).sort({ createdAt: -1, _id: -1 });
    if (limit && Number(limit) > 0) {
      queryExec = queryExec.limit(Number(limit));
    }

    const students = await queryExec;
    return res.status(200).json(students);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch students.' });
  }
};

export const getMyStudentProfile = async (req, res) => {
  try {
    let student = await findStudentForUser(req.user);

    if (!student && req.user?.role === 'student') {
      student = await ensureStudentProfile(req.user);
    }

    if (!student) {
      return res.status(404).json({
        message: 'No student profile is linked to this account yet.',
      });
    }

    return res.status(200).json(student);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load student profile.' });
  }
};

export const updateMyStudentProfile = async (req, res) => {
  try {
    let student = await findStudentForUser(req.user);

    if (!student && req.user?.role === 'student') {
      student = await ensureStudentProfile(req.user);
    }

    if (!student) {
      return res.status(404).json({
        message: 'No student profile is linked to this account yet.',
      });
    }

    const errors = validateStudentInput(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const updates = studentPayload(req.body, { includeStatus: false });
    const updated = await Student.findByIdAndUpdate(student._id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: duplicateMessage(error) });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
};

export const updateStudent = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid student ID.' });
    }

    const errors = validateStudentInput(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      studentPayload(req.body),
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    return res.status(200).json(student);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: duplicateMessage(error) });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to update student.' });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid student ID.' });
    }

    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    await Promise.all([
      Placement.deleteMany({ student: student._id }),
      Application.deleteMany({ student: student._id }),
    ]);

    return res.status(200).json({ message: 'Student deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete student.' });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalStudents,
      placedStudents,
      notPlacedStudents,
      totalCompanies,
      totalPlacements,
      totalApplications,
      upcomingDrives,
      recentCompanies,
      branchGroups,
      applicationStatusGroups,
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ placementStatus: 'Placed' }),
      Student.countDocuments({ placementStatus: { $ne: 'Placed' } }),
      Company.countDocuments(),
      Placement.countDocuments(),
      Application.countDocuments(),
      Company.countDocuments({
        driveDate: { $gte: new Date() },
        driveStatus: { $ne: 'Completed' },
      }),
      Company.find().sort({ createdAt: -1 }).limit(5).select(
        'companyName jobRole driveDate driveStatus packageOffered'
      ),
      Student.aggregate([
        {
          $project: {
            trimmedBranch: { $trim: { input: '$branch' } },
          },
        },
        { $group: { _id: '$trimmedBranch', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Application.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const placementRate =
      totalStudents === 0
        ? 0
        : Number(((placedStudents / totalStudents) * 100).toFixed(1));

    return res.status(200).json({
      totalStudents,
      placedStudents,
      notPlacedStudents,
      totalCompanies,
      totalPlacements,
      totalApplications,
      upcomingDrives,
      placementRate,
      recentCompanies,
      branchDistribution: branchGroups.map((item) => ({
        branch: item._id || 'Unspecified',
        count: item.count,
      })),
      applicationStatus: applicationStatusGroups.map((item) => ({
        status: item._id || 'Unknown',
        count: item.count,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load dashboard statistics.' });
  }
};

export const getImportTemplate = (req, res) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();

    if (format === 'xlsx') {
      const buffer = generateTemplate('xlsx');
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="student_import_template.xlsx"'
      );
      return res.status(200).send(buffer);
    }

    const csv = generateTemplate('csv');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="student_import_template.csv"'
    );
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate template.' });
  }
};

export const previewStudentImport = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please upload a CSV or Excel file.' });
    }

    const rows = parseSpreadsheetBuffer(req.file.buffer);

    if (rows.length > 5000) {
      return res.status(400).json({
        message: `File contains ${rows.length} rows. Maximum allowed per import is 5,000 rows.`,
      });
    }

    const validationResult = await processAndValidateRows(rows);

    return res.status(200).json({
      success: true,
      summary: {
        totalRows: validationResult.totalRows,
        validCount: validationResult.validRecords.length,
        invalidCount: validationResult.invalidRecords.length,
        duplicateCount: validationResult.duplicateRecords.length,
      },
      preview: validationResult.validRecords.slice(0, 20),
      errors: [
        ...validationResult.invalidRecords,
        ...validationResult.duplicateRecords,
      ],
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to process file.' });
  }
};

export const importStudents = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please upload a CSV or Excel file.' });
    }

    const rows = parseSpreadsheetBuffer(req.file.buffer);

    if (rows.length > 5000) {
      return res.status(400).json({
        message: `File contains ${rows.length} rows. Maximum allowed per import is 5,000 rows.`,
      });
    }

    const validationResult = await processAndValidateRows(rows);

    const result = await bulkInsertStudents(validationResult.validRecords);

    return res.status(200).json({
      success: true,
      summary: {
        totalRows: validationResult.totalRows,
        importedCount: result.insertedCount,
        skippedDuplicates: validationResult.duplicateRecords.length,
        failedCount: validationResult.invalidRecords.length + result.failedCount,
        errors: [
          ...validationResult.invalidRecords,
          ...validationResult.duplicateRecords,
          ...result.errors.map((e) => ({
            rowNumber: 'DB',
            name: '—',
            email: '—',
            rollNo: '—',
            issues: [e.message],
          })),
        ],
      },
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Import failed.' });
  }
};

export const downloadErrorReport = (req, res) => {
  try {
    const { errors = [] } = req.body;

    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ message: 'No error records to export.' });
    }

    const csv = toCsv(
      [
        { key: 'rowNumber', label: 'Row Number' },
        { key: 'name', label: 'Student Name' },
        { key: 'rollNo', label: 'Roll Number' },
        { key: 'email', label: 'Email' },
        { key: 'issues', label: 'Validation Errors' },
      ],
      errors.map((err) => ({
        rowNumber: err.rowNumber || '',
        name: err.name || '',
        rollNo: err.rollNo || '',
        email: err.email || '',
        issues: Array.isArray(err.issues) ? err.issues.join('; ') : String(err.issues || ''),
      }))
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="import_errors.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate error report.' });
  }
};

/**
 * Upload or replace resume for the logged-in student.
 */
export const uploadMyResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please select a PDF resume file to upload.' });
    }

    // Validate PDF magic bytes (%PDF)
    try {
      const buffer = Buffer.alloc(4);
      const fd = fs.openSync(req.file.path, 'r');
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);

      if (buffer.toString('utf-8') !== '%PDF') {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          message: 'Invalid file format. The uploaded file is not a valid PDF document.',
        });
      }
    } catch (checkErr) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: 'Could not verify PDF file format.' });
    }

    const student = await findStudentForUser(req.user);
    if (!student) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: 'No student profile is linked to this account.' });
    }

    // If an existing resume file is on disk, delete it to prevent orphaned files
    if (student.resume?.storedFilename) {
      const oldPath = path.join(RESUME_UPLOAD_DIR, student.resume.storedFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (unlinkErr) {
          console.error('Failed to remove old resume file:', unlinkErr);
        }
      }
    }

    student.resume = {
      filename: req.file.originalname,
      storedFilename: req.file.filename,
      uploadedAt: new Date(),
      size: req.file.size,
      contentType: 'application/pdf',
    };

    await student.save();

    return res.status(200).json({
      message: 'Resume uploaded successfully.',
      resume: student.resume,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // ignore
      }
    }
    return res.status(500).json({ message: 'Failed to upload resume. Please try again.' });
  }
};

/**
 * Remove resume for the logged-in student.
 */
export const deleteMyResume = async (req, res) => {
  try {
    const student = await findStudentForUser(req.user);
    if (!student) {
      return res.status(404).json({ message: 'No student profile is linked to this account.' });
    }

    if (student.resume?.storedFilename) {
      const filePath = path.join(RESUME_UPLOAD_DIR, student.resume.storedFilename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Failed to delete resume file from disk:', err);
        }
      }
    }

    student.resume = {
      filename: null,
      storedFilename: null,
      uploadedAt: null,
      size: 0,
      contentType: 'application/pdf',
    };

    await student.save();

    return res.status(200).json({ message: 'Resume removed successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete resume.' });
  }
};

/**
 * Access-controlled streaming endpoint to view/download a student's resume.
 * Accessible by admins for any student, or by students only for their own resume.
 */
export const getStudentResume = async (req, res) => {
  try {
    const targetId = req.params.id;
    let student = null;

    if (!targetId || targetId === 'me') {
      student = await findStudentForUser(req.user);
    } else {
      if (!mongoose.isValidObjectId(targetId)) {
        return res.status(400).json({ message: 'Invalid student ID.' });
      }

      if (req.user.role === 'admin') {
        student = await Student.findById(targetId);
      } else {
        // If a student is requesting, enforce that it must be their own ID
        const ownStudent = await findStudentForUser(req.user);
        if (!ownStudent || String(ownStudent._id) !== String(targetId)) {
          return res.status(403).json({
            message: 'You are not authorized to access another candidate\'s resume.',
          });
        }
        student = ownStudent;
      }
    }

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    if (!student.resume?.storedFilename) {
      return res.status(404).json({ message: 'No resume is uploaded for this student.' });
    }

    const filePath = path.join(RESUME_UPLOAD_DIR, student.resume.storedFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Resume document not found on server.' });
    }

    const downloadName = student.resume.filename || `${student.name.replace(/\s+/g, '_')}_Resume.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(downloadName)}"`
    );
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error fetching student resume:', error);
    return res.status(500).json({ message: 'Failed to retrieve resume.' });
  }
};
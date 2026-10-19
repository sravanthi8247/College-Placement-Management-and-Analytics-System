import mongoose from 'mongoose';
import Company from '../models/Company.js';
import Student from '../models/Student.js';
import Application from '../models/Application.js';
import Placement from '../models/Placement.js';
import { compareEligibility } from '../utils/eligibility.js';
import { findStudentForUser, syncStudentPlacementStatus } from '../utils/studentProfile.js';

const parseList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const validateCompanyInput = (body, { partial = false } = {}) => {
  const errors = [];
  const required = [
    'companyName',
    'packageOffered',
    'location',
    'jobRole',
    'eligibilityCGPA',
    'driveDate',
  ];

  if (!partial) {
    required.forEach((field) => {
      if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
        errors.push(`${field} is required.`);
      }
    });
  }

  if (body.packageOffered !== undefined && body.packageOffered !== '') {
    const packageValue = Number(body.packageOffered);
    if (Number.isNaN(packageValue) || packageValue < 0) {
      errors.push('Package cannot be negative.');
    }
  }

  if (body.eligibilityCGPA !== undefined && body.eligibilityCGPA !== '') {
    const cgpa = Number(body.eligibilityCGPA);
    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      errors.push('Eligibility CGPA must be between 0 and 10.');
    }
  }

  if (body.driveStatus && !['Open', 'Closed', 'Completed'].includes(body.driveStatus)) {
    errors.push('Drive status must be Open, Closed, or Completed.');
  }

  if (body.driveDate && Number.isNaN(new Date(body.driveDate).getTime())) {
    errors.push('Drive date is invalid.');
  }

  if (
    body.applicationDeadline &&
    Number.isNaN(new Date(body.applicationDeadline).getTime())
  ) {
    errors.push('Application deadline is invalid.');
  }

  if (
    body.applicationDeadline &&
    body.driveDate &&
    new Date(body.applicationDeadline) > new Date(body.driveDate)
  ) {
    errors.push('Application deadline must not be after the drive date.');
  }

  return errors;
};

const companyPayload = (body) => {
  const payload = {};

  if (body.companyName !== undefined) payload.companyName = String(body.companyName).trim();
  if (body.location !== undefined) payload.location = String(body.location).trim();
  if (body.jobRole !== undefined) payload.jobRole = String(body.jobRole).trim();
  if (body.packageOffered !== undefined) payload.packageOffered = Number(body.packageOffered);
  if (body.eligibilityCGPA !== undefined) payload.eligibilityCGPA = Number(body.eligibilityCGPA);
  if (body.driveDate !== undefined) payload.driveDate = body.driveDate;
  if (body.applicationDeadline !== undefined) {
    payload.applicationDeadline = body.applicationDeadline || null;
  }
  if (body.description !== undefined) payload.description = String(body.description).trim();
  if (body.driveStatus !== undefined) payload.driveStatus = body.driveStatus;
  if (body.eligibleBranches !== undefined) payload.eligibleBranches = parseList(body.eligibleBranches);
  if (body.eligibleYears !== undefined) payload.eligibleYears = parseList(body.eligibleYears);
  if (body.requiredSkills !== undefined) payload.requiredSkills = parseList(body.requiredSkills);

  return payload;
};

const eligibilityResponse = (student, company) => {
  const result = compareEligibility(student, company);

  return {
    student: {
      id: student._id,
      name: student.name,
      rollNo: student.rollNo,
      cgpa: student.cgpa,
      branch: student.branch,
      year: student.year,
      skills: student.skills || [],
    },
    company: {
      id: company._id,
      companyName: company.companyName,
      jobRole: company.jobRole,
      eligibilityCGPA: company.eligibilityCGPA,
      eligibleBranches: company.eligibleBranches || [],
      eligibleYears: company.eligibleYears || [],
      requiredSkills: company.requiredSkills || [],
      driveStatus: company.driveStatus || 'Open',
      applicationDeadline: company.applicationDeadline || null,
      driveDate: company.driveDate || null,
    },
    ...result,
  };
};

export const addCompany = async (req, res) => {
  try {
    const errors = validateCompanyInput(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const company = await Company.create(companyPayload(req.body));
    return res.status(201).json(company);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to add company.' });
  }
};

export const getCompanies = async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = {};

    if (status) filter.driveStatus = status;
    if (search) {
      const query = String(search).trim();
      filter.$or = [
        { companyName: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } },
        { jobRole: { $regex: query, $options: 'i' } },
      ];
    }

    const companies = await Company.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(companies);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch companies.' });
  }
};

export const getCompanyById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid company ID.' });
    }

    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company or placement drive not found.' });
    }

    return res.status(200).json(company);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch company.' });
  }
};

export const updateCompany = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid company ID.' });
    }

    const errors = validateCompanyInput(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      companyPayload(req.body),
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ message: 'Company not found.' });
    }

    return res.status(200).json(company);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to update company.' });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid company ID.' });
    }

    const company = await Company.findByIdAndDelete(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found.' });
    }

    const affectedPlacements = await Placement.find({ company: company._id });

    await Promise.all([
      Application.deleteMany({ company: company._id }),
      Placement.deleteMany({ company: company._id }),
    ]);

    await Promise.all(
      affectedPlacements.map((p) => syncStudentPlacementStatus(p.student))
    );

    return res.status(200).json({ message: 'Company deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete company.' });
  }
};

export const checkCompanyEligibility = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { id: companyId } = req.params;

    if (!mongoose.isValidObjectId(studentId) || !mongoose.isValidObjectId(companyId)) {
      return res.status(400).json({ message: 'Invalid student or company ID.' });
    }

    if (req.user.role !== 'admin') {
      const ownStudent = await findStudentForUser(req.user);
      if (!ownStudent || String(ownStudent._id) !== String(studentId)) {
        return res.status(403).json({
          message: 'You can only check eligibility for your own profile.',
        });
      }
    }

    const [student, company] = await Promise.all([
      Student.findById(studentId),
      Company.findById(companyId),
    ]);

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    if (!company) {
      return res.status(404).json({ message: 'Company or placement drive not found.' });
    }

    return res.status(200).json(eligibilityResponse(student, company));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check student eligibility.' });
  }
};

export const checkMyEligibility = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid company ID.' });
    }

    const [student, company] = await Promise.all([
      findStudentForUser(req.user),
      Company.findById(req.params.id),
    ]);

    if (!student) {
      return res.status(404).json({
        message: 'No student profile is linked to this account yet.',
      });
    }

    if (!company) {
      return res.status(404).json({ message: 'Company or placement drive not found.' });
    }

    return res.status(200).json(eligibilityResponse(student, company));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check eligibility.' });
  }
};

export const getEligibleStudents = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid company ID.' });
    }

    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company or placement drive not found.' });
    }

    const students = await Student.find();
    const results = students.map((student) => {
      const result = compareEligibility(student, company);
      return {
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          rollNo: student.rollNo,
          branch: student.branch,
          year: student.year,
          cgpa: student.cgpa,
        },
        eligible: result.eligible,
        reasons: result.reasons,
      };
    });

    return res.status(200).json({
      company: {
        id: company._id,
        companyName: company.companyName,
        jobRole: company.jobRole,
      },
      eligibleCount: results.filter((item) => item.eligible).length,
      students: results,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load eligible students.' });
  }
};

import mongoose from 'mongoose';
import Application from '../models/Application.js';
import Company from '../models/Company.js';
import { compareEligibility } from '../utils/eligibility.js';
import { findStudentForUser, syncStudentPlacementStatus } from '../utils/studentProfile.js';

const populateQuery = (query) =>
  query
    .populate('student', 'name email rollNo branch year cgpa placementStatus resume')
    .populate('company', 'companyName jobRole location packageOffered driveDate driveStatus');

export const applyToDrive = async (req, res) => {
  try {
    const companyId = req.body.companyId || req.body.company;

    if (!mongoose.isValidObjectId(companyId)) {
      return res.status(400).json({ message: 'A valid company ID is required.' });
    }

    const student = await findStudentForUser(req.user);

    if (!student) {
      return res.status(404).json({
        message: 'No student profile is linked to this account yet.',
      });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: 'Placement drive not found.' });
    }

    const eligibility = compareEligibility(student, company);

    if (!eligibility.eligible) {
      return res.status(400).json({
        message: 'You are not eligible to apply for this drive.',
        reasons: eligibility.reasons,
      });
    }

    const existing = await Application.findOne({
      student: student._id,
      company: company._id,
    });

    if (existing) {
      return res.status(400).json({
        message: 'You have already applied to this drive.',
        application: existing,
      });
    }

    const application = await Application.create({
      student: student._id,
      company: company._id,
      status: 'Applied',
    });

    const populated = await populateQuery(Application.findById(application._id));
    return res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already applied to this drive.' });
    }
    return res.status(500).json({ message: 'Failed to submit application.' });
  }
};

export const getApplications = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role !== 'admin') {
      const student = await findStudentForUser(req.user);
      if (!student) {
        return res.status(200).json([]);
      }
      filter.student = student._id;
    } else if (req.query.studentId && mongoose.isValidObjectId(req.query.studentId)) {
      filter.student = req.query.studentId;
    }

    if (req.query.companyId && mongoose.isValidObjectId(req.query.companyId)) {
      filter.company = req.query.companyId;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const applications = await populateQuery(
      Application.find(filter).sort({ createdAt: -1 })
    );

    return res.status(200).json(applications);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch applications.' });
  }
};

export const getApplicationStats = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.companyId)) {
      return res.status(400).json({ message: 'Invalid company ID.' });
    }

    const stats = await Application.aggregate([
      { $match: { company: new mongoose.Types.ObjectId(req.params.companyId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const total = stats.reduce((sum, item) => sum + item.count, 0);

    return res.status(200).json({
      total,
      byStatus: stats.map((item) => ({ status: item._id, count: item.count })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load application statistics.' });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid application ID.' });
    }

    const { status, remarks } = req.body;
    const allowed = ['Applied', 'Shortlisted', 'Selected', 'Rejected'];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: 'Status must be Applied, Shortlisted, Selected, or Rejected.',
      });
    }

    const updates = { status };
    if (remarks !== undefined) {
      updates.remarks = String(remarks).trim();
    }

    const application = await Application.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    await syncStudentPlacementStatus(application.student);

    const populated = await populateQuery(Application.findById(application._id));
    return res.status(200).json(populated);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update application.' });
  }
};

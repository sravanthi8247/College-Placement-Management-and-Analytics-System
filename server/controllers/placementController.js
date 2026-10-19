import mongoose from 'mongoose';
import Placement from '../models/Placement.js';
import Student from '../models/Student.js';
import Company from '../models/Company.js';
import { syncStudentPlacementStatus } from '../utils/studentProfile.js';

const validatePlacementInput = (body, { partial = false } = {}) => {
  const errors = [];

  if (!partial) {
    if (!body.student) errors.push('Student is required.');
    if (!body.company) errors.push('Company is required.');
    if (!body.placementDate) errors.push('Placement date is required.');
    if (body.packageOffered === undefined || body.packageOffered === '') {
      errors.push('Package is required.');
    }
  }

  if (body.student && !mongoose.isValidObjectId(body.student)) {
    errors.push('Invalid student ID.');
  }

  if (body.company && !mongoose.isValidObjectId(body.company)) {
    errors.push('Invalid company ID.');
  }

  if (body.packageOffered !== undefined && body.packageOffered !== '') {
    const packageValue = Number(body.packageOffered);
    if (Number.isNaN(packageValue) || packageValue < 0) {
      errors.push('Package cannot be negative.');
    }
  }

  if (body.status && !['Selected', 'Rejected', 'Pending'].includes(body.status)) {
    errors.push('Status must be Selected, Rejected, or Pending.');
  }

  if (body.placementDate && Number.isNaN(new Date(body.placementDate).getTime())) {
    errors.push('Placement date is invalid.');
  }

  return errors;
};

export const addPlacement = async (req, res) => {
  try {
    const errors = validatePlacementInput(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const [student, company] = await Promise.all([
      Student.findById(req.body.student),
      Company.findById(req.body.company),
    ]);

    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (!company) return res.status(404).json({ message: 'Company not found.' });

    // Explicit pre-check to prevent duplicate placement for the same student and company
    const existingPlacement = await Placement.findOne({
      student: req.body.student,
      company: req.body.company,
    });

    if (existingPlacement) {
      return res.status(400).json({
        message:
          'A placement record already exists for this student and company. Please edit the existing record instead.',
      });
    }

    const placement = await Placement.create({
      student: req.body.student,
      company: req.body.company,
      placementDate: req.body.placementDate,
      packageOffered: Number(req.body.packageOffered),
      status: req.body.status || 'Pending',
    });

    await syncStudentPlacementStatus(req.body.student);

    const populated = await Placement.findById(placement._id)
      .populate('student', 'name rollNo')
      .populate('company', 'companyName');

    return res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          'A placement record already exists for this student and company. Please edit the existing record instead.',
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to add placement.' });
  }
};

export const getPlacements = async (req, res) => {
  try {
    const placements = await Placement.find()
      .populate('student', 'name rollNo branch')
      .populate('company', 'companyName')
      .sort({ createdAt: -1 });

    return res.status(200).json(placements);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch placements.' });
  }
};

export const updatePlacement = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid placement ID.' });
    }

    const errors = validatePlacementInput(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const existingPlacement = await Placement.findById(req.params.id);
    if (!existingPlacement) {
      return res.status(404).json({ message: 'Placement not found.' });
    }

    const targetStudent = req.body.student || existingPlacement.student;
    const targetCompany = req.body.company || existingPlacement.company;

    // Check if updating to a student+company pair that already exists in another record
    if (
      String(targetStudent) !== String(existingPlacement.student) ||
      String(targetCompany) !== String(existingPlacement.company)
    ) {
      const duplicate = await Placement.findOne({
        _id: { $ne: req.params.id },
        student: targetStudent,
        company: targetCompany,
      });

      if (duplicate) {
        return res.status(400).json({
          message:
            'Another placement record already exists for this student and company. Please edit that record instead.',
        });
      }
    }

    const placement = await Placement.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await syncStudentPlacementStatus(placement.student);
    if (String(existingPlacement.student) !== String(placement.student)) {
      await syncStudentPlacementStatus(existingPlacement.student);
    }

    const populated = await Placement.findById(placement._id)
      .populate('student', 'name rollNo')
      .populate('company', 'companyName');

    return res.status(200).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          'A placement record already exists for this student and company. Please edit the existing record instead.',
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to update placement.' });
  }
};

export const deletePlacement = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid placement ID.' });
    }

    const placement = await Placement.findById(req.params.id);

    if (!placement) {
      return res.status(404).json({ message: 'Placement not found.' });
    }

    await Placement.findByIdAndDelete(req.params.id);
    await syncStudentPlacementStatus(placement.student);

    return res.status(200).json({ message: 'Placement deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete placement.' });
  }
};

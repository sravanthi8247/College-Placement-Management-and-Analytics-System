import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ensureStudentProfile } from '../utils/studentProfile.js';

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  college: user.college,
  branch: user.branch,
  year: user.year,
  role: user.role,
});

const validateRegisterInput = (body) => {
  const { name, email, password, college, branch, year, role, adminCode } = body;
  const errors = [];

  if (!name?.trim()) errors.push('Name is required');
  else if (name.trim().length < 2) errors.push('Name must be at least 2 characters');

  if (!email?.trim()) errors.push('Email is required');
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.push('Please provide a valid email');

  if (!password) errors.push('Password is required');
  else if (password.length < 6) errors.push('Password must be at least 6 characters');

  if (!college?.trim()) errors.push('College is required');

  if (role !== 'admin') {
    if (!branch?.trim()) errors.push('Branch is required');

    if (year === undefined || year === null || year === '') {
      errors.push('Year is required');
    } else {
      const yearNum = Number(year);
      if (Number.isNaN(yearNum) || yearNum < 1 || yearNum > 4) {
        errors.push('Year must be a number between 1 and 4');
      }
    }
  }

  if (role && !['student', 'admin'].includes(role)) {
    errors.push('Role must be either student or admin');
  }

  if (role === 'admin') {
    if (!process.env.ADMIN_INVITE_CODE) {
      errors.push('Admin registration is not configured on this server');
    } else if (adminCode !== process.env.ADMIN_INVITE_CODE) {
      errors.push('Invalid admin invite code');
    }
  }

  return errors;
};

const validateLoginInput = (body) => {
  const { email, password } = body;
  const errors = [];

  if (!email?.trim()) errors.push('Email is required');
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.push('Please provide a valid email');

  if (!password) errors.push('Password is required');

  return errors;
};

export const register = async (req, res, next) => {
  try {
    const validationErrors = validateRegisterInput(req.body);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join(', '),
      });
    }

    const { name, email, password, college, branch, year, role } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      college: college.trim(),
      branch: branch?.trim() || undefined,
      year: year !== undefined && year !== null && year !== '' ? Number(year) : undefined,
      role: role || 'student',
    });

    try {
      await ensureStudentProfile(user);
    } catch (profileError) {
      console.error('Non-fatal: ensureStudentProfile during register:', profileError.message);
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: formatUserResponse(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const validationErrors = validateLoginInput(req.body);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join(', '),
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    try {
      await ensureStudentProfile(user);
    } catch (profileError) {
      console.error('Non-fatal: ensureStudentProfile during login:', profileError.message);
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: formatUserResponse(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: formatUserResponse(req.user),
    },
  });
};

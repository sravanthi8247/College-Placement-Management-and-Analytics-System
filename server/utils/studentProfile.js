import Student from '../models/Student.js';

export async function findStudentForUser(user) {
  if (!user) return null;

  // 1. Check if user ID is already linked to a student
  let student = await Student.findOne({ user: user._id });
  if (student) return student;

  // 2. Check if a student profile exists with matching email
  const normalizedEmail = String(user.email || '').toLowerCase().trim();
  if (normalizedEmail) {
    student = await Student.findOne({ email: normalizedEmail });
    if (student) {
      if (!student.user) {
        student = await Student.findByIdAndUpdate(
          student._id,
          { user: user._id },
          { new: true }
        );
      }
      return student;
    }
  }

  return null;
}

export async function ensureStudentProfile(user) {
  if (!user || user.role !== 'student') {
    return null;
  }

  const existing = await findStudentForUser(user);
  if (existing) {
    return existing;
  }

  const normalizedEmail = String(user.email || '').toLowerCase().trim();
  if (normalizedEmail) {
    const emailStudent = await Student.findOne({ email: normalizedEmail });
    if (emailStudent) {
      if (!emailStudent.user) {
        return Student.findByIdAndUpdate(
          emailStudent._id,
          { user: user._id },
          { new: true }
        );
      }
      return emailStudent;
    }
  }

  const rollNo = `STU${Date.now().toString().slice(-8)}`;

  return Student.create({
    user: user._id,
    name: user.name,
    email: normalizedEmail,
    rollNo,
    branch: user.branch || 'Not specified',
    year: user.year || 1,
    cgpa: 0,
    skills: [],
    phone: '0000000000',
    placementStatus: 'Not Placed',
  });
}

export async function syncStudentPlacementStatus(studentId) {
  if (!studentId) return;

  const Placement = (await import('../models/Placement.js')).default;
  const Application = (await import('../models/Application.js')).default;

  const [selectedPlacement, selectedApplication] = await Promise.all([
    Placement.findOne({ student: studentId, status: 'Selected' }),
    Application.findOne({ student: studentId, status: 'Selected' }),
  ]);

  await Student.findByIdAndUpdate(studentId, {
    placementStatus:
      selectedPlacement || selectedApplication ? 'Placed' : 'Not Placed',
  });
}

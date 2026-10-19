import express from 'express';
import {
  addStudent,
  getStudents,
  updateStudent,
  deleteStudent,
  getDashboardStats,
  getMyStudentProfile,
  updateMyStudentProfile,
  getImportTemplate,
  previewStudentImport,
  importStudents,
  downloadErrorReport,
  uploadMyResume,
  deleteMyResume,
  getStudentResume,
} from '../controllers/studentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  uploadStudentSpreadsheet,
  handleResumeUpload,
} from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/me', getMyStudentProfile);
router.put('/me', updateMyStudentProfile);
router.get('/me/resume', getStudentResume);
router.post('/me/resume', handleResumeUpload, uploadMyResume);
router.delete('/me/resume', deleteMyResume);
router.get('/:id/resume', getStudentResume);
router.get('/dashboard/stats', getDashboardStats);

router.get('/import/template', authorize('admin'), getImportTemplate);
router.post(
  '/import/preview',
  authorize('admin'),
  uploadStudentSpreadsheet.single('file'),
  previewStudentImport
);
router.post(
  '/import',
  authorize('admin'),
  uploadStudentSpreadsheet.single('file'),
  importStudents
);
router.post('/import/error-report', authorize('admin'), downloadErrorReport);

router.get('/', authorize('admin'), getStudents);
router.post('/', authorize('admin'), addStudent);
router.put('/:id', authorize('admin'), updateStudent);
router.delete('/:id', authorize('admin'), deleteStudent);

export default router;

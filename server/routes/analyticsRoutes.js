import express from 'express';
import {
  getAnalytics,
  exportStudentsCsv,
  exportApplicationsCsv,
  exportPlacementsCsv,
  exportPlacementReportPdf,
} from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getAnalytics);
router.get('/export/pdf', exportPlacementReportPdf);
router.get('/export/students', exportStudentsCsv);
router.get('/export/applications', exportApplicationsCsv);
router.get('/export/placements', exportPlacementsCsv);

export default router;

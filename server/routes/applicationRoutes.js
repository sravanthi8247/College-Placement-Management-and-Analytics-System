import express from 'express';
import {
  applyToDrive,
  getApplications,
  getApplicationStats,
  updateApplicationStatus,
} from '../controllers/applicationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('student'), applyToDrive);
router.get('/', getApplications);
router.get('/stats/:companyId', authorize('admin'), getApplicationStats);
router.put('/:id', authorize('admin'), updateApplicationStatus);

export default router;

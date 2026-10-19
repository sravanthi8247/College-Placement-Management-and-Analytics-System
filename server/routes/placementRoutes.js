import express from 'express';
import {
  addPlacement,
  getPlacements,
  updatePlacement,
  deletePlacement,
} from '../controllers/placementController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('admin'), getPlacements);
router.post('/', authorize('admin'), addPlacement);
router.put('/:id', authorize('admin'), updatePlacement);
router.delete('/:id', authorize('admin'), deletePlacement);

export default router;

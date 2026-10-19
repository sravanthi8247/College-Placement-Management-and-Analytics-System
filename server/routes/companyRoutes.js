import express from 'express';
import {
  addCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  checkCompanyEligibility,
  checkMyEligibility,
  getEligibleStudents,
} from '../controllers/companyController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCompanies);
router.get('/:id/eligibility/me', checkMyEligibility);
router.get('/:id/eligibility/:studentId', checkCompanyEligibility);
router.get('/:id/eligible-students', authorize('admin'), getEligibleStudents);
router.get('/:id', getCompanyById);
router.post('/', authorize('admin'), addCompany);
router.put('/:id', authorize('admin'), updateCompany);
router.delete('/:id', authorize('admin'), deleteCompany);

export default router;

import { Router } from 'express';
import {
  getPresentations,
  createPresentation,
  getPresentationById,
  deletePresentation,
} from '../controllers/presentations';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', getPresentations);
router.post('/', createPresentation);
router.get('/:id', getPresentationById);
router.delete('/:id', deletePresentation);

export default router;

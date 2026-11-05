import { Router } from 'express';
import { getSlides, createSlide, updateSlide, deleteSlide, reorderSlides, getQuestions, moderateQuestion } from '../controllers/slides';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/presentation/:presentationId', getSlides);
router.post('/presentation/:presentationId', createSlide);
router.put('/presentation/:presentationId/reorder', reorderSlides);
router.put('/:id', updateSlide);
router.get('/:id/questions',getQuestions);
router.patch('/:id/questions/:questionId',moderateQuestion);
router.delete('/:id', deleteSlide);

export default router;

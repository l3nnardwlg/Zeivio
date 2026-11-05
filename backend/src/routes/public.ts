import { Router } from 'express';
import { getPublicPresentationByCode, submitVote, submitQuestion, getApprovedQuestions } from '../controllers/public';

const router = Router();

router.get('/p/:code', getPublicPresentationByCode);
router.post('/vote', submitVote);
router.post('/questions',submitQuestion);
router.get('/questions/:slideId',getApprovedQuestions);

export default router;

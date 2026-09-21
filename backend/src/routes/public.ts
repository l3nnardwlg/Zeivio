import { Router } from 'express';
import { getPublicPresentationByCode, submitVote } from '../controllers/public';

const router = Router();

router.get('/p/:code', getPublicPresentationByCode);
router.post('/vote', submitVote);

export default router;

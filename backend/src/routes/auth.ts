import { Router } from 'express';
import { register, login, getMe, getUsers } from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, getMe);
router.get('/users', requireAuth, getUsers);

export default router;

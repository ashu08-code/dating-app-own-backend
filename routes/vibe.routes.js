import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { setVibe, getVibeMatches } from '../controllers/vibe.controller.js';

const router = express.Router();

router.post('/set', authenticate, setVibe);
router.get('/matches', authenticate, getVibeMatches);

export default router;

import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { getNotifications, markAsRead } from '../controllers/notification.controller.js';

const router = express.Router();

router.get('/', authenticate, getNotifications);
router.put('/read-all', authenticate, markAsRead);
router.put('/read/:id', authenticate, markAsRead);

export default router;

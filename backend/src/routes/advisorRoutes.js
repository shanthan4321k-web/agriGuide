import { Router } from 'express';
import { generateAdvisorDecision } from '../controllers/advisorController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// POST /api/advisor
router.post('/', optionalAuth, generateAdvisorDecision);

export default router;

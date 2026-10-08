import { Router } from 'express';
import { getCurrentMarketPrices } from '../controllers/marketController.js';

const router = Router();

// GET /api/market/current
router.get('/current', getCurrentMarketPrices);

export default router;

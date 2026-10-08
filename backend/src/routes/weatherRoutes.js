import { Router } from 'express';
import { getCurrentWeather } from '../controllers/weatherController.js';
import { validateWeatherQuery } from '../middleware/validationMiddleware.js';

const router = Router();

// GET /api/weather/current
router.get('/current', validateWeatherQuery, getCurrentWeather);

export default router;

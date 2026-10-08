import express from 'express';
import cors from 'cors';
import weatherRoutes from './routes/weatherRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import advisorRoutes from './routes/advisorRoutes.js';
import cropRoutes from './routes/cropRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import farmRoutes from './routes/farmRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AgriGuide backend is running',
  });
});

// Mount Feature API Routes
app.use('/api/weather', weatherRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/advisor', advisorRoutes);
app.use('/api/crop', cropRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/farm', farmRoutes);

// Fallback & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

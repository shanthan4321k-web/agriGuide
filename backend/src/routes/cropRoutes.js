import { Router } from 'express';
import multer from 'multer';
import { diagnoseCrop, getCropObservations, getCropDiagnoses, getCropDiagnosisById } from '../controllers/cropController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit per file
});

const router = Router();

// POST /api/crop/diagnose — Accepts 1-5 images and optional voice audio
router.post('/diagnose', optionalAuth, upload.any(), diagnoseCrop);

// GET /api/crop/diagnoses — Retrieves Crop Doctor assessment history from Supabase
router.get('/diagnoses', optionalAuth, getCropDiagnoses);

// GET /api/crop/diagnoses/:id — Reconstructs a full historical diagnosis
router.get('/diagnoses/:id', optionalAuth, getCropDiagnosisById);

// GET /api/crop/observations
router.get('/observations', optionalAuth, getCropObservations);

export default router;

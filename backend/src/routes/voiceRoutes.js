import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../controllers/voiceController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

const router = Router();

// POST /api/voice/transcribe
router.post('/transcribe', upload.single('file'), transcribeAudio);

export default router;

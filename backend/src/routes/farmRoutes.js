import express from 'express';
import * as farmController from '../controllers/farmController.js';

const router = express.Router();

router.get('/', farmController.getFarms);
router.get('/crops', farmController.getCrops);
router.post('/session', farmController.identifySession);
router.post('/extract-field-info', farmController.extractFieldInfo);
router.post('/compare-crops', farmController.compareCrops);
router.post('/crop-voice-qa', farmController.cropVoiceQA);
router.post('/plan-crop', farmController.planCrop);
router.post('/accept-plan', farmController.acceptPlan);

export default router;

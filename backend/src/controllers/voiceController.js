import * as whisperService from '../services/voice/whisperService.js';

export async function transcribeAudio(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'An audio file is required for voice transcription.',
        },
      });
    }

    const { language } = req.body;

    const result = await whisperService.transcribeAudio({
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype || 'audio/webm',
      language: language || 'en',
      filename: req.file.originalname || 'recording.webm',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

import * as fireworksService from '../services/ai/fireworksService.js';

export async function generateAdvisorDecision(req, res, next) {
  try {
    const {
      farmerProfile,
      weatherData,
      cropObservations,
      marketPrice,
      language,
    } = req.body;

    const result = await fireworksService.generateAdvisory({
      farmerProfile,
      weatherData,
      cropObservations,
      marketPrice,
      language: language || 'en',
      user: req.user || null,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

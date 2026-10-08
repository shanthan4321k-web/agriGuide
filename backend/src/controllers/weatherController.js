import * as weatherService from '../services/weather/weatherService.js';

export async function getCurrentWeather(req, res, next) {
  try {
    const { latitude, longitude, district, state } = req.query;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Valid latitude and longitude query parameters are required.',
        },
      });
    }

    const weatherData = await weatherService.getCurrentWeather({
      latitude: lat,
      longitude: lon,
      district: district || 'Warangal',
      state: state || 'Telangana',
    });

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (err) {
    next(err);
  }
}

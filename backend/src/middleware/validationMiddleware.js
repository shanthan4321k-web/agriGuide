export function validateWeatherQuery(req, res, next) {
  const { latitude, longitude } = req.query;
  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Query parameters "latitude" and "longitude" are required.',
      },
    });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_COORDINATES',
        message: 'Invalid latitude or longitude values.',
      },
    });
  }

  req.validatedCoords = { latitude: lat, longitude: lon };
  next();
}

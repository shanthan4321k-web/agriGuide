import * as marketService from '../services/market/marketService.js';

export async function getCurrentMarketPrices(req, res, next) {
  try {
    const { district, state, commodity } = req.query;

    const result = await marketService.getCurrentMarketPrices({
      district: district || 'Warangal',
      state: state || 'Telangana',
      commodity,
    });

    res.json({
      success: true,
      data: result.records,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

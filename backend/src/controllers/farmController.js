import * as farmService from '../services/farm/farmService.js';

export async function getFarms(req, res, next) {
  try {
    const farms = await farmService.getFarmsForUser(req.user || null);
    res.json({
      success: true,
      data: farms,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCrops(req, res, next) {
  try {
    const crops = await farmService.getVerifiedCrops();
    res.json({
      success: true,
      data: crops,
    });
  } catch (err) {
    next(err);
  }
}

export async function identifySession(req, res, next) {
  try {
    const { phone, preferredLanguage, fullName } = req.body;
    const session = await farmService.identifyFarmerSession({
      phone,
      preferredLanguage,
      fullName,
    });
    res.json({
      success: true,
      data: session,
    });
  } catch (err) {
    next(err);
  }
}

export async function extractFieldInfo(req, res, next) {
  try {
    const transcript = req.body.transcript || req.body.text || '';
    const language = req.body.language || 'en';
    const extracted = await farmService.extractFieldInfoWithAI({
      transcript,
      language,
    });
    res.json({
      success: true,
      data: extracted,
    });
  } catch (err) {
    next(err);
  }
}

export async function compareCrops(req, res, next) {
  try {
    const { 
      farmId, 
      farmName, 
      acres, 
      soilType, 
      irrigationSource, 
      sowingWindow, 
      district, 
      state, 
      location, 
      language 
    } = req.body;

    const targetDistrict = district || location?.district || 'Warangal';
    const targetState = state || location?.state || 'Telangana';

    const comparison = await farmService.compareCropsWithAI({
      farmId,
      farmName,
      acres,
      soilType,
      irrigationSource,
      sowingWindow,
      district: targetDistrict,
      state: targetState,
      language: language || 'en',
      user: req.user || null,
    });
    res.json({
      success: true,
      data: comparison,
    });
  } catch (err) {
    next(err);
  }
}

export async function cropVoiceQA(req, res, next) {
  try {
    const { question, comparedCrops, fieldInfo, language } = req.body;
    const answer = await farmService.cropVoiceQA({
      question,
      comparedCrops,
      fieldInfo,
      language: language || 'en',
    });
    res.json({
      success: true,
      data: answer,
    });
  } catch (err) {
    next(err);
  }
}

export async function planCrop(req, res, next) {
  try {
    const { farmId, farmName, acres, soilType, irrigationSource, cropName, variety, sowingWindow, district, state, language } = req.body;

    if (!cropName || !acres) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Crop name and planned acres are required.' },
      });
    }

    const plan = await farmService.planCropWithAI({
      farmId,
      farmName,
      acres,
      soilType,
      irrigationSource,
      cropName,
      variety,
      sowingWindow,
      district,
      state,
      language: language || 'en',
      user: req.user || null,
    });

    res.json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
}

export async function acceptPlan(req, res, next) {
  try {
    const {
      farmId,
      farmName,
      totalFarmAcres,
      acres,
      soilType,
      irrigationSource,
      district,
      state,
      village,
      plotName,
      currentCrop,
      variety,
      sowingDate,
      stage,
      initialManagementPlan,
    } = req.body;

    if (!currentCrop || !acres) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Current crop and acres are required.' },
      });
    }

    const result = await farmService.acceptCropPlan({
      farmId,
      farmName,
      totalFarmAcres,
      acres,
      soilType,
      irrigationSource,
      district,
      state,
      village,
      plotName,
      currentCrop,
      variety,
      sowingDate,
      stage,
      initialManagementPlan,
      user: req.user || null,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

import { fetchApi } from '../apiConfig';
import type { 
  Farm, 
  CropPlanData, 
  VerifiedCrop, 
  CropComparisonResponse, 
  ExtractedFieldInfo,
  FarmerProfile,
  Language 
} from '../../types';

export class FarmService {
  /**
   * Identify farmer by phone number (frictionless onboarding & session recovery)
   */
  static async identifySession(
    phone: string, 
    preferredLanguage: Language = 'en', 
    fullName: string = 'Farmer'
  ): Promise<FarmerProfile | null> {
    try {
      const res = await fetchApi<FarmerProfile>('/farm/session', {
        method: 'POST',
        body: JSON.stringify({ phone, preferredLanguage, fullName }),
      });
      if (res.success && res.data) {
        return res.data;
      }
      return null;
    } catch (err: any) {
      console.warn('[FarmService] identifySession error:', err.message);
      return null;
    }
  }

  /**
   * Fetch all real farms and plots from Supabase (Zero mock fallback)
   */
  static async getFarms(): Promise<Farm[]> {
    try {
      const res = await fetchApi<Farm[]>('/farm');
      if (res.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    } catch (err: any) {
      console.warn('[FarmService] Error fetching farms:', err.message);
      return [];
    }
  }

  /**
   * Fetch verified crops catalog from Supabase
   */
  static async getCrops(): Promise<VerifiedCrop[]> {
    try {
      const res = await fetchApi<VerifiedCrop[]>('/farm/crops');
      if (res.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    } catch (err: any) {
      console.warn('[FarmService] Error fetching crops catalog:', err.message);
      return [];
    }
  }

  /**
   * Extract field parameters from farmer voice speech
   */
  static async extractFieldInfo(transcript: string, language: Language): Promise<ExtractedFieldInfo> {
    try {
      const res = await fetchApi<ExtractedFieldInfo>('/farm/extract-field-info', {
        method: 'POST',
        body: JSON.stringify({ transcript, language }),
      });
      if (res.success && res.data) {
        return res.data;
      }
      return {
        acres: null,
        location: null,
        district: null,
        village: null,
        soilType: null,
        irrigationSource: null,
        sowingWindow: null,
        mentionedCrop: null,
      };
    } catch (err: any) {
      console.warn('[FarmService] Error extracting field info:', err.message);
      return {
        acres: null,
        location: null,
        district: null,
        village: null,
        soilType: null,
        irrigationSource: null,
        sowingWindow: null,
        mentionedCrop: null,
      };
    }
  }

  /**
   * Data-driven Crop Comparison ("WHAT CAN I GROW HERE?")
   */
  static async compareCrops(params: {
    farmId?: string;
    farmName?: string;
    acres: number;
    soilType: string;
    irrigationSource: string;
    sowingWindow: string;
    district: string;
    state: string;
    language: Language;
  }): Promise<CropComparisonResponse> {
    try {
      const res = await fetchApi<CropComparisonResponse>('/farm/compare-crops', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      if (res.success && res.data) {
        return res.data;
      }
      return {
        status: 'no_data',
        summary: 'No verified crop information is available right now.',
        crops: [],
      };
    } catch (err: any) {
      console.warn('[FarmService] compareCrops error:', err.message);
      return {
        status: 'no_data',
        summary: 'No verified crop information is available right now.',
        crops: [],
      };
    }
  }

  /**
   * Voice Q&A over verified crop comparison dataset
   */
  static async cropVoiceQA(params: {
    question: string;
    comparedCrops: any[];
    fieldInfo: any;
    language: Language;
  }): Promise<string> {
    try {
      const res = await fetchApi<{ answer: string }>('/farm/crop-voice-qa', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      if (res.success && res.data?.answer) {
        return res.data.answer;
      }
      return '';
    } catch (err: any) {
      console.warn('[FarmService] cropVoiceQA error:', err.message);
      return '';
    }
  }

  /**
   * Generate AI Crop Plan using GLM-5.3-Flash grounded in verified weather and mandi economics
   */
  static async planCropWithAI(params: {
    farmId?: string;
    farmName: string;
    acres: number;
    soilType: string;
    irrigationSource: string;
    cropName: string;
    variety?: string;
    sowingWindow: string;
    district: string;
    state: string;
    language: Language;
  }): Promise<CropPlanData> {
    const res = await fetchApi<{ plan: CropPlanData }>('/farm/plan-crop', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (res.success && res.data?.plan) {
      return res.data.plan;
    }
    throw new Error(res.error?.message || 'Failed to generate crop plan');
  }

  /**
   * Accept plan & commit to Supabase farm_plots and recommendations
   */
  static async acceptCropPlan(params: {
    farmId?: string;
    farmName?: string;
    totalFarmAcres?: number;
    acres: number;
    soilType?: string;
    irrigationSource?: string;
    district?: string;
    state?: string;
    village?: string;
    plotName?: string;
    currentCrop: string;
    variety?: string;
    sowingDate?: string;
    stage?: string;
    initialManagementPlan?: any[];
  }): Promise<{ status: string; farmId?: string; plot: any; message: string }> {
    const res = await fetchApi<{ status: string; farmId?: string; plot: any; message: string }>('/farm/accept-plan', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.error?.message || 'Failed to start crop');
  }
}

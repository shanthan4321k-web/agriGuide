import type { CropHealth, CropDoctorDiagnosis, Language } from '../../types';
import { CacheService } from '../cacheService';
import { fetchApi } from '../apiConfig';

const CROP_HEALTH_CACHE_KEY = 'user_crop_health_records';

// Initial Seed Farm Plot Records (Honest baseline observations without fabricated diseases)
export const SEED_CROP_RECORDS: CropHealth[] = [
  {
    id: 'plot_cotton_01',
    cropName: 'Cotton',
    variety: 'Bt Cotton',
    acres: 3.0,
    status: 'under_watch',
    lastInspectionDate: 'Yesterday',
    recommendedAction: 'Routine scouting of lower leaf canopy recommended.',
    urgency: 'medium',
    updatedAt: new Date().toISOString(),
    source: 'Field Scouting Observation',
  },
  {
    id: 'plot_maize_02',
    cropName: 'Maize',
    variety: 'Hybrid Maize',
    acres: 1.5,
    status: 'healthy',
    lastInspectionDate: '3 days ago',
    recommendedAction: 'Vegetative growth healthy. Monitor for weed competition.',
    urgency: 'low',
    updatedAt: new Date().toISOString(),
    source: 'Field Scouting Observation',
  }
];

export interface MultimodalDiagnosisResult {
  status: 'success' | 'unconfigured' | 'error' | 'mismatch';
  diagnosis?: CropDoctorDiagnosis;
  cropMismatchDetected?: boolean;
  selectedCrop?: string;
  visualCropIdentified?: string;
  voiceCropMentioned?: string | null;
  mismatchNotice?: string | null;
  voiceStatus?: string;
  whisperLatencyMs?: number;
  aiLatencyMs?: number;
  message?: string;
}

export const CropHealthService = {
  async getCropHealthRecords(): Promise<CropHealth[]> {
    // 1. Call Node Backend /api/crop/observations
    try {
      const res = await fetchApi<any[]>('/crop/observations');
      if (res.success && res.data && res.data.length > 0) {
        const mapped: CropHealth[] = res.data.map(item => ({
          id: item.id || `plot_${Date.now()}`,
          cropName: item.crop_name || 'Crop',
          variety: item.variety || 'Standard',
          acres: Number(item.acres || 3.0),
          status: item.status || 'healthy',
          lastInspectionDate: item.observed_at ? new Date(item.observed_at).toLocaleDateString() : 'Recent',
          recommendedAction: item.notes || 'Routine field scouting.',
          urgency: item.status === 'under_watch' ? 'medium' : 'low',
          updatedAt: item.created_at || new Date().toISOString(),
          source: 'Field Scouting Log (Supabase)',
        }));
        CacheService.set(CROP_HEALTH_CACHE_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('[CropHealthService] Backend observations notice:', e);
    }

    // 2. Cache check
    const cached = CacheService.get<CropHealth[]>(CROP_HEALTH_CACHE_KEY);
    if (cached && cached.data.length > 0) {
      return cached.data;
    }

    // 3. Seed plots
    CacheService.set(CROP_HEALTH_CACHE_KEY, SEED_CROP_RECORDS);
    return SEED_CROP_RECORDS;
  },

  getCropHealthRecordsSync(): CropHealth[] {
    const cached = CacheService.get<CropHealth[]>(CROP_HEALTH_CACHE_KEY);
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    return SEED_CROP_RECORDS;
  },

  updateCropRecord(updated: CropHealth): void {
    const records = this.getCropHealthRecordsSync();
    const index = records.findIndex(r => r.id === updated.id);
    if (index >= 0) {
      records[index] = updated;
    } else {
      records.push(updated);
    }
    CacheService.set(CROP_HEALTH_CACHE_KEY, records);
  },

  /**
   * Unified Multimodal Crop Doctor Assessment
   * Orchestrates 1-5 images + optional voice audio + crop context
   */
  async diagnoseCropMultimodal({
    images,
    audioBlob,
    voiceText,
    cropName = 'Cotton',
    language = 'en',
    farmerContext,
  }: {
    images: File[];
    audioBlob?: Blob | null;
    voiceText?: string | null;
    cropName?: string;
    language?: Language;
    farmerContext?: any;
  }): Promise<MultimodalDiagnosisResult> {
    if (!images || images.length === 0) {
      return {
        status: 'error',
        message: 'Please upload at least one crop leaf or plant photo.',
      };
    }

    try {
      const formData = new FormData();
      
      // Attach images (1 to 5)
      images.slice(0, 5).forEach((img, index) => {
        formData.append('images', img, img.name || `leaf_${index + 1}.jpg`);
      });

      // Attach optional voice audio
      if (audioBlob) {
        formData.append('audio', audioBlob, 'farmer_voice.webm');
      }

      // Attach optional voice transcript text
      if (voiceText && voiceText.trim().length > 0) {
        formData.append('voiceDescription', voiceText.trim());
      }

      formData.append('cropName', cropName);
      formData.append('language', language);
      if (farmerContext) {
        formData.append('farmerContext', JSON.stringify(farmerContext));
      }

      const res = await fetchApi<{
        status: string;
        cropMismatchDetected?: boolean;
        selectedCrop?: string;
        visualCropIdentified?: string;
        voiceCropMentioned?: string | null;
        mismatchNotice?: string | null;
        diagnosis?: CropDoctorDiagnosis;
        voiceStatus?: string;
        whisperLatencyMs?: number;
        aiLatencyMs?: number;
        message?: string;
      }>('/crop/diagnose', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data) {
        if (res.data.status === 'mismatch' || res.data.cropMismatchDetected || res.data.diagnosis?.cropMismatchDetected) {
          return {
            status: 'mismatch',
            cropMismatchDetected: true,
            selectedCrop: res.data.selectedCrop || res.data.diagnosis?.selectedCrop,
            visualCropIdentified: res.data.visualCropIdentified || res.data.diagnosis?.visualCropIdentified,
            voiceCropMentioned: res.data.voiceCropMentioned || res.data.diagnosis?.voiceCropMentioned,
            mismatchNotice: res.data.mismatchNotice || res.data.diagnosis?.mismatchNotice || res.data.message,
            diagnosis: res.data.diagnosis,
            message: res.data.message || res.data.mismatchNotice || 'Crop mismatch detected.',
          };
        }

        if (res.data.diagnosis) {
          return {
            status: 'success',
            diagnosis: res.data.diagnosis,
            voiceStatus: res.data.voiceStatus,
            whisperLatencyMs: res.data.whisperLatencyMs,
            aiLatencyMs: res.data.aiLatencyMs,
            message: 'Multimodal crop assessment completed.',
          };
        }
      }

      return {
        status: 'unconfigured',
        message: res.data?.message || 'Crop Doctor analysis is temporarily unavailable.',
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: err.message || 'Crop Doctor analysis connection error.',
      };
    }
  },

  // Backwards compatibility single image wrapper
  async diagnoseCropImage(file: File, cropName: string = 'Cotton'): Promise<{
    status: 'success' | 'unconfigured' | 'error' | 'mismatch';
    diagnosis?: CropHealth;
    message: string;
  }> {
    const res = await this.diagnoseCropMultimodal({
      images: [file],
      cropName,
    });

    if (res.status === 'success' && res.diagnosis) {
      return {
        status: 'success',
        diagnosis: {
          id: `diag_${Date.now()}`,
          cropName,
          variety: 'Standard',
          acres: 3.0,
          status: res.diagnosis.status === 'no_issue' ? 'healthy' : (res.diagnosis.severity === 'high' ? 'attention' : 'under_watch'),
          lastInspectionDate: 'Today',
          diseaseIdentified: res.diagnosis.diagnosisTitle,
          recommendedAction: res.diagnosis.recommendation.join(' '),
          urgency: res.diagnosis.severity === 'high' ? 'high' : 'medium',
          updatedAt: new Date().toISOString(),
          source: `Fireworks GLM-5.3-Flash`,
        },
        message: res.diagnosis.summary,
      };
    }

    return {
      status: res.status,
      message: res.message || 'Crop analysis unavailable.',
    };
  },

  /**
   * Fetch historical crop doctor assessments from Supabase
   */
  async getDiagnosisHistory(): Promise<CropDiagnosisHistoryItem[]> {
    try {
      const res = await fetchApi<CropDiagnosisHistoryItem[]>('/crop/diagnoses');
      if (res.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    } catch (err) {
      console.warn('[CropHealthService] Error loading history:', err);
      return [];
    }
  },

  /**
   * Reconstruct a single historical diagnosis from Supabase
   */
  async getDiagnosisById(id: string): Promise<{
    diagnosis: CropDoctorDiagnosis;
    images: Array<{ imageIndex: number; storagePath: string; previewUrl: string; name?: string }>;
    audioUrl?: string | null;
    createdAt?: string;
  } | null> {
    try {
      const res = await fetchApi<{
        diagnosis: CropDoctorDiagnosis;
        images: Array<{ imageIndex: number; storagePath: string; previewUrl: string; name?: string }>;
        audioUrl?: string | null;
        createdAt?: string;
      }>(`/crop/diagnoses/${id}`);
      if (res.success && res.data) {
        return res.data;
      }
      return null;
    } catch (err) {
      console.warn('[CropHealthService] Error loading diagnosis by ID:', err);
      return null;
    }
  }
};

export interface CropDiagnosisHistoryItem {
  id: string;
  cropName: string;
  status: 'no_issue' | 'problem_detected' | 'uncertain';
  diagnosisTitle: string;
  summary?: string;
  severity: 'none' | 'low' | 'moderate' | 'high' | 'unknown';
  imageCount: number;
  voiceContextUsed: boolean;
  voiceTranscript?: string | null;
  createdAt: string;
  thumbnailSignedUrl?: string | null;
  signedImages?: Array<{
    imageIndex: number;
    storagePath: string;
    previewUrl: string;
  }>;
}

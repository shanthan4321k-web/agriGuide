// =============================================================================
// AGRIGUIDE DATA CONTRACTS & TYPE DEFINITIONS
// =============================================================================

export type Language = 'en' | 'te' | 'hi';

export type DesktopNavTab = 'home' | 'weather' | 'doctor' | 'mandi' | 'money' | 'alerts';
export type NavTab = 'home' | 'weather' | 'doctor' | 'mandi';

export interface LocationContext {
  district: string;
  state: string;
  village?: string;
  latitude: number;
  longitude: number;
  source: 'gps' | 'manual' | 'default';
}

export interface WeatherData {
  location: string;
  temperature: number;
  feelsLike: number;
  rainfallProbability: number;
  humidity: number;
  windSpeedKmH: number;
  conditionText: string;
  isRainExpectedToday: boolean;
  advisoryText: string;
  sprayCondition: 'safe' | 'caution' | 'unsafe';
  sprayWindowText: string;
  updatedAt: string;
  source: string;
  isCached: boolean;
}

export interface MarketPrice {
  commodity: string;
  variety: string;
  marketName: string;
  district: string;
  state: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  date: string;
  trendPercentage: number;
  trendDirection: 'up' | 'down' | 'steady';
  actionRecommendation: 'SELL' | 'HOLD' | 'WAIT';
  actionReason: string;
  updatedAt: string;
  source: string;
  isCached: boolean;
}

export interface CropHealth {
  id: string;
  cropName: string;
  variety: string;
  acres: number;
  status: 'healthy' | 'under_watch' | 'attention';
  lastInspectionDate: string;
  diseaseIdentified?: string;
  confidenceScore?: number;
  recommendedAction: string;
  urgency: 'high' | 'medium' | 'low';
  updatedAt: string;
  source: string;
}

export interface CropDoctorDiagnosis {
  status: 'no_issue' | 'problem_detected' | 'uncertain';
  diagnosisTitle: string;
  summary: string;
  severity: 'none' | 'low' | 'moderate' | 'high' | 'unknown';
  symptomsObserved: string[];
  farmerReportedSymptoms: string[];
  visualFindings: string[];
  likelyCause: string | null;
  recommendation: string[];
  immediateAction: string | null;
  whatToAvoid: string[];
  monitoringAdvice: string | null;
  needsExpertReview: boolean;
  additionalPhotosNeeded: string[];
  voiceContextUsed: boolean;
  imageCount: number;
  model?: string;
  aiLatencyMs?: number;
}

export interface TodayDecision {
  id: string;
  actionTitle: string;
  cropTarget: string;
  reason: string;
  deadline: string;
  urgency: 'high' | 'medium' | 'low';
  category: 'pest' | 'irrigation' | 'fertilizer' | 'harvest' | 'market';
  weatherContext: string;
  source: string;
  confidence?: number;
  isCompleted: boolean;
}

export interface FarmerProfile {
  name: string;
  acres: number;
  crops: string[];
  village: string;
  district: string;
  state: string;
}

export interface AlertNotification {
  id: string;
  title: string;
  description: string;
  severity: 'warning' | 'danger' | 'info';
  issuedAt: string;
  source: string;
}

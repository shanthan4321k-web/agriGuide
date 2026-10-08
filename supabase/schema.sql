-- =============================================================================
-- AGRIGUIDE PRODUCTION DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Reconciled for Node.js/Express backend + Fireworks GLM-5.3-Flash Multimodal
-- =============================================================================

-- Enable required UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. Profiles Table (Farmer Profiles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  state TEXT NOT NULL DEFAULT 'Telangana',
  district TEXT NOT NULL DEFAULT 'Warangal',
  village TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at timestamp trigger for profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. Farms Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  farm_name TEXT NOT NULL,
  total_acres NUMERIC(6, 2) NOT NULL DEFAULT 4.5,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  soil_type TEXT,
  irrigation_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 3. Farm Plots Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS farm_plots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plot_name TEXT NOT NULL,
  acres NUMERIC(6, 2) NOT NULL,
  current_crop TEXT NOT NULL,
  variety TEXT,
  sowing_date DATE,
  stage TEXT DEFAULT 'Vegetative Stage',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. Crops Catalog (Public Reference Data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS crops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  local_name_te TEXT,
  local_name_hi TEXT,
  scientific_name TEXT,
  standard_duration_days INT,
  optimal_temp_min NUMERIC(4, 1),
  optimal_temp_max NUMERIC(4, 1)
);

-- =============================================================================
-- 5. Crop Observations (Field Scout Logs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS crop_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plot_id UUID NOT NULL REFERENCES farm_plots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'under_watch', 'attention')),
  notes TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. Crop Diagnoses (Multimodal AI Vision & Diagnostic Records)
-- =============================================================================
CREATE TABLE IF NOT EXISTS crop_diagnoses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plot_id UUID REFERENCES farm_plots(id) ON DELETE SET NULL,
  crop_name TEXT NOT NULL,
  
  -- Multimodal Diagnostic State & Classification
  status TEXT NOT NULL CHECK (status IN ('no_issue', 'problem_detected', 'uncertain')),
  diagnosis_title TEXT NOT NULL,
  summary TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('none', 'low', 'moderate', 'high', 'unknown')),
  
  -- Structured Multimodal Reasoning Findings
  symptoms_observed JSONB NOT NULL DEFAULT '[]'::jsonb,
  farmer_reported_symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  visual_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  likely_cause TEXT,
  recommendation JSONB NOT NULL DEFAULT '[]'::jsonb,
  immediate_action TEXT,
  what_to_avoid JSONB NOT NULL DEFAULT '[]'::jsonb,
  monitoring_advice TEXT,
  needs_expert_review BOOLEAN NOT NULL DEFAULT FALSE,
  additional_photos_needed JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Voice Context Tracking
  voice_context_used BOOLEAN NOT NULL DEFAULT FALSE,
  voice_storage_path TEXT,
  voice_transcript TEXT,
  voice_language TEXT,
  
  -- Image Metadata & Normalized Bounding Box Annotations
  image_count INT NOT NULL DEFAULT 1 CHECK (image_count >= 1 AND image_count <= 5),
  visual_annotations JSONB DEFAULT '[]'::jsonb,
  
  -- AI System Info
  model_name TEXT NOT NULL DEFAULT 'accounts/fireworks/models/glm-5p3-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 7. Crop Diagnosis Images (Normalized 1-to-5 Images per Diagnosis)
-- =============================================================================
CREATE TABLE IF NOT EXISTS crop_diagnosis_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagnosis_id UUID NOT NULL REFERENCES crop_diagnoses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_index INT NOT NULL CHECK (image_index >= 0 AND image_index < 5),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_diagnosis_image_index UNIQUE (diagnosis_id, image_index)
);

-- =============================================================================
-- 8. Weather Snapshots (Cached Observed Meteorological Data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  temperature NUMERIC(4, 1) NOT NULL,
  humidity NUMERIC(4, 1),
  wind_speed_kmh NUMERIC(4, 1),
  rainfall_prob INT,
  condition_text TEXT,
  spray_condition TEXT CHECK (spray_condition IN ('safe', 'caution', 'unsafe')),
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 9. Market Prices (APMC / e-NAM Live Records)
-- =============================================================================
CREATE TABLE IF NOT EXISTS market_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commodity TEXT NOT NULL,
  variety TEXT,
  market_name TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  min_price NUMERIC(10, 2) NOT NULL,
  modal_price NUMERIC(10, 2) NOT NULL,
  max_price NUMERIC(10, 2) NOT NULL,
  trend_percentage NUMERIC(5, 2),
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'steady')),
  action_recommendation TEXT CHECK (action_recommendation IN ('SELL', 'HOLD', 'WAIT')),
  arrival_date DATE NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 10. Agricultural Alerts & Extension Notices
-- =============================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'danger', 'info')),
  affected_districts TEXT[] NOT NULL DEFAULT '{}',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  source TEXT NOT NULL
);

-- =============================================================================
-- 11. Recommendations (Decision Engine / AI Advisory Outputs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_title TEXT NOT NULL,
  crop_target TEXT NOT NULL,
  reason TEXT NOT NULL,
  deadline TEXT,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high')),
  category TEXT CHECK (category IN ('pest', 'irrigation', 'fertilizer', 'harvest', 'market')),
  weather_context TEXT,
  source TEXT NOT NULL,
  inputs_used JSONB,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 12. Completed Actions (Farmer Audit Trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS completed_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  action_name TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_plots_farm_id ON farm_plots(farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_plots_user_id ON farm_plots(user_id);
CREATE INDEX IF NOT EXISTS idx_crop_observations_plot_id ON crop_observations(plot_id);
CREATE INDEX IF NOT EXISTS idx_crop_observations_user_id ON crop_observations(user_id);
CREATE INDEX IF NOT EXISTS idx_crop_observations_observed_at ON crop_observations(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_crop_diagnoses_user_id ON crop_diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_crop_diagnoses_created_at ON crop_diagnoses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crop_diagnosis_images_diag_id ON crop_diagnosis_images(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_district_state ON weather_snapshots(district, state);
CREATE INDEX IF NOT EXISTS idx_market_prices_commodity_district ON market_prices(commodity, district);
CREATE INDEX IF NOT EXISTS idx_market_prices_arrival_date ON market_prices(arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_completed_actions_user_id ON completed_actions(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all user-specific tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_diagnosis_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_actions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on public reference tables
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Public Read Policies (Reference / Weather / Mandi / Alerts)
CREATE POLICY "Public read crops" ON crops FOR SELECT USING (true);
CREATE POLICY "Public read weather snapshots" ON weather_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read market prices" ON market_prices FOR SELECT USING (true);
CREATE POLICY "Public read active alerts" ON alerts FOR SELECT USING (true);

-- User-Owned Table Policies (Authenticated Farmer Access)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own farms" ON farms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own farms" ON farms FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own farm plots" ON farm_plots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own farm plots" ON farm_plots FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own crop observations" ON crop_observations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crop observations" ON crop_observations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own crop diagnoses" ON crop_diagnoses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crop diagnoses" ON crop_diagnoses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own diagnosis images" ON crop_diagnosis_images FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own diagnosis images" ON crop_diagnosis_images FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own recommendations" ON recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own recommendations" ON recommendations FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own completed actions" ON completed_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completed actions" ON completed_actions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- ROLE PERMISSIONS & PRIVILEGES (Required for service_role and API access)
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

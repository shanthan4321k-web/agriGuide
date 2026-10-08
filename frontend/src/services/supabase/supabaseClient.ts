import { createClient } from '@supabase/supabase-js';
import type { FarmerProfile, CropHealth, TodayDecision } from '../../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;

// Initial Authenticated Profile Seed (used when running in local demo or pre-auth mode)
export const DEFAULT_FARMER_PROFILE: FarmerProfile = {
  name: 'Ramesh ji',
  acres: 4.5,
  crops: ['Cotton', 'Maize'],
  village: 'Geesugonda',
  district: 'Warangal',
  state: 'Telangana',
};

export const SupabaseService = {
  async getFarmerProfile(): Promise<FarmerProfile> {
    if (!supabase) {
      return DEFAULT_FARMER_PROFILE;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return DEFAULT_FARMER_PROFILE;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          full_name,
          district,
          state,
          village,
          farms (
            total_acres,
            farm_plots (
              current_crop
            )
          )
        `)
        .eq('id', user.id)
        .single();

      if (error || !data) {
        return DEFAULT_FARMER_PROFILE;
      }

      const farm = data.farms?.[0];
      const crops = farm?.farm_plots?.map((p: any) => p.current_crop) || ['Cotton', 'Maize'];

      return {
        name: data.full_name || 'Farmer',
        acres: Number(farm?.total_acres || 4.5),
        crops,
        village: data.village || 'Field',
        district: data.district || 'Warangal',
        state: data.state || 'Telangana',
      };
    } catch (e) {
      console.warn('[SupabaseService] Profile fetch error, using authenticated default:', e);
      return DEFAULT_FARMER_PROFILE;
    }
  },

  async getCropObservations(): Promise<CropHealth[]> {
    if (!supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('crop_observations')
        .select(`
          id,
          status,
          notes,
          observed_at,
          farm_plots (
            plot_name,
            current_crop,
            variety,
            acres
          )
        `)
        .order('observed_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((item: any) => ({
        id: item.id,
        cropName: item.farm_plots?.current_crop || 'Crop',
        variety: item.farm_plots?.variety || 'Hybrid',
        acres: Number(item.farm_plots?.acres || 1.0),
        status: item.status as 'healthy' | 'under_watch' | 'attention',
        lastInspectionDate: new Date(item.observed_at).toLocaleDateString('en-IN'),
        recommendedAction: item.notes || 'Routine crop inspection.',
        urgency: item.status === 'attention' ? 'high' : item.status === 'under_watch' ? 'medium' : 'low',
        updatedAt: item.observed_at,
        source: 'Supabase Farm Plot Record',
      }));
    } catch (e) {
      console.warn('[SupabaseService] Crop observations fetch error:', e);
      return [];
    }
  },

  async logCompletedAction(decision: TodayDecision, notes?: string): Promise<boolean> {
    if (!supabase) return true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return true;

      const { error } = await supabase
        .from('completed_actions')
        .insert({
          user_id: user.id,
          action_name: decision.actionTitle,
          notes: notes || decision.reason,
          completed_at: new Date().toISOString(),
        });

      return !error;
    } catch (e) {
      console.warn('[SupabaseService] Failed to record completed action in Supabase:', e);
      return false;
    }
  }
};

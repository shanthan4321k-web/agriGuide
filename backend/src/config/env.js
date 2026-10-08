import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Deterministically load backend/.env
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Supabase (PostgreSQL / Storage / Auth verification)
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || '',
  
  // Fireworks AI (Advisory Reasoning & Multimodal Crop Vision)
  FIREWORKS_BASE_URL: (process.env.FIREWORKS_BASE_URL || 'https://api.fireworks.ai/inference/v1').replace(/\/+$/, ''),
  FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY || '',
  FIREWORKS_MODEL: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/glm-5p3-flash',
  
  // Agmarknet / e-NAM
  AGMARKNET_API_URL: process.env.AGMARKNET_API_URL || 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070',
  AGMARKNET_API_KEY: process.env.AGMARKNET_API_KEY || '',
};

export function validateEnv() {
  const missingConfigs = [];
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    missingConfigs.push('Supabase (Database/Storage/Auth)');
  }
  if (!env.FIREWORKS_API_KEY) {
    missingConfigs.push('Fireworks AI (Advisory Reasoning & Crop Vision)');
  }
  if (!env.AGMARKNET_API_KEY) {
    missingConfigs.push('Agmarknet (Mandi Rates)');
  }

  if (missingConfigs.length > 0) {
    console.log(`[Config] Note: The following external providers are unconfigured: ${missingConfigs.join(', ')}.`);
    console.log('[Config] Unconfigured services will return honest unavailable/unconfigured responses.');
  }
}

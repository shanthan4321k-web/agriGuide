import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabaseClient = null;

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    try {
      supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } catch (err) {
      console.warn('[Supabase] Client creation warning:', err.message);
    }
  }
  return supabaseClient;
}

export const supabase = getSupabaseClient();

export function isSupabaseConfigured() {
  return Boolean(getSupabaseClient());
}

let cachedDefaultUserId = null;

export async function getOrCreateDefaultFarmerUser() {
  if (cachedDefaultUserId) return cachedDefaultUserId;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: userList } = await client.auth.admin.listUsers();
    if (userList?.users?.length > 0) {
      cachedDefaultUserId = userList.users[0].id;
      return cachedDefaultUserId;
    }

    const { data: newUser } = await client.auth.admin.createUser({
      email: 'farmer.ramesh@agriguide.in',
      password: 'AgriGuideFarmer2026!',
      email_confirm: true,
      user_metadata: { full_name: 'Ramesh ji', phone: '+919876543210' }
    });

    if (newUser?.user?.id) {
      cachedDefaultUserId = newUser.user.id;
      return cachedDefaultUserId;
    }
  } catch (err) {
    console.warn('[Supabase] Default farmer user check notice:', err.message);
  }
  return null;
}

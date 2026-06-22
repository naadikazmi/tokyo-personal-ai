import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const normalizeSupabaseUrl = (url: string | undefined) =>
  url?.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

const supabaseUrl = normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

const hasRealValue = (value: string | undefined) =>
  Boolean(value && !/your-|placeholder|example|supabase-anon-or-publishable-key/i.test(value));

const hasValidSupabaseUrl = (value: string | undefined) => {
  if (!hasRealValue(value)) return false;

  try {
    if (!value) return false;
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = hasValidSupabaseUrl(supabaseUrl) && hasRealValue(supabaseAnonKey);

export const missingSupabaseEnvVars = [
  !hasValidSupabaseUrl(supabaseUrl) ? 'EXPO_PUBLIC_SUPABASE_URL' : null,
  !hasRealValue(supabaseAnonKey) ? 'EXPO_PUBLIC_SUPABASE_ANON_KEY' : null,
].filter(Boolean) as string[];

const createSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: typeof window !== 'undefined',
    },
  });
};

export const supabase = createSupabaseClient();

export const getSupabase = () => supabase;

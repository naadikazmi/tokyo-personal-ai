import type { User } from '@supabase/supabase-js';

import { getSupabase } from './supabase';

const stringFromMetadata = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export const getOAuthRedirectUrl = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  // Configure this same origin in Supabase Auth URL settings and Google OAuth:
  // local Expo Web usually uses http://localhost:8081 after `npx expo start -c` then pressing `w`.
  return window.location.origin;
};

export const getPasswordResetRedirectUrl = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/reset-password`;
};

export async function syncUserProfile(user: User) {
  const supabase = getSupabase();
  if (!supabase) return;

  const metadata = user.user_metadata ?? {};
  const provider =
    stringFromMetadata(user.app_metadata?.provider) ??
    stringFromMetadata(user.identities?.[0]?.provider) ??
    'email';
  const fullName =
    stringFromMetadata(metadata.full_name) ??
    stringFromMetadata(metadata.name) ??
    stringFromMetadata(metadata.display_name) ??
    user.email ??
    'User';
  const avatarUrl = stringFromMetadata(metadata.avatar_url) ?? stringFromMetadata(metadata.picture);

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      display_name: fullName,
      avatar_url: avatarUrl,
      provider,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.warn('Could not sync user profile:', error.message);
  }
}

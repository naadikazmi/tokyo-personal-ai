import type { PermissionKey, PermissionRow, PermissionSettings } from '../types/app';
import {
  applyLocalEmergencyLock,
  defaultPermissionSettings,
  getLocalPermissionSettings,
  isDemoUserId,
  permissionDefinitions,
  saveLocalPermissionSettings,
  updateLocalPermissionSetting,
} from './localDemo';
import { getSupabase, isSupabaseConfigured } from './supabase';

export type { PermissionKey };

export const riskyPermissionKeys: PermissionKey[] = [
  'open_apps',
  'open_websites',
  'file_read_access',
  'file_write_access',
  'clipboard_helper',
  'browser_automation',
  'device_control_placeholder',
  'system_command_access',
  'full_device_control',
];

function normalizeSettings(rows: PermissionRow[] | null | undefined): PermissionSettings {
  const settings = { ...defaultPermissionSettings };
  for (const row of rows ?? []) {
    if (row.permission_key in settings) {
      settings[row.permission_key] = Boolean(row.enabled);
    }
  }
  return settings;
}

function rowsFromSettings(userId: string, settings: PermissionSettings) {
  return permissionDefinitions.map((definition) => ({
    user_id: userId,
    permission_key: definition.key,
    enabled: settings[definition.key],
    risk_level: definition.risk_level,
  }));
}

export async function getEffectivePermissionSettings(userId: string): Promise<PermissionSettings> {
  if (!isSupabaseConfigured || isDemoUserId(userId)) {
    return getLocalPermissionSettings(userId);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return getLocalPermissionSettings(userId);
  }

  const { data, error } = await supabase.from('permissions').select('*').eq('user_id', userId);
  if (error) {
    console.error('Could not load Supabase permissions. Using local fallback.', error);
    return getLocalPermissionSettings(userId);
  }

  if (data && data.length > 0) {
    const settings = normalizeSettings(data as PermissionRow[]);
    await saveLocalPermissionSettings(userId, settings);
    return settings;
  }

  const { error: insertError } = await supabase.from('permissions').insert(rowsFromSettings(userId, defaultPermissionSettings));
  if (insertError) {
    console.error('Could not create Supabase permission rows. Using local fallback.', insertError);
    return getLocalPermissionSettings(userId);
  }

  await saveLocalPermissionSettings(userId, defaultPermissionSettings);
  return defaultPermissionSettings;
}

export async function updateEffectivePermissionSetting(
  userId: string,
  settings: PermissionSettings,
  key: PermissionKey,
  value: boolean,
) {
  const optimistic = { ...settings, [key]: value };

  if (!isSupabaseConfigured || isDemoUserId(userId)) {
    return updateLocalPermissionSetting(userId, key, value);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return updateLocalPermissionSetting(userId, key, value);
  }

  const definition = permissionDefinitions.find((item) => item.key === key);
  const { error } = await supabase.from('permissions').upsert(
    {
      user_id: userId,
      permission_key: key,
      enabled: value,
      risk_level: definition?.risk_level ?? 'high',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,permission_key' },
  );

  if (error) {
    console.error('Could not update Supabase permission. Using local fallback.', error);
    return updateLocalPermissionSetting(userId, key, value);
  }

  await saveLocalPermissionSettings(userId, optimistic);
  return optimistic;
}

export async function applyEmergencyLockPermissions(userId: string, locked: boolean) {
  const localSettings = await applyLocalEmergencyLock(userId, locked);

  if (!locked || !isSupabaseConfigured || isDemoUserId(userId)) {
    return localSettings;
  }

  const supabase = getSupabase();
  if (!supabase) {
    return localSettings;
  }

  const existing = await getEffectivePermissionSettings(userId);
  const lockedSettings = { ...existing };
  for (const key of riskyPermissionKeys) {
    lockedSettings[key] = false;
  }

  const { error } = await supabase.from('permissions').upsert(rowsFromSettings(userId, lockedSettings), {
    onConflict: 'user_id,permission_key',
  });

  if (error) {
    console.error('Could not apply Supabase emergency lock permissions.', error);
  }

  await saveLocalPermissionSettings(userId, lockedSettings);
  return lockedSettings;
}

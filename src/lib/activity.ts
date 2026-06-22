import { addLocalActivityLog, isDemoUserId } from './localDemo';
import { getSupabase } from './supabase';
import { isSupabaseConfigured } from './supabase';

export async function logActivity(
  userId: string,
  actionType: string,
  detail?: string,
  metadata?: Record<string, unknown>,
) {
  if (!isSupabaseConfigured || isDemoUserId(userId)) {
    await addLocalActivityLog(userId, actionType, detail, metadata);
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    await addLocalActivityLog(userId, actionType, detail, metadata);
    return;
  }
  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    action_type: actionType,
    detail: detail ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    console.error('Unable to write Supabase activity log. Falling back to local log.', error);
    await addLocalActivityLog(userId, actionType, detail, { ...metadata, supabase_error: error.message });
  }
}

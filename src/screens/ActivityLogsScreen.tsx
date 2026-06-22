import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { confirmAction } from '../lib/dialogs';
import { clearLocalActivityLogs, getLocalActivityLogs, isDemoUserId } from '../lib/localDemo';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, spacing } from '../lib/theme';
import type { ActivityLog } from '../types/app';

type Props = {
  userId: string;
};

export function ActivityLogsScreen({ userId }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'actions' | 'success' | 'failure' | 'risk'>('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [mode, setMode] = useState<'Supabase' | 'Local'>('Local');

  const loadLogs = async () => {
    if (!isSupabaseConfigured || isDemoUserId(userId)) {
      setMode('Local');
      setLogs(await getLocalActivityLogs(userId));
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setMode('Local');
      setLogs(await getLocalActivityLogs(userId));
      return;
    }
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Could not load Supabase activity logs:', error);
      setMode('Local');
      setErrorMessage(`Local mode active: ${error.message}`);
      setLogs(await getLocalActivityLogs(userId));
      return;
    }
    setMode('Supabase');
    setErrorMessage('');
    setLogs((data ?? []) as ActivityLog[]);
  };

  useEffect(() => {
    loadLogs();
  }, [userId]);

  const refresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      const metadata = JSON.stringify(log.metadata ?? {});
      const haystack = `${log.action_type} ${log.detail ?? ''} ${metadata}`;
      const matchesSearch = !query || haystack.toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (filter === 'actions') return log.action_type.includes('action') || log.action_type.includes('workspace');
      if (filter === 'success') return /completed|created|saved|opened|generated|added|updated/.test(log.action_type);
      if (filter === 'failure') return /failed|blocked|error/.test(log.action_type);
      if (filter === 'risk') return Boolean((log.metadata as { risk_level?: unknown } | null)?.risk_level);
      return true;
    });
  }, [filter, logs, search]);

  const clearLogs = async () => {
    const confirmed = await confirmAction('Clear activity logs?', 'This removes the activity history for this account.', 'Clear');
    if (!confirmed) return;

    if (!isSupabaseConfigured || isDemoUserId(userId) || mode === 'Local') {
      await clearLocalActivityLogs(userId);
      setLogs([]);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      await clearLocalActivityLogs(userId);
      setLogs([]);
      return;
    }

    const { error } = await supabase.from('activity_logs').delete().eq('user_id', userId);
    if (error) {
      console.error('Could not clear Supabase activity logs:', error);
      setErrorMessage(error.message);
      return;
    }
    setLogs([]);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.heading}>Activity logs</Text>
      <Text style={styles.help}>Recent assistant activity for this account. Mode: {mode}.</Text>
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
      <View style={styles.controls}>
        <TextInput
          placeholder="Search logs"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.input}
        />
        <View style={styles.filters}>
          {(['all', 'actions', 'success', 'failure', 'risk'] as const).map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.activeFilter]}>
              <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton tone="neutral" title="Clear logs" onPress={clearLogs} />
      </View>
      {filteredLogs.length === 0 ? <Text style={styles.empty}>No activity yet.</Text> : null}
      {filteredLogs.map((log) => (
        <View key={log.id} style={styles.card}>
          <Text style={styles.action}>{log.action_type}</Text>
          {log.detail ? <Text style={styles.details}>{log.detail}</Text> : null}
          {(log.metadata as { risk_level?: string } | null)?.risk_level ? (
            <Text style={styles.risk}>Risk: {(log.metadata as { risk_level?: string }).risk_level}</Text>
          ) : null}
          <Text style={styles.date}>{new Date(log.created_at).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  help: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    color: colors.muted,
  },
  errorBanner: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  errorText: {
    color: colors.warning,
    fontWeight: '800',
    lineHeight: 20,
  },
  controls: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeFilter: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  activeFilterText: {
    color: colors.text,
  },
  empty: {
    color: colors.muted,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  action: {
    color: colors.text,
    fontWeight: '800',
  },
  details: {
    marginTop: spacing.xs,
    color: colors.text,
  },
  risk: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  date: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 12,
  },
});

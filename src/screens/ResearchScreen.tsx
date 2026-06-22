import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { runResearchApi } from '../lib/api';
import { logActivity } from '../lib/activity';
import { confirmAction, notifyUser } from '../lib/dialogs';
import { clearLocalResearchHistory, getLocalResearchHistory, saveLocalResearchReport } from '../lib/localDemo';
import { getEffectivePermissionSettings } from '../lib/permissions';
import { classifySafetyIntent } from '../lib/safety';
import { colors, spacing } from '../lib/theme';
import type { ResearchReport } from '../types/app';

type Props = {
  emergencyLocked: boolean;
  userId: string;
};

export function ResearchScreen({ emergencyLocked, userId }: Props) {
  const [topic, setTopic] = useState('');
  const [researchAllowed, setResearchAllowed] = useState(true);
  const [activeReport, setActiveReport] = useState<ResearchReport | null>(null);
  const [history, setHistory] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    load();
  }, [userId]);

  const load = async () => {
    const permissions = await getEffectivePermissionSettings(userId);
    setResearchAllowed(permissions.research_only);
    const reports = await getLocalResearchHistory(userId);
    setHistory(reports);
    setActiveReport(reports[0] ?? null);
  };

  const runResearch = async () => {
    if (!topic.trim()) {
      notifyUser('Topic required', 'Enter a topic for Tokyo to research.');
      return;
    }
    if (emergencyLocked || !researchAllowed) {
      notifyUser('Research unavailable', emergencyLocked ? 'Emergency lock is active.' : 'Research access is off.');
      return;
    }
    const safety = classifySafetyIntent(topic.trim());

    setLoading(true);
    setErrorMessage('');
    try {
      const { report } = await runResearchApi(userId, topic.trim());
      await saveLocalResearchReport(userId, report);
      setActiveReport(report);
      setTopic('');
      await load();
      logActivity(userId, safety.blocked || safety.educationalReply ? 'safety_filtered_research' : 'research_request', report.query, { source_count: report.sources.length, reason: safety.reason });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Research failed. Check backend logs.';
      console.error('Research request failed:', error);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    const confirmed = await confirmAction('Clear research history?', 'This removes local research history on this device.', 'Clear');
    if (!confirmed) return;
    await clearLocalResearchHistory(userId);
    setHistory([]);
    setActiveReport(null);
    logActivity(userId, 'research_history_cleared');
  };

  return (
    <Screen>
      <Text style={styles.heading}>Research Mode</Text>
      <Text style={styles.help}>
        Research works in offline outline mode without keys. Add OpenAI plus a search provider later for live,
        source-grounded synthesis. Offline mode never invents live source links.
      </Text>
      {errorMessage ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>{errorMessage}</Text>
        </View>
      ) : null}
      {!researchAllowed || emergencyLocked ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {emergencyLocked ? 'Emergency lock is active.' : 'Research permission is turned off.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.form}>
        <TextInput
          placeholder="Research topic"
          placeholderTextColor={colors.muted}
          value={topic}
          onChangeText={setTopic}
          style={styles.input}
        />
        <PrimaryButton disabled={loading} title={loading ? 'Researching...' : 'Run research'} onPress={runResearch} />
        <PrimaryButton tone="neutral" title="Clear history" onPress={clearHistory} />
      </View>

      {activeReport ? <ResearchCard report={activeReport} /> : <Text style={styles.empty}>No research history yet.</Text>}

      <Text style={styles.sectionTitle}>History</Text>
      {history.map((report) => (
        <View key={report.id} style={styles.historyCard}>
          <Text style={styles.historyTitle}>{report.query}</Text>
          <Text style={styles.historyDate}>{new Date(report.created_at).toLocaleString()}</Text>
        </View>
      ))}
    </Screen>
  );
}

function ResearchCard({ report }: { report: ResearchReport }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{report.query}</Text>
      <Text style={styles.label}>Short summary</Text>
      <Text style={styles.text}>{report.result.short_summary}</Text>
      <List title="Key points" items={report.result.key_points} />
      <List title="Pros" items={report.result.pros} />
      <List title="Cons" items={report.result.cons} />
      <Text style={styles.label}>Recommendation</Text>
      <Text style={styles.text}>{report.result.recommendation}</Text>
      <Text style={styles.label}>Confidence level</Text>
      <Text style={styles.text}>{report.confidence}</Text>
      <Text style={styles.label}>Source links</Text>
      {report.sources.length === 0 ? <Text style={styles.text}>No live sources in offline mode.</Text> : null}
      {report.sources.map((source) => (
        <Text key={source.url} style={styles.text}>
          - {source.title}: {source.url}
        </Text>
      ))}
    </View>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.list}>
      <Text style={styles.label}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.text}>
          - {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  help: {
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  warning: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  warningText: {
    color: colors.warning,
    fontWeight: '800',
    lineHeight: 20,
  },
  form: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  card: {
    padding: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  text: {
    color: colors.text,
    lineHeight: 21,
  },
  list: {
    marginTop: spacing.sm,
  },
  empty: {
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  historyCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  historyTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  historyDate: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 12,
  },
});

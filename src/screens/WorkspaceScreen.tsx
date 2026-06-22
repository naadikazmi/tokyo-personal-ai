import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { executeBackendAction, getBackendActionStatus } from '../lib/api';
import { logActivity } from '../lib/activity';
import { confirmAction, notifyUser } from '../lib/dialogs';
import { getLocalUserSettings, saveLocalUserSettings } from '../lib/localDemo';
import { getEffectivePermissionSettings } from '../lib/permissions';
import { colors, spacing } from '../lib/theme';
import type { PermissionSettings, UserSettings } from '../types/app';

type Props = {
  emergencyLocked: boolean;
  userId: string;
};

type FileResult = {
  name: string;
  path: string;
  type: string;
};

export function WorkspaceScreen({ emergencyLocked, userId }: Props) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [permissions, setPermissions] = useState<PermissionSettings | null>(null);
  const [defaultWorkspace, setDefaultWorkspace] = useState('');
  const [workspaceFolder, setWorkspaceFolder] = useState('');
  const [search, setSearch] = useState('');
  const [fileName, setFileName] = useState('tokyo-note.txt');
  const [fileContent, setFileContent] = useState('');
  const [results, setResults] = useState<FileResult[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void load();
  }, [userId]);

  const load = async () => {
    const [nextSettings, nextPermissions] = await Promise.all([
      getLocalUserSettings(userId),
      getEffectivePermissionSettings(userId),
    ]);
    setSettings(nextSettings);
    setPermissions(nextPermissions);
    setWorkspaceFolder(nextSettings.safe_workspace_folder || '');
    try {
      const status = await getBackendActionStatus();
      setDefaultWorkspace(status.safeWorkspace);
    } catch {
      setDefaultWorkspace('Documents\\Tokyo Personal AI Workspace');
    }
  };

  const activeFolder = workspaceFolder.trim();
  const workspaceMissing = !activeFolder;
  const fileReadBlocked = emergencyLocked || workspaceMissing || !permissions?.file_read_access;
  const fileWriteBlocked = emergencyLocked || workspaceMissing || !permissions?.file_write_access;

  const saveWorkspace = async () => {
    if (!settings) return;
    if (!workspaceFolder.trim()) {
      notifyUser('Workspace folder required', 'Set a safe folder before Tokyo can search, open, or create files.');
      return;
    }
    const nextSettings = await saveLocalUserSettings(userId, {
      display_name: settings.display_name,
      assistant_name: settings.assistant_name,
      tone: settings.tone,
      assistant_style: settings.assistant_style,
      avatar_visible: settings.avatar_visible,
      avatar_animation: settings.avatar_animation,
      voice_mode_placeholder: settings.voice_mode_placeholder,
      theme_mode: settings.theme_mode,
      safe_workspace_folder: workspaceFolder.trim(),
    });
    setSettings(nextSettings);
    await logActivity(userId, 'workspace_folder_saved', workspaceFolder.trim());
    notifyUser('Workspace saved', `Tokyo will only use: ${workspaceFolder.trim()}`);
  };

  const chooseFolder = async () => {
    if (!window.tokyoDesktop?.chooseFolder) {
      notifyUser('Desktop picker unavailable', 'Folder picker is available in the Electron desktop app. Use manual path input in browser mode.');
      return;
    }
    const result = await window.tokyoDesktop.chooseFolder();
    if (!result.canceled && result.path) {
      setWorkspaceFolder(result.path);
    }
  };

  const testAccess = async () => {
    if (workspaceMissing) {
      notifyUser('Workspace folder required', 'Save or enter a safe folder first.');
      return;
    }
    const result = await executeBackendAction('test_workspace', { safeFolder: workspaceFolder.trim() });
    setNotice(result.message);
    await logActivity(userId, result.ok ? 'workspace_test_completed' : 'workspace_test_failed', result.message);
  };

  const listFiles = async () => {
    if (fileReadBlocked) {
      notifyUser('File preview blocked', workspaceMissing ? 'Set a safe workspace folder first.' : 'Enable File workspace read permission first.');
      return;
    }
    const result = await executeBackendAction('list_files', { safeFolder: workspaceFolder.trim() });
    setResults(Array.isArray(result.data?.results) ? (result.data.results as FileResult[]) : []);
    setNotice(result.message);
    await logActivity(userId, 'workspace_preview_loaded', result.message, { risk_level: 'high' });
  };

  const searchFiles = async () => {
    if (fileReadBlocked) {
      notifyUser(
        'File search blocked',
        emergencyLocked
          ? 'Emergency Lock is active.'
          : workspaceMissing
            ? 'Set a safe workspace folder first.'
            : 'Enable File workspace read in Permissions first.',
      );
      return;
    }
    if (!search.trim()) {
      notifyUser('Search required', 'Enter part of a filename.');
      return;
    }
    const confirmed = await confirmAction('Search safe workspace?', `Search filenames inside ${activeFolder}?`, 'Search');
    if (!confirmed) {
      await logActivity(userId, 'action_cancelled', 'Workspace filename search cancelled', { risk_level: 'high' });
      return;
    }
    const result = await executeBackendAction('search_files', {
      query: search.trim(),
      safeFolder: workspaceFolder.trim(),
    });
    const nextResults = Array.isArray(result.data?.results) ? (result.data.results as FileResult[]) : [];
    setResults(nextResults);
    setNotice(result.message);
    await logActivity(userId, result.ok ? 'workspace_search_completed' : 'workspace_search_failed', result.message, {
      risk_level: 'high',
    });
  };

  const openWorkspace = async () => {
    if (fileReadBlocked) {
      notifyUser(
        'Open workspace blocked',
        emergencyLocked
          ? 'Emergency Lock is active.'
          : workspaceMissing
            ? 'Set a safe workspace folder first.'
            : 'Enable File workspace read in Permissions first.',
      );
      return;
    }
    const confirmed = await confirmAction('Open safe workspace?', `Open ${activeFolder} in File Explorer?`, 'Open');
    if (!confirmed) {
      await logActivity(userId, 'action_cancelled', 'Open workspace cancelled', { risk_level: 'high' });
      return;
    }
    const result = await executeBackendAction('open_path', { target: '.', safeFolder: workspaceFolder.trim() });
    setNotice(result.message);
    await logActivity(userId, result.ok ? 'workspace_opened' : 'workspace_open_failed', result.message, { risk_level: 'high' });
  };

  const createTextFile = async () => {
    if (fileWriteBlocked) {
      notifyUser(
        'File creation blocked',
        emergencyLocked
          ? 'Emergency Lock is active.'
          : workspaceMissing
            ? 'Set a safe workspace folder first.'
            : 'Enable File workspace write in Permissions first.',
      );
      return;
    }
    if (!fileName.trim()) {
      notifyUser('Filename required', 'Enter a filename like notes.txt.');
      return;
    }
    const confirmed = await confirmAction('Create text file?', `Create ${fileName.trim()} inside ${activeFolder}?`, 'Create');
    if (!confirmed) {
      await logActivity(userId, 'action_cancelled', 'Create text file cancelled', { risk_level: 'critical' });
      return;
    }
    const result = await executeBackendAction('create_text_file', {
      filename: fileName.trim(),
      content: fileContent,
      safeFolder: workspaceFolder.trim(),
    });
    setNotice(result.message);
    await logActivity(userId, result.ok ? 'workspace_file_created' : 'workspace_file_failed', result.message, {
      risk_level: 'critical',
    });
  };

  const openResult = async (item: FileResult) => {
    if (fileReadBlocked) return;
    const relative = item.path.startsWith(activeFolder) ? item.path.slice(activeFolder.length).replace(/^[/\\]+/, '') : item.name;
    const confirmed = await confirmAction('Open workspace item?', `Open ${item.name}?`, 'Open');
    if (!confirmed) return;
    const result = await executeBackendAction('open_path', { target: relative, safeFolder: workspaceFolder.trim() });
    setNotice(result.message);
    await logActivity(userId, result.ok ? 'workspace_item_opened' : 'workspace_item_open_failed', result.message, {
      risk_level: 'high',
    });
  };

  return (
    <Screen>
      <Text style={styles.heading}>File Workspace</Text>
      <Text style={styles.help}>
        Tokyo only accesses one safe folder. It searches filenames, opens approved paths, and creates text files after confirmation.
      </Text>
      {emergencyLocked ? <Text style={styles.warning}>Emergency Lock is active. Workspace actions are disabled.</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Safe workspace folder</Text>
        <Text style={styles.meta}>Suggested folder: {defaultWorkspace || 'Loading suggested workspace...'}</Text>
        <TextInput
          placeholder="Optional full folder path"
          placeholderTextColor={colors.muted}
          value={workspaceFolder}
          onChangeText={setWorkspaceFolder}
          style={styles.input}
        />
        <View style={styles.actions}>
          <PrimaryButton tone="neutral" title="Choose folder" onPress={chooseFolder} />
          <PrimaryButton title="Save workspace" onPress={saveWorkspace} />
          <PrimaryButton tone="neutral" title="Use suggested folder" onPress={() => setWorkspaceFolder(defaultWorkspace)} />
          <PrimaryButton tone="neutral" title="Test access" onPress={testAccess} />
          <PrimaryButton tone="neutral" title="Preview files" onPress={listFiles} />
          <PrimaryButton tone="neutral" title="Open workspace" onPress={openWorkspace} />
        </View>
        {workspaceMissing ? <Text style={styles.warning}>File actions stay disabled until you save a safe workspace folder.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search filenames</Text>
        <TextInput
          placeholder="Filename contains..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.input}
        />
        <PrimaryButton disabled={fileReadBlocked} title="Search safe folder" onPress={searchFiles} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create text file</Text>
        <TextInput
          placeholder="notes.txt"
          placeholderTextColor={colors.muted}
          value={fileName}
          onChangeText={setFileName}
          style={styles.input}
        />
        <TextInput
          multiline
          placeholder="Text file content"
          placeholderTextColor={colors.muted}
          value={fileContent}
          onChangeText={setFileContent}
          style={[styles.input, styles.textArea]}
        />
        <PrimaryButton disabled={fileWriteBlocked} title="Create after approval" onPress={createTextFile} />
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Text style={styles.sectionTitle}>Recent file results</Text>
      {results.length === 0 ? <Text style={styles.empty}>No file results yet.</Text> : null}
      {results.map((item) => (
        <View key={item.path} style={styles.resultCard}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.meta}>{item.type} | {item.path}</Text>
          <PrimaryButton tone="neutral" title="Open after approval" onPress={() => openResult(item)} />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  help: {
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  warning: {
    color: colors.warning,
    marginBottom: spacing.md,
    fontWeight: '900',
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    lineHeight: 19,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.background,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  notice: {
    color: colors.primary,
    marginBottom: spacing.md,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  empty: {
    color: colors.muted,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  resultCard: {
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});

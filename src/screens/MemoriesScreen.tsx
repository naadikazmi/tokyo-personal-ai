import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { logActivity } from '../lib/activity';
import { confirmAction, notifyUser } from '../lib/dialogs';
import { deleteLocalMemory, deleteLocalNote, getLocalMemories, getLocalNotes, isDemoUserId, saveLocalMemory, toggleLocalMemory } from '../lib/localDemo';
import { getEffectivePermissionSettings } from '../lib/permissions';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, spacing } from '../lib/theme';
import type { LocalNote, Memory } from '../types/app';

type Props = {
  userId: string;
};

export function MemoriesScreen({ userId }: Props) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [source, setSource] = useState('manual');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [memoryAllowed, setMemoryAllowed] = useState(true);
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'Supabase' | 'Local'>('Local');

  const loadMemories = async () => {
    const permissions = await getEffectivePermissionSettings(userId);
    setMemoryAllowed(permissions.memory_access);

    if (!isSupabaseConfigured || isDemoUserId(userId)) {
      setMode('Local');
      setNotice('Local memory mode active — cloud sync is optional. Connect Supabase later to sync across devices.');
      setMemories(await getLocalMemories(userId));
      setNotes(await getLocalNotes(userId));
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setMode('Local');
      setMemories(await getLocalMemories(userId));
      setNotes(await getLocalNotes(userId));
      return;
    }
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Could not load Supabase memories:', error);
      setMode('Local');
      setNotice('Local memory mode active — cloud sync is optional. Connect Supabase later to sync across devices.');
      setMemories(await getLocalMemories(userId));
      setNotes(await getLocalNotes(userId));
      return;
    }
    setMode('Supabase');
    setNotice('');
    setMemories((data ?? []) as Memory[]);
    setNotes(await getLocalNotes(userId));
  };

  useEffect(() => {
    loadMemories();
  }, [userId]);

  const filteredMemories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return memories.filter((memory) => {
      const haystack = [memory.title, memory.content, memory.source ?? '', ...(memory.tags ?? [])].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [memories, search]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes.filter((note) => {
      const haystack = [note.title, note.content, note.source].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [notes, search]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setTags('');
    setSource('manual');
  };

  const payloadFromForm = () => ({
    user_id: userId,
    title: title.trim(),
    content: content.trim(),
    tags: tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    source: source.trim() || 'manual',
  });

  const saveMemory = async () => {
    if (!title.trim() || !content.trim()) {
      notifyUser('Missing details', 'Add a title and memory content.');
      return;
    }

    setLoading(true);
    const payload = payloadFromForm();

    if (!isSupabaseConfigured || isDemoUserId(userId)) {
      await saveLocalMemory(userId, payload, editingId ?? undefined);
      setMode('Local');
      setLoading(false);
      logActivity(userId, editingId ? 'memory_updated' : 'memory_created', title.trim());
      resetForm();
      loadMemories();
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      await saveLocalMemory(userId, payload, editingId ?? undefined);
      setMode('Local');
      setLoading(false);
      resetForm();
      loadMemories();
      return;
    }
    const { error } = editingId
      ? await supabase.from('memories').update(payload).eq('id', editingId)
      : await supabase.from('memories').insert(payload);
    setLoading(false);

    if (error) {
      console.error('Could not save Supabase memory:', error);
      await saveLocalMemory(userId, payload, editingId ?? undefined);
      setMode('Local');
      setNotice('Saved locally because Supabase memories are unavailable. Use Sync local memories after fixing Supabase.');
    } else {
      setMode('Supabase');
      setNotice('');
    }

    logActivity(userId, editingId ? 'memory_updated' : 'memory_created', title.trim());
    resetForm();
    loadMemories();
  };

  const editMemory = (memory: Memory) => {
    setEditingId(memory.id);
    setTitle(memory.title);
    setContent(memory.content);
    setTags((memory.tags ?? []).join(', '));
    setSource(memory.source ?? 'manual');
  };

  const deleteMemory = async (memory: Memory) => {
    const confirmed = await confirmAction('Delete memory?', `Remove "${memory.title}" from saved memories?`, 'Delete');
    if (!confirmed) return;

    if (!isSupabaseConfigured || isDemoUserId(userId) || mode === 'Local') {
      await deleteLocalMemory(userId, memory.id);
      logActivity(userId, 'memory_deleted', memory.title);
      loadMemories();
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      await deleteLocalMemory(userId, memory.id);
      loadMemories();
      return;
    }
    const { error } = await supabase.from('memories').delete().eq('id', memory.id);
    if (error) {
      console.error('Could not delete Supabase memory:', error);
      setNotice('Delete failed in Supabase. No fake success was applied.');
      return;
    }

    logActivity(userId, 'memory_deleted', memory.title);
    loadMemories();
  };

  const toggleMemory = async (memory: Memory) => {
    if (mode !== 'Local') {
      setNotice('Memory enable/disable is currently local-only. Edit or delete Supabase memories from this screen.');
      return;
    }
    await toggleLocalMemory(userId, memory.id);
    logActivity(userId, 'memory_toggled', `${memory.title}: ${memory.enabled === false ? 'enabled' : 'disabled'}`);
    loadMemories();
  };

  const deleteNote = async (note: LocalNote) => {
    const confirmed = await confirmAction('Delete note?', `Remove "${note.title}" from local notes?`, 'Delete');
    if (!confirmed) return;
    await deleteLocalNote(userId, note.id);
    logActivity(userId, 'note_deleted', note.title);
    loadMemories();
  };

  const syncLocalMemories = async () => {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured || isDemoUserId(userId)) {
      setNotice('Supabase is not connected. Sync cannot run yet.');
      return;
    }
    const local = await getLocalMemories(userId);
    if (local.length === 0) {
      setNotice('No local memories to sync.');
      return;
    }
    const { error } = await supabase.from('memories').upsert(
      local.map((memory) => ({
        user_id: userId,
        title: memory.title,
        content: memory.content,
        tags: memory.tags,
        source: memory.source ?? 'local',
      })),
    );
    if (error) {
      console.error('Memory sync failed:', error);
      setNotice(`Sync failed: ${error.message}`);
      return;
    }
    setNotice('Local memories synced to Supabase.');
    logActivity(userId, 'memory_sync_completed', `${local.length} memories`);
    loadMemories();
  };

  return (
    <Screen>
      <Text style={styles.heading}>Memory Manager</Text>
      <Text style={styles.help}>Memory mode: {mode}. Chat can only use memories when Memory access is enabled.</Text>
      {!memoryAllowed ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>Memory permission is off. Chat will not use memories until access is enabled.</Text>
        </View>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.form}>
        <TextInput
          placeholder="Search memories"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.input}
        />
        <TextInput
          placeholder="Title"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          multiline
          placeholder="Memory content"
          placeholderTextColor={colors.muted}
          value={content}
          onChangeText={setContent}
          style={[styles.input, styles.textArea]}
        />
        <TextInput
          placeholder="Tags, comma separated"
          placeholderTextColor={colors.muted}
          value={tags}
          onChangeText={setTags}
          style={styles.input}
        />
        <TextInput
          placeholder="Source"
          placeholderTextColor={colors.muted}
          value={source}
          onChangeText={setSource}
          style={styles.input}
        />
        <PrimaryButton disabled={loading} title={editingId ? 'Update memory' : 'Add memory'} onPress={saveMemory} />
        {editingId ? <PrimaryButton tone="neutral" title="Cancel edit" onPress={resetForm} /> : null}
        {mode === 'Local' && isSupabaseConfigured && !isDemoUserId(userId) ? <PrimaryButton tone="neutral" title="Sync local memories to Supabase" onPress={syncLocalMemories} /> : null}
      </View>

      {filteredMemories.length === 0 ? (
        <Text style={styles.empty}>
          {search.trim() ? 'No memories match your search.' : 'No memories yet. Add one above when you want the AI to remember something.'}
        </Text>
      ) : null}

      {filteredMemories.map((memory) => (
        <View key={memory.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{memory.title}</Text>
              <Text style={styles.meta}>
                {(memory.tags ?? []).join(', ') || 'No tags'} | Source: {memory.source ?? 'manual'} | {memory.enabled === false ? 'Inactive' : 'Active'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardText}>{memory.content}</Text>
          <View style={styles.actions}>
            <PrimaryButton tone="neutral" title="Edit" onPress={() => editMemory(memory)} />
            <PrimaryButton tone="neutral" title={memory.enabled === false ? 'Enable' : 'Disable'} onPress={() => toggleMemory(memory)} />
            <PrimaryButton tone="danger" title="Delete" onPress={() => deleteMemory(memory)} />
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Local notes</Text>
      {filteredNotes.length === 0 ? (
        <Text style={styles.empty}>
          {search.trim() ? 'No notes match your search.' : 'No notes yet. Chat can create notes with “create a note that ...”.'}
        </Text>
      ) : null}
      {filteredNotes.map((note) => (
        <View key={note.id} style={styles.card}>
          <Text style={styles.cardTitle}>{note.title}</Text>
          <Text style={styles.meta}>Source: {note.source} | {new Date(note.created_at).toLocaleString()}</Text>
          <Text style={styles.cardText}>{note.content}</Text>
          <View style={styles.actions}>
            <PrimaryButton tone="danger" title="Delete" onPress={() => deleteNote(note)} />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  help: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    color: colors.muted,
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
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
  },
  cardText: {
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  empty: {
    color: colors.muted,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  warning: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  warningText: {
    color: colors.warning,
    fontWeight: '800',
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  notice: {
    color: colors.warning,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});

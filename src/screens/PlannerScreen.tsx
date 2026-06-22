import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { logActivity } from '../lib/activity';
import { confirmAction, notifyUser } from '../lib/dialogs';
import {
  deleteLocalPlannerTask,
  getLocalMemories,
  getLocalPlannerTasks,
  saveLocalPlannerTask,
  toggleLocalPlannerTask,
} from '../lib/localDemo';
import { colors, spacing } from '../lib/theme';
import type { PlannerTask } from '../types/app';

type Props = {
  userId: string;
};

const priorities: PlannerTask['priority'][] = ['low', 'medium', 'high'];

export function PlannerScreen({ userId }: Props) {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<PlannerTask['priority']>('medium');
  const [deadline, setDeadline] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'completed' | 'high' | 'overdue'>('all');

  useEffect(() => {
    loadTasks();
  }, [userId]);

  const loadTasks = async () => {
    setTasks(await getLocalPlannerTasks(userId));
  };

  const remainingTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const visibleTasks = useMemo(() => {
    if (filter === 'today') return tasks.filter((task) => !task.completed && isTodayTask(task));
    if (filter === 'upcoming') return tasks.filter((task) => !task.completed && !isOverdueTask(task));
    if (filter === 'completed') return tasks.filter((task) => task.completed);
    if (filter === 'high') return tasks.filter((task) => !task.completed && task.priority === 'high');
    if (filter === 'overdue') return tasks.filter((task) => !task.completed && isOverdueTask(task));
    return tasks;
  }, [filter, tasks]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setNotes('');
    setPriority('medium');
    setDeadline('');
  };

  const saveTask = async () => {
    if (!title.trim()) {
      notifyUser('Task required', 'Add a task title.');
      return;
    }

    await saveLocalPlannerTask(
      userId,
      { title: title.trim(), notes: notes.trim(), priority, deadline: deadline.trim() },
      editingId ?? undefined,
    );
    logActivity(userId, editingId ? 'Planner task edited' : 'Planner task created', title.trim());
    resetForm();
    loadTasks();
  };

  const editTask = (task: PlannerTask) => {
    setEditingId(task.id);
    setTitle(task.title);
    setNotes(task.notes);
    setPriority(task.priority);
    setDeadline(task.deadline);
  };

  const toggleTask = async (task: PlannerTask) => {
    await toggleLocalPlannerTask(userId, task.id);
    logActivity(userId, 'Planner task created/completed', `${task.title}: ${task.completed ? 'reopened' : 'completed'}`);
    loadTasks();
  };

  const deleteTask = async (task: PlannerTask) => {
    const confirmed = await confirmAction('Delete task?', `Remove "${task.title}" from the planner?`, 'Delete');
    if (!confirmed) return;
    await deleteLocalPlannerTask(userId, task.id);
    logActivity(userId, 'Planner task deleted', task.title);
    loadTasks();
  };

  const suggestPlan = async () => {
    const memories = await getLocalMemories(userId);
    const high = remainingTasks.filter((task) => task.priority === 'high');
    const medium = remainingTasks.filter((task) => task.priority === 'medium');
    const low = remainingTasks.filter((task) => task.priority === 'low');
    setSuggestion(
      [
        'Tokyo daily plan suggestion:',
        high.length ? `1. Start with high priority: ${high.map((task) => task.title).join(', ')}.` : '1. Pick one important task and finish it first.',
        medium.length ? `2. Batch medium tasks: ${medium.map((task) => task.title).join(', ')}.` : '2. Use a short study or admin block.',
        low.length ? `3. Keep low priority tasks for later: ${low.map((task) => task.title).join(', ')}.` : '3. Leave buffer time for unexpected work.',
        memories.length ? `Memory hint: you have ${memories.length} saved memories that may help refine this later.` : 'Add memories for more personal planning suggestions.',
      ].join('\n'),
    );
    logActivity(userId, 'Daily plan suggested', remainingTasks.length ? `${remainingTasks.length} open tasks` : 'No open tasks');
  };

  return (
    <Screen>
      <Text style={styles.heading}>Daily Planner</Text>
      <Text style={styles.help}>Plan your day locally. Tokyo can suggest a simple schedule from saved tasks.</Text>

      <View style={styles.form}>
        <TextInput
          placeholder="Task title"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Notes"
          placeholderTextColor={colors.muted}
          value={notes}
          onChangeText={setNotes}
          style={styles.input}
        />
        <TextInput
          placeholder="Deadline, e.g. Today 6 PM or 2026-06-15"
          placeholderTextColor={colors.muted}
          value={deadline}
          onChangeText={setDeadline}
          style={styles.input}
        />
        <View style={styles.priorityWrap}>
          {priorities.map((item) => (
            <Pressable
              key={item}
              onPress={() => setPriority(item)}
              style={[styles.priority, priority === item && styles.activePriority]}
            >
              <Text style={[styles.priorityText, priority === item && styles.activePriorityText]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton title={editingId ? 'Update task' : 'Add task'} onPress={saveTask} />
        {editingId ? <PrimaryButton tone="neutral" title="Cancel edit" onPress={resetForm} /> : null}
      </View>

      <PrimaryButton tone="neutral" title="Ask Tokyo to suggest daily plan" onPress={suggestPlan} />
      {suggestion ? <Text style={styles.suggestion}>{suggestion}</Text> : null}

      <View style={styles.filterRow}>
        {(['all', 'today', 'upcoming', 'completed', 'high', 'overdue'] as const).map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.activeFilter]}>
            <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Tasks</Text>
      {visibleTasks.length === 0 ? <Text style={styles.empty}>No tasks yet. Add your first task above.</Text> : null}
      {visibleTasks.map((task) => (
        <View key={task.id} style={[styles.card, task.completed && styles.completedCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{task.completed ? '[Done] ' : ''}{task.title}</Text>
            <Text style={[styles.priorityBadge, styles[task.priority]]}>{task.priority}</Text>
          </View>
          {task.notes ? <Text style={styles.cardText}>{task.notes}</Text> : null}
          {task.deadline ? <Text style={styles.meta}>Deadline: {task.deadline}</Text> : null}
          {!task.completed && isOverdueTask(task) ? <Text style={styles.overdue}>Overdue</Text> : null}
          <View style={styles.actions}>
            <PrimaryButton tone="neutral" title={task.completed ? 'Reopen' : 'Complete'} onPress={() => toggleTask(task)} />
            <PrimaryButton tone="neutral" title="Edit" onPress={() => editTask(task)} />
            <PrimaryButton tone="danger" title="Delete" onPress={() => deleteTask(task)} />
          </View>
        </View>
      ))}
    </Screen>
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
  priorityWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priority: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activePriority: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  priorityText: {
    color: colors.muted,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  activePriorityText: {
    color: '#FFFFFF',
  },
  suggestion: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    lineHeight: 22,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
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
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  filterText: {
    color: colors.muted,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  activeFilterText: {
    color: colors.text,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  completedCard: {
    opacity: 0.65,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontWeight: '800',
  },
  priorityBadge: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: '#FFFFFF',
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  low: {
    backgroundColor: colors.success,
  },
  medium: {
    backgroundColor: colors.warning,
  },
  high: {
    backgroundColor: colors.danger,
  },
  cardText: {
    color: colors.text,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  meta: {
    color: colors.muted,
    marginTop: spacing.sm,
  },
  overdue: {
    color: colors.danger,
    marginTop: spacing.sm,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  empty: {
    color: colors.muted,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});

function isTodayTask(task: PlannerTask) {
  const deadline = task.deadline.trim().toLowerCase();
  if (!deadline) return false;
  if (deadline.includes('today')) return true;
  const parsed = Date.parse(deadline);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toDateString() === new Date().toDateString();
}

function isOverdueTask(task: PlannerTask) {
  const deadline = task.deadline.trim().toLowerCase();
  if (!deadline || deadline.includes('today') || deadline.includes('tomorrow')) return false;
  const parsed = Date.parse(deadline);
  if (Number.isNaN(parsed)) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return parsed < endOfToday.getTime();
}

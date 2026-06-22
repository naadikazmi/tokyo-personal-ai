import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../lib/theme';
import type { AppTab } from '../types/app';

const tabs: Array<{ key: AppTab; label: string }> = [
  { key: 'home', label: 'Dashboard' },
  { key: 'chat', label: 'Chat' },
  { key: 'notes', label: 'Notes' },
  { key: 'pdfNotes', label: 'PDF Notes' },
  { key: 'memories', label: 'Memories' },
  { key: 'research', label: 'Research' },
  { key: 'planner', label: 'Planner' },
  { key: 'study', label: 'Study Mode' },
  { key: 'coding', label: 'Coding Helper' },
  { key: 'workspace', label: 'File Workspace' },
  { key: 'clipboard', label: 'Clipboard' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'logs', label: 'Activity Logs' },
  { key: 'avatar', label: 'AI Model' },
  { key: 'settings', label: 'Settings' },
];

type Props = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
};

export function TabBar({ activeTab, onChange }: Props) {
  return (
    <View style={styles.sidebar}>
      <Text style={styles.brand}>Tokyo</Text>
      <Text style={styles.caption}>Personal AI console</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(tab.key)}
              style={(state) => {
                const hovered = 'hovered' in state && Boolean(state.hovered);
                return [
                  styles.tab,
                  hovered && !active && styles.hoveredTab,
                  state.pressed && styles.pressedTab,
                  active && styles.activeTab,
                ];
              }}
            >
              <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 230,
    padding: spacing.lg,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: colors.backgroundAlt,
  },
  brand: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  caption: {
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  content: {
    gap: spacing.sm,
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  hoveredTab: {
    backgroundColor: colors.surfaceGlass,
  },
  pressedTab: {
    opacity: 0.82,
  },
  label: {
    color: colors.muted,
    fontWeight: '700',
  },
  activeLabel: {
    color: colors.primary,
  },
});

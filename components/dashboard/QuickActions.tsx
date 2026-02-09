import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

const ACTIONS = [
  { id: 'earn', label: 'Earn Now', icon: 'cash-outline', color: colors.primary, href: '/(tabs)/tasks' },
  { id: 'games', label: 'Play Games', icon: 'game-controller-outline', color: colors.accent, href: '/(tabs)/games' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy-outline', color: '#60A5FA', href: '/leaderboard' },
  { id: 'history', label: 'History', icon: 'time-outline', color: colors.textSecondary, href: '/(tabs)/wallet' },
];

export function QuickActions() {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {ACTIONS.map((action, index) => (
          <Animated.View 
            key={action.id}
            entering={FadeInDown.duration(400).delay(400 + index * 100)}
            style={styles.actionItem}
          >
            <Pressable 
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
              ]}
              onPress={() => router.push(action.href as any)}
            >
              <View style={[styles.iconContainer, { backgroundColor: action.color + '22' }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionItem: {
    width: '47%', // roughly half width with gap
  },
  actionButton: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    ...typography.captionBold,
    color: colors.text,
  },
});
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design';
import { Button } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface Task {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  category: string;
  type: string;
  link?: string;
}

interface TaskCardProps {
  task: Task;
  isCompleted: boolean;
  onPress: (task: Task) => void;
  isLoading?: boolean;
}

export function TaskCard({ task, isCompleted, onPress, isLoading }: TaskCardProps) {
  const getIcon = () => {
    switch (task.type) {
      case 'checkin': return 'calendar-outline';
      case 'twitter': return 'logo-twitter';
      case 'telegram': return 'paper-plane-outline';
      case 'video': return 'play-circle-outline';
      case 'survey': return 'clipboard-outline';
      default: return 'cash-outline';
    }
  };

  const getCategoryColor = () => {
    switch (task.category) {
      case 'Daily': return '#F59E0B';
      case 'Social': return '#3B82F6';
      case 'Watch': return '#EF4444';
      case 'Survey': return '#10B981';
      default: return colors.primary;
    }
  };

  return (
    <Animated.View 
      entering={FadeInDown.duration(400)}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: getCategoryColor() + '22' }]}>
          <Ionicons name={getIcon() as any} size={24} color={getCategoryColor()} />
        </View>
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: getCategoryColor() }]}>{task.category}</Text>
        </View>
      </View>

      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.description} numberOfLines={2}>{task.description}</Text>

      <View style={styles.footer}>
        <View style={styles.rewardInfo}>
          <Text style={styles.rewardLabel}>Reward</Text>
          <Text style={styles.rewardValue}>+{task.rewardAmount} DULP</Text>
        </View>
        
        <Button 
          variant={isCompleted ? 'outline' : 'primary'}
          size="sm"
          onPress={() => onPress(task)}
          loading={isLoading}
          disabled={isCompleted}
          leftIcon={isCompleted ? <Ionicons name="checkmark-circle" size={16} color={colors.success} /> : undefined}
        >
          {isCompleted ? 'Completed' : 'Complete'}
        </Button>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  badgeText: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 4,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.secondaryTint,
    paddingTop: spacing.md,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  rewardValue: {
    ...typography.captionBold,
    color: colors.primary,
  },
});

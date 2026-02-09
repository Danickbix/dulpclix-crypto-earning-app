import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface StreakWidgetProps {
  count: number;
}

export function StreakWidget({ count }: StreakWidgetProps) {
  return (
    <Animated.View 
      entering={FadeInDown.duration(600).delay(300)}
      style={styles.container}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="flame" size={24} color={colors.accent} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>Active Streak</Text>
        <Text style={styles.value}>{count} Days</Text>
      </View>
      <View style={styles.rewardContainer}>
        <Text style={styles.rewardLabel}>Next Reward</Text>
        <Text style={styles.rewardValue}>+50 DULP</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent + '33', // 20% opacity
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
  },
  value: {
    ...typography.h3,
    color: colors.text,
  },
  rewardContainer: {
    alignItems: 'flex-end',
  },
  rewardLabel: {
    ...typography.tiny,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  rewardValue: {
    ...typography.captionBold,
    color: colors.accent,
  },
});

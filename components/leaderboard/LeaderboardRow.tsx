import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/design';
import { Avatar } from '@/components/ui';

interface LeaderboardEntry {
  id: string;
  userId: string;
  score: number;
  displayName?: string;
  avatarUrl?: string;
  rank: number;
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isMe: boolean;
}

export function LeaderboardRow({ entry, isMe }: LeaderboardRowProps) {
  const isTop3 = entry.rank <= 3;
  
  const getRankColor = () => {
    switch (entry.rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return colors.textTertiary;
    }
  };

  return (
    <View style={[styles.container, isMe && styles.meContainer]}>
      <View style={styles.rankContainer}>
        <Text style={[styles.rankText, isTop3 && { color: getRankColor(), fontSize: 20, fontWeight: '800' }]}>
          {entry.rank}
        </Text>
      </View>
      
      <Avatar 
        source={entry.avatarUrl ? { uri: entry.avatarUrl } : undefined} 
        name={entry.displayName}
        size="md"
        style={styles.avatar}
      />
      
      <View style={styles.content}>
        <Text style={[styles.name, isMe && { color: colors.primary }]} numberOfLines={1}>
          {entry.displayName || 'Anonymous'} {isMe && '(You)'}
        </Text>
      </View>
      
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>{entry.score.toLocaleString()}</Text>
        <Text style={styles.scoreLabel}>POINTS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  meContainer: {
    backgroundColor: colors.primary + '11',
    borderColor: colors.primary + '33',
    borderWidth: 1,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    ...typography.bodyBold,
    color: colors.textTertiary,
  },
  avatar: {
    marginHorizontal: spacing.md,
  },
  content: {
    flex: 1,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  scoreLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
});

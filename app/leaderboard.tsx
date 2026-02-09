import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { Container } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { blink } from '@/lib/blink';
import { LeaderboardRow } from '@/components/leaderboard/LeaderboardRow';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Entry {
  id: string;
  userId: string;
  score: number;
  period: string;
}

interface Profile {
  userId: string;
  displayName: string;
  avatarUrl: string;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('all_time');

  const { data: leaderboardData, isLoading, refetch } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const entries = await blink.db.table('leaderboard_entries').list({
        where: { period },
        orderBy: { score: 'desc' },
        limit: 50,
      }) as Entry[];

      const userIds = entries.map(e => e.userId);
      if (userIds.length === 0) return [];

      const profiles = await blink.db.table('profiles').list({
        where: { userId: { in: userIds } }
      }) as Profile[];

      const profileMap = new Map(profiles.map(p => [p.userId, p]));

      return entries.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        displayName: profileMap.get(entry.userId)?.displayName,
        avatarUrl: profileMap.get(entry.userId)?.avatarUrl,
      }));
    },
  });

  const onRefresh = async () => {
    await refetch();
  };

  return (
    <Container safeArea>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Leaderboard</Text>
      </View>

      <View style={styles.tabContainer}>
        {['daily', 'weekly', 'all_time'].map((p) => (
          <Pressable 
            key={p}
            style={[styles.tab, period === p && styles.activeTab]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.tabText, period === p && styles.activeTabText]}>
              {p.replace('_', ' ').toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={leaderboardData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LeaderboardRow entry={item} isMe={item.userId === user?.id} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={onRefresh} 
            tintColor={colors.primary} 
          />
        }
        ListEmptyComponent={
          !isLoading && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No rankings yet. Start earning!</Text>
            </View>
          )
        }
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.tiny,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.secondaryDark,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
  },
});

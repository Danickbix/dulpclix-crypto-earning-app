import React from 'react';
import { ScrollView, StyleSheet, RefreshControl, View, Text, TouchableOpacity } from 'react-native';
import { Container } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { BalanceWidget } from '@/components/dashboard/BalanceWidget';
import { StreakWidget } from '@/components/dashboard/StreakWidget';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useQueryClient } from '@tanstack/react-query';

import { blink } from '@/lib/blink';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Avatar } from '@/components/ui';

export default function DashboardScreen() {
  const { profile, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: xpProfile } = useQuery({
    queryKey: ['xp_profile', user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return null;
        return await blink.db.table('xp_profiles').get(user.id);
      } catch (error) {
        console.log('Error fetching XP profile on dashboard:', error);
        return null;
      }
    },
    enabled: !!user,
  });

  const currentLevel = (xpProfile as any)?.level || 1;
  const currentXp = (xpProfile as any)?.xp || 0;
  const nextLevelXp = Math.floor(100 * Math.pow(currentLevel, 1.5));
  const xpProgress = currentXp / nextLevelXp;

  const onRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    await queryClient.invalidateQueries({ queryKey: ['xp_profile'] });
  };

  return (
    <Container safeArea edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{profile?.displayName || 'User'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Avatar source={profile?.avatarUrl ? { uri: profile.avatarUrl } : undefined} size="md" />
          </TouchableOpacity>
        </View>

        <BalanceWidget
          balance={profile?.balance || 0}
          level={currentLevel}
          xpProgress={xpProgress}
        />

        <StreakWidget count={profile?.streakCount || 0} />

        <QuickActions />

        {/* Daily Tasks Summary could go here */}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100, // Extra space for tabs
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.body,
    color: colors.textSecondary,
  },
  userName: {
    ...typography.h1,
    color: colors.text,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    padding: spacing.lg,
  },
});
import React from 'react';
import { ScrollView, StyleSheet, RefreshControl, View, Text } from 'react-native';
import { Container } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { BalanceWidget } from '@/components/dashboard/BalanceWidget';
import { StreakWidget } from '@/components/dashboard/StreakWidget';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useQueryClient } from '@tanstack/react-query';

export default function DashboardScreen() {
  const { profile, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const onRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
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
        </View>

        <BalanceWidget balance={profile?.balance || 0} />
        
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
});

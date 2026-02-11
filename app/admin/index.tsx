import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Container, Button, Card, Input, Avatar } from '@/components/ui';
import { colors, spacing, typography, shadows, borderRadius } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { blink } from '@/lib/blink';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ADMIN_EMAIL = 'Danickbix@gmail.com';

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('withdrawals');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.email !== ADMIN_EMAIL)) {
      Alert.alert('Access Denied', 'You do not have permission to view this page.');
      router.replace('/');
    }
  }, [user, isAuthenticated, authLoading]);

  const { data: withdrawals, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ['admin_withdrawals'],
    queryFn: async () => {
      // In a real app, this would be an admin-only endpoint
      // For now we use the DB directly (only works if security policy allows or we use an edge function)
      // Since security policy is owner-based, we NEED an edge function for admin reads.
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'list_withdrawals' }
      });
      return response.data;
    },
    enabled: !!user && user.email === ADMIN_EMAIL
  });

  const { data: stats } = useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'get_stats' }
      });
      return response.data;
    },
    enabled: !!user && user.email === ADMIN_EMAIL
  });

  const handleWithdrawal = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: 'approved' | 'rejected' }) => {
      return await blink.functions.invoke('admin-action', {
        body: { action: 'update_withdrawal', withdrawalId: id, status }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_withdrawals'] });
      Alert.alert('Success', 'Withdrawal updated successfully.');
    }
  });

  if (authLoading || (isAuthenticated && user?.email !== ADMIN_EMAIL)) {
    return (
      <Container style={styles.loading}>
        <Text style={styles.loadingText}>Verifying admin access...</Text>
      </Container>
    );
  }

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Welcome, {user?.displayName || 'Admin'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {['withdrawals', 'users', 'tasks', 'codes', 'emissions'].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        {activeTab === 'withdrawals' && (
          <View>
            <Text style={styles.sectionTitle}>Pending Withdrawals</Text>
            {withdrawals?.filter((w: any) => w.status === 'pending').map((w: any) => (
              <Card key={w.id} style={styles.adminCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.userEmail}>{w.userId}</Text>
                  <Text style={styles.amount}>{w.amount} DULP</Text>
                </View>
                <Text style={styles.address}>To: {w.address}</Text>
                <View style={styles.actions}>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => handleWithdrawal.mutate({ id: w.id, status: 'rejected' })}
                    style={{ flex: 1, marginRight: 8, borderColor: colors.error }}
                  >
                    <Text style={{ color: colors.error }}>Reject</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onPress={() => handleWithdrawal.mutate({ id: w.id, status: 'approved' })}
                    style={{ flex: 1 }}
                  >
                    Approve
                  </Button>
                </View>
              </Card>
            ))}
            {(!withdrawals || withdrawals.filter((w: any) => w.status === 'pending').length === 0) && (
              <Text style={styles.emptyText}>No pending withdrawals</Text>
            )}
          </View>
        )}

        {activeTab === 'emissions' && (
          <View>
            <Text style={styles.sectionTitle}>Daily Token Emissions</Text>
            <Card style={styles.adminCard}>
              <Text style={styles.statLabel}>Total Emitted Today</Text>
              <Text style={styles.statValue}>{stats?.dailyEmission || 0} DULP</Text>
              <Text style={styles.statSub}>Limit: 100,000 DULP</Text>
            </Card>
          </View>
        )}
        
        {/* Other tabs would go here */}
        {activeTab !== 'withdrawals' && activeTab !== 'emissions' && (
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Under construction</Text>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  header: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.secondaryTint,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
  closeBtn: {
    padding: spacing.sm,
  },
  tabsContainer: {
    padding: spacing.md,
    maxHeight: 60,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.smallBold,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  adminCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  userEmail: {
    ...typography.smallBold,
    color: colors.text,
  },
  amount: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  address: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.h1,
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  statSub: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});

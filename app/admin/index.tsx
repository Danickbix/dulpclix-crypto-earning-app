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
  const { user, profile: myProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('withdrawals');
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || myProfile?.role !== 'admin')) {
      if (user?.email === ADMIN_EMAIL && myProfile && myProfile.role !== 'admin') {
        // Auto-promote first admin
        blink.functions.invoke('admin-action', {
          body: { action: 'update_user', targetUserId: user.id, updates: { role: 'admin' } }
        }).then(() => queryClient.invalidateQueries({ queryKey: ['profile'] }));
      } else if (user?.email !== ADMIN_EMAIL) {
        Alert.alert('Access Denied', 'You do not have permission to view this page.');
        router.replace('/');
      }
    }
  }, [user, myProfile, isAuthenticated, authLoading]);

  const { data: withdrawals } = useQuery({
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
    enabled: !!myProfile && myProfile.role === 'admin'
  });

  const { data: users } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'list_users' }
      });
      return response.data;
    },
    enabled: !!myProfile && myProfile.role === 'admin' && activeTab === 'users'
  });

  const { data: tasks } = useQuery({
    queryKey: ['admin_tasks'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'list_tasks' }
      });
      return response.data;
    },
    enabled: !!myProfile && myProfile.role === 'admin' && activeTab === 'tasks'
  });

  const { data: stats } = useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'get_stats' }
      });
      return response.data;
    },
    enabled: !!myProfile && myProfile.role === 'admin'
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

  const handleTaskSubmit = useMutation({
    mutationFn: async (task: any) => {
      return await blink.functions.invoke('admin-action', {
        body: { action: 'upsert_task', task }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tasks'] });
      setIsTaskModalVisible(false);
      setEditingTask(null);
      Alert.alert('Success', 'Task saved successfully.');
    }
  });

  const handleUserUpdate = useMutation({
    mutationFn: async ({ targetUserId, updates }: { targetUserId: string, updates: any }) => {
      return await blink.functions.invoke('admin-action', {
        body: { action: 'update_user', targetUserId, updates }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setIsUserModalVisible(false);
      setEditingUser(null);
      Alert.alert('Success', 'User updated successfully.');
    }
  });

  if (authLoading || (isAuthenticated && myProfile?.role !== 'admin' && user?.email !== ADMIN_EMAIL)) {
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
        {['withdrawals', 'users', 'tasks', 'emissions'].map((tab) => (
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

        {activeTab === 'users' && (
          <View>
            <Text style={styles.sectionTitle}>User Management</Text>
            {users?.map((u: any) => (
              <Card key={u.id} style={styles.adminCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.userInfo}>
                    <Avatar source={u.avatarUrl ? { uri: u.avatarUrl } : undefined} size="sm" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.userEmail}>{u.displayName}</Text>
                      <Text style={styles.tinyText}>{u.userId}</Text>
                    </View>
                  </View>
                  <Text style={styles.amount}>{u.balance.toLocaleString()} DULP</Text>
                </View>
                <View style={styles.actions}>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setEditingUser(u);
                      setIsUserModalVisible(true);
                    }}
                    style={{ flex: 1 }}
                  >
                    Edit User
                  </Button>
                </View>
              </Card>
            ))}
          </View>
        )}

        {activeTab === 'tasks' && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={styles.sectionTitle}>Tasks</Text>
              <Button
                size="sm"
                variant="primary"
                onPress={() => {
                  setEditingTask({ title: '', reward_amount: 0, category: 'daily', type: 'social', link: '', is_active: 1 });
                  setIsTaskModalVisible(true);
                }}
              >
                Add Task
              </Button>
            </View>
            {tasks?.map((t: any) => (
              <Card key={t.id} style={styles.adminCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.userEmail}>{t.title}</Text>
                  <Text style={styles.amount}>{t.reward_amount} DULP</Text>
                </View>
                <Text style={styles.tinyText}>{t.category} | {t.type}</Text>
                <View style={styles.actions}>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setEditingTask(t);
                      setIsTaskModalVisible(true);
                    }}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      Alert.alert('Confirm', 'Are you sure you want to delete this task?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => blink.functions.invoke('admin-action', { body: { action: 'delete_task', taskId: t.id } }).then(() => queryClient.invalidateQueries({ queryKey: ['admin_tasks'] })) }
                      ]);
                    }}
                    style={{ flex: 1, borderColor: colors.error }}
                  >
                    <Text style={{ color: colors.error }}>Delete</Text>
                  </Button>
                </View>
              </Card>
            ))}
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
        {activeTab !== 'withdrawals' && activeTab !== 'users' && activeTab !== 'tasks' && activeTab !== 'emissions' && (
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Under construction</Text>
          </View>
        )}
      </ScrollView>

      {/* Task Modal (Simplified for the edit_file tool, ideally separate components) */}
      {isTaskModalVisible && (
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingTask?.id ? 'Edit Task' : 'Add Task'}</Text>
            <ScrollView>
              <Input label="Title" value={editingTask.title} onChangeText={(text) => setEditingTask({ ...editingTask, title: text })} />
              <Input label="Reward" value={String(editingTask.reward_amount)} onChangeText={(text) => setEditingTask({ ...editingTask, reward_amount: Number(text) })} keyboardType="numeric" />
              <Input label="Category" value={editingTask.category} onChangeText={(text) => setEditingTask({ ...editingTask, category: text })} />
              <Input label="Type" value={editingTask.type} onChangeText={(text) => setEditingTask({ ...editingTask, type: text })} />
              <Input label="Link" value={editingTask.link} onChangeText={(text) => setEditingTask({ ...editingTask, link: text })} />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => setIsTaskModalVisible(false)} style={{ flex: 1, marginRight: 8 }}>Cancel</Button>
              <Button variant="primary" onPress={() => handleTaskSubmit.mutate(editingTask)} style={{ flex: 1 }}>Save</Button>
            </View>
          </Card>
        </View>
      )}

      {/* User Modal */}
      {isUserModalVisible && (
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit User</Text>
            <Input label="Balance" value={String(editingUser.balance)} onChangeText={(text) => setEditingUser({ ...editingUser, balance: Number(text) })} keyboardType="numeric" />
            <Input label="Role" value={editingUser.role} onChangeText={(text) => setEditingUser({ ...editingUser, role: text })} />
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => setIsUserModalVisible(false)} style={{ flex: 1, marginRight: 8 }}>Cancel</Button>
              <Button variant="primary" onPress={() => handleUserUpdate.mutate({ targetUserId: editingUser.userId, updates: { balance: editingUser.balance, role: editingUser.role } })} style={{ flex: 1 }}>Save</Button>
            </View>
          </Card>
        </View>
      )}
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tinyText: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 1000,
  },
  modalContent: {
    padding: spacing.xl,
    backgroundColor: colors.backgroundSecondary,
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
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

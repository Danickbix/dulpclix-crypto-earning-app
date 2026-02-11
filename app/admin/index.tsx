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

function useAdminAccess() {
  const { user, profile, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPromoting, setIsPromoting] = useState(false);

  const isAdminEmail = user?.email === ADMIN_EMAIL;
  const isAdmin = profile?.role === 'admin';
  const needsPromotion = isAdminEmail && profile && !isAdmin;

  useEffect(() => {
    if (authLoading || isPromoting) return;

    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    // Auto-promote the admin email user
    if (needsPromotion) {
      setIsPromoting(true);
      blink.functions.invoke('admin-action', {
        body: { action: 'promote_to_admin' }
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setIsPromoting(false);
      }).catch((err) => {
        console.error('Promotion failed:', err);
        setIsPromoting(false);
      });
      return;
    }

    // Non-admin, non-admin-email user — redirect
    if (!isAdminEmail && !isAdmin) {
      if (Platform.OS === 'web') {
        alert('Access Denied: You do not have permission to view this page.');
      } else {
        Alert.alert('Access Denied', 'You do not have permission to view this page.');
      }
      router.replace('/');
    }
  }, [user, profile, isAuthenticated, authLoading, needsPromotion, isPromoting]);

  return {
    canAccess: isAdmin || isAdminEmail,
    isReady: !authLoading && !isPromoting && (isAdmin || isAdminEmail),
    isLoading: authLoading || isPromoting || needsPromotion,
  };
}

export default function AdminDashboard() {
  const { user, profile: myProfile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('withdrawals');
  const [isStoreModalVisible, setIsStoreModalVisible] = useState(false);
  const [editingStoreItem, setEditingStoreItem] = useState<any>(null);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const router = useRouter();

  const { canAccess, isReady, isLoading } = useAdminAccess();

  const { data: withdrawals } = useQuery({
    queryKey: ['admin_withdrawals'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'list_withdrawals' }
      });
      return response?.data || response || [];
    },
    enabled: isReady,
  });

  const { data: users } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'list_users' }
      });
      return response?.data || response || [];
    },
    enabled: isReady && activeTab === 'users',
  });

  const { data: tasks } = useQuery({
    queryKey: ['admin_tasks'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'list_tasks' }
      });
      return response?.data || response || [];
    },
    enabled: isReady && activeTab === 'tasks',
  });

  const { data: storeItems } = useQuery({
    queryKey: ['admin_store_items'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'list_store_items' }
      });
      return response?.data || response || [];
    },
    enabled: isReady && activeTab === 'store',
  });

  const { data: stats } = useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      const response = await blink.functions.invoke('admin-action', {
        body: { action: 'get_stats' }
      });
      return response?.data || response || {};
    },
    enabled: isReady,
  });

  const handleWithdrawal = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      return await blink.functions.invoke('admin-action', {
        body: { action: 'update_withdrawal', withdrawalId: id, status }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
      Alert.alert('Success', 'Withdrawal updated successfully.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update withdrawal');
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
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to save task');
    }
  });

  const handleStoreItemSubmit = useMutation({
    mutationFn: async (item: any) => {
      return await blink.functions.invoke('admin-action', {
        body: { action: 'upsert_store_item', item }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_store_items'] });
      setIsStoreModalVisible(false);
      setEditingStoreItem(null);
      Alert.alert('Success', 'Store item saved successfully.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to save store item');
    }
  });

  const handleUserUpdate = useMutation({
    mutationFn: async ({ targetUserId, updates }: { targetUserId: string; updates: any }) => {
      return await blink.functions.invoke('admin-action', {
        body: { action: 'update_user', targetUserId, updates }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setIsUserModalVisible(false);
      setEditingUser(null);
      Alert.alert('Success', 'User updated successfully.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update user');
    }
  });

  if (isLoading || !canAccess) {
    return (
      <Container style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
        <Text style={styles.loadingText}>Verifying admin access...</Text>
      </Container>
    );
  }

  const pendingWithdrawals = Array.isArray(withdrawals)
    ? withdrawals.filter((w: any) => w.status === 'pending')
    : [];

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

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats?.totalUsers || 0}</Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats?.pendingWithdrawals || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats?.dailyEmission || 0}</Text>
          <Text style={styles.statLabel}>Emitted</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {['withdrawals', 'users', 'tasks', 'store', 'emissions'].map((tab) => (
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
            {pendingWithdrawals.map((w: any) => (
              <Card key={w.id} style={styles.adminCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.userEmail}>{w.userId?.substring(0, 12)}...</Text>
                  <Text style={styles.amount}>{Number(w.amount).toLocaleString()} DULP</Text>
                </View>
                <Text style={styles.address}>To: {w.address || 'No address'}</Text>
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
            {pendingWithdrawals.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No pending withdrawals</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'users' && (
          <View>
            <Text style={styles.sectionTitle}>User Management ({Array.isArray(users) ? users.length : 0})</Text>
            {Array.isArray(users) && users.map((u: any) => (
              <Card key={u.id} style={styles.adminCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.userInfo}>
                    <Avatar source={u.avatarUrl ? { uri: u.avatarUrl } : undefined} size="sm" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.userName}>{u.displayName || 'Unknown'}</Text>
                      <Text style={styles.tinyText}>{u.role || 'user'} · {u.userId?.substring(0, 10)}...</Text>
                    </View>
                  </View>
                  <Text style={styles.amount}>{Number(u.balance || 0).toLocaleString()} DULP</Text>
                </View>
                <View style={styles.actions}>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setEditingUser({
                        ...u,
                        balance: Number(u.balance || 0),
                        role: u.role || 'user',
                      });
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
              <Text style={styles.sectionTitle}>Tasks ({Array.isArray(tasks) ? tasks.length : 0})</Text>
              <Button
                size="sm"
                variant="primary"
                onPress={() => {
                  setEditingTask({ title: '', rewardAmount: 0, category: 'daily', type: 'social', link: '', isActive: 1 });
                  setIsTaskModalVisible(true);
                }}
              >
                Add Task
              </Button>
            </View>
            {Array.isArray(tasks) && tasks.map((t: any) => (
              <Card key={t.id} style={styles.adminCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.userName}>{t.title}</Text>
                  <Text style={styles.amount}>{Number(t.rewardAmount || 0)} DULP</Text>
                </View>
                <Text style={styles.tinyText}>{t.category} | {t.type} | {Number(t.isActive) ? 'Active' : 'Inactive'}</Text>
                <View style={styles.actions}>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setEditingTask({ ...t, rewardAmount: Number(t.rewardAmount || 0) });
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
                      const doDelete = () => {
                        blink.functions.invoke('admin-action', {
                          body: { action: 'delete_task', taskId: t.id }
                        }).then(() => queryClient.invalidateQueries({ queryKey: ['admin_tasks'] }));
                      };
                      if (Platform.OS === 'web') {
                        if (confirm('Are you sure you want to delete this task?')) doDelete();
                      } else {
                        Alert.alert('Confirm', 'Are you sure you want to delete this task?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: doDelete }
                        ]);
                      }
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

        {activeTab === 'store' && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={styles.sectionTitle}>Store Items ({Array.isArray(storeItems) ? storeItems.length : 0})</Text>
              <Button
                size="sm"
                variant="primary"
                onPress={() => {
                  setEditingStoreItem({ name: '', description: '', price: 0, category: 'booster', type: 'booster', value: 0, durationHours: 24, isActive: 1 });
                  setIsStoreModalVisible(true);
                }}
              >
                Add Item
              </Button>
            </View>
            {Array.isArray(storeItems) && storeItems.map((item: any) => (
              <Card key={item.id} style={styles.adminCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.amount}>{Number(item.price || 0)} DULP</Text>
                </View>
                <Text style={styles.tinyText}>{item.category} | {item.type} | {Number(item.isActive) ? 'Active' : 'Inactive'}</Text>
                <View style={styles.actions}>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setEditingStoreItem({ ...item, price: Number(item.price || 0), durationHours: Number(item.durationHours || 24) });
                      setIsStoreModalVisible(true);
                    }}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      const doDelete = () => {
                        blink.functions.invoke('admin-action', {
                          body: { action: 'delete_store_item', itemId: item.id }
                        }).then(() => queryClient.invalidateQueries({ queryKey: ['admin_store_items'] }));
                      };
                      if (Platform.OS === 'web') {
                        if (confirm('Delete this store item?')) doDelete();
                      } else {
                        Alert.alert('Confirm', 'Delete this store item?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: doDelete }
                        ]);
                      }
                    }}
                    style={{ flex: 1, borderColor: colors.error }}
                  >
                    <Text style={{ color: colors.error }}>Delete</Text>
                  </Button>
                </View>
              </Card>
            ))}
            {(!storeItems || (Array.isArray(storeItems) && storeItems.length === 0)) && (
              <View style={styles.emptyContainer}>
                <Ionicons name="cart-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No store items yet. Add one above.</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'emissions' && (
          <View>
            <Text style={styles.sectionTitle}>Daily Token Emissions</Text>
            <Card style={styles.adminCard}>
              <Text style={styles.statLabel}>Total Emitted Today</Text>
              <Text style={styles.emissionValue}>{stats?.dailyEmission || 0} DULP</Text>
              <View style={styles.emissionBar}>
                <View style={[styles.emissionFill, { width: `${Math.min(100, ((stats?.dailyEmission || 0) / 100000) * 100)}%` }]} />
              </View>
              <Text style={styles.tinyText}>Limit: 100,000 DULP / day</Text>
            </Card>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Task Modal */}
      {isTaskModalVisible && editingTask && (
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingTask.id ? 'Edit Task' : 'Add Task'}</Text>
            <ScrollView>
              <Input
                label="Title"
                value={editingTask.title || ''}
                onChangeText={(text) => setEditingTask({ ...editingTask, title: text })}
              />
              <Input
                label="Reward Amount"
                value={String(editingTask.rewardAmount || 0)}
                onChangeText={(text) => setEditingTask({ ...editingTask, rewardAmount: Number(text) || 0 })}
                keyboardType="numeric"
              />
              <Input
                label="Category (daily, social, survey, sponsored)"
                value={editingTask.category || ''}
                onChangeText={(text) => setEditingTask({ ...editingTask, category: text })}
              />
              <Input
                label="Type (social, watch, survey, offer)"
                value={editingTask.type || ''}
                onChangeText={(text) => setEditingTask({ ...editingTask, type: text })}
              />
              <Input
                label="Link URL"
                value={editingTask.link || ''}
                onChangeText={(text) => setEditingTask({ ...editingTask, link: text })}
              />
              <Input
                label="Description"
                value={editingTask.description || ''}
                onChangeText={(text) => setEditingTask({ ...editingTask, description: text })}
                multiline
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => { setIsTaskModalVisible(false); setEditingTask(null); }} style={{ flex: 1, marginRight: 8 }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={handleTaskSubmit.isPending}
                onPress={() => handleTaskSubmit.mutate(editingTask)}
                style={{ flex: 1 }}
              >
                Save
              </Button>
            </View>
          </Card>
        </View>
      )}

      {/* Store Item Modal */}
      {isStoreModalVisible && editingStoreItem && (
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingStoreItem.id ? 'Edit Store Item' : 'Add Store Item'}</Text>
            <ScrollView>
              <Input
                label="Name"
                value={editingStoreItem.name || ''}
                onChangeText={(text) => setEditingStoreItem({ ...editingStoreItem, name: text })}
              />
              <Input
                label="Description"
                value={editingStoreItem.description || ''}
                onChangeText={(text) => setEditingStoreItem({ ...editingStoreItem, description: text })}
                multiline
              />
              <Input
                label="Price (DULP)"
                value={String(editingStoreItem.price || 0)}
                onChangeText={(text) => setEditingStoreItem({ ...editingStoreItem, price: Number(text) || 0 })}
                keyboardType="numeric"
              />
              <Input
                label="Category (booster, powerup, cosmetic)"
                value={editingStoreItem.category || ''}
                onChangeText={(text) => setEditingStoreItem({ ...editingStoreItem, category: text })}
              />
              <Input
                label="Type (booster, powerup, cosmetic)"
                value={editingStoreItem.type || ''}
                onChangeText={(text) => setEditingStoreItem({ ...editingStoreItem, type: text })}
              />
              <Input
                label="Duration (hours, for boosts)"
                value={String(editingStoreItem.durationHours || 24)}
                onChangeText={(text) => setEditingStoreItem({ ...editingStoreItem, durationHours: Number(text) || 24 })}
                keyboardType="numeric"
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => { setIsStoreModalVisible(false); setEditingStoreItem(null); }} style={{ flex: 1, marginRight: 8 }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={handleStoreItemSubmit.isPending}
                onPress={() => handleStoreItemSubmit.mutate(editingStoreItem)}
                style={{ flex: 1 }}
              >
                Save
              </Button>
            </View>
          </Card>
        </View>
      )}

      {/* User Modal */}
      {isUserModalVisible && editingUser && (
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit User: {editingUser.displayName}</Text>
            <Input
              label="Balance"
              value={String(editingUser.balance || 0)}
              onChangeText={(text) => setEditingUser({ ...editingUser, balance: Number(text) || 0 })}
              keyboardType="numeric"
            />
            <Input
              label="Role (user, admin)"
              value={editingUser.role || 'user'}
              onChangeText={(text) => setEditingUser({ ...editingUser, role: text })}
            />
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => { setIsUserModalVisible(false); setEditingUser(null); }} style={{ flex: 1, marginRight: 8 }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={handleUserUpdate.isPending}
                onPress={() => handleUserUpdate.mutate({
                  targetUserId: editingUser.userId,
                  updates: { balance: editingUser.balance, role: editingUser.role }
                })}
                style={{ flex: 1 }}
              >
                Save
              </Button>
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
    gap: spacing.md,
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
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondaryTint,
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    ...typography.h3,
    color: colors.primary,
  },
  statLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
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
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  userEmail: {
    ...typography.small,
    color: colors.textSecondary,
  },
  userName: {
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
    marginTop: spacing.sm,
  },
  emissionValue: {
    ...typography.h1,
    color: colors.primary,
    marginVertical: spacing.sm,
  },
  emissionBar: {
    height: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  emissionFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});

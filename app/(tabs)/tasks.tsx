import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Container } from '@/components/ui';
import { colors, typography, spacing } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { blink } from '@/lib/blink';
import { TaskCard } from '@/components/tasks/TaskCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

interface Task {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  category: string;
  type: string;
  link?: string;
}

interface UserTask {
  id: string;
  userId: string;
  taskId: string;
  status: string;
}

export default function TasksScreen() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);

  const { data: tasks, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      return await blink.db.table('tasks').list() as Task[];
    },
  });

  const { data: userTasks, isLoading: isLoadingUserTasks, refetch: refetchUserTasks } = useQuery({
    queryKey: ['userTasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await blink.db.table('user_tasks').list({
        where: { userId: user.id },
      }) as UserTask[];
    },
    enabled: !!user,
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      if (!user || !profile) return;

      // 1. Create user_task entry
      await blink.db.table('user_tasks').create({
        userId: user.id,
        taskId: task.id,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      // 2. Update user balance
      const newBalance = (profile.balance || 0) + task.rewardAmount;
      await blink.db.table('profiles').update(profile.id, {
        balance: newBalance,
        // Update streak if checkin
        ...(task.type === 'checkin' ? { 
          streakCount: (profile.streakCount || 0) + 1,
          lastStreakAt: new Date().toISOString()
        } : {})
      });

      // 3. Create transaction log
      await blink.db.table('transactions').create({
        userId: user.id,
        amount: task.rewardAmount,
        type: 'earn',
        description: `Completed task: ${task.title}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['userTasks'] });
      setClaimingTaskId(null);
      Alert.alert('Success', 'Reward claimed successfully!');
    },
    onError: (error) => {
      setClaimingTaskId(null);
      Alert.alert('Error', 'Failed to complete task. Maybe you already finished it?');
    },
  });

  const handleTaskPress = async (task: Task) => {
    if (task.link) {
      await Linking.openURL(task.link);
      // For social tasks, we wait a bit before allowing claim in a real app
      // Here we just let them claim after returning
    }

    setClaimingTaskId(task.id);
    completeTaskMutation.mutate(task);
  };

  const isCompleted = (taskId: string) => {
    return userTasks?.some(ut => ut.taskId === taskId) || false;
  };

  const onRefresh = async () => {
    await Promise.all([refetchTasks(), refetchUserTasks()]);
  };

  return (
    <Container safeArea edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Earn Tokens</Text>
        <Text style={styles.subtitle}>Complete tasks and grow your wallet balance.</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskCard 
            task={item} 
            isCompleted={isCompleted(item.id)}
            onPress={handleTaskPress}
            isLoading={claimingTaskId === item.id}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={isLoadingTasks || isLoadingUserTasks} 
            onRefresh={onRefresh} 
            tintColor={colors.primary} 
          />
        }
        ListEmptyComponent={
          !isLoadingTasks && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tasks available right now.</Text>
            </View>
          )
        }
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
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

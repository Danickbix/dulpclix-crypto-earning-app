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
  rewardAmount?: number;
  reward_amount?: number;
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

  const { data: xpProfile } = useQuery({
    queryKey: ['xp_profile', user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return null;
        return await blink.db.table('xp_profiles').get(user.id);
      } catch (error) {
        console.log('Error fetching XP profile:', error);
        return null;
      }
    },
    enabled: !!user,
  });

  const currentLevel = xpProfile?.level || 1;

  const { data: tasks, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const result = await blink.db.table('tasks').list({
        where: { isActive: 1 },
      }) as Task[];
      return result;
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
      if (!user || !profile) throw new Error('Not authenticated');

      const response = await blink.functions.invoke('complete-task', {
        body: { taskId: task.id }
      });

      // Handle both nested and flat response shapes
      const data = response?.data || response;
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['userTasks'] });
      queryClient.invalidateQueries({ queryKey: ['xp_profile'] });
      setClaimingTaskId(null);
      const reward = data?.reward || 0;
      const msg = data?.leveledUp
        ? `+${reward} DULP! 🎉 You leveled up to Level ${data.currentLevel}!`
        : `+${reward} DULP claimed successfully!`;
      Alert.alert('Reward Claimed', msg);
    },
    onError: (error: any) => {
      setClaimingTaskId(null);
      Alert.alert('Error', error.message || 'Failed to complete task.');
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
    return userTasks?.some(ut => ut.taskId === taskId && ut.status === 'completed') || false;
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
        data={tasks || []}
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

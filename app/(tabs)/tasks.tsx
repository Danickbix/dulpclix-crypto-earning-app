import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Container } from '@/components/ui';
import { colors, typography, spacing } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { blink } from '@/lib/blink';
import { TaskCard } from '@/components/tasks/TaskCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useBlinkAuth } from '@blinkdotnew/react';

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
  const { user } = useBlinkAuth();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);

  const { data: xpProfile } = useQuery({
    queryKey: ['xp_profile', user?.id],
    queryFn: async () => {
      return await blink.db.table('xp_profiles').get(user?.id!);
    },
    enabled: !!user,
  });

  const currentLevel = xpProfile?.level || 1;

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

      const response = await blink.functions.invoke('complete-task', {
        body: { taskId: task.id }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['userTasks'] });
      setClaimingTaskId(null);
      Alert.alert('Success', `Reward of ${data.reward} DULP claimed successfully!`);
    },
    onError: (error: any) => {
      setClaimingTaskId(null);
      Alert.alert('Error', error.message || 'Failed to complete task.');
    },
  });

  const handleTaskPress = async (task: Task) => {
    // Some tasks might be level gated in the future
    if (task.category === 'premium' && !profile?.isActivated) {
      Alert.alert('Locked', 'Account activation required for premium tasks.');
      return;
    }

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

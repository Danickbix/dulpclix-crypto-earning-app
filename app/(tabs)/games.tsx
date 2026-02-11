import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Container } from '@/components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design';
import { TapRace } from '@/components/games/TapRace';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { useAuth } from '@/context/AuthContext';

const GAMES = [
  { id: 'tap_race', title: 'Tap Race', description: 'Fastest finger wins tokens!', icon: 'flash', color: colors.primary, level: 1 },
  { id: 'spin_wheel', title: 'Spin Wheel', description: 'Try your luck for big rewards.', icon: 'sync', color: colors.accent, level: 2, advanced: true },
  { id: 'puzzle_game', title: 'Crypto Puzzle', description: 'Solve and earn rewards.', icon: 'extension-puzzle', color: '#60A5FA', level: 3, advanced: true },
  { id: 'reaction_sprint', title: 'Reaction Sprint', description: 'Test your reaction speed.', icon: 'stopwatch', color: colors.error, level: 4, advanced: true },
];

export default function GamesScreen() {
  const { user, profile } = useAuth();
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const { data: xpProfile } = useQuery({
    queryKey: ['xp_profile', user?.id],
    queryFn: async () => {
      return await blink.db.table('xp_profiles').get(user?.id!);
    },
    enabled: !!user,
  });

  const currentLevel = xpProfile?.level || 1;

  if (activeGame === 'tap_race') {
    return (
      <Container safeArea>
        <View style={styles.header}>
          <Pressable onPress={() => setActiveGame(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Tap Race</Text>
        </View>
        <TapRace />
      </Container>
    );
  }

  const handleGamePress = (game: typeof GAMES[0]) => {
    if (game.level > currentLevel) {
      Alert.alert('Level Locked', `You need to be Level ${game.level} to play this game.`);
      return;
    }
    if (game.advanced && !profile?.isActivated) {
      Alert.alert('Locked', 'Account activation required for advanced games.');
      return;
    }
    setActiveGame(game.id);
  };

  return (
    <Container safeArea edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.screenHeader}>
          <Text style={styles.title}>Mini Games</Text>
          <Text style={styles.subtitle}>Play and compete for crypto rewards.</Text>
        </View>

        <View style={styles.grid}>
          {GAMES.map((game, index) => {
            const isLocked = game.level > currentLevel || (game.advanced && !profile?.isActivated);
            
            return (
              <Animated.View 
                key={game.id}
                entering={FadeIn.duration(400).delay(index * 100)}
                style={styles.gameCard}
              >
                <Pressable 
                  style={({ pressed }) => [
                    styles.gameButton,
                    pressed && !isLocked && { transform: [{ scale: 0.98 }], opacity: 0.9 }
                  ]}
                  onPress={() => handleGamePress(game)}
                >
                  <View style={[styles.iconContainer, { backgroundColor: game.color + '22' }]}>
                    {isLocked ? (
                      <Ionicons name="lock-closed" size={32} color={colors.textTertiary} />
                    ) : (
                      <Ionicons name={game.icon as any} size={32} color={game.color} />
                    )}
                  </View>
                  <Text style={[styles.gameTitle, isLocked && { color: colors.textTertiary }]}>{game.title}</Text>
                  <Text style={styles.gameDescription}>{game.description}</Text>
                  
                  {isLocked ? (
                    <View style={styles.lockedBadge}>
                      <Text style={styles.lockedText}>
                        {game.level > currentLevel ? `Unlock at Lvl ${game.level}` : 'Requires Activation'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.playBadge}>
                      <Text style={styles.playText}>Play Now</Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  screenHeader: {
    marginBottom: spacing.xl,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondaryTint,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  grid: {
    gap: spacing.lg,
  },
  gameCard: {
    width: '100%',
  },
  gameButton: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.md,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gameTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  gameDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  playBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  playText: {
    ...typography.captionBold,
    color: colors.secondaryDark,
  },
  lockedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.textTertiary + '40',
  },
  lockedText: {
    ...typography.captionBold,
    color: colors.textTertiary,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  comingSoonText: {
    ...typography.captionBold,
    color: colors.textTertiary,
  },
});

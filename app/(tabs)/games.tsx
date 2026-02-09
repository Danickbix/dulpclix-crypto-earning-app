import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Container } from '@/components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design';
import { TapRace } from '@/components/games/TapRace';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

const GAMES = [
  { id: 'taprace', title: 'Tap Race', description: 'Fastest finger wins tokens!', icon: 'flash', color: colors.primary },
  { id: 'spin', title: 'Spin Wheel', description: 'Try your luck for big rewards.', icon: 'sync', color: colors.accent, comingSoon: true },
  { id: 'puzzle', title: 'Crypto Puzzle', description: 'Solve and earn rewards.', icon: 'extension-puzzle', color: '#60A5FA', comingSoon: true },
];

export default function GamesScreen() {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  if (activeGame === 'taprace') {
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

  return (
    <Container safeArea edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.screenHeader}>
          <Text style={styles.title}>Mini Games</Text>
          <Text style={styles.subtitle}>Play and compete for crypto rewards.</Text>
        </View>

        <View style={styles.grid}>
          {GAMES.map((game, index) => (
            <Animated.View 
              key={game.id}
              entering={FadeIn.duration(400).delay(index * 100)}
              style={styles.gameCard}
            >
              <Pressable 
                style={({ pressed }) => [
                  styles.gameButton,
                  pressed && !game.comingSoon && { transform: [{ scale: 0.98 }], opacity: 0.9 }
                ]}
                onPress={() => !game.comingSoon && setActiveGame(game.id)}
              >
                <View style={[styles.iconContainer, { backgroundColor: game.color + '22' }]}>
                  <Ionicons name={game.icon as any} size={32} color={game.color} />
                </View>
                <Text style={styles.gameTitle}>{game.title}</Text>
                <Text style={styles.gameDescription}>{game.description}</Text>
                
                {game.comingSoon ? (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Coming Soon</Text>
                  </View>
                ) : (
                  <View style={styles.playBadge}>
                    <Text style={styles.playText}>Play Now</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          ))}
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

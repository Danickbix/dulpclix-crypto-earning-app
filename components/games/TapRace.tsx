import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design';
import { Button } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence,
  withTiming,
  FadeIn
} from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';
import { blink } from '@/lib/blink';
import { useQueryClient } from '@tanstack/react-query';

const GAME_DURATION = 10; // seconds

export function TapRace() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const buttonScale = useSharedValue(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const startGame = () => {
    setIsPlaying(true);
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setIsGameOver(false);
  };

  const handleTap = () => {
    if (!isPlaying || isGameOver) return;
    setScore(prev => prev + 1);
    
    buttonScale.value = withSequence(
      withSpring(1.2, { damping: 2, stiffness: 300 }),
      withSpring(1)
    );
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isPlaying) {
      handleGameOver();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, timeLeft]);

  const handleGameOver = async () => {
    setIsPlaying(false);
    setIsGameOver(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const reward = Math.floor(score / 5); // 1 token per 5 taps
    if (reward > 0) {
      saveResult(reward);
    }
  };

  const saveResult = async (reward: number) => {
    if (!user || !profile) return;
    setIsLoading(true);
    try {
      // 1. Update balance
      await blink.db.table('profiles').update(profile.id, {
        balance: (profile.balance || 0) + reward
      });

      // 2. Add transaction
      await blink.db.table('transactions').create({
        userId: user.id,
        amount: reward,
        type: 'earn',
        description: `Tap Race score: ${score}`,
      });

      // 3. Update leaderboard
      const entries = await blink.db.table('leaderboard_entries').list({
        where: { userId: user.id, period: 'all_time' }
      });
      
      if (entries.length > 0) {
        await blink.db.table('leaderboard_entries').update(entries[0].id, {
          score: entries[0].score + score,
          updatedAt: new Date().toISOString()
        });
      } else {
        await blink.db.table('leaderboard_entries').create({
          userId: user.id,
          score: score,
          period: 'all_time'
        });
      }

      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (error) {
      console.error('Failed to save game result:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!isPlaying && !isGameOver ? (
        <Animated.View entering={FadeIn} style={styles.startContainer}>
          <Ionicons name="flash" size={80} color={colors.primary} />
          <Text style={styles.gameTitle}>Tap Race</Text>
          <Text style={styles.gameDescription}>
            Tap as fast as you can for 10 seconds. Every 5 taps earns you 1 DULP token!
          </Text>
          <Button variant="primary" onPress={startGame} style={styles.startButton}>
            Start Race
          </Button>
        </Animated.View>
      ) : isPlaying ? (
        <View style={styles.gameContainer}>
          <View style={styles.stats}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TIME</Text>
              <Text style={[styles.statValue, timeLeft <= 3 && { color: colors.error }]}>
                {timeLeft}s
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SCORE</Text>
              <Text style={styles.statValue}>{score}</Text>
            </View>
          </View>

          <Pressable onPressIn={handleTap} style={styles.tapArea}>
            <Animated.View style={[styles.tapButton, animatedButtonStyle]}>
              <Text style={styles.tapButtonText}>TAP!</Text>
            </Animated.View>
          </Pressable>
        </View>
      ) : (
        <Animated.View entering={FadeIn} style={styles.resultContainer}>
          <Ionicons name="trophy" size={80} color={colors.accent} />
          <Text style={styles.gameTitle}>Race Finished!</Text>
          <Text style={styles.resultScore}>Your Score: {score}</Text>
          <Text style={styles.resultReward}>
            Reward: {Math.floor(score / 5)} DULP
          </Text>
          
          <Button 
            variant="primary" 
            onPress={startGame} 
            loading={isLoading}
            style={styles.startButton}
          >
            Play Again
          </Button>
          <Button 
            variant="ghost" 
            onPress={() => setIsGameOver(false)}
            disabled={isLoading}
          >
            Back to Games
          </Button>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  startContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xxl,
    ...shadows.lg,
  },
  gameTitle: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
  },
  gameDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  startButton: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  gameContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    minWidth: 100,
  },
  statLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  statValue: {
    ...typography.h2,
    color: colors.primary,
  },
  tapArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  tapButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.xl,
  },
  tapButtonText: {
    ...typography.display,
    color: colors.secondaryDark,
    fontWeight: '900',
  },
  resultContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xxl,
    ...shadows.lg,
  },
  resultScore: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.md,
  },
  resultReward: {
    ...typography.h3,
    color: colors.accent,
    marginBottom: spacing.xl,
  },
});

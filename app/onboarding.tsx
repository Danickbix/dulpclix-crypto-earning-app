import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { Container, Button } from '@/components/ui';
import { colors, typography, spacing } from '@/constants/design';
import { router } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Welcome to DulpClix',
    description: 'The premium crypto earning platform gamified for your success.',
    icon: '🚀',
  },
  {
    id: '2',
    title: 'Earn Crypto Easily',
    description: 'Complete simple tasks, watch ads, and play mini-games to earn tokens.',
    icon: '💰',
  },
  {
    id: '3',
    title: 'Join the Community',
    description: 'Invite friends, earn commissions, and compete on the global leaderboard.',
    icon: '🏆',
  },
];

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      router.push('/login');
    }
  };

  const slide = SLIDES[currentSlide];

  return (
    <Container safeArea padding="lg" style={styles.container}>
      <View style={styles.content}>
        <Animated.View 
          key={slide.id}
          entering={FadeInRight.duration(400)}
          exiting={FadeOutLeft.duration(400)}
          style={styles.slide}
        >
          <Text style={styles.icon}>{slide.icon}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                i === currentSlide && styles.activeDot
              ]} 
            />
          ))}
        </View>
        <Button 
          variant="primary" 
          onPress={handleNext}
          fullWidth
        >
          {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
        </Button>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    alignItems: 'center',
    width: width - spacing.lg * 2,
  },
  icon: {
    fontSize: 80,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  footer: {
    paddingBottom: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryTint,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 20,
  },
});

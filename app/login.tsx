import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Container, Button, Input } from '@/components/ui';
import { colors, typography, spacing } from '@/constants/design';
import { blink } from '@/lib/blink';
import { router } from 'expo-router';
import { BlinkAuthError } from '@blinkdotnew/sdk';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await blink.auth.signInWithEmail(email, password);
      } else {
        await blink.auth.signUp({ email, password });
      }
      router.replace('/(tabs)');
    } catch (error) {
      const authError = error as BlinkAuthError;
      Alert.alert('Error', authError.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await blink.auth.signInWithGoogle();
      router.replace('/(tabs)');
    } catch (error) {
      const authError = error as BlinkAuthError;
      if (authError.code !== 'POPUP_CANCELED') {
        Alert.alert('Error', authError.message || 'An error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container safeArea padding="lg">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={styles.subtitle}>
            {isLogin 
              ? 'Login to access your DulpClix wallet' 
              : 'Sign up to start earning crypto rewards'}
          </Text>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            <Button 
              variant="primary" 
              onPress={handleSubmit}
              loading={isLoading}
              style={styles.submitButton}
            >
              {isLogin ? 'Login' : 'Sign Up'}
            </Button>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.line} />
            </View>

            <Button 
              variant="outline" 
              onPress={handleGoogleSignIn}
              loading={isLoading}
              style={styles.googleButton}
            >
              Continue with Google
            </Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </Text>
            <Button 
              variant="ghost" 
              onPress={() => setIsLogin(!isLogin)}
              size="sm"
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  form: {
    gap: spacing.md,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.secondaryTint,
  },
  dividerText: {
    ...typography.small,
    color: colors.textTertiary,
    marginHorizontal: spacing.md,
  },
  googleButton: {
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

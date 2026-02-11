import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Share, Pressable, Alert } from 'react-native';
import { Container, Button, Card, Avatar, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

const ADMIN_EMAIL = 'Danickbix@gmail.com';

export default function ProfileScreen() {
  const { signOut, user, profile, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: referralStats } = useQuery({
    queryKey: ['referralStats', user?.id],
    queryFn: async () => {
      if (!user || !profile) return { count: 0, earnings: 0 };
      const referrals = await blink.db.table('referrals').list({
        where: { referrerId: user.id }
      });
      const earnings = await blink.db.table('transactions').list({
        where: { userId: user.id, type: 'referral' }
      });
      const totalEarnings = earnings.reduce((sum, t) => sum + (t as any).amount, 0);
      return { count: referrals.length, earnings: totalEarnings };
    },
    enabled: !!user && !!profile,
  });

  const onRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    await queryClient.invalidateQueries({ queryKey: ['referralStats'] });
  };

  const handleCopyCode = async () => {
    if (!profile?.referralCode) return;
    await Clipboard.setStringAsync(profile.referralCode);
    Alert.alert('Copied', 'Referral code copied to clipboard!');
  };

  const handleShare = async () => {
    if (!profile?.referralCode) return;
    try {
      await Share.share({
        message: `Join DulpClix and start earning crypto! Use my referral code: ${profile.referralCode}\nDownload now: https://dulpclix.live`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Container safeArea edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <Avatar 
            source={profile?.avatarUrl ? { uri: profile.avatarUrl } : undefined} 
            name={profile?.displayName}
            size="xl"
            style={styles.avatar}
          />
          <Text style={styles.name}>{profile?.displayName || 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>STREAK</Text>
            <Text style={styles.statValue}>{profile?.streakCount || 0} 🔥</Text>
          </View>
          <View style={[styles.statBox, styles.statDivider]}>
            <Text style={styles.statLabel}>REFERRALS</Text>
            <Text style={styles.statValue}>{referralStats?.count || 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>EARNINGS</Text>
            <Text style={styles.statValue}>{profile?.balance?.toLocaleString() || 0}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Refer & Earn</Text>
        <Card variant="elevated" style={styles.referralCard}>
          <View style={styles.referralHeader}>
            <Ionicons name="gift-outline" size={32} color={colors.accent} />
            <View style={styles.referralHeaderText}>
              <Text style={styles.referralTitle}>Invite Friends</Text>
              <Text style={styles.referralSubtitle}>Earn 10% of their earnings forever!</Text>
            </View>
          </View>

          <View style={styles.codeContainer}>
            <View style={styles.codeContent}>
              <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
              <Text style={styles.codeText}>{profile?.referralCode || '------'}</Text>
            </View>
            <Pressable onPress={handleCopyCode} style={styles.copyButton}>
              <Ionicons name="copy-outline" size={24} color={colors.primary} />
            </Pressable>
          </View>

          <Button variant="primary" onPress={handleShare} fullWidth style={styles.shareButton}>
            Share Link
          </Button>
        </Card>

        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.menu}>
          {(user?.email === ADMIN_EMAIL || profile?.role === 'admin') && (
            <Pressable style={styles.menuItem} onPress={() => router.push('/admin')}>
              <Ionicons name="settings-outline" size={24} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.primary }]}>Admin Panel</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </Pressable>
          )}
          <Pressable style={styles.menuItem}>
            <Ionicons name="person-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
          <Pressable style={styles.menuItem}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.menuText}>Security & 2FA</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
          <Pressable style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={signOut}>
            <Ionicons name="log-out-outline" size={24} color={colors.error} />
            <Text style={[styles.menuText, { color: colors.error }]}>Sign Out</Text>
          </Pressable>
        </View>

        <Text style={styles.version}>App Version 1.1.0 (PRO)</Text>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  statValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  referralCard: {
    padding: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xxl,
    marginBottom: spacing.xl,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  referralHeaderText: {
    flex: 1,
  },
  referralTitle: {
    ...typography.h3,
    color: colors.text,
  },
  referralSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  codeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary + '44',
  },
  codeContent: {
    flex: 1,
  },
  codeLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  codeText: {
    ...typography.h3,
    color: colors.primary,
    letterSpacing: 2,
    fontWeight: '800',
  },
  copyButton: {
    padding: spacing.sm,
  },
  shareButton: {
    marginTop: spacing.sm,
  },
  menu: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  version: {
    ...typography.tiny,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});

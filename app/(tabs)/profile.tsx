import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Share, Pressable, Alert, Platform } from 'react-native';
import { Container, Button, Card, Avatar, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

const ADMIN_EMAIL = 'Danickbix@gmail.com';

export default function ProfileScreen() {
  const { signOut, user, profile, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [referralInput, setReferralInput] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTwitter, setEditTwitter] = useState('');
  const [editTelegram, setEditTelegram] = useState('');
  const [editDiscord, setEditDiscord] = useState('');

  // Fetch referral stats from server (bypasses RLS)
  const { data: referralStats } = useQuery({
    queryKey: ['referralStats', user?.id],
    queryFn: async () => {
      if (!user) return { count: 0, earnings: 0, referralCode: null, referredBy: null, referredUsers: [] };
      try {
        const response = await blink.functions.invoke('referral-action', {
          body: { action: 'get_referral_stats' }
        });
        const data = response?.data || response;
        if (data?.error) return { count: 0, earnings: 0, referralCode: profile?.referralCode, referredBy: profile?.referredBy, referredUsers: [] };
        return data;
      } catch {
        return { count: 0, earnings: 0, referralCode: profile?.referralCode, referredBy: profile?.referredBy, referredUsers: [] };
      }
    },
    enabled: !!user,
  });

  // Apply referral code via edge function
  const applyReferralCode = useMutation({
    mutationFn: async (code: string) => {
      const response = await blink.functions.invoke('referral-action', {
        body: { action: 'apply_referral_code', code: code.trim() }
      });
      const data = response?.data || response;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['referralStats'] });
      setReferralInput('');
      setShowReferralInput(false);
      showAlert('Success', data?.message || 'Referral code applied!');
    },
    onError: (error: any) => {
      showAlert('Error', error.message || 'Failed to apply referral code');
    }
  });

  // Update profile via edge function
  const updateProfile = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const response = await blink.functions.invoke('referral-action', {
        body: { action: 'update_profile', ...updates }
      });
      const data = response?.data || response;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowEditProfile(false);
      showAlert('Success', 'Profile updated successfully!');
    },
    onError: (error: any) => {
      showAlert('Error', error.message || 'Failed to update profile');
    }
  });

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const onRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    await queryClient.invalidateQueries({ queryKey: ['referralStats'] });
  };

  const handleCopyCode = async () => {
    const code = referralStats?.referralCode || profile?.referralCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    showAlert('Copied', 'Referral code copied to clipboard!');
  };

  const handleShare = async () => {
    const code = referralStats?.referralCode || profile?.referralCode;
    if (!code) return;
    try {
      await Share.share({
        message: `Join DulpClix and start earning crypto! Use my referral code: ${code}\nDownload now: https://dulpclix.live`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenEdit = () => {
    setEditName(profile?.displayName || '');
    setEditTwitter((profile as any)?.twitterHandle || '');
    setEditTelegram((profile as any)?.telegramUsername || '');
    setEditDiscord((profile as any)?.discordUsername || '');
    setShowEditProfile(true);
  };

  const handleSaveProfile = () => {
    const updates: Record<string, string> = {};
    if (editName && editName !== profile?.displayName) updates.displayName = editName;
    if (editTwitter !== ((profile as any)?.twitterHandle || '')) updates.twitterHandle = editTwitter;
    if (editTelegram !== ((profile as any)?.telegramUsername || '')) updates.telegramUsername = editTelegram;
    if (editDiscord !== ((profile as any)?.discordUsername || '')) updates.discordUsername = editDiscord;
    
    if (Object.keys(updates).length === 0) {
      showAlert('Info', 'No changes to save');
      return;
    }
    updateProfile.mutate(updates);
  };

  const displayCode = referralStats?.referralCode || profile?.referralCode || '------';
  const referredBy = referralStats?.referredBy || profile?.referredBy;
  const referralCount = referralStats?.count || 0;
  const referralEarnings = referralStats?.earnings || 0;

  return (
    <Container safeArea edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {(user?.email === ADMIN_EMAIL || profile?.role === 'admin') && (
          <Card variant="outline" style={styles.adminBanner}>
            <View style={styles.adminBannerContent}>
              <View>
                <Text style={styles.adminBannerTitle}>ADMIN ACCESS</Text>
                <Text style={styles.adminBannerSubtitle}>You have full control over the platform.</Text>
              </View>
              <Button 
                variant="primary" 
                size="sm" 
                onPress={() => router.push('/admin')}
                leftIcon={<Ionicons name="shield-checkmark" size={16} color="white" />}
              >
                Launch Dashboard
              </Button>
            </View>
          </Card>
        )}

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
            <Text style={styles.statValue}>{referralCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>BALANCE</Text>
            <Text style={styles.statValue}>{(profile?.balance || 0).toLocaleString()}</Text>
          </View>
        </View>

        {/* Refer & Earn Section */}
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
              <Text style={styles.codeText}>{displayCode}</Text>
            </View>
            <Pressable onPress={handleCopyCode} style={styles.copyButton}>
              <Ionicons name="copy-outline" size={24} color={colors.primary} />
            </Pressable>
          </View>

          <Button variant="primary" onPress={handleShare} fullWidth style={styles.shareButton}>
            Share Invite Link
          </Button>

          {referredBy ? (
            <View style={styles.referredByContainer}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.referredByText}>Referred by: {referredBy}</Text>
            </View>
          ) : (
            <View style={styles.enterReferralContainer}>
              {showReferralInput ? (
                <View style={styles.referralInputRow}>
                  <Input
                    placeholder="Enter referral code"
                    value={referralInput}
                    onChangeText={setReferralInput}
                    autoCapitalize="characters"
                    containerStyle={styles.referralInputContainer}
                  />
                  <Button 
                    variant="primary" 
                    size="sm" 
                    loading={applyReferralCode.isPending}
                    onPress={() => referralInput.trim() && applyReferralCode.mutate(referralInput)}
                  >
                    Apply
                  </Button>
                </View>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onPress={() => setShowReferralInput(true)}
                  fullWidth
                  style={{ marginTop: spacing.md }}
                >
                  Have a referral code? Enter it here
                </Button>
              )}
            </View>
          )}

          {referralCount > 0 && (
            <View style={styles.referralStatsRow}>
              <View style={styles.referralStatBox}>
                <Text style={styles.referralStatNum}>{referralCount}</Text>
                <Text style={styles.referralStatLabel}>Friends Invited</Text>
              </View>
              <View style={styles.referralStatBox}>
                <Text style={styles.referralStatNum}>{referralEarnings.toLocaleString()}</Text>
                <Text style={styles.referralStatLabel}>DULP Earned</Text>
              </View>
            </View>
          )}

          {referralStats?.referredUsers && referralStats.referredUsers.length > 0 && (
            <View style={styles.referredListContainer}>
              <Text style={styles.referredListTitle}>Your Referrals</Text>
              {referralStats.referredUsers.map((u: any, i: number) => (
                <View key={i} style={styles.referredUserRow}>
                  <Ionicons name="person-circle" size={20} color={colors.textSecondary} />
                  <Text style={styles.referredUserName}>{u.displayName}</Text>
                  <Text style={styles.referredUserDate}>
                    {u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Edit Profile Section */}
        {showEditProfile && (
          <>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            <Card variant="elevated" style={styles.editCard}>
              <Input
                label="Display Name"
                value={editName}
                onChangeText={setEditName}
                placeholder="Your display name"
                containerStyle={styles.editInput}
              />
              <Input
                label="Twitter Handle"
                value={editTwitter}
                onChangeText={setEditTwitter}
                placeholder="@username"
                containerStyle={styles.editInput}
              />
              <Input
                label="Telegram Username"
                value={editTelegram}
                onChangeText={setEditTelegram}
                placeholder="@username"
                containerStyle={styles.editInput}
              />
              <Input
                label="Discord Username"
                value={editDiscord}
                onChangeText={setEditDiscord}
                placeholder="username#1234"
                containerStyle={styles.editInput}
              />
              <View style={styles.editActions}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onPress={() => setShowEditProfile(false)} 
                  style={{ flex: 1, marginRight: spacing.sm }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  loading={updateProfile.isPending}
                  onPress={handleSaveProfile}
                  style={{ flex: 1 }}
                >
                  Save Changes
                </Button>
              </View>
            </Card>
          </>
        )}

        {/* Settings Menu */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.menu}>
          {(user?.email === ADMIN_EMAIL || profile?.role === 'admin') && (
            <Pressable style={styles.menuItem} onPress={() => router.push('/admin')}>
              <Ionicons name="settings-outline" size={24} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.primary }]}>Admin Panel</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </Pressable>
          )}
          <Pressable style={styles.menuItem} onPress={handleOpenEdit}>
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

        <Text style={styles.version}>App Version 1.2.0 (PRO)</Text>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  adminBanner: {
    marginBottom: spacing.lg,
    backgroundColor: colors.primary + '11',
    borderColor: colors.primary,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  adminBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  adminBannerTitle: {
    ...typography.captionBold,
    color: colors.primary,
  },
  adminBannerSubtitle: {
    ...typography.tiny,
    color: colors.textSecondary,
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
  referredByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  referredByText: {
    ...typography.caption,
    color: colors.success,
  },
  enterReferralContainer: {
    marginTop: spacing.sm,
  },
  referralInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  referralInputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  referralStatsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    gap: spacing.lg,
  },
  referralStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  referralStatNum: {
    ...typography.h3,
    color: colors.primary,
  },
  referralStatLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  referredListContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  referredListTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  referredUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  referredUserName: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  referredUserDate: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  editCard: {
    padding: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
  },
  editInput: {
    marginBottom: spacing.md,
  },
  editActions: {
    flexDirection: 'row',
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

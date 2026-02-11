import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, FlatList, Pressable, Alert, Share } from 'react-native';
import { Container, Button, Card, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { blink } from '@/lib/blink';
import { TransactionRow } from '@/components/wallet/TransactionRow';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  createdAt: string;
}

export default function WalletScreen() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('history');
  const [showReceive, setShowReceive] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');

  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await blink.db.table('transactions').list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }) as Transaction[];
    },
    enabled: !!user,
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const response = await blink.functions.invoke('request-withdrawal', {
        body: { 
          amount: parseFloat(withdrawAmount), 
          address: withdrawAddress 
        }
      });

      const data = response?.data || response;
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowWithdraw(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      Alert.alert('Success', data?.message || 'Withdrawal submitted successfully.');
    },
    onError: (error: any) => {
      Alert.alert('Withdrawal Failed', error.message || 'Something went wrong');
    },
  });

  const handleWithdraw = () => {
    if (!withdrawAmount || !withdrawAddress) {
      Alert.alert('Error', 'Please enter amount and address');
      return;
    }
    withdrawMutation.mutate();
  };

  const onRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
      refetch()
    ]);
  };

  const handleCopyAddress = async () => {
    if (!profile?.referralCode) return;
    await Clipboard.setStringAsync(profile.referralCode);
    Alert.alert('Copied', 'Wallet address copied to clipboard!');
  };

  const handleShareAddress = async () => {
    if (!profile?.referralCode) return;
    try {
      await Share.share({
        message: `My DulpClix Wallet Address: ${profile.referralCode}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Card variant="elevated" style={styles.balanceCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>TOTAL BALANCE</Text>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
        </View>
        <Text style={styles.balanceText}>{profile?.balance?.toLocaleString() || '0'}</Text>
        <Text style={styles.tokenText}>DULP Tokens</Text>
        <Text style={styles.usdText}>≈ ${( (profile?.balance || 0) * 0.05 ).toFixed(2)} USD</Text>
        
        <View style={styles.cardActions}>
          <Button 
            variant="primary" 
            size="sm" 
            style={styles.cardButton}
            onPress={() => setShowWithdraw(true)}
          >
            Withdraw
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            style={styles.cardButton}
            onPress={() => setShowReceive(true)}
          >
            Receive
          </Button>
        </View>
      </Card>

      {showReceive && (
        <Card variant="elevated" style={styles.receiveCard}>
          <View style={styles.receiveHeader}>
            <Text style={styles.receiveTitle}>Receive DULP</Text>
            <Pressable onPress={() => setShowReceive(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.receiveSubtitle}>Use this address to receive tokens from other users.</Text>
          
          <View style={styles.addressBox}>
            <Text style={styles.addressText}>{profile?.referralCode}</Text>
            <Pressable onPress={handleCopyAddress} style={styles.copyButton}>
              <Ionicons name="copy" size={20} color={colors.primary} />
            </Pressable>
          </View>

          <Button variant="primary" onPress={handleShareAddress} fullWidth>
            Share Address
          </Button>
        </Card>
      )}

      {showWithdraw && (
        <Card variant="elevated" style={styles.receiveCard}>
          <View style={styles.receiveHeader}>
            <Text style={styles.receiveTitle}>Withdraw DULP</Text>
            <Pressable onPress={() => setShowWithdraw(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.receiveSubtitle}>Minimum withdrawal: 100 DULP. Processed within 24 hours.</Text>
          
          <Input
            label="Amount (DULP)"
            placeholder="Min 100"
            keyboardType="numeric"
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
            containerStyle={styles.inputContainer}
          />

          <Input
            label="Wallet Address"
            placeholder="Enter destination address"
            value={withdrawAddress}
            onChangeText={setWithdrawAddress}
            containerStyle={styles.inputContainer}
          />

          <Button 
            variant="primary" 
            onPress={handleWithdraw} 
            loading={withdrawMutation.isPending}
            fullWidth
          >
            Submit Withdrawal
          </Button>
        </Card>
      )}

      <View style={styles.tabs}>
        <Pressable 
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>Transaction History</Text>
        </Pressable>
        {/* Could add 'Stats' tab here */}
      </View>
    </View>
  );

  return (
    <Container safeArea edges={['top']}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={onRefresh} 
            tintColor={colors.primary} 
          />
        }
        ListEmptyComponent={
          !isLoading && (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No transactions yet.</Text>
            </View>
          )
        }
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.xl,
  },
  balanceCard: {
    padding: spacing.xl,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xxl,
    marginBottom: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  balanceText: {
    ...typography.display,
    fontSize: 48,
    color: colors.text,
    lineHeight: 56,
  },
  tokenText: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: 4,
  },
  usdText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardButton: {
    flex: 1,
  },
  receiveCard: {
    padding: spacing.lg,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  receiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  receiveTitle: {
    ...typography.h3,
    color: colors.text,
  },
  receiveSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  addressText: {
    ...typography.bodyBold,
    color: colors.primary,
    flex: 1,
    letterSpacing: 1,
  },
  copyButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tab: {
    paddingBottom: spacing.md,
    marginRight: spacing.xl,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.bodyBold,
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.text,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
  },
});

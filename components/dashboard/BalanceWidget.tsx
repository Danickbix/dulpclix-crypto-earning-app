import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design';
import { Button } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface BalanceWidgetProps {
  balance: number;
  tokenName?: string;
  isActivated?: boolean | number;
  level?: number;
  xpProgress?: number;
}

export function BalanceWidget({ 
  balance, 
  tokenName = 'DULP', 
  isActivated,
  level = 1,
  xpProgress = 0
}: BalanceWidgetProps) {
  const usdValue = (balance * 0.05).toFixed(2); // Mock rate: 1 DULP = $0.05

  return (
    <Animated.View 
      entering={FadeInDown.duration(600).delay(200)}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.label}>Wallet Balance</Text>
        <Ionicons name="wallet-outline" size={20} color={colors.primary} />
      </View>
      
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceText}>{balance.toLocaleString()}</Text>
        <Text style={styles.tokenText}>{tokenName}</Text>
      </View>
      
      <Text style={styles.usdText}>≈ ${usdValue} USD</Text>

      <View style={styles.xpSection}>
        <View style={styles.xpHeader}>
          <Text style={styles.levelText}>Level {level}</Text>
          <View style={[styles.statusBadge, isActivated ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, isActivated ? styles.activeStatusText : styles.inactiveStatusText]}>
              {isActivated ? 'Activated' : 'Unactivated'}
            </Text>
          </View>
        </View>
        <View style={styles.xpBarContainer}>
          <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]} />
        </View>
        <Text style={styles.xpSubtext}>XP Progress to Level {level + 1}</Text>
      </View>
      
      <View style={styles.actions}>
        <Button 
          variant="primary" 
          size="sm" 
          style={styles.actionButton}
          leftIcon={<Ionicons name="arrow-up" size={16} color={colors.secondaryDark} />}
        >
          Send
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          style={styles.actionButton}
          leftIcon={<Ionicons name="arrow-down" size={16} color={colors.primary} />}
        >
          Receive
        </Button>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  balanceText: {
    ...typography.display,
    fontSize: 44,
    color: colors.primary,
    fontWeight: '800',
  },
  tokenText: {
    ...typography.h3,
    color: colors.primary,
    marginLeft: spacing.xs,
    opacity: 0.8,
  },
  usdText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  xpSection: {
    marginBottom: spacing.lg,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  levelText: {
    ...typography.smallBold,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  activeBadge: {
    backgroundColor: colors.success + '20',
  },
  inactiveBadge: {
    backgroundColor: colors.warning + '20',
  },
  statusText: {
    ...typography.tiny,
    fontWeight: '700',
  },
  activeStatusText: {
    color: colors.success,
  },
  inactiveStatusText: {
    color: colors.warning,
  },
  xpBarContainer: {
    height: 8,
    backgroundColor: colors.background + '20',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: 4,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  xpSubtext: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});

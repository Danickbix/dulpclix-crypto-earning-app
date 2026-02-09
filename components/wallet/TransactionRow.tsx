import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  createdAt: string;
}

interface TransactionRowProps {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const isEarn = transaction.type === 'earn' || transaction.type === 'referral';
  
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: (isEarn ? colors.success : colors.error) + '22' }]}>
        <Ionicons 
          name={isEarn ? 'arrow-down-outline' : 'arrow-up-outline'} 
          size={20} 
          color={isEarn ? colors.success : colors.error} 
        />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.description} numberOfLines={1}>{transaction.description}</Text>
        <Text style={styles.date}>{new Date(transaction.createdAt).toLocaleDateString()}</Text>
      </View>
      
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: isEarn ? colors.success : colors.text }]}>
          {isEarn ? '+' : '-'}{Math.abs(transaction.amount)} DULP
        </Text>
        <Text style={styles.status}>{transaction.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  description: {
    ...typography.bodyBold,
    color: colors.text,
  },
  date: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    ...typography.bodyBold,
  },
  status: {
    ...typography.tiny,
    color: colors.textTertiary,
    textTransform: 'capitalize',
  },
});

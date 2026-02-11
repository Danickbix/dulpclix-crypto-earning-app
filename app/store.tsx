import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Container, Button, Card, Avatar } from '@/components/ui';
import { colors, spacing, typography, shadows, borderRadius } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { useAuth } from '@/context/AuthContext';

export default function StoreScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('all');

  const { data: items, isLoading } = useQuery({
    queryKey: ['store_items'],
    queryFn: async () => {
      return await blink.db.table('store_items').list({ where: { is_active: 1 } });
    }
  });

  const buyItem = useMutation({
    mutationFn: async (itemId: string) => {
      // In a real app, use an edge function to validate balance and apply boost
      return await blink.functions.invoke('purchase-item', {
        body: { itemId }
      });
    },
    onSuccess: (data: any) => {
      if (data.error) {
        Alert.alert('Error', data.error);
      } else {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        Alert.alert('Success', 'Item purchased successfully!');
      }
    }
  });

  const categories = ['all', 'booster', 'powerup', 'cosmetic'];

  const filteredItems = items?.filter(item => 
    activeCategory === 'all' || item.category === activeCategory
  );

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <Stack.Screen options={{ title: 'Premium Store', headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Store</Text>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceText}>{profile?.balance || 0} DULP</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[styles.categoryBtn, activeCategory === cat && styles.activeCategory]}
          >
            <Text style={[styles.categoryText, activeCategory === cat && styles.activeCategoryText]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        {isLoading ? (
          <Text style={styles.statusText}>Loading items...</Text>
        ) : (
          <View style={styles.grid}>
            {filteredItems?.map(item => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.iconContainer}>
                  <Ionicons 
                    name={item.category === 'booster' ? 'flash' : item.category === 'powerup' ? 'sparkles' : 'shirt'} 
                    size={32} 
                    color={colors.primary} 
                  />
                </View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDesc}>{item.description}</Text>
                <View style={styles.footer}>
                  <Text style={styles.price}>{item.price} DULP</Text>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={buyItem.isPending || (profile?.balance || 0) < item.price}
                    onPress={() => buyItem.mutate(item.id)}
                  >
                    Buy
                  </Button>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  balanceContainer: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderBottomColor: colors.secondaryTint,
  },
  balanceText: {
    ...typography.smallBold,
    color: colors.primary,
  },
  categories: {
    paddingHorizontal: spacing.md,
    maxHeight: 50,
    marginBottom: spacing.md,
  },
  categoryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
  },
  activeCategory: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    ...typography.smallBold,
    color: colors.textSecondary,
  },
  activeCategoryText: {
    color: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemCard: {
    width: '48%',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemName: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  itemDesc: {
    ...typography.tiny,
    color: colors.textSecondary,
    textAlign: 'center',
    height: 40,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  price: {
    ...typography.smallBold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  statusText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 50,
  },
});

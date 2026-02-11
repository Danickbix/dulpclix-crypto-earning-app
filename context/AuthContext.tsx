import React, { createContext, useContext, useEffect, useState } from 'react';
import { blink } from '@/lib/blink';
import { BlinkUser } from '@blinkdotnew/sdk';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Profile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  balance: number;
  referralCode: string;
  referredBy: string | null;
  streakCount: number;
  lastStreakAt: string | null;
  createdAt: string;
  role: string;
  twitterHandle: string | null;
  telegramUsername: string | null;
}

interface AuthContextType {
  user: BlinkUser | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<BlinkUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
      setIsLoadingAuth(state.isLoading);
    });
    return unsubscribe;
  }, []);

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const profiles = await blink.db.table('profiles').list({
        where: { userId: user.id },
      });
      
      const isAdmin = user.email === 'Danickbix@gmail.com';
      
      if (profiles.length === 0) {
        // Create profile if it doesn't exist
        const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const referredBy = user.metadata?.referredBy as string | undefined;

        const newProfile = await blink.db.table('profiles').create({
          userId: user.id,
          displayName: user.displayName || 'User',
          avatarUrl: user.avatarUrl || '',
          balance: 0,
          referralCode,
          referredBy: referredBy || null,
          streakCount: 0,
          role: isAdmin ? 'admin' : 'user',
        });

        // Create initial XP profile
        await blink.db.table('xp_profiles').create({
          id: user.id,
          userId: user.id,
          xp: 0,
          level: 1,
          totalEarned: 0,
        }).catch(err => console.log('XP Profile creation skipped or failed:', err));

        return newProfile as Profile;
      }
      
      const existingProfile = profiles[0] as Profile;
      
      // Update role if user is admin and profile role is not admin
      if (isAdmin && existingProfile.role !== 'admin') {
        const updatedProfile = await blink.db.table('profiles').update(existingProfile.id, {
          role: 'admin'
        });
        return updatedProfile as Profile;
      }
      
      return existingProfile;
    },
    enabled: !!user,
  });

  const signOut = async () => {
    await blink.auth.signOut();
    queryClient.clear();
  };

  const value = {
    user,
    profile: profile || null,
    isLoading: isLoadingAuth || (!!user && isLoadingProfile),
    isAuthenticated: !!user,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

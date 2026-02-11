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
  isActivated: number;
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
      
      if (profiles.length === 0) {
        // Create profile if it doesn't exist
        const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newProfile = await blink.db.table('profiles').create({
          userId: user.id,
          displayName: user.displayName || 'User',
          avatarUrl: user.avatarUrl || '',
          balance: 0,
          referralCode,
          streakCount: 0,
        });
        return newProfile as Profile;
      }
      return profiles[0] as Profile;
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

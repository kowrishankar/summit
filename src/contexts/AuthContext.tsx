import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Subscription } from '../types';
import * as authService from '../services/auth';
import { getSubscriptionForUser, hasActiveAccess } from '../services/subscription';

interface AuthContextValue {
  user: User | null;
  subscription: Subscription | null;
  hasActiveSubscription: boolean;
  loading: boolean;
  refreshSubscription: (userId?: string) => Promise<Subscription | null>;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (
    email: string,
    password: string,
    businessName?: string,
    businessAddress?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; token?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSubscription = useCallback(async (userId: string): Promise<Subscription | null> => {
    const sub = await getSubscriptionForUser(userId);
    setSubscription(sub);
    return sub;
  }, []);

  const refreshSubscription = useCallback(
    async (userId?: string): Promise<Subscription | null> => {
      const id = userId ?? user?.id;
      if (!id) return null;
      return loadSubscription(id);
    },
    [user?.id, loadSubscription]
  );

  const loadUser = useCallback(async () => {
    const u = await authService.getCurrentUser();
    setUser(u);
    if (u?.id) await loadSubscription(u.id);
    setLoading(false);
  }, [loadSubscription]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const hasActiveSubscription = !!subscription && hasActiveAccess(subscription);

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await authService.login(email, password);
      setUser(u);
      if (u?.id) await loadSubscription(u.id);
      return !!u;
    },
    [loadSubscription]
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      businessName?: string,
      businessAddress?: string
    ) => {
      try {
        const u = await authService.signup(email, password, businessName, businessAddress);
        setUser(u);
        if (u?.id) await loadSubscription(u.id);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Signup failed' };
      }
    },
    [loadSubscription]
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    return authService.requestPasswordResetAsync(email);
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    return authService.resetPassword(token, newPassword);
  }, []);

  const value: AuthContextValue = {
    user,
    subscription,
    hasActiveSubscription,
    loading,
    refreshSubscription,
    login,
    signup,
    logout,
    requestPasswordReset,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Subscription } from '../types';
import * as supabaseAuth from '../services/supabaseAuth';
import { addBusiness, setCurrentBusinessId } from '../services/supabaseData';
import { hasActiveAccess, resolveBillingAndSubscription } from '../services/subscription';

interface AuthContextValue {
  user: User | null;
  subscription: Subscription | null;
  /** User id whose subscription grants app access (same as user when you are the subscriber). */
  billingUserId: string;
  /** Signed in as a collaborator using the owner's subscription. */
  isTeamMember: boolean;
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
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; token?: string; error?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingUserId, setBillingUserId] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSubscription = useCallback(async (userId: string): Promise<Subscription | null> => {
    try {
      const { subscription: sub, billingUserId: bid } = await resolveBillingAndSubscription(userId);
      setSubscription(sub);
      setBillingUserId(bid);
      return sub;
    } catch {
      setSubscription(null);
      setBillingUserId(userId);
      return null;
    }
  }, []);

  const refreshSubscription = useCallback(
    async (userId?: string): Promise<Subscription | null> => {
      const id = userId ?? user?.id;
      if (!id) return null;
      return loadSubscription(id);
    },
    [user?.id, loadSubscription]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await supabaseAuth.getSession();
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user?.id) await loadSubscription(session.user.id);
      setLoading(false);
    })();
    const unsubscribe = supabaseAuth.onAuthStateChange((u) => {
      if (!cancelled) {
        setUser(u);
        if (u?.id) loadSubscription(u.id);
        else {
          setSubscription(null);
          setBillingUserId('');
        }
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadSubscription]);

  const hasActiveSubscription = !!subscription && hasActiveAccess(subscription);

  const isTeamMember = useMemo(
    () => !!user && billingUserId.length > 0 && user.id !== billingUserId,
    [user, billingUserId]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await supabaseAuth.signIn(email, password);
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
        const u = await supabaseAuth.signUp(email, password, businessName, businessAddress);
        setUser(u);
        if (u?.id) {
          await loadSubscription(u.id);
          if (businessName?.trim()) {
            await addBusiness(u.id, businessName.trim(), businessAddress?.trim());
            const businesses = await import('../services/supabaseData').then((m) =>
              m.getBusinessAccounts(u.id)
            );
            const first = businesses[0];
            if (first) await setCurrentBusinessId(u.id, first.id);
          }
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Signup failed' };
      }
    },
    [loadSubscription]
  );

  const logout = useCallback(async () => {
    await supabaseAuth.signOut();
    setUser(null);
    setSubscription(null);
    setBillingUserId('');
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const result = await supabaseAuth.requestPasswordReset(email);
    if (result.ok) return { ok: true };
    return { ok: false, error: result.error };
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    const ok = await supabaseAuth.resetPasswordWithToken(token, newPassword);
    if (ok) return true;
    return supabaseAuth.updatePassword(newPassword).then((r) => r.ok);
  }, []);

  const value: AuthContextValue = {
    user,
    subscription,
    billingUserId,
    isTeamMember,
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

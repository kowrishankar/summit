import { supabase } from '../lib/supabase';
import type { User } from '../types';

export async function signUp(
  email: string,
  password: string,
  _businessName?: string,
  _businessAddress?: string
): Promise<User> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: undefined },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Signup failed');
  return mapAuthUser(data.user);
}

export async function signIn(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return null;
  if (!data.user) return null;
  return mapAuthUser(data.user);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<{ user: User } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return { user: mapAuthUser(session.user) };
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? mapAuthUser(session.user) : null);
  });
  return () => subscription.unsubscribe();
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  const redirectTo = 'summit://reset-password';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Call after user opens app via reset link; tokenHash is from the URL. */
export async function resetPasswordWithToken(tokenHash: string, newPassword: string): Promise<boolean> {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  });
  if (error) return false;
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) return false;
  return true;
}

/** Update password when already authenticated (e.g. after recovery link opened and session exists). */
export async function updatePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function mapAuthUser(u: { id: string; email?: string }): User {
  return {
    id: u.id,
    email: u.email ?? '',
    createdAt: new Date().toISOString(),
  };
}

import { storage } from './storage';
import type { User, BusinessAccount } from '../types';
import { v4 as uuidv4 } from 'uuid';

// In-memory "forgot password" tokens for demo (replace with real email/backend in production)
const resetTokens: Record<string, { userId: string; expires: number }> = {};

export async function login(email: string, password: string): Promise<User | null> {
  const users = await storage.getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) return null;
  await storage.setSession({ userId: user.id, email: user.email });
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export async function signup(
  email: string,
  password: string,
  businessName?: string,
  businessAddress?: string
): Promise<User> {
  const users = await storage.getUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const user: User & { password: string } = {
    id: uuidv4(),
    email: email.trim(),
    createdAt: new Date().toISOString(),
    password,
  };
  await storage.setUsers([...users, user]);
  await storage.setSession({ userId: user.id, email: user.email });

  if (businessName?.trim()) {
    const now = new Date().toISOString();
    const business: BusinessAccount = {
      id: uuidv4(),
      name: businessName.trim(),
      address: businessAddress?.trim(),
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    };
    const all = await storage.getBusinessAccounts();
    await storage.setBusinessAccounts([...all, business]);
    await storage.setCurrentBusinessId(business.id);
  }

  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export async function logout(): Promise<void> {
  await storage.setSession(null);
  await storage.setCurrentBusinessId(null);
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await storage.getSession();
  if (!session) return null;
  const users = await storage.getUsers();
  const user = users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export async function requestPasswordResetAsync(email: string): Promise<{ ok: boolean; token?: string }> {
  const users = await storage.getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { ok: false };
  const token = uuidv4();
  resetTokens[token] = { userId: user.id, expires: Date.now() + 3600000 };
  if (__DEV__) {
    return { ok: true, token };
  }
  return { ok: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const entry = resetTokens[token];
  if (!entry || entry.expires < Date.now()) return false;
  const users = await storage.getUsers();
  const idx = users.findIndex((u) => u.id === entry.userId);
  if (idx === -1) return false;
  users[idx].password = newPassword;
  await storage.setUsers(users);
  delete resetTokens[token];
  return true;
}

export function consumeResetToken(token: string): boolean {
  if (resetTokens[token]) {
    delete resetTokens[token];
    return true;
  }
  return false;
}

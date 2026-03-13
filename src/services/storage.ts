import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, BusinessAccount, Invoice, Sale, Category, Subscription } from '../types';

const KEYS = {
  USERS: 'di_users',
  BUSINESS_ACCOUNTS: 'di_business_accounts',
  INVOICES: 'di_invoices',
  SALES: 'di_sales',
  CATEGORIES: 'di_categories',
  SESSION: 'di_session',
  CURRENT_BUSINESS: 'di_current_business',
  SUBSCRIPTIONS: 'di_subscriptions',
} as const;

export interface Session {
  userId: string;
  email: string;
}

export interface StoredData {
  users: (User & { password: string })[];
  businessAccounts: BusinessAccount[];
  invoices: Invoice[];
  categories: Category[];
}

async function getStored<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

async function setStored<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  async getSession(): Promise<Session | null> {
    return getStored<Session | null>(KEYS.SESSION, null);
  },
  async setSession(session: Session | null): Promise<void> {
    await setStored(KEYS.SESSION, session);
  },
  async getCurrentBusinessId(): Promise<string | null> {
    return getStored<string | null>(KEYS.CURRENT_BUSINESS, null);
  },
  async setCurrentBusinessId(id: string | null): Promise<void> {
    await setStored(KEYS.CURRENT_BUSINESS, id);
  },
  async getUsers(): Promise<(User & { password: string })[]> {
    return getStored(KEYS.USERS, []);
  },
  async setUsers(users: (User & { password: string })[]): Promise<void> {
    await setStored(KEYS.USERS, users);
  },
  async getBusinessAccounts(): Promise<BusinessAccount[]> {
    return getStored(KEYS.BUSINESS_ACCOUNTS, []);
  },
  async setBusinessAccounts(accounts: BusinessAccount[]): Promise<void> {
    await setStored(KEYS.BUSINESS_ACCOUNTS, accounts);
  },
  async getInvoices(): Promise<Invoice[]> {
    return getStored(KEYS.INVOICES, []);
  },
  async setInvoices(invoices: Invoice[]): Promise<void> {
    await setStored(KEYS.INVOICES, invoices);
  },
  async getSales(): Promise<Sale[]> {
    return getStored(KEYS.SALES, []);
  },
  async setSales(sales: Sale[]): Promise<void> {
    await setStored(KEYS.SALES, sales);
  },
  async getCategories(): Promise<Category[]> {
    return getStored(KEYS.CATEGORIES, []);
  },
  async setCategories(categories: Category[]): Promise<void> {
    await setStored(KEYS.CATEGORIES, categories);
  },
  async getSubscriptions(): Promise<Subscription[]> {
    return getStored(KEYS.SUBSCRIPTIONS, []);
  },
  async setSubscriptions(subscriptions: Subscription[]): Promise<void> {
    await setStored(KEYS.SUBSCRIPTIONS, subscriptions);
  },
};

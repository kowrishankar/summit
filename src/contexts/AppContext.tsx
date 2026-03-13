import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../services/storage';
import type { BusinessAccount, Invoice, Sale, Category, ExtractedInvoiceData, InvoiceFilters } from '../types';
import { useAuth } from './AuthContext';
import { startOfWeek, startOfMonth, startOfYear } from 'date-fns';

interface SpendSummary {
  week: number;
  month: number;
  year: number;
  taxWeek: number;
  taxMonth: number;
  taxYear: number;
}

interface AppContextValue {
  businesses: BusinessAccount[];
  currentBusiness: BusinessAccount | null;
  switchBusiness: (id: string) => Promise<void>;
  addBusiness: (name: string, address?: string) => Promise<BusinessAccount>;
  updateBusiness: (id: string, patch: { name?: string; address?: string }) => Promise<void>;
  invoices: Invoice[];
  sales: Sale[];
  categories: Category[];
  loadInvoices: () => Promise<void>;
  loadSales: () => Promise<void>;
  loadCategories: () => Promise<void>;
  addInvoice: (inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Invoice>;
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Sale>;
  updateInvoice: (id: string, patch: Partial<Invoice>) => Promise<void>;
  updateSale: (id: string, patch: Partial<Sale>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  addCategory: (name: string, color?: string) => Promise<Category>;
  updateCategory: (id: string, patch: { name?: string; color?: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  searchInvoices: (query: string, filters?: InvoiceFilters) => Invoice[];
  searchSales: (query: string, filters?: InvoiceFilters) => Sale[];
  spendSummary: SpendSummary;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessAccount[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<BusinessAccount | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadBusinesses = useCallback(async () => {
    if (!user) return;
    const all = await storage.getBusinessAccounts();
    setBusinesses(all.filter((b) => b.userId === user.id));
    const currentId = await storage.getCurrentBusinessId();
    if (currentId) {
      const b = all.find((x) => x.id === currentId);
      if (b && b.userId === user.id) setCurrentBusiness(b);
      else setCurrentBusiness(all.filter((x) => x.userId === user.id)[0] ?? null);
    } else {
      const first = all.filter((x) => x.userId === user.id)[0];
      setCurrentBusiness(first ?? null);
      if (first) await storage.setCurrentBusinessId(first.id);
    }
  }, [user]);

  const loadInvoices = useCallback(async (businessId?: string) => {
    const bid = businessId ?? currentBusiness?.id;
    const all = await storage.getInvoices();
    if (bid) {
      setInvoices(all.filter((i) => i.businessId === bid));
    } else {
      setInvoices([]);
    }
  }, [currentBusiness?.id]);

  const loadCategories = useCallback(async (businessId?: string) => {
    const bid = businessId ?? currentBusiness?.id;
    const all = await storage.getCategories();
    if (bid) {
      setCategories(all.filter((c) => c.businessId === bid));
    } else {
      setCategories([]);
    }
  }, [currentBusiness?.id]);

  const loadSales = useCallback(async (businessId?: string) => {
    const bid = businessId ?? currentBusiness?.id;
    const all = await storage.getSales();
    if (bid) {
      setSales(all.filter((s) => s.businessId === bid));
    } else {
      setSales([]);
    }
  }, [currentBusiness?.id]);

  const switchBusiness = useCallback(async (id: string) => {
    await storage.setCurrentBusinessId(id);
    const all = await storage.getBusinessAccounts();
    const b = all.find((x) => x.id === id);
    setCurrentBusiness(b ?? null);
    await loadInvoices(id);
    await loadSales(id);
    await loadCategories(id);
  }, [loadInvoices, loadSales, loadCategories]);

  useEffect(() => {
    loadBusinesses();
  }, [user, loadBusinesses]);

  useEffect(() => {
    if (currentBusiness) {
      loadInvoices();
      loadSales();
      loadCategories();
    } else {
      setInvoices([]);
      setSales([]);
      setCategories([]);
    }
  }, [currentBusiness, loadInvoices, loadSales, loadCategories]);

  const addBusiness = useCallback(
    async (name: string, address?: string) => {
      if (!user) throw new Error('Not logged in');
      const now = new Date().toISOString();
      const all = await storage.getBusinessAccounts();
      const newB: BusinessAccount = {
        id: uuidv4(),
        name: name.trim(),
        address: address?.trim(),
        userId: user.id,
        createdAt: now,
        updatedAt: now,
      };
      await storage.setBusinessAccounts([...all, newB]);
      setBusinesses((prev) => [...prev, newB]);
      if (!currentBusiness) {
        setCurrentBusiness(newB);
        await storage.setCurrentBusinessId(newB.id);
      }
      return newB;
    },
    [user, currentBusiness]
  );

  const updateBusiness = useCallback(async (id: string, patch: { name?: string; address?: string }) => {
    const all = await storage.getBusinessAccounts();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const now = new Date().toISOString();
    const updated: BusinessAccount = { ...all[idx], ...patch, updatedAt: now };
    all[idx] = updated;
    await storage.setBusinessAccounts(all);
    setBusinesses((prev) => prev.map((b) => (b.id === id ? updated : b)));
    if (currentBusiness?.id === id) setCurrentBusiness(updated);
  }, [currentBusiness?.id]);

  const addInvoice = useCallback(
    async (inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!currentBusiness) throw new Error('No business selected');
      const now = new Date().toISOString();
      const newInv: Invoice = {
        ...inv,
        id: uuidv4(),
        businessId: currentBusiness.id,
        createdAt: now,
        updatedAt: now,
      };
      const all = await storage.getInvoices();
      await storage.setInvoices([...all, newInv]);
      setInvoices((prev) => [...prev, newInv]);
      return newInv;
    },
    [currentBusiness]
  );

  const updateInvoice = useCallback(async (id: string, patch: Partial<Invoice>) => {
    const all = await storage.getInvoices();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const updated = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await storage.setInvoices(all);
    setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }, []);

  const deleteInvoice = useCallback(async (id: string) => {
    const all = await storage.getInvoices().then((list) => list.filter((i) => i.id !== id));
    await storage.setInvoices(all);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addSale = useCallback(
    async (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!currentBusiness) throw new Error('No business selected');
      const now = new Date().toISOString();
      const newSale: Sale = {
        ...sale,
        id: uuidv4(),
        businessId: currentBusiness.id,
        createdAt: now,
        updatedAt: now,
      };
      const all = await storage.getSales();
      await storage.setSales([...all, newSale]);
      setSales((prev) => [...prev, newSale]);
      return newSale;
    },
    [currentBusiness]
  );

  const updateSale = useCallback(async (id: string, patch: Partial<Sale>) => {
    const all = await storage.getSales();
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const updated = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await storage.setSales(all);
    setSales((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }, []);

  const deleteSale = useCallback(async (id: string) => {
    const all = await storage.getSales().then((list) => list.filter((s) => s.id !== id));
    await storage.setSales(all);
    setSales((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addCategory = useCallback(
    async (name: string, color?: string) => {
      if (!currentBusiness) throw new Error('No business selected');
      const all = await storage.getCategories();
      const newC: Category = {
        id: uuidv4(),
        businessId: currentBusiness.id,
        name: name.trim(),
        color: color ?? '#6366f1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storage.setCategories([...all, newC]);
      setCategories((prev) => [...prev, newC]);
      return newC;
    },
    [currentBusiness]
  );

  const updateCategory = useCallback(async (id: string, patch: { name?: string; color?: string }) => {
    const all = await storage.getCategories();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const updated = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await storage.setCategories(all);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    const all = await storage.getCategories().then((list) => list.filter((c) => c.id !== id));
    await storage.setInvoices(
      (await storage.getInvoices()).map((i) => (i.categoryId === id ? { ...i, categoryId: null } : i))
    );
    await storage.setSales(
      (await storage.getSales()).map((s) => (s.categoryId === id ? { ...s, categoryId: null } : s))
    );
    await storage.setCategories(all);
    setInvoices((prev) => prev.map((i) => (i.categoryId === id ? { ...i, categoryId: null } : i)));
    setSales((prev) => prev.map((s) => (s.categoryId === id ? { ...s, categoryId: null } : s)));
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const searchInvoices = useCallback(
    (query: string, filters?: InvoiceFilters): Invoice[] => {
      let list = [...invoices];
      const q = query.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (i) =>
            i.extracted.merchantName?.toLowerCase().includes(q) ||
            i.extracted.category?.toLowerCase().includes(q) ||
            i.fileName?.toLowerCase().includes(q)
        );
      }
      if (filters?.categoryId !== undefined && filters.categoryId !== null) {
        list = list.filter((i) => i.categoryId === filters.categoryId);
      }
      if (filters?.merchantName) {
        const m = filters.merchantName.toLowerCase();
        list = list.filter((i) => i.extracted.merchantName?.toLowerCase().includes(m));
      }
      if (filters?.dateFrom) {
        list = list.filter((i) => i.extracted.date >= filters.dateFrom!);
      }
      if (filters?.dateTo) {
        list = list.filter((i) => i.extracted.date <= filters.dateTo!);
      }
      if (filters?.minAmount != null) {
        list = list.filter((i) => i.extracted.amount >= filters!.minAmount!);
      }
      if (filters?.maxAmount != null) {
        list = list.filter((i) => i.extracted.amount <= filters!.maxAmount!);
      }
      return list;
    },
    [invoices]
  );

  const searchSales = useCallback(
    (query: string, filters?: InvoiceFilters): Sale[] => {
      let list = [...sales];
      const q = query.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (s) =>
            s.extracted.merchantName?.toLowerCase().includes(q) ||
            s.extracted.category?.toLowerCase().includes(q) ||
            s.fileName?.toLowerCase().includes(q)
        );
      }
      if (filters?.categoryId !== undefined && filters.categoryId !== null) {
        list = list.filter((s) => s.categoryId === filters.categoryId);
      }
      if (filters?.merchantName) {
        const m = filters.merchantName.toLowerCase();
        list = list.filter((s) => s.extracted.merchantName?.toLowerCase().includes(m));
      }
      if (filters?.dateFrom) {
        list = list.filter((s) => s.extracted.date >= filters.dateFrom!);
      }
      if (filters?.dateTo) {
        list = list.filter((s) => s.extracted.date <= filters.dateTo!);
      }
      if (filters?.minAmount != null) {
        list = list.filter((s) => s.extracted.amount >= filters!.minAmount!);
      }
      if (filters?.maxAmount != null) {
        list = list.filter((s) => s.extracted.amount <= filters!.maxAmount!);
      }
      return list;
    },
    [sales]
  );

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);
  const spendSummary: SpendSummary = invoices.reduce(
    (acc, inv) => {
      const d = inv.extracted.date;
      const amt = inv.extracted.amount ?? 0;
      const tax = inv.extracted.vatAmount ?? 0;
      if (d >= weekStart.toISOString().slice(0, 10)) {
        acc.week += amt;
        acc.taxWeek += tax;
      }
      if (d >= monthStart.toISOString().slice(0, 10)) {
        acc.month += amt;
        acc.taxMonth += tax;
      }
      if (d >= yearStart.toISOString().slice(0, 10)) {
        acc.year += amt;
        acc.taxYear += tax;
      }
      return acc;
    },
    { week: 0, month: 0, year: 0, taxWeek: 0, taxMonth: 0, taxYear: 0 }
  );

  const value: AppContextValue = {
    businesses,
    currentBusiness,
    switchBusiness,
    addBusiness,
    updateBusiness,
    invoices,
    sales,
    categories,
    loadInvoices,
    loadSales,
    loadCategories,
    addInvoice,
    addSale,
    updateInvoice,
    updateSale,
    deleteInvoice,
    deleteSale,
    addCategory,
    updateCategory,
    deleteCategory,
    searchInvoices,
    searchSales,
    spendSummary,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

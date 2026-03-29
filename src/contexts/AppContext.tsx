import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import type {
  BusinessAccount,
  Invoice,
  Sale,
  Category,
  InvoiceFilters,
  SpendSummary,
} from '../types';
import { useAuth } from './AuthContext';
import { startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import * as supabaseData from '../services/supabaseData';

interface AppContextValue {
  businesses: BusinessAccount[];
  currentBusiness: BusinessAccount | null;
  /** Reload businesses from the server (e.g. after accepting a team invite). */
  reloadBusinessData: () => Promise<void>;
  switchBusiness: (id: string) => Promise<void>;
  addBusiness: (name: string, address?: string) => Promise<BusinessAccount>;
  updateBusiness: (id: string, patch: { name?: string; address?: string }) => Promise<void>;
  /** Owner-only: removes business and dependent rows (invoices, sales, pending handoffs). */
  deleteBusiness: (id: string) => Promise<void>;
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
  const { user, billingUserId } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessAccount[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<BusinessAccount | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadBusinesses = useCallback(async () => {
    if (!user) return;
    const all = await supabaseData.getBusinessAccounts(user.id);
    setBusinesses(all);
    const currentId = await supabaseData.getCurrentBusinessId(user.id);
    if (currentId) {
      const b = all.find((x) => x.id === currentId);
      if (b) setCurrentBusiness(b);
      else {
        const first = all[0] ?? null;
        setCurrentBusiness(first);
        await supabaseData.setCurrentBusinessId(user.id, first?.id ?? null);
      }
    } else {
      const first = all[0] ?? null;
      setCurrentBusiness(first);
      if (first) await supabaseData.setCurrentBusinessId(user.id, first.id);
    }
  }, [user]);

  const loadInvoices = useCallback(async (businessId?: string) => {
    const bid = businessId ?? currentBusiness?.id;
    if (bid) {
      const list = await supabaseData.getInvoices(bid);
      setInvoices(list);
    } else setInvoices([]);
  }, [currentBusiness?.id]);

  const loadCategories = useCallback(async (businessId?: string) => {
    const bid = businessId ?? currentBusiness?.id;
    if (bid) {
      const list = await supabaseData.getCategories(bid);
      setCategories(list);
    } else setCategories([]);
  }, [currentBusiness?.id]);

  const loadSales = useCallback(async (businessId?: string) => {
    const bid = businessId ?? currentBusiness?.id;
    if (bid) {
      const list = await supabaseData.getSales(bid);
      setSales(list);
    } else setSales([]);
  }, [currentBusiness?.id]);

  const switchBusiness = useCallback(
    async (id: string) => {
      if (!user) return;
      await supabaseData.setCurrentBusinessId(user.id, id);
      const b = businesses.find((x) => x.id === id);
      setCurrentBusiness(b ?? null);
      await loadInvoices(id);
      await loadSales(id);
      await loadCategories(id);
    },
    [user, businesses, loadInvoices, loadSales, loadCategories]
  );

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
      const dataOwnerId = billingUserId || user.id;
      const newB = await supabaseData.addBusiness(dataOwnerId, name, address);
      setBusinesses((prev) => [...prev, newB]);
      if (!currentBusiness) {
        setCurrentBusiness(newB);
        await supabaseData.setCurrentBusinessId(user.id, newB.id);
      }
      return newB;
    },
    [user, billingUserId, currentBusiness]
  );

  const updateBusiness = useCallback(
    async (id: string, patch: { name?: string; address?: string }) => {
      await supabaseData.updateBusiness(id, patch);
      const updated = businesses.find((b) => b.id === id);
      if (updated) {
        const next = { ...updated, ...patch, updatedAt: new Date().toISOString() };
        setBusinesses((prev) => prev.map((b) => (b.id === id ? next : b)));
        if (currentBusiness?.id === id) setCurrentBusiness(next);
      }
    },
    [businesses, currentBusiness?.id]
  );

  const deleteBusiness = useCallback(
    async (id: string) => {
      if (!user) return;
      const wasCurrent = currentBusiness?.id === id;
      await supabaseData.deleteBusiness(id);
      await loadBusinesses();
      if (wasCurrent) {
        const all = await supabaseData.getBusinessAccounts(user.id);
        const currentId = await supabaseData.getCurrentBusinessId(user.id);
        const nextBid =
          (currentId && all.find((x) => x.id === currentId)?.id) ?? all[0]?.id;
        await loadInvoices(nextBid);
        await loadSales(nextBid);
        await loadCategories(nextBid);
      }
    },
    [user, loadBusinesses, currentBusiness?.id, loadInvoices, loadSales, loadCategories]
  );

  const addInvoice = useCallback(
    async (inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!currentBusiness) throw new Error('No business selected');
      const newInv = await supabaseData.addInvoice(currentBusiness.id, inv);
      setInvoices((prev) => [newInv, ...prev]);
      return newInv;
    },
    [currentBusiness]
  );

  const updateInvoice = useCallback(async (id: string, patch: Partial<Invoice>) => {
    await supabaseData.updateInvoice(id, patch);
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i))
    );
  }, []);

  const deleteInvoice = useCallback(async (id: string) => {
    await supabaseData.deleteInvoice(id);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addSale = useCallback(
    async (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!currentBusiness) throw new Error('No business selected');
      const newSale = await supabaseData.addSale(currentBusiness.id, sale);
      setSales((prev) => [newSale, ...prev]);
      return newSale;
    },
    [currentBusiness]
  );

  const updateSale = useCallback(async (id: string, patch: Partial<Sale>) => {
    await supabaseData.updateSale(id, patch);
    setSales((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s))
    );
  }, []);

  const deleteSale = useCallback(async (id: string) => {
    await supabaseData.deleteSale(id);
    setSales((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addCategory = useCallback(
    async (name: string, color?: string) => {
      if (!currentBusiness) throw new Error('No business selected');
      const newC = await supabaseData.addCategory(currentBusiness.id, name, color);
      setCategories((prev) => [...prev, newC]);
      return newC;
    },
    [currentBusiness]
  );

  const updateCategory = useCallback(async (id: string, patch: { name?: string; color?: string }) => {
    await supabaseData.updateCategory(id, patch);
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c))
    );
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await supabaseData.deleteCategory(id);
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
      if (filters?.dateFrom) list = list.filter((i) => i.extracted.date >= filters.dateFrom!);
      if (filters?.dateTo) list = list.filter((i) => i.extracted.date <= filters.dateTo!);
      if (filters?.minAmount != null) list = list.filter((i) => i.extracted.amount >= filters!.minAmount!);
      if (filters?.maxAmount != null) list = list.filter((i) => i.extracted.amount <= filters!.maxAmount!);
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
      if (filters?.dateFrom) list = list.filter((s) => s.extracted.date >= filters.dateFrom!);
      if (filters?.dateTo) list = list.filter((s) => s.extracted.date <= filters.dateTo!);
      if (filters?.minAmount != null) list = list.filter((s) => s.extracted.amount >= filters!.minAmount!);
      if (filters?.maxAmount != null) list = list.filter((s) => s.extracted.amount <= filters!.maxAmount!);
      return list;
    },
    [sales]
  );

  const spendSummary = useMemo((): SpendSummary => {
    const now = new Date();
    const weekStartStr = startOfWeek(now, { weekStartsOn: 1 }).toISOString().slice(0, 10);
    const monthStartStr = startOfMonth(now).toISOString().slice(0, 10);
    const yearStartStr = startOfYear(now).toISOString().slice(0, 10);

    const acc: SpendSummary = {
      week: 0,
      month: 0,
      year: 0,
      taxWeek: 0,
      taxMonth: 0,
      taxYear: 0,
      taxMonthFromSales: 0,
    };

    for (const inv of invoices) {
      if ((inv.reviewStatus ?? 'complete') !== 'complete') continue;
      const d = inv.extracted.date;
      const amt = inv.extracted.amount ?? 0;
      const tax = inv.extracted.vatAmount ?? 0;
      if (d >= weekStartStr) {
        acc.week += amt;
        acc.taxWeek += tax;
      }
      if (d >= monthStartStr) {
        acc.month += amt;
        acc.taxMonth += tax;
      }
      if (d >= yearStartStr) {
        acc.year += amt;
        acc.taxYear += tax;
      }
    }

    for (const s of sales) {
      if ((s.reviewStatus ?? 'complete') !== 'complete') continue;
      const d = s.extracted.date;
      if (!d) continue;
      const tax = s.extracted.vatAmount ?? 0;
      if (d >= monthStartStr) acc.taxMonthFromSales += tax;
    }

    return acc;
  }, [invoices, sales]);

  const value: AppContextValue = {
    businesses,
    currentBusiness,
    reloadBusinessData: loadBusinesses,
    switchBusiness,
    addBusiness,
    updateBusiness,
    deleteBusiness,
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

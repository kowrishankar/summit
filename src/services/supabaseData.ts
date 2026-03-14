import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import type {
  BusinessAccount,
  Category,
  Invoice,
  Sale,
  Subscription,
  ExtractedInvoiceData,
} from '../types';

const MONTHLY_PRICE_PENCE = 1499;
const CURRENCY = 'GBP';

// ---- Business accounts ----
export async function getBusinessAccounts(userId: string): Promise<BusinessAccount[]> {
  const { data, error } = await supabase
    .from('business_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBusiness);
}

export async function addBusiness(
  userId: string,
  name: string,
  address?: string
): Promise<BusinessAccount> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const { error } = await supabase.from('business_accounts').insert({
    id,
    name: name.trim(),
    address: address?.trim() ?? null,
    user_id: userId,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return { id, name: name.trim(), address: address?.trim(), userId, createdAt: now, updatedAt: now };
}

export async function updateBusiness(
  id: string,
  patch: { name?: string; address?: string }
): Promise<void> {
  const { error } = await supabase
    .from('business_accounts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- Current business preference (stored in DB so it can sync across devices) ----
export async function getCurrentBusinessId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_preferences')
    .select('current_business_id')
    .eq('user_id', userId)
    .single();
  return data?.current_business_id ?? null;
}

export async function setCurrentBusinessId(userId: string, businessId: string | null): Promise<void> {
  const { error } = await supabase.from('user_preferences').upsert(
    { user_id: userId, current_business_id: businessId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
}

// ---- Categories ----
export async function getCategories(businessId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToCategory);
}

export async function addCategory(
  businessId: string,
  name: string,
  color?: string
): Promise<Category> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const { error } = await supabase.from('categories').insert({
    id,
    business_id: businessId,
    name: name.trim(),
    color: color ?? '#6366f1',
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return {
    id,
    businessId,
    name: name.trim(),
    color: color ?? '#6366f1',
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string }
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await supabase.from('invoices').update({ category_id: null }).eq('category_id', id);
  await supabase.from('sales').update({ category_id: null }).eq('category_id', id);
}

// ---- Invoices ----
export async function getInvoices(businessId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToInvoice);
}

export async function addInvoice(
  businessId: string,
  inv: Omit<Invoice, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>
): Promise<Invoice> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const { error } = await supabase.from('invoices').insert({
    id,
    business_id: businessId,
    category_id: inv.categoryId,
    source: inv.source,
    file_uri: inv.fileUri ?? null,
    file_uris: inv.fileUris ?? null,
    file_name: inv.fileName ?? null,
    extracted: inv.extracted as object,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return {
    ...inv,
    id,
    businessId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateInvoice(id: string, patch: Partial<Invoice>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.fileUri !== undefined) row.file_uri = patch.fileUri;
  if (patch.fileUris !== undefined) row.file_uris = patch.fileUris;
  if (patch.fileName !== undefined) row.file_name = patch.fileName;
  if (patch.extracted !== undefined) row.extracted = patch.extracted as object;
  const { error } = await supabase.from('invoices').update(row).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- Sales ----
export async function getSales(businessId: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSale);
}

export async function addSale(
  businessId: string,
  sale: Omit<Sale, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>
): Promise<Sale> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const { error } = await supabase.from('sales').insert({
    id,
    business_id: businessId,
    category_id: sale.categoryId,
    source: sale.source,
    file_uri: sale.fileUri ?? null,
    file_uris: sale.fileUris ?? null,
    file_name: sale.fileName ?? null,
    extracted: sale.extracted as object,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return {
    ...sale,
    id,
    businessId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateSale(id: string, patch: Partial<Sale>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.fileUri !== undefined) row.file_uri = patch.fileUri;
  if (patch.fileUris !== undefined) row.file_uris = patch.fileUris;
  if (patch.fileName !== undefined) row.file_name = patch.fileName;
  if (patch.extracted !== undefined) row.extracted = patch.extracted as object;
  const { error } = await supabase.from('sales').update(row).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSale(id: string): Promise<void> {
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- Subscriptions ----
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToSubscription(data) : null;
}

export async function upsertSubscriptionFromStripe(
  userId: string,
  params: {
    currentPeriodEnd: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
  }
): Promise<Subscription> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const row = {
    user_id: userId,
    status: 'active',
    amount_pence: MONTHLY_PRICE_PENCE,
    currency: CURRENCY,
    interval: 'month',
    current_period_start: existing?.current_period_start ?? now,
    current_period_end: params.currentPeriodEnd,
    cancel_at_period_end: false,
    cancelled_at: null,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    stripe_customer_id: params.stripeCustomerId ?? null,
    updated_at: now,
  };

  if (existing) {
    const { error } = await supabase.from('subscriptions').update(row).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return rowToSubscription({ ...existing, ...row });
  } else {
    const id = uuidv4();
    const { error } = await supabase.from('subscriptions').insert({
      id,
      ...row,
      created_at: now,
    });
    if (error) throw new Error(error.message);
    return rowToSubscription({ id, ...row, created_at: now });
  }
}

export async function setSubscriptionCancelAtPeriodEnd(userId: string): Promise<Subscription | null> {
  const sub = await getSubscription(userId);
  if (!sub || sub.status === 'cancelled' || sub.cancelAtPeriodEnd) return sub;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancel_at_period_end',
      cancel_at_period_end: true,
      cancelled_at: now,
      updated_at: now,
    })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return getSubscription(userId);
}

// ---- Row mappers (snake_case -> camelCase) ----
function rowToBusiness(r: Record<string, unknown>): BusinessAccount {
  return {
    id: r.id as string,
    name: r.name as string,
    address: r.address as string | undefined,
    userId: r.user_id as string,
    createdAt: (r.created_at as string).replace('Z', 'Z'),
    updatedAt: (r.updated_at as string).replace('Z', 'Z'),
  };
}

function rowToCategory(r: Record<string, unknown>): Category {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    name: r.name as string,
    color: r.color as string | undefined,
    createdAt: (r.created_at as string).replace('Z', 'Z'),
    updatedAt: (r.updated_at as string).replace('Z', 'Z'),
  };
}

function rowToInvoice(r: Record<string, unknown>): Invoice {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    categoryId: (r.category_id as string) ?? null,
    source: r.source as 'upload' | 'manual',
    fileUri: r.file_uri as string | undefined,
    fileUris: (r.file_uris as string[] | undefined) ?? undefined,
    fileName: r.file_name as string | undefined,
    extracted: (r.extracted as ExtractedInvoiceData) ?? {},
    createdAt: (r.created_at as string).replace('Z', 'Z'),
    updatedAt: (r.updated_at as string).replace('Z', 'Z'),
  };
}

function rowToSale(r: Record<string, unknown>): Sale {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    categoryId: (r.category_id as string) ?? null,
    source: r.source as 'upload' | 'manual',
    fileUri: r.file_uri as string | undefined,
    fileUris: (r.file_uris as string[] | undefined) ?? undefined,
    fileName: r.file_name as string | undefined,
    extracted: (r.extracted as ExtractedInvoiceData) ?? {},
    createdAt: (r.created_at as string).replace('Z', 'Z'),
    updatedAt: (r.updated_at as string).replace('Z', 'Z'),
  };
}

function rowToSubscription(r: Record<string, unknown>): Subscription {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    status: r.status as Subscription['status'],
    amountPence: r.amount_pence as number,
    currency: r.currency as string,
    interval: r.interval as 'month',
    currentPeriodStart: (r.current_period_start as string).replace('Z', 'Z'),
    currentPeriodEnd: (r.current_period_end as string).replace('Z', 'Z'),
    cancelAtPeriodEnd: r.cancel_at_period_end as boolean | undefined,
    cancelledAt: r.cancelled_at as string | undefined,
    stripeSubscriptionId: r.stripe_subscription_id as string | undefined,
    stripeCustomerId: r.stripe_customer_id as string | undefined,
    createdAt: (r.created_at as string).replace('Z', 'Z'),
    updatedAt: (r.updated_at as string).replace('Z', 'Z'),
  };
}

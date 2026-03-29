import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import type { BusinessAccount, BusinessHandoffInvite } from '../types';
import * as supabaseData from './supabaseData';

const HANDOFF_VALID_DAYS = 30;

function rowToHandoff(r: Record<string, unknown>): BusinessHandoffInvite {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    practiceUserId: r.practice_user_id as string,
    invitedEmail: r.invited_email as string,
    token: r.token as string,
    expiresAt: r.expires_at as string,
    createdAt: r.created_at as string,
  };
}

/**
 * Practice user creates a client business (owned by practice until claimed) and a handoff invite.
 * Share the returned token with the client by email or message so they can claim in Settings.
 */
export async function createClientBusinessWithHandoff(
  practiceUserId: string,
  businessName: string,
  ownerEmail: string,
  businessAddress?: string
): Promise<{ business: BusinessAccount; invite: BusinessHandoffInvite }> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) throw new Error('Client email is required');
  const business = await supabaseData.addBusiness(practiceUserId, businessName.trim(), businessAddress?.trim());
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + HANDOFF_VALID_DAYS * 86400000).toISOString();
  const now = new Date().toISOString();
  const id = uuidv4();
  const { data, error } = await supabase
    .from('business_handoff_invites')
    .insert({
      id,
      business_id: business.id,
      practice_user_id: practiceUserId,
      invited_email: email,
      token,
      expires_at: expiresAt,
      created_at: now,
    })
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return { business, invite: rowToHandoff(data as Record<string, unknown>) };
}

export async function listHandoffsForPractice(practiceUserId: string): Promise<BusinessHandoffInvite[]> {
  const { data, error } = await supabase
    .from('business_handoff_invites')
    .select('*')
    .eq('practice_user_id', practiceUserId)
    .order('created_at', { ascending: false });
  if (error) {
    if (__DEV__) console.warn('[listHandoffsForPractice]', error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToHandoff(r as Record<string, unknown>));
}

export async function claimBusinessHandoff(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Claim code is required');
  const { error } = await supabase.rpc('claim_business_handoff', { invite_token: trimmed });
  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('invalid_or_expired') || msg.includes('invalid') || msg.includes('expired')) {
      throw new Error('This code is invalid or has expired. Ask your accountant for a new one.');
    }
    if (msg.includes('email_mismatch')) {
      throw new Error('Sign in with the email your accountant used for you, then try again.');
    }
    if (msg.includes('cannot_claim_own')) {
      throw new Error('You cannot claim a business you set up for a client.');
    }
    throw new Error(error.message);
  }
}

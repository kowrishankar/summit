import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import type { AccountAccessInvite, AccountAccessMember } from '../types';

const INVITE_VALID_DAYS = 14;

function rowToInvite(r: Record<string, unknown>): AccountAccessInvite {
  return {
    id: r.id as string,
    ownerUserId: r.owner_user_id as string,
    invitedEmail: r.invited_email as string,
    token: r.token as string,
    expiresAt: r.expires_at as string,
    createdAt: r.created_at as string,
  };
}

function rowToMember(r: Record<string, unknown>): AccountAccessMember {
  return {
    ownerUserId: r.owner_user_id as string,
    memberUserId: r.member_user_id as string,
    memberEmail: (r.member_email as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function listInvitesForOwner(ownerUserId: string): Promise<AccountAccessInvite[]> {
  const { data, error } = await supabase
    .from('account_access_invites')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToInvite(r as Record<string, unknown>));
}

export async function createInvite(ownerUserId: string, email: string): Promise<AccountAccessInvite> {
  const invitedEmail = email.trim().toLowerCase();
  if (!invitedEmail) throw new Error('Email is required');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 86400000).toISOString();
  const now = new Date().toISOString();
  const id = uuidv4();
  const { data, error } = await supabase
    .from('account_access_invites')
    .insert({
      id,
      owner_user_id: ownerUserId,
      invited_email: invitedEmail,
      token,
      expires_at: expiresAt,
      created_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToInvite(data as Record<string, unknown>);
}

export async function deleteInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('account_access_invites').delete().eq('id', inviteId);
  if (error) throw new Error(error.message);
}

export async function listMembersForOwner(ownerUserId: string): Promise<AccountAccessMember[]> {
  const { data, error } = await supabase
    .from('account_access_members')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToMember(r as Record<string, unknown>));
}

export async function removeMember(ownerUserId: string, memberUserId: string): Promise<void> {
  const { error } = await supabase
    .from('account_access_members')
    .delete()
    .eq('owner_user_id', ownerUserId)
    .eq('member_user_id', memberUserId);
  if (error) throw new Error(error.message);
}

export async function acceptInviteWithToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Invite code is required');
  const { error } = await supabase.rpc('accept_account_invite', { invite_token: trimmed });
  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('invalid_or_expired') || msg.includes('invalid') || msg.includes('expired')) {
      throw new Error('This invite is invalid or has expired. Ask the owner for a new invite.');
    }
    if (msg.includes('email_mismatch')) {
      throw new Error('Sign in with the email address the invite was sent to, then try again.');
    }
    if (msg.includes('cannot_accept_own')) {
      throw new Error('You cannot accept your own invite.');
    }
    throw new Error(error.message);
  }
}

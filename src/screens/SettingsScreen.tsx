import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import AppText from '../components/AppText';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  cancelSubscriptionAtPeriodEnd,
  formatPrice,
} from '../services/subscription';
import * as teamAccess from '../services/teamAccess';
import * as practiceHandoff from '../services/practiceHandoff';
import type { AccountAccessInvite, AccountAccessMember } from '../types';
import { createPortalSession } from '../services/stripeApi';
import {
  getSaveCameraPhotosToGallery,
  setSaveCameraPhotosToGallery,
} from '../services/cameraGalleryPreference';
import {
  BORDER,
  CARD_BG,
  LAVENDER_SOFT,
  MUTED_CARD,
  PAGE_BG,
  PURPLE,
  PURPLE_DEEP,
  RED,
  TEXT,
  TEXT_SECONDARY,
  TEXT_MUTED,
  shadowCard,
  shadowCardLight,
} from '../theme/design';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    user,
    logout,
    subscription,
    refreshSubscription,
    isTeamMember,
    hasActiveSubscription,
    upgradeToBusiness,
  } = useAuth();
  const { currentBusiness, updateBusiness, reloadBusinessData } = useApp();
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [saveCameraToGallery, setSaveCameraToGallery] = useState(false);
  const [invites, setInvites] = useState<AccountAccessInvite[]>([]);
  const [members, setMembers] = useState<AccountAccessMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [acceptToken, setAcceptToken] = useState('');
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [claimHandoffToken, setClaimHandoffToken] = useState('');
  const [claimHandoffBusy, setClaimHandoffBusy] = useState(false);
  const [upgradeBizName, setUpgradeBizName] = useState('');
  const [upgradeBizAddress, setUpgradeBizAddress] = useState('');
  const [becomeBusinessBusy, setBecomeBusinessBusy] = useState(false);
  const [practiceClientName, setPracticeClientName] = useState('');
  const [practiceClientEmail, setPracticeClientEmail] = useState('');
  const [practiceClientAddress, setPracticeClientAddress] = useState('');
  const [practiceInviteBusy, setPracticeInviteBusy] = useState(false);

  const loadTeam = useCallback(async () => {
    if (!user?.id || isTeamMember) return;
    setTeamLoading(true);
    try {
      const [inv, mem] = await Promise.all([
        teamAccess.listInvitesForOwner(user.id),
        teamAccess.listMembersForOwner(user.id),
      ]);
      setInvites(inv);
      setMembers(mem);
    } catch (e) {
      if (__DEV__) {
        console.warn('[Settings] Team access load failed (run Supabase team migration?)', e);
      }
      setInvites([]);
      setMembers([]);
    } finally {
      setTeamLoading(false);
    }
  }, [user?.id, isTeamMember]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void getSaveCameraPhotosToGallery().then(setSaveCameraToGallery);
  }, []);

  useEffect(() => {
    if (currentBusiness) {
      setBusinessName(currentBusiness.name);
      setBusinessAddress(currentBusiness.address ?? '');
    }
  }, [currentBusiness?.id, currentBusiness?.name, currentBusiness?.address]);

  const handleSaveBusiness = async () => {
    if (!currentBusiness) return;
    setSaving(true);
    try {
      await updateBusiness(currentBusiness.id, {
        name: businessName.trim(),
        address: businessAddress.trim(),
      });
      Alert.alert('Saved', 'Business details updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel subscription',
      'You will keep access until the end of your current billing period. After that, you will not be charged again.',
      [
        { text: 'Keep subscription', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            setCancelling(true);
            try {
              const updated = await cancelSubscriptionAtPeriodEnd(user.id);
              await refreshSubscription(user.id);
              Alert.alert(
                'Subscription cancelled',
                `You can continue using the app until ${updated ? new Date(updated.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'the end of your billing period'}.`
              );
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not cancel.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const canCancel =
    !isTeamMember &&
    subscription &&
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    !subscription.cancelAtPeriodEnd;

  const rawKind = user?.accountKind;

  const accountTypeLabel =
    rawKind === 'practice'
      ? 'Practice plan'
      : rawKind === 'business'
        ? 'Business plan'
        : rawKind === 'individual'
          ? 'Individual plan'
          : 'Business plan';

  const accountTypeDescription =
    rawKind === 'practice'
      ? 'You manage client businesses under your subscription. Inviting a client business does not add a separate charge—their workspace is included in your practice plan.'
      : rawKind === 'business'
        ? 'You can invite teammates to access your invoices and sales. Your subscription covers your workspace.'
        : rawKind === 'individual'
          ? 'Personal expense tracking. Switch to a business account anytime at no extra cost to invite collaborators.'
          : 'Your workspace supports invoices, sales, and inviting teammates. This account predates plan labels in your profile.';

  const showBecomeBusiness = !isTeamMember && rawKind === 'individual';

  const showTeamManagement =
    !isTeamMember &&
    hasActiveSubscription &&
    (rawKind === 'business' || rawKind === 'practice' || rawKind === undefined);

  const showPracticeClientInvite =
    !isTeamMember && hasActiveSubscription && rawKind === 'practice';

  const handleBecomeBusiness = async () => {
    const name = currentBusiness ? businessName.trim() : upgradeBizName.trim();
    const addr = currentBusiness ? businessAddress.trim() : upgradeBizAddress.trim();
    if (!name) {
      Alert.alert(
        'Business name required',
        currentBusiness
          ? 'Enter your business name in Business details below (or in the fields above if you have not saved yet).'
          : 'Enter your business name.'
      );
      return;
    }
    setBecomeBusinessBusy(true);
    try {
      await upgradeToBusiness(name, addr || undefined);
      await reloadBusinessData();
      Alert.alert(
        'Business account enabled',
        'Your subscription and price stay the same. You can invite people under Team & collaborators.'
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update account.');
    } finally {
      setBecomeBusinessBusy(false);
    }
  };

  const handlePracticeInviteClient = async () => {
    const n = practiceClientName.trim();
    const em = practiceClientEmail.trim().toLowerCase();
    if (!n || !em) {
      Alert.alert('Required', 'Enter the client business name and the email they will use to sign up.');
      return;
    }
    if (!user?.id) return;
    setPracticeInviteBusy(true);
    try {
      const { invite } = await practiceHandoff.createClientBusinessWithHandoff(
        user.id,
        n,
        em,
        practiceClientAddress.trim() || undefined
      );
      setPracticeClientName('');
      setPracticeClientEmail('');
      setPracticeClientAddress('');
      await reloadBusinessData();
      Alert.alert(
        'Send claim code to client',
        `They sign up or sign in with ${em}, then Settings → Claim a business from your accountant. Their workspace is included in your practice subscription—no extra fee.\n\n${invite.token}`
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create invite.');
    } finally {
      setPracticeInviteBusy(false);
    }
  };

  const handleCreateInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !user?.id) {
      Alert.alert('Error', 'Enter the collaborator’s email address.');
      return;
    }
    setInviteBusy(true);
    try {
      const inv = await teamAccess.createInvite(user.id, email);
      setInviteEmail('');
      await loadTeam();
      Alert.alert(
        'Invite created',
        `Ask them to sign up or log in with ${email}, open Settings, and paste this invite code under “Join a team”:\n\n${inv.token}`
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleClaimHandoff = async () => {
    const t = claimHandoffToken.trim();
    if (!t) {
      Alert.alert('Error', 'Paste the claim code from your accountant.');
      return;
    }
    setClaimHandoffBusy(true);
    try {
      await practiceHandoff.claimBusinessHandoff(t);
      setClaimHandoffToken('');
      await refreshSubscription();
      await reloadBusinessData();
      Alert.alert(
        'Business claimed',
        'This workspace is now on your account. Your accountant still has access as a collaborator.'
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not claim business.');
    } finally {
      setClaimHandoffBusy(false);
    }
  };

  const handleAcceptInvite = async () => {
    const t = acceptToken.trim();
    if (!t) {
      Alert.alert('Error', 'Paste the invite code.');
      return;
    }
    setAcceptBusy(true);
    try {
      await teamAccess.acceptInviteWithToken(t);
      setAcceptToken('');
      await refreshSubscription();
      await reloadBusinessData();
      Alert.alert('Welcome', 'You now have access to the shared account.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not accept invite.');
    } finally {
      setAcceptBusy(false);
    }
  };

  const handleManageBilling = async () => {
    if (!subscription?.stripeCustomerId) return;
    setPortalLoading(true);
    try {
      const returnUrl =
        process.env.EXPO_PUBLIC_PORTAL_RETURN_URL ||
        process.env.EXPO_PUBLIC_STRIPE_API_URL ||
        'https://example.com';
      const { url } = await createPortalSession(subscription.stripeCustomerId, returnUrl);
      await Linking.openURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not open billing portal.';
      Alert.alert(
        'Cannot open billing',
        message +
          (message.includes('billing server')
            ? ''
            : '\n\nIf you see a network error, start the server (server folder) and use your computer’s IP in .env for EXPO_PUBLIC_STRIPE_API_URL when on a physical device.')
      );
    } finally {
      setPortalLoading(false);
    }
  };

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <AppText style={styles.headerTitle}>Settings</AppText>
        <View style={styles.headerSide} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Account */}
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Account</AppText>
            <View style={styles.accountRow}>
              <View style={styles.iconTilePurple}>
                <Ionicons name="mail-outline" size={22} color="#fff" />
              </View>
              <View style={styles.accountTextCol}>
                <AppText style={styles.accountLabel}>Email</AppText>
                <AppText style={styles.accountValue}>{user?.email ?? '—'}</AppText>
              </View>
            </View>
            <View style={[styles.accountRow, styles.accountRowSpaced]}>
              <View style={styles.iconTileTeal}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
              </View>
              <View style={styles.accountTextCol}>
                <AppText style={styles.accountLabel}>Account type</AppText>
                <AppText style={styles.accountValueStrong}>{accountTypeLabel}</AppText>
                <AppText style={styles.accountTypeHint}>{accountTypeDescription}</AppText>
              </View>
            </View>
          </View>

          {showBecomeBusiness && (
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Become a business account</AppText>
              <AppText style={styles.cardHint}>
                Use a business profile to invite others to your workspace. Your subscription and price do not change.
              </AppText>
              {currentBusiness ? (
                <AppText style={styles.cardHintMuted}>
                  We will use the business name and address in “Business details” below. Update those fields if needed,
                  then tap the button—you do not have to press Save first.
                </AppText>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Business name"
                    value={upgradeBizName}
                    onChangeText={setUpgradeBizName}
                    placeholderTextColor={TEXT_MUTED}
                  />
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Business address (optional)"
                    value={upgradeBizAddress}
                    onChangeText={setUpgradeBizAddress}
                    placeholderTextColor={TEXT_MUTED}
                    multiline
                    numberOfLines={2}
                  />
                </>
              )}
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => void handleBecomeBusiness()}
                disabled={becomeBusinessBusy}
                style={styles.gradientBtnTouchable}
              >
                <LinearGradient
                  colors={[PURPLE, PURPLE_DEEP]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientBtn}
                >
                  <Ionicons name="briefcase-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                  <AppText style={styles.gradientBtnText}>
                    {becomeBusinessBusy ? 'Updating…' : 'Switch to business account'}
                  </AppText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Accept team invite (own login) */}
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Join a team</AppText>
            <AppText style={styles.cardHint}>
              If the business owner sent you an invite, sign in with the email they used, paste the invite code
              here, then tap Accept.
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="Invite code"
              value={acceptToken}
              onChangeText={setAcceptToken}
              placeholderTextColor={TEXT_MUTED}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => void handleAcceptInvite()}
              disabled={acceptBusy}
              style={styles.gradientBtnTouchable}
            >
              <LinearGradient
                colors={[PURPLE, PURPLE_DEEP]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBtn}
              >
                <Ionicons name="enter-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                <AppText style={styles.gradientBtnText}>{acceptBusy ? 'Accepting…' : 'Accept invite'}</AppText>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Claim a business (from your accountant)</AppText>
            <AppText style={styles.cardHint}>
              If your accountant set up your business in Summit, sign in with the email they used for you, paste the
              claim code they sent, then tap Claim. You’ll own the workspace; they keep access to help with tax and
              books.
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="Claim code"
              value={claimHandoffToken}
              onChangeText={setClaimHandoffToken}
              placeholderTextColor={TEXT_MUTED}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => void handleClaimHandoff()}
              disabled={claimHandoffBusy}
              style={styles.gradientBtnTouchable}
            >
              <LinearGradient
                colors={[PURPLE, PURPLE_DEEP]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBtn}
              >
                <Ionicons name="ribbon-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                <AppText style={styles.gradientBtnText}>
                  {claimHandoffBusy ? 'Claiming…' : 'Claim business'}
                </AppText>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Business */}
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Business details</AppText>
            <AppText style={styles.cardHint}>Edit your current business name and address.</AppText>
            {currentBusiness ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Business name"
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholderTextColor={TEXT_MUTED}
                />
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Business address"
                  value={businessAddress}
                  onChangeText={setBusinessAddress}
                  placeholderTextColor={TEXT_MUTED}
                  multiline
                  numberOfLines={2}
                />
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={handleSaveBusiness}
                  disabled={saving}
                  style={styles.gradientBtnTouchable}
                >
                  <LinearGradient
                    colors={[PURPLE, PURPLE_DEEP]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBtn}
                  >
                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                    <AppText style={styles.gradientBtnText}>
                      {saving ? 'Saving…' : 'Save business details'}
                    </AppText>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <AppText style={styles.muted}>Add a business from Home → Switch business.</AppText>
            )}
          </View>

          {showPracticeClientInvite && (
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Invite a client business</AppText>
              <AppText style={styles.cardHint}>
                Add a workspace for a client. They sign up with the email you enter and claim it with the code we
                show. You keep access to their invoices and sales under your practice plan—no extra subscription for
                them.
              </AppText>
              <TextInput
                style={styles.input}
                placeholder="Client business name"
                value={practiceClientName}
                onChangeText={setPracticeClientName}
                placeholderTextColor={TEXT_MUTED}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Client business address (optional)"
                value={practiceClientAddress}
                onChangeText={setPracticeClientAddress}
                placeholderTextColor={TEXT_MUTED}
                multiline
                numberOfLines={2}
              />
              <TextInput
                style={styles.input}
                placeholder="Client email (they sign up with this)"
                value={practiceClientEmail}
                onChangeText={setPracticeClientEmail}
                placeholderTextColor={TEXT_MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => void handlePracticeInviteClient()}
                disabled={practiceInviteBusy}
                style={styles.gradientBtnTouchable}
              >
                <LinearGradient
                  colors={[PURPLE, PURPLE_DEEP]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientBtn}
                >
                  <Ionicons name="mail-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                  <AppText style={styles.gradientBtnText}>
                    {practiceInviteBusy ? 'Creating…' : 'Create invite & claim code'}
                  </AppText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {showTeamManagement && (
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Team & collaborators</AppText>
              <AppText style={styles.cardHint}>
                Invite people with their own email and password. They can access your businesses, invoices, and sales
                (same as you). Useful for staff or an accountant.
              </AppText>
              <TextInput
                style={styles.input}
                placeholder="Collaborator email"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholderTextColor={TEXT_MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => void handleCreateInvite()}
                disabled={inviteBusy}
                style={styles.secondaryBtnWrap}
              >
                <View style={styles.secondaryBtn}>
                  <Ionicons name="person-add-outline" size={20} color={PURPLE} style={{ marginRight: 8 }} />
                  <AppText style={styles.secondaryBtnText}>
                    {inviteBusy ? 'Creating…' : 'Send invite'}
                  </AppText>
                </View>
              </TouchableOpacity>
              {teamLoading ? (
                <ActivityIndicator color={PURPLE} style={styles.loader} />
              ) : (
                <>
                  {invites.length > 0 && (
                    <>
                      <AppText style={styles.teamSubheading}>Pending invites</AppText>
                      {invites.map((inv) => (
                        <View key={inv.id} style={styles.teamRow}>
                          <View style={styles.teamRowText}>
                            <AppText style={styles.teamRowTitle}>{inv.invitedEmail}</AppText>
                            <AppText style={styles.teamRowMeta}>
                              Expires {new Date(inv.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </AppText>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert('Revoke invite', `Stop inviting ${inv.invitedEmail}?`, [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Revoke',
                                  style: 'destructive',
                                  onPress: async () => {
                                    try {
                                      await teamAccess.deleteInvite(inv.id);
                                      await loadTeam();
                                    } catch (e) {
                                      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
                                    }
                                  },
                                },
                              ]);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppText style={styles.teamRowAction}>Revoke</AppText>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
                  {members.length > 0 && (
                    <>
                      <AppText style={styles.teamSubheading}>People with access</AppText>
                      {members.map((m) => (
                        <View key={m.memberUserId} style={styles.teamRow}>
                          <View style={styles.teamRowText}>
                            <AppText style={styles.teamRowTitle}>{m.memberEmail ?? m.memberUserId}</AppText>
                            <AppText style={styles.teamRowMeta}>Collaborator</AppText>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Remove access',
                                `Remove ${m.memberEmail ?? 'this collaborator'}?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Remove',
                                    style: 'destructive',
                                    onPress: async () => {
                                      if (!user?.id) return;
                                      try {
                                        await teamAccess.removeMember(user.id, m.memberUserId);
                                        await loadTeam();
                                      } catch (e) {
                                        Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
                                      }
                                    },
                                  },
                                ]
                              );
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppText style={styles.teamRowAction}>Remove</AppText>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {Platform.OS !== 'web' && (
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Photos</AppText>
              <View style={styles.preferenceShell}>
                <View style={styles.iconTileBlue}>
                  <Ionicons name="images-outline" size={22} color="#2563eb" />
                </View>
                <View style={styles.preferenceTextCol}>
                  <AppText style={styles.preferenceTitle}>Save to gallery</AppText>
                  <AppText style={styles.preferenceHint}>
                    When you take a picture while adding an invoice or sale, also save a copy to your photo
                    library.
                  </AppText>
                </View>
                <Switch
                  style={styles.preferenceSwitch}
                  value={saveCameraToGallery}
                  onValueChange={(v) => {
                    setSaveCameraToGallery(v);
                    void setSaveCameraPhotosToGallery(v);
                  }}
                  trackColor={{ false: '#cbd5e1', true: LAVENDER_SOFT }}
                  thumbColor={saveCameraToGallery ? PURPLE : '#f4f4f5'}
                />
              </View>
            </View>
          )}
          
          {/* Subscription */}
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Subscription</AppText>
            <AppText style={styles.cardHint}>
              {isTeamMember
                ? 'You are using the account owner’s subscription to access this workspace.'
                : 'Your monthly plan and billing.'}
            </AppText>
            {isTeamMember && (
              <AppText style={styles.teamMemberNote}>
                Billing changes must be done by the subscriber. You can still manage invoices and sales.
              </AppText>
            )}
            {subscription ? (
              <>
                <View style={styles.listRow}>
                  <AppText style={styles.listLabel}>Plan</AppText>
                  <AppText style={styles.listValueStrong}>{formatPrice(subscription)}/month</AppText>
                </View>
                <View style={styles.listRow}>
                  <AppText style={styles.listLabel}>Status</AppText>
                  <AppText style={styles.listValueStrong}>
                    {subscription.status === 'active'
                      ? 'Active'
                      : subscription.status === 'trialing'
                        ? 'Free trial'
                        : subscription.status === 'cancel_at_period_end'
                          ? 'Cancelling at period end'
                          : 'Ended'}
                  </AppText>
                </View>
                <View style={[styles.listRow, styles.listRowLast]}>
                  <AppText style={styles.listLabel}>
                    {subscription.cancelAtPeriodEnd
                      ? 'Access until'
                      : subscription.status === 'trialing'
                        ? 'First payment on'
                        : 'Next billing date'}
                  </AppText>
                  <AppText style={styles.listValueStrong}>
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                      dateStyle: 'long',
                    })}
                  </AppText>
                </View>
                {!isTeamMember && subscription.stripeCustomerId && (
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={handleManageBilling}
                    disabled={portalLoading}
                    style={styles.secondaryBtnWrap}
                  >
                    <View style={styles.secondaryBtn}>
                      <Ionicons name="card-outline" size={20} color={PURPLE} style={{ marginRight: 8 }} />
                      <AppText style={styles.secondaryBtnText}>
                        {portalLoading ? 'Opening…' : 'Manage billing'}
                      </AppText>
                    </View>
                  </TouchableOpacity>
                )}
                {canCancel && (
                  <TouchableOpacity
                    style={styles.destructiveOutline}
                    onPress={handleCancelSubscription}
                    disabled={cancelling}
                    activeOpacity={0.85}
                  >
                    <AppText style={styles.destructiveOutlineText}>
                      {cancelling ? 'Cancelling…' : 'Cancel subscription'}
                    </AppText>
                  </TouchableOpacity>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <AppText style={styles.cancelNote}>
                    You cancelled your subscription. You can keep using the app until the date above.
                  </AppText>
                )}
              </>
            ) : (
              <AppText style={styles.muted}>No subscription found.</AppText>
            )}
          </View>

          <TouchableOpacity
            style={styles.logoutCard}
            onPress={handleLogout}
            activeOpacity={0.88}
          >
            <Ionicons name="log-out-outline" size={22} color={RED} style={{ marginRight: 10 }} />
            <AppText style={styles.logoutText}>Log out</AppText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: PAGE_BG,
  },
  headerSide: { width: 40 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...shadowCard,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  cardHint: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginBottom: 16,
    lineHeight: 18,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountRowSpaced: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  iconTilePurple: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconTileBlue: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  accountTextCol: { flex: 1 },
  accountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  accountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  accountValueStrong: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
  },
  iconTileTeal: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  accountTypeHint: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginTop: 8,
    lineHeight: 19,
  },
  cardHintMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginBottom: 12,
    lineHeight: 18,
  },
  loader: { marginVertical: 16 },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  listRowLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  listLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_MUTED,
    flex: 1,
    paddingRight: 12,
  },
  listValueStrong: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'right',
    flexShrink: 1,
  },
  secondaryBtnWrap: {
    marginTop: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: MUTED_CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: {
    color: PURPLE,
    fontSize: 15,
    fontWeight: '700',
  },
  destructiveOutline: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: RED,
    backgroundColor: CARD_BG,
  },
  destructiveOutlineText: {
    color: RED,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelNote: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 14,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  muted: { fontSize: 14, color: TEXT_MUTED, lineHeight: 20 },
  teamMemberNote: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 20,
    marginBottom: 14,
    fontStyle: 'italic',
  },
  teamSubheading: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginTop: 8,
    marginBottom: 10,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  teamRowText: { flex: 1, paddingRight: 12 },
  teamRowTitle: { fontSize: 15, fontWeight: '600', color: TEXT },
  teamRowMeta: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  teamRowAction: { fontSize: 15, fontWeight: '700', color: RED },
  input: {
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  gradientBtnTouchable: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  gradientBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  preferenceShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MUTED_CARD,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  preferenceTextCol: { flex: 1 },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 4,
  },
  preferenceHint: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
    lineHeight: 18,
  },
  preferenceSwitch: { marginLeft: 8 },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  logoutText: {
    color: RED,
    fontSize: 16,
    fontWeight: '700',
  },
});

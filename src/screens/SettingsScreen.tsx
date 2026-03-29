import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Modal,
  Pressable,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
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
import * as practiceHandoff from '../services/practiceHandoff';
import { closeUserAccount, createPortalSession } from '../services/stripeApi';
import { getAccessToken } from '../services/supabaseAuth';
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
import type { BusinessAccount } from '../types';

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
  const {
    businesses,
    currentBusiness,
    addBusiness,
    updateBusiness,
    deleteBusiness,
    reloadBusinessData,
  } = useApp();
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [saveCameraToGallery, setSaveCameraToGallery] = useState(false);
  const [claimHandoffToken, setClaimHandoffToken] = useState('');
  const [claimHandoffBusy, setClaimHandoffBusy] = useState(false);
  const [upgradeBizName, setUpgradeBizName] = useState('');
  const [upgradeBizAddress, setUpgradeBizAddress] = useState('');
  const [becomeBusinessBusy, setBecomeBusinessBusy] = useState(false);
  const [practiceClientName, setPracticeClientName] = useState('');
  const [practiceClientEmail, setPracticeClientEmail] = useState('');
  const [practiceClientAddress, setPracticeClientAddress] = useState('');
  const [practiceInviteBusy, setPracticeInviteBusy] = useState(false);
  const [closeAccountBusy, setCloseAccountBusy] = useState(false);
  const [practiceHandoffs, setPracticeHandoffs] = useState<
    Awaited<ReturnType<typeof practiceHandoff.listHandoffsForPractice>>
  >([]);
  const [practiceHqName, setPracticeHqName] = useState('');
  const [practiceHqAddress, setPracticeHqAddress] = useState('');
  const [createPracticeBusy, setCreatePracticeBusy] = useState(false);
  const [practiceBusinessEdit, setPracticeBusinessEdit] = useState<{
    businessId: string;
    name: string;
    address: string;
    subtitle: string;
    canDelete: boolean;
    invitedEmail?: string;
  } | null>(null);
  const [practiceBusinessEditSaving, setPracticeBusinessEditSaving] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void getSaveCameraPhotosToGallery().then(setSaveCameraToGallery);
  }, []);

  useEffect(() => {
    if (user?.accountKind === 'practice') return;
    if (currentBusiness) {
      setBusinessName(currentBusiness.name);
      setBusinessAddress(currentBusiness.address ?? '');
    }
  }, [user?.accountKind, currentBusiness?.id, currentBusiness?.name, currentBusiness?.address]);

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

  const runCloseAccount = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      Alert.alert('Session expired', 'Sign in again, then try closing your account from Settings.');
      return;
    }
    setCloseAccountBusy(true);
    try {
      await closeUserAccount(token);
      try {
        await logout();
      } catch {
        /* user may already be deleted server-side */
      }
      Alert.alert('Account closed', 'Your Summit account has been removed.');
    } catch (e) {
      Alert.alert('Could not close account', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setCloseAccountBusy(false);
    }
  }, [logout]);

  const handleCloseAccount = useCallback(() => {
    Alert.alert(
      'Close your account?',
      isTeamMember
        ? 'This removes your Summit login and access to shared workspaces. It does not cancel another account’s subscription.'
        : 'This permanently deletes your Summit account, businesses, invoices, and sales. Any subscription on your login is cancelled immediately in Stripe and your Stripe customer is removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'You will be signed out and cannot recover this account.',
              [
                { text: 'Keep account', style: 'cancel' },
                {
                  text: 'Close account',
                  style: 'destructive',
                  onPress: () => void runCloseAccount(),
                },
              ]
            );
          },
        },
      ]
    );
  }, [isTeamMember, runCloseAccount]);

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
      ? 'Practice'
      : rawKind === 'business'
        ? 'Business'
        : rawKind === 'individual'
          ? 'Personal'
          : 'Business';

  const accountTypeDescription =
    rawKind === 'practice'
      ? 'Create client businesses and manage them under your practice plan.'
      : rawKind === 'business'
        ? 'Your own business workspace.'
        : rawKind === 'individual'
          ? 'Personal money-in / money-out tracking. Switch to a business profile anytime if you need a named business—still solo, no invites.'
          : 'Your workspace uses the business rules above.';

  const showBecomeBusiness = !isTeamMember && rawKind === 'individual';

  const showPracticeClientInvite =
    !isTeamMember && hasActiveSubscription && rawKind === 'practice';

  /** Practice users cannot claim a handoff themselves. */
  const isPractice = rawKind === 'practice';
  const showClaimBusinessCard = !isPractice;
  const showPracticeWorkspaceSections = isPractice && !isTeamMember;

  const refreshPracticeHandoffs = useCallback(async () => {
    if (!user?.id || !isPractice) return;
    const list = await practiceHandoff.listHandoffsForPractice(user.id);
    setPracticeHandoffs(list);
  }, [user?.id, isPractice]);

  useEffect(() => {
    void refreshPracticeHandoffs();
  }, [refreshPracticeHandoffs]);

  useEffect(() => {
    if (!isPractice) return;
    void refreshPracticeHandoffs();
  }, [businesses.length, isPractice, refreshPracticeHandoffs]);

  const handoffBusinessIds = useMemo(
    () => new Set(practiceHandoffs.map((h) => h.businessId)),
    [practiceHandoffs]
  );
  const ownedBusinesses = useMemo(
    () => (user?.id ? businesses.filter((b) => b.userId === user.id) : []),
    [businesses, user?.id]
  );
  /** Owned workspaces that are not pending client invites (your firm’s own). */
  const practiceHqCandidates = useMemo(() => {
    const candidates = ownedBusinesses.filter((b) => !handoffBusinessIds.has(b.id));
    return [...candidates].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [ownedBusinesses, handoffBusinessIds]);
  /** Prefer the workspace you’re viewing if it’s a practice one; otherwise the oldest practice workspace. */
  const practiceHqBusiness = useMemo(() => {
    if (practiceHqCandidates.length === 0) return null;
    const cur = currentBusiness;
    if (cur && practiceHqCandidates.some((b) => b.id === cur.id)) {
      return practiceHqCandidates.find((b) => b.id === cur.id) ?? null;
    }
    return practiceHqCandidates[0];
  }, [practiceHqCandidates, currentBusiness?.id]);
  const pendingClientRows = useMemo(() => {
    const out: { handoff: (typeof practiceHandoffs)[0]; business: BusinessAccount }[] = [];
    for (const h of practiceHandoffs) {
      const business = businesses.find((x) => x.id === h.businessId);
      if (business) out.push({ handoff: h, business });
    }
    return out;
  }, [practiceHandoffs, businesses]);
  const claimedClientBusinesses = useMemo(
    () => (user?.id ? businesses.filter((b) => b.userId !== user.id) : []),
    [businesses, user?.id]
  );

  useEffect(() => {
    if (!showPracticeWorkspaceSections) return;
    if (practiceHqBusiness) {
      setPracticeHqName(practiceHqBusiness.name);
      setPracticeHqAddress(practiceHqBusiness.address ?? '');
    } else {
      setPracticeHqName('');
      setPracticeHqAddress('');
    }
  }, [
    showPracticeWorkspaceSections,
    practiceHqBusiness?.id,
    practiceHqBusiness?.name,
    practiceHqBusiness?.address,
  ]);

  const openPracticeBusinessEditor = (
    business: BusinessAccount,
    opts: { awaitingClaim: boolean; invitedEmail?: string }
  ) => {
    setPracticeBusinessEdit({
      businessId: business.id,
      name: business.name,
      address: business.address ?? '',
      subtitle: opts.awaitingClaim
        ? `Awaiting client claim • ${opts.invitedEmail ?? '—'}`
        : 'Client workspace — you can update how it appears for you.',
      canDelete: opts.awaitingClaim,
      invitedEmail: opts.invitedEmail,
    });
  };

  const handleSavePracticeBusinessEdit = async () => {
    if (!practiceBusinessEdit) return;
    const n = practiceBusinessEdit.name.trim();
    if (!n) {
      Alert.alert('Name required', 'Enter a business name.');
      return;
    }
    setPracticeBusinessEditSaving(true);
    try {
      await updateBusiness(practiceBusinessEdit.businessId, {
        name: n,
        address: practiceBusinessEdit.address.trim(),
      });
      await reloadBusinessData();
      await refreshPracticeHandoffs();
      setPracticeBusinessEdit(null);
      Alert.alert('Saved', 'Business details updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setPracticeBusinessEditSaving(false);
    }
  };

  const handleDeletePracticePendingClient = (business: BusinessAccount, invitedEmail: string) => {
    Alert.alert(
      'Delete client workspace?',
      `Remove "${business.name}" and its claim invite (${invitedEmail}). All invoices and sales in this workspace will be deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteBusiness(business.id);
                await reloadBusinessData();
                await refreshPracticeHandoffs();
                setPracticeBusinessEdit(null);
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete.');
              }
            })();
          },
        },
      ]
    );
  };

  const handleSavePracticeHq = async () => {
    if (!practiceHqBusiness) return;
    const n = practiceHqName.trim();
    if (!n) {
      Alert.alert('Name required', 'Enter your practice name.');
      return;
    }
    setSaving(true);
    try {
      await updateBusiness(practiceHqBusiness.id, {
        name: n,
        address: practiceHqAddress.trim(),
      });
      await reloadBusinessData();
      Alert.alert('Saved', 'Practice details updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePracticeWorkspace = async () => {
    const n = practiceHqName.trim();
    if (!n) {
      Alert.alert('Name required', 'Enter your practice name to create a workspace.');
      return;
    }
    setCreatePracticeBusy(true);
    try {
      await addBusiness(n, practiceHqAddress.trim() || undefined);
      await reloadBusinessData();
      await refreshPracticeHandoffs();
      Alert.alert('Created', 'Your practice workspace is ready. You can add client businesses below.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create workspace.');
    } finally {
      setCreatePracticeBusy(false);
    }
  };

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
        'Your subscription and price stay the same. Business accounts are solo—no team invites.'
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
      await refreshPracticeHandoffs();
      const token = invite.token;
      const body = `They create an account with ${em} and choose “Invited by accountant” on sign-up (or Settings → Claim a business). No separate Summit payment.\n\n${token}`;
      Alert.alert('Send claim code to client', body, [
        {
          text: 'Copy code',
          onPress: async () => {
            try {
              await Clipboard.setStringAsync(token);
              Alert.alert('Copied', 'Claim code copied to clipboard.');
            } catch {
              Alert.alert('Copy failed', 'Copy the code from the message above.');
            }
          },
        },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create invite.');
    } finally {
      setPracticeInviteBusy(false);
    }
  };

  const handleClaimHandoff = async () => {
    if (isPractice) {
      Alert.alert(
        'Not available',
        'Practice accounts cannot claim a business. You create client workspaces and send claim codes to your clients instead.'
      );
      return;
    }
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
                Use a named business on invoices and reports. Still a solo account—no team invites. Your subscription
                and price do not change.
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

          {/* Practice: firm workspace + client list; others: current business */}
          {showPracticeWorkspaceSections ? (
            <>
              <View style={styles.card}>
                <AppText style={styles.cardTitle}>Practice details</AppText>
                <AppText style={styles.cardHint}>
                  Your accounting practice name and address.
                </AppText>
                {practiceHqBusiness ? (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Practice name"
                      value={practiceHqName}
                      onChangeText={setPracticeHqName}
                      placeholderTextColor={TEXT_MUTED}
                    />
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      placeholder="Practice address"
                      value={practiceHqAddress}
                      onChangeText={setPracticeHqAddress}
                      placeholderTextColor={TEXT_MUTED}
                      multiline
                      numberOfLines={2}
                    />
                    <TouchableOpacity
                      activeOpacity={0.92}
                      onPress={() => void handleSavePracticeHq()}
                      disabled={saving}
                      style={styles.gradientBtnTouchable}
                    >
                      <LinearGradient
                        colors={[PURPLE, PURPLE_DEEP]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientBtn}
                      >
                        <Ionicons name="business-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                        <AppText style={styles.gradientBtnText}>
                          {saving ? 'Saving…' : 'Save practice details'}
                        </AppText>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Practice name"
                      value={practiceHqName}
                      onChangeText={setPracticeHqName}
                      placeholderTextColor={TEXT_MUTED}
                    />
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      placeholder="Practice address (optional)"
                      value={practiceHqAddress}
                      onChangeText={setPracticeHqAddress}
                      placeholderTextColor={TEXT_MUTED}
                      multiline
                      numberOfLines={2}
                    />
                    <TouchableOpacity
                      activeOpacity={0.92}
                      onPress={() => void handleCreatePracticeWorkspace()}
                      disabled={createPracticeBusy}
                      style={styles.gradientBtnTouchable}
                    >
                      <LinearGradient
                        colors={[PURPLE, PURPLE_DEEP]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientBtn}
                      >
                        <Ionicons name="add-circle-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                        <AppText style={styles.gradientBtnText}>
                          {createPracticeBusy ? 'Creating…' : 'Create practice workspace'}
                        </AppText>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <View style={styles.card}>
                <AppText style={styles.cardTitle}>Client businesses</AppText>
                {pendingClientRows.length === 0 && claimedClientBusinesses.length === 0 ? (
                  <AppText style={styles.muted}>No client businesses yet. Use “Invite a client business” below.</AppText>
                ) : (
                  <>
                    {pendingClientRows.map(({ handoff, business }, idx) => (
                      <View
                        key={handoff.id}
                        style={[styles.practiceClientRow, idx === 0 && styles.practiceClientRowFirst]}
                      >
                        <View style={styles.practiceClientRowMain}>
                          <AppText style={styles.practiceClientName}>{business.name}</AppText>
                          <AppText style={styles.practiceClientMeta}>
                            Client email: {handoff.invitedEmail}
                          </AppText>
                          <AppText style={styles.practiceClientStatusLine}>Awaiting claim</AppText>
                        </View>
                        <View style={styles.practiceClientActions}>
                          <TouchableOpacity
                            onPress={() => openPracticeBusinessEditor(business, {
                              awaitingClaim: true,
                              invitedEmail: handoff.invitedEmail,
                            })}
                            style={styles.practiceClientActionBtn}
                          >
                            <AppText style={styles.practiceClientActionText}>Edit</AppText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              handleDeletePracticePendingClient(business, handoff.invitedEmail)
                            }
                            style={styles.practiceClientActionBtn}
                          >
                            <AppText style={styles.practiceClientActionDanger}>Delete</AppText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {claimedClientBusinesses.map((business, idx) => (
                      <View
                        key={business.id}
                        style={[
                          styles.practiceClientRow,
                          idx === 0 && pendingClientRows.length === 0 && styles.practiceClientRowFirst,
                        ]}
                      >
                        <View style={styles.practiceClientRowMain}>
                          <AppText style={styles.practiceClientName}>{business.name}</AppText>
                          <AppText style={styles.practiceClientMeta}>
                            Client email: {business.clientInviteEmail ?? '—'}
                          </AppText>
                          <AppText style={styles.practiceClientStatusLine}>
                            Claimed · on client’s account
                          </AppText>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            openPracticeBusinessEditor(business, { awaitingClaim: false })
                          }
                          style={styles.practiceClientActionBtn}
                        >
                          <AppText style={styles.practiceClientActionText}>Edit</AppText>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </>
          ) : (
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
          )}

          {showPracticeClientInvite && (
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Invite a client</AppText>
              <AppText style={styles.cardHint}>
                Add a workspace for a client. They sign up with the email you enter and claim it with the code we
                show.
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
                ? 'Summit access comes from another account’s active subscription (for example your accountant’s practice plan).'
                : 'Your monthly plan and billing.'}
            </AppText>
            {isTeamMember && (
              <AppText style={styles.teamMemberNote}>
                Only the paying subscriber can change billing. You can still run invoices and sales in your workspace.
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

          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Close account</AppText>
            <AppText style={styles.cardHint}>
              Permanently delete your Summit account and all app data. If this login pays for Summit, your subscription
              is cancelled immediately and your payment details are removed from our billing provider. This cannot be
              undone.
            </AppText>
            <TouchableOpacity
              style={styles.destructiveOutline}
              onPress={handleCloseAccount}
              disabled={closeAccountBusy}
              activeOpacity={0.85}
            >
              <AppText style={styles.destructiveOutlineText}>
                {closeAccountBusy ? 'Closing account…' : 'Close my account'}
              </AppText>
            </TouchableOpacity>
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

      {practiceBusinessEdit ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPracticeBusinessEdit(null)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              Keyboard.dismiss();
              setPracticeBusinessEdit(null);
            }}
          >
            <View style={styles.modalCenter} pointerEvents="box-none">
              <View style={styles.modalCard} pointerEvents="auto">
                <AppText style={styles.modalTitle}>Edit business</AppText>
                <AppText style={styles.modalSubtitle}>{practiceBusinessEdit.subtitle}</AppText>
                <TextInput
                  style={styles.input}
                  placeholder="Business name"
                  value={practiceBusinessEdit.name}
                  onChangeText={(t) =>
                    setPracticeBusinessEdit((prev) => (prev ? { ...prev, name: t } : prev))
                  }
                  placeholderTextColor={TEXT_MUTED}
                />
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Business address"
                  value={practiceBusinessEdit.address}
                  onChangeText={(t) =>
                    setPracticeBusinessEdit((prev) => (prev ? { ...prev, address: t } : prev))
                  }
                  placeholderTextColor={TEXT_MUTED}
                  multiline
                  numberOfLines={2}
                />
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => void handleSavePracticeBusinessEdit()}
                  disabled={practiceBusinessEditSaving}
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
                      {practiceBusinessEditSaving ? 'Saving…' : 'Save changes'}
                    </AppText>
                  </LinearGradient>
                </TouchableOpacity>
                {practiceBusinessEdit.canDelete && practiceBusinessEdit.invitedEmail ? (
                  <TouchableOpacity
                    style={[styles.destructiveOutline, { marginTop: 12 }]}
                    onPress={() => {
                      const b = businesses.find((x) => x.id === practiceBusinessEdit.businessId);
                      if (b)
                        handleDeletePracticePendingClient(b, practiceBusinessEdit.invitedEmail!);
                    }}
                    activeOpacity={0.85}
                  >
                    <AppText style={styles.destructiveOutlineText}>Delete workspace</AppText>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setPracticeBusinessEdit(null)}
                  activeOpacity={0.85}
                >
                  <AppText style={styles.modalCancelText}>Cancel</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>
      ) : null}
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
    fontSize: 18,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCenter: {
    width: '100%',
  },
  modalCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    ...shadowCard,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalCancelBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  practiceClientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  practiceClientRowFirst: {
    paddingTop: 0,
    marginTop: 0,
    borderTopWidth: 0,
  },
  practiceClientRowMain: { flex: 1, minWidth: 0 },
  practiceClientName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 4,
  },
  practiceClientMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    lineHeight: 18,
    marginTop: 4,
  },
  practiceClientStatusLine: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginTop: 2,
    lineHeight: 16,
  },
  practiceClientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  practiceClientActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  practiceClientActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: PURPLE,
  },
  practiceClientActionDanger: {
    fontSize: 15,
    fontWeight: '700',
    color: RED,
  },
});

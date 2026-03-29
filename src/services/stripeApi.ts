const API_URL = process.env.EXPO_PUBLIC_STRIPE_API_URL || 'http://localhost:4242';
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds for Stripe + network

/** Stripe returns "No such setupintent" if pk_test vs pk_live does not match the server's sk_test vs sk_live. */
function assertPublishableKeyMatchesServerMode(stripeMode?: 'test' | 'live') {
  if (!stripeMode) return;
  const pk = (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim();
  const appTest = pk.startsWith('pk_test_');
  const appLive = pk.startsWith('pk_live_');
  if (stripeMode === 'test' && !appTest) {
    throw new Error(
      'Stripe mode mismatch: your server uses TEST secret keys (sk_test_…), but the app is not using a TEST publishable key (pk_test_…). In Stripe Dashboard, turn on Test mode and use matching Test keys on both the server (STRIPE_SECRET_KEY) and in the app (EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY).'
    );
  }
  if (stripeMode === 'live' && !appLive) {
    throw new Error(
      'Stripe mode mismatch: your server uses LIVE secret keys (sk_live_…), but the app is not using a LIVE publishable key (pk_live_…). Use Live keys for both, or use Test for both while developing.'
    );
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        throw new Error(
          'Request timed out. Check that the server is running at ' +
            API_URL +
            ' and your device can reach it (same Wi‑Fi, firewall allows port 4242).'
        );
      }
      const msg = e.message?.toLowerCase() ?? '';
      if (msg.includes('network request failed') || msg.includes('failed to fetch') || msg.includes('network error')) {
        throw new Error(
          'Cannot reach the billing server at ' +
            API_URL +
            '. Start the server (npm run server in server folder). On a physical device, set EXPO_PUBLIC_STRIPE_API_URL in .env to your computer’s IP (e.g. http://192.168.1.5:4242).'
        );
      }
    }
    throw e;
  }
}

async function postJson<T>(path: string, body: object): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? 'Invalid response from server' : `Server error (${res.status}). Check that the server is running.`);
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export async function createSetupIntent(
  email: string
): Promise<{ clientSecret: string; customerId: string; stripeMode?: 'test' | 'live' }> {
  const data = await postJson<{ clientSecret: string; customerId: string; stripeMode?: 'test' | 'live' }>(
    '/create-setup-intent',
    { email }
  );
  assertPublishableKeyMatchesServerMode(data.stripeMode);
  return data;
}

export async function createSubscription(customerId: string): Promise<{
  subscriptionId: string;
  currentPeriodEnd?: string;
  status: string;
  clientSecret?: string;
  customerId?: string;
}> {
  return postJson('/create-subscription', { customerId });
}

/** Single PaymentSheet: first invoice PaymentIntent (card + first charge + 3DS if needed). */
export async function prepareSubscriptionPayment(email: string): Promise<{
  subscriptionId: string;
  customerId: string;
  status: string;
  clientSecret?: string;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  stripeMode?: 'test' | 'live';
}> {
  const data = await postJson<{
    subscriptionId: string;
    customerId: string;
    status: string;
    clientSecret?: string;
    currentPeriodEnd?: string;
    currentPeriodStart?: string;
    stripeMode?: 'test' | 'live';
  }>('/prepare-subscription-payment', { email });
  assertPublishableKeyMatchesServerMode(data.stripeMode);
  return data;
}

/** After SetupIntent succeeds: subscription in `trialing`; charge at trial end. */
export async function createTrialSubscription(customerId: string): Promise<{
  subscriptionId: string;
  customerId: string;
  status: string;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  trialPeriodDays: number;
  stripeMode?: 'test' | 'live';
}> {
  const data = await postJson<{
    subscriptionId: string;
    customerId: string;
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
    trialPeriodDays: number;
    stripeMode?: 'test' | 'live';
  }>('/create-trial-subscription', { customerId });
  assertPublishableKeyMatchesServerMode(data.stripeMode);
  return data;
}

export async function confirmSubscription(subscriptionId: string): Promise<{
  subscriptionId: string;
  customerId?: string;
  currentPeriodEnd: string | null;
  currentPeriodStart?: string | null;
  status: string;
}> {
  return postJson('/confirm-subscription', { subscriptionId });
}

/** Create a Customer Portal session; returns URL to open in browser. */
export async function createPortalSession(
  customerId: string,
  returnUrl?: string
): Promise<{ url: string }> {
  return postJson('/create-portal-session', { customerId, returnUrl });
}

/** Server cancels subscription, deletes Stripe customer, then removes Supabase auth user (CASCADE deletes app data). */
export async function closeUserAccount(accessToken: string): Promise<void> {
  await postJson<{ ok: boolean }>('/close-account', { accessToken });
}

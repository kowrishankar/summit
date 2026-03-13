const API_URL = process.env.EXPO_PUBLIC_STRIPE_API_URL || 'http://localhost:4242';
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds for Stripe + network

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
      if (e.message?.includes('Network request failed') || e.message?.includes('Failed to fetch')) {
        throw new Error(
          'Cannot reach the server at ' +
            API_URL +
            '. Is it running? On a physical device, use your computer’s IP (e.g. http://192.168.4.25:4242).'
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

export async function createSetupIntent(email: string): Promise<{ clientSecret: string; customerId: string }> {
  return postJson('/create-setup-intent', { email });
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

export async function confirmSubscription(subscriptionId: string): Promise<{
  subscriptionId: string;
  customerId?: string;
  currentPeriodEnd: string | null;
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

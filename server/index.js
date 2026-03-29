import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors({ origin: true }));

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(STRIPE_SECRET_KEY);
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const STRIPE_TRIAL_PERIOD_DAYS = Math.min(
  365,
  Math.max(1, parseInt(process.env.STRIPE_TRIAL_PERIOD_DAYS || '60', 10) || 60)
);

const isTestKey = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.startsWith('sk_test_');

/** Avoid duplicate subs: same customer + price already active or trialing. */
async function findExistingSubscriptionForPrice(customerId) {
  if (!STRIPE_PRICE_ID) return null;
  for (const status of ['active', 'trialing']) {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status,
      limit: 20,
    });
    for (const sub of subs.data) {
      const priceId = sub.items.data[0]?.price?.id;
      if (priceId === STRIPE_PRICE_ID) return sub;
    }
  }
  return null;
}

if (!STRIPE_PRICE_ID) {
  console.warn('STRIPE_PRICE_ID not set. Create a Price in Stripe Dashboard for £4.99/month and set it.');
} else if (STRIPE_PRICE_ID.startsWith('prod_')) {
  console.error('STRIPE_PRICE_ID must be a Price ID (starts with price_), not a Product ID (prod_). In Dashboard → Products → your product → Pricing, copy the Price ID.');
} else {
  console.log(
    `Stripe: using ${isTestKey ? 'TEST' : 'LIVE'} key. Price ID: ${STRIPE_PRICE_ID}. Trial: ${STRIPE_TRIAL_PERIOD_DAYS} day(s). Ensure price is in the same mode (Dashboard → Test/Live).`
  );
}

// Webhook must receive raw body for signature verification (register before express.json())
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    let event;
    if (STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.warn('⚠️  Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
      event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    }
    switch (event.type) {
      case 'checkout.session.completed':
        // Payment successful and subscription created; provision access (e.g. save to DB).
        break;
      case 'invoice.paid':
        // Continue to provision as payments recur; store status to avoid rate limits.
        break;
      case 'invoice.payment_failed':
        // Subscription becomes past_due; notify customer and send to portal to update payment method.
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Sync subscription status (e.g. cancel_at_period_end, cancelled).
        break;
      default:
        break;
    }
    res.sendStatus(200);
  }
);

app.use(express.json());

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cancel subscriptions and delete Stripe customer (removes payment methods and billing profile in Stripe). */
async function purgeStripeCustomer(customerId) {
  if (!customerId) return;
  const subs = await stripe.subscriptions.list({ customer: customerId, limit: 100 });
  for (const sub of subs.data) {
    const terminal = sub.status === 'canceled' || sub.status === 'incomplete_expired';
    if (!terminal) {
      try {
        await stripe.subscriptions.cancel(sub.id);
      } catch (e) {
        console.warn('[close-account] cancel subscription', sub.id, e?.message);
      }
    }
  }
  try {
    await stripe.customers.del(customerId);
  } catch (e) {
    if (e.code !== 'resource_missing') throw e;
  }
}

/**
 * Permanently delete the signed-in user: Stripe cleanup from DB-linked IDs, then Supabase Auth delete (CASCADE removes app data).
 * Body: { accessToken: string } — user JWT from supabase.auth.getSession().
 */
app.post('/close-account', async (req, res) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({
      error:
        'Account closure is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on this server (Supabase Dashboard → Settings → API).',
    });
  }
  const accessToken =
    typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required' });
  }
  const {
    data: { user },
    error: authErr,
  } = await admin.auth.getUser(accessToken);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Sign in again.' });
  }
  const userId = user.id;
  try {
    const { data: subRow, error: subErr } = await admin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (subErr) {
      console.error('[close-account] subscriptions', subErr);
      return res.status(500).json({ error: 'Could not read billing data. Try again.' });
    }
    if (subRow?.stripe_customer_id) {
      if (!STRIPE_SECRET_KEY) {
        return res.status(503).json({ error: 'Stripe is not configured; cannot remove billing data.' });
      }
      await purgeStripeCustomer(subRow.stripe_customer_id);
    } else if (subRow?.stripe_subscription_id && STRIPE_SECRET_KEY) {
      try {
        await stripe.subscriptions.cancel(subRow.stripe_subscription_id);
      } catch (e) {
        if (e.code !== 'resource_missing') {
          console.warn('[close-account] cancel subscription', e?.message);
        }
      }
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error('[close-account] deleteUser', delErr);
      return res.status(500).json({ error: delErr.message || 'Could not delete account.' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[close-account]', e);
    return res.status(500).json({ error: e.message || 'Account closure failed.' });
  }
});

/** Health check – hit this from your phone browser to confirm the server is reachable (e.g. http://YOUR_IP:4242/health) */
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Stripe server is reachable' });
});

/** Create or retrieve Stripe Customer by email; create SetupIntent for adding payment method. */
app.post('/create-setup-intent', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }

    const customers = await stripe.customers.list({ email: email.trim(), limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        email: email.trim(),
      });
    }

    // Use explicit card — works reliably with @stripe/stripe-react-native PaymentSheet (saves a card for subscriptions).
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: 'off_session',
      payment_method_types: ['card'],
    });

    if (!setupIntent.client_secret) {
      return res.status(500).json({ error: 'SetupIntent missing client_secret' });
    }

    return res.status(200).json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      /** App must use pk_test_* with sk_test_* or pk_live_* with sk_live_* from the same Stripe account. */
      stripeMode: isTestKey ? 'test' : 'live',
    });
  } catch (e) {
    console.error('create-setup-intent', e);
    return res.status(500).json({ error: e.message || 'Failed to create setup intent' });
  }
});

/**
 * After SetupIntent (card on file, no charge): create a subscription in `trialing` status.
 * First charge runs automatically at trial end using the saved payment method.
 */
app.post('/create-trial-subscription', async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId is required' });
    }
    if (!STRIPE_PRICE_ID) {
      return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });
    }

    const existing = await findExistingSubscriptionForPrice(customerId);
    if (existing) {
      const currentPeriodEnd = existing.current_period_end
        ? new Date(existing.current_period_end * 1000).toISOString()
        : null;
      const currentPeriodStart = existing.current_period_start
        ? new Date(existing.current_period_start * 1000).toISOString()
        : null;
      return res.status(200).json({
        subscriptionId: existing.id,
        customerId,
        status: existing.status,
        currentPeriodEnd,
        currentPeriodStart,
        trialPeriodDays: STRIPE_TRIAL_PERIOD_DAYS,
        stripeMode: isTestKey ? 'test' : 'live',
      });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    const paymentMethodId = paymentMethods.data[0]?.id;
    if (!paymentMethodId) {
      return res.status(400).json({
        error: 'No payment method on file. Complete the card step first.',
      });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: STRIPE_PRICE_ID }],
      trial_period_days: STRIPE_TRIAL_PERIOD_DAYS,
      default_payment_method: paymentMethodId,
      payment_settings: { save_default_payment_method: 'on_subscription' },
    });

    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const currentPeriodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null;

    return res.status(200).json({
      subscriptionId: subscription.id,
      customerId,
      status: subscription.status,
      currentPeriodEnd,
      currentPeriodStart,
      trialPeriodDays: STRIPE_TRIAL_PERIOD_DAYS,
      stripeMode: isTestKey ? 'test' : 'live',
    });
  } catch (e) {
    console.error('create-trial-subscription', e);
    return res.status(500).json({ error: e.message || 'Failed to create trial subscription' });
  }
});

/**
 * One-step subscribe: create (or reuse) an incomplete subscription so the first invoice’s
 * PaymentIntent collects card + first charge in a single PaymentSheet (no separate SetupIntent).
 */
app.post('/prepare-subscription-payment', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }
    if (!STRIPE_PRICE_ID) {
      return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });
    }

    const customers = await stripe.customers.list({ email: email.trim(), limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({ email: email.trim() });
    }

    const existingPaidOrTrial = await findExistingSubscriptionForPrice(customer.id);
    if (existingPaidOrTrial) {
      const currentPeriodEnd = existingPaidOrTrial.current_period_end
        ? new Date(existingPaidOrTrial.current_period_end * 1000).toISOString()
        : null;
      const currentPeriodStart = existingPaidOrTrial.current_period_start
        ? new Date(existingPaidOrTrial.current_period_start * 1000).toISOString()
        : null;
      return res.status(200).json({
        subscriptionId: existingPaidOrTrial.id,
        customerId: customer.id,
        status: existingPaidOrTrial.status,
        currentPeriodEnd,
        currentPeriodStart,
        stripeMode: isTestKey ? 'test' : 'live',
      });
    }

    const existingIncomplete = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'incomplete',
      limit: 10,
      expand: ['data.latest_invoice.payment_intent'],
    });

    let subscription;
    let paymentIntent = null;

    for (const sub of existingIncomplete.data) {
      const priceId = sub.items.data[0]?.price?.id;
      if (priceId !== STRIPE_PRICE_ID) continue;
      const inv = sub.latest_invoice;
      if (typeof inv !== 'object' || !inv) continue;
      let pi = inv.payment_intent;
      if (typeof pi === 'string') {
        pi = await stripe.paymentIntents.retrieve(pi);
      }
      if (
        pi?.client_secret &&
        ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)
      ) {
        subscription = sub;
        paymentIntent = pi;
        break;
      }
    }

    if (!subscription) {
      subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: STRIPE_PRICE_ID }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });
      const latestInvoice = subscription.latest_invoice;
      if (typeof latestInvoice === 'object' && latestInvoice?.payment_intent) {
        const pi = latestInvoice.payment_intent;
        paymentIntent = typeof pi === 'string' ? await stripe.paymentIntents.retrieve(pi) : pi;
      }
    }

    if (subscription.status === 'active' || subscription.status === 'trialing') {
      const currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
      const currentPeriodStart = subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null;
      return res.status(200).json({
        subscriptionId: subscription.id,
        customerId: customer.id,
        status: subscription.status,
        currentPeriodEnd,
        currentPeriodStart,
        stripeMode: isTestKey ? 'test' : 'live',
      });
    }

    const needsClientPayment =
      paymentIntent?.client_secret &&
      ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status);

    if (needsClientPayment) {
      return res.status(200).json({
        subscriptionId: subscription.id,
        customerId: customer.id,
        clientSecret: paymentIntent.client_secret,
        status: 'requires_payment',
        stripeMode: isTestKey ? 'test' : 'live',
      });
    }

    const refreshed = await stripe.subscriptions.retrieve(subscription.id);
    const currentPeriodEnd = refreshed.current_period_end
      ? new Date(refreshed.current_period_end * 1000).toISOString()
      : null;
    const currentPeriodStart = refreshed.current_period_start
      ? new Date(refreshed.current_period_start * 1000).toISOString()
      : null;
    return res.status(200).json({
      subscriptionId: refreshed.id,
      customerId: customer.id,
      status: refreshed.status,
      currentPeriodEnd,
      currentPeriodStart,
      stripeMode: isTestKey ? 'test' : 'live',
    });
  } catch (e) {
    console.error('prepare-subscription-payment', e);
    let message = e.message || 'Failed to prepare subscription';
    if (message.includes('No such price')) {
      message =
        'Invalid or missing price. Use a Price ID (price_...) from the same Stripe account and same mode (Test/Live) as your secret key.';
    }
    return res.status(500).json({ error: message });
  }
});

/** Create subscription for customer; uses their default or first attached payment method. */
app.post('/create-subscription', async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId is required' });
    }
    if (!STRIPE_PRICE_ID) {
      return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    const paymentMethodId = paymentMethods.data[0]?.id;
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'No payment method on file. Please add a card first.' });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: STRIPE_PRICE_ID }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = subscription.latest_invoice;
    const paymentIntent = typeof latestInvoice?.payment_intent === 'object' ? latestInvoice.payment_intent : latestInvoice?.payment_intent;
    const needsPayment = paymentIntent?.client_secret && ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent?.status);

    if (needsPayment) {
      return res.status(200).json({
        subscriptionId: subscription.id,
        customerId,
        clientSecret: paymentIntent.client_secret,
        status: 'requires_payment',
      });
    }

    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    return res.status(200).json({
      subscriptionId: subscription.id,
      customerId,
      currentPeriodEnd,
      status: subscription.status,
    });
  } catch (e) {
    console.error('create-subscription', e);
    let message = e.message || 'Failed to create subscription';
    if (message.includes('No such price')) {
      message = 'Invalid or missing price. Use a Price ID (price_...) from the same Stripe account and same mode (Test/Live) as your secret key. Check server startup log for details.';
    }
    return res.status(500).json({ error: message });
  }
});

/** Confirm subscription after client pays (if we returned requires_payment). */
app.post('/confirm-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId is required' });
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const currentPeriodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    return res.status(200).json({
      subscriptionId: subscription.id,
      customerId,
      currentPeriodEnd,
      currentPeriodStart,
      status: subscription.status,
    });
  } catch (e) {
    console.error('confirm-subscription', e);
    return res.status(500).json({ error: e.message || 'Failed to confirm subscription' });
  }
});

/** Create Customer Portal session so customer can manage subscription, payment method, invoices. */
app.post('/create-portal-session', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId is required' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || undefined,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-portal-session', e);
    return res.status(500).json({ error: e.message || 'Failed to create portal session' });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`On your network: http://<your-ip>:${PORT} (use this for EXPO_PUBLIC_STRIPE_API_URL on a physical device)`);
});

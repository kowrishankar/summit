import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';

const app = express();
app.use(cors({ origin: true }));

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(STRIPE_SECRET_KEY);
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const isTestKey = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.startsWith('sk_test_');

if (!STRIPE_PRICE_ID) {
  console.warn('STRIPE_PRICE_ID not set. Create a Price in Stripe Dashboard for £14.99/month and set it.');
} else if (STRIPE_PRICE_ID.startsWith('prod_')) {
  console.error('STRIPE_PRICE_ID must be a Price ID (starts with price_), not a Product ID (prod_). In Dashboard → Products → your product → Pricing, copy the Price ID.');
} else {
  console.log(`Stripe: using ${isTestKey ? 'TEST' : 'LIVE'} key. Price ID: ${STRIPE_PRICE_ID}. Ensure this price was created in the same mode (Dashboard → toggle Test/Live in top-right).`);
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

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: 'off_session',
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    });
  } catch (e) {
    console.error('create-setup-intent', e);
    return res.status(500).json({ error: e.message || 'Failed to create setup intent' });
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
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    return res.status(200).json({
      subscriptionId: subscription.id,
      customerId,
      currentPeriodEnd,
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

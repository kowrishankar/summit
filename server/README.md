# Summit – Stripe API server

This server handles Stripe subscription setup and creation for the app.

## Setup

1. Copy `.env.example` to `.env` and set:
   - **STRIPE_SECRET_KEY** – Your Stripe secret key (Dashboard → Developers → API keys). Use `sk_test_...` for development.
   - **STRIPE_PRICE_ID** – Fallback Price ID if tier-specific IDs below are omitted. Create Products in Stripe for **Personal** (£4.99/mo), **Business** (£9.99/mo), and **Practice** (£14.99/mo), then set:
   - **STRIPE_PRICE_ID_INDIVIDUAL**, **STRIPE_PRICE_ID_BUSINESS**, **STRIPE_PRICE_ID_PRACTICE** – Price IDs (`price_...`) for each tier. If any are unset, **STRIPE_PRICE_ID** is used for that tier (fine for early testing with one price).
   - **STRIPE_TRIAL_DAYS_INDIVIDUAL** (default `7`), **STRIPE_TRIAL_DAYS_BUSINESS** (default `14`), **STRIPE_TRIAL_DAYS_PRACTICE** (default `30`) – Trial length for `/create-trial-subscription`. **STRIPE_TRIAL_PERIOD_DAYS** (legacy) applies to a tier only when that tier’s env is unset.
   - **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** – Required for **POST /close-account** (in-app “Close account”: cancels Stripe subscription, deletes Stripe customer, removes Supabase auth user). From Supabase Dashboard → Settings → API (use **service_role**, never expose it in the app).
   - **PORT** – Optional; defaults to 4242.

2. Install and run:
   ```bash
   cd server && npm install && npm run dev
   ```

3. In the app `.env`, set:
   - **EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY** – Stripe publishable key (`pk_test_...`).
   - **EXPO_PUBLIC_STRIPE_API_URL** – This server’s URL. Use `http://localhost:4242` for simulator; for a physical device use your machine’s IP (e.g. `http://192.168.1.5:4242`).

## Endpoints

- **POST /prepare-subscription-payment** – Body: `{ "email": "user@example.com", "accountKind": "individual" | "business" | "practice", "additionalPracticeSlot": false }`. Picks the Stripe price for the tier (`accountKind` defaults to `individual`). For **Practice**, set `additionalPracticeSlot: true` to create **another** subscription for an extra client workspace (skips “already subscribed” deduplication). Returns `{ clientSecret, subscriptionId, customerId, status: "requires_payment" }` for Payment Sheet, or active/trialing details if already paid.
- **POST /create-trial-subscription** – Body: `{ "customerId": "cus_...", "accountKind": "individual" | "business" | "practice" }`. Call **after** SetupIntent. Creates a trialing subscription for the tier’s price; first charge at trial end.
- **POST /create-setup-intent** – Body: `{ "email": "user@example.com" }`. Returns `{ clientSecret, customerId }` for a SetupIntent-only flow (legacy; the app uses `/prepare-subscription-payment` instead).
- **POST /create-subscription** – Body: `{ "customerId": "cus_...", "accountKind": "individual" | "business" | "practice" }`. Creates a subscription for that tier’s price. Returns `subscriptionId`, `customerId`, `currentPeriodEnd`, and optionally `clientSecret` if the first charge needs confirmation (e.g. 3DS).
- **POST /confirm-subscription** – Body: `{ "subscriptionId": "sub_..." }`. Returns subscription details including `customerId` and `currentPeriodEnd`.
- **POST /create-portal-session** – Body: `{ "customerId": "cus_...", "returnUrl": "https://..." }`. Creates a Stripe Customer Portal session; returns `{ url }` to open in the browser so the customer can manage subscription, payment method, and invoices.
- **POST /close-account** – Body: `{ "accessToken": "<Supabase JWT>" }`. Verifies the session, cancels subscriptions and deletes the Stripe customer linked from `subscriptions` for that user (if any), then deletes the Supabase auth user (database rows cascade). Returns `{ ok: true }`.
- **POST /webhook** – Stripe webhooks. Configure in Dashboard (e.g. `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`). Set `STRIPE_WEBHOOK_SECRET` for signature verification.

## Deploying to production

See **[docs/BACKEND-DEPLOYMENT.md](../docs/BACKEND-DEPLOYMENT.md)** for where to host this server (Railway, Render, Fly.io, etc.) and how to set env vars and Stripe webhooks.

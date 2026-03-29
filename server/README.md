# Summit – Stripe API server

This server handles Stripe subscription setup and creation for the app.

## Setup

1. Copy `.env.example` to `.env` and set:
   - **STRIPE_SECRET_KEY** – Your Stripe secret key (Dashboard → Developers → API keys). Use `sk_test_...` for development.
   - **STRIPE_PRICE_ID** – Create a Product in Stripe Dashboard with a recurring price of £4.99/month, then paste the Price ID (e.g. `price_...`).
   - **STRIPE_TRIAL_PERIOD_DAYS** – Optional; default `14`. Used when the app creates a subscription with a free trial (card collected up front; first charge at trial end).
   - **PORT** – Optional; defaults to 4242.

2. Install and run:
   ```bash
   cd server && npm install && npm run dev
   ```

3. In the app `.env`, set:
   - **EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY** – Stripe publishable key (`pk_test_...`).
   - **EXPO_PUBLIC_STRIPE_API_URL** – This server’s URL. Use `http://localhost:4242` for simulator; for a physical device use your machine’s IP (e.g. `http://192.168.1.5:4242`).

## Endpoints

- **POST /prepare-subscription-payment** – Body: `{ "email": "user@example.com" }`. Creates or reuses an incomplete subscription and returns `{ clientSecret, subscriptionId, customerId, status: "requires_payment" }` so the app can open **one** Payment Sheet (first invoice PaymentIntent: card + first charge + 3DS). If the subscription is already active or trialing, returns `status`, `currentPeriodEnd`, `currentPeriodStart`, and no `clientSecret`.
- **POST /create-trial-subscription** – Body: `{ "customerId": "cus_..." }`. Call **after** the client completes a SetupIntent (card on file). Creates a subscription with `trial_period_days` from `STRIPE_TRIAL_PERIOD_DAYS`; first charge runs at trial end. Returns `subscriptionId`, `status` (usually `trialing`), `currentPeriodEnd`, `currentPeriodStart`, `trialPeriodDays`.
- **POST /create-setup-intent** – Body: `{ "email": "user@example.com" }`. Returns `{ clientSecret, customerId }` for a SetupIntent-only flow (legacy; the app uses `/prepare-subscription-payment` instead).
- **POST /create-subscription** – Body: `{ "customerId": "cus_..." }`. Creates a £4.99/month subscription using the customer’s payment method. Returns `subscriptionId`, `customerId`, `currentPeriodEnd`, and optionally `clientSecret` if the first charge needs confirmation (e.g. 3DS).
- **POST /confirm-subscription** – Body: `{ "subscriptionId": "sub_..." }`. Returns subscription details including `customerId` and `currentPeriodEnd`.
- **POST /create-portal-session** – Body: `{ "customerId": "cus_...", "returnUrl": "https://..." }`. Creates a Stripe Customer Portal session; returns `{ url }` to open in the browser so the customer can manage subscription, payment method, and invoices.
- **POST /webhook** – Stripe webhooks. Configure in Dashboard (e.g. `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`). Set `STRIPE_WEBHOOK_SECRET` for signature verification.

## Deploying to production

See **[docs/BACKEND-DEPLOYMENT.md](../docs/BACKEND-DEPLOYMENT.md)** for where to host this server (Railway, Render, Fly.io, etc.) and how to set env vars and Stripe webhooks.

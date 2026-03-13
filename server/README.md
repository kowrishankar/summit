# Summit – Stripe API server

This server handles Stripe subscription setup and creation for the app.

## Setup

1. Copy `.env.example` to `.env` and set:
   - **STRIPE_SECRET_KEY** – Your Stripe secret key (Dashboard → Developers → API keys). Use `sk_test_...` for development.
   - **STRIPE_PRICE_ID** – Create a Product in Stripe Dashboard with a recurring price of £14.99/month, then paste the Price ID (e.g. `price_...`).
   - **PORT** – Optional; defaults to 4242.

2. Install and run:
   ```bash
   cd server && npm install && npm run dev
   ```

3. In the app `.env`, set:
   - **EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY** – Stripe publishable key (`pk_test_...`).
   - **EXPO_PUBLIC_STRIPE_API_URL** – This server’s URL. Use `http://localhost:4242` for simulator; for a physical device use your machine’s IP (e.g. `http://192.168.1.5:4242`).

## Endpoints

- **POST /create-setup-intent** – Body: `{ "email": "user@example.com" }`. Returns `{ clientSecret, customerId }` for the Payment Sheet (add card).
- **POST /create-subscription** – Body: `{ "customerId": "cus_..." }`. Creates a £14.99/month subscription using the customer’s payment method. Returns `subscriptionId`, `customerId`, `currentPeriodEnd`, and optionally `clientSecret` if the first charge needs confirmation (e.g. 3DS).
- **POST /confirm-subscription** – Body: `{ "subscriptionId": "sub_..." }`. Returns subscription details including `customerId` and `currentPeriodEnd`.
- **POST /create-portal-session** – Body: `{ "customerId": "cus_...", "returnUrl": "https://..." }`. Creates a Stripe Customer Portal session; returns `{ url }` to open in the browser so the customer can manage subscription, payment method, and invoices.
- **POST /webhook** – Stripe webhooks. Configure in Dashboard (e.g. `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`). Set `STRIPE_WEBHOOK_SECRET` for signature verification.

## Deploying to production

See **[docs/BACKEND-DEPLOYMENT.md](../docs/BACKEND-DEPLOYMENT.md)** for where to host this server (Railway, Render, Fly.io, etc.) and how to set env vars and Stripe webhooks.

# Where to publish the backend

The backend in **`server/`** is a Node.js Express app that handles Stripe subscriptions (setup intents, checkout, customer portal, webhooks). It is stateless and has no database.

You need to deploy it to a **public HTTPS URL** so that:

1. The mobile app can call it (set `EXPO_PUBLIC_STRIPE_API_URL` to this URL in production).
2. Stripe can send webhooks to `https://your-domain.com/webhook`.

---

## Recommended hosting options

| Platform    | Best for              | Free tier        | Notes                                      |
|------------|------------------------|------------------|--------------------------------------------|
| **Railway**| Easiest, fast deploy   | Yes (usage-based)| Git deploy, env vars, automatic HTTPS      |
| **Render** | Simple, Git-based     | Yes (spins down) | Web service from repo, free tier sleeps     |
| **Fly.io** | Global, low latency   | Yes              | CLI deploy, good free allowance            |
| **Vercel** | Serverless            | Yes              | Use Node serverless; webhook needs raw body |
| **Google Cloud Run** | Scale-to-zero   | Free tier        | Container or source deploy                 |

Below are step-by-step instructions for **Railway** and **Render** as the quickest options.

---

## Option 1: Railway

1. Sign up at [railway.app](https://railway.app).
2. **New project** → **Deploy from GitHub repo** (connect your repo, choose the repo; you’ll deploy the whole project and set root later, or use a monorepo setup).
3. If the repo is the whole app (Expo + server):
   - After creating the project, add a **service** and set **Root Directory** to `server` (so only `server/` is built and run).
   - Set **Build Command** to `npm install` (or leave default).
   - Set **Start Command** to `npm start` (or `node index.js`).
4. In the service → **Variables**, add:
   - `STRIPE_SECRET_KEY` (use live key `sk_live_...` for production)
   - `STRIPE_PRICE_ID` (live price ID for production)
   - `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard webhook for this URL)
   - `PORT` is usually set by Railway (e.g. `PORT=4242` or use their default).
5. **Settings** → **Networking** → **Generate domain**. You’ll get a URL like `https://your-app.up.railway.app`.
6. In Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**:
   - URL: `https://your-app.up.railway.app/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET` in Railway.
7. In your app’s production config (EAS env or `.env` for prod), set:
   - `EXPO_PUBLIC_STRIPE_API_URL=https://your-app.up.railway.app`
   - Use your **live** Stripe publishable key for the store builds.

---

## Option 2: Render

1. Sign up at [render.com](https://render.com).
2. **New** → **Web Service**.
3. Connect your repo; choose the repo and branch.
4. Configure:
   - **Root Directory:** `server` (so Render builds and runs only the backend).
   - **Runtime:** Node.
   - **Build Command:** `npm install`.
   - **Start Command:** `npm start`.
5. **Environment** → Add:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID`
   - `STRIPE_WEBHOOK_SECRET`
   - (Render sets `PORT` automatically.)
6. Create the service. Render will assign a URL like `https://summit-server.onrender.com`.
7. In Stripe Dashboard add a webhook endpoint: `https://summit-server.onrender.com/webhook` and set the signing secret in Render env.
8. Set `EXPO_PUBLIC_STRIPE_API_URL` to your Render URL for the app.

**Note:** On the free tier, the service may spin down after inactivity; the first request after that can be slow (cold start).

---

## After deployment

1. **Stripe webhook**  
   Use the **live** Stripe mode in Dashboard, add endpoint `https://YOUR_BACKEND_URL/webhook`, select the events listed above, and set `STRIPE_WEBHOOK_SECRET` in your host’s env.

2. **App config**  
   Point the production app to the backend:
   - `EXPO_PUBLIC_STRIPE_API_URL=https://YOUR_BACKEND_URL`
   - Use the **live** Stripe publishable key (`pk_live_...`) in the app when building for store.

3. **CORS**  
   The server uses `cors({ origin: true })`, so any origin is allowed. For production you can restrict this to your app’s scheme or website if you add one.

4. **Health check**  
   You can ping `https://YOUR_BACKEND_URL/health` to confirm the server is up.

---

## Quick reference: env vars for production

| Variable                | Where it goes | Notes |
|-------------------------|---------------|--------|
| `STRIPE_SECRET_KEY`     | Backend       | Use `sk_live_...` for production |
| `STRIPE_PRICE_ID`       | Backend       | Live price ID (`price_...`) |
| `STRIPE_WEBHOOK_SECRET` | Backend       | From Stripe webhook endpoint for your deployed URL |
| `EXPO_PUBLIC_STRIPE_API_URL` | App (EAS / build env) | `https://your-backend-url` |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | App | Use `pk_live_...` for store builds |

Once the backend is deployed and the webhook is configured in Stripe, the app can use it for subscriptions in production.

# Supabase backend setup (Summit)

Supabase provides **auth** (email/password, secure) and **PostgreSQL** so users and all app data (businesses, invoices, sales, categories, subscriptions) are stored in one place. Users can log in from any device and see the same data.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** – pick org, name (e.g. Summit), database password, region.
3. In **Settings → API**: copy **Project URL** and your **publishable** (client) API key. Add to your app `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key`  
   (New keys are under “API Keys”; format is often `sb_publishable_...`. The legacy “anon” key still works—use `EXPO_PUBLIC_SUPABASE_ANON_KEY` if you prefer.)

## 2. Run the database schema

In Supabase Dashboard go to **SQL Editor** and run the following (creates tables and RLS so each user only sees their own data).

```sql
-- Businesses (one user can have many)
CREATE TABLE business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories (per business)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices (expenses)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('upload', 'manual')),
  file_uri TEXT,
  file_uris TEXT[],
  file_name TEXT,
  extracted JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales (income)
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('upload', 'manual')),
  file_uri TEXT,
  file_uris TEXT[],
  file_name TEXT,
  extracted JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User subscription status (Stripe)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'cancel_at_period_end', 'cancelled')),
  amount_pence INT NOT NULL,
  currency TEXT NOT NULL,
  interval TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User's selected business (stored in app; optional server-side preference)
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_business_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: enable and policies so users only see their own data
-- USING = who can read/update/delete; WITH CHECK = what rows can be inserted/updated (required for INSERT)
ALTER TABLE business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own businesses"
  ON business_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage categories of their businesses"
  ON categories FOR ALL
  USING (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage invoices of their businesses"
  ON invoices FOR ALL
  USING (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage sales of their businesses"
  ON sales FOR ALL
  USING (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own subscription"
  ON subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- If you already created policies without WITH CHECK, fix them by running the DROP + CREATE below for the failing table.

-- Storage bucket for invoice/sale attachments (optional; create in Dashboard if you use Storage)
-- Storage → New bucket → name: attachments, public or private with RLS
```

### Already created `subscriptions` without `trialing`?

If your table was created with an older schema, allow the **free trial** status in Postgres (run once in **SQL Editor**):

```sql
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'trialing', 'cancel_at_period_end', 'cancelled'));
```

If the constraint has a different name, find it with:

```sql
SELECT conname FROM pg_constraint
  WHERE conrelid = 'public.subscriptions'::regclass AND contype = 'c';
```

## 3. Storage bucket (for invoice/sale files)

If you want to store receipt/invoice images and PDFs in Supabase:

1. **Storage** → **New bucket** → name: **`attachments`**, set to **Public** (so stored URLs work from any device).
2. **Policies** → New policy: “Users can upload/read in their folder”:
   - Run the policy SQL in *"Troubleshooting: Storage upload returns 400"* below (INSERT + UPDATE on `storage.objects`).

## 4. Auth settings

- **Authentication** → **Providers**: Email enabled by default.
- **URL Configuration**: Add your app’s redirect URL (e.g. `summit://**` or your Expo deep link) for password reset and email confirm if needed.

After this, the app uses Supabase for auth and all data; no data is stored only on device.

---

## Troubleshooting: "apikey request header... missing or invalid"

1. **Use the right key**  
   In the app you must use the **publishable** or **anon** (public) key, **not** the **secret / service_role** key.  
   - Supabase Dashboard → **Settings → API**.  
   - Copy **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`.  
   - Copy the **publishable** key (or the legacy **anon** key) → `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY`.  
   - Do **not** use the secret / service role key in the app.

2. **Env vars and restart**  
   - In the project root `.env`, set both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `EXPO_PUBLIC_SUPABASE_ANON_KEY`).  
   - No quotes needed; no spaces around `=`.  
   - Restart the dev server and clear cache: `npx expo start --clear`.  
   - Expo reads `EXPO_PUBLIC_*` at build/start time, so changes to `.env` need a restart.

3. **Check the key value**  
   - Publishable keys often start with `sb_publishable_`; legacy anon keys are long JWTs starting with `eyJ...`.  
   - Paste again from the dashboard to avoid typos or truncation.  
   - If you rotated or recreated keys in the dashboard, update `.env` with the new value and restart.

---

## Troubleshooting: "Network request failed"

This usually means the app cannot reach Supabase’s servers.

1. **Use HTTPS**  
   `EXPO_PUBLIC_SUPABASE_URL` must be **`https://`** (e.g. `https://xxxx.supabase.co`), not `http://`.

2. **Device/emulator has internet**  
   - Physical device: connect to Wi‑Fi or cellular; try opening a website in the browser.  
   - Emulator: ensure the host machine is online and the emulator has network access (Android: check emulator network settings; iOS Simulator usually shares the Mac’s network).

3. **No typo in URL**  
   Copy the **Project URL** again from Supabase Dashboard → Settings → API. It should look like `https://abcdefghijk.supabase.co` (no trailing slash, no path).

4. **Project not paused**  
   Free-tier Supabase projects pause after inactivity. In the dashboard, if the project shows as paused, click **Restore** and wait a minute, then try again.

5. **VPN / firewall**  
   If you’re on a corporate or restricted network, try turning off VPN or using another network; some block outbound HTTPS to certain hosts.

---

## Troubleshooting: "new row violates row-level security policy" on signup

This happens when inserting into `business_accounts` (or another table) and RLS blocks the insert.

1. **Add WITH CHECK to the policy**  
   INSERT needs a policy that allows the new row. In **SQL Editor** run (fixes `business_accounts`):

   ```sql
   DROP POLICY IF EXISTS "Users can manage own businesses" ON business_accounts;
   CREATE POLICY "Users can manage own businesses"
     ON business_accounts FOR ALL
     USING (auth.uid() = user_id)
     WITH CHECK (auth.uid() = user_id);
   ```

   If you see the same error on other tables (e.g. `user_preferences`), add `WITH CHECK (auth.uid() = user_id)` (or the matching condition) to those policies the same way.

2. **Turn off "Confirm email" for development**  
   If Supabase requires email confirmation, the session may not be set right after signup, so `auth.uid()` can be null and RLS blocks the insert.  
   In Dashboard: **Authentication → Providers → Email** → disable **"Confirm email"** so signup logs the user in immediately. You can re-enable it for production.

---

## Troubleshooting: "new row violates row-level security policy" when uploading invoice (or sale)

If you see this when saving an invoice or sale, the **invoices** or **sales** table policy likely doesn’t allow INSERT (missing or wrong WITH CHECK). Run the SQL below in the Supabase **SQL Editor** to fix tables and (if needed) Storage.

**1. Tables (business_accounts, invoices, sales)** Run this first:

```sql
-- business_accounts (e.g. signup)
DROP POLICY IF EXISTS "Users can manage own businesses" ON business_accounts;
CREATE POLICY "Users can manage own businesses"
  ON business_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- invoices (create/update invoice, including after file upload)
DROP POLICY IF EXISTS "Users can manage invoices of their businesses" ON invoices;
CREATE POLICY "Users can manage invoices of their businesses"
  ON invoices FOR ALL
  USING (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()));

-- sales (create/update sale)
DROP POLICY IF EXISTS "Users can manage sales of their businesses" ON sales;
CREATE POLICY "Users can manage sales of their businesses"
  ON sales FOR ALL
  USING (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid()));
```

**2. Storage (file upload)** If the error happens when uploading the image/PDF, run this too (creates policies on `storage.objects`):

```sql
DROP POLICY IF EXISTS "Users can upload to own folder in attachments" ON storage.objects;
CREATE POLICY "Users can upload to own folder in attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own folder in attachments" ON storage.objects;
CREATE POLICY "Users can update own folder in attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
```

Ensure the **`attachments`** bucket exists (Storage → New bucket → name `attachments`, Public). Then try again.

---

## Troubleshooting: Storage upload returns 400 (POST to .../storage/v1/object/attachments/...)

If the Supabase log shows **POST 400** to a URL like  
`https://xxx.supabase.co/storage/v1/object/attachments/{userId}/invoices/{id}/0.jpg`,  
the failure is **Storage** (uploading the file), not the `invoices` or `sales` table. Fix it as follows.

1. **Create the bucket if it doesn’t exist**  
   In Supabase: **Storage** → **New bucket** → name **`attachments`** → set to **Public** → Create.

2. **Add RLS policies on Storage**  
   Storage uses the `storage.objects` table. By default there is **no** INSERT permission, so uploads get 400. In the **SQL Editor** run:

   ```sql
   -- Allow authenticated users to upload only into their own folder: {user_id}/...
   DROP POLICY IF EXISTS "Users can upload to own folder in attachments" ON storage.objects;
   CREATE POLICY "Users can upload to own folder in attachments"
     ON storage.objects FOR INSERT
     TO authenticated
     WITH CHECK (
       bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text
     );

   -- Allow update (e.g. upsert) in the same folder
   DROP POLICY IF EXISTS "Users can update own folder in attachments" ON storage.objects;
   CREATE POLICY "Users can update own folder in attachments"
     ON storage.objects FOR UPDATE
     TO authenticated
     USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
     WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
   ```

   The app uploads to paths like `{userId}/invoices/{recordId}/0.jpg`, so the first path segment must equal the signed-in user’s ID.

3. **Confirm you’re signed in**  
   Uploads use the Supabase auth session. If the session is missing or expired, the request may fail. Ensure the user is logged in before adding an invoice/sale with photos.

4. **React Native / Expo: request body**  
   In React Native, `Blob` from `ArrayBuffer`/`Uint8Array` is not supported. The app uploads using **FormData** with the file **URI** (`{ uri, type, name }`) so the native layer streams the file in multipart/form-data. Rebuild or refresh the app so it uses the updated `attachmentStorage` code.

After applying the SQL and (if needed) rebuilding, try adding an invoice with an image again.

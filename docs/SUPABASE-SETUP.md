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
r

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
  review_status TEXT NOT NULL DEFAULT 'complete' CHECK (review_status IN ('complete', 'processing', 'pending_review', 'failed')),
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

**Existing projects** (tables already created without `review_status`): run this once in **SQL Editor**:

```sql
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'complete'
  CHECK (review_status IN ('complete', 'processing', 'pending_review', 'failed'));
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'complete'
  CHECK (review_status IN ('complete', 'processing', 'pending_review', 'failed'));
```

### Team access (invite collaborators)

Lets the **subscription owner** invite other people (e.g. an accountant) by email. Each person signs in with their **own** Supabase account; invited users see the same businesses, invoices, and sales as the owner. Run this **once** in **SQL Editor** after the main schema (it replaces some RLS policies).

```sql
-- ---- Tables ----
CREATE TABLE IF NOT EXISTS account_access_members (
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, member_user_id)
);

CREATE TABLE IF NOT EXISTS account_access_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_access_invites_owner ON account_access_invites (owner_user_id);
CREATE INDEX IF NOT EXISTS account_access_members_member ON account_access_members (member_user_id);

ALTER TABLE account_access_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_access_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and members see membership rows"
  ON account_access_members FOR SELECT
  USING (owner_user_id = auth.uid() OR member_user_id = auth.uid());

CREATE POLICY "Owners remove members"
  ON account_access_members FOR DELETE
  USING (owner_user_id = auth.uid() OR member_user_id = auth.uid());

CREATE POLICY "Owners manage invites"
  ON account_access_invites FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners create invites"
  ON account_access_invites FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners delete invites"
  ON account_access_invites FOR DELETE
  USING (owner_user_id = auth.uid());

-- Inserts into account_access_members are done by accept_account_invite() below (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.accept_account_invite(invite_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv account_access_invites%ROWTYPE;
  em TEXT;
BEGIN
  SELECT * INTO inv FROM account_access_invites
  WHERE token = invite_token AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired_invite';
  END IF;

  SELECT lower(trim(email)) INTO em FROM auth.users WHERE id = auth.uid();
  IF em IS NULL OR lower(trim(inv.invited_email)) <> em THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF inv.owner_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_accept_own_invite';
  END IF;

  INSERT INTO account_access_members (owner_user_id, member_user_id, member_email)
  VALUES (inv.owner_user_id, auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  ON CONFLICT (owner_user_id, member_user_id) DO UPDATE
  SET member_email = EXCLUDED.member_email;

  DELETE FROM account_access_invites WHERE id = inv.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_account_invite(TEXT) TO authenticated;

-- Prevent changing business owner via API (team members may update name/address).
-- claim_business_handoff sets app.allow_business_owner_transfer = 1 for the transaction only.
CREATE OR REPLACE FUNCTION public.prevent_business_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF COALESCE(current_setting('app.allow_business_owner_transfer', true), '') <> '1' THEN
      RAISE EXCEPTION 'Cannot change business owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_accounts_prevent_owner_change ON business_accounts;
CREATE TRIGGER business_accounts_prevent_owner_change
  BEFORE UPDATE ON business_accounts
  FOR EACH ROW
  EXECUTE PROCEDURE public.prevent_business_user_id_change();

-- ---- Replace business_accounts policies (team can read/update, only owner inserts/deletes) ----
DROP POLICY IF EXISTS "Users can manage own businesses" ON business_accounts;

CREATE POLICY "Users can view accessible businesses"
  ON business_accounts FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM account_access_members m
      WHERE m.owner_user_id = business_accounts.user_id AND m.member_user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert own businesses"
  ON business_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update own businesses"
  ON business_accounts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Team updates accessible businesses"
  ON business_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM account_access_members m
      WHERE m.owner_user_id = business_accounts.user_id AND m.member_user_id = auth.uid()
    )
  )
  WITH CHECK (true);

CREATE POLICY "Owners delete own businesses"
  ON business_accounts FOR DELETE
  USING (user_id = auth.uid());

-- ---- Categories, invoices, sales: include team access ----
DROP POLICY IF EXISTS "Users can manage categories of their businesses" ON categories;
CREATE POLICY "Users can manage categories of their businesses"
  ON categories FOR ALL
  USING (
    business_id IN (
      SELECT ba.id FROM business_accounts ba
      WHERE ba.user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM account_access_members m
           WHERE m.owner_user_id = ba.user_id AND m.member_user_id = auth.uid()
         )
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT ba.id FROM business_accounts ba
      WHERE ba.user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM account_access_members m
           WHERE m.owner_user_id = ba.user_id AND m.member_user_id = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS "Users can manage invoices of their businesses" ON invoices;
CREATE POLICY "Users can manage invoices of their businesses"
  ON invoices FOR ALL
  USING (
    business_id IN (
      SELECT ba.id FROM business_accounts ba
      WHERE ba.user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM account_access_members m
           WHERE m.owner_user_id = ba.user_id AND m.member_user_id = auth.uid()
         )
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT ba.id FROM business_accounts ba
      WHERE ba.user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM account_access_members m
           WHERE m.owner_user_id = ba.user_id AND m.member_user_id = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS "Users can manage sales of their businesses" ON sales;
CREATE POLICY "Users can manage sales of their businesses"
  ON sales FOR ALL
  USING (
    business_id IN (
      SELECT ba.id FROM business_accounts ba
      WHERE ba.user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM account_access_members m
           WHERE m.owner_user_id = ba.user_id AND m.member_user_id = auth.uid()
         )
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT ba.id FROM business_accounts ba
      WHERE ba.user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM account_access_members m
           WHERE m.owner_user_id = ba.user_id AND m.member_user_id = auth.uid()
         )
    )
  );

-- ---- Subscriptions: team can read owner's row (for access); only owner writes ----
DROP POLICY IF EXISTS "Users can manage own subscription" ON subscriptions;

CREATE POLICY "Users can read relevant subscriptions"
  ON subscriptions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM account_access_members m
      WHERE m.owner_user_id = subscriptions.user_id AND m.member_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM account_access_members m
      WHERE m.owner_user_id = auth.uid() AND m.member_user_id = subscriptions.user_id
    )
  );

CREATE POLICY "Users insert own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own subscription"
  ON subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own subscription"
  ON subscriptions FOR DELETE
  USING (user_id = auth.uid());
```

### Practice / accountant: hand off a business to a client

Lets an **accountant (practice)** create a business, then send a **claim code** to the business owner’s email. The owner signs up or signs in with that email, enters the code in **Settings → Claim a business**, or chooses **Claim a business (from my accountant)** on **Create account** to sign up and claim in one step. They become the business owner; the practice stays linked as a **collaborator** on their account. The app treats the practice’s active subscription as billing for that owner so the client is not asked to pay separately. Deploy **`get_sponsor_subscription_for_claimed_owner`** (SQL block after `claim_business_handoff` above) so this works reliably even before updating `subscriptions` RLS.

**Subscriptions RLS (optional but nice):** Adding the clause where `m.owner_user_id = auth.uid() AND m.member_user_id = subscriptions.user_id` to **`Users can read relevant subscriptions`** lets the client read the practice row directly and avoids depending only on the RPC.

Run **after** the team-access migration above. If you skipped the team block, run the `prevent_business_user_id_change` function from that section first (with `app.allow_business_owner_transfer`), then run this.

```sql
-- Trigger (idempotent): same as team section — allows claim_business_handoff to transfer user_id
CREATE OR REPLACE FUNCTION public.prevent_business_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF COALESCE(current_setting('app.allow_business_owner_transfer', true), '') <> '1' THEN
      RAISE EXCEPTION 'Cannot change business owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS business_handoff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  practice_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_handoff_invites_practice ON business_handoff_invites (practice_user_id);
CREATE INDEX IF NOT EXISTS business_handoff_invites_business ON business_handoff_invites (business_id);

ALTER TABLE business_handoff_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Practice sees own handoffs" ON business_handoff_invites;
CREATE POLICY "Practice sees own handoffs"
  ON business_handoff_invites FOR SELECT
  USING (practice_user_id = auth.uid());

DROP POLICY IF EXISTS "Practice creates handoffs" ON business_handoff_invites;
CREATE POLICY "Practice creates handoffs"
  ON business_handoff_invites FOR INSERT
  WITH CHECK (
    practice_user_id = auth.uid()
    AND business_id IN (SELECT id FROM business_accounts WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Practice deletes own handoffs" ON business_handoff_invites;
CREATE POLICY "Practice deletes own handoffs"
  ON business_handoff_invites FOR DELETE
  USING (practice_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_business_handoff(invite_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv business_handoff_invites%ROWTYPE;
  em TEXT;
BEGIN
  SELECT * INTO inv FROM business_handoff_invites
  WHERE token = invite_token AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired_handoff';
  END IF;

  SELECT lower(trim(email)) INTO em FROM auth.users WHERE id = auth.uid();
  IF em IS NULL OR lower(trim(inv.invited_email)) <> em THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF inv.practice_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_claim_own_handoff';
  END IF;

  PERFORM set_config('app.allow_business_owner_transfer', '1', true);

  UPDATE business_accounts
  SET user_id = auth.uid(), updated_at = now()
  WHERE id = inv.business_id;

  INSERT INTO account_access_members (owner_user_id, member_user_id, member_email)
  VALUES (
    auth.uid(),
    inv.practice_user_id,
    (SELECT email FROM auth.users WHERE id = inv.practice_user_id)
  )
  ON CONFLICT (owner_user_id, member_user_id) DO UPDATE
  SET member_email = EXCLUDED.member_email;

  DELETE FROM business_handoff_invites WHERE id = inv.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_business_handoff(text) TO authenticated;
```

**Sponsored billing after claim (required so clients are not sent to Subscribe):** the app calls this RPC to read a **collaborator’s** (practice’s) subscription row when you are the **account owner** and they appear in `account_access_members`. It uses `SECURITY DEFINER` so it still works if you have not yet added the extra `subscriptions` SELECT clause for sponsors. Run once in **SQL Editor**:

```sql
CREATE OR REPLACE FUNCTION public.get_sponsor_subscription_for_claimed_owner()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(s)
  FROM account_access_members m
  INNER JOIN subscriptions s ON s.user_id = m.member_user_id
  WHERE m.owner_user_id = auth.uid()
    AND s.status IN ('active', 'trialing', 'cancel_at_period_end')
    AND s.current_period_end > now()
  ORDER BY s.current_period_end DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_sponsor_subscription_for_claimed_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sponsor_subscription_for_claimed_owner() TO authenticated;
```

**Auth metadata (optional but recommended):** the app stores `account_kind` on sign-up (`individual`, `business`, or `practice`) in the user’s **raw user metadata** via `signUp({ options: { data: { account_kind: '...' } } })`. No extra table is required.

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

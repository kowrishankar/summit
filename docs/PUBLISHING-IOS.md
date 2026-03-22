# Publishing Summit on iOS (App Store)

The app uses **Expo Application Services (EAS)** to produce a signed `.ipa` for TestFlight / App Store.

## Prerequisites

1. **Apple Developer Program** ($99/year) — [developer.apple.com](https://developer.apple.com)
2. **Expo account** — [expo.dev](https://expo.dev) (free tier includes some EAS build minutes)
3. **EAS CLI** — installed via dev dependency; use `npx eas-cli` or `npm run build:ios` after `npm install`

## One-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Log in to Expo

```bash
npx eas-cli login
```

### 3. Link the project to EAS (first time only)

If `app.json` does not yet contain `expo.extra.eas.projectId`, run:

```bash
npx eas-cli init
```

Answer the prompts to create or link an Expo project. This writes your `projectId` into the config.

### 4. Environment variables, `eas.json` profiles, and Expo dashboard

EAS builds **do not** read your laptop’s `.env` file. `EXPO_PUBLIC_*` values are **embedded when the build runs** from the variables Expo/EAS exposes for that build’s **environment**.

#### What `eas.json` is doing

`eas.json` lists **build profiles** under `build`. You pick one with `--profile <name>` (or via npm scripts in this repo).

| Profile | How you run it | What it’s for |
|--------|----------------|----------------|
| **`development`** | `eas build --profile development` | Dev client, internal installs |
| **`preview`** | `npm run build:ios:preview` → `eas build --profile preview` | Internal iOS/Android builds (install from Expo link, etc.) |
| **`production`** | `npm run build:ios` → `eas build --profile production` | Store / TestFlight–style release builds |

Each profile includes **`"environment": "development" | "preview" | "production"`**. That is the link to the Expo dashboard: EAS loads **environment variables for that environment** when it runs the build.

**What must match**

1. The profile you choose (`--profile preview`).
2. That profile’s **`environment`** field in `eas.json` (e.g. `"preview"`).
3. In **Expo → Summit → Environment variables**, each variable is enabled for the right **environment(s)** (Development / Preview / Production — same names).

Example: a **preview** iOS build uses the **`preview`** profile → `environment: "preview"` → only variables marked for **Preview** (plus any shared rules Expo applies) are available at build time. A **production** build uses **`production`** → variables marked for **Production**.

If you rename a profile or change `environment`, update the dashboard so the names still line up.

#### Which variables to set

For **every environment you actually build** (usually at least **Preview** and **Production**), define:

- **`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`** — `pk_test_...` or `pk_live_...`
- **`EXPO_PUBLIC_SUPABASE_URL`** and **`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (or **`EXPO_PUBLIC_SUPABASE_ANON_KEY`**)
- **`EXPO_PUBLIC_STRIPE_API_URL`** — your Stripe backend base URL

In [expo.dev](https://expo.dev) → **Summit** → **Environment variables**, add each variable and tick **Preview** / **Production** / **Development** as needed.

Verify from the terminal:

```bash
npx eas-cli env:list --environment preview
npx eas-cli env:list --environment production
```

Then **start a new build**; already-installed apps keep the old embedded values.

#### Other ways to pass env

You can also set `env` on a profile inside `eas.json`, or use **EAS secrets** — see [Environment variables in EAS](https://docs.expo.dev/eas/environment-variables/).

### 5. Apple Pay / Stripe (optional)

**Apple Pay is off by default** so EAS does not sync invalid Merchant IDs. The Stripe plugin uses **`["@stripe/stripe-react-native", {}]`** (empty object is required—see earlier notes). **`plugins/removeInAppPaymentsEntitlement.js`** runs **after** Stripe and **deletes** `com.apple.developer.in-app-payments` from the generated entitlements so nothing like `merchant.com.summit` is sent to Apple. **Card payments still work.**

If EAS still errors with **`merchant.com.summit is not available`**, Apple’s portal still has a bad Merchant ID on your App ID:

1. Open [Identifiers](https://developer.apple.com/account/resources/identifiers/list) → **App IDs** → **`com.jfnagroup.summit`** → **Edit**.
2. Under **Apple Pay Payment Processing**, **uncheck** it (or remove all Merchant IDs and save). Save the identifier.
3. Re-run the build with **`eas build ... --clear-cache`** if needed.

To enable Apple Pay later, create Merchant ID **`merchant.com.jfnagroup.summit`**, attach it in the App ID, **remove** `./plugins/removeInAppPaymentsEntitlement.js` from `app.json`, and set:

```json
["@stripe/stripe-react-native", { "merchantIdentifier": "merchant.com.jfnagroup.summit" }]
```

## Build the iOS app (production)

```bash
npm run build:ios
```

Equivalent:

```bash
npx eas-cli build --platform ios --profile production
```

- EAS will ask to create or reuse **distribution certificate**, **provisioning profile**, and **App Store Connect API key** (or Apple ID). Follow the prompts.
- When the build finishes, download the **.ipa** from the Expo dashboard or use the link in the terminal.

**Internal testing build** (Ad Hoc / internal distribution, no App Store upload):

```bash
npm run build:ios:preview
```

## Submit to App Store Connect

After a successful production build:

```bash
npm run submit:ios
```

Or:

```bash
npx eas-cli submit --platform ios --latest
```

You still need in **App Store Connect**:

- App record (bundle ID `com.jfnagroup.summit`)
- Screenshots, description, privacy policy URL, age rating, etc.
- **Encryption export compliance** questionnaire (HTTPS-only apps usually exempt from extra paperwork)

## Local Xcode build (alternative)

If you prefer building on your Mac:

```bash
npx expo prebuild --platform ios
cd ios && pod install && cd ..
npx expo run:ios --configuration Release
```

Archive in Xcode (**Product → Archive**) and distribute via Organizer. You must manage signing and provisioning yourself.

## Useful links

- [EAS Build – iOS](https://docs.expo.dev/build/setup/)
- [EAS Submit – iOS](https://docs.expo.dev/submit/ios/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

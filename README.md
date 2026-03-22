# Summit

React Native (Expo) app for **Android**, **iOS**, and **Web**: invoice and sales storage and management.

## Features

- **Auth**: Login, signup, forgot password, reset password, logout
- **Multi-business**: Add multiple business accounts and switch between them
- **Invoices**: Upload from image or PDF, or add manually. Invoices are analyzed with GPT-4o to extract structured data (merchant, amount, date, line items, tax, etc.). On mobile, PDFs are converted to an image and sent to GPT-4o vision (requires a [development build](https://docs.expo.dev/develop/development-builds/introduction/); not available in Expo Go).
- **Categories**: Create, edit, delete categories; assign invoices to categories
- **Search & filter**: Search invoices by merchant/category; filter by category, date, amount
- **Dashboard**: Home with spend by week/month/year; Invoices, Vendors, Categories, Reports, Settings

## Setup

1. **Install dependencies** (already done if you cloned after creation):
   ```bash
   npm install
   ```

2. **Supabase (required)**  
   Auth and all data (users, businesses, invoices, sales, categories, subscriptions) are stored in [Supabase](https://supabase.com) so users can log in from any device and see the same data.
   - Create a project at [supabase.com](https://supabase.com), then run the SQL schema from **docs/SUPABASE-SETUP.md**.
   - In the project root `.env`, set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). The legacy anon key is also supported as `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

3. **OpenAI (optional)**  
   For automatic extraction from invoice images/PDFs, set your API key:
   - Create `.env` in the project root (see `.env.example`).
   - Add: `EXPO_PUBLIC_OPENAI_API_KEY=sk-your-key`
   - Without it, the app still works: you get placeholder extraction and can add/edit manually.

4. **Run**
   - Web: `npm run web`
   - iOS: `npm run ios`
   - Android: `npm run android`
   - Or: `npx expo start` and choose platform.

## Project structure

- `App.tsx` – Root: auth check, `AuthProvider`, `AppProvider`, navigator
- `src/contexts/` – `AuthContext`, `AppContext` (businesses, invoices, categories)
- `src/services/` – `supabaseAuth`, `supabaseData`, `invoiceExtraction` (OpenAI), `pdfText` (PDF text)
- `src/screens/` – Login, Signup, Forgot/Reset password, Home, Invoices, Vendors, Categories, Reports, Settings, Add Invoice, Invoice Detail, Business Switch
- `src/navigation/` – Auth stack, Main tabs + stacks
- `src/types/` – Shared TypeScript types

## Data

Auth and all app data (users, businesses, invoices, sales, categories, subscriptions) are stored in **Supabase** (PostgreSQL + Auth). Users can sign in from any device (phone, tablet, web) and see the same data. See **docs/SUPABASE-SETUP.md** for schema and setup.

## Extracted invoice fields

- Merchant: name, address, phone, email, website  
- VAT amount, category, total amount, date  
- Line items: description, quantity, unit price, total price, tax rate/amount/type  

## Publishing iOS (App Store / TestFlight)

Production builds use **EAS Build**. See **[docs/PUBLISHING-IOS.md](docs/PUBLISHING-IOS.md)** for full steps.

```bash
npm install
npx eas-cli login
npx eas-cli init   # first time only — links project and adds EAS projectId
npm run build:ios  # production .ipa on Expo’s servers
npm run submit:ios # upload latest build to App Store Connect (after credentials are set)
```

Configure **`EXPO_PUBLIC_*` env vars** in the [Expo dashboard](https://expo.dev): each build profile in **`eas.json`** sets **`environment`** (`preview`, `production`, …). Those names must match the **Preview / Production / Development** toggles on each variable (see **docs/PUBLISHING-IOS.md §4**). Local `.env` is not used on EAS unless you wire it.

## Future
- Group transactions with what card they paid
- Better dashboard page
- Group by vendors or receipents

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

2. **OpenAI (optional)**  
   For automatic extraction from invoice images/PDFs, set your API key:
   - Create `.env` in the project root (see `.env.example`).
   - Add: `EXPO_PUBLIC_OPENAI_API_KEY=sk-your-key`
   - Without it, the app still works: you get placeholder extraction and can add/edit manually.

3. **Run**
   - Web: `npm run web`
   - iOS: `npm run ios`
   - Android: `npm run android`
   - Or: `npx expo start` and choose platform.

## Project structure

- `App.tsx` – Root: auth check, `AuthProvider`, `AppProvider`, navigator
- `src/contexts/` – `AuthContext`, `AppContext` (businesses, invoices, categories)
- `src/services/` – `storage`, `auth`, `invoiceExtraction` (OpenAI), `pdfText` (PDF text)
- `src/screens/` – Login, Signup, Forgot/Reset password, Home, Invoices, Vendors, Categories, Reports, Settings, Add Invoice, Invoice Detail, Business Switch
- `src/navigation/` – Auth stack, Main tabs + stacks
- `src/types/` – Shared TypeScript types

## Data

Auth and invoice data are stored locally with `@react-native-async-storage/async-storage`. Replace `src/services/storage.ts` and your auth service with your backend when you add one.

## Extracted invoice fields

- Merchant: name, address, phone, email, website  
- VAT amount, category, total amount, date  
- Line items: description, quantity, unit price, total price, tax rate/amount/type  

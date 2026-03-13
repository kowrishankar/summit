# Deploy to production and publish to the stores

This app uses **Expo** and **EAS (Expo Application Services)** to build and submit to the Apple App Store and Google Play Store.

**Backend:** The Stripe API server in `server/` must be deployed separately and its URL set as `EXPO_PUBLIC_STRIPE_API_URL`. See **[Backend deployment](BACKEND-DEPLOYMENT.md)** for where and how to publish it (e.g. Railway, Render).

---

## Prerequisites

1. **Expo account** — [Sign up](https://expo.dev/signup) (free tier is enough to start).
2. **Apple Developer Program** — $99/year, required for App Store. [Enroll](https://developer.apple.com/programs/).
3. **Google Play Developer account** — One-time $25, required for Play Store. [Register](https://play.google.com/console/signup).

---

## 1. Install and log in to EAS CLI

```bash
npm install -g eas-cli
eas login
```

Check you’re logged in: `eas whoami`.

---

## 2. Configure the project for EAS Build

From the project root:

```bash
eas build:configure
```

This creates or updates `eas.json` and ensures the project is ready for cloud builds. You’ll be prompted about credentials; you can let EAS generate and store them.

---

## 3. Set app identity (if not already done)

In **`app.json`** you should have:

- **iOS:** `expo.ios.bundleIdentifier` (e.g. `com.summit.app`)
- **Android:** `expo.android.package` (e.g. `com.summit.app`)

These must be unique and match what you use in App Store Connect and Google Play Console. Change them if you use a different domain/app name.

---

## 4. Build for production

**Both platforms:**

```bash
eas build --platform all --profile production
```

**Single platform:**

```bash
# iOS (App Store)
eas build --platform ios --profile production

# Android (Play Store)
eas build --platform android --profile production
```

Builds run on Expo’s servers. Progress and logs: [expo.dev/builds](https://expo.dev/builds).

- **iOS:** Produces an `.ipa` for App Store (or TestFlight).
- **Android:** Produces an **AAB (Android App Bundle)** for Play Store (recommended).

---

## 5. Submit to the stores

After a build finishes, submit it with EAS Submit.

### Apple App Store (and TestFlight)

1. Create the app in [App Store Connect](https://appstoreconnect.apple.com) (name, bundle ID, etc.).
2. Optionally in `eas.json` under `submit.production.ios` set `appleId`, `ascAppId`, `appleTeamId`; otherwise EAS will prompt when you run submit.
3. Run:

```bash
eas submit --platform ios --profile production --latest
```

- First time you may be prompted for Apple ID and app/team details.
- Build is uploaded to App Store Connect. From there you add metadata, screenshots, and submit for review.

### Google Play Store

1. Create the app in [Google Play Console](https://play.google.com/console).
2. **First release:** Upload at least one version manually (e.g. download the AAB from the EAS build page and upload in Play Console). This is a Google requirement.
3. For **automated** submissions, use a [Google Play service account](https://docs.expo.dev/submit/google-play-store/#using-a-service-account): create the key, then set `serviceAccountKeyPath` in `eas.json` under `submit.production.android`. Set `track` to `internal`, `alpha`, `beta`, or `production` as needed.
4. Submit the latest EAS build:

```bash
eas submit --platform android --profile production --latest
```

---

## 6. One-shot: build and submit

To build and then submit the same build automatically:

```bash
# iOS
eas build --platform ios --profile production --auto-submit

# Android (after first manual upload and service account set up)
eas build --platform android --profile production --auto-submit
```

---

## 7. Environment variables and secrets

If your app needs API keys or env vars in production:

- **Non-secret:** use [EAS environment variables](https://docs.expo.dev/build-reference/variables/) in the dashboard or in `eas.json` (e.g. under `build.production.env`).
- **Secrets:** use [EAS Secrets](https://docs.expo.dev/build-reference/variables/#using-secrets-in-environment-variables) so they aren’t in the repo.

Reference them in your app the same way you do locally (e.g. `process.env.EXPO_PUBLIC_*`).

---

## 8. Checklist before first store submission

- [ ] `app.json`: `version` and `ios.bundleIdentifier` / `android.package` set.
- [ ] App Store Connect: app created, bundle ID matches.
- [ ] Play Console: app created, first version uploaded manually if required.
- [ ] Privacy policy URL (required by both stores).
- [ ] Icons and splash screen in `app.json` and assets.
- [ ] Stripe / payments: production keys and config (e.g. merchant ID) set for prod.

---

## Useful commands

| Command | Purpose |
|--------|---------|
| `eas build:list` | List recent builds |
| `eas build:view` | Open last build in browser |
| `eas submit:list` | List submissions |
| `eas credentials` | Manage iOS/Android credentials |

---

## Links

- [EAS Build setup](https://docs.expo.dev/build/setup/)
- [Submit to app stores](https://docs.expo.dev/deploy/submit-to-app-stores/)
- [EAS Submit (iOS)](https://docs.expo.dev/submit/ios/)
- [EAS Submit (Android)](https://docs.expo.dev/submit/android/)

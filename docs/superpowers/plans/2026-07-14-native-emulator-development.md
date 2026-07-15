# Native Emulator Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable reproducible Android Emulator and iOS Simulator development against the local Docker API without changing mobile web port 8088.

**Architecture:** The Flutter app already accepts a `SERVER_URL` compile-time define. Platform-specific Make targets pass the local Docker API through that define rather than storing emulator addresses in application code. Android HTTP access is confined to Debug, and iOS permits only local networking; production API URLs must be HTTPS.

**Tech Stack:** Flutter 3.41.6 through FVM, Android Gradle Plugin, Xcode/CocoaPods, Docker Compose, GNU Make.

## Global Constraints

- Preserve `docker-compose.dev.yml` mobile-web port `${GRIDGO_MOBILE_PORT:-8088}`.
- Use `http://10.0.2.2:3000` only for Android Emulator Debug builds.
- Use `http://localhost:3000` only for iOS Simulator Debug builds.
- Do not track secrets, local environment files, or a production API URL.
- Do not commit changes.

---

### Task 1: Create native iOS runner and debug-only local HTTP policies

**Files:**
- Create: `apps/mobile/ios/` (Flutter-generated runner)
- Create: `apps/mobile/android/app/src/debug/res/xml/network_security_config.xml`
- Create: `apps/mobile/android/app/src/debug/AndroidManifest.xml`
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `apps/mobile/ios/Runner/Info.plist`

**Interfaces:**
- Consumes: `SERVER_URL` passed by a Flutter invocation.
- Produces: an Android Debug build that may reach the host Docker API over
  HTTP, and an iOS app that may reach loopback/local network endpoints only.

- [ ] **Step 1: Generate only the missing iOS platform**

Run: `cd apps/mobile && fvm flutter create --platforms=ios .`

Expected: `ios/Runner.xcworkspace` and iOS runner sources exist; existing
Android and Dart sources remain intact.

- [ ] **Step 2: Add Android Internet permission and Debug-only cleartext policy**

Create `apps/mobile/android/app/src/debug/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
```

Create `apps/mobile/android/app/src/debug/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:networkSecurityConfig="@xml/network_security_config" />
</manifest>
```

Add `<uses-permission android:name="android.permission.INTERNET" />` directly
inside the root manifest and before `<application>` in the main Android
manifest.

- [ ] **Step 3: Add an iOS local-networking ATS exception**

In `ios/Runner/Info.plist`, add `NSAppTransportSecurity` with
`NSAllowsLocalNetworking` set to `true`. Do not add
`NSAllowsArbitraryLoads`; the app only needs the Simulator's `localhost`
route for the local Docker API.

- [ ] **Step 4: Verify native builds**

Run: `cd apps/mobile && fvm flutter build apk --debug --dart-define=SERVER_URL=http://10.0.2.2:3000`

Expected: exit code 0 and debug APK output.

Run: `cd apps/mobile && fvm flutter build ios --simulator --debug --dart-define=SERVER_URL=http://localhost:3000`

Expected: exit code 0 and Simulator app output.

### Task 2: Provide repeatable emulator commands and documentation

**Files:**
- Modify: `Makefile`
- Modify: `README.md`

**Interfaces:**
- Consumes: running Compose API on host port 3000 and recognized Flutter
  devices.
- Produces: `make mobile-android` and `make mobile-ios` commands that pass a
  platform-correct `SERVER_URL` without changing Docker configuration.

- [ ] **Step 1: Add Make targets**

Add these targets after `mobile-dev`:

```make
mobile-android: ## Run on Android Emulator against the local Docker API
	cd apps/mobile && fvm flutter run -d emulator-5554 --dart-define=SERVER_URL=http://10.0.2.2:3000

mobile-ios: ## Run on iOS Simulator against the local Docker API
	cd apps/mobile && fvm flutter run -d ios --dart-define=SERVER_URL=http://localhost:3000
```

- [ ] **Step 2: Document the three local client routes**

Add a Native emulators section below Docker Quick Start that states mobile web
remains on `http://localhost:8088`, API is `http://localhost:3000`, Android
uses `10.0.2.2`, iOS Simulator uses `localhost`, and commands are
`make mobile-android` / `make mobile-ios`.

- [ ] **Step 3: Verify Make target expansion**

Run: `make -n mobile-android mobile-ios`

Expected: each command includes exactly one appropriate `SERVER_URL` value.

### Task 3: Bootstrap and validate local dependency state

**Files:**
- No tracked source changes required.

**Interfaces:**
- Consumes: committed `package-lock.json` files and `apps/mobile/.fvmrc`.
- Produces: local FVM Flutter 3.41.6, Flutter package cache, and npm dependency
  trees for server, admin, landing, and E2E surfaces.

- [ ] **Step 1: Install FVM and pinned SDK**

Run: `dart pub global activate fvm && export PATH="$HOME/.pub-cache/bin:$PATH" && cd apps/mobile && fvm install`

Expected: FVM reports Flutter 3.41.6 installed.

- [ ] **Step 2: Install dependencies using lockfiles**

Run: `cd apps/mobile && fvm flutter pub get`

Run: `cd server && npm ci`

Run: `cd admin && npm ci`

Run: `cd apps/Landing-page && npm ci`

Run: `cd e2e/mobile-web && npm ci`

Expected: every command exits 0 without changing a lockfile.

- [ ] **Step 3: Run targeted verification**

Run: `cd apps/mobile && fvm flutter analyze lib/ && fvm flutter test`

Run: `docker compose --env-file server/.env -f docker-compose.dev.yml config`

Expected: Flutter reports no analyzer/test failures and Compose renders a
mobile service binding port 8088. If `server/.env` is absent or incomplete,
report it rather than creating a credential file.

# Native Emulator Development Design

## Goal

Run the Flutter mobile app on the existing Android Emulator and iOS Simulator
against the local Docker API, while leaving the existing Docker-hosted mobile
web application at port 8088 unchanged.

## Architecture

The Docker compose stack remains the only local backend provider. It exposes
the API on host port 3000 and the Flutter web build on port 8088. Native app
builds select their API origin only through the existing compile-time
`SERVER_URL` Dart define: Android Emulator maps the host to `10.0.2.2`; iOS
Simulator maps it to `localhost`.

Android development HTTP is limited to the debug native application. iOS
permits only local/loopback networking, which is sufficient for Simulator
access to the host Docker API. Production builds must be supplied an HTTPS
production API origin.

## Components

- Generate the missing Flutter `ios/` runner without regenerating Android or
  web files.
- Add Android Internet permission and a debug-only network-security policy for
  cleartext development traffic to the Docker API.
- Add an iOS ATS local-networking exception, not an arbitrary HTTP exception.
- Add Makefile targets and README instructions that consistently provide the
  correct endpoint for each emulator.
- Install the Flutter SDK pinned in `.fvmrc`, Flutter packages, and all npm
  packages protected by committed lockfiles.

## Validation

- `fvm flutter pub get`, Android debug build, and iOS Simulator debug build.
- `fvm flutter analyze lib/` and Flutter tests.
- Confirm the Docker compose configuration preserves mobile port 8088.
- Confirm the Android Emulator and booted iOS Simulator are recognized by
  Flutter.

## Constraints

- Do not alter Docker port 8088 or remove its mobile-web service.
- Do not put LAN addresses, credentials, or production endpoint values in
  tracked source files.
- Do not commit the setup changes.

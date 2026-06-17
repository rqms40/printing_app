# Rider Cockpit UI Design

**Date:** 2026-06-17
**Status:** Approved
**Scope:** `apps/mobile/lib/features/rider`, rider shell navigation, rider delivery provider semantics

---

## Problem

The rider home screen already points at `screenshots-for-agents/rider-UI.png`, but the current implementation only partially matches it. The header is too tall, the branding banner is oversized, the map panel is not dominant enough, the stop rail uses a different visual language, the active stop card is too roomy, and the rider shell uses the generic customer-style floating action button behavior.

There are also behavior issues that weaken the UI. Mobile route ordering can lose the server-provided route sequence, a new `assigned` job can be promoted into the "Active Stop" area, and rider status mutations currently swallow API failures while still updating local state.

---

## Goals

1. Make the rider home cockpit closely match the supplied screenshot: black background, yellow accents, compact header, dense GRID banner, dominant map board, right-side route rail, compact active stop card, and dark bottom nav with a centered yellow plus.
2. Keep the visual changes rider-specific so customer/admin shared widgets are not unintentionally redesigned.
3. Preserve backend route ordering in the mobile provider.
4. Treat only in-progress assignments as active stops.
5. Avoid local success states when rider status PATCH requests fail.
6. Add focused tests before implementation for provider route semantics and rider home/widget behavior.

---

## Non-Goals

- No backend schema change in this slice.
- No real-time rider assignment notification system in this slice.
- No proof-photo capture UI in this slice.
- No full redesign of Orders, Profile, History, or customer/admin shells.
- No screenshot-golden test dependency.

---

## Architecture

The rider cockpit becomes a rider-specific presentation layer over the existing rider assignment data. `RiderHomeScreen` derives two separate concepts:

- `routeStops`: in-progress assignments followed by new assignments, capped at five.
- `active`: the first in-progress assignment only.

The home screen can still show new stops on the map/timeline, but it will not label a merely assigned job as the active stop. The route map preserves the backend order returned by `/riders/assignments`.

Navigation styling is added as a rider-specific mode in shared shell widgets. The default customer/admin behavior remains unchanged.

---

## UI Design

### Header

The top row combines date/greeting and profile/settings actions into one compact composition. The date uses a small uppercase label. The greeting is tighter than the current 26px treatment, with the rider's first name in `RiderTheme.yellow`.

### Branding Banner

`RiderBrandingBanner` keeps the GRID wordmark and tagline but becomes shorter and denser. The dot grid texture should feel like the reference halftone panel, with less vertical padding and a more compact logo/wordmark stack.

### Map Panel

`RiderRouteMapPanel` is the dominant surface on the screen. It uses a stable height range instead of relying only on `Expanded`, and it keeps map chrome in black, gray, and yellow. The overlay shows current time and weekday with clear hierarchy. Stop markers and the rider marker use rider-specific styling, not the shared teal customer route grammar.

### Stop Rail

`RiderStopTimeline` shows a green check node, up to five stop nodes with yellow outlines/dark centers, a thin yellow rail, and a compact yellow chevron control. The rail remains visual-only for now.

### Active Stop Card

`RiderActiveStopCard` becomes compact: smaller padding, tighter radius, white-ring avatar, yellow customer name, short order summary, order ref, and small circular message/call actions.

### Bottom Navigation

The rider shell keeps Home, Orders, Alerts, Profile plus the center plus action to match the screenshot. The plus should appear as an embedded yellow rounded square rather than the current floating circular customer FAB. The quick-action panel can remain functional, but its trigger placement/styling must read as rider-specific.

---

## Data Flow

`DeliveriesNotifier._fetchAll()` fetches active assignments first and history second. Active assignment order from the backend is preserved because the backend already route-orders active assignments. History assignments are appended after active assignments and sorted by delivered/updated time without disturbing active route sequence.

Status mutation flow changes from "optimistic regardless of API result" to "PATCH first, then update local state only on success." On failure, the previous state remains and `errorMessage` is set so screens can show or keep existing warning copy.

---

## Testing

Use Flutter widget/provider tests rather than image goldens.

Provider tests cover:

- active route order is preserved
- active delivery is null when only assigned jobs exist
- route stops can include assigned jobs without turning them into active jobs
- status failures do not locally advance state

Widget tests cover:

- rider home shows the cockpit shell
- assigned-only state does not render an active stop card
- active plus assigned state renders the in-progress assignment as active
- active stop card renders compact customer/order/actions
- stop timeline caps at five nodes and shows the check/chevron structure

---

## Verification

Focused verification:

```bash
cd apps/mobile && fvm flutter test test/features/rider/deliveries/providers/deliveries_provider_test.dart
cd apps/mobile && fvm flutter test test/features/rider/home/
```

Broader rider verification:

```bash
cd apps/mobile && fvm flutter test test/features/rider/
```

Backend tests are only required if backend behavior is changed.

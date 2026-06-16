# DarkastixPrint Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete DarkastixPrint frontend (30+ screens, 3 roles) as a presentable demo with mock data and premium greyscale design.

**Architecture:** Feature-first Flutter app with Riverpod state management and GoRouter role-based navigation. Three shells (Customer 4-tab, Rider 3-tab, Admin 3-tab) with shared design system. All data is mock — no backend.

**Tech Stack:** Flutter 3.41.6, Dart 3.11.4, Riverpod, GoRouter, google_maps_flutter, fl_chart, flutter_animate, shimmer, file_picker, Hive, Iconsax

**Spec:** `PRD.md` (sections 6-10 for architecture/features/design/navigation)

---

## Execution Strategy

```
Phase A (Sequential):  Task 1 → Task 2 → Task 3
Phase B (All Parallel): Tasks 4, 5, 6, 7, 8, 9, 10, 12
Phase C (Sequential):  Task 11 (integrates everything)
```

---

## Task 1: Project Setup

**Files:**
- Modify: `pubspec.yaml`
- Modify: `analysis_options.yaml`
- Create: `lib/` directory structure (empty dirs + barrel files)
- Create: `assets/fonts/Satoshi/` (download from fontshare.com)
- Create: `assets/fonts/InstrumentSerif/` (download from Google Fonts)
- Create: `assets/images/.gitkeep`
- Create: `assets/icons/.gitkeep`
- Create: `assets/animations/.gitkeep`

- [ ] **Step 1:** Update `pubspec.yaml` with all dependencies:
  ```yaml
  dependencies:
    flutter:
      sdk: flutter
    flutter_riverpod: ^2.6.1
    riverpod_annotation: ^2.6.1
    go_router: ^14.8.1
    google_maps_flutter: ^2.10.0
    geolocator: ^13.0.2
    geocoding: ^3.0.0
    permission_handler: ^11.3.1
    fl_chart: ^0.70.2
    flutter_animate: ^4.5.2
    shimmer: ^3.0.0
    file_picker: ^8.1.6
    hive: ^4.0.0
    hive_flutter: ^1.1.0
    iconsax_flutter: ^1.0.0
    cached_network_image: ^3.4.1
    connectivity_plus: ^6.1.2
    url_launcher: ^6.3.1
    intl: ^0.19.0
    uuid: ^4.5.1
    path_provider: ^2.1.5
    flutter_secure_storage: ^9.2.3
  ```
  Add font declarations under `flutter.fonts` for Satoshi (Regular 400, Medium 500, Bold 700) and InstrumentSerif (Regular 400). Add `assets/` entries.

- [ ] **Step 2:** Download and add font files. Satoshi from fontshare.com, Instrument Serif from Google Fonts. Place in `assets/fonts/Satoshi/` and `assets/fonts/InstrumentSerif/`.

- [ ] **Step 3:** Create full directory structure per PRD Section 6. All feature dirs under `lib/features/` (auth, customer/home, customer/order, customer/orders, customer/notifications, customer/tracking, customer/address, customer/profile, rider/deliveries, rider/active_delivery, rider/history, rider/profile, admin/dashboard, admin/queue, admin/rider_management, admin/profile). Shared dirs: `lib/shared/widgets/`, `lib/shared/models/`, `lib/shared/services/`, `lib/shared/providers/`. Config dirs: `lib/config/theme/`, `lib/config/routes/`, `lib/config/constants/`.

- [ ] **Step 4:** Update `analysis_options.yaml` with strict Flutter lints.

- [ ] **Step 5:** Run `fvm flutter pub get` to verify all dependencies resolve.

- [ ] **Step 6:** Commit: `chore: project setup with dependencies, fonts, and directory structure`

---

## Task 2: Design System

**Files:**
- Create: `lib/config/theme/app_colors.dart`
- Create: `lib/config/theme/app_typography.dart`
- Create: `lib/config/theme/app_spacing.dart`
- Create: `lib/config/theme/app_radius.dart`
- Create: `lib/config/theme/app_shadows.dart`
- Create: `lib/config/theme/app_motion.dart`
- Create: `lib/config/theme/app_theme.dart`
- Create: `lib/config/constants/app_constants.dart`
- Test: `test/config/theme/app_theme_test.dart`

**Reference:** PRD Section 8 (UI/UX Design System) has exact hex values, sizes, and tokens.

- [ ] **Step 1:** Write widget test verifying ThemeData creates correctly for both light and dark modes:
  ```dart
  testWidgets('Light theme has correct background color', (tester) async {
    final theme = AppTheme.lightTheme;
    expect(theme.scaffoldBackgroundColor, const Color(0xFFFAFAFA));
  });
  ```

- [ ] **Step 2:** Implement `AppColors` with all tokens from PRD Section 8:
  - Light: background #FAFAFA, surface #FFFFFF, surfaceVariant #F5F5F5, onBackground #121212, onSurface #424242, onSurfaceDim #616161, accent #1A1A1A, etc.
  - Dark: background #121212, surface #1E1E1E, onSurfaceDim #BDBDBD, accent #F5F5F5, etc.
  - Semantic: success #43A047/#81C784, error #E53935/#EF9A9A, warning #F9A825/#FFE082, info #1E88E5/#90CAF9
  - Interaction states: hover, pressed, focused, disabled, overlay opacities

- [ ] **Step 3:** Implement `AppTypography` with Instrument Serif + Satoshi font pairing. All 10 styles from Display 32px to Overline 12px per PRD table.

- [ ] **Step 4:** Implement `AppSpacing` (xs=4 through 3xl=64), `AppRadius` (none=0 through full=9999), `AppShadows` (none through high), `AppMotion` (fast=150ms through emphasis=600ms).

- [ ] **Step 5:** Implement `AppTheme` with full `ThemeData` for light and dark modes. Configure component themes: AppBarTheme, ElevatedButtonTheme, OutlinedButtonTheme, InputDecorationTheme (bottom-border style), CardTheme, BottomNavigationBarTheme, BottomSheetTheme, DialogTheme, ChipTheme, TabBarTheme.

- [ ] **Step 6:** Implement `AppConstants` with file size limits, status enum strings, pricing constants.

- [ ] **Step 7:** Run tests. Commit: `feat: greyscale design system with light/dark themes`

---

## Task 3: Shared Widgets

**Files:**
- Create: `lib/shared/widgets/app_button.dart`
- Create: `lib/shared/widgets/app_text_field.dart`
- Create: `lib/shared/widgets/app_card.dart`
- Create: `lib/shared/widgets/app_bottom_nav.dart`
- Create: `lib/shared/widgets/loading_overlay.dart`
- Create: `lib/shared/widgets/empty_state.dart`
- Create: `lib/shared/widgets/confirmation_dialog.dart`
- Create: `lib/shared/widgets/status_badge.dart`
- Create: `lib/shared/widgets/skeleton_loader.dart`
- Create: `lib/shared/widgets/section_header.dart`
- Create: `lib/shared/widgets/step_indicator.dart`
- Create: `lib/shared/widgets/status_timeline.dart`
- Create: `lib/shared/widgets/offline_banner.dart`
- Test: `test/shared/widgets/app_button_test.dart`
- Test: `test/shared/widgets/app_text_field_test.dart`

**Reference:** PRD Section 8 "Key UI Patterns" for design specs.

- [ ] **Step 1:** Write widget tests for AppButton (primary renders with accent background, secondary renders with outline, ghost renders text-only, disabled has 0.38 opacity).

- [ ] **Step 2:** Implement `AppButton` — 3 variants (primary/secondary/ghost), full-width option, loading state with spinner, minimum 48x48 touch target. Primary: solid accent (near-black light / near-white dark). Secondary: 1px outlined. Ghost: text-only.

- [ ] **Step 3:** Implement `AppTextField` — bottom-border editorial style (not full box), label above, hint text in onSurfaceDim, error state with semantic red, focus animation.

- [ ] **Step 4:** Implement `AppCard` — configurable elevation (subtle/low/medium), optional left accent line (for order cards with status color), onTap with press state, InkWell ripple.

- [ ] **Step 5:** Implement `AppBottomNav` — configurable tab count (3 or 4), Iconsax line icons, active = solid fill + label, inactive = outlined + no label.

- [ ] **Step 6:** Implement remaining widgets: `LoadingOverlay` (semi-transparent backdrop + spinner), `EmptyState` (centered: Instrument Serif heading + Satoshi body + ghost CTA), `ConfirmationDialog` (bottom sheet with policy text + destructive button using Error color + "Keep" outlined button), `StatusBadge` (icon + text chip, colored backgrounds from semantic palette), `SkeletonLoader` (shimmer with low-contrast grey), `SectionHeader` (H2 style + optional "See All" link), `StepIndicator` (dots/progress bar for order flow), `StatusTimeline` (vertical stepper: solid circles completed, pulsing outline current, faint dotted future), `OfflineBanner` (warning color banner at top).

- [ ] **Step 7:** Run tests. Commit: `feat: shared widget library with greyscale design`

---

## Task 4: Auth Screens

**Depends on:** Tasks 1-3

**Files:**
- Create: `lib/features/auth/screens/login_screen.dart`
- Create: `lib/features/auth/screens/register_screen.dart`
- Create: `lib/features/auth/screens/profile_setup_screen.dart`
- Create: `lib/features/auth/providers/auth_provider.dart`
- Create: `lib/features/auth/widgets/auth_form.dart`
- Test: `test/features/auth/screens/login_screen_test.dart`

- [ ] **Step 1:** Write widget test: login screen renders email/password fields and login button; dev bypass buttons for Customer/Rider/Admin are visible.

- [ ] **Step 2:** Implement `AuthProvider` — mock auth state with `currentUser`, `isAuthenticated`, `login()`, `register()`, `logout()`, `devBypass(role)`. Stores mock user in memory.

- [ ] **Step 3:** Implement `LoginScreen` — Instrument Serif heading "Welcome back", email + password fields (AppTextField), "Sign In" primary button, "Create Account" link, 3 dev bypass buttons at bottom (Customer/Rider/Admin) for quick testing.

- [ ] **Step 4:** Implement `RegisterScreen` — email, password, confirm password fields, "Create Account" button, "Already have an account?" link.

- [ ] **Step 5:** Implement `ProfileSetupScreen` — full name, phone number, date of birth picker, gender selector (chips: Male/Female/Other), "Complete Profile" button. For rider role: add vehicle type, plate number fields.

- [ ] **Step 6:** Run tests. Commit: `feat: auth screens with dev bypass login`

---

## Task 5: Customer Home Screen

**Depends on:** Tasks 1-3

**Files:**
- Create: `lib/features/customer/home/screens/home_screen.dart`
- Create: `lib/features/customer/home/widgets/hero_banner.dart`
- Create: `lib/features/customer/home/widgets/service_card.dart`
- Create: `lib/features/customer/home/widgets/recent_orders_section.dart`
- Test: `test/features/customer/home/screens/home_screen_test.dart`

- [ ] **Step 1:** Write widget test: home screen renders hero banner, 2 service cards (Paper/3D), and recent orders section.

- [ ] **Step 2:** Implement `HeroBanner` — Instrument Serif Display heading "Professional printing, delivered", Satoshi body subtitle, greyscale gradient background, editorial feel with generous spacing.

- [ ] **Step 3:** Implement `ServiceCard` — two cards side by side: "Paper Printing" and "3D Printing". Each has an icon (Iconsax), title (H3), brief description, subtle elevation, onTap navigates to order flow.

- [ ] **Step 4:** Implement `RecentOrdersSection` with `SectionHeader` ("Recent Orders" + "See All" link), horizontal scroll of mini order cards showing order ID, status badge, price, date.

- [ ] **Step 5:** Assemble `HomeScreen` — scrollable column: HeroBanner, 2xl spacing, ServiceCards row, lg spacing, RecentOrdersSection, lg spacing, draft orders section (if any).

- [ ] **Step 6:** Run tests. Commit: `feat: customer home screen with editorial hero banner`

---

## Task 6: Order Creation Flow

**Depends on:** Tasks 1-3

**Files:**
- Create: `lib/features/customer/order/screens/category_screen.dart`
- Create: `lib/features/customer/order/screens/paper_specs_screen.dart`
- Create: `lib/features/customer/order/screens/three_d_specs_screen.dart`
- Create: `lib/features/customer/order/screens/upload_screen.dart`
- Create: `lib/features/customer/order/screens/summary_screen.dart`
- Create: `lib/features/customer/order/screens/delivery_details_screen.dart`
- Create: `lib/features/customer/order/screens/payment_screen.dart`
- Create: `lib/features/customer/order/providers/order_provider.dart`
- Create: `lib/features/customer/order/providers/draft_order_provider.dart`
- Create: `lib/features/customer/order/widgets/spec_selector.dart`
- Create: `lib/features/customer/order/widgets/file_upload_card.dart`
- Create: `lib/features/customer/order/widgets/price_breakdown.dart`
- Create: `lib/utils/pricing_engine.dart`
- Test: `test/utils/pricing_engine_test.dart`
- Test: `test/features/customer/order/screens/category_screen_test.dart`

- [ ] **Step 1:** Write unit test for pricing engine: paper ₱2/page base * size * color * media * sides + binding fee; 3D ₱50 base + grams * ₱3/gram.

- [ ] **Step 2:** Implement `PricingEngine` class with `calculatePaperPrice()` and `calculate3DPrice()` using PRD Section 7.3 formulas.

- [ ] **Step 3:** Implement `OrderProvider` (Riverpod StateNotifier) managing order flow state: category, specs, file, delivery option, address, quantity. Provides `currentStep`, `canProceed`, `totalPrice`.

- [ ] **Step 4:** Implement `CategoryScreen` — 2 large visual cards (Paper Printing / 3D Printing) with icons, descriptions. StepIndicator at top showing step 1/6.

- [ ] **Step 5:** Implement `PaperSpecsScreen` — chip group selectors for: Paper Size (A1-A5, 20x30in, Custom), Color Mode (B&W/Full Color), Media Type (Glossy/Matte), Print Sides (Front Only/Back-to-Back), Binding (None/Spiral/Staple/Premium), Quantity input.

- [ ] **Step 6:** Implement `ThreeDSpecsScreen` — File Format (STL/OBJ/3MF), Material (PLA/ABS/PETG), Color picker, Infill (10%/20%/50%/100%), Layer Height (0.1/0.2/0.3mm), Supports (Yes/No), Notes field, Quantity.

- [ ] **Step 7:** Implement `UploadScreen` — file_picker integration, file type validation per PRD (Paper: PDF/PNG/JPG/JPEG/DOCX ≤50MB; 3D: STL/OBJ/3MF ≤200MB), progress bar, file info card showing name/size/type, error feedback for invalid files.

- [ ] **Step 8:** Implement `SummaryScreen` — specs recap, file info, quantity, `PriceBreakdown` widget showing line items (base * quantity, binding fee, delivery fee, total in ₱), "Confirm Order" CTA.

- [ ] **Step 9:** Implement `DeliveryDetailsScreen` — toggle: Pickup / Delivery. If delivery: show saved addresses as selectable cards + "Add New Address" button. Delivery fee display.

- [ ] **Step 10:** Implement `PaymentScreen` — 3 selectable cards (GCash, Maya, COD) with logos/icons, payment summary, "Pay ₱X" CTA. Mock success: show checkmark animation (flutter_animate), navigate to order confirmation.

- [ ] **Step 11:** Run tests. Commit: `feat: complete order creation flow with pricing engine`

---

## Task 7: Customer Orders & Order Detail

**Depends on:** Tasks 1-3

**Files:**
- Create: `lib/features/customer/orders/screens/orders_screen.dart`
- Create: `lib/features/customer/orders/screens/order_detail_screen.dart`
- Create: `lib/features/customer/orders/providers/orders_provider.dart`
- Create: `lib/features/customer/orders/widgets/order_card.dart`
- Create: `lib/features/customer/orders/widgets/order_status_timeline.dart`
- Test: `test/features/customer/orders/screens/orders_screen_test.dart`

- [ ] **Step 1:** Write widget test: orders screen renders Active and Completed tabs, each showing order cards.

- [ ] **Step 2:** Implement `OrdersProvider` — manages list of mock orders, filters by active (all non-terminal statuses) and completed (delivered/completedPickup/cancelled).

- [ ] **Step 3:** Implement `OrderCard` — horizontal layout: thin left accent line (status color), order ID (mono), status badge, category icon, quantity × price (₱), timestamp caption. OnTap navigates to detail.

- [ ] **Step 4:** Implement `OrdersScreen` — TabBar with Active/Completed tabs, each tab shows ListView of OrderCards, pull-to-refresh, empty state when no orders.

- [ ] **Step 5:** Implement `OrderStatusTimeline` — vertical stepper per PRD: completed = solid dark circle with checkmark, current = outlined circle with pulse animation (flutter_animate), future = faint dotted circle. Each step shows status label + timestamp. Full pipeline from order_placed through delivered.

- [ ] **Step 6:** Implement `OrderDetailScreen` — scrollable: order ID header, StatusTimeline, specs section (paper or 3D details), file info, price breakdown, payment info, delivery info, estimated completion time. Cancel button (visible only for order_placed/file_verified). "Track Delivery" button for on_the_way status.

- [ ] **Step 7:** Run tests. Commit: `feat: customer orders list and detail with status timeline`

---

## Task 8: Customer Extras (Notifications, Tracking, Address, Profile, Support)

**Depends on:** Tasks 1-3

**Files:**
- Create: `lib/features/customer/notifications/screens/notifications_screen.dart`
- Create: `lib/features/customer/notifications/providers/notifications_provider.dart`
- Create: `lib/features/customer/tracking/screens/delivery_tracking_screen.dart`
- Create: `lib/features/customer/tracking/widgets/delivery_map.dart`
- Create: `lib/features/customer/tracking/widgets/rider_info_card.dart`
- Create: `lib/features/customer/address/screens/address_list_screen.dart`
- Create: `lib/features/customer/address/screens/address_picker_screen.dart`
- Create: `lib/features/customer/address/providers/address_provider.dart`
- Create: `lib/features/customer/address/widgets/address_card.dart`
- Create: `lib/features/customer/address/widgets/map_pin_picker.dart`
- Create: `lib/features/customer/profile/screens/profile_screen.dart`
- Create: `lib/features/customer/profile/screens/account_details_screen.dart`
- Create: `lib/features/customer/profile/screens/support_screen.dart`
- Create: `lib/features/customer/profile/screens/terms_screen.dart`
- Create: `lib/features/customer/profile/screens/privacy_screen.dart`
- Create: `lib/features/customer/profile/providers/profile_provider.dart`
- Test: `test/features/customer/notifications/screens/notifications_screen_test.dart`

- [ ] **Step 1:** Implement `NotificationsScreen` — list of notification tiles (icon, title, message, timestamp, read/unread dot indicator), "Mark All Read" action in app bar, empty state.

- [ ] **Step 2:** Implement `DeliveryTrackingScreen` with `DeliveryMap` — Google Maps widget with greyscale map style (silver), rider pin (dark circle with heading indicator), destination pin (accent color), route polyline in onSurface color. If no Maps API key: show styled placeholder with message. `RiderInfoCard` at bottom: rider name, vehicle type, plate number, phone button, ETA.

- [ ] **Step 3:** Implement `AddressListScreen` — list of saved address cards (label, full address, landmark, default badge), "Add Address" FAB, swipe to delete, max 5 addresses.

- [ ] **Step 4:** Implement `AddressPickerScreen` with `MapPinPicker` — full-screen Google Maps with draggable center pin, address auto-fills below via mock geocoding, editable fields (label, full address, barangay, city, province, zip code), mandatory landmark field, "Save Address" button. Fallback: manual entry form if no Maps API key.

- [ ] **Step 5:** Implement `ProfileScreen` — user info card (avatar initial, name, email), menu items: Account Details, Saved Addresses, Dark Mode toggle (functional using Riverpod), Support & Help, Terms of Service, Privacy Policy, Sign Out (with confirmation dialog).

- [ ] **Step 6:** Implement `AccountDetailsScreen` (edit name, phone, DOB, gender), `SupportScreen` (contact info: phone/email/Messenger links, FAQ accordion), `TermsScreen` and `PrivacyScreen` (static text screens with RA 10173 mention).

- [ ] **Step 7:** Run tests. Commit: `feat: customer extras - notifications, tracking, addresses, profile, support`

---

## Task 9: Rider Screens

**Depends on:** Tasks 1-3

**Files:**
- Create: `lib/features/rider/deliveries/screens/deliveries_screen.dart`
- Create: `lib/features/rider/deliveries/screens/delivery_detail_screen.dart`
- Create: `lib/features/rider/deliveries/providers/deliveries_provider.dart`
- Create: `lib/features/rider/deliveries/widgets/delivery_card.dart`
- Create: `lib/features/rider/deliveries/widgets/checkpoint_action.dart`
- Create: `lib/features/rider/active_delivery/screens/active_delivery_screen.dart`
- Create: `lib/features/rider/active_delivery/providers/location_provider.dart`
- Create: `lib/features/rider/active_delivery/widgets/delivery_map_view.dart`
- Create: `lib/features/rider/active_delivery/widgets/status_action_bar.dart`
- Create: `lib/features/rider/history/screens/delivery_history_screen.dart`
- Create: `lib/features/rider/history/providers/earnings_provider.dart`
- Create: `lib/features/rider/profile/screens/rider_profile_screen.dart`
- Test: `test/features/rider/deliveries/screens/deliveries_screen_test.dart`

- [ ] **Step 1:** Implement `DeliveriesProvider` — manages list of mock delivery assignments with status filtering. Implements delivery status state machine (assigned→accepted→picked_up→on_the_way→arrived→delivered).

- [ ] **Step 2:** Implement `DeliveriesScreen` — list of assigned delivery cards. Each `DeliveryCard` shows: order ID, customer name, address summary with landmark, status badge, accept/decline buttons for new assignments. Empty state when no active deliveries.

- [ ] **Step 3:** Implement `DeliveryDetailScreen` — order info (category, specs summary), customer address with landmark highlighted, map preview showing pickup (shop) and destination pins, checkpoint action buttons (large pill-shaped at bottom per PRD pattern 13). "Navigate" button to open in external maps app (url_launcher).

- [ ] **Step 4:** Implement `ActiveDeliveryScreen` — full-screen map with mock GPS animation (marker moves along route), `StatusActionBar` overlay at bottom showing current checkpoint + next action button. Swipe-to-confirm for "Delivered" to prevent accidental taps. Customer info card (name, phone, address, landmark).

- [ ] **Step 5:** Implement `DeliveryHistoryScreen` — completed deliveries list with date filtering, earnings summary card at top (today/week/month totals in ₱), each history item shows order ID, date, earnings amount.

- [ ] **Step 6:** Implement `RiderProfileScreen` — availability toggle (Online/Offline) prominent at top, profile info (name, email, phone), vehicle info (type, plate number), edit vehicle info, sign out.

- [ ] **Step 7:** Run tests. Commit: `feat: rider screens with delivery workflow and GPS tracking`

---

## Task 10: Admin Screens

**Depends on:** Tasks 1-3

**Files:**
- Create: `lib/features/admin/dashboard/screens/dashboard_screen.dart`
- Create: `lib/features/admin/dashboard/providers/dashboard_provider.dart`
- Create: `lib/features/admin/dashboard/widgets/kpi_card.dart`
- Create: `lib/features/admin/dashboard/widgets/sales_chart.dart`
- Create: `lib/features/admin/dashboard/widgets/volume_chart.dart`
- Create: `lib/features/admin/queue/screens/queue_screen.dart`
- Create: `lib/features/admin/queue/screens/admin_order_detail_screen.dart`
- Create: `lib/features/admin/queue/providers/queue_provider.dart`
- Create: `lib/features/admin/queue/widgets/queue_order_card.dart`
- Create: `lib/features/admin/queue/widgets/status_picker.dart`
- Create: `lib/features/admin/rider_management/screens/rider_assignment_screen.dart`
- Create: `lib/features/admin/rider_management/providers/riders_provider.dart`
- Create: `lib/features/admin/rider_management/widgets/rider_list_tile.dart`
- Create: `lib/features/admin/rider_management/widgets/assignment_dialog.dart`
- Create: `lib/features/admin/profile/screens/admin_profile_screen.dart`
- Test: `test/features/admin/dashboard/screens/dashboard_screen_test.dart`

- [ ] **Step 1:** Implement `DashboardProvider` — mock KPI data (new orders count, in-production count, ready for pickup count, monthly revenue in ₱), mock 6-month sales and volume data arrays.

- [ ] **Step 2:** Implement `KpiCard` — compact card with icon, value (large H2), label (caption), subtle elevation. 4 cards in 2×2 grid.

- [ ] **Step 3:** Implement `SalesChart` using fl_chart — line chart for 6-month sales trend (₱ values), greyscale styling (dark line on light bg), curved line, dot indicators, gridlines in surfaceDim. `VolumeChart` — bar chart for 6-month order volume, greyscale bars with accent on current month.

- [ ] **Step 4:** Implement `DashboardScreen` — scrollable: greeting header, KPI grid, sales chart, volume chart, pull-to-refresh.

- [ ] **Step 5:** Implement `QueueScreen` — TabBar filter tabs (New/In Production/Done/All), search bar, list of `QueueOrderCard` widgets. Each card: order ID, status badge with inline `StatusPicker` dropdown, category, quantity × price, customer name, file link, timestamp. Tapping opens admin order detail.

- [ ] **Step 6:** Implement `AdminOrderDetailScreen` — full order view: status dropdown (all 14 statuses), ETA setter (date/time picker), "Decline" button (opens dialog with required reason), "Assign Rider" button (opens rider assignment), file preview area, status history audit trail at bottom showing each change with timestamp + actor.

- [ ] **Step 7:** Implement `RiderAssignmentScreen` / `AssignmentDialog` — bottom sheet listing available riders with `RiderListTile` (name, vehicle type, plate, availability dot, last location label). One-tap assign sends mock notification.

- [ ] **Step 8:** Implement `AdminProfileScreen` — admin info, sign out, app version.

- [ ] **Step 9:** Run tests. Commit: `feat: admin dashboard, order queue, rider assignment`

---

## Task 11: Navigation & Routing

**Depends on:** Tasks 1-10 (all screens must exist)

**Files:**
- Create: `lib/config/routes/app_router.dart`
- Create: `lib/config/routes/customer_routes.dart`
- Create: `lib/config/routes/rider_routes.dart`
- Create: `lib/config/routes/admin_routes.dart`
- Create: `lib/shared/widgets/scaffold_with_nav.dart`
- Modify: `lib/app.dart` (create new)
- Modify: `lib/main.dart` (replace template)
- Test: `test/config/routes/app_router_test.dart`

- [ ] **Step 1:** Write test: unauthenticated user redirected to /auth/login, authenticated customer goes to /customer/home, rider to /rider/deliveries, admin to /admin/dashboard.

- [ ] **Step 2:** Implement `ScaffoldWithNav` — shell widget with AppBottomNav, accepts child from GoRouter. Configurable for customer (4 tabs: Home, Orders, Notifications, Profile), rider (3 tabs: Deliveries, History, Profile), admin (3 tabs: Dashboard, Queue, Profile).

- [ ] **Step 3:** Implement `app_router.dart` with GoRouter:
  - Auth routes: /auth/login, /auth/register, /auth/profile-setup
  - Customer shell (StatefulShellRoute): /customer/home, /customer/orders, /customer/notifications, /customer/profile
  - Customer stack routes: /customer/order/new (full flow), /customer/orders/:id, /customer/orders/:id/track, /customer/addresses, /customer/addresses/new, /customer/profile/account, /customer/profile/support, /customer/profile/terms, /customer/profile/privacy
  - Rider shell: /rider/deliveries, /rider/history, /rider/profile
  - Rider stack: /rider/deliveries/:id, /rider/deliveries/:id/active, /rider/history/earnings
  - Admin shell: /admin/dashboard, /admin/queue, /admin/profile
  - Admin stack: /admin/queue/:id, /admin/queue/:id/assign-rider, /admin/queue/:id/history
  - Redirect logic based on auth state and user role

- [ ] **Step 4:** Implement `app.dart` — MaterialApp.router with GoRouter, AppTheme (light/dark based on theme provider), ProviderScope.

- [ ] **Step 5:** Replace `main.dart` — ProviderScope wrapping App, Hive initialization.

- [ ] **Step 6:** Run tests, verify full app launches and routes work. Commit: `feat: GoRouter navigation with role-based shells and auth guards`

---

## Task 12: Mock Data & Providers

**Depends on:** Tasks 1-3

**Files:**
- Create: `lib/shared/models/user.dart`
- Create: `lib/shared/models/order.dart`
- Create: `lib/shared/models/paper_specs.dart`
- Create: `lib/shared/models/three_d_specs.dart`
- Create: `lib/shared/models/address.dart`
- Create: `lib/shared/models/rider_profile.dart`
- Create: `lib/shared/models/delivery_assignment.dart`
- Create: `lib/shared/models/location_update.dart`
- Create: `lib/shared/models/order_status_history.dart`
- Create: `lib/shared/models/payment_transaction.dart`
- Create: `lib/shared/models/app_notification.dart`
- Create: `lib/shared/models/draft_order.dart`
- Create: `lib/shared/models/enums.dart`
- Create: `lib/shared/providers/mock_data.dart`
- Create: `lib/shared/providers/theme_provider.dart`
- Create: `lib/utils/formatters.dart`
- Create: `lib/utils/validators.dart`
- Create: `lib/utils/file_helpers.dart`
- Test: `test/shared/models/order_test.dart`
- Test: `test/utils/formatters_test.dart`

- [ ] **Step 1:** Write tests: Order model creates correctly, formatters produce ₱ currency format, date format matches "Mar 27, 2026" style.

- [ ] **Step 2:** Implement all enums in `enums.dart`: OrderStatus (14 values per PRD appendix), DeliveryStatus (7 values), PaymentMethod, PaymentStatus, UserRole, VehicleType, PaperSize, ColorMode, MediaType, PrintSides, Binding, Material3D, FileFormat3D.

- [ ] **Step 3:** Implement all model classes matching PRD Section 11. Each with factory constructors and copyWith methods.

- [ ] **Step 4:** Implement `MockData` class — static factory methods generating realistic Filipino mock data:
  - 3 users (customer "Maria Santos", rider "Juan Reyes", admin "Admin")
  - 8-10 orders across various statuses with paper and 3D specs
  - 3 saved addresses with real Filipino locations (Makati, Quezon City, Cebu) and landmarks
  - 2 rider profiles
  - 5 delivery assignments at various stages
  - 15+ notifications
  - Mock GPS location stream (list of lat/lng points simulating Manila delivery route)

- [ ] **Step 5:** Implement `ThemeProvider` (Riverpod) for dark mode toggle, persisted to SharedPreferences.

- [ ] **Step 6:** Implement `formatters.dart` (₱ currency with intl, Philippine date format "MMM dd, yyyy", time "h:mm a"), `validators.dart` (email, phone, required, file type/size), `file_helpers.dart` (extension check, size formatting).

- [ ] **Step 7:** Run tests. Commit: `feat: mock data models, providers, and utilities`

---

## Verification Plan

After all tasks complete:

1. `fvm flutter analyze` — zero errors, zero warnings
2. `fvm flutter test` — all widget and unit tests pass
3. `fvm flutter run` — app launches successfully
4. Manual verification:
   - Dev bypass login works for all 3 roles
   - Customer: navigate all 4 tabs, complete full order flow, view order detail with timeline
   - Rider: see deliveries, tap through checkpoints, view map, check earnings
   - Admin: view dashboard with charts, manage queue, assign rider, view status history
   - Dark mode toggle works throughout
   - Empty states display correctly
   - Skeleton loading appears during transitions

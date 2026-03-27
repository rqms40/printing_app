# DarkastixPrint - Product Requirements Document (v2)

## 1. Executive Summary

DarkastixPrint is a premium mobile printing service platform built with Flutter that enables customers to order paper printing and 3D model printing services with real-time order tracking, driver-based delivery with live GPS map, multiple payment methods, and a refined, luxury-grade user experience. The platform uses a sophisticated **greyscale/monochrome design language** with strategic accent color — inspired by the restraint of Uber, Nothing Phone OS, and luxury e-commerce — delivering a UI that feels intentional, premium, and distinctly crafted.

The platform serves three user roles: **customers** who place and track orders, **drivers** who handle delivery assignments with real-time GPS tracking, and **admins** who manage the printing queue, assign drivers, update statuses, and monitor business analytics.

The backend is a self-hosted **Serverpod** server (full-stack Dart), giving complete control over infrastructure, data, and scaling — no third-party BaaS dependency.

**MVP Goal:** Deliver a polished, premium-feeling mobile app with complete order-to-delivery workflow — including driver assignment, checkpoint-based status updates, and live GPS tracking during delivery — real-time status tracking, file upload, multi-payment support, and an admin dashboard — all powered by a self-hosted Serverpod backend with PostgreSQL.

> **Note:** When developing this app, use the `/frontend-design` skill for all UI work to ensure high design quality with a refined monochrome aesthetic. The first phases focus on building the UI shell; the backend (Serverpod) will be developed later in `./server`.

---

## 2. Mission

**Mission Statement:** Provide a seamless, visually refined mobile platform for ordering professional printing services with coordinated delivery — making paper and 3D printing as easy as ordering food delivery, complete with live driver tracking, with an interface that feels expensive and intentional.

### Core Principles

1. **Greyscale-First Design** — Monochrome palette with warm grey undertones. One accent color used like punctuation, not paint. Typography and spacing carry the visual weight.
2. **Full-Stack Dart** — Flutter frontend + Serverpod backend. Shared models, type safety end-to-end, single language across the stack.
3. **Own the Infrastructure** — Self-hosted backend with full control over data, scaling, and pricing.
4. **Real-Time Everything** — Live order status updates via WebSocket streams. Customers always know where their order stands.
5. **Offline Resilient** — Draft orders persist locally. Queue actions when offline, sync when reconnected.
6. **Premium Restraint** — Fewer colors signal confidence. Generous whitespace, strong typography, and subtle depth create luxury without complexity.
7. **Transparent Delivery** — Hybrid checkpoint-based statuses with live GPS tracking during transit give customers full visibility from shop to doorstep, eliminating the anxiety of waiting.

---

## 3. Target Users

### Primary Persona: Customer

- **Who:** Students, small business owners, hobbyists needing professional printing
- **Location:** Philippines (currency: PHP/Peso)
- **Goals:**
  - Order paper prints (documents, posters, photos) with specific specs
  - Order 3D prints with material/quality customization
  - Track order status in real-time
  - Watch the driver approach on a live map during delivery
  - Pay via GCash, Maya, or Cash on Delivery
- **Pain Points:**
  - Existing print shops require physical visits
  - No visibility into order progress
  - Complicated file submission process
  - No way to know when the delivery rider is arriving

### Secondary Persona: Admin/Shop Owner

- **Who:** Print shop staff managing orders and production
- **Goals:**
  - View and manage incoming orders efficiently
  - Update order statuses through the production pipeline
  - Assign drivers to orders ready for dispatch
  - Set estimated completion times for customer visibility
  - Monitor revenue and order volume trends
  - Preview uploaded customer files
- **Pain Points:**
  - Manual order tracking via notebooks or spreadsheets
  - No automated notification system for customers
  - Difficulty tracking revenue and production metrics
  - Coordinating deliveries via text/call is error-prone

### Tertiary Persona: Driver

- **Who:** Delivery riders, motorcycle couriers
- **Location:** Philippines
- **Goals:**
  - Receive delivery assignments with clear order and location details
  - Navigate efficiently to pickup and drop-off points
  - Update delivery status at each checkpoint
  - Earn delivery fees and track income
- **Pain Points:**
  - No organized dispatch system — assignments come via text or call
  - Manual coordination leads to missed or delayed deliveries
  - No centralized record of completed deliveries or earnings
  - Difficulty finding delivery locations without landmarks

---

## 4. MVP Scope

### In Scope

**Customer Features**

- Create account and complete profile (email/password auth)
- Place paper printing orders (PDF, images, DOCX)
- Place 3D model printing orders (STL, OBJ, 3MF)
- Customize print specifications (size, color, material, binding, infill, etc.)
- Upload files with validation (type + size limits)
- View calculated price before confirming
- Pay via GCash, Maya, or Cash on Delivery
- Real-time order status tracking with live updates
- Order history with active/completed filtering
- Push notifications for order status changes
- Save draft orders offline for later submission
- Profile management with account details
- Dark mode support (system + manual toggle)
- Sign out functionality
- Manage saved delivery addresses (map pin + text with landmark)
- Cancel orders before printing starts (with cancellation policy)
- View estimated completion and delivery time
- View driver location on live map during delivery ("on the way" phase)
- Contact support (basic link/info)
- Accept terms of service / privacy policy (RA 10173 compliance)

**Driver Features**

- View assigned deliveries with order details and customer info
- Accept or decline delivery assignments
- Checkpoint status updates (picked up from shop, on the way, arrived, delivered)
- Live GPS tracking during "on the way" phase (customer sees driver on map)
- Navigation to pickup and delivery locations via integrated map
- View delivery history and earnings
- Manage availability (online/offline toggle)
- Profile with vehicle type, plate number, and contact info
- Push notifications for new delivery assignments

**Admin Features**

- Dashboard with KPI cards (new orders, in-production, revenue)
- Sales trend and order volume charts (6-month)
- Order queue with filtering (new, in-production, completed, all)
- Status update via dropdown picker per order
- File preview/download for uploaded customer files
- Auto-notification to customer on status change
- Assign drivers to orders ready for dispatch (pick from available drivers list)
- View driver availability and current location
- Set estimated completion time per order
- Decline orders with a reason (customer receives notification with explanation)
- View order status change history / audit trail

**Technical**

- Flutter 3.41.6 / Dart 3.11.4 with FVM
- Serverpod backend with PostgreSQL (in `./server`)
- Serverpod ORM for type-safe database queries
- WebSocket streams for real-time order updates
- Serverpod file storage (S3-compatible or local)
- Serverpod authentication module
- Riverpod for client-side state management
- Go Router for navigation
- Local persistence with Hive/SharedPreferences for drafts
- Google Maps Flutter SDK for map views (address picker + live driver tracking)
- Geolocator for driver GPS tracking (position streaming during delivery)
- Geocoding for address resolution (coordinates to/from human-readable addresses)

### Out of Scope (Post-MVP)

- OTP-based phone authentication
- Full PayMongo SDK integration (checkout forms)
- In-app messaging / support chat
- Ratings and reviews system
- Multi-language support (i18n)
- Web admin panel (separate project)
- Gamification (loyalty points, referral codes)
- Receipt/invoice PDF generation
- Social login (Google, Apple, Facebook)
- Auto-assignment algorithm (drivers auto-matched to orders by proximity)
- Driver self-select / bidding on deliveries
- Route optimization (multi-stop delivery planning)

---

## 5. User Stories

### Customer Stories

1. **As a customer, I want to sign up and set up my profile, so that I can place orders.**
   - Email/password registration, profile setup (name, phone, DOB, gender)

2. **As a customer, I want to choose between paper printing and 3D printing, so that I can order the right service.**
   - Category selection screen with visual cards for each option

3. **As a customer, I want to configure my print specifications, so that my order matches my needs.**
   - Paper: size (A1-A5, custom), color mode, media type, print sides, binding
   - 3D: material (PLA, ABS, PETG), infill %, layer height, supports, color

4. **As a customer, I want to upload my file with instant validation, so that I know it's accepted before paying.**
   - File picker with type/size validation, progress indicator, error feedback

5. **As a customer, I want to see the total price before confirming, so that there are no surprises.**
   - Summary screen with specs breakdown + calculated price

6. **As a customer, I want to pay via GCash, Maya, or COD, so that I can use my preferred payment method.**
   - E-wallet deep linking with fallback to web, COD option

7. **As a customer, I want to track my order in real-time, so that I know exactly when it will be ready.**
   - Live status timeline with WebSocket updates from server

8. **As a customer, I want to receive push notifications when my order status changes, so that I don't have to keep checking.**
   - FCM push notifications triggered by admin status updates

9. **As a customer, I want to save a draft order when I'm offline, so that I can submit it later.**
   - Local persistence of partial order data, resume from drafts

10. **As a customer, I want to view my order history, so that I can track past and active orders.**
    - Tabbed list with active/completed filters, order cards with key details

11. **As a customer, I want to manage my saved delivery addresses, so that I don't have to retype them every order.**
    - CRUD for saved addresses with label, full address, barangay, city, province, zip code, landmark, and map coordinates

12. **As a customer, I want to pick my delivery location on a map with a landmark field, so that the driver can find me easily.**
    - Map pin picker as primary input, auto-filled address fields that the customer can edit, landmark field always visible

13. **As a customer, I want to cancel my order before printing starts, so that I can get a refund.**
    - Cancel button visible on orders in "pending" or "confirmed" status, cancellation policy displayed, refund initiated for e-wallet payments

14. **As a customer, I want to see an estimated completion and delivery time, so that I can plan accordingly.**
    - Admin-set estimated time displayed on the order detail screen, updates reflected in real-time

15. **As a customer, I want to see the driver's live location on a map when my order is out for delivery, so that I know when to expect it.**
    - Live map view appears during "on the way" phase, driver marker updates in real-time, auto-hides when driver marks "arrived"

16. **As a customer, I want to contact support when I have an issue, so that I can get help resolving problems.**
    - Support link/info accessible from order detail and profile screens

### Driver Stories

17. **As a driver, I want to receive delivery assignments with order and customer details, so that I know what to pick up and where to deliver.**
    - Push notification on new assignment, delivery detail screen with order summary, pickup address, and drop-off address with landmark

18. **As a driver, I want to update my delivery status at each checkpoint, so that customers stay informed.**
    - Status action buttons: Accept, Picked Up, On the Way, Arrived, Delivered — each triggers customer notification

19. **As a driver, I want to see the delivery destination on a map, so that I can navigate efficiently.**
    - Map view with destination pin, option to open in external navigation app (Google Maps, Waze)

20. **As a driver, I want to view my delivery history and earnings, so that I can track my income.**
    - History tab with completed deliveries, date range filtering, earnings summary

21. **As a driver, I want to toggle my availability, so that I only receive assignments when I'm ready.**
    - Online/offline toggle on profile tab, offline status prevents admin from assigning new deliveries

### Admin Stories

22. **As an admin, I want to see a dashboard with today's KPIs, so that I can monitor business health.**
    - Cards: new orders, in-production, ready for pickup, total revenue

23. **As an admin, I want to manage the order queue with filters, so that I can prioritize production work.**
    - Filter tabs: New, WIP, Done, All — with order cards showing key details

24. **As an admin, I want to update an order's status with one tap, so that customers stay informed.**
    - Status dropdown picker on each order card, auto-notifies customer

25. **As an admin, I want to preview uploaded files, so that I can verify the print job before starting.**
    - File preview modal or external viewer launch

26. **As an admin, I want to see sales and volume trends, so that I can make informed business decisions.**
    - Line charts for 6-month sales (PHP) and order volume

27. **As an admin, I want to assign a driver to an order, so that delivery is coordinated.**
    - Driver selection from list of available drivers, assignment triggers push notification to driver

28. **As an admin, I want to decline an order with a reason, so that the customer knows why their order was not accepted.**
    - Decline action with required reason field, customer receives notification with explanation

29. **As an admin, I want to set an estimated completion time, so that customers have clear expectations.**
    - Time picker or duration input on order detail, value displayed to customer in real-time

30. **As an admin, I want to view the status change history for an order, so that I can resolve disputes.**
    - Audit trail showing each status change with timestamp, actor (admin/driver/system), and notes
## 6. Core Architecture & Patterns

### High-Level Architecture

```
┌──────────────────────┐         HTTP/JSON + WebSocket        ┌─────────────────────────┐
│   Flutter App        │ <--------------------------------------->   Serverpod Server      │
│   (Customer/Driver/  │                                      │   (Dart Backend)        │
│    Admin)            │                                      │   Port 8080             │
│                      │                                      │                         │
│   - Riverpod         │                                      │   - Endpoints (API)     │
│   - Go Router        │                                      │   - ORM (PostgreSQL)    │
│   - Google Maps      │                                      │   - Streams (WebSocket) │
│   - Hive (offline)   │                                      │   - File Storage        │
│   - Geolocator       │                                      │   - Auth Module         │
└──────────────────────┘                                      │   - Task Scheduling     │
                                                              └────────────┬────────────┘
                                                                           │
                                                    ┌──────────────────────┼──────────────────────┐
                                                    │                      │                      │
                                                    ▼                      ▼                      ▼
                                          ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
                                          │   PostgreSQL     │  │   S3 Storage    │  │   FCM / APNs    │
                                          │   (Database)     │  │   (Files)       │  │   (Push)        │
                                          └─────────────────┘  └─────────────────┘  └─────────────────┘
```

The Flutter app serves all three roles (Customer, Driver, Admin) within a single codebase, with role-based routing determining which feature set is presented. The Serverpod backend handles all business logic, data persistence, real-time communication, and file storage. External services include PostgreSQL for relational data, S3-compatible storage for uploaded files, and Firebase Cloud Messaging (FCM) with Apple Push Notification Service (APNs) for push notifications. Google Maps API is consumed directly by the Flutter client for map rendering, geocoding, and navigation.

### Directory Structure

```
printing_app/
├── lib/
│   ├── main.dart                    # App entry point
│   ├── app.dart                     # MaterialApp with theme & router
│   │
│   ├── config/
│   │   ├── theme/
│   │   │   ├── app_theme.dart       # ThemeData (light + dark)
│   │   │   ├── app_colors.dart      # Greyscale palette + accent
│   │   │   ├── app_typography.dart  # Text styles (Satoshi + Instrument Serif)
│   │   │   └── app_spacing.dart     # Spacing constants
│   │   ├── routes/
│   │   │   └── app_router.dart      # GoRouter configuration
│   │   └── constants/
│   │       ├── app_constants.dart   # App-wide constants
│   │       └── api_constants.dart   # API URLs, timeouts
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   │   ├── login_screen.dart
│   │   │   │   ├── register_screen.dart
│   │   │   │   └── profile_setup_screen.dart
│   │   │   ├── providers/
│   │   │   │   └── auth_provider.dart
│   │   │   └── widgets/
│   │   │       └── auth_form.dart
│   │   │
│   │   ├── customer/
│   │   │   ├── home/
│   │   │   │   ├── screens/
│   │   │   │   │   └── home_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── hero_banner.dart
│   │   │   │       ├── service_card.dart
│   │   │   │       └── recent_orders_section.dart
│   │   │   │
│   │   │   ├── order/
│   │   │   │   ├── screens/
│   │   │   │   │   ├── category_screen.dart
│   │   │   │   │   ├── paper_specs_screen.dart
│   │   │   │   │   ├── three_d_specs_screen.dart
│   │   │   │   │   ├── upload_screen.dart
│   │   │   │   │   ├── summary_screen.dart
│   │   │   │   │   └── payment_screen.dart
│   │   │   │   ├── providers/
│   │   │   │   │   ├── order_provider.dart
│   │   │   │   │   └── draft_order_provider.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── spec_selector.dart
│   │   │   │       ├── file_upload_card.dart
│   │   │   │       └── price_breakdown.dart
│   │   │   │
│   │   │   ├── orders/
│   │   │   │   ├── screens/
│   │   │   │   │   ├── orders_screen.dart
│   │   │   │   │   └── order_detail_screen.dart
│   │   │   │   ├── providers/
│   │   │   │   │   └── orders_provider.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── order_card.dart
│   │   │   │       └── status_timeline.dart
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   ├── screens/
│   │   │   │   │   └── notifications_screen.dart
│   │   │   │   └── providers/
│   │   │   │       └── notifications_provider.dart
│   │   │   │
│   │   │   ├── tracking/
│   │   │   │   ├── screens/
│   │   │   │   │   └── delivery_tracking_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── delivery_map.dart
│   │   │   │       └── driver_info_card.dart
│   │   │   │
│   │   │   ├── address/
│   │   │   │   ├── screens/
│   │   │   │   │   ├── address_list_screen.dart
│   │   │   │   │   └── address_picker_screen.dart
│   │   │   │   ├── providers/
│   │   │   │   │   └── address_provider.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── address_card.dart
│   │   │   │       └── map_pin_picker.dart
│   │   │   │
│   │   │   └── profile/
│   │   │       ├── screens/
│   │   │       │   ├── profile_screen.dart
│   │   │       │   └── account_details_screen.dart
│   │   │       └── providers/
│   │   │           └── profile_provider.dart
│   │   │
│   │   ├── driver/
│   │   │   ├── deliveries/
│   │   │   │   ├── screens/
│   │   │   │   │   ├── deliveries_screen.dart
│   │   │   │   │   └── delivery_detail_screen.dart
│   │   │   │   ├── providers/
│   │   │   │   │   └── deliveries_provider.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── delivery_card.dart
│   │   │   │       └── checkpoint_action.dart
│   │   │   │
│   │   │   ├── active_delivery/
│   │   │   │   ├── screens/
│   │   │   │   │   └── active_delivery_screen.dart
│   │   │   │   ├── providers/
│   │   │   │   │   └── location_provider.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── delivery_map_view.dart
│   │   │   │       └── status_action_bar.dart
│   │   │   │
│   │   │   ├── history/
│   │   │   │   ├── screens/
│   │   │   │   │   └── delivery_history_screen.dart
│   │   │   │   └── providers/
│   │   │   │       └── earnings_provider.dart
│   │   │   │
│   │   │   └── profile/
│   │   │       └── screens/
│   │   │           └── driver_profile_screen.dart
│   │   │
│   │   └── admin/
│   │       ├── dashboard/
│   │       │   ├── screens/
│   │       │   │   └── dashboard_screen.dart
│   │       │   ├── providers/
│   │       │   │   └── dashboard_provider.dart
│   │       │   └── widgets/
│   │       │       ├── kpi_card.dart
│   │       │       └── sales_chart.dart
│   │       │
│   │       ├── queue/
│   │       │   ├── screens/
│   │       │   │   └── queue_screen.dart
│   │       │   ├── providers/
│   │       │   │   └── queue_provider.dart
│   │       │   └── widgets/
│   │       │       ├── queue_order_card.dart
│   │       │       └── status_picker.dart
│   │       │
│   │       ├── driver_management/
│   │       │   ├── screens/
│   │       │   │   └── driver_assignment_screen.dart
│   │       │   ├── providers/
│   │       │   │   └── drivers_provider.dart
│   │       │   └── widgets/
│   │       │       ├── driver_list_tile.dart
│   │       │       └── assignment_dialog.dart
│   │       │
│   │       └── profile/
│   │           └── screens/
│   │               └── admin_profile_screen.dart
│   │
│   ├── shared/
│   │   ├── widgets/
│   │   │   ├── app_bottom_nav.dart
│   │   │   ├── app_button.dart
│   │   │   ├── app_text_field.dart
│   │   │   ├── app_card.dart
│   │   │   ├── loading_overlay.dart
│   │   │   ├── offline_banner.dart
│   │   │   ├── empty_state.dart
│   │   │   └── confirmation_dialog.dart
│   │   ├── models/
│   │   │   └── (generated by Serverpod — shared via printing_app_client)
│   │   └── services/
│   │       ├── connectivity_service.dart
│   │       ├── local_storage_service.dart
│   │       └── notification_service.dart
│   │
│   └── utils/
│       ├── formatters.dart          # Currency, date formatting
│       ├── validators.dart          # Input validation helpers
│       └── file_helpers.dart        # File picking & validation
│
├── server/                          # Serverpod backend (created later)
│   ├── printing_app_server/
│   │   ├── lib/src/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth_endpoint.dart
│   │   │   │   ├── user_endpoint.dart
│   │   │   │   ├── order_endpoint.dart
│   │   │   │   ├── file_endpoint.dart
│   │   │   │   ├── payment_endpoint.dart
│   │   │   │   ├── notification_endpoint.dart
│   │   │   │   ├── admin_endpoint.dart
│   │   │   │   ├── driver_endpoint.dart
│   │   │   │   ├── delivery_endpoint.dart
│   │   │   │   ├── address_endpoint.dart
│   │   │   │   └── location_endpoint.dart
│   │   │   └── generated/
│   │   │       └── protocol.dart
│   │   ├── config/
│   │   │   ├── development.yaml
│   │   │   ├── staging.yaml
│   │   │   └── production.yaml
│   │   └── deploy/
│   │       └── docker-compose.yaml
│   │
│   ├── printing_app_client/         # Auto-generated client library
│   │   └── lib/
│   │       └── src/protocol/
│   │
│   └── printing_app_flutter/        # Serverpod Flutter integration
│       └── lib/
│           └── printing_app_flutter.dart
│
├── assets/
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   │   ├── Satoshi/               # Body/UI font
│   │   └── InstrumentSerif/       # Display/heading font
│   └── animations/                # Lottie/Rive animations
│
├── test/
├── pubspec.yaml
├── .fvmrc
├── .gitignore
├── analysis_options.yaml
├── PRD.md                         # This document
└── README.md
```

### Key Design Patterns

- **Feature-First Architecture** — Code organized by feature (auth, order, admin, driver), not by type. Each feature directory contains its own screens, providers, and widgets, keeping related code co-located and enabling independent development.
- **Riverpod State Management** — Compile-safe, testable, no BuildContext dependency. Providers are scoped to features and composed when cross-feature data is needed. AsyncNotifier for server-synced state, StateNotifier for local-only state.
- **GoRouter Navigation** — Declarative routing with deep link support and auth guards. Role-based redirect logic determines which shell (customer, driver, admin) is presented after authentication.
- **Serverpod Code Generation** — Shared models between client and server, type-safe API calls. Protocol files define data classes once; code generation creates serialization, database mapping, and client stubs automatically.
- **Repository Pattern** — Data access abstracted behind repository interfaces. Repositories handle the decision between local cache (Hive) and remote API (Serverpod client), enabling offline-first behavior and testability.
- **Offline-First Drafts** — Hive local storage for draft orders, sync queue for pending actions. When connectivity is restored, queued actions are replayed in order. Conflict resolution favors server state.
- **Location Streaming** — GPS coordinates streamed via WebSocket during active delivery only, with battery-conscious intervals (10-second updates during "on_the_way" phase). Streaming starts when the driver taps "On the Way" and stops when the driver taps "Arrived." No background location tracking outside active deliveries.
- **Map Integration** — Google Maps for address picking (draggable pin with geocoding), delivery tracking (real-time driver position on customer's screen), and driver navigation (open destination in external maps app). Map style uses greyscale/silver theme to match the monochrome design language.
- **Checkpoint State Machine** — Driver delivery status follows a strict state machine: `assigned` -> `accepted` -> `picked_up` -> `on_the_way` -> `arrived` -> `delivered`. Each transition is validated server-side. Invalid transitions are rejected. The `declined` state is an alternative exit from `assigned` that triggers admin reassignment.

---

## 7. Features

### 7.1 Authentication & Profile

**Purpose:** Secure user registration, login, and profile management with role-based access control.

**Operations:**
- Register with email and password
- Login with existing credentials
- Complete profile (full name, phone, email, DOB, gender)
- Edit profile details
- Sign out
- Role-based routing (customer vs driver vs admin)

**Key Features:**
- Serverpod auth module for session management
- Profile completeness check before accessing main app
- Persistent auth session (survives app restart)
- Developer bypass logins for testing (one per role: customer, driver, admin)
- Role detection on login determines which navigation shell is loaded: customers see the customer tab bar, drivers see the driver tab bar, admins see the admin tab bar
- Driver profile includes additional fields: vehicle type, plate number, and availability toggle

### 7.2 Order Creation Flow

**Purpose:** Guide customers through placing a print order with delivery options.

**Flow:**
1. **Category Selection** — Paper printing or 3D printing (visual cards with illustrations)
2. **Specification Configuration** — Interactive selectors for all print options
3. **File Upload** — File picker with progress bar, validation feedback
4. **Order Summary** — Review specs + calculated price with breakdown
5. **Delivery Details** — Select delivery option (pickup or delivery). If delivery: select from saved addresses or add a new address with map pin picker and mandatory landmark field
6. **Payment** — Select payment method and confirm

**Paper Printing Specs:**

| Option | Values |
|--------|--------|
| Paper Size | A1, A2, A3, A4, A5, 20x30in, Custom |
| Color Mode | Black & White, Full Color |
| Media Type | Glossy, Matte |
| Print Sides | Front Only, Back-to-Back |
| Binding | None, Spiral, Staple, Premium Packing |

**3D Printing Specs:**

| Option | Values |
|--------|--------|
| File Format | STL, OBJ, 3MF |
| Material | PLA, ABS, PETG |
| Color | User-selectable |
| Infill | 10%, 20%, 50%, 100% |
| Layer Height | 0.1mm, 0.2mm, 0.3mm |
| Supports | Yes / No |
| Notes | Free-form text |

**File Validation:**

| Category | Allowed Types | Max Size |
|----------|--------------|----------|
| Paper | PDF, PNG, JPG, JPEG, DOCX | 50 MB |
| 3D | STL, OBJ, 3MF | 200 MB |

### 7.3 Pricing Engine

**Purpose:** Calculate order price based on specifications.

**Paper Pricing:**
- Base rate: **₱2/page**
- Multipliers: size factor x color factor x media factor x sides factor
- Additive: binding fee (spiral ₱25, staple ₱10, premium ₱50)

**3D Pricing:**
- Base rate: **₱50**
- Material cost: estimated grams x ₱3/gram (grams estimated from infill %)

**Display:** Price breakdown shown on summary screen before payment confirmation.

### 7.4 Payment

**Purpose:** Support multiple payment methods popular in the Philippines.

**Methods:**

| Method | Flow |
|--------|------|
| GCash | Deep link to GCash app -> fallback to web -> manual confirmation |
| Maya | Deep link to Maya app -> fallback to web -> manual confirmation |
| Cash on Delivery | Mark as pending, collect at pickup/delivery |

**Key Features:**
- E-wallet deep linking with native app detection
- Confirmation dialog after returning from e-wallet
- Payment status tracking (pending, paid, failed)
- Auto-create notification on successful payment

### 7.5 Real-Time Order Tracking

**Purpose:** Keep customers informed about order progress with live updates and driver GPS tracking during delivery.

**Order Status Pipeline:**

```
order_placed -> file_verified -> printing_in_progress -> finishing_mounting
    -> quality_checked -> ready_for_dispatch -> driver_assigned -> picked_up
    -> on_the_way -> arrived_at_destination -> delivered / completed_pickup

Alternative exits:
    -> file_declined (with reason)
    -> cancelled (before printing starts)
```

**Key Features:**
- Visual status timeline with step indicators
- Real-time updates via Serverpod WebSocket streams
- Status badge with greyscale tones + accent for active step
- Push notification on each status transition
- Decline reason displayed when applicable
- During `on_the_way` status, the customer sees a live map with the driver's real-time GPS position. The map displays the driver pin (dark circle with directional indicator), the destination pin (accent-colored), and the route line between them. The map auto-updates as the driver streams location data at 10-second intervals
- Map view automatically appears when status transitions to `on_the_way` and hides when the driver marks `arrived_at_destination`

### 7.6 Notifications

**Purpose:** Alert customers and drivers about order and delivery updates.

**Types:**
- Order status changed
- File verified / declined
- Order ready for pickup
- Order delivered
- New delivery assignment (driver)
- Driver arrived at destination (customer)
- Estimated completion time updated
- Order cancelled

**Implementation:**
- In-app notification list with read/unread state
- FCM push notifications for background alerts
- Server-triggered via Serverpod when admin updates status or driver updates delivery checkpoint

### 7.7 Draft Orders (Offline)

**Purpose:** Allow order creation without connectivity.

**Key Features:**
- Save partial order progress locally (Hive)
- Resume drafts from home screen or orders screen
- Auto-save on app background/close
- Queue for submission when back online
- Visual indicator for saved drafts

### 7.8 Admin Dashboard

**Purpose:** Business overview and KPI monitoring.

**KPI Cards:**
- New Orders (today)
- In Production (active)
- Ready for Pickup
- Total Revenue (this month)

**Charts:**
- Sales trend line chart (6-month, PHP)
- Order volume bar chart (6-month, count)

**Key Features:**
- Real-time data via Serverpod streams
- Refresh on pull-down
- Date range selector for charts

### 7.9 Admin Order Queue

**Purpose:** Manage and progress orders through production.

**Key Features:**
- Filter tabs: New, In Production, Done, All
- Order cards showing: ID, status badge, category, quantity, price, file link
- Status picker dropdown (all statuses in the pipeline)
- On status change -> auto-create customer notification
- File preview/download capability
- Search by order ID

### 7.10 Driver Delivery Management

**Purpose:** Enable drivers to manage assigned deliveries through a checkpoint-based workflow.

**Driver Status Pipeline:**

```
assigned -> accepted -> picked_up -> on_the_way -> arrived -> delivered

Alternative: declined (driver declines assignment, admin reassigns)
```

Each transition is validated server-side. The driver can only move forward through the pipeline — no skipping steps, no going backward. The `declined` state can only be reached from `assigned`.

**Key Features:**
- Push notification on new assignment with order summary and delivery address
- Delivery detail view with order info (category, specs summary, quantity), customer address with landmark, and map preview showing pickup and destination pins
- Checkpoint action buttons — large, pill-shaped, thumb-friendly buttons at the bottom of the screen. Only the next valid action is highlighted with the accent color. Previous completed steps shown as greyed-out checkmarks
- Live GPS streaming during "on_the_way" phase only — 10-second intervals to balance accuracy and battery life. Streaming starts automatically when the driver taps "On the Way" and stops when the driver taps "Arrived." No background location tracking outside active deliveries
- Navigation integration — "Navigate" button opens the destination in Google Maps or Waze (user's choice) for turn-by-turn directions
- Delivery confirmation with optional photo proof — driver can take a photo of the delivered package as proof of delivery, stored server-side
- "Arrived at destination" triggers a push notification to the customer
- Availability toggle on the driver profile — when offline, the driver will not appear in the admin's available drivers list

### 7.11 Driver Assignment (Admin)

**Purpose:** Allow admins to assign available drivers to orders ready for dispatch.

**Key Features:**
- Driver list showing availability status (online/offline) and current assignment status (idle, on delivery, returning). Only online and idle drivers are available for new assignments
- One-tap assignment from the order detail screen or directly from the queue — opens a bottom sheet with the available drivers list
- Reassign capability if a driver declines — admin receives a notification when a driver declines, and the order status reverts to `ready_for_dispatch` for reassignment
- Driver location visible on an admin map view when the driver is online, showing last known position
- Estimated completion time setter per order — admin can set or update the estimated time when assigning a driver or updating any order status

### 7.12 Address Management

**Purpose:** Save and manage delivery addresses with map precision for reliable driver navigation.

**Key Features:**
- Map pin picker (Google Maps) as the primary input method — full-screen map with a draggable center pin. As the user moves the map, the address auto-fills below via reverse geocoding
- Editable address fields after geocoding: label (e.g., "Home," "Office"), full address, barangay, city, province, zip code
- Mandatory landmark field ("near Jollibee on Main St," "blue gate beside sari-sari store") — landmarks are critical for Philippine delivery where street addresses are often insufficient
- Save as default address — the default address is pre-selected during order checkout
- Maximum 5 saved addresses per user — limit keeps the list manageable and reduces storage overhead
- Address selection during order checkout — saved addresses presented as selectable cards with a "Add new address" option at the bottom
- GPS coordinates (latitude and longitude) stored alongside text fields for driver navigation — the driver app uses these coordinates for map display and external navigation app launch

### 7.13 Order Cancellation

**Purpose:** Allow customers to cancel orders within the cancellation policy window.

**Cancellation Policy:**

| Order Status | Can Cancel? | Refund |
|---|---|---|
| order_placed | Yes | Full refund |
| file_verified | Yes | Full refund |
| printing_in_progress | No | N/A |
| Any later status | No | N/A |

**Key Features:**
- Cancel button visible on the order detail screen when the order is in an eligible status (`order_placed` or `file_verified`). The button is hidden once printing begins
- Confirmation bottom sheet with cancellation policy summary explaining the refund terms before the customer confirms
- Optional cancellation reason — the customer can select from a predefined list (changed my mind, found alternative, ordered by mistake, other) or skip
- Automatic refund initiation for e-wallet payments (GCash, Maya) — refund is marked as pending and processed by admin
- Cash on Delivery orders are simply cancelled with no refund processing needed
- Admin receives a notification when a customer cancels an order
- Cancelled status reflected in the customer's order history with a "Cancelled" badge
- Cancellation is permanent — cancelled orders cannot be reinstated. The customer must place a new order

### 7.14 Estimated Completion Time

**Purpose:** Set and display estimated completion and delivery times so customers can plan accordingly.

**Key Features:**
- Admin sets the estimated completion time when updating an order's status — a date/time picker appears alongside the status dropdown
- Customer sees the ETA prominently on the order detail screen and the tracking screen, below the status timeline
- ETA updates as the order progresses through the pipeline — the admin can revise the estimate at any status transition
- Push notification sent to the customer if the ETA changes significantly (more than 30 minutes from the previous estimate)
- Display format adapts to context: "Estimated ready by 3:00 PM today" for same-day orders, "Estimated delivery by Mar 28" for future-day orders
- If no ETA has been set yet, the order detail shows "Estimated time will be updated soon" instead of leaving the field blank

### 7.15 Support Contact

**Purpose:** Provide customers a way to reach support for order issues and general inquiries.

**Key Features (MVP -- lightweight, no in-app chat):**
- Help screen accessible from the profile tab and from the order detail screen (contextual "Need help?" link)
- Contact information displayed clearly: phone number (tappable to call), email address (tappable to compose), Facebook Messenger link (tappable to open Messenger)
- FAQ section with common questions presented as expandable accordion items (static content, not fetched from server). Topics include: order process, payment methods, cancellation policy, delivery times, file requirements, supported formats
- Link to Terms of Service (full legal text screen)
- Link to Privacy Policy with RA 10173 (Data Privacy Act of the Philippines) compliance information

---

## 8. UI/UX Design System -- Greyscale Monochrome

> **Important:** Use the `/frontend-design` skill when implementing all UI components.

### Design Philosophy

**"Luxury is restraint."** — The greyscale palette forces every element to earn its place through typography, spacing, and depth rather than color. One strategic accent color carries all the energy so the rest stays calm and controlled.

Key references:
- **Uber** — Neutral-dominant palette, single blue accent reserved for CTAs
- **Nothing Phone OS** — Full monochrome UI, dot-matrix typography, deliberate minimalism
- **Luxury e-commerce (Chanel, Hermes)** — Black/white/grey with generous whitespace, premium photography
- **Apple** — Greyscale surfaces with controlled accent, SF Pro weight variations for hierarchy

### What Makes Greyscale Premium (Not Boring)

1. **Wide value range** — Use the full spectrum from near-white to near-black; limited range feels flat
2. **Warm grey undertone** — Pure greys (#808080) feel clinical; warm greys (slight brown/yellow undertone) feel rich and refined
3. **Generous whitespace** — Treat empty space as a design element, not wasted screen
4. **Strong typography** — Neutral palettes shift all visual interest to letterforms and layout
5. **One carefully chosen accent** — A single pop for focal points prevents monotony
6. **Texture and depth** — Subtle elevation changes and micro-shadows prevent flat-feeling surfaces

### Color Palette

#### Light Theme

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#FAFAFA` | Page canvas |
| `surface` | `#FFFFFF` | Cards, bottom sheets |
| `surfaceVariant` | `#F5F5F5` | Subtle sections, input backgrounds |
| `surfaceDim` | `#EEEEEE` | Dividers, separators |
| `onBackground` | `#121212` | Primary text |
| `onSurface` | `#424242` | Secondary text |
| `onSurfaceDim` | `#616161` | Tertiary / hint text (meets 4.5:1 on #FAFAFA) |
| `disabled` | `#BDBDBD` | Disabled text, inactive icons |
| `outline` | `#E0E0E0` | Borders, input outlines |
| `outlineVariant` | `#EEEEEE` | Subtle dividers |
| `accent` | `#1A1A1A` | Primary CTAs, active states (near-black) |
| `accentSoft` | `#333333` | Pressed states |

#### Dark Theme

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#121212` | Page canvas (not pure black -- reduces eye strain) |
| `surface` | `#1E1E1E` | Cards, bottom sheets (1dp elevation) |
| `surfaceVariant` | `#2C2C2C` | Elevated cards, dialogs (6dp) |
| `surfaceHigh` | `#333333` | Modals, top sheets (12dp) |
| `onBackground` | `#F5F5F5` | Primary text (95% white) |
| `onSurface` | `#E0E0E0` | Secondary text |
| `onSurfaceDim` | `#BDBDBD` | Tertiary / hint text (meets 4.5:1 on #121212) |
| `disabled` | `#616161` | Disabled text |
| `outline` | `#424242` | Borders, dividers |
| `outlineVariant` | `#303030` | Subtle separators |
| `accent` | `#F5F5F5` | Primary CTAs, active states (near-white -- inverted from light theme) |
| `accentSoft` | `#E0E0E0` | Pressed states |

> **Note:** The accent color inverts between themes: near-black (#1A1A1A) in light mode, near-white (#F5F5F5) in dark mode. This ensures CTAs remain high-contrast in both modes.

#### Semantic Status Colors (Desaturated)

Status colors are the **only chromatic exception** in the greyscale system. They are desaturated/muted to feel like "guests in a greyscale house."

| Status | Light Theme | Dark Theme | Icon |
|--------|------------|------------|------|
| Success | `#43A047` | `#81C784` | Checkmark circle |
| Error | `#E53935` | `#EF9A9A` | X circle |
| Warning | `#F9A825` | `#FFE082` | Exclamation triangle |
| Info | `#1E88E5` | `#90CAF9` | Info circle |

**Rule:** Never rely on color alone — always pair status colors with icons and text labels.

#### Interaction State Tokens

| State | Light Theme | Dark Theme | Usage |
|-------|------------|------------|-------|
| `hover` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.04)` | Surface overlay on hover |
| `pressed` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Surface overlay on press |
| `focused` | 2px `#121212` ring + 2px white offset | 2px `#F5F5F5` ring + 2px dark offset | Focus indicator for a11y |
| `disabled` | opacity `0.38` | opacity `0.38` | Disabled elements |
| `overlay` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.12)` | Scrim, backdrop |
| `dragging` | `rgba(0,0,0,0.16)` | `rgba(255,255,255,0.16)` | Drag overlay |

#### Opacity Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `opacityDisabled` | 0.38 | Disabled text, icons, surfaces |
| `opacityOverlay` | 0.12 | Scrims, backdrops |
| `opacityHover` | 0.04 | Hover state overlays |
| `opacityPressed` | 0.08 | Press state overlays |
| `opacityDrag` | 0.16 | Drag state overlays |

#### Dark Theme Elevation System

In dark themes, shadows are invisible. Elevation is expressed through **surface lightening** (Material Design pattern):

| Elevation | White Overlay | Resulting Surface |
|-----------|--------------|-------------------|
| 0dp | 0% | `#121212` |
| 1dp | 5% | `#1E1E1E` |
| 2dp | 7% | `#222222` |
| 4dp | 9% | `#272727` |
| 6dp | 11% | `#2C2C2C` |
| 8dp | 12% | `#2E2E2E` |
| 12dp | 14% | `#333333` |
| 16dp | 15% | `#353535` |
| 24dp | 16% | `#383838` |

### Typography

**Font Pairing:** Distinctive display font + refined body font. In monochrome palettes, "visual interest shifts to letterforms and layout."

| Role | Font | Fallback |
|------|------|----------|
| Display / Headings | **Instrument Serif** | Georgia, serif |
| Body / UI | **Satoshi** | system-ui, sans-serif |

> **Why these fonts:** Instrument Serif adds editorial character to headings — it's unexpected in a mobile app context, creating a luxury editorial feel. Satoshi is geometric, modern, and highly legible at small sizes — perfect for UI text. The serif/sans pairing creates contrast and sophistication within the monochrome palette.

| Style | Font | Size | Weight | Letter Spacing | Usage |
|-------|------|------|--------|-----------------|-------|
| Display | Instrument Serif | 32px | 400 (Regular) | -0.5px | Hero headings |
| H1 | Instrument Serif | 28px | 400 (Regular) | -0.3px | Page titles |
| H2 | Satoshi | 24px | 700 (Bold) | 0px | Section titles |
| H3 | Satoshi | 20px | 600 (Medium) | 0px | Card titles |
| Body Large | Satoshi | 16px | 400 (Regular) | 0.1px | Primary body text |
| Body | Satoshi | 14px | 400 (Regular) | 0.1px | Standard body text |
| Body Bold | Satoshi | 14px | 700 (Bold) | 0.1px | Emphasis text |
| Caption | Satoshi | 12px | 400 (Regular) | 0.2px | Labels, timestamps |
| Button | Satoshi | 14px | 700 (Bold) | 0.5px | Button labels (uppercase optional) |
| Overline | Satoshi | 12px | 500 (Medium) | 1.5px | Category labels (uppercase) |

**Typography hierarchy rules for greyscale:**
- Create hierarchy through **weight + size + opacity** — never through color
- Use the full weight range: Light 300, Regular 400, Medium 500, Bold 700
- Generous letter-spacing on overlines and buttons
- Tight negative letter-spacing on display text for editorial feel

### Motion Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `durationFast` | 150ms | easeOut | Micro-interactions, toggles |
| `durationNormal` | 250ms | easeInOut | Page transitions, expansions |
| `durationSlow` | 400ms | easeInOut | Complex animations, map transitions |
| `durationEmphasis` | 600ms | spring | Celebratory moments (order confirmed) |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Inline spacing, icon gaps |
| `sm` | 8px | Tight padding |
| `md` | 16px | Standard padding, card gaps |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Page margins |
| `2xl` | 48px | Hero sections, generous breathing room |
| `3xl` | 64px | Major section separations |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `none` | 0px | Sharp edges (editorial cards) |
| `sm` | 4px | Subtle rounding (inputs, chips) |
| `md` | 8px | Standard cards |
| `lg` | 12px | Bottom sheets |
| `xl` | 16px | Feature cards, modals |
| `full` | 9999px | Pills, circular buttons, avatars |

### Elevation / Shadow (Light Theme)

| Level | Shadow | Usage |
|-------|--------|-------|
| None | — | Flat elements |
| Subtle | `0 1px 2px rgba(0,0,0,0.04)` | Resting cards |
| Low | `0 2px 8px rgba(0,0,0,0.06)` | Elevated cards |
| Medium | `0 4px 16px rgba(0,0,0,0.08)` | Bottom sheets, FABs |
| High | `0 8px 32px rgba(0,0,0,0.12)` | Modals, dialogs |

### Touch Targets

All interactive elements must have a minimum touch target of **48x48dp** (Material Design guideline). Visually smaller elements (e.g., icon buttons, checkboxes, small links) use invisible padding to meet this minimum. This ensures reliable tap accuracy on all device sizes and accommodates users with motor impairments.

### Accessibility Rules

- All text meets **WCAG 2.1 AA** contrast ratio (4.5:1 for normal text, 3:1 for large text)
- Never rely on color alone — always pair with icons, labels, or patterns
- Focus indicators visible on all interactive elements (see `focused` interaction state token)
- Screen reader labels on all buttons, icons, and interactive elements via `Semantics` widget
- Minimum touch target: 48x48dp
- Status colors always paired with distinct icons (checkmark, X, exclamation, info)
- Motion respects `MediaQuery.disableAnimations` for users who prefer reduced motion

### Key UI Patterns

1. **Home Screen** — Editorial-style hero with Instrument Serif heading -> service category cards (Paper / 3D) with subtle hover/press depth -> recent orders section -> draft orders
2. **Order Flow** — Minimal step indicator (dots or thin progress bar, greyscale) -> content area with generous whitespace -> sticky bottom CTA button (solid black/white depending on theme)
3. **Order Cards** — Clean horizontal layout with thin left accent line (greyscale or status color) -> order ID in mono -> status chip -> price -> timestamp in caption
4. **Status Timeline** — Vertical stepper with thin connecting line. Completed = solid dark circle. Current = outlined circle with subtle pulse animation. Future = faint dotted
5. **Bottom Navigation** — 4 tabs (customer), 3 tabs (driver/admin), thin line icons. Active = solid fill with label. Inactive = outlined, no label. Minimal visual weight
6. **Empty States** — Centered composition. Line-art illustration + Instrument Serif heading + Satoshi body + ghost-outlined CTA
7. **Buttons** — Primary: solid black (light) / solid white (dark), full-width at bottom of screens. Secondary: outlined with 1px border. Ghost: text-only
8. **Inputs** — Bottom-border style (not full box) for a cleaner, editorial feel. Full box only for search fields
9. **Bottom Sheets** — Subtle drag handle, generous top radius, backdrop blur on dark theme
10. **Skeleton Loading** — Subtle grey shimmer on grey background — low contrast, almost invisible shimmer for sophistication
11. **Map Views** — Google Maps with custom greyscale map style (silver/retro mode to match monochrome aesthetic). Driver pin as a dark circle with directional indicator showing heading. Destination as accent-colored pin. Route line rendered in `onSurface` color. Map controls styled to match the app theme
12. **Address Picker** — Full-screen map with a draggable center pin. As the user moves the map, the address auto-fills below the map via reverse geocoding. Editable fields and the landmark input appear in a bottom sheet that the user can expand. Confirm button at the bottom of the sheet
13. **Driver Status Actions** — Large pill-shaped buttons at the bottom of the screen for checkpoint actions. The current (next) action is highlighted with the accent color. Completed checkpoints shown as greyed-out checkmarks above. Swipe-to-confirm gesture required for "Delivered" to prevent accidental taps
14. **Cancellation Dialog** — Confirmation bottom sheet with cancellation policy summary at the top, optional reason selector (chip group), and a destructive-styled cancel button using the Error semantic color. A secondary "Keep Order" button uses the standard outlined style

---

## 9. Technology Stack

### Frontend (Flutter)

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | Flutter (via FVM) | 3.41.6 | Cross-platform UI framework |
| Language | Dart | 3.11.4 | Primary language |
| State Management | Riverpod | ^2.x (latest) | Compile-safe reactive state |
| Navigation | GoRouter | ^14.x | Declarative routing with guards |
| HTTP Client | Serverpod Client (generated) | — | Type-safe API calls |
| Local Storage | Hive | ^4.x | Offline draft persistence |
| Animations | flutter_animate | ^4.x | Declarative animations |
| Charts | fl_chart | ^0.x (latest) | Admin dashboard charts |
| File Picker | file_picker | ^8.x | File selection for uploads |
| Image Handling | cached_network_image | ^3.x | Cached image loading |
| Icons | Iconsax (line style) | latest | Consistent icon set |
| Fonts | Satoshi (bundled) + Instrument Serif (bundled) | — | Typography system |
| Skeleton Loading | shimmer | ^3.x | Loading placeholders |
| Connectivity | connectivity_plus | ^6.x | Network state detection |
| Push Notifications | firebase_messaging | ^15.x | FCM push notifications |
| Deep Linking | url_launcher | ^6.x | E-wallet and navigation app launches |
| Date Utilities | intl | ^0.x (latest) | Currency and date formatting |
| Google Maps | google_maps_flutter | ^2.x | Map views, address picker |
| Geolocator | geolocator | ^12.x | GPS location tracking |
| Geocoding | geocoding | ^3.x | Coordinates to/from address resolution |
| Location Permission | permission_handler | ^11.x | Runtime permission management |

### Backend (Serverpod) -- in `./server`

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Serverpod | ^2.x (latest) |
| Language | Dart | 3.11.4 |
| Database | PostgreSQL | 15+ |
| ORM | Serverpod ORM (built-in) | — |
| Real-Time | Serverpod Streams (WebSocket) | — |
| Auth | serverpod_auth_server | — |
| File Storage | Serverpod Storage (S3-compatible or local) | — |
| Task Scheduling | Serverpod Future Calls | — |
| Containerization | Docker + Docker Compose | — |

### Why Serverpod?

| Consideration | Serverpod | Dart Frog | Node.js (Express) | Firebase |
|---------------|-----------|-----------|-------------------|----------|
| **Language** | Dart (shared with Flutter) | Dart | JavaScript/TS | N/A (BaaS) |
| **ORM** | Built-in, type-safe | None (BYO) | Prisma/TypeORM | Firestore (NoSQL) |
| **Real-Time** | Built-in WebSocket streams | Manual | Socket.io | Built-in |
| **File Storage** | Built-in (S3/local) | Manual | Manual | Built-in |
| **Auth** | Built-in module | BYO | Passport.js | Built-in |
| **Code Gen** | Shared models client+server | None | None | None |
| **Self-Hosted** | Yes | Yes | Yes | No (Google-owned) |
| **Cost Control** | Full control | Full control | Full control | Pay-per-use, can spike |

**Decision:** Serverpod — full-stack Dart, batteries-included, shared type-safe models between client and server.

### Development Tools

| Tool | Purpose |
|------|---------|
| FVM | Flutter version management |
| Docker | PostgreSQL + Serverpod dev environment |
| Serverpod CLI | Code generation, migrations, deployment |
| VS Code | Primary IDE with Flutter/Dart extensions |
| Context7 MCP | Up-to-date library documentation during development |
| Google Cloud Console | Maps API key management |

---

## 10. Navigation Structure

### Customer Navigation

```
Bottom Tabs (4 tabs):
├── Home                         # Dashboard with hero, services, recent orders
├── Orders                       # Order list with active/completed tabs
├── Notifications                # Status update alerts
└── Profile                      # Settings, account, dark mode, sign out

Order Flow (Stack — pushed over tabs):
├── Category Selection           # Paper vs 3D
├── Specifications               # Paper specs or 3D specs
├── File Upload                  # Pick and validate file
├── Order Summary                # Review + price
├── Delivery Details             # Pickup vs delivery + address picker
└── Payment                      # Select method + confirm

Other Screens (Stack):
├── Order Detail                 # Full order view with status timeline
├── Account Details              # Edit profile information
├── Delivery Tracking            # Live map with driver location
├── Address List                 # Saved addresses management
├── Address Picker               # Map + form for new address
├── Support / Help               # Contact info + FAQ
├── Terms of Service             # Legal
└── Privacy Policy               # Legal (RA 10173)
```

### Driver Navigation

```
Bottom Tabs (3 tabs):
├── Deliveries                   # Assigned deliveries list
├── History                      # Completed deliveries + earnings
└── Profile                      # Account, vehicle info, availability toggle

Active Delivery (Full-screen overlay):
├── Delivery Detail              # Order info + customer address + map preview
└── Active Delivery Map          # Full-screen map with route + checkpoint actions

Other Screens (Stack):
├── Earnings Summary             # Daily/weekly/monthly breakdown
└── Vehicle Info                 # Edit vehicle details
```

### Admin Navigation

```
Bottom Tabs (3 tabs):
├── Dashboard                    # KPIs + charts
├── Queue                        # Order management with filters
└── Profile                      # Admin settings, sign out

Other Screens (Stack):
├── Order Detail                 # Full order view + status update controls
├── File Preview                 # View uploaded customer files
├── Driver Assignment            # Pick driver for an order
├── Driver List                  # View all drivers + availability
└── Order Status History         # Audit trail for an order
```

### Auth Flow (Stack -- before tabs)

```
├── Login                        # Email/password + dev bypass
├── Register                     # Create account
└── Profile Setup                # Complete profile (required)
```

### Route Guards

- Not authenticated -> redirect to `/auth/login`
- Authenticated + incomplete profile -> redirect to `/auth/profile-setup`
- Customer role + complete profile -> redirect to `/customer/home`
- Driver role -> redirect to `/driver/deliveries`
- Driver without vehicle info -> redirect to `/driver/profile-setup`
- Admin role -> redirect to `/admin/dashboard`
## 11. Data Models

All data models are defined as Serverpod serializable classes. Models marked **(keep)** are unchanged from v1. Models marked **(update)** have new or modified fields. Models marked **(NEW)** are entirely new.

### User (update)

Added `role` field supporting three values, `isActive` flag, and `gender`/`dateOfBirth` for profile completeness.

```dart
class User {
  int? id;
  String uid;
  String email;
  String? fullName;
  String? phoneNumber;
  String? gender;                 // 'male', 'female', 'other'
  DateTime? dateOfBirth;
  String role;                    // 'customer', 'driver', 'admin'
  bool isProfileComplete;
  bool isActive;
  DateTime createdAt;
  DateTime updatedAt;
}
```

### Order (update)

Added delivery fee, delivery option, driver assignment, estimated completion, cancellation fields, and admin notes.

```dart
class Order {
  int? id;
  String orderId;                 // Human-readable (ORD-XXXXX)
  int userId;
  String category;                // 'paper', '3d'
  String? fileUrl;
  String? fileName;
  PaperSpecs? paperSpecs;
  ThreeDSpecs? threeDSpecs;
  int quantity;
  double totalPrice;              // PHP (printing cost)
  double deliveryFee;             // PHP (delivery fee, 0 for pickup)
  String paymentMethod;           // 'gcash', 'maya', 'cod'
  String paymentStatus;           // 'pending', 'paid', 'failed', 'refunded'
  String orderStatus;             // See OrderStatus enum in Appendix
  String? declineReason;
  String? cancellationReason;
  DateTime? cancelledAt;
  String deliveryOption;          // 'pickup', 'delivery'
  int? deliveryAddressId;         // FK to Address
  int? assignedDriverId;          // FK to User (driver)
  DateTime? estimatedCompletionAt;
  String? adminNotes;             // Internal notes
  String? trackingLink;           // External tracking URL (optional)
  DateTime createdAt;
  DateTime updatedAt;
}
```

### PaperSpecs (keep)

```dart
class PaperSpecs {
  String paperSize;
  String colorMode;
  String mediaType;
  String printSides;
  String binding;
}
```

### ThreeDSpecs (keep)

```dart
class ThreeDSpecs {
  String fileFormat;
  String material;
  String color;
  int infillPercentage;
  double layerHeight;
  bool supports;
  String? notes;
}
```

### Address (NEW)

Stores customer delivery addresses with GPS coordinates for map display and distance calculations.

```dart
class Address {
  int? id;
  int userId;
  String label;                   // 'Home', 'Office', etc.
  String fullAddress;
  String? barangay;
  String city;
  String? province;
  String? zipCode;
  String? landmark;               // "Near Jollibee on Main St"
  double latitude;
  double longitude;
  bool isDefault;
  DateTime createdAt;
  DateTime updatedAt;
}
```

### DriverProfile (NEW)

Extended profile for users with `role='driver'`. Tracks vehicle info, availability status, and last known location.

```dart
class DriverProfile {
  int? id;
  int userId;                     // FK to User (role='driver')
  String vehicleType;             // 'motorcycle', 'bicycle', 'car'
  String? plateNumber;
  String? licenseNumber;
  bool isAvailable;               // Online/offline toggle
  double? lastLatitude;
  double? lastLongitude;
  DateTime? lastLocationUpdate;
  DateTime createdAt;
  DateTime updatedAt;
}
```

### DeliveryAssignment (NEW)

Tracks the lifecycle of a single delivery from assignment through completion. One order may have multiple assignments if a driver declines.

```dart
class DeliveryAssignment {
  int? id;
  int orderId;
  int driverId;                   // FK to User (driver)
  String status;                  // 'assigned', 'accepted', 'declined', 'picked_up', 'on_the_way', 'arrived', 'delivered'
  DateTime? assignedAt;
  DateTime? acceptedAt;
  DateTime? pickedUpAt;
  DateTime? onTheWayAt;
  DateTime? arrivedAt;
  DateTime? deliveredAt;
  String? declineReason;
  String? proofPhotoUrl;          // Delivery proof photo
  DateTime createdAt;
  DateTime updatedAt;
}
```

### LocationUpdate (NEW)

GPS breadcrumbs recorded during active delivery. Used for live map tracking and post-delivery route review.

```dart
class LocationUpdate {
  int? id;
  int deliveryAssignmentId;
  double latitude;
  double longitude;
  double? speed;                  // km/h
  double? heading;                // degrees
  DateTime timestamp;
}
```

### OrderStatusHistory (NEW)

Audit trail for every order status change. Records who changed it and why.

```dart
class OrderStatusHistory {
  int? id;
  int orderId;
  String fromStatus;
  String toStatus;
  int changedByUserId;            // Admin or system
  String? notes;
  DateTime createdAt;
}
```

### PaymentTransaction (NEW)

Records every payment attempt and webhook response. Supports reconciliation and debugging.

```dart
class PaymentTransaction {
  int? id;
  int orderId;
  String paymentMethod;           // 'gcash', 'maya', 'cod'
  double amount;
  String status;                  // 'pending', 'success', 'failed', 'refunded'
  String? externalReferenceId;    // GCash/Maya transaction ID
  String? webhookPayload;         // Raw webhook data for debugging
  DateTime createdAt;
}
```

### AppNotification (keep)

```dart
class AppNotification {
  int? id;
  int userId;
  String orderId;
  String title;
  String message;
  String type;
  bool isRead;
  DateTime createdAt;
}
```

### DraftOrder (update)

Added `deliveryOption` and `savedAddressId` to persist delivery preferences locally.

```dart
class DraftOrder {
  String localId;                 // UUID
  String? category;
  PaperSpecs? paperSpecs;
  ThreeDSpecs? threeDSpecs;
  String? localFileUri;
  int? quantity;
  String? deliveryOption;
  int? savedAddressId;
  DateTime savedAt;
}
```

---

## 12. API Specification (Serverpod Endpoints)

All endpoints require an authenticated `Session` unless otherwise noted. Role-based guards enforce that customers cannot access admin/driver endpoints and vice versa. Streaming endpoints use Serverpod's built-in WebSocket support.

### AuthEndpoint (keep)

```dart
class AuthEndpoint extends Endpoint {
  Future<UserInfo> register(Session session, String email, String password);
  Future<AuthResponse> login(Session session, String email, String password);
  Future<void> logout(Session session);
}
```

### UserEndpoint (keep)

```dart
class UserEndpoint extends Endpoint {
  Future<User> getProfile(Session session);
  Future<User> updateProfile(Session session, User user);
  Future<bool> isProfileComplete(Session session);
}
```

### OrderEndpoint (update)

Added `cancelOrder`, `getOrderHistory`, `streamOrderUpdates`, and `streamUserOrders`. The `getUserOrders` method now accepts an optional status filter.

```dart
class OrderEndpoint extends Endpoint {
  Future<Order> createOrder(Session session, CreateOrderPayload payload);
  Future<List<Order>> getUserOrders(Session session, {String? statusFilter});
  Future<Order> getOrder(Session session, String orderId);
  Future<Order> cancelOrder(Session session, String orderId, {String? reason});
  Future<List<OrderStatusHistory>> getOrderHistory(Session session, String orderId);
  Stream<Order> streamOrderUpdates(Session session, String orderId);
  Stream<List<Order>> streamUserOrders(Session session);
}
```

### AddressEndpoint (NEW)

Full CRUD for customer delivery addresses with default address management.

```dart
class AddressEndpoint extends Endpoint {
  Future<List<Address>> getAddresses(Session session);
  Future<Address> createAddress(Session session, Address address);
  Future<Address> updateAddress(Session session, Address address);
  Future<void> deleteAddress(Session session, int addressId);
  Future<Address> setDefaultAddress(Session session, int addressId);
}
```

### AdminEndpoint (update)

Added `assignDriver`, `getAvailableDrivers`, `getSalesAnalytics`, and `streamOrderQueue`. The `updateOrderStatus` method now accepts optional `declineReason` and `estimatedCompletion`.

```dart
class AdminEndpoint extends Endpoint {
  Future<DashboardStats> getDashboardStats(Session session);
  Future<List<Order>> getAllOrders(Session session, {String? statusFilter});
  Future<Order> updateOrderStatus(Session session, String orderId, String newStatus, {String? declineReason, DateTime? estimatedCompletion});
  Future<Order> assignDriver(Session session, String orderId, int driverId);
  Future<List<DriverProfile>> getAvailableDrivers(Session session);
  Future<SalesAnalytics> getSalesAnalytics(Session session, DateTime startDate, DateTime endDate);
  Stream<List<Order>> streamOrderQueue(Session session);
}
```

### DriverEndpoint (NEW)

All driver-facing operations: profile management, assignment lifecycle, delivery history, and earnings.

```dart
class DriverEndpoint extends Endpoint {
  Future<DriverProfile> getDriverProfile(Session session);
  Future<DriverProfile> updateDriverProfile(Session session, DriverProfile profile);
  Future<void> setAvailability(Session session, bool isAvailable);
  Future<List<DeliveryAssignment>> getAssignments(Session session, {String? statusFilter});
  Future<DeliveryAssignment> acceptAssignment(Session session, int assignmentId);
  Future<DeliveryAssignment> declineAssignment(Session session, int assignmentId, String reason);
  Future<DeliveryAssignment> updateDeliveryStatus(Session session, int assignmentId, String newStatus);
  Future<List<DeliveryAssignment>> getDeliveryHistory(Session session, {int? limit, int? offset});
  Future<EarningsSummary> getEarnings(Session session, DateTime startDate, DateTime endDate);
  Stream<DeliveryAssignment> streamActiveDelivery(Session session);
}
```

### LocationEndpoint (NEW)

Handles GPS location updates from drivers and streams them to customers tracking a delivery.

```dart
class LocationEndpoint extends Endpoint {
  Future<void> updateLocation(Session session, double latitude, double longitude, {double? speed, double? heading});
  Stream<LocationUpdate> streamDriverLocation(Session session, int deliveryAssignmentId);
}
```

### FileEndpoint (keep)

```dart
class FileEndpoint extends Endpoint {
  Future<String> uploadFile(Session session, Stream<List<int>> fileStream, String fileName, String category);
  Future<String> getFileUrl(Session session, String filePath);
}
```

### NotificationEndpoint (keep)

```dart
class NotificationEndpoint extends Endpoint {
  Future<List<AppNotification>> getNotifications(Session session);
  Future<void> markAsRead(Session session, int notificationId);
  Future<void> markAllAsRead(Session session);
  Stream<AppNotification> streamNotifications(Session session);
}
```

### PaymentEndpoint (update)

Added `handlePaymentWebhook` for server-side payment verification and `initiateRefund` for cancellation refunds.

```dart
class PaymentEndpoint extends Endpoint {
  Future<Order> confirmPayment(Session session, String orderId, String method);
  Future<Order> markCodPaid(Session session, String orderId);
  Future<void> handlePaymentWebhook(Session session, String provider, Map<String, dynamic> payload);
  Future<PaymentTransaction> initiateRefund(Session session, String orderId);
}
```

---

## 13. Database Schema (PostgreSQL)

Complete schema including all original tables (updated) and all new tables.

```sql
-- ============================================================
-- USERS
-- Updated: role now includes 'driver', added is_active
-- ============================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    gender VARCHAR(10),
    date_of_birth TIMESTAMP,
    role VARCHAR(10) NOT NULL DEFAULT 'customer',  -- 'customer', 'driver', 'admin'
    is_profile_complete BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADDRESSES (NEW)
-- ============================================================
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    label VARCHAR(50) NOT NULL,
    full_address TEXT NOT NULL,
    barangay VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    province VARCHAR(100),
    zip_code VARCHAR(10),
    landmark TEXT,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DRIVER PROFILES (NEW)
-- ============================================================
CREATE TABLE driver_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    vehicle_type VARCHAR(20) NOT NULL,        -- 'motorcycle', 'bicycle', 'car'
    plate_number VARCHAR(20),
    license_number VARCHAR(50),
    is_available BOOLEAN NOT NULL DEFAULT false,
    last_latitude DECIMAL(10,7),
    last_longitude DECIMAL(10,7),
    last_location_update TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDERS (updated)
-- Added: delivery fields, driver assignment, ETA, cancellation
-- ============================================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(20) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    category VARCHAR(10) NOT NULL,
    file_url TEXT,
    file_name VARCHAR(255),
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(10) NOT NULL,
    payment_status VARCHAR(10) NOT NULL DEFAULT 'pending',
    order_status VARCHAR(30) NOT NULL DEFAULT 'order_placed',
    decline_reason TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    delivery_option VARCHAR(10) NOT NULL DEFAULT 'pickup',
    delivery_address_id INTEGER REFERENCES addresses(id),
    assigned_driver_id INTEGER REFERENCES users(id),
    estimated_completion_at TIMESTAMP,
    admin_notes TEXT,
    tracking_link TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAPER SPECS (keep)
-- ============================================================
CREATE TABLE paper_specs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    paper_size VARCHAR(20) NOT NULL,
    color_mode VARCHAR(20) NOT NULL,
    media_type VARCHAR(20) NOT NULL,
    print_sides VARCHAR(20) NOT NULL,
    binding VARCHAR(30) NOT NULL DEFAULT 'none'
);

-- ============================================================
-- 3D SPECS (keep)
-- ============================================================
CREATE TABLE three_d_specs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_format VARCHAR(10) NOT NULL,
    material VARCHAR(10) NOT NULL,
    color VARCHAR(50) NOT NULL,
    infill_percentage INTEGER NOT NULL,
    layer_height DECIMAL(3,2) NOT NULL,
    supports BOOLEAN NOT NULL DEFAULT false,
    notes TEXT
);

-- ============================================================
-- DELIVERY ASSIGNMENTS (NEW)
-- ============================================================
CREATE TABLE delivery_assignments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    driver_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'assigned',
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    on_the_way_at TIMESTAMP,
    arrived_at TIMESTAMP,
    delivered_at TIMESTAMP,
    decline_reason TEXT,
    proof_photo_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LOCATION UPDATES (NEW)
-- GPS breadcrumbs for live delivery tracking
-- ============================================================
CREATE TABLE location_updates (
    id SERIAL PRIMARY KEY,
    delivery_assignment_id INTEGER NOT NULL REFERENCES delivery_assignments(id) ON DELETE CASCADE,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    speed DECIMAL(6,2),
    heading DECIMAL(5,2),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDER STATUS HISTORY (NEW)
-- Audit trail for every status transition
-- ============================================================
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    from_status VARCHAR(30) NOT NULL,
    to_status VARCHAR(30) NOT NULL,
    changed_by_user_id INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYMENT TRANSACTIONS (NEW)
-- ============================================================
CREATE TABLE payment_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    payment_method VARCHAR(10) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    external_reference_id VARCHAR(255),
    webhook_payload JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS (keep)
-- ============================================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_ref VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_user_status ON orders(user_id, order_status);
CREATE INDEX idx_orders_driver ON orders(assigned_driver_id);

-- Addresses
CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- Driver profiles
CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_available ON driver_profiles(is_available);

-- Delivery assignments
CREATE INDEX idx_delivery_assignments_order ON delivery_assignments(order_id);
CREATE INDEX idx_delivery_assignments_driver ON delivery_assignments(driver_id);
CREATE INDEX idx_delivery_assignments_status ON delivery_assignments(status);

-- Location updates
CREATE INDEX idx_location_updates_assignment ON location_updates(delivery_assignment_id);
CREATE INDEX idx_location_updates_timestamp ON location_updates(timestamp DESC);

-- Order status history
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- Payment transactions
CREATE INDEX idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_external ON payment_transactions(external_reference_id);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

> **Note:** All mutable tables include `updated_at` columns. Application code must update these on every write. Consider a PostgreSQL trigger for automatic `updated_at` management:
>
> ```sql
> CREATE OR REPLACE FUNCTION update_updated_at_column()
> RETURNS TRIGGER AS $$
> BEGIN
>     NEW.updated_at = NOW();
>     RETURN NEW;
> END;
> $$ language 'plpgsql';
> ```

---

## 14. Security & Configuration

### 14.1 Security Scope

#### In Scope

- **Authentication:** Email/password with session tokens via Serverpod auth module
- **Session storage:** Tokens stored in `flutter_secure_storage` (not plain Hive or SharedPreferences)
- **Role-based access control:** Server-side endpoint guards enforce `customer`, `driver`, and `admin` separation -- no client-side-only role checks
- **HTTPS:** All client-server communication over TLS
- **Input validation:** Server-side validation on all endpoints; client-side validation for UX only
- **Rate limiting:** Auth endpoints limited to 5 attempts per minute per IP; file upload endpoints rate-limited per user
- **File upload security:** Server-side MIME type whitelist, filename sanitization, max file size enforcement (50 MB paper, 100 MB 3D)
- **File access control:** Uploaded files accessible only to the uploading customer, assigned driver, and admins -- no public URLs
- **Payment webhook verification:** GCash/Maya HMAC signature validation on all incoming webhooks
- **Location data access:** GPS tracking data restricted to active delivery participants only (assigned driver, ordering customer, admins)
- **Driver location scoping:** Driver location updates authenticated and scoped to their assigned deliveries
- **Order status audit trail:** Every status change logged in `order_status_history` with actor and timestamp
- **Philippine Data Privacy Act (RA 10173) compliance:** Privacy policy, data retention policy, user data export/deletion capability

#### Out of Scope (Post-MVP)

- IP-based blocking and geographic restrictions
- Two-factor authentication (2FA)
- End-to-end encryption of file contents
- Geofencing for delivery zones
- Driver background check integration
- SOC 2 or ISO 27001 compliance

### 14.2 Server Configuration

Existing Serverpod configuration with the following additions:

```yaml
# config/production.yaml (additions)

# Google Maps API
google:
  mapsApiKey: ${GOOGLE_MAPS_API_KEY}

# Payment Webhooks
payments:
  gcash:
    webhookSecret: ${GCASH_WEBHOOK_SECRET}
  maya:
    webhookSecret: ${MAYA_WEBHOOK_SECRET}

# Location Tracking
location:
  updateIntervalSeconds: 10
  maxStaleSeconds: 60
```

### 14.3 Client Configuration

Existing client configuration with the following additions:

```dart
// lib/config/constants/api_constants.dart (additions)

const String googleMapsApiKey = String.fromEnvironment('GOOGLE_MAPS_API_KEY');
const int locationUpdateIntervalMs = 10000;  // 10 seconds during active delivery
```

### 14.4 Deployment

Existing deployment configuration applies. Additional production requirements:

- **SSL/TLS:** Reverse proxy via nginx or Caddy with Let's Encrypt auto-renewal
- **Secrets management:** Environment variables via `.env` files (excluded from git via `.gitignore`) or a dedicated secrets manager
- **Database backups:** PostgreSQL automated backups -- daily snapshots with 30-day retention
- **Health monitoring:** Health check endpoint (`/health`) for uptime monitoring and alerting
- **Error tracking:** Sentry integration for both Flutter client and Serverpod server -- crash reporting, performance monitoring, and breadcrumb trails

---

## 15. Success Criteria

### 15.1 MVP Success Definition

The MVP is successful when:

1. A customer can register, log in, and complete their profile
2. A customer can place a paper or 3D printing order with full spec customization
3. A customer can upload a file, see the calculated price, and pay
4. A customer can select delivery with a map-picked address or choose pickup
5. A customer receives real-time status updates as the admin progresses the order
6. A customer can see the driver's live location on a map during delivery
7. A customer can cancel an order before printing starts
8. An admin can view the dashboard with live KPIs
9. An admin can manage the order queue and update statuses
10. An admin can assign a driver to an order ready for dispatch
11. A driver can accept assignments, update checkpoints, and complete deliveries
12. The UI feels premium, refined, and distinctly monochrome -- not a default Flutter app

### 15.2 Functional Requirements

- Complete user registration and authentication flow
- Profile completion with personal details
- Paper printing order with size, color mode, media type, sides, and binding options
- 3D printing order with format, material, color, infill, layer height, and support options
- File upload with validation and progress indication
- Dynamic price calculation based on specs and quantity
- Payment via GCash, Maya, or Cash on Delivery
- Payment webhook processing for server-side verification
- Real-time order status updates via WebSocket streams
- Order cancellation within policy (before `printingInProgress`)
- Address management with map picker and saved addresses
- Delivery option selection (pickup vs delivery)
- Estimated completion/delivery time display
- Driver assignment and delivery workflow
- Live GPS tracking during delivery ("on the way" phase)
- Order status audit trail
- Admin dashboard with live KPIs and order queue
- Admin order management with status progression
- Admin driver assignment for delivery orders
- In-app notifications for status changes
- Draft order persistence for offline resilience
- Support/help access from within the app

### 15.3 Quality Indicators

- App cold start under 2 seconds on mid-range Android devices
- Order placement flow completable in under 60 seconds (returning user)
- All screens render at 60 fps with no visible jank
- File uploads show accurate progress and handle interruptions gracefully
- Real-time status updates arrive within 1 second of server-side change
- Location updates arrive within 3 seconds during active delivery
- Map renders within 1 second of opening tracking screen
- Driver GPS battery impact under 5% per hour of active delivery
- All text meets WCAG 2.1 AA contrast ratios
- Offline draft save and restore works reliably across app restarts
- Zero data loss on network interruption during order placement

---

## 16. Implementation Phases

### Phase 1: UI Shell & Greyscale Design System

**Goal:** Build the complete visual layer with mock data. Every screen exists, navigates correctly, and looks premium.

**Deliverables:**
- Design system: color tokens, typography scale, spacing system, component library
- Onboarding / splash screen
- Auth screens (login, register, forgot password)
- Profile completion screen
- Customer home / dashboard
- Order creation flow (paper and 3D, step-by-step)
- File upload screen with progress indicator
- Order summary and payment selection
- Order history list and order detail screens
- Delivery tracking screen with mock map view
- Address picker screen with Google Maps integration
- Order cancellation confirmation dialog
- Notifications screen
- Settings screen
- Support/help screen
- Terms of service and privacy policy screens
- Admin dashboard with mock KPI cards
- Admin order queue with mock data
- Admin order detail with status controls
- Driver screens built with mock data (deliveries list, active delivery map, history, profile)
- Bottom navigation and routing for all three roles

### Phase 2: Order Flow UI & Local Logic

**Goal:** Wire up local state management, form validation, draft persistence, and price calculation -- all without a backend.

**Deliverables:**
- State management setup (Riverpod providers)
- Order form validation with real-time feedback
- Dynamic price calculation engine
- Draft order save/restore via Hive
- File picker integration with type and size validation
- Delivery option selection (pickup vs delivery)
- Address management CRUD with map pin picker
- Cancellation flow UI
- Estimated completion time display
- Local notification scheduling
- Offline state indicators

### Phase 3: Serverpod Backend Setup

**Goal:** Stand up the server, define all models and endpoints, configure the database.

**Deliverables:**
- Serverpod project initialization and configuration
- All data models defined as Serverpod serializable classes
- PostgreSQL schema migration with all tables and indexes
- Auth endpoints (register, login, logout)
- User profile endpoints
- Order CRUD endpoints with status management
- Address CRUD endpoints
- File upload endpoint with cloud storage integration
- Driver profile and delivery assignment models
- Driver endpoints (profile, assignments, status updates)
- Location streaming endpoints
- Order status history logging
- Payment webhook endpoint with signature verification
- Notification creation and delivery logic
- Rate limiting middleware on auth and upload endpoints
- Health check endpoint
- WebSocket stream setup for real-time updates

### Phase 4: Client-Server Integration

**Goal:** Connect every Flutter screen to its corresponding Serverpod endpoint. Replace all mock data with live data.

**Deliverables:**
- Auth flow connected to server (register, login, session management)
- Profile sync between client and server
- Order creation connected to server with file upload
- Real-time order status streaming connected
- Payment flow connected (GCash, Maya, COD)
- Payment webhook processing verified end-to-end
- Notifications connected to server stream
- Admin dashboard connected to live data
- Admin order queue with real-time updates
- Driver assignment from admin queue
- Driver app connected to assignment streams
- Live GPS tracking connected (driver sends, customer receives)
- Address management connected to server
- Cancellation flow connected
- Order status history display
- Offline queue with sync-on-reconnect
- Error handling and retry logic on all network calls

### Phase 5: Polish & Production Readiness

**Goal:** Harden the app for real-world use. Performance, security, and reliability.

**Deliverables:**
- SSL/TLS configuration via reverse proxy
- PostgreSQL backup automation (daily, 30-day retention)
- Sentry error tracking integration (Flutter + Serverpod)
- Location tracking battery optimization (adaptive intervals)
- Map style customization (greyscale tile styling to match design system)
- WCAG accessibility audit and fixes
- Privacy policy and terms of service content (RA 10173 compliant)
- CI/CD pipeline (GitHub Actions: lint, test, build)
- Performance profiling and optimization (jank, memory, network)
- Edge case testing (slow network, large files, concurrent orders)
- App icon, splash screen, and store listing assets
- Final QA pass across Android and iOS devices

---

## 17. Future Considerations

### 17.1 Post-MVP Enhancements

- **Auto-Assignment Algorithm** -- Automatically assign nearest available driver based on proximity and current workload
- **Driver Self-Select** -- Allow drivers to browse and claim available deliveries from a public queue
- **Route Optimization** -- Multi-stop delivery route planning for batch deliveries
- **Delivery Zones** -- Geofenced service areas with zone-based pricing tiers
- **Distance-Based Pricing** -- Dynamic delivery fee calculated from shop-to-customer distance
- **Driver Ratings** -- Customer rates driver after delivery; rating affects assignment priority
- **Delivery Photo Proof** -- Required photo on delivery for verification (basic version in MVP, enhanced post-MVP with AI validation)
- **Heat Maps** -- Admin view of delivery demand patterns by time and geography
- **Driver Incentives** -- Bonus system for peak hours, high volume, or perfect rating streaks
- **In-App Chat** -- Customer-driver messaging during active delivery
- **Bulk Orders** -- Business accounts with volume discounts and recurring orders
- **Order Templates** -- Save frequently used spec combinations for quick reorder
- **Multi-Language Support** -- Filipino (Tagalog) and Cebuano localization
- **Push Notifications** -- FCM integration for background status updates
- **Advanced Analytics** -- Revenue trends, customer retention, driver utilization dashboards

### 17.2 Technical Improvements

- **Location Data Archival** -- Move GPS breadcrumbs older than 30 days to cold storage to keep `location_updates` table performant
- **Map Tile Caching** -- Reduce Google Maps API costs with offline tile caching for frequently viewed areas
- **Background Location Optimization** -- Adaptive GPS interval based on driver speed (slower updates when stationary, faster when moving)
- **CDN for File Storage** -- Move uploaded files behind a CDN for faster downloads and reduced server load
- **Database Read Replicas** -- Horizontal scaling for read-heavy admin analytics queries
- **WebSocket Connection Pooling** -- Optimize concurrent real-time connections for scale
- **API Versioning** -- Version endpoints to support backward-compatible client updates

---

## 18. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Serverpod learning curve** | Slower initial development | Invest in Serverpod documentation study upfront; build proof-of-concept for streaming and auth before full development |
| **File upload size/reliability** | Failed uploads frustrate users | Chunked upload with resume capability; clear progress indicator; retry logic; client-side size validation before upload |
| **Real-time sync complexity** | Stale data, race conditions | Serverpod's built-in streaming handles WebSocket lifecycle; optimistic UI updates with server reconciliation |
| **GCash/Maya integration** | Payment API instability or changes | Abstract payment behind interface; webhook verification with fallback to manual admin confirmation |
| **Single admin bottleneck** | Orders pile up when admin is unavailable | Design admin UI for speed (bulk actions, keyboard shortcuts); post-MVP: auto-accept for repeat customers |
| **Driver GPS battery drain** | Drivers avoid using the app | 10-second interval during active delivery only; stop tracking on arrive; background-optimized location provider |
| **Google Maps API costs** | Unexpected bills as usage grows | Monitor API usage closely; implement tile caching; set billing alerts; consider Mapbox as fallback provider |
| **Driver no-shows** | Orders stuck in "assigned" state | Auto-timeout: if driver doesn't accept within 10 minutes, auto-reassign; admin notification on timeout |
| **Inaccurate GPS in urban Philippines** | Driver appears in wrong location on map | Use fused location provider; allow driver to manually mark "arrived"; customer confirmation step |
| **Address inaccuracy** | Driver can't find customer location | Mandatory landmark field; customer phone visible to driver during delivery; "arrived" notification prompts customer to come out |
| **Payment webhook failures** | Payments confirmed client-side without server verification | Webhook retry with exponential backoff; manual admin verification fallback; reconciliation endpoint for auditing |
| **RA 10173 non-compliance** | Legal and regulatory issues in the Philippines | Privacy policy, data retention policy, and user data deletion capability implemented before launch; consult legal counsel |
| **Location data privacy** | User trust issues and potential complaints | Location only tracked during active delivery; data retained 30 days max; clear disclosure in privacy policy and in-app consent |

---

## 19. Appendix

### 19.1 Key Dependencies & Documentation

| Package | Purpose |
|---------|---------|
| [Flutter](https://flutter.dev/docs) | Cross-platform mobile framework |
| [Serverpod](https://docs.serverpod.dev/) | Full-stack Dart backend framework |
| [Riverpod](https://riverpod.dev/) | State management |
| [Hive](https://docs.hivedb.dev/) | Local storage for drafts and offline data |
| [GoRouter](https://pub.dev/packages/go_router) | Declarative routing |
| [Google Maps Flutter](https://pub.dev/packages/google_maps_flutter) | Map views for address picker and delivery tracking |
| [Geolocator](https://pub.dev/packages/geolocator) | GPS location access for driver tracking |
| [Geocoding](https://pub.dev/packages/geocoding) | Address-to-coordinates and reverse geocoding |
| [Permission Handler](https://pub.dev/packages/permission_handler) | Runtime permission management (location, camera, storage) |
| [Flutter Secure Storage](https://pub.dev/packages/flutter_secure_storage) | Encrypted storage for session tokens |
| [File Picker](https://pub.dev/packages/file_picker) | Document and 3D file selection |
| [Shimmer](https://pub.dev/packages/shimmer) | Loading skeleton animations |
| [Flutter Animate](https://pub.dev/packages/flutter_animate) | Micro-interaction animations |
| [Philippine Data Privacy Act (RA 10173)](https://www.privacy.gov.ph/data-privacy-act/) | Regulatory compliance reference |

### 19.2 Environment Requirements

| Requirement | Purpose |
|-------------|---------|
| Flutter SDK >= 3.19 | Mobile app development |
| Dart SDK >= 3.3 | Language runtime |
| Serverpod CLI | Backend code generation and deployment |
| PostgreSQL >= 15 | Primary database |
| Docker (optional) | Local development environment for server |
| Google Maps API Key | Required for map views and geocoding |
| Google Cloud Console | Maps API management and billing |
| GCash Developer Account | Payment integration |
| Maya Developer Account | Payment integration |
| Sentry DSN | Error tracking (production) |

### 19.3 Currency & Locale

- **Currency:** Philippine Peso (₱ / PHP)
- **Locale:** `en_PH` (English - Philippines)
- **Number format:** ₱1,234.56
- **Date format:** MMMM d, yyyy (e.g., March 27, 2026)
- **Time format:** 12-hour with AM/PM

### 19.4 Order Status Enum

The complete lifecycle of an order, from placement through completion or cancellation.

```dart
enum OrderStatus {
  orderPlaced,          // Customer submitted the order
  fileVerified,         // Admin verified the uploaded file is printable
  fileDeclined,         // Admin declined the file (with reason)
  printingInProgress,   // Printing has started
  finishingMounting,    // Post-print finishing (binding, mounting, etc.)
  qualityChecked,       // Quality check passed
  readyForDispatch,     // Ready for driver pickup or customer pickup
  driverAssigned,       // Driver assigned to deliver (delivery orders only)
  pickedUp,             // Driver picked up from shop (delivery orders only)
  onTheWay,             // Driver en route -- live GPS tracking active
  arrivedAtDestination, // Driver arrived at customer location
  delivered,            // Delivery confirmed (delivery orders)
  completedPickup,      // Customer picked up from shop (pickup orders)
  cancelled,            // Order cancelled by customer or admin
}
```

### 19.5 Delivery Status Enum

The lifecycle of a delivery assignment, tracked independently from the order status.

```dart
enum DeliveryStatus {
  assigned,    // Admin assigned driver to the delivery
  accepted,    // Driver accepted the assignment
  declined,    // Driver declined (with reason) -- triggers reassignment
  pickedUp,    // Driver picked up the order from the shop
  onTheWay,    // Driver en route to customer -- live GPS tracking begins
  arrived,     // Driver arrived at delivery address -- GPS tracking stops
  delivered,   // Delivery confirmed complete
}
```

### 19.6 Cancellation Policy Summary

| Condition | Allowed | Refund |
|-----------|---------|--------|
| Status is `orderPlaced` | Yes | Full refund for e-wallet payments; COD orders simply cancelled |
| Status is `fileVerified` | Yes | Full refund for e-wallet payments; COD orders simply cancelled |
| Status is `fileDeclined` | Yes | Full refund for e-wallet payments; COD orders simply cancelled |
| Status is `printingInProgress` or later | No | Cancellation not allowed -- materials already consumed |

Cancellation is initiated by the customer and processed immediately. For GCash/Maya payments, the refund is initiated via the `PaymentEndpoint.initiateRefund` method. The `cancellationReason` is stored on the order record, and the status change is logged in `order_status_history`.

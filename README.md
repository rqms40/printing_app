# GRID

**TAP TO PLOT. Simplified. Printing.**

A premium printing service delivery platform — paper and 3D printing as easy as ordering food delivery.

[![Mobile CI](https://github.com/rqms40/printing_app/actions/workflows/ci-mobile.yml/badge.svg)](https://github.com/rqms40/printing_app/actions/workflows/ci-mobile.yml)
[![Server CI](https://github.com/rqms40/printing_app/actions/workflows/ci-server.yml/badge.svg)](https://github.com/rqms40/printing_app/actions/workflows/ci-server.yml)

---

## Architecture

```mermaid
graph TB
    subgraph Clients
        A[Flutter Mobile App<br/>Customer / Driver / Admin]
        B[IoT Kiosk<br/>Future]
    end

    subgraph Backend
        C[NestJS API Server<br/>Port 3000]
        D[WebSocket Gateway<br/>Orders + Location]
    end

    subgraph Data
        E[(PostgreSQL)]
        F[Redis Cache]
        G[S3 / MinIO<br/>File Storage]
    end

    subgraph External
        H[OSRM<br/>Route Directions]
        I[PayMongo<br/>GCash / Maya]
        J[Firebase<br/>Push Notifications]
        K[OpenStreetMap<br/>Map Tiles]
    end

    A -->|REST + JWT| C
    A -->|WebSocket| D
    B -.->|MQTT| C
    C --> E
    C --> F
    C --> G
    D --> E
    A --> H
    A --> K
    C --> I
    C --> J
```

## User Flows

```mermaid
flowchart LR
    subgraph Customer
        C1[Browse] --> C2[Configure Specs]
        C2 --> C3[Upload File]
        C3 --> C4[Select Delivery]
        C4 --> C5[Pay<br/>GCash/Maya/COD]
        C5 --> C6[Track Order]
    end

    subgraph Admin
        A1[Dashboard<br/>KPIs + Charts] --> A2[Order Queue]
        A2 --> A3[Update Status]
        A3 --> A4[Assign Driver]
    end

    subgraph Driver
        D1[Receive Assignment] --> D2[Accept/Decline]
        D2 --> D3[Pick Up]
        D3 --> D4[Navigate + GPS]
        D4 --> D5[Deliver]
    end

    C5 --> A2
    A4 --> D1
    D4 --> C6
```

## Order Status Pipeline

```mermaid
stateDiagram-v2
    [*] --> OrderPlaced
    OrderPlaced --> FileVerified
    OrderPlaced --> FileDeclined
    OrderPlaced --> Cancelled

    FileVerified --> PrintingInProgress
    FileVerified --> Cancelled
    FileDeclined --> [*]

    PrintingInProgress --> FinishingMounting
    FinishingMounting --> QualityChecked
    QualityChecked --> ReadyForDispatch

    ReadyForDispatch --> DriverAssigned : Delivery
    ReadyForDispatch --> CompletedPickup : Pickup

    DriverAssigned --> PickedUp
    PickedUp --> OnTheWay
    OnTheWay --> ArrivedAtDestination
    ArrivedAtDestination --> Delivered

    Delivered --> [*]
    CompletedPickup --> [*]
    Cancelled --> [*]
```

## Project Structure

```
grid/
├── apps/
│   └── mobile/              # Flutter app (Customer, Driver, Admin)
│       ├── lib/
│       │   ├── config/      # Theme, routes, constants
│       │   ├── features/    # Feature-first modules
│       │   │   ├── auth/    # Login, register, profile
│       │   │   ├── customer/# Home, orders, notifications, tracking
│       │   │   ├── driver/  # Deliveries, active delivery, history
│       │   │   └── admin/   # Dashboard, queue, driver management
│       │   ├── shared/      # Widgets, models, providers, services
│       │   └── utils/       # Formatters, validators, pricing
│       └── test/            # 140 tests
│
├── server/                  # NestJS backend
│   ├── src/
│   │   ├── auth/            # JWT + Passport
│   │   ├── users/           # Profile management
│   │   ├── orders/          # CRUD + WebSocket
│   │   ├── addresses/       # Delivery addresses
│   │   ├── drivers/         # Assignments + GPS
│   │   ├── payments/        # PayMongo integration
│   │   ├── notifications/   # In-app + FCM
│   │   ├── files/           # File upload
│   │   ├── health/          # Health check + DB probe
│   │   └── common/          # Guards, filters, interfaces
│   ├── test/                # 48 tests
│   ├── docker-compose.yml   # PostgreSQL + Redis
│   ├── Dockerfile           # Multi-stage production build
│   └── .env.example         # Environment variables template
│
├── packages/
│   └── api-types/           # Shared API type definitions
│
├── docs/
│   ├── PRD.md               # Product Requirements (v3)
│   └── superpowers/         # Design specs + plans
│
├── .github/workflows/       # CI/CD (mobile + server + release)
├── Makefile                  # Common commands
└── README.md
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Mobile** | Flutter 3.41.6 + Dart 3.11.4 | Cross-platform app |
| **State** | Riverpod 2.6.1 | Reactive state management |
| **Navigation** | GoRouter 14.8.1 | Declarative routing with auth guards |
| **Maps** | flutter_map + OpenStreetMap | Free maps, no API key |
| **Routing** | OSRM | Free driving directions |
| **Icons** | HugeIcons + Material | 46K+ stroke-rounded icons |
| **Backend** | NestJS 11 + TypeScript | Modular REST + WebSocket API |
| **Database** | PostgreSQL 15 | Relational data |
| **Auth** | Passport.js + JWT | Stateless authentication |
| **Security** | Helmet + Throttler | HTTP headers + rate limiting |
| **Payments** | PayMongo | GCash, Maya, Card (Philippines) |
| **Real-time** | Socket.IO | Order tracking + driver GPS |
| **CI/CD** | GitHub Actions | Automated lint → test → build |
| **Container** | Docker | Production deployment |

## Quick Start

### Prerequisites

- Flutter 3.41.6 ([FVM](https://fvm.app) recommended)
- Node.js 20+ and npm
- Docker (for PostgreSQL)

### Development

```bash
# 1. Clone
git clone git@github.com:rqms40/printing_app.git
cd printing_app

# 2. Start database
cd server
cp .env.example .env
docker-compose up -d

# 3. Start API server
npm install
npm run seed        # Load demo data
npm run start:dev   # http://localhost:3000/docs (Swagger)

# 4. Start mobile app (new terminal)
cd apps/mobile
fvm flutter pub get
fvm flutter run
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Customer | maria@gridprint.ph | password123 |
| Driver | juan@gridprint.ph | password123 |
| Admin | admin@gridprint.ph | password123 |

> Dev bypass buttons on the login screen also work without a server.

## Testing

```bash
# Mobile (140 tests)
cd apps/mobile && fvm flutter test

# Server (48 tests)
cd server && npm test

# Lint
cd apps/mobile && fvm flutter analyze
cd server && npm run lint
```

## Deployment

### Docker (production)

```bash
cd server
docker-compose up -d --build  # Builds API + PostgreSQL + Redis
```

### Release APK

```bash
git tag v1.0.0
git push origin v1.0.0  # Triggers GitHub Actions → APK release
```

## Development Status

- [x] Phase 1: UI Shell (34 screens, 3 roles)
- [x] Phase 2: Local Logic (Hive drafts, dark mode, connectivity)
- [x] Phase 3: NestJS Backend (10 modules, 11 entities)
- [x] Phase 4: Flutter ↔ API Integration
- [x] CI/CD Pipelines
- [x] Test Suite (188 tests)
- [ ] Firebase FCM Push Notifications
- [ ] PayMongo Live Integration
- [ ] S3/R2 File Storage
- [ ] Production Deployment

## License

Proprietary — GRID Print Services

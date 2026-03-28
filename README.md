# GRID

**TAP TO PLOT. Simplified. Printing.**

A premium printing service delivery platform — paper and 3D printing as easy as ordering food delivery.

## Structure

```
grid/
├── apps/
│   └── mobile/          # Flutter app (Customer, Driver, Admin)
├── server/              # NestJS backend (not yet started)
├── packages/
│   └── api-types/       # Shared API type definitions
├── docs/
│   ├── PRD.md           # Product Requirements Document (v3)
│   └── superpowers/     # Design specs and implementation plans
└── .github/             # CI/CD workflows
```

## Apps

### Mobile (`apps/mobile/`)
Flutter app serving 3 roles:
- **Customer** — place print orders, track delivery, manage addresses
- **Driver** — accept deliveries, navigate, update checkpoints
- **Admin** — dashboard, order queue, driver assignment

```bash
cd apps/mobile
fvm flutter pub get
fvm flutter run
```

### Server (`server/`)
NestJS backend (Phase 3 — not yet started). Will provide:
- REST API + WebSocket for real-time updates
- PostgreSQL database
- JWT authentication
- PayMongo payment integration (GCash/Maya)
- MQTT transport for future IoT kiosks

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Flutter 3.41.6 + Dart 3.11.4 |
| State | Riverpod 2.6.1 |
| Maps | flutter_map + OpenStreetMap + OSRM |
| Backend | NestJS + TypeScript (planned) |
| Database | PostgreSQL 15+ (planned) |
| Payments | PayMongo (planned) |

## Development Status

- Phase 1: UI Shell — Complete
- Phase 2: Local Logic — Complete
- Phase 3: Backend — not started
- Phase 4: Integration — not started
- Phase 5: Production — not started

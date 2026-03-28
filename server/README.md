# GRID Server

NestJS backend for the GRID printing platform.

## Status: Not yet started (Phase 3)

## Planned Setup

```bash
# Install NestJS CLI
npm i -g @nestjs/cli

# Initialize project
nest new grid-server

# Start development
npm run start:dev

# Start PostgreSQL + Redis + MinIO
docker-compose up -d
```

## Architecture

```
src/
├── auth/           # JWT authentication (Passport.js)
├── users/          # User profile management
├── orders/         # Order lifecycle + WebSocket
├── drivers/        # Driver management + assignments
├── payments/       # PayMongo (GCash/Maya/Card)
├── notifications/  # FCM push notifications
├── files/          # S3 file upload
├── location/       # GPS tracking WebSocket
└── common/         # Guards, decorators, interceptors
```

## Tech Stack

- NestJS + TypeScript
- TypeORM + PostgreSQL
- Passport.js + JWT
- WebSocket Gateway
- MQTT Transport (IoT ready)
- PayMongo API
- Firebase Cloud Messaging

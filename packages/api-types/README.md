# GRIDGO API Types

Shared API type definitions between Flutter client and NestJS server.

## Status: Not yet started

## Purpose

Single source of truth for the API contract:
- OpenAPI/Swagger spec (`openapi.yaml`)
- Auto-generated Dart types (for Flutter)
- Auto-generated TypeScript types (for NestJS)

## Planned Structure

```
api-types/
├── openapi.yaml          # API specification
├── generated/
│   ├── dart/             # Generated Dart models
│   └── typescript/       # Generated TS interfaces
└── scripts/
    └── generate.sh       # Type generation script
```

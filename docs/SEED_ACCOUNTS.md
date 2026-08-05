# GRIDGO pilot seed accounts

Passwords come only from ignored `server/.env` — never commit them.

| Email | Name | Role | App | Password env |
|-------|------|------|-----|--------------|
| `maria@gridgo.ph` | Maria Santos | **client** | Mobile / Flutter | `GRIDGO_SEED_CUSTOMER_PASSWORD` |
| `supplier@gridgo.ph` | Demo Supplier | **supplier** | Mobile supplier shell or Admin portal | `GRIDGO_SEED_CUSTOMER_PASSWORD` |
| `juan@gridgo.ph` | Juan Reyes | **rider** | Mobile rider | `GRIDGO_SEED_RIDER_PASSWORD` |
| `admin@gridgo.ph` | Ops Admin | **ops_admin** | Admin dashboard (QA, matching, claims) | `GRIDGO_SEED_ADMIN_PASSWORD` |
| `superadmin@gridgo.ph` | Super Admin | **super_admin** | Admin (zones, verification, finance, audit) | `GRIDGO_SEED_ADMIN_PASSWORD` |

## Make logins work (local)

1. Ensure `server/.env` contains:

```env
GRIDGO_SEED_CUSTOMER_PASSWORD=...
GRIDGO_SEED_RIDER_PASSWORD=...
GRIDGO_SEED_ADMIN_PASSWORD=...
```

2. With API/Postgres running (Docker compose or local Postgres), reset roles + passwords without wiping the whole DB:

```powershell
cd server
# If Postgres is published on host port 5433 (docker-compose.dev.yml default):
$env:DATABASE_HOST="127.0.0.1"
$env:DATABASE_PORT="5433"
npm run seed:sync-logins
```

3. Log in with the emails above and the passwords you set in `.env`.

## Full reseed (wipes data)

```powershell
docker compose -f docker-compose.dev.yml down -v
$env:GRIDGO_PUBLIC_HOST="127.0.0.1"
docker compose --env-file server/.env -f docker-compose.dev.yml up --build
```

`seed:if-empty` only seeds when `users` is empty. If logins fail after schema upgrades, prefer `npm run seed:sync-logins`.

## Where each account can log in

| Role | Surface | Notes |
|------|---------|--------|
| client | Mobile | Customer shell (labeled Client) |
| supplier | Mobile `/supplier/jobs` **or** Admin | Admin rejects pure client/rider |
| rider | Mobile | Rider shell |
| ops_admin | Admin | Not mobile primary |
| super_admin | Admin | Super routes |

If admin says “Login Failed” for maria/juan: use **mobile**, not the admin web app.

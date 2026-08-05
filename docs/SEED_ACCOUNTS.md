# GRIDGO pilot seed accounts

Passwords come only from ignored `server/.env` — never commit them.

**Local default (after sync):** all accounts use **`password123`** when
`GRIDGO_SEED_CUSTOMER_PASSWORD`, `GRIDGO_SEED_RIDER_PASSWORD`, and
`GRIDGO_SEED_ADMIN_PASSWORD` are set to that value in `server/.env`.

| Email | Name | Role | App | Password env |
|-------|------|------|-----|--------------|
| `maria@gridgo.ph` | Maria Santos | **client** | Mobile / Flutter only | `GRIDGO_SEED_CUSTOMER_PASSWORD` |
| `supplier@gridgo.ph` | Demo Supplier | **supplier** | Mobile `/supplier/jobs` **or** Admin portal | `GRIDGO_SEED_CUSTOMER_PASSWORD` |
| `juan@gridgo.ph` | Juan Reyes | **rider** | Mobile rider only | `GRIDGO_SEED_RIDER_PASSWORD` |
| `admin@gridgo.ph` | Ops Admin | **ops_admin** | Admin dashboard (QA, matching, claims) | `GRIDGO_SEED_ADMIN_PASSWORD` |
| `superadmin@gridgo.ph` | Super Admin | **super_admin** | Admin (zones, verification, finance, audit) | `GRIDGO_SEED_ADMIN_PASSWORD` |

**Common mistakes**
- Logging into **Admin** as maria/juan → rejected (client/rider). Use mobile.
- Logging into **Admin** as superadmin works only if the admin app talks to the same API that was password-synced.
- After password change, re-run `npm run seed:sync-logins` in `server/`.

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

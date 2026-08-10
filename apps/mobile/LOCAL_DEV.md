# Mobile local run (see marketplace changes)

## 1. Start the API

From repo root (requires `server/.env` seed passwords):

```powershell
cd C:\Mobile_App\printing_app
$env:GRIDGO_PUBLIC_HOST="127.0.0.1"
docker compose --env-file server/.env -f docker-compose.dev.yml up --build
```

API: `http://127.0.0.1:3000` · Admin QA UI: `http://127.0.0.1:8189`

Prefer a **fresh DB** after marketplace migrations:

```powershell
docker compose -f docker-compose.dev.yml down -v
$env:GRIDGO_PUBLIC_HOST="127.0.0.1"
docker compose --env-file server/.env -f docker-compose.dev.yml up --build
```

## 2. Flutter run

```powershell
cd C:\Mobile_App\printing_app\apps\mobile
# Optional override file (gitignored if you keep secrets out of git):
# { "SERVER_URL": "http://127.0.0.1:3000" }

fvm flutter pub get
fvm flutter run --dart-define-from-file=dart_defines.json
```

Without `dart_defines.json`:

| Target | Default API |
|--------|-------------|
| Android emulator | `http://10.0.2.2:3000` |
| iOS Simulator / Windows desktop | `http://127.0.0.1:3000` |
| Chrome web | page host + port 3000 |

Confirm in console: `ApiConfig: API base: ...`

## 3. What you should see on mobile

Log in as **`maria@gridgo.ph`** (password = `GRIDGO_SEED_CUSTOMER_PASSWORD`).

| Area | Change |
|------|--------|
| Orders / timeline | Marketplace status labels (Needs QA, Proof approval, Matching, …) |
| Order detail | **Marketplace action required** card when status is correction / proof / awaiting payment |
| Profile → credits | **Pilot Credits** (grant-only wording, no Top Up purchase) |
| Checkout payment sheet | Pilot Credits labeling |

**Ops QA queue UI is not in Flutter** — open admin at `:8189` as `admin@gridgo.ph`.

## 4. Login failed?

- Stack not seeded or wrong password env
- Old DB without role migration → `down -v` and reseed
- Wrong `SERVER_URL` (physical phone needs LAN IP of the host, not `127.0.0.1`)

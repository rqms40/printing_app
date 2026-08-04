# Landing page local run (see marketplace messaging)

## Run

```powershell
cd C:\Mobile_App\printing_app\apps\Landing-page
npm ci
npm run dev
```

Default Vite URL: **http://127.0.0.1:5174** (see `vite.config.ts`).

## What you should see

Marketplace-oriented public copy (Davao managed print marketplace):

- Hero: **Request. Reviewed. Delivered.**
- Features: structured requests, artwork QA, verified suppliers, Pilot Credits & COD
- How it works: Request → QA & match → Pay & deliver

This page is marketing only — it does **not** call the Nest API. Client app / admin still need docker compose for backend.

## Content checks

```powershell
npm run test:support-copy
npm run test:community-cta
npm run test:video
```

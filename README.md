# BASE Wealth Dashboard (Next.js + React + TypeScript)

A modern, high-performance personal wealth and portfolio tracker built with Next.js 16 (App Router), React 19, TypeScript, and the Nocturne dark-theme design system.

## 🚀 Features

- **Dashboard Overview**: Live Net Worth tracking, YTD performance indicator, liquidity breakdown, and asset class distribution.
- **Platforms Grid**: Detailed tracking across all connected financial platforms (brokers, banks, wallets, exchanges) with drilldown inspection.
- **Assets Explorer**: Holdings table filterable by asset class, with delete.
- **Wealth Estimation Engine**: Interactive compound interest and wealth projection simulator with milestone tracking ($150k, $250k targets).
- **Historical Snapshots**: Net worth timeline curve and snapshot logging.
- **Add Asset Dialog**: Interactive modal backed by the API, with inline validation errors.

## 📐 Specs

New work follows spec-driven development: [`specs/`](specs/README.md) holds the product vision, the
cross-cutting decisions and one spec per phase (requirements with acceptance criteria, API contract,
design, tasks and tests) for both this repo and the backend. Each phase is implemented as its spec says.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Library**: [React](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Design System**: Nocturne Design Tokens (OKLCH, CSS Custom Properties, Ambient Glows)
- **Auth**: [Supabase Auth](https://supabase.com/) (email + password)
- **Backend**: [GM-Tomas/base_project_go](https://github.com/GM-Tomas/base_project_go) — Go REST
  API. All wealth data (holdings, platforms, snapshots, summary, projections) is served from
  there; nothing is persisted client-side.
- **Deployment**: [Vercel](https://vercel.com/) Ready

## 📦 Getting Started

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy the env template and fill in your values:
```bash
cp .env.example .env.local
```
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: from the Supabase project's
     Settings > API Keys. Sign-ups are disabled there: users are created from the Supabase dashboard
     (Authentication > Users > Add user) and can only sign in.
   - `NEXT_PUBLIC_API_BASE_URL`: where the backend is running. For local dev, clone and start
     [GM-Tomas/base_project_go](https://github.com/GM-Tomas/base_project_go) first (`go run
     ./cmd/api`, defaults to `http://localhost:8080`).

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser. Sign in with email/password —
   or, outside production builds, use the "Skip login (dev)" button to preview the UI without a
   session. That only works against a backend started with `AUTH_DEV_USER_ID` (requests without a token
   then act as that dev user); otherwise every request 401s, since the backend requires a real token.

## 🔍 Preview deployments (demo data)

Vercel preview deployments (every branch and pull request) run on **mock data**: a demo account is signed in
from the start, and every API call is answered in the browser with made-up holdings, platforms and snapshots
(`src/lib/mockApi.ts`, same rules as the API). Nothing is sent to Supabase or the API, so a preview never
touches production data and needs no environment variables; a "Demo data" tag marks it, and changes last until
the tab reloads. Every other build uses the real backend, whatever its variables say: `next.config.mjs` picks
the data source from Vercel's target environment (`VERCEL_TARGET_ENV`; a custom environment such as staging
has its own name there, so it isn't a preview). Locally, `NEXT_PUBLIC_DATA_SOURCE=mock npm run dev` shows the
same demo without a backend. The data source is fixed when a deployment is built, so production has to be built as
production (a push to `main`, or a redeploy to Production): a preview deployment pointed at production without a
rebuild (Vercel's REST promote endpoint doesn't rebuild) would keep its demo data until the next production build.

## 👥 Multiple users

Every person signs in with their own Supabase account and only ever sees and changes their own data:

- **Isolation is enforced by the backend**, which scopes every read and write to the signed-in user (the JWT's
  `sub`); the frontend never sends a user id. Two accounts can even use the same platform names.
- **Adding people:** sign-ups are off, so create each account in the Supabase dashboard (Authentication >
  Users > Add user). Nothing else to configure: a new account starts with an empty dashboard.
- **Switching accounts on one browser:** signing out (from the profile menu, or from the error screen if the
  API is unreachable) ends the session on this browser only — the user's other devices stay signed in — and
  drops all of the previous account's data from memory; the next account's dashboard is rebuilt from scratch
  with its own token, and a slow response for the previous account is discarded.
- **Session safety:** the Supabase client never adopts a session from the URL (`detectSessionInUrl: false`),
  so a crafted link can't silently sign someone into another account. A `401` from the API only signs out
  the session that was rejected, and only on this browser; if supabase-js refreshed the token meanwhile, the
  request is retried once (never on behalf of a different account).

### Tests

```bash
npm test                # vitest
npm run test:coverage   # fails below 85% (statements, branches, functions, lines)
```

Supabase and the backend (`fetch`) are the only things mocked; the rest of the app renders for real.

### Building for Production

```bash
npm run build
npm run start
```

## 🌐 Deploy to Vercel

This project is configured out of the box for zero-config deployment on Vercel.

1. Import this repository in the [Vercel Dashboard](https://vercel.com/new) — no Root Directory
   override needed, the app is already at the repo root.
2. Add the three env vars from `.env.example` under Project Settings > Environment Variables —
   `NEXT_PUBLIC_API_BASE_URL` must point at the deployed backend's **production** domain (deployment
   URLs are behind Vercel Authentication and would fail CORS), not `localhost`.
3. Click **Deploy** (and redeploy whenever a `NEXT_PUBLIC_*` value changes — they are inlined at build time).

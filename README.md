# BASE Wealth Dashboard (Next.js + React + TypeScript)

A modern, high-performance personal wealth and portfolio tracker built with Next.js 16 (App Router), React 19, TypeScript, and the Nocturne dark-theme design system.

## 🚀 Features

- **Dashboard Overview**: Live Net Worth tracking (what you own minus what you owe, with both underneath; in red
  when below zero), YTD performance indicator, liquidity breakdown, asset class distribution, and what you owe
  each month.
- **Platforms Grid**: Detailed tracking across all connected financial platforms (brokers, banks, wallets, exchanges) with drilldown inspection.
- **Assets Explorer**: search (accents and case ignored), class and platform filters, sortable columns, each
  asset's share of the total, its expected yearly return and a running total; edit or remove any asset from its
  row (removing asks first).
- **Expected returns**: say roughly how much each asset grows a year (when adding or editing it, or all at once,
  grouped by class with "Apply to class"). The dashboard shows the portfolio's return, weighted by value (assets
  without one count as 0%), what it would earn in a year and how much of the portfolio it's based on.
- **History**: pick a **period** (1M, 3M, 6M, YTD, 1Y, 3Y, All, or your own dates) and the chart (on a time
  axis, with the start value dashed and today's value at the end), the table, the figures and the activity all
  follow it. The figures: the change in $ and %, annualized (with 90 days or more), the high and low, the
  biggest drop from a high and the best and worst stretch. **Why it changed** splits the change into
  investments, saving, assets and debts added or removed, corrections, and what wasn't recorded. **Add a past
  checkpoint** from before BASE (the net worth, or what you owned and owed), marked as added by hand; delete
  any checkpoint (with confirmation), and the next one's change is recomputed by the API. After a month without
  one, History and the dashboard suggest saving a snapshot (dismissable for the day). Its **Activity** lists
  every recorded change in the period, newest first, filtered by kind (gains & losses, deposits &
  withdrawals, transfers, debts, added & removed, corrections) and by asset or debt. Each checkpoint shows the
  assets and debts behind its net worth.
- **Movements**: record a gain, loss, deposit or withdrawal on an asset, or **transfer** between assets and
  platforms (to an existing asset or a new one, with an optional fee), with a preview of the values after it.
  Editing a value asks what it was (a market move, money in or out, or a correction). Anything recorded can
  be undone, from its toast or from the activity.
- **Asset panel**: click an asset (in Assets or in a platform's holdings) to see it with its actions and its
  activity.
- **Debts**: cards, loans, a mortgage or money a friend lent you, with what's left to pay, the rate, the
  monthly payment and the due day. Each one says when it's paid off at its payment (or that it never is), and
  the tab sums it all up: what you owe, the monthly payments, the average rate (weighted by balance) and when
  you're debt-free. **Pay** a debt (from one of your assets, or not), record **new charges** (money that went
  into an asset, maybe) or **interest**, all undoable; editing the balance asks what changed it. Click a debt
  to see its terms, payoff and activity.
- **Wealth Estimation Engine**: projects the portfolio month by month at its expected return (or a growth of
  your own), with a monthly saving (a slider, or typed up to $1B), up to 50 years, milestones of your own (up to
  five), and, folded away, a yearly raise of the saving and inflation to see it in today's dollars. The chart has
  labeled axes and each year's figures on hover or with the arrow keys; below it, what the expected return is
  made of, by class and by asset. With debts, a second line shows the net worth as they're paid off, and the
  milestones are about it. How you leave it is saved for every device.
- **Settings**: your **asset classes** (create one before it has assets, rename it on all its assets, merge it
  into another, remove it moving its assets, and set its color, whether it counts as ready to spend and the
  return its assets without one of their own count with) and your **platforms** (a thumbnail of 1–2 letters or
  an emoji, a color, a type, and a rename or merge on all their assets). Colors and thumbnails show everywhere:
  the dashboard, Platforms, Assets, the asset panel and the platform pickers.
- **Add Asset Dialog**: amounts in any usual format (`1.234,56`, `1,234.56`, `$ 1234`) with a preview of how
  they were read; platform and class fields suggest the existing ones and say when a name is new.
- **Accessible dialogs and toasts** (`src/components/ui`): every dialog closes with Escape, keeps focus inside
  and gives it back; successful actions confirm with a toast.

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
from the start, and every API call is answered in the browser with made-up holdings, debts, platforms and
snapshots (`src/lib/mockApi.ts`, `src/lib/mockLedger.ts`, `src/lib/mockDebts.ts` and `src/lib/mockCustomization.ts`, same rules and messages as
the API, with some made-up activity that adds up to the demo's values). Nothing is sent to Supabase or the API, so a preview never
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

# BASE Wealth Dashboard (Next.js + React + TypeScript)

A modern, high-performance personal wealth and portfolio tracker built with Next.js 14 (App Router), React 18, TypeScript, and the Nocturne dark-theme design system.

## 🚀 Features

- **Dashboard Overview**: Live Net Worth tracking, YTD performance indicator, liquidity breakdown, and asset class distribution.
- **Platforms Grid**: Detailed tracking across all connected financial platforms (brokers, banks, wallets, exchanges) with drilldown inspection.
- **Assets Explorer**: Filterable multi-currency holdings table with 24h market movements.
- **Wealth Estimation Engine**: Interactive compound interest and wealth projection simulator with milestone tracking ($150k, $250k targets).
- **Historical Snapshots**: Net worth timeline curve and snapshot logging.
- **Multi-Currency**: Real-time USD / ARS switching with configurable exchange rates.
- **Add Asset Dialog**: Interactive modal backed by the API, with inline validation errors.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Library**: [React](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Design System**: Nocturne Design Tokens (OKLCH, CSS Custom Properties, Ambient Glows)
- **Auth**: [Supabase Auth](https://supabase.com/) (Google OAuth)
- **Backend**: `base_project/backend` — Spring Boot REST API (`specs/001-backend-para-frontend/`). All
  wealth data (holdings, platforms, snapshots, summary, projections) is served from there; nothing
  is persisted client-side.
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
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: from the Supabase project's
     Settings > API.
   - `NEXT_PUBLIC_API_BASE_URL`: where the backend is running. For local dev, start the backend
     first (`cd ../backend && ./gradlew bootRun`, defaults to `http://localhost:8080`).

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser. Sign in with Google —
   or, outside production builds, use the "Skip login (dev)" button to preview the UI without a
   session (every request will still 401 without a real token, since the backend requires one).

### Building for Production

```bash
npm run build
npm run start
```

## 🌐 Deploy to Vercel

This project is configured out of the box for zero-config deployment on Vercel.

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Import the project in the [Vercel Dashboard](https://vercel.com/new).
3. If deploying from the repository root, set **Root Directory** to `frontend`.
4. Add the three env vars from `.env.example` under Project Settings > Environment Variables —
   `NEXT_PUBLIC_API_BASE_URL` should point at the deployed backend (Render), not `localhost`.
5. Click **Deploy**.

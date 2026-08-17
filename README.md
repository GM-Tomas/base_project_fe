# BASE Wealth Dashboard (Next.js + React + TypeScript)

A modern, high-performance personal wealth and portfolio tracker built with Next.js 14 (App Router), React 18, TypeScript, and the Nocturne dark-theme design system.

## 🚀 Features

- **Dashboard Overview**: Live Net Worth tracking, YTD performance indicator, liquidity breakdown, and asset class distribution.
- **Platforms Grid**: Detailed tracking across all connected financial platforms (brokers, banks, wallets, exchanges) with drilldown inspection.
- **Assets Explorer**: Filterable multi-currency holdings table with 24h market movements.
- **Wealth Estimation Engine**: Interactive compound interest and wealth projection simulator with milestone tracking ($150k, $250k targets).
- **Historical Snapshots**: Net worth timeline curve and snapshot logging.
- **Multi-Currency**: Real-time USD / ARS switching with configurable exchange rates.
- **Add Asset Dialog**: Interactive modal with instant recalculation and `localStorage` persistence.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Library**: [React](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Design System**: Nocturne Design Tokens (OKLCH, CSS Custom Properties, Ambient Glows)
- **Deployment**: [Vercel](https://vercel.com/) Ready

## 📦 Getting Started

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

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
4. Click **Deploy**.

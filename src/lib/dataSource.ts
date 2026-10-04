// Where the app's data comes from. 'mock': made-up data kept in this browser tab, with a demo account
// signed in from the start; nothing is sent to Supabase or the API. next.config.mjs sets it per build:
// always on Vercel previews, never in any other production build, opt-in in local development.
// api.ts and supabaseClient.ts spell the same check out instead of importing this: an imported flag
// leaves the mock API and its data in production bundles. mockData.test.tsx keeps the three in step.
export const usesMockData = process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock';

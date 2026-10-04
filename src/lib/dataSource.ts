// Where the app's data comes from. 'mock': made-up data kept in this browser tab, with a demo account
// signed in from the start; nothing is sent to Supabase or the API. next.config.mjs sets it per build:
// always on Vercel previews, never in any other production build, opt-in in local development.
export const usesMockData = process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock';

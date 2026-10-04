// Where the app's data comes from. 'mock': made-up data kept in this browser tab, with a demo account
// signed in from the start; nothing is sent to Supabase or the API. next.config.mjs sets it per build:
// always on Vercel previews, never in production, opt-in elsewhere (NEXT_PUBLIC_DATA_SOURCE=mock).
export const usesMockData = process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock';

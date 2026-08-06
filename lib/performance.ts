export const LIVE_MATCHES_INITIAL_VISIBLE = 8;
export const LIVE_MATCHES_MOBILE_INITIAL_VISIBLE = 3;
export const LIVE_MATCHES_SHOW_MORE_STEP = 8;
export const LIVE_MATCHES_MOBILE_SHOW_MORE_STEP = 3;
export const LIVE_MATCHES_MAX_VISIBLE = 200;
/** Internal pool tracked for backfill / exit swaps (not all rendered). */
export const LIVE_MATCHES_POOL_CAP = 24;
export const LIVE_MATCH_EXIT_FADE_MS = 1400;
export const LIVE_MATCH_EXIT_SWAP_MS = 700;
export const LOBBY_CLOCK_MS = 1000;
export const PLAYING_CLOCK_MS = 250;
export const LIVE_MATCHES_SYNC_MS = 650;
export const LOBBY_SNAPSHOT_THROTTLE_MS = 2500;

/** Lite mode is always on — reduces animations and live-feed payload. */
export const PERF_LITE = true;

export const getLiveMatchesPoolCap = () => LIVE_MATCHES_POOL_CAP;

export const getLiveMatchesInitialVisible = (isMobile: boolean) =>
  isMobile ? LIVE_MATCHES_MOBILE_INITIAL_VISIBLE : LIVE_MATCHES_INITIAL_VISIBLE;

export const getLiveMatchesShowMoreStep = (isMobile: boolean) =>
  isMobile ? LIVE_MATCHES_MOBILE_SHOW_MORE_STEP : LIVE_MATCHES_SHOW_MORE_STEP;

export const getCoinShowerCount = () => 0;

export const getReferralCoinCount = () => 0;

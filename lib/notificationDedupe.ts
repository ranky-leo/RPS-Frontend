const SILENT_MATCH_RELEASE_REASONS = new Set([
  "user_cancelled",
  "stale_match_cleanup",
  "server_restart_cleanup",
]);

const MATCH_RELEASE_MESSAGES: Record<string, string> = {
  inactive_no_selection: "Match ended because no move was selected in time.",
  disconnect_timeout_waiting: "Match search ended after you disconnected.",
};

export const shouldNotifyMatchRelease = (reason: string) =>
  !SILENT_MATCH_RELEASE_REASONS.has(reason);

export const formatMatchReleaseMessage = (reason: string) =>
  MATCH_RELEASE_MESSAGES[reason] || `Match ended: ${reason.replaceAll("_", " ")}`;

export function createNotificationDeduper() {
  const seen = new Set<string>();

  return {
    once(key: string, action: () => void) {
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      action();
      return true;
    },
    reset() {
      seen.clear();
    },
  };
}

export const notificationKeys = {
  queueStarted: (matchId: string) => `queue:${matchId}`,
  queueCancelled: (matchId: string) => `cancelled:${matchId}`,
  matchConnected: (matchId: string) => `connected:${matchId}`,
  matchReleased: (matchId: string) => `released:${matchId}`,
  matchFinished: (matchId: string) => `finished:${matchId}`,
  moveSubmitted: (matchId: string, roundNumber: number) =>
    `move:${matchId}:${roundNumber}`,
};

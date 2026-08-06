"use client";

import { memo } from "react";
import { formatRac, formatRafc } from "../../lib/currency";
import { DEFAULT_AVATAR, resolveAvatar } from "../../lib/avatars";
import { UserAvatar } from "../UserAvatar";
import type { ProfileNotificationType } from "../../hooks/useProfileNotifications";
import type { LobbySnapshot, MatchLedger } from "../../lib/types";
import { SeasonalRankPanel } from "./SeasonalRankPanel";

const formatWinnerPayout = (payout: number, ledger?: MatchLedger) =>
  ledger === "free"
    ? `+${formatRafc(payout)}`
    : `+${formatRac(payout)}`;

function WinnersTrophyIcon() {
  return (
    <span className="winnersHeadingIconShell" aria-hidden="true">
      <svg className="winnersHeadingIconSvg" viewBox="0 0 24 24" fill="none">
        <path
          d="M8.2 4h7.6l.9 3.6H7.3L8.2 4Z"
          fill="currentColor"
        />
        <path
          d="M7.3 7.6h9.4c0 3.4-1.4 5.8-4.7 6.8-3.3-1-4.7-3.4-4.7-6.8Z"
          fill="currentColor"
        />
        <path
          d="M10.2 14.4h3.6v2.2H10.2V14.4Z"
          fill="currentColor"
          opacity="0.92"
        />
        <path d="M9.1 16.6h5.8v2.4H9.1V16.6Z" fill="currentColor" />
        <path
          d="M6.8 7.8H5.2c0 1.8.9 3 2.3 3.6M17.2 7.8h1.6c0 1.8-.9 3-2.3 3.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

type RealtimeFeedPanelProps = {
  recentWinnerItems: NonNullable<LobbySnapshot["recentWinners"]>;
  showHistory?: boolean;
  showSeasonalRank?: boolean;
  isAuthenticated?: boolean;
  viewerUserId?: string | null;
  onNotify?: (message: string, type?: ProfileNotificationType) => void;
};

export const RealtimeFeedPanel = memo(function RealtimeFeedPanel({
  recentWinnerItems,
  showHistory = true,
  showSeasonalRank = true,
  isAuthenticated = false,
  viewerUserId = null,
  onNotify,
}: RealtimeFeedPanelProps) {
  return (
    <div className="leftRealtimePanel">
      {showSeasonalRank ? (
        <SeasonalRankPanel
          isAuthenticated={isAuthenticated}
          viewerUserId={viewerUserId}
          onNotify={onNotify}
        />
      ) : null}
      <div className="leftRealtimeSection winnersChannel">
        <p className="guideEyebrow realtimeHeading winnersHeading">
          <WinnersTrophyIcon />
          <span>Recent Winners</span>
        </p>
        <div
          className={`leftRealtimeList${!showHistory || recentWinnerItems.length === 0 ? " isEmpty" : ""}`}
        >
          {!showHistory || recentWinnerItems.length === 0 ? (
            <div className="statusEmpty">
              <div className="statusEmptyText">No recent winners yet.</div>
              <div className="statusEmptyVisual">
                <div className="statusEmptyImageGlow winnerGlow" aria-hidden />
                <img
                  className="statusEmptyImage winnerEmptyImage"
                  src="/winner_empty.png"
                  alt="No winners yet"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          ) : (
            recentWinnerItems.map((winner) => {
              const ledger: MatchLedger =
                winner.ledger === "free" ? "free" : "rac";

              return (
              <div className="leftRealtimeRow" key={winner.id}>
                <div className="leftRealtimeMain">
                  <UserAvatar
                    avatar={winner.avatar || DEFAULT_AVATAR}
                    alt={winner.username}
                    className="statusAvatar"
                    loading="lazy"
                  />
                  <strong>{winner.username}</strong>
                </div>
                <div
                  className={`leftRealtimeMeta win${ledger === "free" ? " win--rac" : " win--usdt"}`}
                >
                  <span className="leftRealtimeWinType">
                    {ledger === "free" ? "RAC" : "USDT"}
                  </span>
                  <span>{formatWinnerPayout(Number(winner.payout || 0), ledger)}</span>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});

export default RealtimeFeedPanel;

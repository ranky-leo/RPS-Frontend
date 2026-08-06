"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { formatRac, formatRafc } from "../../lib/currency";
import { DEFAULT_AVATAR } from "../../lib/avatars";
import { UserAvatar } from "../UserAvatar";
import type { ProfileNotificationType } from "../../hooks/useProfileNotifications";
import type { SeasonalRankEntry, SeasonalRankResponse } from "../../lib/types";
import {
  SeasonalCompensationGuideButton,
  SeasonalCompensationGuideModal,
} from "./SeasonalCompensationGuideModal";

type SeasonalRankPanelProps = {
  isAuthenticated?: boolean;
  viewerUserId?: string | null;
  onNotify?: (message: string, type?: ProfileNotificationType) => void;
};

const formatCountdown = (resetAt: number, now: number) => {
  const remainingMs = Math.max(0, resetAt - now);
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m left`;
  }

  return `${hours}h ${minutes}m left`;
};

const formatRp = (value: number) =>
  `${Math.max(0, Number(value) || 0).toLocaleString()} RP`;

const formatViewerRank = (
  seasonActive: boolean,
  rank: number | null | undefined,
) => {
  if (!seasonActive || !rank || rank <= 0) {
    return "#0";
  }

  return `#${rank}`;
};

function RankingsIcon() {
  return (
    <img
      src="/shield.png"
      alt=""
      className="seasonalRankHeadingIconImg"
      loading="lazy"
      decoding="async"
      aria-hidden="true"
    />
  );
}

function RankCupIcon({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";

  if (!tone) {
    return null;
  }

  return (
    <span
      className={`seasonalRankCup seasonalRankCup--${tone}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M8.2 4h7.6l.9 3.6H7.3L8.2 4Z" fill="currentColor" />
        <path
          d="M7.3 7.6h9.4c0 3.4-1.4 5.8-4.7 6.8-3.3-1-4.7-3.4-4.7-6.8Z"
          fill="currentColor"
        />
        <path d="M10.2 14.4h3.6v2.2H10.2V14.4Z" fill="currentColor" />
        <path d="M9.1 16.6h5.8v2.4H9.1V16.6Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function RankRewards({
  rank,
  reward,
}: {
  rank: number;
  reward: Pick<SeasonalRankEntry, "rewardUsdt" | "rewardRac">;
}) {
  const { rewardUsdt, rewardRac } = reward;

  if (rewardUsdt <= 0 && rewardRac <= 0) {
    return (
      <span className="seasonalRankReward seasonalRankReward--empty">—</span>
    );
  }

  return (
    <span className="seasonalRankRewards">
      {rewardUsdt > 0 ? (
        <span className="seasonalRankReward seasonalRankReward--paid">
          <RankCupIcon rank={rank} />
          <span>+{formatRac(rewardUsdt)}</span>
        </span>
      ) : null}
      {rewardRac > 0 ? (
        <span className="seasonalRankReward seasonalRankReward--free">
          {rewardUsdt <= 0 ? <RankCupIcon rank={rank} /> : null}
          <span>+{formatRafc(rewardRac)}</span>
        </span>
      ) : null}
    </span>
  );
}

function RankRow({ entry }: { entry: SeasonalRankEntry }) {
  return (
    <div
      className={`seasonalRankRow${entry.rank === 1 ? " seasonalRankRow--first" : ""}`}
    >
      <span className="seasonalRankPosition">{entry.rank}</span>
      <UserAvatar
        avatar={entry.avatar || DEFAULT_AVATAR}
        alt={entry.username}
        className="seasonalRankAvatar"
        loading="lazy"
      />
      <div className="seasonalRankIdentity">
        <strong className="seasonalRankName">
          {entry.username}
          {entry.rank === 1 ? (
            <span className="seasonalRankCrown" aria-hidden="true">
              👑
            </span>
          ) : null}
        </strong>
        <span className="seasonalRankPoints">{formatRp(entry.rp)}</span>
      </div>
      <RankRewards rank={entry.rank} reward={entry} />
    </div>
  );
}

function RankMoreIndicator() {
  return (
    <div className="seasonalRankMore" aria-label="More players ranked below">
      <span className="seasonalRankMoreDot" aria-hidden="true" />
      <span className="seasonalRankMoreDot" aria-hidden="true" />
      <span className="seasonalRankMoreDot" aria-hidden="true" />
    </div>
  );
}

export const SeasonalRankPanel = memo(function SeasonalRankPanel({
  isAuthenticated = false,
  viewerUserId = null,
  onNotify,
}: SeasonalRankPanelProps) {
  const [payload, setPayload] = useState<SeasonalRankResponse | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const loadErrorNotifiedRef = useRef(false);

  const loadRankings = useCallback(async () => {
    try {
      const data = await api.seasonalRank();
      setPayload(data);
      setLoadError(false);
      loadErrorNotifiedRef.current = false;
    } catch {
      setLoadError(true);
      if (!loadErrorNotifiedRef.current) {
        loadErrorNotifiedRef.current = true;
        onNotify?.("Could not load rankings.", "error");
      }
    }
  }, [onNotify]);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    void loadRankings();
  }, [loadRankings, viewerUserId]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      void loadRankings();
    }, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadRankings]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [mounted]);

  const countdownLabel = useMemo(() => {
    if (!mounted || now == null || !payload?.resetAt) {
      return null;
    }

    if (payload.seasonActive) {
      return formatCountdown(payload.resetAt, now);
    }

    return `Starts in ${formatCountdown(payload.resetAt, now).replace(" left", "")}`;
  }, [payload, mounted, now]);

  const seasonTitle = payload?.seasonNumber
    ? `Season ${payload.seasonNumber} Rankings`
    : "Seasonal Rankings";

  return (
    <div className="seasonalRankPanel leftRealtimeSection">
      <div className="seasonalRankHeader">
        <div className="seasonalRankHeaderMain">
          <RankingsIcon />
          <p className="guideEyebrow realtimeHeading seasonalRankHeading">
            <span>{seasonTitle}</span>
          </p>
        </div>
        <div className="seasonalRankHeaderActions">
          <SeasonalCompensationGuideButton onClick={() => setGuideOpen(true)} />
          {countdownLabel ? (
            <span className="seasonalRankCountdown">{countdownLabel}</span>
          ) : null}
        </div>
      </div>

      <SeasonalCompensationGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        seasonData={payload}
      />

      <div className="seasonalRankBody">
        {!payload ? (
          <div className="seasonalRankEmpty">
            {loadError ? "Could not load rankings." : "Loading rankings…"}
          </div>
        ) : payload.seasonActive ? (
          payload.topTen.length > 0 ? (
            <div className="seasonalRankList">
              {payload.topTen.map((entry) => (
                <RankRow key={entry.userId} entry={entry} />
              ))}
              {payload.hasMoreRankedPlayers ? <RankMoreIndicator /> : null}
            </div>
          ) : (
            <div className="seasonalRankEmpty">
              No ranked players yet. Earn RAC to climb the board.
            </div>
          )
        ) : payload.activeSetting === "on" && payload.resetAt ? (
          <div className="seasonalRankEmpty">
            The next season begins soon. Earn RAC to climb the board once it
            starts.
          </div>
        ) : (
          <div className="seasonalRankEmpty">
            Seasonal competition is currently paused.
          </div>
        )}

        {isAuthenticated && payload ? (
          <div className="seasonalRankViewer">
            <div className="seasonalRankViewerLabel">Your Rank</div>
            <div className="seasonalRankViewerMain">
              <span className="seasonalRankViewerRank">
                {formatViewerRank(payload.seasonActive, payload.viewer?.rank)}
              </span>
              <div className="seasonalRankViewerTrailing">
                <span className="seasonalRankViewerPoints">
                  {formatRp(payload.seasonActive ? payload.viewer?.rp || 0 : 0)}
                </span>
                <img
                  src="/shield.png"
                  alt=""
                  className="seasonalRankViewerShieldImg"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default SeasonalRankPanel;

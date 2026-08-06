"use client";

import { useEffect, useMemo, useState } from "react";
import { formatRac, formatRafc } from "../../lib/currency";
import { DEFAULT_AVATAR } from "../../lib/avatars";
import { UserAvatar } from "../UserAvatar";
import type {
  SeasonalRankCompletedSeason,
  SeasonalRankResponse,
  SeasonRewardAmounts,
} from "../../lib/types";
import { normalizeRewardsByRank } from "../../lib/seasonRewards";

type SeasonalCompensationGuideModalProps = {
  open: boolean;
  onClose: () => void;
  seasonData: SeasonalRankResponse | null;
};

type GuideTab = "guide" | "season" | "history";

const GUIDE_STEPS = [
  {
    title: "Earn rank points (RP)",
    body: "During an active season, every RAC you earn also adds the same amount of RP to your seasonal balance.",
  },
  {
    title: "Climb the leaderboard",
    body: "Players with the highest RP appear in the seasonal rankings. The panel shows the current top 10.",
  },
  {
    title: "Reach the payout ranks",
    body: "When the season ends, the top 10 players receive seasonal compensation based on their final rank.",
  },
  {
    title: "Collect your reward",
    body: "Season rewards are credited automatically to your account. USDT goes to your USDT balance and RAC goes to your RAC balance.",
  },
];

const GUIDE_NOTES = [
  "Each season runs for about one week.",
  "The countdown shows how much time is left in the current season.",
  "Your Rank at the bottom tracks your position and RP.",
  "RP resets when a new season begins.",
];

const formatSeasonPeriod = (
  startAt: number | null | undefined,
  endAt: number | null | undefined,
  timeZone: string,
) => {
  if (!startAt || !endAt) {
    return "Season dates are not available yet.";
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatter.format(startAt)} – ${formatter.format(endAt)}`;
};

function SeasonRewardValues({
  reward,
  className = "",
}: {
  reward: SeasonRewardAmounts;
  className?: string;
}) {
  if (reward.usdt <= 0 && reward.rac <= 0) {
    return (
      <span
        className={`seasonalCompensationGuideRewardValue seasonalCompensationGuideRewardValue--none ${className}`.trim()}
      >
        —
      </span>
    );
  }

  return (
    <span className={`seasonalCompensationGuideRewardValues ${className}`.trim()}>
      {reward.usdt > 0 ? (
        <span className="seasonalCompensationGuideRewardValue seasonalCompensationGuideRewardValue--paid">
          {formatRac(reward.usdt)}
        </span>
      ) : null}
      {reward.rac > 0 ? (
        <span className="seasonalCompensationGuideRewardValue seasonalCompensationGuideRewardValue--free">
          {formatRafc(reward.rac)}
        </span>
      ) : null}
    </span>
  );
}

function RewardTable({
  rewardsByRank,
}: {
  rewardsByRank: Record<string, SeasonRewardAmounts>;
}) {
  const rows = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const rank = index + 1;
        const reward = rewardsByRank[String(rank)] ?? { usdt: 0, rac: 0 };
        return { rank, reward };
      }),
    [rewardsByRank],
  );
  return (
    <div className="seasonalCompensationGuideRewardTable">
      {rows.map((row) => (
        <div key={row.rank} className="seasonalCompensationGuideRewardRow">
          <span className="seasonalCompensationGuideRewardRank">#{row.rank}</span>
          <SeasonRewardValues reward={row.reward} />
        </div>
      ))}
    </div>
  );
}

function SeasonalCompensationGuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 17.2v.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M12 14v-2.4c0-1.45 2.2-1.55 2.2-3.1a2.2 2.2 0 1 0-4.4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SeasonalCompensationGuideButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="seasonalRankGuideBtn"
      onClick={onClick}
      aria-label="Open seasonal compensation guide"
    >
      <SeasonalCompensationGuideIcon />
    </button>
  );
}

function CompletedSeasonCard({
  season,
  timeZone,
}: {
  season: SeasonalRankCompletedSeason;
  timeZone: string;
}) {
  const title = season.seasonNumber
    ? `Season ${season.seasonNumber}`
    : "Completed Season";

  return (
    <section className="seasonalCompensationGuideHistoryCard">
      <div className="seasonalCompensationGuideHistoryHead">
        <strong>{title}</strong>
        <span>{formatSeasonPeriod(season.startAt, season.endAt, timeZone)}</span>
      </div>

      {season.winners.length > 0 ? (
        <div className="seasonalCompensationGuideHistoryWinners">
          {season.winners.map((winner) => (
            <div
              key={`${season.id}-${winner.rank}`}
              className="seasonalCompensationGuideHistoryWinner"
            >
              <span className="seasonalCompensationGuideHistoryRank">
                #{winner.rank}
              </span>
              <UserAvatar
                avatar={winner.avatar || DEFAULT_AVATAR}
                alt={winner.username}
                className="seasonalCompensationGuideHistoryAvatar"
                loading="lazy"
              />
              <span className="seasonalCompensationGuideHistoryName">
                {winner.username}
              </span>
              <SeasonRewardValues
                reward={{
                  usdt: winner.rewardUsdt,
                  rac: winner.rewardRac,
                }}
                className="seasonalCompensationGuideHistoryReward"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="seasonalCompensationGuideEmpty">
          No reward winners were recorded for this season.
        </p>
      )}
    </section>
  );
}

export function SeasonalCompensationGuideModal({
  open,
  onClose,
  seasonData,
}: SeasonalCompensationGuideModalProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>("guide");

  useEffect(() => {
    if (!open) {
      setActiveTab("guide");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const timeZone = seasonData?.resetTimeZone || "UTC";
  const seasonStatus = seasonData?.seasonActive
    ? "Active now"
    : seasonData?.activeSetting === "on" && seasonData.resetAt
      ? "Starting soon"
      : "Paused";

  return (
    <div
      className="backdrop guideVideoBackdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal guideVideoModal seasonalCompensationGuideModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seasonal-compensation-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guideVideoModalTop">
          <div>
            <div
              className="guideVideoModalTitle"
              id="seasonal-compensation-guide-title"
            >
              Seasonal Compensation Guide
            </div>
            <div className="guideVideoModalSubtitle">
              Compete each season for leaderboard rewards and end-of-season
              payouts.
            </div>
          </div>
          <button
            className="guideVideoCloseBtn"
            type="button"
            onClick={onClose}
            aria-label="Close seasonal compensation guide"
          >
            ✕
          </button>
        </div>

        <div
          className="seasonalCompensationGuideTabs"
          role="tablist"
          aria-label="Seasonal compensation guide sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "guide"}
            className={`seasonalCompensationGuideTab${activeTab === "guide" ? " active" : ""}`}
            onClick={() => setActiveTab("guide")}
          >
            Guide
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "season"}
            className={`seasonalCompensationGuideTab${activeTab === "season" ? " active" : ""}`}
            onClick={() => setActiveTab("season")}
          >
            This Season
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`seasonalCompensationGuideTab${activeTab === "history" ? " active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
        </div>

        <div className="seasonalCompensationGuideBody">
          {activeTab === "guide" ? (
            <>
              <section className="seasonalCompensationGuideHero">
                <span
                  className="seasonalCompensationGuideHeroIcon"
                  aria-hidden="true"
                >
                  <img src="/shield.png" alt="" loading="lazy" decoding="async" />
                </span>
                <div>
                  <h3>How seasonal compensation works</h3>
                  <p>
                    Seasons are competitive weekly cycles. Earn RAC during a season
                    to build RP, rise through the rankings, and qualify for
                    top-10 compensation when the season closes.
                  </p>
                </div>
              </section>

              <ol className="seasonalCompensationGuideSteps">
                {GUIDE_STEPS.map((step, index) => (
                  <li key={step.title} className="seasonalCompensationGuideStep">
                    <span className="seasonalCompensationGuideStepNum">
                      {index + 1}
                    </span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <section className="seasonalCompensationGuideNotes">
                <h3>Good to know</h3>
                <ul>
                  {GUIDE_NOTES.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          {activeTab === "season" ? (
            <>
              <section className="seasonalCompensationGuideSeasonCard">
                <div className="seasonalCompensationGuideSeasonHead">
                  <h3>
                    {seasonData?.seasonNumber
                      ? `Season ${seasonData.seasonNumber}`
                      : "Current Season"}
                  </h3>
                  <span
                    className={`seasonalCompensationGuideSeasonStatus seasonalCompensationGuideSeasonStatus--${seasonData?.seasonActive ? "active" : "idle"}`}
                  >
                    {seasonStatus}
                  </span>
                </div>
                <p className="seasonalCompensationGuideSeasonPeriod">
                  {formatSeasonPeriod(
                    seasonData?.startAt,
                    seasonData?.endAt,
                    timeZone,
                  )}
                </p>
                <p className="seasonalCompensationGuideSeasonHint">
                  Top 10 players at season end receive the rewards below.
                </p>
              </section>

              <section className="seasonalCompensationGuideRewardsSection">
                <h3>Season rewards</h3>
                {seasonData?.rewardsByRank ? (
                  <RewardTable
                    rewardsByRank={normalizeRewardsByRank(
                      seasonData.rewardsByRank,
                    )}
                  />
                ) : (
                  <p className="seasonalCompensationGuideEmpty">
                    Reward details are not available yet.
                  </p>
                )}
              </section>
            </>
          ) : null}

          {activeTab === "history" ? (
            <>
              {seasonData?.completedSeasons?.length ? (
                seasonData.completedSeasons.map((season) => (
                  <CompletedSeasonCard
                    key={season.id}
                    season={season}
                    timeZone={timeZone}
                  />
                ))
              ) : (
                <p className="seasonalCompensationGuideEmpty">
                  No completed seasons yet. Winners will appear here after the
                  first season ends.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

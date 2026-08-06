"use client";

import { memo, useMemo } from "react";
import type { Match } from "../../lib/types";
import { formatRac, formatRafc, formatSignedRac } from "../../lib/currency";

const MOVE_EMOJI: Record<string, string> = {
  rock: "✊",
  paper: "🖐️",
  scissors: "✌️",
};

type LiveMatchCardProps = {
  match: Match;
  nowSec: number;
  isExiting: boolean;
  avatar1Url: string;
  avatar2Url: string;
};

const fmt = formatRac;

const clampScore = (value: unknown) =>
  Math.max(0, Math.min(2, Math.floor(Number(value) || 0)));

const resolveRoundWinnerSide = (
  leftMove?: string | null,
  rightMove?: string | null,
) => {
  if (!leftMove || !rightMove || leftMove === rightMove) {
    return null;
  }

  if (
    (leftMove === "rock" && rightMove === "scissors") ||
    (leftMove === "paper" && rightMove === "rock") ||
    (leftMove === "scissors" && rightMove === "paper")
  ) {
    return "left";
  }

  return "right";
};

function LiveMatchCardComponent({
  match,
  nowSec,
  isExiting,
  avatar1Url,
  avatar2Url,
}: LiveMatchCardProps) {
  const cd = useMemo(() => {
    if (!match.countdownEndsAt) {
      return null;
    }
    return Math.max(
      0,
      Math.ceil((match.countdownEndsAt - nowSec * 1000) / 1000),
    );
  }, [match.countdownEndsAt, nowSec]);

  const showCountdown =
    cd !== null && ["countdown_5", "countdown_20"].includes(match.stage);
  const showRoundReveal =
    !showCountdown &&
    match.state !== "finished" &&
    match.stage === "reveal" &&
    Boolean(match.round?.revealed);
  const showResultReactions =
    !showCountdown && !showRoundReveal && match.state === "finished";
  const stageIsIntro = match.stage === "intro";
  const roundLabel = stageIsIntro
    ? "Get Ready"
    : `Round ${Math.min(3, Math.max(1, match.roundNumber))}`;
  const move1Locked = Boolean(match.round?.move1);
  const move2Locked = Boolean(match.round?.move2);
  const revealMoves = Boolean(match.round?.revealed);
  const showRevealedCards = revealMoves || match.state === "finished";
  const isWinner1 =
    match.state === "finished" && match.winnerUserId === match.userId1;
  const isWinner2 =
    match.state === "finished" && match.winnerUserId === match.userId2;
  const displayScore1 =
    match.state === "finished" && isWinner1 ? 2 : clampScore(match.score1);
  const displayScore2 =
    match.state === "finished" && isWinner2 ? 2 : clampScore(match.score2);

  const roundWinnerName = useMemo(() => {
    if (!showRoundReveal) {
      return null;
    }

    const winnerSide = resolveRoundWinnerSide(
      match.round?.move1,
      match.round?.move2,
    );

    if (!winnerSide) {
      return "Draw";
    }

    return winnerSide === "left"
      ? match.username1 || "Player 1"
      : match.username2 || "Player 2";
  }, [
    showRoundReveal,
    match.round?.move1,
    match.round?.move2,
    match.username1,
    match.username2,
  ]);

  const ledger = match.ledger === "free" ? "free" : "rac";
  const stakeLabel =
    ledger === "free" ? `${formatRafc(match.price)}` : `${fmt(match.price)}`;

  return (
    <div
      className={`matchCard liveMatchMatch liveMatchMatch--${ledger === "free" ? "rafc" : "rac"}${match.state === "finished" ? " matchFinished" : ""}${isExiting ? " matchExiting" : ""} perfLiteCard`}
    >
      <div className="liveMatchTypeBand" aria-label={`${stakeLabel} match`}>
        <span className="liveMatchTypeBandLabel">{stakeLabel}</span>
      </div>

      <div className="matchTopRow matchTopRow--liveFeed">
        <span className="roundBadge">{roundLabel}</span>
      </div>

      <div
        className={`countdownRow liveBasicCountdown${!showCountdown && !showRoundReveal && !showResultReactions ? " isPlaceholder" : ""}`}
      >
        {showCountdown ? (
          <>
            <span>Time left</span>
            <span
              className={`countdownNum${cd !== null && cd <= 3 ? " urgent" : ""}`}
            >
              {cd}
            </span>
            <span>s</span>
          </>
        ) : showRoundReveal ? (
          <>
            <span>Round winner</span>
            <span
              className={`liveRoundWinnerName${roundWinnerName === "Draw" ? " isDraw" : ""}`}
              title={roundWinnerName || undefined}
            >
              {roundWinnerName}
            </span>
          </>
        ) : showResultReactions ? (
          <div className="liveFinishReactions">
            <span
              className={`liveFinishReaction${isWinner1 ? " winner" : " loser"}`}
            >
              {isWinner1 ? "🥰 😄" : "🤬"}
            </span>
            <span className="liveFinishReactionDivider">•</span>
            <span
              className={`liveFinishReaction${isWinner2 ? " winner" : " loser"}`}
            >
              {isWinner2 ? "🥰 😄" : "🤬"}
            </span>
          </div>
        ) : (
          <>
            <span>Time left</span>
            <span className="countdownNum">--</span>
            <span>s</span>
          </>
        )}
      </div>

      <div className="liveBasicPlayers">
        <div className={`liveBasicPlayer${isWinner1 ? " isWinner" : ""}`}>
          {isWinner1 && <span className="liveWinnerBadge">🏆 Victory</span>}
          <img
            className={`statusAvatar${isWinner1 ? " winnerGlowLite" : ""}`}
            src={avatar1Url}
            alt={match.username1 || "Player 1"}
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
          />
          <strong className="liveBasicName">
            {match.username1 || "Player 1"}
          </strong>
          <span className="liveBasicScore">Score {displayScore1}</span>
          {isWinner1 && match.state === "finished" && (
            <span className="liveWinnerPayout">
              {ledger === "free"
                ? formatRafc(match.winnerPayout || 0)
                : formatSignedRac(match.winnerPayout || 0)}
            </span>
          )}
        </div>
        <span className="liveBasicVs">VS</span>
        <div className={`liveBasicPlayer${isWinner2 ? " isWinner" : ""}`}>
          {isWinner2 && <span className="liveWinnerBadge">🏆 Victory</span>}
          <img
            className={`statusAvatar${isWinner2 ? " winnerGlowLite" : ""}`}
            src={avatar2Url}
            alt={match.username2 || "Player 2"}
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
          />
          <strong className="liveBasicName">
            {match.username2 || "Player 2"}
          </strong>
          <span className="liveBasicScore">Score {displayScore2}</span>
          {isWinner2 && match.state === "finished" && (
            <span className="liveWinnerPayout">
              {ledger === "free"
                ? formatRafc(match.winnerPayout || 0)
                : formatSignedRac(match.winnerPayout || 0)}
            </span>
          )}
        </div>
      </div>

      <div className="liveBasicRps">
        <span className="liveBasicMove">
          {showRevealedCards
            ? `${MOVE_EMOJI[match.round?.move1 || ""] || "❓"} ${match.round?.move1 || "none"}`
            : move1Locked
              ? "🔒 locked"
              : "⏳ choosing"}
        </span>
        <span className="liveBasicMoveDivider">•</span>
        <span className="liveBasicMove">
          {showRevealedCards
            ? `${MOVE_EMOJI[match.round?.move2 || ""] || "❓"} ${match.round?.move2 || "none"}`
            : move2Locked
              ? "🔒 locked"
              : "⏳ choosing"}
        </span>
      </div>
    </div>
  );
}

const liveMatchFieldsEqual = (prev: Match, next: Match) =>
  prev.id === next.id &&
  prev.state === next.state &&
  prev.stage === next.stage &&
  prev.roundNumber === next.roundNumber &&
  prev.countdownEndsAt === next.countdownEndsAt &&
  prev.score1 === next.score1 &&
  prev.score2 === next.score2 &&
  prev.winnerUserId === next.winnerUserId &&
  prev.winnerPayout === next.winnerPayout &&
  prev.round?.move1 === next.round?.move1 &&
  prev.round?.move2 === next.round?.move2 &&
  prev.round?.revealed === next.round?.revealed &&
  (prev.ledger || "rac") === (next.ledger || "rac");

export const LiveMatchCard = memo(
  LiveMatchCardComponent,
  (prev, next) =>
    prev.nowSec === next.nowSec &&
    prev.isExiting === next.isExiting &&
    prev.avatar1Url === next.avatar1Url &&
    prev.avatar2Url === next.avatar2Url &&
    liveMatchFieldsEqual(prev.match, next.match),
);

LiveMatchCard.displayName = "LiveMatchCard";

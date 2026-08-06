"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  formatRac,
  formatRafc,
  formatSignedRac,
  formatSignedRafc,
} from "../../lib/currency";
import { DEFAULT_AVATAR, resolveAvatar } from "../../lib/avatars";
import { resolveRoundWinner } from "../../lib/matchUi";
import { MatchMoveReveal } from "./MatchMoveReveal";
import { MatchMoveSelectButton } from "./MatchMovePreview";
import { preloadMatchMoveEffects } from "../../lib/matchMoveEffects";
import {
  getCoinShowerCount,
  getReferralCoinCount,
  PLAYING_CLOCK_MS,
} from "../../lib/performance";
import type { Match, RematchState, User } from "../../lib/types";
import { INVITE_FRIENDS_ENABLED } from "../../lib/features";

type ReferralBonus = {
  userId: string;
  username: string;
  avatar?: string | null;
  amount: number;
};

type TrustMetrics = {
  completedLast10s: number;
  fastestToday?: number | null;
  peakActivity?: string | null;
};

type PlayingMatchModalProps = {
  activeMatch: Match;
  user: User | null;
  myInMatch: "player1" | "player2" | null;
  moveSubmitted: "rock" | "paper" | "scissors" | null;
  opponentMoveLockedHint: boolean;
  showGoBurst: boolean;
  finishedAtMs: number | null;
  finishedReferralBonuses: ReferralBonus[];
  rematchState: RematchState | null;
  rematchChoiceLoading: boolean;
  trustMetrics: TrustMetrics;
  onSubmitMove: (move: "rock" | "paper" | "scissors") => void;
  onRematchChoice: (choice: "continue" | "quit") => void;
  onConfirmRematchQuit: (confirmLeave: boolean) => void;
};

type ImpactLayout = {
  finalImpactTargetX: number;
  finalImpactTargetY: number;
  inviterImpactTargetX: number;
  inviterImpactTargetY: number;
  hasWinnerAvatarTarget: boolean;
  hasInviterAvatarTarget: boolean;
};

const DEFAULT_IMPACT_LAYOUT: ImpactLayout = {
  finalImpactTargetX: 0,
  finalImpactTargetY: -126,
  inviterImpactTargetX: 0,
  inviterImpactTargetY: -138,
  hasWinnerAvatarTarget: false,
  hasInviterAvatarTarget: false,
};

export const PlayingMatchModal = memo(function PlayingMatchModal({
  activeMatch,
  user,
  myInMatch,
  moveSubmitted,
  opponentMoveLockedHint,
  showGoBurst,
  finishedAtMs,
  finishedReferralBonuses,
  rematchState,
  rematchChoiceLoading,
  trustMetrics,
  onSubmitMove,
  onRematchChoice,
  onConfirmRematchQuit,
}: PlayingMatchModalProps) {
  const [playingNow, setPlayingNow] = useState(() => Date.now());
  const [impactLayout, setImpactLayout] = useState<ImpactLayout>(
    DEFAULT_IMPACT_LAYOUT,
  );
  const [arenaShaking, setArenaShaking] = useState(false);

  const payoutSafeRef = useRef<HTMLDivElement | null>(null);
  const myBattleAvatarRef = useRef<HTMLImageElement | null>(null);
  const opponentBattleAvatarRef = useRef<HTMLImageElement | null>(null);
  const myInviterAvatarRef = useRef<HTMLImageElement | null>(null);
  const opponentInviterAvatarRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const timer = setInterval(
      () => setPlayingNow(Date.now()),
      PLAYING_CLOCK_MS,
    );
    return () => clearInterval(timer);
  }, [activeMatch.id]);

  const triggerArenaShake = useCallback(() => {
    setArenaShaking(true);
    window.setTimeout(() => setArenaShaking(false), 250);
  }, []);

  const isPlayer1 = myInMatch === "player1";
  const myUserId =
    user?.id && activeMatch.userId1 === user.id
      ? activeMatch.userId1
      : user?.id && activeMatch.userId2 === user.id
        ? activeMatch.userId2
        : isPlayer1
          ? activeMatch.userId1
          : activeMatch.userId2;
  const opponentUserId = isPlayer1 ? activeMatch.userId2 : activeMatch.userId1;
  const myName = isPlayer1
    ? activeMatch.username1 || user?.username || "You"
    : activeMatch.username2 || user?.username || "You";
  const myAvatar = resolveAvatar(
    isPlayer1
      ? activeMatch.avatar1 || user?.avatar
      : activeMatch.avatar2 || user?.avatar,
  );
  const opponentAvatarFromMatch = isPlayer1
    ? activeMatch.avatar2
    : activeMatch.avatar1;
  const opponentNameFromMatch = isPlayer1
    ? activeMatch.username2
    : activeMatch.username1;
  const pinnedOpponentProfile =
    opponentUserId && rematchState?.playerDisplay
      ? rematchState.playerDisplay[opponentUserId]
      : null;
  const opponentName =
    opponentNameFromMatch ||
    pinnedOpponentProfile?.username ||
    "Opponent";
  const opponentAvatar = resolveAvatar(
    opponentAvatarFromMatch || pinnedOpponentProfile?.avatar,
  );

  useEffect(() => {
    preloadMatchMoveEffects([myAvatar, opponentAvatar]);
  }, [activeMatch.id, myAvatar, opponentAvatar]);

  const myMoveFromMatch = isPlayer1
    ? activeMatch.round?.move1
    : activeMatch.round?.move2;
  const opponentMoveFromMatch = isPlayer1
    ? activeMatch.round?.move2
    : activeMatch.round?.move1;
  const myMoveLocked = Boolean(moveSubmitted || myMoveFromMatch);
  const opponentMoveLocked = Boolean(
    opponentMoveFromMatch || opponentMoveLockedHint,
  );
  const revealMoves = Boolean(activeMatch.round?.revealed);

  const myRevealedMove = isPlayer1
    ? activeMatch.round?.move1
    : activeMatch.round?.move2;
  const opponentRevealedMove = isPlayer1
    ? activeMatch.round?.move2
    : activeMatch.round?.move1;

  const isFreeLedger = activeMatch.ledger === "free";
  const fmtStake = isFreeLedger ? formatRafc : formatRac;
  const fmtSignedStake = isFreeLedger ? formatSignedRafc : formatSignedRac;
  const grossPool = isFreeLedger ? 0 : Number(activeMatch.stakeTotal || 0);
  const serviceFeeRaw = isFreeLedger ? 0 : Number(activeMatch.feeTotal || 0);
  const isFinished = activeMatch.state === "finished";
  const winnerIsPlayer1 =
    !!activeMatch.winnerUserId &&
    activeMatch.winnerUserId === activeMatch.userId1;
  const myWon =
    !!activeMatch.winnerUserId &&
    ((isPlayer1 && winnerIsPlayer1) || (!isPlayer1 && !winnerIsPlayer1));
  const referralBonusTotal = finishedReferralBonuses.reduce(
    (sum, bonus) => sum + Number(bonus.amount || 0),
    0,
  );
  const serviceFee = Math.max(
    0,
    isFinished ? serviceFeeRaw - referralBonusTotal : serviceFeeRaw,
  );
  const winnerTakeTotal = Math.max(0, grossPool - serviceFeeRaw);
  const myInviterUserId = isPlayer1
    ? activeMatch.inviterUserId1 || user?.refer || null
    : activeMatch.inviterUserId2 || user?.refer || null;
  const myInviterUsername = isPlayer1
    ? activeMatch.inviterUsername1 || user?.inviter_username || null
    : activeMatch.inviterUsername2 || user?.inviter_username || null;
  const myInviterAvatar = isPlayer1
    ? activeMatch.inviterAvatar1 || user?.inviter_avatar || null
    : activeMatch.inviterAvatar2 || user?.inviter_avatar || null;
  const opponentInviterUserId = isPlayer1
    ? activeMatch.inviterUserId2 || null
    : activeMatch.inviterUserId1 || null;
  const opponentInviterUsername = isPlayer1
    ? activeMatch.inviterUsername2 || null
    : activeMatch.inviterUsername1 || null;
  const opponentInviterAvatar = isPlayer1
    ? activeMatch.inviterAvatar2 || null
    : activeMatch.inviterAvatar1 || null;
  const myReferralBonus = myInviterUserId
    ? finishedReferralBonuses.find((bonus) => bonus.userId === myInviterUserId)
        ?.amount || 0
    : 0;
  const opponentReferralBonus = opponentInviterUserId
    ? finishedReferralBonuses.find(
        (bonus) => bonus.userId === opponentInviterUserId,
      )?.amount || 0
    : 0;
  const referralTargetSide =
    myReferralBonus > 0 ? "left" : opponentReferralBonus > 0 ? "right" : null;
  const referralTargetAmount =
    referralTargetSide === "left"
      ? myReferralBonus
      : referralTargetSide === "right"
        ? opponentReferralBonus
        : 0;
  const coinShowerCount = getCoinShowerCount();
  const referralCoinCount = getReferralCoinCount();
  const myScore = isPlayer1 ? activeMatch.score1 || 0 : activeMatch.score2 || 0;
  const opponentScore = isPlayer1
    ? activeMatch.score2 || 0
    : activeMatch.score1 || 0;
  const payoutDisplayLabel =
    isFinished && !isFreeLedger ? "Service Fee" : "Winner Amount";
  const payoutDisplayValue =
    isFinished && !isFreeLedger
      ? serviceFee
      : isFinished
        ? winnerTakeTotal
        : grossPool;
  const opponentWon = !!activeMatch.winnerUserId && !myWon;
  const showFinishOutcome =
    isFinished && finishedAtMs !== null && playingNow - finishedAtMs >= 900;
  const shouldShowOpponentThinkingFx =
    !isFinished &&
    !revealMoves &&
    !opponentMoveLocked &&
    ["countdown_5", "countdown_20"].includes(activeMatch.stage) &&
    !showGoBurst;
  const showActionCards = !isFinished || !showFinishOutcome;
  const showRevealedCards = revealMoves || isFinished;
  const finalMyMove = myRevealedMove || myMoveFromMatch;
  const finalOpponentMove = opponentRevealedMove || opponentMoveFromMatch;
  const roundWinnerSide = resolveRoundWinner(finalMyMove, finalOpponentMove);
  const myCardClass =
    showRevealedCards && roundWinnerSide
      ? roundWinnerSide === "left"
        ? "winner"
        : "loser"
      : "";
  const opponentCardClass =
    showRevealedCards && roundWinnerSide
      ? roundWinnerSide === "right"
        ? "winner"
        : "loser"
      : "";
  const myLeading = myScore > opponentScore;
  const opponentLeading = opponentScore > myScore;
  const finalWinnerSide =
    showFinishOutcome && activeMatch.winnerUserId
      ? myWon
        ? "left"
        : "right"
      : null;
  const warningTarget = activeMatch.warningTarget || null;
  const myWarningClass =
    warningTarget === "both" ||
    (warningTarget === "player1" && isPlayer1) ||
    (warningTarget === "player2" && !isPlayer1)
      ? "warningZone"
      : "";
  const opponentWarningClass =
    warningTarget === "both" ||
    (warningTarget === "player1" && !isPlayer1) ||
    (warningTarget === "player2" && isPlayer1)
      ? "warningZone"
      : "";
  const finalPayoutFlowClass = finalWinnerSide
    ? finalWinnerSide === "left"
      ? "finalToLeft"
      : "finalToRight"
    : "";
  const matchResultAmount = Number(activeMatch.price || 0);
  const actualStakeTotal = Number(activeMatch.stakeTotal || 0);
  const winnerEarnings =
    isFinished && activeMatch.winnerPayout != null
      ? Number(activeMatch.winnerPayout)
      : isFreeLedger
        ? actualStakeTotal
        : winnerTakeTotal;
  const myResultAmount = myWon
    ? winnerEarnings
    : opponentWon
      ? -matchResultAmount
      : 0;
  const opponentResultAmount = opponentWon
    ? winnerEarnings
    : myWon
      ? -matchResultAmount
      : 0;
  const myResultAmountLabel = fmtSignedStake(myResultAmount);
  const opponentResultAmountLabel = fmtSignedStake(opponentResultAmount);
  const showWinnerFloatingPayout =
    isFinished && !showFinishOutcome && winnerEarnings > 0;

  const showRematchPrompt =
    isFinished &&
    showFinishOutcome &&
    Boolean(rematchState) &&
    Boolean(myUserId);
  const myRematchChoice = myUserId
    ? (rematchState?.choices?.[myUserId] ?? null)
    : null;
  const opponentRematchChoice =
    opponentUserId && rematchState?.choices
      ? (rematchState.choices[opponentUserId] ?? null)
      : null;
  const canAffordRematch = myUserId
    ? rematchState?.canContinueByUser?.[myUserId] !== false
    : true;
  const needsQuitConfirmation =
    Boolean(myUserId) && rematchState?.pendingQuitUserId === myUserId;
  const renderRematchChoiceBadge = (
    choice: "continue" | "quit" | null | undefined,
  ) => {
    if (!showRematchPrompt) {
      return null;
    }

    if (choice === "continue") {
      return (
        <span className="rematchChoiceBadge rematchChoiceBadge--continue">
          Continue
        </span>
      );
    }

    if (choice === "quit") {
      return (
        <span className="rematchChoiceBadge rematchChoiceBadge--quit">
          Quit
        </span>
      );
    }

    return (
      <span className="rematchChoiceBadge rematchChoiceBadge--pending">
        Deciding…
      </span>
    );
  };

  const countdownSeconds = useMemo(() => {
    if (!activeMatch.countdownEndsAt) {
      return null;
    }
    const remain = Math.ceil((activeMatch.countdownEndsAt - playingNow) / 1000);
    return remain > 0 ? remain : 0;
  }, [activeMatch.countdownEndsAt, playingNow]);

  const displayCountdownSeconds = useMemo(() => {
    if (countdownSeconds === null) {
      return null;
    }

    if (["countdown_5", "countdown_20"].includes(activeMatch.stage)) {
      const cap = activeMatch.stage === "countdown_20" ? 20 : 5;
      return Math.min(cap, countdownSeconds);
    }

    return countdownSeconds;
  }, [countdownSeconds, activeMatch.stage]);

  const watcherLookClass =
    myMoveLocked && !opponentMoveLocked
      ? "lookRight"
      : !myMoveLocked && opponentMoveLocked
        ? "lookLeft"
        : !myMoveLocked && !opponentMoveLocked
          ? Math.floor(playingNow / 1000) % 2 === 0
            ? "lookLeft"
            : "lookRight"
          : "lookCenter";

  useLayoutEffect(() => {
    if (!showFinishOutcome && !finalPayoutFlowClass) {
      setImpactLayout(DEFAULT_IMPACT_LAYOUT);
      return;
    }

    const payoutSafeRect = payoutSafeRef.current?.getBoundingClientRect();
    const winnerAvatarRect =
      finalWinnerSide === "left"
        ? myBattleAvatarRef.current?.getBoundingClientRect()
        : finalWinnerSide === "right"
          ? opponentBattleAvatarRef.current?.getBoundingClientRect()
          : null;
    const hasWinnerAvatarTarget =
      Boolean(finalPayoutFlowClass) &&
      Boolean(payoutSafeRect) &&
      Boolean(winnerAvatarRect);
    const inviterAvatarRect =
      referralTargetSide === "left"
        ? myInviterAvatarRef.current?.getBoundingClientRect()
        : referralTargetSide === "right"
          ? opponentInviterAvatarRef.current?.getBoundingClientRect()
          : null;
    const hasInviterAvatarTarget =
      Boolean(payoutSafeRect) && Boolean(inviterAvatarRect);

    setImpactLayout({
      hasWinnerAvatarTarget,
      hasInviterAvatarTarget,
      finalImpactTargetX: hasWinnerAvatarTarget
        ? winnerAvatarRect!.left +
          winnerAvatarRect!.width / 2 -
          (payoutSafeRect!.left + payoutSafeRect!.width / 2)
        : finalWinnerSide === "left"
          ? -356
          : 312,
      finalImpactTargetY: hasWinnerAvatarTarget
        ? winnerAvatarRect!.top +
          winnerAvatarRect!.height / 2 -
          (payoutSafeRect!.top + payoutSafeRect!.height / 2)
        : -126,
      inviterImpactTargetX: hasInviterAvatarTarget
        ? inviterAvatarRect!.left +
          inviterAvatarRect!.width / 2 -
          (payoutSafeRect!.left + payoutSafeRect!.width / 2)
        : referralTargetSide === "left"
          ? -404
          : 360,
      inviterImpactTargetY: hasInviterAvatarTarget
        ? inviterAvatarRect!.top +
          inviterAvatarRect!.height / 2 -
          (payoutSafeRect!.top + payoutSafeRect!.height / 2)
        : -138,
    });
  }, [
    showFinishOutcome,
    finalPayoutFlowClass,
    finalWinnerSide,
    referralTargetSide,
    activeMatch.id,
  ]);

  const {
    finalImpactTargetX,
    finalImpactTargetY,
    inviterImpactTargetX,
    inviterImpactTargetY,
  } = impactLayout;

  return (
    <div className="backdrop">
      <div
        className={`modal matchModal${isFreeLedger ? " matchModal--rafc" : ""}`}
      >
        <div className={`matchArenaLayout${arenaShaking ? " shake" : ""}`}>
          <section className={`matchPane playerPane ${myWarningClass}`}>
            <div className="paneLabel">You</div>
            <img
              className={`battleAvatar${isFinished && myWon ? " winnerAvatarGlow" : ""}`}
              src={myAvatar}
              alt={myName}
              ref={myBattleAvatarRef}
              loading="lazy"
              decoding="async"
            />
            {renderRematchChoiceBadge(myRematchChoice)}
            {showWinnerFloatingPayout && myWon ? (
              <div className="virtualWinnerPayout">
                {myResultAmountLabel}
              </div>
            ) : null}
            {INVITE_FRIENDS_ENABLED && myInviterUsername ? (
              <div className="battleInviterMini">
                <img
                  className="battleInviterAvatar"
                  src={resolveAvatar(myInviterAvatar || DEFAULT_AVATAR)}
                  alt={myInviterUsername}
                  ref={myInviterAvatarRef}
                  loading="lazy"
                  decoding="async"
                />
                <span className="battleInviterText">
                  referred by {myInviterUsername}
                </span>
                {showFinishOutcome && myReferralBonus > 0 ? (
                  <span className="battleInviterBonus">
                    +{formatRac(myReferralBonus)}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="battleName">{myName}</div>
            <div className="paneScoreBlock" aria-live="polite">
              <span className="paneScoreLabel">Score</span>
              <strong
                className={`paneScoreValue${myLeading ? " leading" : ""}`}
              >
                {myScore}
              </strong>
            </div>

            {!isFinished || !showFinishOutcome ? (
              <div className="moveGrid">
                {(["rock", "paper", "scissors"] as const).map((move) => (
                  <button
                    key={move}
                    className={`moveBtn${moveSubmitted === move ? " selected" : ""}`}
                    disabled={
                      !!moveSubmitted ||
                      !myInMatch ||
                      showGoBurst ||
                      !["countdown_5", "countdown_20"].includes(
                        activeMatch.stage,
                      )
                    }
                    onClick={() => onSubmitMove(move)}
                  >
                    <MatchMoveSelectButton
                      move={move}
                      avatarUrl={myAvatar}
                      selected={moveSubmitted === move}
                    />
                    <span className="moveLabel">
                      {move.charAt(0).toUpperCase() + move.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div
                className={`playerResultEmote ${myWon ? "winner" : "loser"}`}
              >
                <span className={`resultAmount ${myWon ? "win" : "loss"}`}>
                  {myResultAmountLabel}
                </span>
                <span className="resultFace" aria-hidden>
                  {myWon ? "🤩" : "😵"}
                </span>
                <span className="resultLabel">
                  {myWon ? "Overwhelming Joy" : "Crushed"}
                </span>
              </div>
            )}
          </section>

          <section className="matchPane centerPane">
            <div className="matchTopRow">
              <span className="matchLabel">
                {fmtStake(activeMatch.price)} match
              </span>
              <span className="roundBadge">
                {activeMatch.stage === "intro"
                  ? "Get Ready"
                  : `Round ${activeMatch.roundNumber}`}
              </span>
            </div>

            <div className="matchCountdownSlot">
              {displayCountdownSeconds !== null &&
              !showGoBurst &&
              ["countdown_5", "countdown_20"].includes(activeMatch.stage) ? (
                <div className="countdownRow">
                  <span>Time left</span>
                  <span
                    className={`countdownNum${displayCountdownSeconds <= 3 ? " urgent" : ""}`}
                  >
                    {displayCountdownSeconds}
                  </span>
                  <span>s</span>
                </div>
              ) : null}
            </div>

            <div
              className={`payoutSafe ${finalPayoutFlowClass}${isFreeLedger ? " payoutSafe--rafc" : ""}`}
              ref={payoutSafeRef}
            >
              <div className="payoutSafeTop">
                <span
                  className={`matchAdminEyes ${watcherLookClass}`}
                  aria-hidden
                >
                  <span className="watchEye">
                    <span className="watchPupil" />
                  </span>
                  <span className="watchEye">
                    <span className="watchPupil" />
                  </span>
                </span>
                <span className="payoutSafeLabel">Match overseer</span>
              </div>
              {grossPool > 0 ? (
                <>
                  <div className="coinSafeBody">
                    <span className="coinSafeMegaCoin" aria-hidden />
                    <div className="coinSafeTotalBlock">
                      <span className="coinSafeTotalLabel">
                        {payoutDisplayLabel}
                      </span>
                      <strong className="coinSafeGrandTotal">
                        {fmtStake(payoutDisplayValue)}
                      </strong>
                    </div>
                  </div>
                  {finalPayoutFlowClass ? (
                    <div className="coinFinalNotice">
                      WINNER PAYOUT {fmtStake(winnerTakeTotal)}
                    </div>
                  ) : null}
                  {INVITE_FRIENDS_ENABLED &&
                  showFinishOutcome &&
                  referralTargetSide ? (
                    <div
                      className={`coinReferralNotice ${
                        referralTargetSide === "left" ? "toLeft" : "toRight"
                      }`}
                    >
                      REFERRER BONUS +{formatRac(referralTargetAmount)}
                    </div>
                  ) : null}
                  {finalPayoutFlowClass && coinShowerCount > 0 ? (
                    <div
                      className="coinTransferLayer coinTransferFinal"
                      aria-hidden
                      style={
                        {
                          "--impact-target-x": `${finalImpactTargetX}px`,
                          "--impact-target-y": `${finalImpactTargetY}px`,
                        } as CSSProperties
                      }
                    >
                      {Array.from({ length: coinShowerCount }).map(
                        (_, index) => {
                          const lane = index % 16;
                          const wave = Math.floor(index / 16);
                          const sideSign = finalImpactTargetX < 0 ? -1 : 1;
                          const lateralSpread =
                            ((lane % 8) - 3.5) * 16 + sideSign * wave * 6;
                          const verticalSpread =
                            ((lane % 6) - 2.5) * 12 + wave * 5 - 16;
                          const targetX = finalImpactTargetX + lateralSpread;
                          const targetY = finalImpactTargetY + verticalSpread;
                          const delay = (index % 24) * 0.045;
                          const spin =
                            (index % 2 === 0 ? 1 : -1) * (260 + index * 14);
                          const scaleStart = 0.7 + (index % 5) * 0.07;
                          const scaleEnd = 0.28 + (index % 4) * 0.08;
                          const duration = 1.7 + (index % 6) * 0.2;
                          const style = {
                            "--coin-target-x": `${targetX}px`,
                            "--coin-target-y": `${targetY}px`,
                            "--coin-delay": `${delay}s`,
                            "--coin-spin": `${spin}deg`,
                            "--coin-scale-start": scaleStart,
                            "--coin-scale-end": scaleEnd,
                            "--coin-duration": `${duration}s`,
                          } as CSSProperties;

                          return (
                            <span
                              key={`final-coin-${index}`}
                              className="finalPayoutCoin"
                              style={style}
                            />
                          );
                        },
                      )}
                    </div>
                  ) : null}
                  {INVITE_FRIENDS_ENABLED &&
                  showFinishOutcome &&
                  referralTargetSide &&
                  referralCoinCount > 0 ? (
                    <div
                      className={`coinTransferLayer coinTransferReferral ${
                        referralTargetSide === "left" ? "toLeft" : "toRight"
                      }`}
                      aria-hidden
                    >
                      {Array.from({ length: referralCoinCount }).map(
                        (_, index) => {
                          const lane = index % 10;
                          const wave = Math.floor(index / 10);
                          const lateralSpread =
                            ((lane % 5) - 2) * 14 - wave * 5;
                          const verticalSpread =
                            ((lane % 4) - 1.5) * 10 + wave * 3 - 12;
                          const targetX = inviterImpactTargetX + lateralSpread;
                          const targetY = inviterImpactTargetY + verticalSpread;
                          const delay = (index % 18) * 0.04;
                          const spin =
                            (index % 2 === 0 ? 1 : -1) * (220 + index * 12);
                          const scaleStart = 0.62 + (index % 4) * 0.06;
                          const scaleEnd = 0.24 + (index % 3) * 0.06;
                          const duration = 1.35 + (index % 5) * 0.16;
                          const style = {
                            "--coin-target-x": `${targetX}px`,
                            "--coin-target-y": `${targetY}px`,
                            "--coin-delay": `${delay}s`,
                            "--coin-spin": `${spin}deg`,
                            "--coin-scale-start": scaleStart,
                            "--coin-scale-end": scaleEnd,
                            "--coin-duration": `${duration}s`,
                          } as CSSProperties;

                          return (
                            <span
                              key={`referral-coin-${index}`}
                              className="finalPayoutCoin referralPayoutCoin"
                              style={style}
                            />
                          );
                        },
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="coinSafePractice">
                  Practice match · no stake
                </div>
              )}
            </div>

            {showActionCards ? (
              <div className="duelCards">
                <div
                  className={
                    showRevealedCards
                      ? `duelCardSlot duelCardSlotRevealed ${myCardClass}`
                      : `duelCard duelCardPlayer ${myMoveLocked ? "locked" : "idle"}`
                  }
                >
                  {showRevealedCards ? (
                    <MatchMoveReveal
                      key={`my-${activeMatch.roundNumber}-${finalMyMove || "none"}`}
                      move={finalMyMove}
                      avatarUrl={myAvatar}
                      side="player"
                      animate={revealMoves}
                      onImpact={triggerArenaShake}
                    />
                  ) : myMoveLocked ? (
                    <div className="cardBackPattern" aria-hidden />
                  ) : (
                    <span className="duelCardWaiting">Waiting...</span>
                  )}
                </div>

                <span className="duelVs">VS</span>

                <div
                  className={
                    showRevealedCards
                      ? `duelCardSlot duelCardSlotRevealed ${opponentCardClass}`
                      : `duelCard duelCardOpponent ${opponentMoveLocked ? "locked" : "idle"}`
                  }
                >
                  {showRevealedCards ? (
                    <MatchMoveReveal
                      key={`opp-${activeMatch.roundNumber}-${finalOpponentMove || "none"}`}
                      move={finalOpponentMove}
                      avatarUrl={opponentAvatar}
                      side="opponent"
                      animate={revealMoves}
                      onImpact={triggerArenaShake}
                    />
                  ) : opponentMoveLocked ? (
                    <div className="cardBackPattern" aria-hidden />
                  ) : shouldShowOpponentThinkingFx ? (
                    <div className="duelCardThinking" aria-live="polite">
                      <span className="thinkingFace" aria-hidden>
                        🤔
                      </span>
                      <span className="thinkingText">Thinking</span>
                      <span className="thinkingDots" aria-hidden>
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  ) : (
                    <span className="duelCardWaiting">Waiting...</span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`victoryPanel ${myWon ? "winner" : opponentWon ? "loser" : "neutral"}`}
              >
                <div className="victoryText">
                  {myWon ? "Victory" : opponentWon ? "You Lost" : "Round Ended"}
                </div>
                <div className="victorySub">
                  {myWon
                    ? "You completely dominated this round."
                    : opponentWon
                      ? `${opponentName} takes this one. Regroup and strike back.`
                      : "Round completed."}
                </div>
              </div>
            )}

            <div className="fairnessCue">
              {revealMoves
                ? "✅ Both players locked moves · Cards flipped and revealed simultaneously"
                : myMoveLocked
                  ? "🔒 Your card is locked. Waiting for opponent lock before reveal."
                  : "🎴 Select your move. Locked cards stay face-down until both choose."}
            </div>
          </section>

          <aside className={`matchPane opponentPane ${opponentWarningClass}`}>
            <div className="paneLabel">Opponent</div>
            <img
              className={`battleAvatar${isFinished && opponentWon ? " winnerAvatarGlow" : ""}`}
              src={opponentAvatar}
              alt={opponentName}
              ref={opponentBattleAvatarRef}
              loading="lazy"
              decoding="async"
            />
            {renderRematchChoiceBadge(opponentRematchChoice)}
            {showWinnerFloatingPayout && opponentWon ? (
              <div className="virtualWinnerPayout">
                {opponentResultAmountLabel}
              </div>
            ) : null}
            {INVITE_FRIENDS_ENABLED && opponentInviterUsername ? (
              <div className="battleInviterMini">
                <img
                  className="battleInviterAvatar"
                  src={resolveAvatar(opponentInviterAvatar || DEFAULT_AVATAR)}
                  alt={opponentInviterUsername}
                  ref={opponentInviterAvatarRef}
                  loading="lazy"
                  decoding="async"
                />
                <span className="battleInviterText">
                  referred by {opponentInviterUsername}
                </span>
                {showFinishOutcome && opponentReferralBonus > 0 ? (
                  <span className="battleInviterBonus">
                    +{formatRac(opponentReferralBonus)}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="battleName">{opponentName}</div>
            <div className="paneScoreBlock" aria-live="polite">
              <span className="paneScoreLabel">Score</span>
              <strong
                className={`paneScoreValue${opponentLeading ? " leading" : ""}`}
              >
                {opponentScore}
              </strong>
            </div>
            {!isFinished || !showFinishOutcome ? (
              shouldShowOpponentThinkingFx ? (
                <div className="opponentThoughtZone">
                  <div className="opponentThinkingText">
                    🤔 Choosing very carefully...
                  </div>
                  <div className="opponentMiniCards" aria-hidden>
                    <span className="miniFlipCard" />
                    <span className="miniFlipCard" />
                    <span className="miniFlipCard" />
                  </div>
                </div>
              ) : (
                <div className="opponentHint">
                  Opponent details are hidden until reveal.
                </div>
              )
            ) : (
              <div
                className={`playerResultEmote ${opponentWon ? "winner" : "loser"}`}
              >
                <span
                  className={`resultAmount ${opponentWon ? "win" : "loss"}`}
                >
                  {opponentResultAmountLabel}
                </span>
                <span className="resultFace" aria-hidden>
                  {opponentWon ? "🤩" : "😵"}
                </span>
                <span className="resultLabel">
                  {opponentWon ? "Overwhelming Joy" : "Crushed"}
                </span>
              </div>
            )}
          </aside>
        </div>

        {activeMatch.stage === "intro" && (
          <div className="introOverlay" aria-live="polite">
            <div className="introText">GET READY</div>
            <div className="introCount">{countdownSeconds ?? 3}</div>
          </div>
        )}

        {showGoBurst && (
          <div className="matchIntroOverlay" aria-hidden>
            <div className="goBurstModal">
              <div className="goBurstText">GO!</div>
            </div>
          </div>
        )}

        {activeMatch.state === "finished" && !showRematchPrompt ? (
          <div className="resultProof">
            <span>
              Last 10s: {trustMetrics.completedLast10s} matches completed
            </span>
            <span>
              Fastest today:{" "}
              {trustMetrics.fastestToday
                ? `${trustMetrics.fastestToday.toFixed(1)}s`
                : "--"}
            </span>
            <span>Peak activity: {trustMetrics.peakActivity ?? "--"}</span>
          </div>
        ) : null}

        {showRematchPrompt && !needsQuitConfirmation ? (
          <div className="rematchPromptPanel">
            <p className="rematchPromptTitle">Play another match?</p>
            <p className="rematchPromptSubtitle">
              Choose whether to stay in this match or leave.
            </p>
            {!canAffordRematch ? (
              <p className="rematchFundsWarning">
                Insufficient funds for another match. Continue is unavailable.
              </p>
            ) : null}
            <div className="rematchPromptActions">
              <button
                type="button"
                className="btnDanger rematchPromptBtn"
                disabled={rematchChoiceLoading || myRematchChoice !== null}
                onClick={() => onRematchChoice("quit")}
              >
                Quit
              </button>
              <button
                type="button"
                className="btnPrimary rematchPromptBtn"
                disabled={
                  rematchChoiceLoading ||
                  myRematchChoice !== null ||
                  !canAffordRematch
                }
                onClick={() => onRematchChoice("continue")}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {needsQuitConfirmation ? (
          <div className="rematchConfirmOverlay">
            <div className="rematchConfirmCard">
              <p className="rematchConfirmTitle">
                The player you competed against has requested a rematch. Do you
                still want to leave?
              </p>
              <div className="rematchPromptActions">
                <button
                  type="button"
                  className="btnDanger rematchPromptBtn"
                  disabled={rematchChoiceLoading}
                  onClick={() => onConfirmRematchQuit(true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="btnPrimary rematchPromptBtn"
                  disabled={rematchChoiceLoading}
                  onClick={() => onConfirmRematchQuit(false)}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default PlayingMatchModal;

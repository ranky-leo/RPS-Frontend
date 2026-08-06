"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSpriteStageWidth,
  normalizeMatchMove,
  resolveMatchMoveSpriteConfig,
  shouldUseShopMoveEffects,
} from "../../lib/matchMoveEffects";
import { MOVE_EMOJI } from "../../lib/matchUi";
import { SpriteAnimation, SpriteFrame } from "./SpriteAnimation";

type MatchMoveRevealProps = {
  move?: string | null;
  avatarUrl?: string | null;
  side: "player" | "opponent";
  animate?: boolean;
  onImpact?: () => void;
};

export function MatchMoveReveal({
  move,
  avatarUrl,
  side,
  animate = true,
  onImpact,
}: MatchMoveRevealProps) {
  const normalizedMove = normalizeMatchMove(move);
  const useMoveEffects = shouldUseShopMoveEffects(avatarUrl);
  const [shaking, setShaking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(animate);
  const [hasFinished, setHasFinished] = useState(!animate);

  const config = useMemo(() => {
    if (!normalizedMove || !useMoveEffects) {
      return null;
    }

    return resolveMatchMoveSpriteConfig(normalizedMove, avatarUrl);
  }, [avatarUrl, normalizedMove, useMoveEffects]);

  useEffect(() => {
    if (!config) {
      return;
    }

    if (animate) {
      setIsPlaying(true);
      setHasFinished(false);
      return;
    }

    setIsPlaying(false);
    setHasFinished(true);
  }, [animate, config, move, normalizedMove]);

  const handleFrameChange = useCallback(
    (sheetFrameIndex: number) => {
      if (!config || sheetFrameIndex !== config.impactFrameIndex) {
        return;
      }

      setShaking(true);
      onImpact?.();
      window.setTimeout(() => setShaking(false), 250);
    },
    [config, onImpact],
  );

  const handleComplete = useCallback(() => {
    setIsPlaying(false);
    setHasFinished(true);
  }, []);

  if (!normalizedMove) {
    return (
      <div className="matchMoveReveal matchMoveRevealUnknown">
        <span className="matchMoveRevealFallback" aria-hidden>
          ❓
        </span>
      </div>
    );
  }

  if (!useMoveEffects || !config) {
    return (
      <div
        className={`matchMoveReveal matchMoveRevealClassic matchMoveReveal${capitalize(side)}${animate ? " isRevealed" : ""}`}
      >
        <span className="duelCardEmoji">{MOVE_EMOJI[normalizedMove]}</span>
      </div>
    );
  }

  const stageWidth = getSpriteStageWidth(config);
  const showAnimation = isPlaying && !hasFinished;

  return (
    <div
      className={`matchMoveReveal matchMoveReveal${capitalize(normalizedMove)} matchMoveReveal${capitalize(side)}${shaking ? " shake" : ""}${showAnimation ? " isAnimating" : ""}`}
    >
      <div
        className={`matchMoveRevealStage ${config.glowClass}`}
        style={{
          width: stageWidth,
          height: config.displayHeight,
        }}
      >
        {showAnimation ? (
          <SpriteAnimation
            config={config}
            playing
            onFrameChange={handleFrameChange}
            onComplete={handleComplete}
          />
        ) : (
          <SpriteFrame config={config} frameIndex={config.settledFrameIndex} />
        )}
      </div>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

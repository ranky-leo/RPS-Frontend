"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchMoveSpriteSheetConfig } from "../../lib/matchMoveEffects";
import { getSpriteFrameStyle, getSpriteStageWidth } from "../../lib/matchMoveEffects";

type SpriteAnimationProps = {
  config: MatchMoveSpriteSheetConfig;
  fps?: number;
  loop?: boolean;
  playing?: boolean;
  className?: string;
  onFrameChange?: (sheetFrameIndex: number, sequenceIndex: number) => void;
  onComplete?: () => void;
};

export function SpriteAnimation({
  config,
  fps = config.fps,
  loop = false,
  playing = true,
  className = "",
  onFrameChange,
  onComplete,
}: SpriteAnimationProps) {
  const animationIndices = config.animationIndices;
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const onFrameChangeRef = useRef(onFrameChange);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onFrameChangeRef.current = onFrameChange;
  }, [onFrameChange]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const currentSheetIndex = animationIndices[sequenceIndex] ?? animationIndices[0];

  useEffect(() => {
    if (!playing) {
      return;
    }

    setSequenceIndex(0);
    onFrameChangeRef.current?.(animationIndices[0], 0);
  }, [playing, config.src, animationIndices]);

  useEffect(() => {
    if (!playing) {
      return;
    }

    const interval = window.setInterval(() => {
      setSequenceIndex((previous) => {
        if (previous >= animationIndices.length - 1) {
          return loop ? 0 : previous;
        }

        const nextSequenceIndex = previous + 1;
        const nextSheetIndex = animationIndices[nextSequenceIndex];
        onFrameChangeRef.current?.(nextSheetIndex, nextSequenceIndex);

        if (nextSequenceIndex >= animationIndices.length - 1) {
          onCompleteRef.current?.();
        }

        return nextSequenceIndex;
      });
    }, 1000 / fps);

    return () => window.clearInterval(interval);
  }, [fps, animationIndices, loop, playing]);

  const frameStyle = useMemo(() => {
    const fixedWidth = getSpriteStageWidth(config);

    return getSpriteFrameStyle(config, currentSheetIndex, { fixedWidth });
  }, [config, currentSheetIndex]);

  return (
    <div
      className={`spriteAnimation ${className}`.trim()}
      style={frameStyle}
      aria-hidden
    />
  );
}

export function SpriteFrame({
  config,
  frameIndex,
  className = "",
}: {
  config: MatchMoveSpriteSheetConfig;
  frameIndex: number;
  className?: string;
}) {
  return (
    <div
      className={`spriteAnimation spriteAnimationSettled ${className}`.trim()}
      style={getSpriteFrameStyle(config, frameIndex)}
      aria-hidden
    />
  );
}

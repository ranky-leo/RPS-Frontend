"use client";

import { useMemo } from "react";
import type { AvatarMoveEffectSet } from "../../lib/types";
import {
  getSpriteStageWidth,
  normalizeMatchMove,
  resolveMatchMoveSpriteConfig,
  shouldUseShopMoveEffects,
  type MatchMove,
} from "../../lib/matchMoveEffects";
import { MOVE_EMOJI } from "../../lib/matchUi";
import { SpriteAnimation, SpriteFrame } from "./SpriteAnimation";

type MatchMovePreviewProps = {
  move?: string | null;
  avatarUrl?: string | null;
  moveEffects?: Partial<AvatarMoveEffectSet> | null;
  side?: "player" | "opponent";
  displayHeight?: number;
  showGlow?: boolean;
  className?: string;
};

export function MatchMovePreview({
  move,
  avatarUrl,
  moveEffects,
  side = "player",
  displayHeight,
  showGlow = true,
  className = "",
}: MatchMovePreviewProps) {
  const normalizedMove = normalizeMatchMove(move);
  const useMoveEffects = shouldUseShopMoveEffects(avatarUrl, moveEffects);
  const config = useMemo(() => {
    if (!normalizedMove || !useMoveEffects) {
      return null;
    }

    return resolveMatchMoveSpriteConfig(normalizedMove, avatarUrl, {
      displayHeight,
      effects: moveEffects,
    });
  }, [avatarUrl, displayHeight, moveEffects, normalizedMove, useMoveEffects]);

  if (!normalizedMove) {
    return null;
  }

  if (!useMoveEffects || !config) {
    return (
      <span className={`moveEmoji matchMoveEmojiClassic ${className}`.trim()}>
        {MOVE_EMOJI[normalizedMove]}
      </span>
    );
  }

  const resolvedHeight = displayHeight ?? config.displayHeight;
  const scale = resolvedHeight / config.sheetHeight;
  const labelFrame = config.frames[config.labelFrameIndex];
  const stageWidth = Math.ceil(labelFrame.width * scale);
  const previewConfig = {
    ...config,
    displayHeight: resolvedHeight,
  };

  return (
    <div
      className={`matchMovePreview matchMovePreview${capitalize(normalizedMove)} matchMovePreview${capitalize(side)}${showGlow ? ` ${config.glowClass}` : ""} ${className}`.trim()}
    >
      <div
        className="matchMovePreviewStage"
        style={{
          width: stageWidth,
          height: resolvedHeight,
        }}
      >
        <SpriteFrame
          config={previewConfig}
          frameIndex={config.labelFrameIndex}
        />
      </div>
    </div>
  );
}

export function MatchMoveSelectButton({
  move,
  avatarUrl,
  selected = false,
}: {
  move: MatchMove;
  avatarUrl?: string | null;
  selected?: boolean;
}) {
  return (
    <MatchMovePreview
      move={move}
      avatarUrl={avatarUrl}
      displayHeight={56}
      showGlow={selected}
      className={selected ? "matchMovePreviewSelected" : ""}
    />
  );
}

type MatchMoveAnimatedPreviewProps = {
  move?: string | null;
  avatarUrl?: string | null;
  moveEffects?: Partial<AvatarMoveEffectSet> | null;
  displayHeight?: number;
  showGlow?: boolean;
  loop?: boolean;
  className?: string;
};

export function MatchMoveAnimatedPreview({
  move,
  avatarUrl,
  moveEffects,
  displayHeight,
  showGlow = true,
  loop = true,
  className = "",
}: MatchMoveAnimatedPreviewProps) {
  const normalizedMove = normalizeMatchMove(move);
  const useMoveEffects = shouldUseShopMoveEffects(avatarUrl, moveEffects);
  const config = useMemo(() => {
    if (!normalizedMove || !useMoveEffects) {
      return null;
    }

    return resolveMatchMoveSpriteConfig(normalizedMove, avatarUrl, {
      displayHeight,
      effects: moveEffects,
    });
  }, [avatarUrl, displayHeight, moveEffects, normalizedMove, useMoveEffects]);

  if (!normalizedMove) {
    return null;
  }

  if (!useMoveEffects || !config) {
    return (
      <span className={`moveEmoji matchMoveEmojiClassic ${className}`.trim()}>
        {MOVE_EMOJI[normalizedMove]}
      </span>
    );
  }

  const resolvedHeight = displayHeight ?? config.displayHeight;
  const previewConfig = {
    ...config,
    displayHeight: resolvedHeight,
  };
  const viewportWidth = getSpriteStageWidth(previewConfig);

  return (
    <div
      className={`matchMoveAnimatedPreview matchMovePreview${capitalize(normalizedMove)}${showGlow ? " hasGlow" : ""} ${className}`.trim()}
      data-move={normalizedMove}
    >
      <div
        className="matchMoveSpriteFit"
        style={{
          ["--sprite-w" as string]: `${viewportWidth}px`,
          ["--sprite-h" as string]: `${resolvedHeight}px`,
        }}
      >
        <SpriteAnimation config={previewConfig} playing loop={loop} />
      </div>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

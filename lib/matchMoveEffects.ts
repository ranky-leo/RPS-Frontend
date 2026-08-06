import type { AvatarMoveEffectSet, AvatarMoveKey } from "./types";
import {
  buildShopEffectPublicUrl,
  getAvatarMoveGif,
  resolvePublicAssetUrl,
  resolveShopAvatarMoveEffects,
} from "./avatarEffects";

export type MatchMove = "rock" | "paper" | "scissors";

const MATCH_MOVE_TO_EFFECT_KEY: Record<MatchMove, AvatarMoveKey> = {
  rock: "stone",
  paper: "paper",
  scissors: "scissors",
};

export const matchMoveToEffectKey = (move: MatchMove): AvatarMoveKey =>
  MATCH_MOVE_TO_EFFECT_KEY[move];

export const buildMatchMoveEffectPublicUrl = (
  avatarId: string,
  move: MatchMove,
) => buildShopEffectPublicUrl(avatarId, matchMoveToEffectKey(move));

export type SpriteFrameRect = {
  x: number;
  width: number;
  height: number;
};

export type MatchMoveSpriteSheetConfig = {
  src: string;
  sheetWidth: number;
  sheetHeight: number;
  frames: SpriteFrameRect[];
  labelFrameIndex: number;
  animationIndices: number[];
  settledFrameIndex: number;
  impactFrameIndex: number;
  displayHeight: number;
  fps: number;
  glowClass: string;
};

const MOVE_EFFECT_FRAME_SIZE = 200;
const MOVE_EFFECT_FRAME_COUNT = 6;

const buildUniformFrames = (
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
): SpriteFrameRect[] =>
  Array.from({ length: frameCount }, (_, index) => ({
    x: index * frameWidth,
    width: frameWidth,
    height: frameHeight,
  }));

const MATCH_MOVE_SPRITE_LAYOUT: Record<
  MatchMove,
  Omit<MatchMoveSpriteSheetConfig, "src">
> = {
  rock: {
    sheetWidth: MOVE_EFFECT_FRAME_SIZE * MOVE_EFFECT_FRAME_COUNT,
    sheetHeight: MOVE_EFFECT_FRAME_SIZE,
    frames: buildUniformFrames(
      MOVE_EFFECT_FRAME_COUNT,
      MOVE_EFFECT_FRAME_SIZE,
      MOVE_EFFECT_FRAME_SIZE,
    ),
    labelFrameIndex: 0,
    animationIndices: [1, 2, 3, 4, 5],
    settledFrameIndex: 5,
    impactFrameIndex: 3,
    displayHeight: 100,
    fps: 3,
    glowClass: "matchMoveGlowRock",
  },
  paper: {
    sheetWidth: MOVE_EFFECT_FRAME_SIZE * MOVE_EFFECT_FRAME_COUNT,
    sheetHeight: MOVE_EFFECT_FRAME_SIZE,
    frames: buildUniformFrames(
      MOVE_EFFECT_FRAME_COUNT,
      MOVE_EFFECT_FRAME_SIZE,
      MOVE_EFFECT_FRAME_SIZE,
    ),
    labelFrameIndex: 0,
    animationIndices: [1, 2, 3, 4, 5],
    settledFrameIndex: 5,
    impactFrameIndex: 3,
    displayHeight: 100,
    fps: 3,
    glowClass: "matchMoveGlowPaper",
  },
  scissors: {
    sheetWidth: MOVE_EFFECT_FRAME_SIZE * MOVE_EFFECT_FRAME_COUNT,
    sheetHeight: MOVE_EFFECT_FRAME_SIZE,
    frames: buildUniformFrames(
      MOVE_EFFECT_FRAME_COUNT,
      MOVE_EFFECT_FRAME_SIZE,
      MOVE_EFFECT_FRAME_SIZE,
    ),
    labelFrameIndex: 0,
    animationIndices: [1, 2, 3, 4, 5],
    settledFrameIndex: 5,
    impactFrameIndex: 3,
    displayHeight: 100,
    fps: 3,
    glowClass: "matchMoveGlowScissors",
  },
};

export const resolveShopAvatarIdFromUrl = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const pathOnly = normalized.replace(/^https?:\/\/[^/]+/i, "");
  const patterns = [
    /\/media\/shop\/avatars\/(rps-\d+)\./i,
    /\/media\/shop\/effects\/(rps-\d+)\//i,
    /(?:^|\/)(rps-\d+)\.png/i,
  ];

  for (const pattern of patterns) {
    const match = pathOnly.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const resolveMoveEffectSrc = (
  move: MatchMove,
  avatarUrl?: string | null,
  effects?: Partial<AvatarMoveEffectSet> | null,
) => {
  if (effects?.stoneGif || effects?.scissorsGif || effects?.paperGif) {
    return getAvatarMoveGif(
      resolveShopAvatarMoveEffects(effects),
      matchMoveToEffectKey(move),
    );
  }

  const avatarId = resolveShopAvatarIdFromUrl(avatarUrl);
  if (!avatarId) {
    return null;
  }

  return resolvePublicAssetUrl(buildMatchMoveEffectPublicUrl(avatarId, move));
};

export const shouldUseShopMoveEffects = (
  avatarUrl?: string | null,
  effects?: Partial<AvatarMoveEffectSet> | null,
) =>
  Boolean(
    effects?.stoneGif ||
      effects?.scissorsGif ||
      effects?.paperGif ||
      resolveShopAvatarIdFromUrl(avatarUrl),
  );

export const resolveMatchMoveSpriteConfig = (
  move: MatchMove,
  avatarUrl?: string | null,
  options?: {
    displayHeight?: number;
    effects?: Partial<AvatarMoveEffectSet> | null;
  },
): MatchMoveSpriteSheetConfig | null => {
  const src = resolveMoveEffectSrc(move, avatarUrl, options?.effects);
  if (!src) {
    return null;
  }

  const layout = MATCH_MOVE_SPRITE_LAYOUT[move];

  return {
    ...layout,
    displayHeight: options?.displayHeight ?? layout.displayHeight,
    src,
  };
};

export const preloadMatchMoveEffects = (
  avatarUrls: Array<string | null | undefined>,
) => {
  const avatarIds = new Set<string>();

  avatarUrls.forEach((avatarUrl) => {
    const avatarId = resolveShopAvatarIdFromUrl(avatarUrl);
    if (avatarId) {
      avatarIds.add(avatarId);
    }
  });

  (["rock", "paper", "scissors"] as const).forEach((move) => {
    avatarIds.forEach((avatarId) => {
      const image = new Image();
      image.src = resolvePublicAssetUrl(
        buildMatchMoveEffectPublicUrl(avatarId, move),
      );
    });
  });
};

export const getSpriteFrameStyle = (
  config: MatchMoveSpriteSheetConfig,
  frameIndex: number,
  options?: { fixedWidth?: number },
) => {
  const frame = config.frames[frameIndex];
  const scale = config.displayHeight / config.sheetHeight;
  const naturalWidth = frame.width * scale;
  const displayWidth = options?.fixedWidth ?? naturalWidth;
  const insetX = options?.fixedWidth
    ? Math.max(0, (displayWidth - naturalWidth) / 2)
    : 0;

  return {
    width: displayWidth,
    height: config.displayHeight,
    backgroundImage: `url(${config.src})`,
    backgroundSize: `${config.sheetWidth * scale}px ${config.displayHeight}px`,
    backgroundPosition: `-${frame.x * scale - insetX}px 0px`,
    backgroundRepeat: "no-repeat" as const,
  };
};

export const getSpriteStageWidth = (config: MatchMoveSpriteSheetConfig) => {
  const scale = config.displayHeight / config.sheetHeight;
  const animatedWidths = config.animationIndices.map(
    (index) => config.frames[index].width * scale,
  );

  return Math.ceil(Math.max(...animatedWidths, 1));
};

export const normalizeMatchMove = (move?: string | null): MatchMove | null => {
  const normalized = String(move || "")
    .trim()
    .toLowerCase();
  if (normalized === "rock" || normalized === "stone") {
    return "rock";
  }
  if (normalized === "paper") {
    return "paper";
  }
  if (normalized === "scissors") {
    return "scissors";
  }
  return null;
};

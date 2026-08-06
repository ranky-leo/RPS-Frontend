import type { AvatarMoveEffectSet, AvatarMoveKey } from "./types";

const API_BASE_ORIGIN = String(process.env.NEXT_PUBLIC_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

const isBackendServedAssetPath = (value?: string | null) =>
  /^\/media\/(?:shop\/effects|shop\/avatars|avatars|chat)\//i.test(
    String(value || "").trim(),
  );

export const resolvePublicAssetUrl = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (isBackendServedAssetPath(normalized) && API_BASE_ORIGIN) {
    return `${API_BASE_ORIGIN}${normalized}`;
  }

  return normalized;
};

export const SHOP_EFFECTS_PUBLIC_PREFIX = "/media/shop/effects";

export const buildShopEffectPublicUrl = (
  avatarId: string,
  move: AvatarMoveKey,
) => `${SHOP_EFFECTS_PUBLIC_PREFIX}/${avatarId}/${move}.png`;

export const STANDARD_AVATAR_MOVE_EFFECTS: AvatarMoveEffectSet = {
  stoneGif: buildShopEffectPublicUrl("standard", "stone"),
  scissorsGif: buildShopEffectPublicUrl("standard", "scissors"),
  paperGif: buildShopEffectPublicUrl("standard", "paper"),
};

export const PREMIUM_FALLBACK_MOVE_EFFECTS: AvatarMoveEffectSet = {
  stoneGif: buildShopEffectPublicUrl("premium", "stone"),
  scissorsGif: buildShopEffectPublicUrl("premium", "scissors"),
  paperGif: buildShopEffectPublicUrl("premium", "paper"),
};

export const AVATAR_MOVE_LABELS: Record<AvatarMoveKey, string> = {
  stone: "Stone",
  scissors: "Scissors",
  paper: "Paper",
};

export const getAvatarMoveGif = (
  effects: AvatarMoveEffectSet,
  move: AvatarMoveKey,
) => {
  if (move === "stone") {
    return resolvePublicAssetUrl(effects.stoneGif);
  }
  if (move === "scissors") {
    return resolvePublicAssetUrl(effects.scissorsGif);
  }
  return resolvePublicAssetUrl(effects.paperGif);
};

export const resolveShopAvatarMoveEffects = (
  avatar?: Partial<AvatarMoveEffectSet> | null,
): AvatarMoveEffectSet => ({
  stoneGif: resolvePublicAssetUrl(
    avatar?.stoneGif || PREMIUM_FALLBACK_MOVE_EFFECTS.stoneGif,
  ),
  scissorsGif: resolvePublicAssetUrl(
    avatar?.scissorsGif || PREMIUM_FALLBACK_MOVE_EFFECTS.scissorsGif,
  ),
  paperGif: resolvePublicAssetUrl(
    avatar?.paperGif || PREMIUM_FALLBACK_MOVE_EFFECTS.paperGif,
  ),
});

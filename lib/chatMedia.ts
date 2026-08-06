const API_BASE_ORIGIN = String(process.env.NEXT_PUBLIC_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

export const resolveChatImageUrl = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("data:image/")) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (
    normalized.startsWith("/media/chat") ||
    normalized.startsWith("/media/chat-bot")
  ) {
    if (API_BASE_ORIGIN) {
      return `${API_BASE_ORIGIN}${normalized}`;
    }
  }

  return normalized;
};

export const CHAT_EMOJIS = [
  "👍",
  "🔥",
  "👏",
  "😂",
  "😊",
  "❤️",
  "🏆",
  "💯",
  "🎉",
  "🤝",
  "⚡",
  "👑",
];

export type LiveStickerMotion =
  | "bounce"
  | "pulse"
  | "shake"
  | "wave"
  | "spin"
  | "glow";

export type LiveSticker = {
  emoji: string;
  motion: LiveStickerMotion;
};

export const CHAT_LIVE_STICKERS: LiveSticker[] = [
  { emoji: "🔥", motion: "pulse" },
  { emoji: "🏆", motion: "bounce" },
  { emoji: "💯", motion: "glow" },
  { emoji: "🎉", motion: "shake" },
  { emoji: "👑", motion: "wave" },
  { emoji: "⚡", motion: "spin" },
  { emoji: "🤝", motion: "bounce" },
  { emoji: "👏", motion: "pulse" },
  { emoji: "😂", motion: "shake" },
  { emoji: "❤️", motion: "pulse" },
  { emoji: "🚀", motion: "bounce" },
  { emoji: "💪", motion: "glow" },
];

const STICKER_MOTION_CLASS: Record<LiveStickerMotion, string> = {
  bounce: "stickerMotionBounce",
  pulse: "stickerMotionPulse",
  shake: "stickerMotionShake",
  wave: "stickerMotionWave",
  spin: "stickerMotionSpin",
  glow: "stickerMotionGlow",
};

const stickerMotionByEmoji = new Map(
  CHAT_LIVE_STICKERS.map((sticker) => [sticker.emoji, sticker.motion]),
);

export const getLiveStickerMotionClass = (emoji?: string | null) => {
  const motion = stickerMotionByEmoji.get(String(emoji || "").trim());
  if (!motion) {
    return "stickerMotionPulse";
  }
  return STICKER_MOTION_CLASS[motion];
};

export const formatChatMessageTime = (
  timestamp: number | null | undefined,
  now: number,
) => {
  if (!timestamp) {
    return "now";
  }

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) {
    return "now";
  }

  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return `${mins}m`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

import type { ReactionMediaBundle } from "./types";

const API_BASE_ORIGIN = String(process.env.NEXT_PUBLIC_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

export const MATCH_FINISH_OUTCOME_REVEAL_MS = 800;
export const MATCH_FINISH_DISMISS_MS = 10000;

export const DEFAULT_REACTION_MEDIA: ReactionMediaBundle = {
  winner: {
    videoSrc: "/media/reactions/winner.mp4",
    posterSrc: "/media/reactions/winner-poster.jpg",
    videoReady: false,
  },
  loser: {
    videoSrc: "/media/reactions/loser.mp4",
    posterSrc: "/media/reactions/loser-poster.jpg",
    videoReady: false,
  },
};

const isBackendMediaPath = (value: string) =>
  value.startsWith("/media/reactions/") ||
  value.startsWith("/media/avatars/");

const appendCacheVersion = (url: string, cacheVersion?: string | null) => {
  const version = String(cacheVersion || "").trim();
  if (!version) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

export const resolveReactionMediaUrl = (
  value?: string | null,
  cacheVersion?: string | null,
) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return appendCacheVersion(normalized, cacheVersion);
  }

  if (isBackendMediaPath(normalized) && API_BASE_ORIGIN) {
    return appendCacheVersion(`${API_BASE_ORIGIN}${normalized}`, cacheVersion);
  }

  return appendCacheVersion(normalized, cacheVersion);
};

export function resolveReactionMediaBundle(
  bundle?: ReactionMediaBundle | null,
): ReactionMediaBundle {
  const source = bundle || DEFAULT_REACTION_MEDIA;

  return {
    winner: {
      videoSrc: resolveReactionMediaUrl(
        source.winner.videoSrc,
        source.winner.cacheVersion,
      ),
      posterSrc: resolveReactionMediaUrl(
        source.winner.posterSrc,
        source.winner.cacheVersion,
      ),
      videoReady: Boolean(source.winner.videoReady),
      cacheVersion: source.winner.cacheVersion ?? null,
    },
    loser: {
      videoSrc: resolveReactionMediaUrl(
        source.loser.videoSrc,
        source.loser.cacheVersion,
      ),
      posterSrc: resolveReactionMediaUrl(
        source.loser.posterSrc,
        source.loser.cacheVersion,
      ),
      videoReady: Boolean(source.loser.videoReady),
      cacheVersion: source.loser.cacheVersion ?? null,
    },
  };
}

export function preloadReactionMedia(bundle: ReactionMediaBundle) {
  if (typeof document === "undefined") {
    return;
  }

  for (const media of [bundle.winner, bundle.loser]) {
    if (media.posterSrc) {
      const img = new Image();
      img.src = media.posterSrc;
    }

    if (!media.videoReady || !media.videoSrc) {
      continue;
    }

    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = media.videoSrc;
    video.load();
  }
}

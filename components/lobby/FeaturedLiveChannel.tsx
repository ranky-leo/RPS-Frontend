"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";

const FEATURED_VIDEO_URL =
  "https://zhfnufzsimulopgojpkb.supabase.co/storage/v1/object/public/Roshambo%20Videos/Play.mp4";

const FEATURED_LIVE_AD_IMAGE = "/Video.png";
const FEATURED_POSTER_HOLD_MS = 4000;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenVideoElement = HTMLVideoElement &
  FullscreenCapableElement & {
    webkitEnterFullscreen?: () => void;
  };

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

const getFullscreenElement = () => {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
};

const requestElementFullscreen = async (element: HTMLElement) => {
  const el = element as FullscreenCapableElement;

  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }

  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
    return;
  }

  if (el.mozRequestFullScreen) {
    await el.mozRequestFullScreen();
    return;
  }

  if (el.msRequestFullscreen) {
    await el.msRequestFullscreen();
  }
};

const requestVideoFullscreen = async (video: HTMLVideoElement) => {
  const element = video as FullscreenVideoElement;

  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }

  if (element.webkitRequestFullscreen) {
    await element.webkitRequestFullscreen();
    return;
  }

  if (element.webkitEnterFullscreen) {
    element.webkitEnterFullscreen();
    return;
  }

  if (element.mozRequestFullScreen) {
    await element.mozRequestFullScreen();
    return;
  }

  if (element.msRequestFullscreen) {
    await element.msRequestFullscreen();
  }
};

const exitVideoFullscreen = async () => {
  const doc = document as FullscreenDocument;

  if (doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }

  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
    return;
  }

  if (doc.mozCancelFullScreen) {
    await doc.mozCancelFullScreen();
    return;
  }

  if (doc.msExitFullscreen) {
    await doc.msExitFullscreen();
  }
};

type FeaturedLiveChannelProps = {
  isAuthenticated?: boolean;
};

export function FeaturedLiveChannel({
  isAuthenticated = false,
}: FeaturedLiveChannelProps) {
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const watchMissionReportedRef = useRef(false);
  const lastTrackedTimeRef = useRef(0);
  const posterTimerRef = useRef<number | null>(null);

  const clearPosterTimer = useCallback(() => {
    if (posterTimerRef.current != null) {
      window.clearTimeout(posterTimerRef.current);
      posterTimerRef.current = null;
    }
  }, []);

  const [showPoster, setShowPoster] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const syncInlineProgress = useCallback(() => {
    const video = inlineVideoRef.current;
    if (!video) {
      return;
    }

    setCurrentTime(video.currentTime);
    if (Number.isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
    setIsPlaying(!video.paused);
  }, []);

  const reportWatchMission = useCallback(async () => {
    if (!isAuthenticated || watchMissionReportedRef.current) {
      return;
    }

    watchMissionReportedRef.current = true;

    try {
      await api.dailyMissionWatchLiveVideo();
      window.dispatchEvent(new CustomEvent("rps:daily-mission-refresh"));
    } catch {
      watchMissionReportedRef.current = false;
    }
  }, [isAuthenticated]);

  const maybeCompleteWatchMission = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }

      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.75) {
        void reportWatchMission();
      }
    },
    [reportWatchMission],
  );

  const trackVideoProgress = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video) {
        return;
      }

      const current = video.currentTime;
      const previous = lastTrackedTimeRef.current;

      if (current + 0.5 < previous) {
        lastTrackedTimeRef.current = current;
        return;
      }

      lastTrackedTimeRef.current = current;
      maybeCompleteWatchMission(video);
    },
    [maybeCompleteWatchMission],
  );

  const playFeaturedVideo = useCallback(async () => {
    const video = inlineVideoRef.current;
    if (!video) {
      return;
    }

    clearPosterTimer();
    setShowPoster(false);
    video.muted = muted;
    video.currentTime = 0;
    lastTrackedTimeRef.current = 0;

    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      setShowPoster(true);
      setIsPlaying(false);
    }
  }, [clearPosterTimer, muted]);

  const showPosterAndScheduleReplay = useCallback(() => {
    const video = inlineVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }

    setShowPoster(true);
    setIsPlaying(false);
    setCurrentTime(0);
    lastTrackedTimeRef.current = 0;

    clearPosterTimer();
    posterTimerRef.current = window.setTimeout(() => {
      posterTimerRef.current = null;
      void playFeaturedVideo();
    }, FEATURED_POSTER_HOLD_MS);
  }, [clearPosterTimer, playFeaturedVideo]);

  const playFeaturedVideoRef = useRef(playFeaturedVideo);
  playFeaturedVideoRef.current = playFeaturedVideo;

  useEffect(() => {
    posterTimerRef.current = window.setTimeout(() => {
      posterTimerRef.current = null;
      void playFeaturedVideoRef.current();
    }, FEATURED_POSTER_HOLD_MS);

    return () => {
      clearPosterTimer();
    };
  }, [clearPosterTimer]);

  useEffect(() => {
    const video = inlineVideoRef.current;
    if (!video) {
      return;
    }

    const onLoadedMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const onInlineEnded = () => {
      void reportWatchMission();
      showPosterAndScheduleReplay();
    };

    const onInlineTimeUpdate = () => {
      syncInlineProgress();
      trackVideoProgress(video);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onInlineTimeUpdate);
    video.addEventListener("play", syncInlineProgress);
    video.addEventListener("pause", syncInlineProgress);
    video.addEventListener("ended", onInlineEnded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onInlineTimeUpdate);
      video.removeEventListener("play", syncInlineProgress);
      video.removeEventListener("pause", syncInlineProgress);
      video.removeEventListener("ended", onInlineEnded);
    };
  }, [
    reportWatchMission,
    showPosterAndScheduleReplay,
    syncInlineProgress,
    trackVideoProgress,
  ]);

  useEffect(() => {
    const video = inlineVideoRef.current;
    const player = playerRef.current;
    if (!video) {
      return;
    }

    const syncFullscreenState = () => {
      const current = getFullscreenElement();
      setIsFullscreen(current === video || current === player);
    };

    const onWebkitBeginFullscreen = () => {
      setIsFullscreen(true);
    };

    const onWebkitEndFullscreen = () => {
      setIsFullscreen(false);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    video.addEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen);
    video.addEventListener("webkitendfullscreen", onWebkitEndFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFullscreenState,
      );
      video.removeEventListener(
        "webkitbeginfullscreen",
        onWebkitBeginFullscreen,
      );
      video.removeEventListener("webkitendfullscreen", onWebkitEndFullscreen);
    };
  }, []);

  const enterFullscreenPlayback = async () => {
    const video = inlineVideoRef.current;
    const player = playerRef.current;
    if (!video || !player) {
      return;
    }

    clearPosterTimer();

    const fullscreenTarget = getFullscreenElement();
    if (
      fullscreenTarget === player ||
      fullscreenTarget === video ||
      isFullscreen
    ) {
      setShowPoster(false);
      video.muted = muted;
      if (video.paused) {
        try {
          await video.play();
          setIsPlaying(true);
        } catch {
          setShowPoster(true);
          setIsPlaying(false);
        }
      }
      return;
    }

    setShowPoster(false);
    video.muted = muted;

    try {
      if (video.paused) {
        await video.play();
        setIsPlaying(true);
      }

      try {
        await requestElementFullscreen(player);
      } catch {
        await requestVideoFullscreen(video);
      }

      setIsFullscreen(true);
    } catch {
      setIsFullscreen(false);
      if (video.paused) {
        setShowPoster(true);
        setIsPlaying(false);
      }
    }
  };

  const toggleInlinePlay = async () => {
    const video = inlineVideoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      clearPosterTimer();
      setShowPoster(false);
      video.muted = muted;
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setShowPoster(true);
        setIsPlaying(false);
      }
      return;
    }

    video.pause();
    setIsPlaying(false);
  };

  const toggleMute = () => {
    const video = inlineVideoRef.current;
    if (!video) {
      return;
    }

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  };

  const toggleFullscreen = async () => {
    const video = inlineVideoRef.current;
    const player = playerRef.current;
    if (!video || !player) {
      return;
    }

    const fullscreenTarget = getFullscreenElement();
    if (
      fullscreenTarget === player ||
      fullscreenTarget === video ||
      isFullscreen
    ) {
      try {
        await exitVideoFullscreen();
      } catch {
        // Ignore fullscreen exit errors.
      }
      return;
    }

    await enterFullscreenPlayback();
  };

  const onProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const video = inlineVideoRef.current;
    if (!video || duration <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    video.currentTime = ratio * duration;
    syncInlineProgress();
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <section className="featuredLiveChannel" aria-label="Featured live video">
        <div className="featuredLiveChannelHeader">
          <h2 className="featuredLiveChannelTitle">Featured Match</h2>
          {/* <span className="liveBadge">Live</span> */}
        </div>

        <div className="featuredLiveChannelStage">
          <div className="featuredLiveBannerFrame">
            <div className="featuredLivePlayer" ref={playerRef}>
              <video
                ref={inlineVideoRef}
                className="featuredLiveInlineVideo"
                src={FEATURED_VIDEO_URL}
                playsInline
                preload="auto"
                muted={muted}
              />

              {showPoster ? (
                <img
                  className="featuredLiveAdImage"
                  src={FEATURED_LIVE_AD_IMAGE}
                  alt="Featured live video advertisement"
                  width={1536}
                  height={1024}
                  loading="eager"
                  decoding="async"
                />
              ) : null}

              {showPoster ? (
                <div className="featuredLivePromoOverlay">
                  <button
                    className="featuredLiveWatchNowBtn"
                    type="button"
                    onClick={() => {
                      void enterFullscreenPlayback();
                    }}
                  >
                    <span className="featuredLiveWatchNowIcon" aria-hidden>
                      ▶
                    </span>
                    WATCH NOW
                  </button>
                </div>
              ) : null}

              <div className="featuredLiveControls" aria-label="Video controls">
                <button
                  className="featuredLiveCtrlBtn featuredLiveCtrlBtnPlay"
                  type="button"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                  onClick={() => {
                    void toggleInlinePlay();
                  }}
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <button
                  className="featuredLiveCtrlBtn featuredLiveCtrlBtnVolume"
                  type="button"
                  aria-label={muted ? "Unmute video" : "Mute video"}
                  aria-pressed={muted}
                  onClick={toggleMute}
                >
                  {muted ? "🔇" : "🔊"}
                </button>
                <span className="featuredLiveTime">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <div
                  className="featuredLiveProgress"
                  role="progressbar"
                  aria-valuenow={Math.round(progressPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Playback progress"
                  onClick={onProgressClick}
                >
                  <span
                    className="featuredLiveProgressPlayed"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="featuredLiveQuality">1080p</span>
                <button
                  className="featuredLiveCtrlBtn featuredLiveCtrlBtnExpand"
                  type="button"
                  aria-label={
                    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                  }
                  onClick={() => {
                    void toggleFullscreen();
                  }}
                >
                  ⛶
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

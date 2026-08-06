"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactionMediaItem } from "../../lib/types";

type MatchResultCharacterProps = {
  variant: "winner" | "loser";
  amountLabel: string;
  media: ReactionMediaItem;
};

export function MatchResultCharacter({
  variant,
  amountLabel,
  media,
}: MatchResultCharacterProps) {
  const isWinner = variant === "winner";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const shouldUseVideo = media.videoReady && Boolean(media.videoSrc);

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);
  }, [media.videoSrc, media.videoReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldUseVideo || videoFailed) {
      return;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const playVideo = () => {
      void video.play().catch(() => {
        setVideoFailed(true);
      });
    };

    const onCanPlay = () => {
      setVideoReady(true);
      playVideo();
    };

    const onError = () => {
      setVideoFailed(true);
    };

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    playVideo();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
    };
  }, [media.videoSrc, shouldUseVideo, videoFailed]);

  const showVideo = shouldUseVideo && videoReady && !videoFailed;

  return (
    <div className={`playerResultEmote ${isWinner ? "winner" : "loser"}`}>
      <span className={`resultAmount ${isWinner ? "win" : "loss"}`}>
        {amountLabel}
      </span>
      <div
        className={`liveReactionPanel ${isWinner ? "liveReactionPanel--win" : "liveReactionPanel--loss"}`}
        aria-hidden
      >
        <div className="liveReactionFrame">
          <span className="liveReactionBadge">LIVE</span>
          <span className="liveReactionRecDot" />
          <img
            className={`liveReactionPoster${showVideo ? " isHidden" : ""}`}
            src={media.posterSrc}
            alt=""
            loading="eager"
            decoding="async"
          />
          {shouldUseVideo && !videoFailed ? (
            <video
              ref={videoRef}
              className={`liveReactionVideo${showVideo ? " isVisible" : ""}`}
              src={media.videoSrc}
              poster={media.posterSrc}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
            />
          ) : null}
          <span className="liveReactionSignalBars">
            <span />
            <span />
            <span />
          </span>
          <span className="liveReactionFlicker" />
          <span className="liveReactionGrain" />
          <span className="liveReactionVignette" />
          <span className="liveReactionScanline" />
        </div>
      </div>
      <span className="resultLabel">
        {isWinner ? "Victory Dance!" : "Head hung low..."}
      </span>
    </div>
  );
}

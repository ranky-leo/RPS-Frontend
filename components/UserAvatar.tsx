"use client";

import { isPremadeRpsAvatar, resolveAvatar } from "../lib/avatars";

type UserAvatarProps = {
  avatar?: string | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
};

export function UserAvatar({
  avatar,
  alt = "",
  className = "",
  loading,
}: UserAvatarProps) {
  const resolved = resolveAvatar(avatar);
  const premade =
    isPremadeRpsAvatar(avatar) || isPremadeRpsAvatar(resolved);
  const classes = className.trim();

  if (premade) {
    return (
      <div className={`rpsAvatarSlot${classes ? ` ${classes}` : ""}`}>
        <img
          className="rpsAvatarFrameImage"
          src={resolved}
          alt={alt}
          loading={loading}
          decoding="async"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <img
      className={classes}
      src={resolved}
      alt={alt}
      loading={loading}
      decoding="async"
      draggable={false}
    />
  );
}

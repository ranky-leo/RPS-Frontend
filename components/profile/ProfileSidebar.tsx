"use client";

import { isPremadeRpsAvatar } from "../../lib/avatars";

type ProfileSidebarProps = {
  username: string;
  avatarUrl: string;
  avatarSource?: string | null;
  memberSince?: string | null;
  onEditAvatar?: () => void;
};

const formatMemberSince = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

export function ProfileSidebar({
  username,
  avatarUrl,
  avatarSource,
  memberSince,
  onEditAvatar,
}: ProfileSidebarProps) {
  const memberSinceLabel = formatMemberSince(memberSince);
  const premadeAvatar =
    isPremadeRpsAvatar(avatarSource) || isPremadeRpsAvatar(avatarUrl);

  return (
    <aside className="profileSidebar" aria-label="Profile overview">
      <div className="profileSidebarHeader">
        <div
          className={`profileSidebarAvatarWrap${premadeAvatar ? " profileSidebarAvatarWrapPremade rpsAvatarFrame" : ""}`}
        >
          {premadeAvatar ? (
            <img
              className="rpsAvatarFrameImage"
              src={avatarUrl}
              alt={`${username || "User"} avatar`}
            />
          ) : (
            <div className="profileSidebarAvatarRing">
              <img
                className="profileSidebarAvatar"
                src={avatarUrl}
                alt={`${username || "User"} avatar`}
              />
            </div>
          )}
          <button
            type="button"
            className="profileSidebarAvatarEdit"
            aria-label="Change avatar"
            onClick={onEditAvatar}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </button>
        </div>

        <h3 className="profileSidebarName">{username || "Player"}</h3>

        {memberSinceLabel ? (
          <p className="profileSidebarMemberSince">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
            </svg>
            <span>Member since {memberSinceLabel}</span>
          </p>
        ) : null}
      </div>
    </aside>
  );
}

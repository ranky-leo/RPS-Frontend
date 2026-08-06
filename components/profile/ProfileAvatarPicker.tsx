"use client";

import { useState } from "react";
import {
  AVATAR_OPTIONS,
  isPremadeRpsAvatar,
  resolveAvatar,
} from "../../lib/avatars";
import type { ShopAvatarOption } from "../../lib/types";

type ProfileAvatarPickerTab = "default" | "my";

type ProfileAvatarPickerProps = {
  currentAvatar: string;
  ownedAvatars: ShopAvatarOption[];
  loading?: boolean;
  onSelectAvatar: (avatarUrl: string) => void;
  onFileSelect: (file: File | undefined) => void | Promise<void>;
};

export function ProfileAvatarPicker({
  currentAvatar,
  ownedAvatars,
  loading = false,
  onSelectAvatar,
  onFileSelect,
}: ProfileAvatarPickerProps) {
  const [tab, setTab] = useState<ProfileAvatarPickerTab>("default");
  const resolvedCurrentAvatar = resolveAvatar(currentAvatar);

  return (
    <div className="profileAvatarWindow">
      <div
        className="profileAvatarPickerTabs"
        role="tablist"
        aria-label="Avatar collections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "default"}
          className={`profileAvatarPickerTab${tab === "default" ? " active" : ""}`}
          onClick={() => setTab("default")}
        >
          Default
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "my"}
          className={`profileAvatarPickerTab${tab === "my" ? " active" : ""}`}
          onClick={() => setTab("my")}
        >
          My Avatars
        </button>
      </div>

      {tab === "default" ? (
        <>
          <div className="avatarPicker profileAvatarPicker" role="radiogroup">
            {AVATAR_OPTIONS.map((option) => (
              <button
                key={`profile-${option.id}`}
                type="button"
                className={`avatarOption${resolvedCurrentAvatar === option.url ? " active" : ""}`}
                onClick={() => onSelectAvatar(option.url)}
                aria-pressed={resolvedCurrentAvatar === option.url}
              >
                <img src={option.url} alt={option.label} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          <input
            className="input profileInput"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ marginTop: 10 }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              void onFileSelect(file);
              event.currentTarget.value = "";
            }}
          />
        </>
      ) : loading ? (
        <p className="profileAvatarPickerEmpty">Loading your avatars...</p>
      ) : ownedAvatars.length === 0 ? (
        <p className="profileAvatarPickerEmpty">
          No premium avatars yet. Use Buy Avatar to unlock one.
        </p>
      ) : (
        <div className="avatarPicker profileAvatarPicker" role="radiogroup">
          {ownedAvatars.map((entry) => {
            const resolvedImage = resolveAvatar(entry.imageUrl);
            const isPremade = isPremadeRpsAvatar(entry.imageUrl);
            const isActive = resolvedCurrentAvatar === resolvedImage;

            return (
              <button
                key={`profile-owned-${entry.id}`}
                type="button"
                className={`avatarOption profileAvatarOptionOwned${isPremade ? " profileAvatarOptionPremade" : ""}${isActive ? " active" : ""}`}
                onClick={() => onSelectAvatar(entry.imageUrl)}
                aria-pressed={isActive}
              >
                <div
                  className={
                    isPremade
                      ? "profileAvatarOptionImageWrap rpsAvatarFrame"
                      : "profileAvatarOptionImageWrap"
                  }
                >
                  <img
                    className={isPremade ? "rpsAvatarFrameImage" : undefined}
                    src={resolvedImage}
                    alt={entry.label}
                  />
                </div>
                <span>{entry.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import type { AvatarMoveEffectSet, AvatarMoveKey } from "../../lib/types";
import type { MatchMove } from "../../lib/matchMoveEffects";
import { AVATAR_MOVE_LABELS } from "../../lib/avatarEffects";
import { MatchMoveAnimatedPreview } from "../match/MatchMovePreview";

type AvatarMoveEffectPreviewProps = {
  avatarUrl?: string | null;
  moveEffects?: Partial<AvatarMoveEffectSet> | null;
  title: string;
  variant?: "standard" | "premium";
  layout?: "default" | "rail";
};

const MOVE_ORDER: Array<{ key: AvatarMoveKey; move: MatchMove }> = [
  { key: "stone", move: "rock" },
  { key: "scissors", move: "scissors" },
  { key: "paper", move: "paper" },
];

export function AvatarMoveEffectPreview({
  avatarUrl,
  moveEffects,
  title,
  variant = "standard",
  layout = "default",
}: AvatarMoveEffectPreviewProps) {
  const isRail = layout === "rail";
  const displayHeight = isRail ? 48 : 72;

  return (
    <section
      className={`profileShopMovePreview profileShopMovePreview${variant === "premium" ? "Premium" : "Standard"}${isRail ? " profileShopMovePreviewRail" : ""}`}
      aria-label={`${title} move effect preview`}
    >
      <div className="profileShopMovePreviewHead">
        <div>
          <p className="profileShopMovePreviewEyebrow">Match move preview</p>
          {!isRail ? (
            <h3 className="profileShopMovePreviewTitle">{title}</h3>
          ) : null}
        </div>
        <span
          className={`profileShopMovePreviewBadge profileShopMovePreviewBadge${variant === "premium" ? "Premium" : "Standard"}`}
        >
          {variant === "premium" ? "Sprite animations" : "Classic moves"}
        </span>
      </div>

      <div
        className="profileShopMovePreviewGrid"
        aria-label="Stone, scissors, and paper effect previews"
      >
        {MOVE_ORDER.map(({ key, move }) => (
          <div key={key} className="profileShopMovePreviewItem">
            <div className="profileShopMovePreviewStage">
              <MatchMoveAnimatedPreview
                move={move}
                avatarUrl={avatarUrl}
                moveEffects={moveEffects}
                displayHeight={displayHeight}
                showGlow
                loop
              />
            </div>
            <span className="profileShopMovePreviewLabel">
              {AVATAR_MOVE_LABELS[key]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import type { ShopAvatarOption } from "../../lib/types";
import { BuyAvatarModal } from "./BuyAvatarModal";
import { BuyNameModal } from "./BuyNameModal";

type StoreSection = "avatars" | "names";

const NAMES_SHOP_ENABLED = false;

type ProfileStorePanelProps = {
  currentAvatarUrl: string;
  currentUsername: string;
  balanceUsdt: number;
  balanceRac: number;
  avatars: ShopAvatarOption[];
  avatarsLoading?: boolean;
  purchasing?: boolean;
  onPurchaseAvatar: (avatarId: string) => void;
  onSelectAvatar: (avatarId: string) => void;
};

export function ProfileStorePanel({
  currentAvatarUrl,
  currentUsername,
  balanceUsdt,
  balanceRac,
  avatars,
  avatarsLoading = false,
  purchasing = false,
  onPurchaseAvatar,
  onSelectAvatar,
}: ProfileStorePanelProps) {
  const [section, setSection] = useState<StoreSection>("avatars");

  return (
    <div className="profileStorePanel">
      <div
        className="profileHistoryTabRow profileStoreSectionTabs"
        role="tablist"
        aria-label="Store sections"
      >
        <button
          className={`profileHistoryTab${section === "avatars" ? " active" : ""}`}
          type="button"
          role="tab"
          aria-selected={section === "avatars"}
          onClick={() => setSection("avatars")}
        >
          Buy Avatar
        </button>
        <button
          className={`profileHistoryTab profileHistoryTabDisabled${section === "names" ? " active" : ""}`}
          type="button"
          role="tab"
          aria-selected={section === "names"}
          aria-disabled="true"
          disabled={!NAMES_SHOP_ENABLED}
          title={NAMES_SHOP_ENABLED ? undefined : "Coming soon"}
          onClick={() => {
            if (NAMES_SHOP_ENABLED) {
              setSection("names");
            }
          }}
        >
          Buy Name
        </button>
      </div>

      {section === "avatars" || !NAMES_SHOP_ENABLED ? (
        <BuyAvatarModal
          embedded
          open
          currentAvatarUrl={currentAvatarUrl}
          balanceUsdt={balanceUsdt}
          balanceRac={balanceRac}
          avatars={avatars}
          loading={avatarsLoading}
          purchasing={purchasing}
          onClose={() => {}}
          onPurchase={onPurchaseAvatar}
          onSelect={onSelectAvatar}
        />
      ) : (
        <BuyNameModal
          embedded
          open
          currentUsername={currentUsername}
          balanceRac={balanceRac}
          names={[]}
          loading={false}
          purchasing={false}
          onClose={() => {}}
          onPurchase={() => {}}
          onSelect={() => {}}
        />
      )}
    </div>
  );
}

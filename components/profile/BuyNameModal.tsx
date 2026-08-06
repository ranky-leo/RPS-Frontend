"use client";

import { useMemo, useState } from "react";
import type { ShopNameOption } from "../../lib/types";
import { ShopRacAmount } from "./ShopRacAmount";

type BuyNameModalProps = {
  open: boolean;
  embedded?: boolean;
  currentUsername: string;
  balanceRac: number;
  names: ShopNameOption[];
  loading?: boolean;
  purchasing?: boolean;
  onClose: () => void;
  onPurchase: (nameId: string) => void;
  onSelect: (nameId: string) => void;
};

type NameCardProps = {
  entry: ShopNameOption;
  selected: boolean;
  isCurrent?: boolean;
  compact?: boolean;
  onSelect: () => void;
};

function NameCard({
  entry,
  selected,
  isCurrent = false,
  compact = false,
  onSelect,
}: NameCardProps) {
  return (
    <button
      type="button"
      className={`profileShopNameCard${compact ? " profileShopNameCardCompact" : ""}${isCurrent ? " profileShopNameCardCurrent" : ""}${selected ? " active" : ""}${entry.taken && !entry.owned ? " profileShopNameCardTaken" : ""}`}
      onClick={onSelect}
      disabled={Boolean(entry.taken && !entry.owned)}
      aria-label={entry.name}
      title={entry.name}
    >
      <div className="profileShopNameCardBody">
        <span className="profileShopNameCardText">{entry.name}</span>
        {isCurrent ? (
          <span className="profileShopAvatarCurrentCheck" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          </span>
        ) : null}
      </div>
      {compact ? (
        <span className="profileShopAvatarCardMeta">
          {isCurrent ? (
            <span className="profileShopAvatarCurrentLabel">Current</span>
          ) : entry.owned ? (
            <span className="profileShopAvatarOwnedLabel">Owned</span>
          ) : entry.taken ? (
            <span className="profileShopNameTakenLabel">Taken</span>
          ) : (
            <span className="profileShopAvatarPrice">
              <ShopRacAmount amount={entry.priceRac} />
            </span>
          )}
        </span>
      ) : isCurrent ? (
        <span className="profileShopAvatarCurrentLabel">Current</span>
      ) : entry.owned ? (
        <span className="profileShopAvatarOwnedLabel">Owned</span>
      ) : entry.taken ? (
        <span className="profileShopNameTakenLabel">Taken</span>
      ) : (
        <span className="profileShopAvatarPrice">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z" />
          </svg>
          <ShopRacAmount amount={entry.priceRac} />
        </span>
      )}
    </button>
  );
}

export function BuyNameModal({
  open,
  embedded = false,
  currentUsername,
  balanceRac,
  names,
  loading = false,
  purchasing = false,
  onClose,
  onPurchase,
  onSelect,
}: BuyNameModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const catalogNames = useMemo(
    () =>
      names.filter(
        (entry) =>
          entry.name.trim().toLowerCase() !==
          String(currentUsername || "").trim().toLowerCase(),
      ),
    [currentUsername, names],
  );

  const selectedName = names.find((entry) => entry.id === selectedId);
  const isCurrentSelected = !selectedId;
  const canSelectOwned = Boolean(selectedName?.owned);
  const previewName = selectedName?.name || currentUsername || "Player";
  const previewLabel = selectedName?.name || "Current name";

  const availabilityLabel = isCurrentSelected
    ? "Equipped on your profile"
    : selectedName?.owned
      ? "Owned and ready to equip"
      : selectedName?.taken
        ? "Taken by another player"
        : selectedName
          ? "Available to purchase"
          : "Equipped on your profile";

  const purchaseButton = selectedName?.owned ? (
      <button
        type="button"
        className="profileShopPurchaseBtn"
        disabled={!canSelectOwned || purchasing || isCurrentSelected}
        onClick={() => {
          if (selectedName) {
            onSelect(selectedName.id);
          }
        }}
      >
        Use Name
      </button>
    ) : (
      <button
        type="button"
        className="profileShopPurchaseBtn"
        disabled={!selectedName || selectedName.taken || purchasing}
        onClick={() => {
          if (selectedName) {
            onPurchase(selectedName.id);
          }
        }}
      >
        {selectedName &&
        selectedName.priceRac > balanceRac &&
        !selectedName.owned
          ? "Insufficient RAC"
          : "Buy Name"}
      </button>
    );

  const shopLayout = (
    <div className="profileShopAvatarLayout profileShopNameLayout">
      <aside
        className="profileShopAvatarRail profileShopNameRail"
        aria-label="Selected name preview"
      >
        <div className="profileShopNameHero">
          <div className="profileShopNameHeroDisplay" aria-hidden="true">
            <span className="profileShopNameHeroInitial">
              {previewName.trim().charAt(0).toUpperCase() || "?"}
            </span>
          </div>
          <div className="profileShopAvatarHeroCopy">
            <p className="profileShopAvatarHeroEyebrow">Selected</p>
            <h3 className="profileShopAvatarHeroTitle">{previewLabel}</h3>
            {isCurrentSelected ? (
              <span className="profileShopAvatarHeroBadge profileShopAvatarHeroBadgeEquipped">
                Equipped
              </span>
            ) : selectedName?.owned ? (
              <span className="profileShopAvatarHeroBadge profileShopAvatarHeroBadgeOwned">
                Owned
              </span>
            ) : selectedName?.taken ? (
              <span className="profileShopNameHeroBadgeTaken">Taken</span>
            ) : selectedName ? (
              <span className="profileShopAvatarHeroBadge profileShopAvatarHeroBadgePrice">
                <ShopRacAmount amount={selectedName.priceRac} />
              </span>
            ) : (
              <span className="profileShopAvatarHeroBadge profileShopAvatarHeroBadgeEquipped">
                Equipped
              </span>
            )}
          </div>
        </div>

        <section
          className="profileShopNameDetails profileShopNameDetailsRail"
          aria-label="Name profile preview"
        >
          <div className="profileShopNameDetailsHead">
            <div>
              <p className="profileShopMovePreviewEyebrow">Profile preview</p>
              <h3 className="profileShopNameDetailsTitle">{previewName}</h3>
            </div>
            <span className="profileShopNameDetailsBadge">Premium name</span>
          </div>

          <div className="profileShopNameDetailsBody">
            <div className="profileShopNameDetailsRow">
              <span className="profileShopNameDetailsLabel">Displayed as</span>
              <span className="profileShopNameDetailsValue">{previewName}</span>
            </div>
            <div className="profileShopNameDetailsRow">
              <span className="profileShopNameDetailsLabel">Availability</span>
              <span className="profileShopNameDetailsValue">
                {availabilityLabel}
              </span>
            </div>
          </div>
        </section>

        <div className="profileShopRailFooter">
          <div className="profileShopBalance">
            <span>Balance</span>
            <ShopRacAmount
              amount={balanceRac}
              className="profileShopBalanceAmount"
            />
          </div>
          {purchaseButton}
          <p className="profileShopDisclaimer profileShopDisclaimerRail">
            Names are unique and visible to all players.
          </p>
        </div>
      </aside>

      <div className="profileShopAvatarCatalog profileShopNameCatalog">
        <div className="profileShopCatalogHead">
          <h3 className="profileShopCatalogTitle">Browse names</h3>
          <span className="profileShopCatalogCount">
            {catalogNames.length + 1} items
          </span>
        </div>

        {loading ? (
          <p className="profileShopAvatarDragHint">Loading names...</p>
        ) : (
          <div
            className="profileShopAvatarGridExpanded profileShopNameGridCatalog"
            aria-label="Name shop grid"
          >
            <NameCard
              entry={{
                id: "__current__",
                name: currentUsername || "Player",
                priceRac: 0,
                owned: true,
                taken: false,
                equipped: true,
              }}
              selected={isCurrentSelected}
              isCurrent
              compact
              onSelect={() => setSelectedId(null)}
            />
            {catalogNames.map((entry) => (
              <NameCard
                key={entry.id}
                entry={entry}
                selected={selectedId === entry.id}
                compact
                onSelect={() => setSelectedId(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!embedded && !open) {
    return null;
  }

  const content = embedded ? (
    shopLayout
  ) : (
    <>
      <div className="profileShopModalTop">
        <div className="profileShopModalHeading">
          <span
            className="profileShopModalHeadingIcon profileShopModalHeadingIconPurple"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 2l2.39 7.26H22l-6.19 4.5 2.36 7.24L12 16.77 5.83 21l2.36-7.24L2 9.26h7.61L12 2z" />
            </svg>
          </span>
          <div>
            <h2 id="buy-name-modal-title" className="profileShopModalTitle">
              Buy Name
            </h2>
            <p className="profileShopModalSubtitle">
              Choose a unique name to stand out in the arena!
            </p>
          </div>
        </div>
        <button
          type="button"
          className="profileShopModalClose"
          aria-label="Close buy name modal"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {shopLayout}
    </>
  );

  if (embedded) {
    return (
      <div className="profileShopEmbedded profileShopEmbeddedName">
        {content}
      </div>
    );
  }

  return (
    <div
      className="backdrop profileShopBackdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal profileShopModal profileShopModalName"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-name-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}

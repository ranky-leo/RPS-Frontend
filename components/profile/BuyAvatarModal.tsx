"use client";

import { useMemo, useState } from "react";
import type { ShopAvatarOption, ShopPaymentCurrency } from "../../lib/types";
import { isPremadeRpsAvatar, resolveAvatar } from "../../lib/avatars";
import { ShopPriceAmount } from "./ShopRacAmount";
import { AvatarMoveEffectPreview } from "./AvatarMoveEffectPreview";

type BuyAvatarModalProps = {
  open: boolean;
  embedded?: boolean;
  currentAvatarUrl: string;
  balanceUsdt: number;
  balanceRac: number;
  avatars: ShopAvatarOption[];
  loading?: boolean;
  purchasing?: boolean;
  onClose: () => void;
  onPurchase: (avatarId: string) => void;
  onSelect: (avatarId: string) => void;
};

const isPremadeRpsAvatarUrl = isPremadeRpsAvatar;

const getAvatarImageWrapClassName = (
  imageUrl: string,
  extraClass = "",
) => {
  const classes = ["profileShopAvatarImageWrap"];
  if (extraClass) {
    classes.push(extraClass);
  }
  if (isPremadeRpsAvatarUrl(imageUrl)) {
    classes.push("profileShopAvatarImageWrapPremade", "rpsAvatarFrame");
  }
  return classes.join(" ");
};

type AvatarCardProps = {
  imageUrl: string;
  label: string;
  selected: boolean;
  isCurrent?: boolean;
  isOwned?: boolean;
  price?: number;
  currencyType: ShopPaymentCurrency;
  compact?: boolean;
  onSelect: () => void;
};

function AvatarCard({
  imageUrl,
  label,
  selected,
  isCurrent = false,
  isOwned = false,
  price,
  currencyType,
  compact = false,
  onSelect,
}: AvatarCardProps) {
  const resolvedImage = resolveAvatar(imageUrl);

  return (
    <button
      type="button"
      className={`profileShopAvatarCard${compact ? " profileShopAvatarCardCompact" : ""}${isCurrent ? " profileShopAvatarCardCurrent" : ""}${selected ? " active" : ""}`}
      onClick={onSelect}
      aria-label={label}
      title={label}
    >
      <div
        className={getAvatarImageWrapClassName(
          imageUrl,
          isCurrent && selected ? "profileShopAvatarImageWrapCurrent" : "",
        )}
      >
        <img
          className={
            isPremadeRpsAvatarUrl(imageUrl) ? "rpsAvatarFrameImage" : undefined
          }
          src={resolvedImage}
          alt={label}
          draggable={false}
        />
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
          ) : isOwned ? (
            <span className="profileShopAvatarOwnedLabel">Owned</span>
          ) : (
            <span className="profileShopAvatarPrice">
              <ShopPriceAmount
                amount={price || 0}
                currency={currencyType}
              />
            </span>
          )}
        </span>
      ) : isCurrent ? (
        <span className="profileShopAvatarCurrentLabel">Current</span>
      ) : isOwned ? (
        <span className="profileShopAvatarOwnedLabel">Owned</span>
      ) : (
        <span className="profileShopAvatarPrice">
          <ShopPriceAmount amount={price || 0} currency={currencyType} />
        </span>
      )}
    </button>
  );
}

export function BuyAvatarModal({
  open,
  embedded = false,
  currentAvatarUrl,
  balanceUsdt,
  balanceRac,
  avatars,
  loading = false,
  purchasing = false,
  onClose,
  onPurchase,
  onSelect,
}: BuyAvatarModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resolvedCurrentAvatar = resolveAvatar(currentAvatarUrl);

  const catalogAvatars = useMemo(
    () =>
      avatars.filter(
        (entry) => resolveAvatar(entry.imageUrl) !== resolvedCurrentAvatar,
      ),
    [avatars, resolvedCurrentAvatar],
  );

  const selectedAvatar = avatars.find((entry) => entry.id === selectedId);
  const isCurrentSelected = !selectedId;
  const canSelectOwned = Boolean(selectedAvatar?.owned);
  const selectedCurrency = selectedAvatar?.currencyType || "usdt";
  const selectedBalance =
    selectedCurrency === "rac" ? balanceRac : balanceUsdt;
  const hasInsufficientBalance = Boolean(
    selectedAvatar &&
      !selectedAvatar.owned &&
      selectedAvatar.priceRac > selectedBalance,
  );

  const previewImage = selectedAvatar
    ? resolveAvatar(selectedAvatar.imageUrl)
    : resolvedCurrentAvatar;

  const previewLabel = selectedAvatar?.label || "Current avatar";

  const movePreview = useMemo(() => {
    if (selectedAvatar) {
      return {
        avatarUrl: selectedAvatar.imageUrl,
        moveEffects: {
          stoneGif: selectedAvatar.stoneGif,
          scissorsGif: selectedAvatar.scissorsGif,
          paperGif: selectedAvatar.paperGif,
        },
        title: selectedAvatar.label,
        variant: "premium" as const,
      };
    }

    const matchingShopAvatar = avatars.find(
      (entry) => resolveAvatar(entry.imageUrl) === resolvedCurrentAvatar,
    );

    if (matchingShopAvatar || isPremadeRpsAvatarUrl(resolvedCurrentAvatar)) {
      return {
        avatarUrl: matchingShopAvatar?.imageUrl || currentAvatarUrl,
        moveEffects: matchingShopAvatar
          ? {
              stoneGif: matchingShopAvatar.stoneGif,
              scissorsGif: matchingShopAvatar.scissorsGif,
              paperGif: matchingShopAvatar.paperGif,
            }
          : null,
        title: matchingShopAvatar?.label || "Current avatar",
        variant: "premium" as const,
      };
    }

    return {
      avatarUrl: null,
      moveEffects: null,
      title: "Current avatar",
      variant: "standard" as const,
    };
  }, [avatars, currentAvatarUrl, resolvedCurrentAvatar, selectedAvatar]);

  const purchaseButton = selectedAvatar?.owned ? (
    <button
      type="button"
      className="profileShopPurchaseBtn"
      disabled={!canSelectOwned || purchasing || isCurrentSelected}
      onClick={() => {
        if (selectedAvatar) {
          onSelect(selectedAvatar.id);
        }
      }}
    >
      Use Avatar
    </button>
  ) : (
    <button
      type="button"
      className="profileShopPurchaseBtn"
      disabled={!selectedAvatar || purchasing || hasInsufficientBalance}
      onClick={() => {
        if (selectedAvatar) {
          onPurchase(selectedAvatar.id);
        }
      }}
    >
      {hasInsufficientBalance
        ? selectedCurrency === "rac"
          ? "Insufficient RAC"
          : "Insufficient USDT"
        : "Buy Avatar"}
    </button>
  );

  const shopLayout = (
    <div className="profileShopAvatarLayout">
      <aside className="profileShopAvatarRail" aria-label="Selected avatar preview">
        <div className="profileShopAvatarHero">
          <div
            className={`profileShopAvatarHeroImageWrap${isPremadeRpsAvatarUrl(previewImage) ? " profileShopAvatarHeroImageWrapPremade rpsAvatarFrame" : ""}`}
          >
            <img
              className={
                isPremadeRpsAvatarUrl(previewImage)
                  ? "rpsAvatarFrameImage"
                  : undefined
              }
              src={previewImage}
              alt={previewLabel}
            />
          </div>
          <div className="profileShopAvatarHeroCopy">
            <p className="profileShopAvatarHeroEyebrow">Selected</p>
            <h3 className="profileShopAvatarHeroTitle">{previewLabel}</h3>
            {selectedAvatar?.owned || isCurrentSelected ? (
              <span className="profileShopAvatarHeroBadge profileShopAvatarHeroBadgeOwned">
                {isCurrentSelected ? "Equipped" : "Owned"}
              </span>
            ) : selectedAvatar ? (
              <span className="profileShopAvatarHeroBadge profileShopAvatarHeroBadgePrice">
                <ShopPriceAmount
                  amount={selectedAvatar.priceRac}
                  currency={selectedAvatar.currencyType}
                />
              </span>
            ) : (
              <span className="profileShopAvatarHeroBadge profileShopAvatarHeroBadgeEquipped">
                Equipped
              </span>
            )}
          </div>
        </div>

        <AvatarMoveEffectPreview
          avatarUrl={movePreview.avatarUrl}
          moveEffects={movePreview.moveEffects}
          title={movePreview.title}
          variant={movePreview.variant}
          layout="rail"
        />

        <div className="profileShopRailFooter">
          <div className="profileShopBalances">
            <div className="profileShopBalance">
              <span>USDT</span>
              <ShopPriceAmount
                amount={balanceUsdt}
                currency="usdt"
                className="profileShopBalanceAmount"
              />
            </div>
            <div className="profileShopBalance">
              <span>RAC</span>
              <ShopPriceAmount
                amount={balanceRac}
                currency="rac"
                className="profileShopBalanceAmount"
              />
            </div>
          </div>
          {purchaseButton}
          <p className="profileShopDisclaimer profileShopDisclaimerRail">
            Avatars are permanent and visible to all players.
          </p>
        </div>
      </aside>

      <div className="profileShopAvatarCatalog">
        <div className="profileShopCatalogHead">
          <h3 className="profileShopCatalogTitle">Browse avatars</h3>
          <span className="profileShopCatalogCount">
            {catalogAvatars.length + 1} items
          </span>
        </div>

        {loading ? (
          <p className="profileShopAvatarDragHint">Loading avatars...</p>
        ) : (
          <div
            className="profileShopAvatarGridExpanded profileShopAvatarGridMain profileShopAvatarGridCatalog"
            aria-label="Avatar shop grid"
          >
            <AvatarCard
              imageUrl={resolvedCurrentAvatar}
              label="Current avatar"
              selected={isCurrentSelected}
              isCurrent
              currencyType="usdt"
              compact
              onSelect={() => setSelectedId(null)}
            />
            {catalogAvatars.map((entry) => (
              <AvatarCard
                key={entry.id}
                imageUrl={entry.imageUrl}
                label={entry.label}
                selected={selectedId === entry.id}
                isOwned={Boolean(entry.owned)}
                price={entry.priceRac}
                currencyType={entry.currencyType}
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
            className="profileShopModalHeadingIcon profileShopModalHeadingIconCyan"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
          </span>
          <div>
            <h2 id="buy-avatar-modal-title" className="profileShopModalTitle">
              Buy Avatar
            </h2>
            <p className="profileShopModalSubtitle">
              Unlock premium avatars and express yourself!
            </p>
          </div>
        </div>
        <button
          type="button"
          className="profileShopModalClose"
          aria-label="Close buy avatar modal"
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
      <div className="profileShopEmbedded profileShopEmbeddedAvatar">
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
        className="modal profileShopModal profileShopModalAvatar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-avatar-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}

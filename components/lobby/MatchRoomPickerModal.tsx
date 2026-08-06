"use client";

import { FreeMatchGiftIcon, PaidMatchCupIcon } from "./MatchCardIcons";
import { formatRac, formatRafc } from "../../lib/currency";
import type { MatchLedger } from "../../lib/types";

const FREE_MATCH_LABEL: Record<number, string> = {
  1: "Practice Match",
  2: "Beginner Match",
  5: "Casual Match",
  10: "Quick Match",
  20: "Challenge Match",
};

const PAID_MATCH_LABEL: Record<number, string> = {
  1: "Starter Match",
  2: "Warm-up Match",
  5: "Competitive Match",
  10: "High Stakes Match",
  20: "Elite Match",
};

type MatchRoomPickerModalProps = {
  ledger: MatchLedger;
  prices: number[];
  disabled?: boolean;
  getPlayerCount: (price: number, ledger: MatchLedger) => number;
  onSelect: (price: number) => void;
  onClose: () => void;
};

export function MatchRoomPickerModal({
  ledger,
  prices,
  disabled = false,
  getPlayerCount,
  onSelect,
  onClose,
}: MatchRoomPickerModalProps) {
  const isFree = ledger === "free";
  const title = isFree ? "RAC Matches" : "USDT Matches";
  const subtitle = isFree
    ? "Choose a RAC stake room to join."
    : "Choose a USDT stake room to join.";
  const labels = isFree ? FREE_MATCH_LABEL : PAID_MATCH_LABEL;
  const formatStake = isFree ? formatRafc : formatRac;

  return (
    <div
      className="backdrop matchRoomPickerBackdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`modal matchRoomPickerModal${isFree ? " matchRoomPickerModal--free" : " matchRoomPickerModal--paid"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="matchRoomPickerHeader">
          <div className="matchRoomPickerHeading">
            <span
              className={`matchRoomPickerIcon${isFree ? " matchRoomPickerIcon--free" : " matchRoomPickerIcon--paid"}`}
              aria-hidden
            >
              {isFree ? (
                <FreeMatchGiftIcon className="matchRoomPickerIconSvg" />
              ) : (
                <PaidMatchCupIcon className="matchRoomPickerIconSvg" />
              )}
            </span>
            <div>
              <h2 className="matchRoomPickerTitle">{title}</h2>
              <p className="matchRoomPickerSubtitle">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="matchRoomPickerClose"
            aria-label="Close room picker"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="matchRoomPickerGrid">
          {prices.map((price) => {
            const count = getPlayerCount(price, ledger);
            const label =
              labels[price] ||
              `${isFree ? "RAC" : "USDT"} ${formatStake(price)}`;
            return (
              <button
                key={`${ledger}-${price}`}
                type="button"
                className={`matchCard ${isFree ? "matchCardFree" : "matchCardPaid"}`}
                disabled={disabled}
                onClick={() => onSelect(price)}
              >
                <span
                  className={`matchCardIcon ${isFree ? "matchCardIconFree" : "matchCardIconPaid"}`}
                  aria-hidden
                >
                  {isFree ? (
                    <FreeMatchGiftIcon className="matchCardIconSvg" />
                  ) : (
                    <PaidMatchCupIcon className="matchCardIconSvg" />
                  )}
                </span>
                <span className="matchCardName">{label}</span>
                <span
                  className={`matchCardMeta${isFree ? " matchCardMetaFree" : ""}`}
                >
                  {isFree ? (
                    <span className="matchCardMetaSecondary">
                      {formatStake(price)}
                    </span>
                  ) : (
                    <span className="matchCardMetaPrimary">
                      {formatStake(price)}
                    </span>
                  )}
                </span>
                <span className="matchCardPlaying">
                  <strong>{count}</strong> playing
                </span>
                <span className="matchCardJoin">Join Now</span>
              </button>
            );
          })}
          {prices.length === 0 ? (
            <div className="matchRoomPickerEmpty">
              No match plans available.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

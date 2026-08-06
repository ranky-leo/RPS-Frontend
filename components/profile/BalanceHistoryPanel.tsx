import { useEffect, useState } from "react";
import type { BalanceHistoryItem } from "../../lib/types";
import { formatRac, formatSignedRac, formatRafc, formatSignedRafc } from "../../lib/currency";
import { ProfileFieldLabel } from "./ProfileFieldLabel";

type BalanceHistoryPanelProps = {
  history: BalanceHistoryItem[];
  loading: boolean;
  hideHeading?: boolean;
};

const fmt = formatRac;
const fmtSigned = formatSignedRac;

const resolveHistoryType = (statusRaw: string, amount = 0) => {
  const status = String(statusRaw || "")
    .trim()
    .toLowerCase();

  if (status === "play_win") return "won";
  if (status === "play_loss" || status === "play_timeout_fee") return "lost";
  if (status === "refer_fee") return "refer_fee";
  if (status === "first_signup_bonus") return "first_signup_bonus";
  if (status === "daily_mission_reward") return "daily_mission_reward";
  if (status === "shop_avatar_purchase") return "avatar_purchase";
  if (status.startsWith("deposit")) return "deposit";
  if (status === "play_refund") return "refund";
  if (status.startsWith("withdraw")) return "withdraw";

  return Number(amount) >= 0 ? "deposit" : "lost";
};

const prettifyStatus = (statusRaw: string, amount = 0) => {
  const type = resolveHistoryType(statusRaw, amount);
  if (type === "won") return "Won!";
  if (type === "lost") return "Lost..";
  if (type === "refer_fee") return "refer_fee";
  if (type === "first_signup_bonus") return "First sign-up bonus";
  if (type === "daily_mission_reward") return "Daily mission reward";
  if (type === "avatar_purchase") return "Avatar purchase";
  if (type === "deposit") return "Deposit";
  if (type === "refund") return "Refund";
  return "Withdraw";
};

const statusColor = (statusRaw: string, amount = 0) => {
  const type = resolveHistoryType(statusRaw, amount);
  if (type === "won") return "#d4af37";
  if (type === "lost") return "#ef4444";
  if (type === "refer_fee") return "#a78bfa";
  if (type === "first_signup_bonus") return "#34d399";
  if (type === "daily_mission_reward") return "#a3e635";
  if (type === "avatar_purchase") return "#22d3ee";
  if (type === "deposit") return "#60a5fa";
  if (type === "refund") return "#f59e0b";
  return "#22c55e";
};

export function BalanceHistoryPanel({
  history,
  loading,
  hideHeading = false,
}: BalanceHistoryPanelProps) {
  const [openHashItemId, setOpenHashItemId] = useState<string | null>(null);
  const visibleHistory = history.filter(
    (item) =>
      String(item.status || "")
        .trim()
        .toLowerCase() !== "play_refund",
  );

  useEffect(() => {
    if (!openHashItemId) {
      return;
    }

    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-hash-popover-root='true']")) {
        return;
      }
      setOpenHashItemId(null);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside, { passive: true });

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
    };
  }, [openHashItemId]);

  return (
    <div className="formGroup profileHistoryPanel">
      {hideHeading ? null : (
        <ProfileFieldLabel icon="history" as="span">
          Balance History
        </ProfileFieldLabel>
      )}
      {loading ? (
        <div className="profileHistoryEmpty">Loading history...</div>
      ) : visibleHistory.length === 0 ? (
        <div className="profileHistoryEmpty">No balance history yet.</div>
      ) : (
        <div className="profileHistoryList">
          {visibleHistory.map((item) => {
            const amount = Number(item.amount || 0);
            const status = String(item.status || "");
            const historyType = resolveHistoryType(status, amount);
            const isFreeLedger =
              item.ledger === "free" ||
              historyType === "first_signup_bonus" ||
              historyType === "daily_mission_reward";
            const amountLabel = isFreeLedger
              ? amount >= 0
                ? `+${formatRafc(amount)}`
                : formatSignedRafc(amount)
              : fmtSigned(amount);
            const previousBalance = Number(
              item.previousBalance ?? Number(item.balance || 0) - amount,
            );
            const updatedBalance = Number(
              item.updatedBalance ?? item.balance ?? 0,
            );
            const displayStatus = prettifyStatus(status, amount);
            const at = item.createdAt
              ? new Date(item.createdAt).toLocaleString()
              : "-";
            const hashlink = String(item.hashlink || item.txHash || "").trim();
            const canShowHashlink =
              hashlink.length > 0 &&
              (historyType === "deposit" || historyType === "withdraw");
            const toneClass =
              historyType === "first_signup_bonus" ||
              historyType === "daily_mission_reward"
                ? " profileHistoryItemFree"
                : historyType === "avatar_purchase"
                  ? " profileHistoryItemAvatarPurchase"
                  : historyType === "deposit"
                    ? " profileHistoryItemDeposit"
                    : "";

            return (
              <div
                key={item.id}
                className={`profileHistoryItem${toneClass}`}
              >
                <div className="profileHistoryItemMain">
                  <div
                    className="profileHistoryBadge"
                    style={{ color: statusColor(status, amount) }}
                    aria-hidden="true"
                  >
                    {historyType === "first_signup_bonus" ? (
                      "+"
                    ) : historyType === "daily_mission_reward" ? (
                      "🎁"
                    ) : historyType === "avatar_purchase" ? (
                      "🧑"
                    ) : historyType === "deposit" ? (
                      "↓"
                    ) : (
                      "•"
                    )}
                  </div>
                  <div className="profileHistoryCopy">
                    <strong style={{ color: statusColor(status, amount) }}>
                      {displayStatus}
                    </strong>
                    <span className="profileHistoryAmount">{amountLabel}</span>
                  </div>

                  <div className="profileHistoryMeta">
                    <span className="profileHistoryTime">{at}</span>

                    <div className="profileHistoryBalances">
                      {canShowHashlink ? (
                        <>
                          <button
                            type="button"
                            className="profileHistoryHashBtn"
                            onClick={() =>
                              setOpenHashItemId((prev) =>
                                prev === item.id ? null : item.id,
                              )
                            }
                            aria-label="View transaction hash"
                            data-hash-popover-root="true"
                          >
                            👁
                          </button>
                          {openHashItemId === item.id ? (
                            <div
                              className="profileHistoryHashPopover"
                              data-hash-popover-root="true"
                            >
                              {hashlink}
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      <span>
                        Previous:{" "}
                        {isFreeLedger
                          ? formatRafc(previousBalance)
                          : fmt(previousBalance)}{" "}
                        · Updated:{" "}
                        <span
                          className={
                            isFreeLedger
                              ? "profileHistoryUpdatedFree"
                              : "profileHistoryUpdatedRac"
                          }
                        >
                          {isFreeLedger
                            ? formatRafc(updatedBalance)
                            : fmt(updatedBalance)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

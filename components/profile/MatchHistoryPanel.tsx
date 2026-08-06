import type { UserMatchHistoryItem } from "../../lib/types";
import { DEFAULT_AVATAR } from "../../lib/avatars";
import { formatRac, formatRafc } from "../../lib/currency";
import { UserAvatar } from "../UserAvatar";
import { ProfileFieldLabel } from "./ProfileFieldLabel";

type MatchHistoryPanelProps = {
  history: UserMatchHistoryItem[];
  loading: boolean;
  hideHeading?: boolean;
};

const formatStake = (price: number, ledger: "rac" | "free") =>
  ledger === "free" ? `${price} RAC` : `${price} USDT`;

const formatPayout = (amount: number, ledger: "rac" | "free") => {
  const payout = Math.max(0, Number(amount) || 0);
  return ledger === "free"
    ? `+${formatRafc(payout)}`
    : `+${formatRac(payout)}`;
};

const formatFinishedAt = (timestamp: number) => {
  const finishedAt = Number(timestamp) || 0;
  if (!finishedAt) {
    return "-";
  }

  return new Date(finishedAt).toLocaleString();
};

export function MatchHistoryPanel({
  history,
  loading,
  hideHeading = false,
}: MatchHistoryPanelProps) {
  return (
    <div className="formGroup profileHistoryPanel profileMatchHistoryPanel">
      {hideHeading ? null : (
        <ProfileFieldLabel icon="history" as="span">
          Match History
        </ProfileFieldLabel>
      )}
      {loading ? (
        <div className="profileHistoryEmpty">Loading match history...</div>
      ) : history.length === 0 ? (
        <div className="profileHistoryEmpty">No match history yet.</div>
      ) : (
        <div className="profileHistoryList">
          {history.map((item) => {
            const ledger = item.ledger === "free" ? "free" : "rac";
            const resultColor = item.won ? "#d4af37" : "#ef4444";

            return (
              <div
                key={item.id}
                className={`profileHistoryItem profileMatchHistoryItem${item.won ? " profileMatchHistoryItemWin" : " profileMatchHistoryItemLoss"}`}
              >
                <div className="profileHistoryItemMain profileMatchHistoryItemMain">
                  <div
                    className="profileHistoryBadge"
                    style={{ color: resultColor }}
                    aria-hidden="true"
                  >
                    {item.won ? "W" : "L"}
                  </div>
                  <UserAvatar
                    avatar={item.opponentAvatar || DEFAULT_AVATAR}
                    alt={item.opponentUsername}
                    className="profileMatchHistoryAvatar"
                    loading="lazy"
                  />
                  <div className="profileHistoryCopy profileMatchHistoryCopy">
                    <strong style={{ color: resultColor }}>
                      {item.won ? "Won" : "Lost"} vs {item.opponentUsername}
                    </strong>
                    <span className="profileHistoryAmount">
                      {formatStake(item.price, ledger)} · {item.myScore}-
                      {item.opponentScore}
                    </span>
                  </div>
                  <div className="profileHistoryMeta profileMatchHistoryMeta">
                    <span className="profileHistoryTime">
                      {formatFinishedAt(item.finishedAt)}
                    </span>
                    {item.won ? (
                      <span
                        className={`profileMatchHistoryPayout profileMatchHistoryPayout--${ledger === "free" ? "free" : "paid"}`}
                      >
                        {formatPayout(item.payout, ledger)}
                      </span>
                    ) : (
                      <span className="profileMatchHistoryPayout profileMatchHistoryPayout--loss">
                        -{formatStake(item.price, ledger)}
                      </span>
                    )}
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

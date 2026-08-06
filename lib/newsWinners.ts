import type { NewsWinner } from "./types";
import { formatRac, formatRafc } from "./currency";
import { parseSeasonRewardValue } from "./seasonRewards";

export function normalizeNewsWinners(value: unknown): NewsWinner[] {
  if (!value) {
    return [];
  }

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry) => {
      const reward = parseSeasonRewardValue(
        (entry as NewsWinner)?.rewardUsdt != null ||
          (entry as NewsWinner)?.rewardRac != null
          ? {
              usdt: (entry as NewsWinner)?.rewardUsdt,
              rac: (entry as NewsWinner)?.rewardRac,
            }
          : (entry as NewsWinner)?.reward,
      );

      return {
        rank: Number((entry as NewsWinner)?.rank),
        user_id:
          (entry as NewsWinner)?.user_id === undefined
            ? null
            : (entry as NewsWinner)?.user_id,
        username: String((entry as NewsWinner)?.username || "").trim(),
        avatar: String((entry as NewsWinner)?.avatar || "").trim(),
        reward: reward.usdt > 0 ? reward.usdt : reward.rac,
        rewardUsdt: reward.usdt,
        rewardRac: reward.rac,
      };
    })
    .filter(
      (entry) =>
        Number.isFinite(entry.rank) &&
        entry.rank > 0 &&
        entry.username &&
        (entry.rewardUsdt > 0 || entry.rewardRac > 0),
    )
    .sort((a, b) => a.rank - b.rank);
}

export function formatSeasonWinnerReward(
  winner: Pick<NewsWinner, "rewardUsdt" | "rewardRac" | "reward">,
) {
  const reward = parseSeasonRewardValue(
    winner.rewardUsdt != null || winner.rewardRac != null
      ? { usdt: winner.rewardUsdt ?? 0, rac: winner.rewardRac ?? 0 }
      : winner.reward,
  );
  const parts: string[] = [];

  if (reward.usdt > 0) {
    parts.push(formatRac(reward.usdt));
  }
  if (reward.rac > 0) {
    parts.push(formatRafc(reward.rac));
  }

  return parts.length > 0 ? parts.join(" + ") : "—";
}

export function getWinnerByRank(winners: NewsWinner[], rank: number) {
  return winners.find((winner) => winner.rank === rank) || null;
}

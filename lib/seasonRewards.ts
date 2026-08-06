export type SeasonRewardAmounts = {
  usdt: number;
  rac: number;
};

export function parseSeasonRewardValue(raw: unknown): SeasonRewardAmounts {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = raw as { usdt?: unknown; rac?: unknown };
    return {
      usdt: Math.max(0, Math.trunc(Number(value.usdt) || 0)),
      rac: Math.max(0, Math.trunc(Number(value.rac) || 0)),
    };
  }

  const text = String(raw ?? "").trim();
  if (!text) {
    return { usdt: 0, rac: 0 };
  }

  if (text.includes(",")) {
    const [usdtPart, racPart] = text.split(",");
    return {
      usdt: Math.max(0, Math.trunc(Number(usdtPart) || 0)),
      rac: Math.max(0, Math.trunc(Number(racPart) || 0)),
    };
  }

  const amount = Math.trunc(Number(text) || 0);
  if (amount === 0) {
    return { usdt: 0, rac: 0 };
  }
  if (amount > 0) {
    return { usdt: amount, rac: 0 };
  }

  return { usdt: 0, rac: Math.abs(amount) };
}

export function normalizeRewardsByRank(
  value: unknown,
): Record<string, SeasonRewardAmounts> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const rewards: Record<string, SeasonRewardAmounts> = {};
  for (const [rank, rawReward] of Object.entries(value)) {
    rewards[rank] = parseSeasonRewardValue(rawReward);
  }
  return rewards;
}

export function hasSeasonReward(reward: SeasonRewardAmounts) {
  return reward.usdt > 0 || reward.rac > 0;
}

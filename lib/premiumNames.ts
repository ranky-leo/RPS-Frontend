export const PREMIUM_NAME_PREFIX = "RPS";

export const PREMIUM_NAME_WARNING =
  "Names starting with RPS are premium and reserved.";

export const isPremiumNamePrefix = (username: string) => {
  const normalized = String(username || "").trim();
  if (!normalized) {
    return false;
  }

  return normalized.toUpperCase().startsWith(PREMIUM_NAME_PREFIX);
};

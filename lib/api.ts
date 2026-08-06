import type {
  BalanceHistoryItem,
  DailyMissionsResponse,
  LobbySnapshot,
  Match,
  MatchLedger,
  SeasonalRankResponse,
  User,
  UserMatchHistoryItem,
  News,
  ActiveNewsResponse,
  UserFeedbackItem,
} from "./types";

const normalizeBaseUrl = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\/+$/, "");
};

const resolveApiBase = () => {
  const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE || "");
  if (envBase) {
    return envBase;
  }

  if (typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin || "");
  }

  return "http://localhost:4001";
};

const AUTH_TOKEN_KEY = "rps-auth-token";
const GUEST_ID_KEY = "rps-guest-id";

export const getOrCreateGuestId = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = String(
    window.localStorage.getItem(GUEST_ID_KEY) || "",
  ).trim();
  if (existing) {
    return existing;
  }

  const guestId = `guest_${crypto.randomUUID()}`;
  window.localStorage.setItem(GUEST_ID_KEY, guestId);
  return guestId;
};

export const getActivePlayerId = (userId?: string | null) =>
  String(userId || "").trim() || getOrCreateGuestId();

const AUTH_USER_ID_KEY = "rps-auth-user-id";
const AUTH_EXPIRED_AT_KEY = "rps-auth-expired-at";
const LEGACY_AUTH_TOKEN_SESSION_KEY = "rps-auth-token-session";
const LEGACY_USER_SESSION_KEY = "rps-user-id-session";
const LEGACY_USER_STORAGE_KEY = "rps-user-id";
const AUTH_IDLE_TIMEOUT_MS = 60 * 60 * 1000;

type AuthCredentials = {
  token: string;
  userId: string;
  expiredAt: number;
};

let authCredentialsCache: AuthCredentials | null = null;

const migrateLegacyAuthStorage = () => {
  if (typeof window === "undefined") {
    return;
  }

  const existingToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
  const existingUserId = window.localStorage.getItem(AUTH_USER_ID_KEY);
  const existingExpiredAt = window.localStorage.getItem(AUTH_EXPIRED_AT_KEY);
  if (existingToken && existingUserId && existingExpiredAt) {
    return;
  }

  const legacyToken = window.sessionStorage.getItem(
    LEGACY_AUTH_TOKEN_SESSION_KEY,
  );
  const legacyUserId =
    window.sessionStorage.getItem(LEGACY_USER_SESSION_KEY) ||
    window.localStorage.getItem(LEGACY_USER_STORAGE_KEY);

  if (!legacyToken || !legacyUserId) {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, legacyToken);
  window.localStorage.setItem(AUTH_USER_ID_KEY, legacyUserId);
  window.localStorage.setItem(
    AUTH_EXPIRED_AT_KEY,
    String(Date.now() + AUTH_IDLE_TIMEOUT_MS),
  );
  window.sessionStorage.removeItem(LEGACY_AUTH_TOKEN_SESSION_KEY);
  window.sessionStorage.removeItem(LEGACY_USER_SESSION_KEY);
  window.localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
};

const readAuthCredentials = (): AuthCredentials | null => {
  if (authCredentialsCache) {
    return authCredentialsCache;
  }

  if (typeof window === "undefined") {
    return null;
  }

  migrateLegacyAuthStorage();

  const token = String(
    window.localStorage.getItem(AUTH_TOKEN_KEY) || "",
  ).trim();
  const userId = String(
    window.localStorage.getItem(AUTH_USER_ID_KEY) || "",
  ).trim();
  const expiredAt = Number(window.localStorage.getItem(AUTH_EXPIRED_AT_KEY));

  if (!token || !userId || !Number.isFinite(expiredAt)) {
    return null;
  }

  authCredentialsCache = { token, userId, expiredAt };
  return authCredentialsCache;
};

const writeAuthCredentials = (credentials: AuthCredentials | null) => {
  authCredentialsCache = credentials;

  if (typeof window === "undefined") {
    return;
  }

  if (!credentials) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_ID_KEY);
    window.localStorage.removeItem(AUTH_EXPIRED_AT_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, credentials.token);
  window.localStorage.setItem(AUTH_USER_ID_KEY, credentials.userId);
  window.localStorage.setItem(
    AUTH_EXPIRED_AT_KEY,
    String(credentials.expiredAt),
  );
};

const emitAuthExpired = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent("rps:auth-expired"));
};

export const setAuthCredentials = (credentials: AuthCredentials) => {
  writeAuthCredentials({
    token: String(credentials.token || "").trim(),
    userId: String(credentials.userId || "").trim(),
    expiredAt: Number(credentials.expiredAt),
  });
};

export const getAuthCredentials = () => readAuthCredentials();

export const clearAuthCredentials = () => {
  writeAuthCredentials(null);
};

export const setAuthToken = (token: string) => {
  const existing = readAuthCredentials();
  if (!existing) {
    return;
  }
  writeAuthCredentials({ ...existing, token: String(token || "").trim() });
};

export const clearAuthToken = () => {
  clearAuthCredentials();
};

export const getAuthToken = () => readAuthCredentials()?.token || null;

const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const apiBase = resolveApiBase();
  const token = readAuthCredentials()?.token;
  const isAuthEntryEndpoint =
    url === "/auth/login" ||
    url === "/auth/register" ||
    url === "/auth/visit-status" ||
    url === "/auth/login-prompt" ||
    url === "/auth/enter-name" ||
    url === "/auth/enter-password";
  const res = await fetch(`${apiBase}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    if (res.status === 401 && !isAuthEntryEndpoint) {
      clearAuthCredentials();
      emitAuthExpired();
    }

    const payload = await res.json().catch(() => null);
    const serverMessage = payload?.message;

    if (serverMessage) {
      if (url === "/auth/login" && serverMessage === "user not found") {
        throw new Error("Account not registered. Please create an account.");
      }
      throw new Error(serverMessage);
    }

    if (url === "/auth/login") {
      if (res.status === 404) {
        throw new Error("Account not registered. Please create an account.");
      }
      if (res.status === 401) {
        throw new Error("Incorrect password. Please try again.");
      }
      if (res.status === 400) {
        throw new Error("Please enter username/email and password.");
      }
    }

    if (url === "/auth/register") {
      if (res.status === 409) {
        throw new Error("Email or username already registered.");
      }
      if (res.status === 400) {
        throw new Error("Please check your registration details.");
      }
    }

    throw new Error(`Request failed (HTTP ${res.status})`);
  }

  const payload = (await res.json()) as T;

  const credentials = readAuthCredentials();
  if (credentials?.token && token && !isAuthEntryEndpoint) {
    writeAuthCredentials({
      ...credentials,
      expiredAt: Date.now() + AUTH_IDLE_TIMEOUT_MS,
    });
  }

  return payload;
};

export const api = {
  recordVisit: () =>
    json<{ ok: boolean }>("/visit", {
      method: "POST",
    }),

  news: () => json<ActiveNewsResponse>("/news"),

  /** @deprecated Use `news()` */
  activeNews: () => json<ActiveNewsResponse>("/news"),

  authCaptcha: () =>
    json<{
      captchaId: string;
      prompt: string;
      imageDataUrl: string;
      expiresAt: number;
      expiresInMs: number;
    }>("/auth/captcha"),

  user: (userId: string) => json<{ user: User }>(`/users/${userId}`),

  userBalanceHistory: (userId: string, limit = 50) =>
    json<{ history: BalanceHistoryItem[] }>(
      `/users/${userId}/history?limit=${encodeURIComponent(String(limit))}`,
    ),

  userMatchHistory: (userId: string, limit = 30) =>
    json<{ history: UserMatchHistoryItem[] }>(
      `/users/${userId}/match-history?limit=${encodeURIComponent(String(limit))}`,
    ),

  login: (payload: {
    identifier: string;
    password: string;
    // captchaId: string;
    // captchaAnswer: string;
  }) =>
    json<{
      user: User;
      token: string;
      expiredAt: number;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  register: (payload: {
    mail: string;
    username: string;
    password: string;
    avatar: string;
    birthday: string;
    refer?: string;
    // captchaId: string;
    // captchaAnswer: string;
  }) =>
    json<{
      user: User;
      token: string;
      expiredAt: number;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () =>
    json<{ ok: boolean }>("/auth/logout", {
      method: "POST",
    }),

  visitStatus: () =>
    json<{
      status: "guest" | "logged_in";
      user?: User;
      token?: string;
      expiredAt?: number;
    }>("/auth/visit-status"),

  loginPrompt: () =>
    json<{
      status?: "logged_in";
      mode?: "name_only" | "name_password";
      suggestedUsername?: string | null;
      firstVisit?: boolean;
      returningVisitor?: boolean;
      user?: User;
      token?: string;
      expiredAt?: number;
    }>("/auth/login-prompt"),

  enterName: (payload: { username: string }) =>
    json<{
      status: "onboarding_match" | "password_required" | "logged_in";
      username?: string;
      user?: User;
      token?: string;
      expiredAt?: number;
      match?: Match;
    }>("/auth/enter-name", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  enterPassword: (payload: { username: string; password: string }) =>
    json<{
      status: "logged_in";
      user: User;
      token: string;
      expiredAt: number;
    }>("/auth/enter-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  completeOnboarding: () =>
    json<{ user: User }>("/auth/complete-onboarding", {
      method: "POST",
    }),

  updateProfile: (
    userId: string,
    payload: {
      avatar?: string;
      username?: string;
      password?: string;
    },
  ) =>
    json<{ user: User }>(`/users/${userId}/profile`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  shopAvatars: (userId: string) =>
    json<{ avatars: import("./types").ShopAvatarOption[] }>(
      `/shop/avatars/${encodeURIComponent(userId)}`,
    ),

  shopNames: (userId: string) =>
    json<{ names: import("./types").ShopNameOption[] }>(
      `/shop/names/${encodeURIComponent(userId)}`,
    ),

  purchaseShopAvatar: (userId: string, avatarId: string) =>
    json<import("./types").ShopPurchaseResult>(
      `/shop/avatars/${encodeURIComponent(userId)}/purchase`,
      {
        method: "POST",
        body: JSON.stringify({ avatarId }),
      },
    ),

  selectShopAvatar: (userId: string, avatarId: string) =>
    json<import("./types").ShopPurchaseResult>(
      `/shop/avatars/${encodeURIComponent(userId)}/select`,
      {
        method: "POST",
        body: JSON.stringify({ avatarId }),
      },
    ),

  purchaseShopName: (userId: string, nameId: string) =>
    json<import("./types").ShopPurchaseResult>(
      `/shop/names/${encodeURIComponent(userId)}/purchase`,
      {
        method: "POST",
        body: JSON.stringify({ nameId }),
      },
    ),

  selectShopName: (userId: string, nameId: string) =>
    json<import("./types").ShopPurchaseResult>(
      `/shop/names/${encodeURIComponent(userId)}/select`,
      {
        method: "POST",
        body: JSON.stringify({ nameId }),
      },
    ),

  deposit: (payload: { userId: string; amount: number }) =>
    json<{
      requestId: string;
      treasuryAddress: string;
      network: string;
      confirmationsRequired: number;
      expectedPoints: number;
      expectedWei: string;
    }>("/wallet/deposit", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  confirmDeposit: (payload: {
    userId: string;
    requestId: string;
    txHash: string;
  }) =>
    json<{
      status: string;
      user: User;
      requestId: string;
      txHash?: string;
      amountPoints?: number;
      amountWei?: string;
      confirmations?: number;
    }>("/wallet/deposit/confirm", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  withdraw: (payload: { userId: string; amount: number; toAddress: string }) =>
    json<{
      user: User;
      txHash: string;
      txUrl: string;
      amountPoints: number;
      toAddress: string;
    }>("/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  lobbySnapshot: () => json<LobbySnapshot>("/lobby/snapshot"),

  dailyMissions: (userId: string) =>
    json<DailyMissionsResponse>(
      `/daily-missions/${encodeURIComponent(userId)}`,
    ),

  dailyMissionPresence: () =>
    json<DailyMissionsResponse>("/daily-missions/presence", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  dailyMissionWatchLiveVideo: () =>
    json<DailyMissionsResponse>("/daily-missions/watch-live-video", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  seasonalRank: () => json<SeasonalRankResponse>("/seasonal-rank"),

  submitFeedback: (payload: { subject?: string; message: string }) =>
    json<{ ok: boolean; feedback: UserFeedbackItem }>("/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  myFeedback: () => json<{ feedback: UserFeedbackItem[] }>("/feedback/mine"),

  supportConversation: () =>
    json<{
      userId: string;
      messages: Array<{
        id: string;
        userId: string;
        senderRole: "user" | "admin";
        senderUserId: string | null;
        senderName: string | null;
        text: string;
        createdAt: string | null;
        readByUser: boolean;
        readByAdmin: boolean;
      }>;
    }>("/support/conversation"),

  supportUnread: () =>
    json<{
      userId: string;
      unreadCount: number;
    }>("/support/unread"),

  supportSendMessage: (payload: { text: string }) =>
    json<{
      message: {
        id: string;
        userId: string;
        senderRole: "user" | "admin";
        senderUserId: string | null;
        senderName: string | null;
        text: string;
      };
    }>("/support/message", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  discordInviteClick: () =>
    json<{
      ok: boolean;
      redirectUrl: string;
      inviteUrl: string;
      linked: boolean;
      oauthRequired: boolean;
    }>("/auth/discord/invite-click", {
      method: "POST",
    }),

  liveMatches: () => json<{ matches: Match[] }>("/matches/live"),

  matchById: (matchId: string) =>
    json<{ match: Match }>(`/matches/${encodeURIComponent(matchId)}`),

  joinMatchmaking: (payload: {
    userId: string;
    price: number;
    ledger?: MatchLedger;
  }) =>
    json<{
      mode: "waiting" | "matched";
      matchId?: string;
      price?: number;
      match?: Match;
    }>("/matchmaking/join", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  cancelMatchmaking: (payload: { userId: string }) =>
    json<{ ok: boolean }>("/matchmaking/cancel", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitMove: (
    matchId: string,
    payload: { userId: string; move: "rock" | "paper" | "scissors" },
  ) =>
    json<{ ok: boolean }>(`/matches/${matchId}/move`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitRematchChoice: (payload: {
    matchId: string;
    userId: string;
    choice: "continue" | "quit";
  }) =>
    json<{
      ok: boolean;
      closed: boolean;
      sessionId: string;
      match?: Match | null;
    }>(`/matches/${payload.matchId}/rematch`, {
      method: "POST",
      body: JSON.stringify({
        userId: payload.userId,
        choice: payload.choice,
      }),
    }),

  confirmRematchQuit: (payload: {
    matchId: string;
    userId: string;
    confirmLeave: boolean;
  }) =>
    json<{
      ok: boolean;
      closed: boolean;
      sessionId: string;
      match?: Match | null;
    }>(`/matches/${payload.matchId}/rematch/confirm-quit`, {
      method: "POST",
      body: JSON.stringify({
        userId: payload.userId,
        confirmLeave: payload.confirmLeave,
      }),
    }),

  // Marketing user access
  marketingMe: () => json<{ user: User }>("/admin/marketing/me"),
  // Marketing metrics dashboard
  marketingDashboard: (period: "day" | "week" | "month" = "day") =>
    json<{
      period: "day" | "week" | "month";
      region?: string;
      data: Array<{
        date?: string;
        week_start?: string;
        week_end?: string;
        year?: number;
        month?: number;
        region?: string;
        visits: number;
        registrations: number;
        total_usdt_balance: number;
        total_rac_balance: number;
        usdt_transaction?: number;
        usdt_transaction_volume: number;
        rac_transaction?: number;
        rac_transaction_volume: number;
        usdt_match_count: number;
        rac_match_count: number;
      }>;
    }>(`/admin/marketing/metrics/dashboard?period=${period}`),

  marketingUpdateMetric: (
    period: "day" | "week" | "month",
    identifier: string,
    data: {
      visits?: number;
      registrations?: number;
      total_usdt_balance?: number;
      total_rac_balance?: number;
      usdt_transaction?: number;
      usdt_transaction_volume?: number;
      rac_transaction?: number;
      rac_transaction_volume?: number;
      usdt_match_count?: number;
      rac_match_count?: number;
    },
  ) =>
    json<{ metric: any }>(
      `/admin/marketing/metrics/dashboard/${period}/${identifier}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    ),
};

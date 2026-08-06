"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  api,
  clearAuthCredentials,
  getAuthCredentials,
  getActivePlayerId,
  getAuthToken,
  getOrCreateGuestId,
  setAuthCredentials,
} from "../lib/api";
import { INVITE_FRIENDS_ENABLED } from "../lib/features";
import {
  useProfileNotifications,
  type ProfileNotificationType,
} from "../hooks/useProfileNotifications";
import { registerNotifyHandler } from "../lib/notifyBridge";
import {
  createNotificationDeduper,
  formatMatchReleaseMessage,
  notificationKeys,
  shouldNotifyMatchRelease,
} from "../lib/notificationDedupe";
import { getSocket } from "../lib/socket";
import { BalanceHistoryPanel } from "../components/profile/BalanceHistoryPanel";
import { MatchHistoryPanel } from "../components/profile/MatchHistoryPanel";
import { ProfileFieldLabel } from "../components/profile/ProfileFieldLabel";
import { ProfileWalletArt } from "../components/profile/ProfileWalletArt";
import { ProfileSidebar } from "../components/profile/ProfileSidebar";
import { ProfileAvatarPicker } from "../components/profile/ProfileAvatarPicker";
import { SupportChatPanel } from "../components/profile/SupportChatPanel";
import { UserAvatar } from "../components/UserAvatar";
import { ProfileStorePanel } from "../components/profile/ProfileStorePanel";
import {
  FeedbackModal,
  FeedbackTopbarIcon,
} from "../components/profile/FeedbackModal";
import { ProfileNotificationStack } from "../components/profile/ProfileNotificationStack";
import { ChatRoom } from "../components/chat/ChatRoom";
import { DailyMissionsPanel } from "../components/chat/DailyMissionsPanel";
import { LiveMatchCard } from "../components/lobby/LiveMatchCard";
import { FeaturedLiveChannel } from "../components/lobby/FeaturedLiveChannel";
import { RealtimeFeedPanel } from "../components/lobby/RealtimeFeedPanel";
import { SeasonalRankPanel } from "../components/lobby/SeasonalRankPanel";
import {
  MatchGuideButton,
  MatchGuideModal,
} from "../components/lobby/MatchGuideModal";
import { PlayingMatchModal } from "../components/match/PlayingMatchModal";
import { NewsModal } from "../components/news/NewsModal";
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  isCustomAvatarDataUrlValue,
  isPremadeRpsAvatar,
  resolveAvatar,
} from "../lib/avatars";
import {
  getLiveMatchesInitialVisible,
  getLiveMatchesPoolCap,
  getLiveMatchesShowMoreStep,
  LIVE_MATCHES_INITIAL_VISIBLE,
  LIVE_MATCHES_MAX_VISIBLE,
  LIVE_MATCHES_SYNC_MS,
  LIVE_MATCH_EXIT_FADE_MS,
  LOBBY_CLOCK_MS,
  LOBBY_SNAPSHOT_THROTTLE_MS,
} from "../lib/performance";
import {
  formatRac,
  formatRafc,
  formatSignedRac,
  getWithdrawNetFeeMessage,
} from "../lib/currency";
import { isPremiumNamePrefix, PREMIUM_NAME_WARNING } from "../lib/premiumNames";
import type {
  BalanceHistoryItem,
  UserMatchHistoryItem,
  LobbySnapshot,
  Match,
  MatchLedger,
  RematchState,
  ShopAvatarOption,
  User,
  ActiveNewsResponse,
} from "../lib/types";

const DISCORD_INVITE_URL = "https://discord.gg/tUtySfHKf3";
const MAX_AVATAR_FILE_SIZE = 1.5 * 1024 * 1024;

const INACTIVITY_LOGOUT_MS = 60 * 60 * 1000;
const RPS_ACCOUNT_VISITOR_KEY = "rps-account-visitor";
const onboardingCompleteKey = (userId: string) =>
  `rps-onboarding-complete-${userId}`;
const MATCH_FINISH_CELEBRATION_MS = 5200;
const LIVE_MATCH_FINISH_FADE_OUT_MS = 2800;
const LIVE_MATCH_SLOT_HOLD_MS = Math.max(
  250,
  Math.floor(LIVE_MATCH_FINISH_FADE_OUT_MS * 0.25),
);
const SHOW_REALTIME_HISTORY = true;
const onboardingSeenKey = (userId: string) => `rps-onboarding-seen-${userId}`;
const newsDismissedKey = (userId: string, dateKey?: string) =>
  `rps-news-dismissed-${userId}-${dateKey || new Date().toISOString().slice(0, 10)}`;

type MatchView = {
  mode: "none" | "waiting" | "playing";
  matchId: string | null;
  price: number | null;
  ledger: MatchLedger | null;
};

type LiveFeedSlot = {
  key: string;
  live: Match | null;
  exitFade: Match | null;
};

type ExitAnimation = {
  id: string;
  match: Match;
  startedAt: number;
  orderIndex: number;
};

type AuthCaptcha = {
  captchaId: string;
  prompt: string;
  imageDataUrl: string;
  expiresAt: number;
};

const fmt = formatRac;
const fmtAgo = (timestamp: number | null | undefined, now: number) => {
  if (!timestamp) {
    return "--";
  }

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const mins = Math.floor(seconds / 60);
  return `${mins}m ago`;
};

const sanitizeTxHashInput = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const hashMatch = normalized.match(/0x[a-fA-F0-9]{64}/);
  if (hashMatch) {
    return hashMatch[0];
  }

  return normalized;
};

type DepositConfirmApiResult = {
  status: string;
  user: User;
  requestId: string;
  txHash?: string;
  amountPoints?: number;
  amountWei?: string;
  confirmations?: number;
};

const DEPOSIT_CONFIRM_RESULT_FIELDS: Array<
  keyof DepositConfirmApiResult | "userBalance" | "username"
> = [
  "status",
  "requestId",
  "txHash",
  "amountPoints",
  "amountWei",
  "confirmations",
  "username",
  "userBalance",
];

const formatDepositResultValue = (value: unknown) => {
  if (value == null || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(3);
  }

  return String(value);
};

const buildDepositConfirmResultEntries = (result: DepositConfirmApiResult) => {
  const expanded: Record<string, unknown> = {
    status: result.status,
    requestId: result.requestId,
    txHash: result.txHash,
    amountPoints: result.amountPoints,
    amountWei: result.amountWei,
    confirmations: result.confirmations,
    username: result.user?.username,
    userBalance: result.user?.balance_usdt,
  };

  return DEPOSIT_CONFIRM_RESULT_FIELDS.filter(
    (key) => expanded[key] !== undefined && expanded[key] !== null,
  ).map((key) => ({
    key,
    label: key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (char) => char.toUpperCase()),
    value:
      key === "amountPoints"
        ? formatRac(Number(expanded.amountPoints))
        : key === "userBalance"
          ? formatRac(Number(expanded.userBalance))
          : formatDepositResultValue(expanded[key]),
  }));
};

const DepositApiResultPanel = ({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ key: string; label: string; value: string }>;
}) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="depositApiResultPanel">
      <div className="depositApiResultTitle">{title}</div>
      <dl className="depositApiResultList">
        {entries.map((entry) => (
          <div key={entry.key} className="depositApiResultRow">
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default function HomePage() {
  type WalletTab =
    | "deposit"
    | "withdraw"
    | "history"
    | "missions"
    | "store"
    | "profile"
    | "chat";

  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    mail: "",
    username: "",
    avatar: "",
    birthday: "",
    refer: "",
  });
  const [depositAmount, setDepositAmount] = useState("20");
  const [depositAddress, setDepositAddress] = useState("");
  const [depositNetwork, setDepositNetwork] = useState("");
  const [depositRequestId, setDepositRequestId] = useState("");
  const [depositTxHash, setDepositTxHash] = useState("");
  const [depositExpectedWei, setDepositExpectedWei] = useState("");
  const [depositQrOpen, setDepositQrOpen] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositConfirmLoading, setDepositConfirmLoading] = useState(false);
  const [depositConfirmResult, setDepositConfirmResult] =
    useState<DepositConfirmApiResult | null>(null);
  const [depositCompletedNotice, setDepositCompletedNotice] = useState<{
    amount: number;
  } | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [walletTab, setWalletTab] = useState<WalletTab>("deposit");
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState("20");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawTxHash, setWithdrawTxHash] = useState("");
  const [withdrawTxUrl, setWithdrawTxUrl] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>(
    [],
  );
  const [balanceHistoryLoading, setBalanceHistoryLoading] = useState(false);
  const [matchHistory, setMatchHistory] = useState<UserMatchHistoryItem[]>([]);
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false);
  const [historySubTab, setHistorySubTab] = useState<"balance" | "match">(
    "balance",
  );
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [displayOrderVersion, setDisplayOrderVersion] = useState(0);
  const [exitAnimations, setExitAnimations] = useState<ExitAnimation[]>([]);
  const releasedExitIdsRef = useRef<Set<string>>(new Set());
  const exitAnimationsRef = useRef<ExitAnimation[]>([]);
  const {
    items: notificationItems,
    isExiting: notificationExiting,
    notify,
    notifySuccess,
    notifyError,
  } = useProfileNotifications();

  const handleNotify = useCallback(
    (message: string, type: ProfileNotificationType = "info") => {
      if (type === "error") {
        notifyError(message);
        return;
      }
      if (type === "success") {
        notifySuccess(message);
        return;
      }
      notify(message);
    },
    [notify, notifyError, notifySuccess],
  );

  const notifyOnceRef = useRef(createNotificationDeduper());

  const notifyQueueStarted = useCallback(
    (matchId: string, message: string) => {
      notifyOnceRef.current.once(notificationKeys.queueStarted(matchId), () => {
        notify(message);
      });
    },
    [notify],
  );

  const notifyMatchConnected = useCallback(
    (matchId: string, message: string) => {
      notifyOnceRef.current.once(
        notificationKeys.matchConnected(matchId),
        () => {
          notify(message);
        },
      );
    },
    [notify],
  );

  const notifyMatchReleased = useCallback(
    (matchId: string, reason: string) => {
      if (!shouldNotifyMatchRelease(reason)) {
        return;
      }

      notifyOnceRef.current.once(
        notificationKeys.matchReleased(matchId),
        () => {
          notify(formatMatchReleaseMessage(reason));
        },
      );
    },
    [notify],
  );

  const notifyMatchFinished = useCallback(
    (matchId: string, message: string) => {
      notifyOnceRef.current.once(
        notificationKeys.matchFinished(matchId),
        () => {
          notify(message);
        },
      );
    },
    [notify],
  );

  const clearMatchMatchState = useCallback(() => {
    setFinishedReferralBonuses([]);
    setFinishedAtMs(null);
    setActiveMatch(null);
    setOpponentMoveLockedHint(false);
    setMoveSubmitted(null);
    setRematchState(null);
    rematchStateRef.current = null;
    setRematchChoiceLoading(false);
    setMatchView({ mode: "none", matchId: null, price: null, ledger: null });
  }, []);

  const leaveRematchRoom = useCallback(
    (sessionId?: string | null, matchId?: string | null) => {
      if (sessionId) {
        dismissedRematchMatchIdsRef.current.add(sessionId);
      }
      if (matchId) {
        dismissedRematchMatchIdsRef.current.add(matchId);
      }
      if (activeMatchRef.current?.id) {
        dismissedRematchMatchIdsRef.current.add(activeMatchRef.current.id);
      }
      clearMatchMatchState();
      const currentUser = userRef.current;
      if (currentUser?.id) {
        refreshUser(currentUser.id).catch(() => undefined);
      }
    },
    [clearMatchMatchState],
  );

  const applyRematchStarted = useCallback((match: Match) => {
    if (dismissedRematchMatchIdsRef.current.has(match.id)) {
      return;
    }

    dismissedRematchMatchIdsRef.current.delete(match.id);
    rematchStateRef.current = null;
    setRematchState(null);
    setRematchChoiceLoading(false);
    setFinishedAtMs(null);
    setFinishedReferralBonuses([]);
    setMoveSubmitted(null);
    setOpponentMoveLockedHint(false);
    setActiveMatch(match);
    setMatchView({
      mode: "playing",
      matchId: match.id,
      price: match.price,
      ledger: match.ledger || "rac",
    });
    getSocket().emit("match:join", { matchId: match.id });
    const currentUser = userRef.current;
    if (currentUser?.id) {
      refreshUser(currentUser.id).catch(() => undefined);
    }
  }, []);

  const notifyQueueCancelled = useCallback(
    (matchId: string | null) => {
      const key = matchId
        ? notificationKeys.queueCancelled(matchId)
        : "queue:cancelled";
      notifyOnceRef.current.once(key, () => {
        notify("Matchmaking cancelled.");
      });
    },
    [notify],
  );

  const [matchView, setMatchView] = useState<MatchView>({
    mode: "none",
    matchId: null,
    price: null,
    ledger: null,
  });
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [moveSubmitted, setMoveSubmitted] = useState<
    "rock" | "paper" | "scissors" | null
  >(null);
  const [now, setNow] = useState(Date.now());
  const [visibleLiveMatchCount, setVisibleLiveMatchCount] = useState(
    LIVE_MATCHES_INITIAL_VISIBLE,
  );
  const [isMobileLobby, setIsMobileLobby] = useState(false);
  const [useMobileRealtimeRail, setUseMobileRealtimeRail] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobileLeftDrawerOpen, setMobileLeftDrawerOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showWelcomePassword, setShowWelcomePassword] = useState(false);
  const [authCaptcha, setAuthCaptcha] = useState<AuthCaptcha | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [queueStartedAt, setQueueStartedAt] = useState<number | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileConfirmPassword, setProfileConfirmPassword] = useState("");
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [showProfileConfirmPassword, setShowProfileConfirmPassword] =
    useState(false);
  const [profileAvatarWindowOpen, setProfileAvatarWindowOpen] = useState(false);
  const [shopAvatars, setShopAvatars] = useState<ShopAvatarOption[]>([]);
  const [shopAvatarsLoading, setShopAvatarsLoading] = useState(false);
  const [shopPurchasing, setShopPurchasing] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState("final");
  const [guestLoginOpen, setGuestLoginOpen] = useState(false);
  const [guestLoginMode, setGuestLoginMode] = useState<
    "name_only" | "name_password"
  >("name_only");
  const [welcomeName, setWelcomeName] = useState("");
  const [welcomePassword, setWelcomePassword] = useState("");
  const [guestLoginError, setGuestLoginError] = useState("");
  const [guestLoginLoading, setGuestLoginLoading] = useState(false);
  const [insufficientBalanceModal, setInsufficientBalanceModal] = useState<{
    ledger: MatchLedger;
    price: number;
  } | null>(null);
  const [onboardingCongratsOpen, setOnboardingCongratsOpen] = useState(false);
  const [onboardingUiActive, setOnboardingUiActive] = useState(false);
  const onboardingFinishedRef = useRef(false);
  const onboardingMatchActiveRef = useRef(false);
  const onboardingFinishTimerRef = useRef<number | null>(null);
  const [guideVideoModalOpen, setGuideVideoModalOpen] = useState(false);
  const [matchGuideOpen, setMatchGuideOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeNews, setActiveNews] = useState<ActiveNewsResponse | null>(null);
  const pendingNewsUserIdRef = useRef<string | null>(null);
  const newsUserIdRef = useRef<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [finishedReferralBonuses, setFinishedReferralBonuses] = useState<
    {
      userId: string;
      username: string;
      avatar?: string | null;
      amount: number;
    }[]
  >([]);
  const [showGoBurst, setShowGoBurst] = useState(false);
  const [lastGoBurstKey, setLastGoBurstKey] = useState("");
  const [finishedAtMs, setFinishedAtMs] = useState<number | null>(null);
  const [rematchState, setRematchState] = useState<RematchState | null>(null);
  const [rematchChoiceLoading, setRematchChoiceLoading] = useState(false);
  const rematchStateRef = useRef<RematchState | null>(null);
  const dismissedRematchMatchIdsRef = useRef<Set<string>>(new Set());
  const cancelledQueueMatchIdsRef = useRef<Set<string>>(new Set());
  const [opponentMoveLockedHint, setOpponentMoveLockedHint] = useState(false);
  const previousStageRef = useRef<string | null>(null);
  const goBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountModalOpenedAtRef = useRef(0);
  const liveMatchesRef = useRef<Match[]>([]);
  const pendingLiveMatchesRef = useRef<Match[] | null>(null);
  const liveSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMatchRef = useRef<Match | null>(null);
  const matchViewRef = useRef<MatchView>({
    mode: "none",
    matchId: null,
    price: null,
    ledger: null,
  });
  const waitingCancelledRef = useRef(false);
  const userRef = useRef<User | null>(null);
  const loginPromptRef = useRef<Awaited<
    ReturnType<typeof api.loginPrompt>
  > | null>(null);
  const liveMatchDisplayOrderRef = useRef<string[]>([]);
  const liveMatchQueueRef = useRef<Match[]>([]);
  const visibleLiveMatchCountRef = useRef(LIVE_MATCHES_INITIAL_VISIBLE);
  const pendingSnapshotRef = useRef<LobbySnapshot | null>(null);
  const snapshotSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const previousSupportUnreadRef = useRef(0);
  const supportUnreadReadyRef = useRef(false);
  const matchRoomsScrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollMatchRoomsLeft, setCanScrollMatchRoomsLeft] = useState(false);
  const [canScrollMatchRoomsRight, setCanScrollMatchRoomsRight] =
    useState(false);

  const referFeePercent = snapshot?.referFeePercent ?? "2";
  const systemFeeRate = snapshot?.systemFeeRate ?? 0.2;

  const inviteLink = useMemo(() => {
    if (!user?.id || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/${encodeURIComponent(user.id)}`;
  }, [user?.id]);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const sortLiveMatches = (matches: Match[]) => {
    const previousIndexById = new Map(
      liveMatchDisplayOrderRef.current.map((id, index) => [id, index]),
    );

    return [...matches].sort((a, b) => {
      const aPrev = previousIndexById.get(a.id);
      const bPrev = previousIndexById.get(b.id);

      if (aPrev !== undefined && bPrev !== undefined) {
        return aPrev - bPrev;
      }
      if (aPrev !== undefined) {
        return -1;
      }
      if (bPrev !== undefined) {
        return 1;
      }

      const createdDiff =
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }

      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  };

  const compactGridAfterExit = useCallback(
    (exitMatchId: string, pairedBackfillId?: string) => {
      if (releasedExitIdsRef.current.has(exitMatchId)) {
        return;
      }
      releasedExitIdsRef.current.add(exitMatchId);

      const order = [...liveMatchDisplayOrderRef.current];
      const exitIdx = order.indexOf(exitMatchId);
      const reservedIds = new Set(order.filter((id) => id !== exitMatchId));

      let backfillId = pairedBackfillId;
      if (!backfillId) {
        backfillId = liveMatchQueueRef.current.find(
          (match) => match.id !== exitMatchId && !reservedIds.has(match.id),
        )?.id;
      }

      if (backfillId) {
        if (exitIdx >= 0) {
          order[exitIdx] = backfillId;
        } else {
          order.push(backfillId);
        }
      } else if (exitIdx >= 0) {
        order.splice(exitIdx, 1);
      }

      liveMatchDisplayOrderRef.current = order;
    },
    [],
  );

  const applyLiveMatchesWithFade = useCallback(
    (matches: Match[]) => {
      const cap = getLiveMatchesPoolCap();
      const fullSorted = sortLiveMatches(matches);
      liveMatchQueueRef.current = fullSorted;
      const nextSorted = fullSorted.slice(0, cap);
      const previousMatches = liveMatchesRef.current;
      const previousIds = new Set(previousMatches.map((match) => match.id));
      const nextMatchIds = new Set(nextSorted.map((match) => match.id));
      const removedMatches = previousMatches.filter(
        (match) => !nextMatchIds.has(match.id),
      );

      if (removedMatches.length) {
        const incomingBackfills = nextSorted.filter(
          (match) => !previousIds.has(match.id),
        );
        const visibleCount = visibleLiveMatchCountRef.current;
        const newExits: ExitAnimation[] = [];

        for (let index = 0; index < removedMatches.length; index += 1) {
          const exitMatch = removedMatches[index];
          const orderIndex = liveMatchDisplayOrderRef.current.indexOf(
            exitMatch.id,
          );
          const backfillId = incomingBackfills[index]?.id;

          releasedExitIdsRef.current.delete(exitMatch.id);
          compactGridAfterExit(exitMatch.id, backfillId);

          if (orderIndex < 0 || orderIndex >= visibleCount) {
            continue;
          }

          newExits.push({
            id: exitMatch.id,
            match: exitMatch,
            startedAt: Date.now(),
            orderIndex,
          });
        }

        if (newExits.length) {
          setExitAnimations((prev) => {
            const activeIds = new Set(prev.map((anim) => anim.id));
            const next = [...prev];
            for (const exitAnim of newExits) {
              if (activeIds.has(exitAnim.id)) {
                continue;
              }
              next.push(exitAnim);
            }
            exitAnimationsRef.current = next;
            return next;
          });
          setDisplayOrderVersion((version) => version + 1);
        }
      }

      liveMatchesRef.current = nextSorted;
      setLiveMatches(nextSorted);
    },
    [compactGridAfterExit],
  );

  const syncLiveMatchesWithFade = useCallback(
    (matches: Match[]) => {
      pendingLiveMatchesRef.current = matches;
      if (liveSyncTimerRef.current) {
        return;
      }

      const flushPending = () => {
        liveSyncTimerRef.current = null;
        const pending = pendingLiveMatchesRef.current;
        if (!pending) {
          return;
        }
        pendingLiveMatchesRef.current = null;
        applyLiveMatchesWithFade(pending);
      };

      flushPending();
      liveSyncTimerRef.current = setTimeout(() => {
        if (pendingLiveMatchesRef.current) {
          flushPending();
        } else {
          liveSyncTimerRef.current = null;
        }
      }, LIVE_MATCHES_SYNC_MS);
    },
    [applyLiveMatchesWithFade],
  );

  const syncSnapshotThrottled = useCallback((payload: LobbySnapshot) => {
    pendingSnapshotRef.current = payload;
    if (snapshotSyncTimerRef.current) {
      return;
    }

    const flushPending = () => {
      snapshotSyncTimerRef.current = null;
      const pending = pendingSnapshotRef.current;
      if (!pending) {
        return;
      }
      pendingSnapshotRef.current = null;
      setSnapshot(pending);
    };

    flushPending();
    snapshotSyncTimerRef.current = setTimeout(() => {
      if (pendingSnapshotRef.current) {
        flushPending();
      } else {
        snapshotSyncTimerRef.current = null;
      }
    }, LOBBY_SNAPSHOT_THROTTLE_MS);
  }, []);

  const markAccountVisitor = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RPS_ACCOUNT_VISITOR_KEY, "1");
    }
  };

  const clearReturningVisitorFlags = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RPS_ACCOUNT_VISITOR_KEY);
    }
  };

  const isAccountVisitor = () =>
    typeof window !== "undefined" &&
    window.localStorage.getItem(RPS_ACCOUNT_VISITOR_KEY) === "1";

  const markOnboardingComplete = (userId: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(onboardingCompleteKey(userId), "1");
    }
  };

  const guestNeedsWelcome = (profile: User | null | undefined) => {
    if (!profile?.id) {
      return false;
    }
    if (profile.has_password ?? false) {
      return false;
    }
    return profile.onboarding_complete !== true;
  };

  const applyLoginPromptToWelcome = (
    hint: Awaited<ReturnType<typeof api.loginPrompt>>,
  ) => {
    setGuestLoginError("");
    setWelcomePassword("");
    setShowWelcomePassword(false);
    setGuestLoginLoading(false);
    setWelcomeName(hint.suggestedUsername || "");
    setGuestLoginMode(
      hint.mode === "name_password" ? "name_password" : "name_only",
    );
  };

  const showWelcomeModal = (
    hint: Awaited<ReturnType<typeof api.loginPrompt>> = {
      mode: "name_only",
      suggestedUsername: null,
    },
  ) => {
    if (hint.firstVisit) {
      clearReturningVisitorFlags();
    }
    applyLoginPromptToWelcome(hint);
    setGuestLoginOpen(true);
  };

  const openRegisteredLoginModal = (suggestedUsername?: string | null) => {
    setGuestLoginOpen(false);
    setLoginIdentifier(suggestedUsername || "");
    setLoginPassword("");
    setAccountError("");
    setAccountMode("login");
    accountModalOpenedAtRef.current = Date.now();
    setAccountModalOpen(true);
  };

  const openTopbarLogin = () => {
    if (onboardingUiActive) {
      return;
    }

    if (user) {
      openAccountModal();
      return;
    }

    void openVisitorLogin();
  };

  const openAccountModal = () => {
    if (onboardingUiActive) {
      return;
    }

    if (!user) {
      openTopbarLogin();
      return;
    }

    accountModalOpenedAtRef.current = Date.now();
    setGuestLoginOpen(false);
    setForm((prev) => ({
      ...prev,
      avatar: resolveAvatar(user?.avatar),
    }));
    setProfileUsername(user?.username || "");
    setProfilePassword("");
    setProfileConfirmPassword("");
    setShowProfilePassword(false);
    setShowProfileConfirmPassword(false);
    setProfileAvatarWindowOpen(false);
    // setCaptchaAnswer("");
    setAccountModalOpen(true);
  };

  const openDepositFromInsufficientBalance = (price: number) => {
    setInsufficientBalanceModal(null);
    setDepositAmount(String(price));
    setWalletTab("deposit");
    openAccountModal();
  };

  const openShopDepositForPrice = (priceRac: number) => {
    setDepositAmount(String(priceRac));
    setWalletTab("deposit");
    openAccountModal();
  };

  const openAccountModalTab = (
    tab: WalletTab,
    options?: { openModal?: boolean },
  ) => {
    setWalletTab(tab);

    if (tab === "history" && user?.id) {
      loadHistoryPanels(user.id).catch(() => {});
    }

    if (tab === "store" && user?.id) {
      loadShopPanels(user.id).catch(() => {});
    }

    if (tab === "chat") {
      setUnreadSupportCount(0);
    }

    if (options?.openModal !== false) {
      openAccountModal();
    }
  };

  const guestNamePremiumWarning =
    guestLoginMode === "name_only" && isPremiumNamePrefix(welcomeName)
      ? PREMIUM_NAME_WARNING
      : "";

  const registerNamePremiumWarning = isPremiumNamePrefix(form.username)
    ? PREMIUM_NAME_WARNING
    : "";

  const profileNamePremiumWarning =
    isPremiumNamePrefix(profileUsername) &&
    profileUsername.trim().toLowerCase() !==
      String(user?.username || "")
        .trim()
        .toLowerCase()
      ? PREMIUM_NAME_WARNING
      : "";

  const applyAuthSession = (payload: {
    user: User;
    token: string;
    expiredAt: number;
  }) => {
    setAuthCredentials({
      token: payload.token,
      userId: payload.user.id,
      expiredAt: payload.expiredAt,
    });
    setUser(payload.user);
    setGuestLoginOpen(false);
  };

  const startOnboardingMatch = async (match: Match, userId?: string) => {
    onboardingMatchActiveRef.current = Boolean(match.isOnboarding ?? true);
    setOnboardingUiActive(true);

    let latestMatch = match;
    try {
      const response = await api.matchById(match.id);
      latestMatch = response.match;
    } catch {
      latestMatch = match;
    }

    setActiveMatch(latestMatch);
    setFinishedReferralBonuses([]);
    setFinishedAtMs(null);
    setOpponentMoveLockedHint(false);
    setMatchView({
      mode: "playing",
      matchId: latestMatch.id,
      price: latestMatch.price,
      ledger: latestMatch.ledger || "rac",
    });
    setQueueStartedAt(null);
    setMoveSubmitted(null);

    const joinOnboardingMatch = () => {
      const socket = getSocket();
      const resolvedUserId = userId || userRef.current?.id;
      if (resolvedUserId) {
        socket.emit("auth:identify", { userId: resolvedUserId });
      }
      socket.emit("match:join", { matchId: latestMatch.id });
    };

    const socket = getSocket();
    if (socket.connected) {
      joinOnboardingMatch();
    } else {
      socket.once("connect", joinOnboardingMatch);
    }

    window.setTimeout(() => {
      void api
        .matchById(latestMatch.id)
        .then((response) => {
          if (activeMatchRef.current?.id !== response.match.id) {
            return;
          }
          setActiveMatch(response.match);
        })
        .catch(() => undefined);
    }, 800);

    notify("Welcome match started against Arena Bot.");
  };

  const openVisitorLogin = async () => {
    setGuestLoginError("");
    setWelcomePassword("");
    setGuestLoginLoading(false);

    try {
      const hint = await api.loginPrompt();
      loginPromptRef.current = hint;

      if (
        hint.status === "logged_in" &&
        hint.user &&
        hint.token &&
        hint.expiredAt
      ) {
        applyAuthSession({
          user: hint.user,
          token: hint.token,
          expiredAt: hint.expiredAt,
        });
        return;
      }

      applyLoginPromptToWelcome(hint);
      setGuestLoginOpen(true);
    } catch {
      setWelcomeName("");
      setGuestLoginMode("name_password");
      setGuestLoginOpen(true);
    }
  };

  const openGuestLogin = openVisitorLogin;

  const submitGuestLogin = async () => {
    const normalizedUsername = welcomeName.trim();

    if (guestLoginMode === "name_password") {
      const normalizedPassword = welcomePassword.trim();
      if (!normalizedUsername) {
        setGuestLoginError("Please enter your name.");
        return;
      }
      if (!normalizedPassword) {
        setGuestLoginError("Please enter your password.");
        return;
      }

      setGuestLoginLoading(true);
      setGuestLoginError("");
      try {
        const result = await api.enterPassword({
          username: normalizedUsername,
          password: normalizedPassword,
        });
        if (
          result.status === "logged_in" &&
          result.user &&
          result.token &&
          result.expiredAt
        ) {
          applyAuthSession({
            user: result.user,
            token: result.token,
            expiredAt: result.expiredAt,
          });
          setGuestLoginOpen(false);
          notifySuccess(`Welcome back, ${result.user.username}.`);
        }
      } catch (error) {
        setGuestLoginError((error as Error).message);
      } finally {
        setGuestLoginLoading(false);
      }
      return;
    }

    if (!normalizedUsername) {
      setGuestLoginError("Please enter your name.");
      return;
    }

    if (isPremiumNamePrefix(normalizedUsername)) {
      setGuestLoginError(PREMIUM_NAME_WARNING);
      return;
    }

    setGuestLoginLoading(true);
    setGuestLoginError("");
    try {
      const result = await api.enterName({ username: normalizedUsername });
      if (result.status === "password_required" && result.username) {
        setWelcomeName(result.username);
        setWelcomePassword("");
        setGuestLoginMode("name_password");
        return;
      }

      if (
        result.status === "logged_in" &&
        result.user &&
        result.token &&
        result.expiredAt
      ) {
        applyAuthSession({
          user: result.user,
          token: result.token,
          expiredAt: result.expiredAt,
        });
        setGuestLoginOpen(false);
        notifySuccess(`Welcome back, ${result.user.username}.`);
        return;
      }

      if (
        result.status === "onboarding_match" &&
        result.user &&
        result.token &&
        result.expiredAt &&
        result.match
      ) {
        applyAuthSession({
          user: result.user,
          token: result.token,
          expiredAt: result.expiredAt,
        });
        queueNewsAfterAuth(result.user.id, true);
        setGuestLoginOpen(false);
        void startOnboardingMatch(result.match, result.user.id);
      }
    } catch (error) {
      setGuestLoginError((error as Error).message);
    } finally {
      setGuestLoginLoading(false);
    }
  };

  const clearOnboardingFinishTimer = () => {
    if (onboardingFinishTimerRef.current) {
      window.clearTimeout(onboardingFinishTimerRef.current);
      onboardingFinishTimerRef.current = null;
    }
  };

  const handleOnboardingMatchFinished = useCallback((match: Match) => {
    setActiveMatch(match);
    setFinishedReferralBonuses([]);
    setFinishedAtMs(Date.now());
    setQueueStartedAt(null);
    setOpponentMoveLockedHint(false);
    setMoveSubmitted(null);
    setMatchView({
      mode: "playing",
      matchId: match.id,
      price: match.price,
      ledger: match.ledger || "rac",
    });

    if (onboardingFinishedRef.current) {
      return;
    }

    onboardingFinishedRef.current = true;
    onboardingMatchActiveRef.current = false;
    clearOnboardingFinishTimer();
    onboardingFinishTimerRef.current = window.setTimeout(() => {
      onboardingFinishTimerRef.current = null;
      setOnboardingCongratsOpen(true);
      setActiveMatch(null);
      setFinishedAtMs(null);
      setFinishedReferralBonuses([]);
      setMatchView({ mode: "none", matchId: null, price: null, ledger: null });
    }, MATCH_FINISH_CELEBRATION_MS);
  }, []);

  const startPlayingAfterOnboarding = async () => {
    try {
      clearOnboardingFinishTimer();
      const { user: updatedUser } = await api.completeOnboarding();
      markOnboardingComplete(updatedUser.id);
      setUser(updatedUser);
      setOnboardingCongratsOpen(false);
      setOnboardingUiActive(false);
      onboardingFinishedRef.current = false;
      onboardingMatchActiveRef.current = false;
      setActiveMatch(null);
      setFinishedAtMs(null);
      setFinishedReferralBonuses([]);
      setMatchView({ mode: "none", matchId: null, price: null, ledger: null });
      await loadBalanceHistory(updatedUser.id);
      notifySuccess("Welcome! Your 50 RAC sign-up bonus is ready.");
      void releasePendingNews(updatedUser.id);
    } catch (error) {
      notifyError((error as Error).message);
    }
  };

  const refreshAuthCaptcha = async () => {
    // setCaptchaLoading(true);
    // try {
    //   const nextCaptcha = await api.authCaptcha();
    //   setAuthCaptcha({
    //     captchaId: nextCaptcha.captchaId,
    //     prompt: nextCaptcha.prompt,
    //     imageDataUrl: nextCaptcha.imageDataUrl,
    //     expiresAt: nextCaptcha.expiresAt,
    //   });
    //   setCaptchaAnswer("");
    // } catch {
    //   setAuthCaptcha(null);
    //   setAccountError("Failed to load CAPTCHA. Please try again.");
    // } finally {
    //   setCaptchaLoading(false);
    // }
  };

  const setAvatarFromFile = async (file?: File) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAccountError("Please upload an image file.");
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAccountError("Image is too large. Please use up to 1.5MB.");
      return;
    }

    let dataUrl = "";

    try {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
      });
    } catch (error) {
      const text = (error as Error).message;
      setAccountError(text);
      notifyError(text);
      return;
    }

    if (!isCustomAvatarDataUrlValue(dataUrl)) {
      setAccountError("Unsupported image format. Use PNG, JPG, WEBP or GIF.");
      return;
    }

    setForm((prev) => ({ ...prev, avatar: dataUrl }));
    setAccountError("");
  };

  const refreshUser = async (userId: string) => {
    const { user: latest } = await api.user(userId);
    setUser(latest);
  };

  const maybeShowActiveNews = useCallback(async (userId: string) => {
    if (typeof window === "undefined" || !userId) {
      return;
    }

    if (window.localStorage.getItem(newsDismissedKey(userId))) {
      return;
    }

    try {
      const response = await api.news();
      if (!response.items.length) {
        return;
      }

      setActiveNews((current) => (current?.items.length ? current : response));
      newsUserIdRef.current = userId;
    } catch (error) {
      console.warn("Failed to load active news:", error);
    }
  }, []);

  const releasePendingNews = useCallback(
    async (userId?: string | null) => {
      const resolvedUserId =
        userId || pendingNewsUserIdRef.current || userRef.current?.id;
      if (!resolvedUserId) {
        return;
      }

      pendingNewsUserIdRef.current = null;
      await maybeShowActiveNews(resolvedUserId);
    },
    [maybeShowActiveNews],
  );

  const shouldDeferNewsModal =
    onboardingOpen ||
    onboardingUiActive ||
    onboardingCongratsOpen ||
    Boolean(pendingNewsUserIdRef.current) ||
    guestNeedsWelcome(user);

  useEffect(() => {
    if (!user?.id || shouldDeferNewsModal) {
      return;
    }

    void maybeShowActiveNews(user.id);
  }, [user?.id, shouldDeferNewsModal, maybeShowActiveNews]);

  const closeNewsModal = (dismissToday = false) => {
    if (dismissToday) {
      const userId = user?.id || newsUserIdRef.current;
      if (userId) {
        window.localStorage.setItem(newsDismissedKey(userId), "1");
      }
    }

    setActiveNews(null);
  };

  const newsModalOpen =
    (activeNews?.items.length ?? 0) > 0 && !shouldDeferNewsModal;

  const queueNewsAfterAuth = (userId: string, onboardingWillOpen: boolean) => {
    if (onboardingWillOpen) {
      pendingNewsUserIdRef.current = userId;
      return;
    }

    void maybeShowActiveNews(userId);
  };

  const loadBalanceHistory = async (userId: string) => {
    setBalanceHistoryLoading(true);
    try {
      const response = await api.userBalanceHistory(userId, 60);
      setBalanceHistory(response.history || []);
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setBalanceHistoryLoading(false);
    }
  };

  const loadMatchHistory = async (userId: string) => {
    setMatchHistoryLoading(true);
    try {
      const response = await api.userMatchHistory(userId, 30);
      setMatchHistory(response.history || []);
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setMatchHistoryLoading(false);
    }
  };

  const loadShopPanels = async (userId: string) => {
    await loadShopAvatars(userId);
  };

  const loadSupportUnreadCount = useCallback(async () => {
    if (!userRef.current?.id) {
      setUnreadSupportCount(0);
      return 0;
    }

    const response = await api.supportUnread();
    const count = Math.max(0, Number(response.unreadCount || 0));
    setUnreadSupportCount(count);
    return count;
  }, []);

  const loadHistoryPanels = async (userId: string) => {
    await Promise.all([loadBalanceHistory(userId), loadMatchHistory(userId)]);
  };

  const loadShopAvatars = async (userId: string) => {
    setShopAvatarsLoading(true);
    try {
      const response = await api.shopAvatars(userId);
      setShopAvatars(response.avatars || []);
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setShopAvatarsLoading(false);
    }
  };

  const handlePurchaseShopAvatar = async (avatarId: string) => {
    if (!user || shopPurchasing) {
      return;
    }

    const selected = shopAvatars.find((entry) => entry.id === avatarId);
    const currency = selected?.currencyType || "usdt";
    const availableBalance =
      currency === "rac" ? user.balance_rac || 0 : user.balance_usdt || 0;
    if (selected && selected.priceRac > availableBalance) {
      if (currency === "usdt") {
        openShopDepositForPrice(selected.priceRac);
      } else {
        notifyError("Insufficient RAC balance.");
      }
      return;
    }

    try {
      setShopPurchasing(true);
      const result = await api.purchaseShopAvatar(user.id, avatarId);
      setUser(result.user);
      if (result.avatars) {
        setShopAvatars(result.avatars);
      }
      setForm((prev) => ({
        ...prev,
        avatar: resolveAvatar(result.user.avatar),
      }));
      notifySuccess("Avatar purchased and equipped.");
    } catch (error) {
      const message = (error as Error).message;
      if (message === "insufficient balance" && selected) {
        if (currency === "usdt") {
          openShopDepositForPrice(selected.priceRac);
        } else {
          notifyError("Insufficient RAC balance.");
        }
        return;
      }
      notifyError(message);
    } finally {
      setShopPurchasing(false);
    }
  };

  const handleSelectShopAvatar = async (avatarId: string) => {
    if (!user || shopPurchasing) {
      return;
    }

    try {
      setShopPurchasing(true);
      const result = await api.selectShopAvatar(user.id, avatarId);
      setUser(result.user);
      if (result.avatars) {
        setShopAvatars(result.avatars);
      }
      setForm((prev) => ({
        ...prev,
        avatar: resolveAvatar(result.user.avatar),
      }));
      notifySuccess("Avatar updated.");
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setShopPurchasing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrapVisitor = async () => {
      const credentials = getAuthCredentials();

      try {
        if (credentials && credentials.expiredAt > Date.now()) {
          try {
            const { user: latest } = await api.user(credentials.userId);
            if (cancelled) {
              return;
            }

            if (guestNeedsWelcome(latest)) {
              clearAuthCredentials();
              setUser(null);
            } else {
              if (latest.onboarding_complete) {
                markOnboardingComplete(latest.id);
              }
              setUser(latest);
              return;
            }
          } catch {
            clearAuthCredentials();
            setUser(null);
          }
        } else if (credentials) {
          clearAuthCredentials();
        }

        const hint = await api.loginPrompt();
        if (cancelled) {
          return;
        }

        loginPromptRef.current = hint;

        if (hint.firstVisit) {
          clearAuthCredentials();
          clearReturningVisitorFlags();
          showWelcomeModal(hint);
          return;
        }

        if (
          hint.status === "logged_in" &&
          hint.user &&
          hint.token &&
          hint.expiredAt
        ) {
          if (guestNeedsWelcome(hint.user)) {
            return;
          }

          applyAuthSession({
            user: hint.user,
            token: hint.token,
            expiredAt: hint.expiredAt,
          });
        }
      } catch {
        // Returning visitors log in manually from the profile avatar.
      } finally {
        if (!cancelled) {
          void api.recordVisit().catch(() => {});
        }
      }
    };

    void bootstrapVisitor();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onAuthExpired = () => {
      void logout("Session expired. Please log in again.", {
        skipApiLogout: true,
      });
    };

    window.addEventListener("rps:auth-expired", onAuthExpired);
    return () => {
      window.removeEventListener("rps:auth-expired", onAuthExpired);
    };
  }, []);

  useEffect(() => {
    const onDailyMissionRefresh = () => {
      const userId = userRef.current?.id;
      if (!userId) {
        return;
      }

      api
        .user(userId)
        .then((response) => {
          if (response.user) {
            setUser(response.user);
          }
        })
        .catch(() => {});
    };

    window.addEventListener("rps:daily-mission-refresh", onDailyMissionRefresh);
    return () => {
      window.removeEventListener(
        "rps:daily-mission-refresh",
        onDailyMissionRefresh,
      );
    };
  }, []);

  useEffect(() => {
    if (!accountModalOpen || !user?.id) {
      return;
    }
    loadHistoryPanels(user.id).catch(() => {});
  }, [accountModalOpen, user?.id]);

  useEffect(() => {
    if (walletTab !== "store" || !user?.id) {
      return;
    }

    void loadShopPanels(user.id);
  }, [walletTab, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadSupportCount(0);
      previousSupportUnreadRef.current = 0;
      supportUnreadReadyRef.current = false;
      return;
    }

    let cancelled = false;

    const syncUnread = async () => {
      try {
        const nextCount = await loadSupportUnreadCount();
        if (cancelled) {
          return;
        }

        if (!supportUnreadReadyRef.current) {
          previousSupportUnreadRef.current = nextCount;
          supportUnreadReadyRef.current = true;
          return;
        }

        const previous = previousSupportUnreadRef.current;
        if (nextCount > previous) {
          const incoming = nextCount - previous;
          handleNotify(
            incoming === 1
              ? "New message from admin support."
              : `${incoming} new messages from admin support.`,
          );
        }

        previousSupportUnreadRef.current = nextCount;
      } catch {
        // Ignore transient unread polling failures.
      }
    };

    void syncUnread();
    const timer = window.setInterval(() => {
      void syncUnread();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [handleNotify, loadSupportUnreadCount, user?.id]);

  const ownedShopAvatars = useMemo(
    () => shopAvatars.filter((entry) => entry.owned),
    [shopAvatars],
  );

  const myInMatch = useMemo(() => {
    if (!activeMatch) {
      return null;
    }

    const playerId = getActivePlayerId(user?.id);
    if (activeMatch.userId1 === playerId) {
      return "player1";
    }
    if (activeMatch.userId2 === playerId) {
      return "player2";
    }
    return null;
  }, [user?.id, activeMatch]);

  const waitingSeconds = useMemo(() => {
    if (!queueStartedAt) {
      return 0;
    }
    return Math.max(0, Math.floor((now - queueStartedAt) / 1000));
  }, [queueStartedAt, now]);

  useEffect(() => {
    if (!activeMatch) {
      previousStageRef.current = null;
      setShowGoBurst(false);
      return;
    }

    const prevStage = previousStageRef.current;
    const currentStage = activeMatch.stage;
    const hasLeftIntro =
      prevStage === "intro" &&
      ["countdown_5", "countdown_20"].includes(currentStage);

    if (hasLeftIntro) {
      const burstKey = `${activeMatch.id}:${activeMatch.roundNumber}:go-burst`;
      if (lastGoBurstKey !== burstKey) {
        setLastGoBurstKey(burstKey);
        setShowGoBurst(true);

        if (goBurstTimerRef.current) {
          clearTimeout(goBurstTimerRef.current);
        }

        goBurstTimerRef.current = setTimeout(() => {
          setShowGoBurst(false);
        }, 2000);
      }
    }

    previousStageRef.current = currentStage;
  }, [activeMatch, lastGoBurstKey]);

  useEffect(() => {
    return () => {
      if (goBurstTimerRef.current) {
        clearTimeout(goBurstTimerRef.current);
      }
    };
  }, []);

  const playersPlaying = useMemo(() => {
    const direct = snapshot?.currentlyPlaying;
    if (typeof direct === "number" && Number.isFinite(direct)) {
      return direct;
    }

    return (snapshot?.matchCount ?? []).reduce(
      (sum, entry) => sum + (Number(entry.count) || 0),
      0,
    );
  }, [snapshot?.currentlyPlaying, snapshot?.matchCount]);

  const trustMetrics = useMemo(() => {
    const playersOnline = snapshot?.subscribers ?? 0;
    const matchesInProgress = Math.floor(playersPlaying / 2);
    const matchesPlayedToday = snapshot?.matchesPlayedToday ?? 0;

    return {
      playersOnline,
      playersPlaying,
      matchesInProgress,
      matchesPlayedToday,
      lastFinishedText: fmtAgo(snapshot?.lastMatchFinishedAt, now),
      completedLast10s: snapshot?.matchesCompletedLast10s ?? 0,
      fastestToday: snapshot?.fastestMatchTodaySeconds,
      peakActivity: snapshot?.peakActivityLabel,
      activeSearchers: snapshot?.activeSearchers ?? 0,
    };
  }, [snapshot, now, playersPlaying]);

  const activityItems = snapshot?.activityFeed ?? [];
  const recentWinnerItems = useMemo(
    () => (snapshot?.recentWinners ?? []).slice(0, 6),
    [snapshot],
  );
  const { feedSlots, totalFeedAvailable } = useMemo(() => {
    const visibleCount = visibleLiveMatchCount;
    const liveById = new Map(liveMatches.map((match) => [match.id, match]));
    const queueById = new Map(
      liveMatchQueueRef.current.map((match) => [match.id, match]),
    );
    const resolveMatch = (id: string) =>
      liveById.get(id) ?? queueById.get(id) ?? null;

    const activeExits = exitAnimations.filter(
      (anim) => now - anim.startedAt < LIVE_MATCH_EXIT_FADE_MS,
    );
    const activeExitIds = new Set(activeExits.map((anim) => anim.id));
    const poolIds = new Set(liveMatchQueueRef.current.map((match) => match.id));

    const pickNextMatch = (reservedIds: Set<string>) =>
      liveMatchQueueRef.current.find(
        (match) => !reservedIds.has(match.id) && !activeExitIds.has(match.id),
      ) ?? null;

    let order = liveMatchDisplayOrderRef.current.filter(
      (id) => poolIds.has(id) || activeExitIds.has(id),
    );
    order = order.slice(0, visibleCount);

    const reserved = new Set(order);
    while (order.length < visibleCount) {
      const filler = pickNextMatch(reserved);
      if (!filler) {
        break;
      }
      order.push(filler.id);
      reserved.add(filler.id);
    }

    for (let index = 0; index < visibleCount; index += 1) {
      const id = order[index];
      const hasExit = activeExits.some((anim) => anim.orderIndex === index);
      if (id && (resolveMatch(id) || hasExit)) {
        continue;
      }

      const filler = pickNextMatch(new Set(order));
      if (filler) {
        order[index] = filler.id;
      } else if (id) {
        order.splice(index, 1);
        index -= 1;
      }
    }

    while (order.length < visibleCount) {
      const filler = pickNextMatch(new Set(order));
      if (!filler) {
        break;
      }
      order.push(filler.id);
    }

    order = order.slice(0, visibleCount);
    liveMatchDisplayOrderRef.current = order;

    const slots: LiveFeedSlot[] = [];
    for (let index = 0; index < visibleCount; index += 1) {
      const id = order[index];
      let live = id ? resolveMatch(id) : null;
      const exitAnim = activeExits.find((anim) => anim.orderIndex === index);

      if (!live) {
        const filler = pickNextMatch(new Set(order));
        if (filler) {
          live = filler;
          order[index] = filler.id;
        }
      }

      if (!live && !exitAnim) {
        continue;
      }

      slots.push({
        key: `${index}-${live?.id ?? exitAnim?.id ?? "empty"}`,
        live,
        exitFade: exitAnim?.match ?? null,
      });
    }

    liveMatchDisplayOrderRef.current = order;

    const totalFeedAvailable = liveMatchQueueRef.current.length;

    return { feedSlots: slots, totalFeedAvailable };
  }, [
    displayOrderVersion,
    exitAnimations,
    liveMatches,
    now,
    visibleLiveMatchCount,
  ]);

  const displayedLiveMatchCount = Math.min(
    visibleLiveMatchCount,
    totalFeedAvailable,
  );

  const canShowMoreLiveMatches =
    visibleLiveMatchCount < LIVE_MATCHES_MAX_VISIBLE &&
    totalFeedAvailable > visibleLiveMatchCount;

  const showMoreLiveMatchCount = Math.min(
    getLiveMatchesShowMoreStep(isMobileLobby),
    LIVE_MATCHES_MAX_VISIBLE - visibleLiveMatchCount,
    totalFeedAvailable - visibleLiveMatchCount,
  );

  const showMoreLiveMatches = () => {
    const step = getLiveMatchesShowMoreStep(isMobileLobby);
    setVisibleLiveMatchCount((current) =>
      Math.min(current + step, LIVE_MATCHES_MAX_VISIBLE, totalFeedAvailable),
    );
  };

  const liveNowSec = useMemo(() => Math.floor(now / 1000), [now]);

  useEffect(() => {
    activeMatchRef.current = activeMatch;
  }, [activeMatch]);

  useEffect(() => {
    matchViewRef.current = matchView;
  }, [matchView]);

  useEffect(() => {
    rematchStateRef.current = rematchState;
  }, [rematchState]);

  const restoreRematchLobby = useCallback(
    (state: RematchState, match: Match) => {
      if (match.state !== "finished") {
        return;
      }

      setActiveMatch(match);
      setFinishedAtMs(Date.now() - 1200);
      setMoveSubmitted(null);
      setOpponentMoveLockedHint(false);
      setMatchView({
        mode: "playing",
        matchId: match.id,
        price: state.price,
        ledger: state.ledger,
      });
      getSocket().emit("match:join", { matchId: match.id });
    },
    [],
  );

  const shouldAcceptIncomingMatch = useCallback((match: Match) => {
    if (waitingCancelledRef.current) {
      return false;
    }

    const currentView = matchViewRef.current;
    if (currentView.mode === "none") {
      return false;
    }

    if (currentView.mode === "waiting") {
      return (
        Boolean(currentView.matchId) &&
        match.id === currentView.matchId &&
        Boolean(match.userId2)
      );
    }

    if (currentView.mode === "playing") {
      return !currentView.matchId || match.id === currentView.matchId;
    }

    return false;
  }, []);

  useEffect(() => {
    if (
      !activeMatch?.id ||
      activeMatch.stage !== "intro" ||
      !activeMatch.countdownEndsAt
    ) {
      return;
    }

    const resyncMatch = () => {
      const currentMatch = activeMatchRef.current;
      if (!currentMatch || currentMatch.stage !== "intro") {
        return;
      }

      void api
        .matchById(currentMatch.id)
        .then((response) => setActiveMatch(response.match))
        .catch(() => undefined);

      const socket = getSocket();
      socket.emit("match:join", { matchId: currentMatch.id });
    };

    const delayMs = Math.max(0, activeMatch.countdownEndsAt - Date.now() + 250);
    const timer = window.setTimeout(resyncMatch, delayMs);

    return () => window.clearTimeout(timer);
  }, [activeMatch?.countdownEndsAt, activeMatch?.id, activeMatch?.stage]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1430px)");
    const syncRail = () => setUseMobileRealtimeRail(media.matches);
    syncRail();
    media.addEventListener("change", syncRail);
    return () => media.removeEventListener("change", syncRail);
  }, []);

  useEffect(() => {
    if (!useMobileRealtimeRail) {
      setMobileChatOpen(false);
      setMobileLeftDrawerOpen(false);
    }
  }, [useMobileRealtimeRail]);

  useEffect(() => {
    const drawerOpen =
      useMobileRealtimeRail && (mobileChatOpen || mobileLeftDrawerOpen);
    if (!drawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileChatOpen(false);
        setMobileLeftDrawerOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileChatOpen, mobileLeftDrawerOpen, useMobileRealtimeRail]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 860px)");
    const syncVisibleLiveMatches = () => {
      const mobile = media.matches;
      setIsMobileLobby(mobile);
      setVisibleLiveMatchCount(getLiveMatchesInitialVisible(mobile));
    };
    syncVisibleLiveMatches();
    media.addEventListener("change", syncVisibleLiveMatches);
    return () => media.removeEventListener("change", syncVisibleLiveMatches);
  }, []);

  useEffect(() => {
    liveMatchesRef.current = liveMatches;
  }, [liveMatches]);

  useEffect(() => {
    visibleLiveMatchCountRef.current = visibleLiveMatchCount;
  }, [visibleLiveMatchCount]);

  useEffect(() => {
    exitAnimationsRef.current = exitAnimations;
  }, [exitAnimations]);

  useEffect(() => {
    const nextAnimations = exitAnimationsRef.current.filter(
      (anim) => now - anim.startedAt < LIVE_MATCH_EXIT_FADE_MS,
    );

    if (nextAnimations.length !== exitAnimationsRef.current.length) {
      exitAnimationsRef.current = nextAnimations;
      setExitAnimations(nextAnimations);
    }
  }, [now]);

  useEffect(() => {
    return () => {
      if (liveSyncTimerRef.current) {
        clearTimeout(liveSyncTimerRef.current);
      }
      if (snapshotSyncTimerRef.current) {
        clearTimeout(snapshotSyncTimerRef.current);
      }
      releasedExitIdsRef.current.clear();
      exitAnimationsRef.current = [];
      setExitAnimations([]);
    };
  }, []);

  useEffect(() => {
    loadInitial().catch((error: Error) => notifyError(error.message));
  }, [notifyError]);

  useEffect(() => {
    registerNotifyHandler(handleNotify);

    return () => registerNotifyHandler(null);
  }, [handleNotify]);

  const loadInitial = async () => {
    const [snap, live] = await Promise.all([
      api.lobbySnapshot(),
      api.liveMatches(),
    ]);
    setSnapshot(snap);
    syncLiveMatchesWithFade(live.matches);
  };

  useEffect(() => {
    const syncFromApi = async () => {
      try {
        const [snap, live] = await Promise.all([
          api.lobbySnapshot(),
          api.liveMatches(),
        ]);
        syncSnapshotThrottled(snap);
        syncLiveMatchesWithFade(live.matches);
      } catch {}
    };

    void syncFromApi();
    const timer = setInterval(() => {
      void syncFromApi();
    }, 3000);

    return () => clearInterval(timer);
  }, [syncLiveMatchesWithFade, syncSnapshotThrottled]);

  useEffect(() => {
    if (!depositCompletedNotice) {
      return;
    }

    const timer = setTimeout(() => {
      setDepositCompletedNotice(null);
    }, 8000);

    return () => clearTimeout(timer);
  }, [depositCompletedNotice]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), LOBBY_CLOCK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id || matchView.mode !== "waiting" || activeMatch) {
      return;
    }

    if (!matchView.matchId) {
      return;
    }

    const matchedMatch = liveMatches.find(
      (match) =>
        match.id === matchView.matchId &&
        match.state === "playing" &&
        Boolean(match.userId2) &&
        (match.userId1 === user.id || match.userId2 === user.id),
    );

    if (!matchedMatch || !shouldAcceptIncomingMatch(matchedMatch)) {
      return;
    }

    setActiveMatch(matchedMatch);
    setMatchView({
      mode: "playing",
      matchId: matchedMatch.id,
      price: matchedMatch.price,
      ledger: matchedMatch.ledger || "rac",
    });
    setQueueStartedAt(null);
    notifyMatchConnected(
      matchedMatch.id,
      `Connected to opponent in ${matchedMatch.ledger === "free" ? formatRafc(matchedMatch.price) : fmt(matchedMatch.price)} match.`,
    );
    getSocket().emit("match:join", { matchId: matchedMatch.id });
  }, [
    activeMatch,
    liveMatches,
    matchView.matchId,
    matchView.mode,
    notifyMatchConnected,
    shouldAcceptIncomingMatch,
    user?.id,
  ]);

  useEffect(() => {
    const socket = getSocket();

    const onLobby = (payload: LobbySnapshot) => syncSnapshotThrottled(payload);
    const onLiveMatches = (matches: Match[]) => {
      syncLiveMatchesWithFade(matches);
    };
    const onMatchFound = ({ match }: { match: Match }) => {
      if (!shouldAcceptIncomingMatch(match)) {
        return;
      }

      setActiveMatch(match);
      setFinishedReferralBonuses([]);
      setFinishedAtMs(null);
      setOpponentMoveLockedHint(false);
      setMatchView({
        mode: "playing",
        matchId: match.id,
        price: match.price,
        ledger: match.ledger || "rac",
      });
      setQueueStartedAt(null);
      notifyMatchConnected(
        match.id,
        `Connected to opponent in ${match.ledger === "free" ? formatRafc(match.price) : fmt(match.price)} match.`,
      );
      setMoveSubmitted(null);
      socket.emit("match:join", { matchId: match.id });
    };
    const onMatchSync = ({ match }: { match: Match }) => {
      if (waitingCancelledRef.current) {
        return;
      }

      if (cancelledQueueMatchIdsRef.current.has(match.id)) {
        return;
      }

      if (dismissedRematchMatchIdsRef.current.has(match.id)) {
        return;
      }

      const currentView = matchViewRef.current;
      const isCurrentWaitingQueue =
        currentView.mode === "waiting" &&
        Boolean(currentView.matchId) &&
        match.id === currentView.matchId;
      const isCurrentPlayingMatch =
        currentView.mode === "playing" &&
        (!currentView.matchId || match.id === currentView.matchId);
      const isFinishedOnboarding =
        match.state === "finished" &&
        (match.isOnboarding || onboardingMatchActiveRef.current);

      const isRematchReconnect =
        match.state === "finished" &&
        (rematchStateRef.current?.finishedMatchId === match.id ||
          rematchStateRef.current?.sessionId === match.id);
      const isFinishedRematchReconnect =
        match.state === "finished" &&
        currentView.mode === "none" &&
        !match.isOnboarding &&
        !onboardingMatchActiveRef.current &&
        Boolean(rematchStateRef.current) &&
        (rematchStateRef.current?.finishedMatchId === match.id ||
          rematchStateRef.current?.sessionId === match.id);

      if (
        !isCurrentWaitingQueue &&
        !isCurrentPlayingMatch &&
        !isFinishedOnboarding &&
        !isRematchReconnect &&
        !isFinishedRematchReconnect &&
        !shouldAcceptIncomingMatch(match)
      ) {
        return;
      }

      setActiveMatch(match);
      if (match.state !== "finished") {
        setFinishedReferralBonuses([]);
      }
      if (match.state !== "finished") {
        setFinishedAtMs(null);
      }
      setOpponentMoveLockedHint(false);
      if (
        match.state === "finished" &&
        (match.isOnboarding || onboardingMatchActiveRef.current)
      ) {
        handleOnboardingMatchFinished(match);
        return;
      }
      setMatchView({
        mode: match.state === "waiting" ? "waiting" : "playing",
        matchId: match.id,
        price: match.price,
        ledger: match.ledger || "rac",
      });
      if (match.state === "finished" && rematchStateRef.current) {
        setFinishedAtMs(Date.now() - 1200);
      } else if (isFinishedRematchReconnect) {
        setFinishedAtMs(Date.now() - 1200);
      }
      setMoveSubmitted(null);
      socket.emit("match:join", { matchId: match.id });
    };
    const onRoundStarted = ({ match }: { match: Match }) => {
      setActiveMatch(match);
      setFinishedAtMs(null);
      setOpponentMoveLockedHint(false);
      setMoveSubmitted(null);
    };
    const onFallback = ({ match }: { match: Match }) => {
      setActiveMatch(match);
      setFinishedAtMs(null);
      setOpponentMoveLockedHint(false);
      setMoveSubmitted(null);
    };
    const onResolved = ({ match }: { match: Match }) => {
      setActiveMatch(match);
      setFinishedAtMs(null);
      setOpponentMoveLockedHint(false);
      setMoveSubmitted(null);
    };
    const onMoveLocked = ({
      matchId,
      userId,
    }: {
      matchId: string;
      userId: string;
    }) => {
      const currentMatch = activeMatchRef.current;
      const currentUser = userRef.current;
      if (!currentMatch || matchId !== currentMatch.id || !currentUser?.id) {
        return;
      }
      if (userId !== currentUser.id) {
        setOpponentMoveLockedHint(true);
      }
    };
    const onReleased = ({
      matchId,
      reason,
    }: {
      matchId: string;
      reason: string;
    }) => {
      cancelledQueueMatchIdsRef.current.add(matchId);
      notifyMatchReleased(matchId, reason);
      syncLiveMatchesWithFade(
        liveMatchesRef.current.filter((match) => match.id !== matchId),
      );

      const currentView = matchViewRef.current;
      const currentMatch = activeMatchRef.current;
      const isCurrentMatch =
        currentView.matchId === matchId || currentMatch?.id === matchId;

      if (!isCurrentMatch) {
        return;
      }

      setActiveMatch(null);
      setMatchView({ mode: "none", matchId: null, price: null, ledger: null });
      setMoveSubmitted(null);
      setQueueStartedAt(null);
      setFinishedAtMs(null);
      setFinishedReferralBonuses([]);
      setOpponentMoveLockedHint(false);
      setRematchState(null);
      setRematchChoiceLoading(false);
      const currentUser = userRef.current;
      if (currentUser?.id) {
        refreshUser(currentUser.id).catch(() => undefined);
      }
    };
    const onFinished = ({
      match,
      winner,
      referralBonuses,
      isOnboarding,
      rematchEligible,
    }: {
      match: Match;
      winner: { userId: string; username: string };
      referralBonuses?: {
        userId: string;
        username: string;
        avatar?: string | null;
        amount: number;
      }[];
      isOnboarding?: boolean;
      rematchEligible?: boolean;
    }) => {
      setActiveMatch(match);
      setFinishedReferralBonuses(
        Array.isArray(referralBonuses) ? referralBonuses : [],
      );
      setFinishedAtMs(Date.now());
      if (
        !(
          isOnboarding ||
          match.isOnboarding ||
          onboardingMatchActiveRef.current
        )
      ) {
        notifyMatchFinished(
          match.id,
          `Match finished. Winner: ${winner.username}`,
        );
      }
      setQueueStartedAt(null);
      setOpponentMoveLockedHint(false);
      const currentUser = userRef.current;
      if (currentUser?.id) {
        refreshUser(currentUser.id).catch(() => undefined);
      }

      if (
        isOnboarding ||
        match.isOnboarding ||
        onboardingMatchActiveRef.current
      ) {
        handleOnboardingMatchFinished(match);
        return;
      }

      if (rematchEligible) {
        dismissedRematchMatchIdsRef.current.delete(match.id);
        return;
      }

      setTimeout(() => {
        clearMatchMatchState();
      }, MATCH_FINISH_CELEBRATION_MS);
    };
    const onRematchState = (state: RematchState) => {
      if (
        dismissedRematchMatchIdsRef.current.has(state.sessionId) ||
        dismissedRematchMatchIdsRef.current.has(state.finishedMatchId)
      ) {
        return;
      }

      rematchStateRef.current = state;
      setRematchState(state);
      setRematchChoiceLoading(false);

      const currentView = matchViewRef.current;
      const currentMatch = activeMatchRef.current;
      const alreadyInRematchLobby =
        currentView.mode === "playing" &&
        (currentView.matchId === state.finishedMatchId ||
          currentMatch?.id === state.finishedMatchId);

      if (alreadyInRematchLobby) {
        if (currentMatch?.state === "finished") {
          setFinishedAtMs((value) => value ?? Date.now() - 1200);
        }
        return;
      }

      void api
        .matchById(state.finishedMatchId)
        .then((response) => {
          restoreRematchLobby(state, response.match);
        })
        .catch(() => undefined);
    };
    const onRematchStarted = ({ match }: { match: Match }) => {
      applyRematchStarted(match);
    };
    const onMatchClosed = ({
      sessionId,
    }: {
      sessionId?: string;
      reason?: string;
    } = {}) => {
      leaveRematchRoom(sessionId, activeMatchRef.current?.id ?? null);
    };

    socket.on("lobby:snapshot", onLobby);
    socket.on("matches:live", onLiveMatches);
    socket.on("match:found", onMatchFound);
    socket.on("match:sync", onMatchSync);
    socket.on("round:started", onRoundStarted);
    socket.on("round:fallback_started", onFallback);
    socket.on("round:move_locked", onMoveLocked);
    socket.on("round:resolved", onResolved);
    socket.on("match:released", onReleased);
    socket.on("match:finished", onFinished);
    socket.on("match:rematch_state", onRematchState);
    socket.on("match:rematch_started", onRematchStarted);
    socket.on("match:room_closed", onMatchClosed);

    return () => {
      socket.off("lobby:snapshot", onLobby);
      socket.off("matches:live", onLiveMatches);
      socket.off("match:found", onMatchFound);
      socket.off("match:sync", onMatchSync);
      socket.off("round:started", onRoundStarted);
      socket.off("round:fallback_started", onFallback);
      socket.off("round:move_locked", onMoveLocked);
      socket.off("round:resolved", onResolved);
      socket.off("match:released", onReleased);
      socket.off("match:finished", onFinished);
      socket.off("match:rematch_state", onRematchState);
      socket.off("match:rematch_started", onRematchStarted);
      socket.off("match:room_closed", onMatchClosed);
      clearOnboardingFinishTimer();
      if (userRef.current?.id) {
        socket.emit("client:disconnecting", { userId: userRef.current.id });
      }
    };
  }, [
    clearMatchMatchState,
    applyRematchStarted,
    handleOnboardingMatchFinished,
    leaveRematchRoom,
    notifyMatchConnected,
    notifyMatchFinished,
    notifyMatchReleased,
    restoreRematchLobby,
    shouldAcceptIncomingMatch,
    syncLiveMatchesWithFade,
    syncSnapshotThrottled,
  ]);

  useEffect(() => {
    const socket = getSocket();
    const identify = () => {
      const userId = getActivePlayerId(user?.id);
      if (userId) {
        socket.emit("auth:identify", { userId });
      }
    };

    identify();
    socket.on("connect", identify);

    return () => {
      socket.off("connect", identify);
    };
  }, [user?.id]);

  // useEffect(() => {
  //   if (!accountModalOpen || user) {
  //     return;
  //   }
  //   void refreshAuthCaptcha();
  // }, [accountModalOpen, accountMode, user]);

  useEffect(() => {
    if (!INVITE_FRIENDS_ENABLED || typeof window === "undefined") {
      return;
    }

    const referFromQuery = String(
      new URLSearchParams(window.location.search).get("refer") || "",
    ).trim();
    const pathReferCandidate = String(window.location.pathname || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    const referFromPath =
      pathReferCandidate && /^[0-9a-fA-F-]{32,40}$/.test(pathReferCandidate)
        ? pathReferCandidate
        : "";
    const referResolved = referFromPath || referFromQuery;
    if (!referResolved) {
      return;
    }

    setForm((prev) => ({ ...prev, refer: prev.refer || referResolved }));
  }, []);

  useEffect(() => {
    if (snapshot?.virtualEnabled === false) {
      // Virtual mode disabled - clear active match if it's virtual
      // Real matches will naturally disappear from feed as they're removed from emission
      if (activeMatch?.isVirtual) {
        setActiveMatch(null);
        setMatchView({
          mode: "none",
          matchId: null,
          price: null,
          ledger: null,
        });
      }
    }
  }, [snapshot?.virtualEnabled, activeMatch?.isVirtual]);

  const register = async () => {
    setAccountError("");

    const normalizedMail = form.mail.trim().toLowerCase();
    const normalizedUsername = form.username.trim();
    const normalizedPassword = registerPassword.trim();

    if (!normalizedMail || !normalizedUsername || !normalizedPassword) {
      setAccountError("Email, username and password are required.");
      return false;
    }

    if (isPremiumNamePrefix(normalizedUsername)) {
      setAccountError(PREMIUM_NAME_WARNING);
      return false;
    }

    if (!isValidEmail(normalizedMail)) {
      setAccountError("Please enter a valid email address.");
      return false;
    }

    if (!registerConfirmPassword) {
      setAccountError("Please confirm your password.");
      return false;
    }

    if (registerPassword !== registerConfirmPassword) {
      setAccountError("Password and confirm password do not match.");
      return false;
    }

    // if (!authCaptcha?.captchaId || !captchaAnswer.trim()) {
    //   setAccountError("Please complete CAPTCHA.");
    //   return false;
    // }

    try {
      const payload = {
        mail: normalizedMail,
        username: normalizedUsername,
        password: normalizedPassword,
        avatar: resolveAvatar(form.avatar),
        birthday: form.birthday,
        refer: INVITE_FRIENDS_ENABLED ? String(form.refer || "").trim() : "",
        // captchaId: authCaptcha.captchaId,
        // captchaAnswer: captchaAnswer.trim(),
      };
      const {
        user: registered,
        token,
        expiredAt,
      } = await api.register(payload);
      markAccountVisitor();
      setAuthCredentials({
        token,
        userId: registered.id,
        expiredAt,
      });
      setAccountModalOpen(false);
      setAccountMode("login");
      setUser(registered);
      notifySuccess("Registered. Please top up balance.");
      setOnboardingStep("final");
      setOnboardingOpen(true);
      await loadInitial();
      queueNewsAfterAuth(registered.id, true);
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      // setCaptchaAnswer("");
      setAccountError("");
      return true;
    } catch (error) {
      const text = (error as Error).message;
      setAccountError(text);
      notifyError(text);
      // if (text.toLowerCase().includes("captcha")) {
      //   void refreshAuthCaptcha();
      // }
      return false;
    }
  };

  const login = async () => {
    setAccountError("");

    const normalizedIdentifier = loginIdentifier.trim();
    const normalizedPassword = loginPassword.trim();

    if (!normalizedIdentifier || !normalizedPassword) {
      setAccountError("Please enter username/email and password.");
      return false;
    }

    if (
      normalizedIdentifier.includes("@") &&
      !isValidEmail(normalizedIdentifier)
    ) {
      setAccountError("Please enter a valid email or username.");
      return false;
    }

    // if (!authCaptcha?.captchaId || !captchaAnswer.trim()) {
    //   setAccountError("Please complete CAPTCHA.");
    //   return false;
    // }

    try {
      const {
        user: loggedIn,
        token,
        expiredAt,
      } = await api.login({
        identifier: normalizedIdentifier,
        password: normalizedPassword,
        // captchaId: authCaptcha.captchaId,
        // captchaAnswer: captchaAnswer.trim(),
      });
      markAccountVisitor();
      setAuthCredentials({
        token,
        userId: loggedIn.id,
        expiredAt,
      });
      setAccountModalOpen(false);
      setAccountMode("login");
      setUser(loggedIn);
      notifySuccess(`Welcome back, ${loggedIn.username}.`);
      await loadInitial();

      const onboardingWillOpen = !window.localStorage.getItem(
        onboardingSeenKey(loggedIn.id),
      );
      if (onboardingWillOpen) {
        setOnboardingStep("final");
        setOnboardingOpen(true);
      }

      if (loggedIn.id) {
        window.localStorage.setItem(onboardingSeenKey(loggedIn.id), "1");
      }

      queueNewsAfterAuth(loggedIn.id, onboardingWillOpen);
      setLoginIdentifier("");
      setLoginPassword("");
      // setCaptchaAnswer("");
      setAccountError("");
      return true;
    } catch (error) {
      const text = (error as Error).message;
      setAccountError(text);
      notifyError(text);
      // if (text.toLowerCase().includes("captcha")) {
      //   void refreshAuthCaptcha();
      // }
      return false;
    }
  };

  const saveProfile = async () => {
    if (!user) {
      return;
    }

    setAccountError("");

    const normalizedUsername = profileUsername.trim();
    const normalizedPassword = profilePassword.trim();
    const normalizedConfirmPassword = profileConfirmPassword.trim();

    if (!normalizedUsername) {
      setAccountError("Username is required.");
      return;
    }

    if (
      isPremiumNamePrefix(normalizedUsername) &&
      normalizedUsername.toLowerCase() !==
        String(user.username || "")
          .trim()
          .toLowerCase()
    ) {
      setAccountError(PREMIUM_NAME_WARNING);
      return;
    }

    if (normalizedPassword || normalizedConfirmPassword) {
      if (!normalizedPassword) {
        setAccountError("Please enter a new password.");
        return;
      }
      if (!normalizedConfirmPassword) {
        setAccountError("Please confirm your new password.");
        return;
      }
      if (normalizedPassword !== normalizedConfirmPassword) {
        setAccountError("Password and confirm password do not match.");
        return;
      }
    }

    const selectedAvatar = resolveAvatar(form.avatar || user.avatar);

    try {
      setProfileSaving(true);
      const payload: { avatar: string; username: string; password?: string } = {
        avatar: selectedAvatar,
        username: normalizedUsername,
      };

      if (normalizedPassword) {
        payload.password = normalizedPassword;
      }

      const { user: updatedUser } = await api.updateProfile(user.id, payload);
      setUser(updatedUser);
      if (normalizedPassword && updatedUser.id) {
        window.localStorage.setItem(onboardingSeenKey(updatedUser.id), "1");
      }
      setProfilePassword("");
      setProfileConfirmPassword("");
      setForm((prev) => ({
        ...prev,
        avatar: resolveAvatar(updatedUser.avatar),
      }));
      setProfileUsername(updatedUser.username || normalizedUsername);
      await refreshUser(updatedUser.id);
      setAccountModalOpen(false);
      notifySuccess("Profile changes saved successfully.");
      await loadInitial();
    } catch (error) {
      const text = (error as Error).message;
      setAccountError(text);
      notifyError(text);
    } finally {
      setProfileSaving(false);
    }
  };

  const depositBusy = depositLoading || depositConfirmLoading;

  const showDepositError = (text: string) => {
    setDepositError(text);
    notifyError(text);
  };

  const clearDepositError = () => {
    setDepositError(null);
  };

  const deposit = async () => {
    if (!user || depositBusy) {
      return;
    }

    try {
      const amount = Number(depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        showDepositError("Please enter a positive amount.");
        return;
      }

      clearDepositError();
      setDepositLoading(true);
      const response = await api.deposit({
        userId: user.id,
        amount,
      });
      setDepositCompletedNotice(null);
      setDepositConfirmResult(null);
      setDepositRequestId(response.requestId);
      setDepositAddress(response.treasuryAddress);
      setDepositNetwork(response.network);
      setDepositExpectedWei(response.expectedWei);
      setDepositTxHash("");
      setDepositQrOpen(true);
      notify(
        `Deposit address ready. Send exact USDT or USDC for ${fmt(response.expectedPoints)} on ${response.network}, then paste tx hash and confirm deposit.`,
      );
    } catch (error) {
      showDepositError((error as Error).message);
    } finally {
      setDepositLoading(false);
    }
  };

  const confirmDeposit = async () => {
    if (!user || depositConfirmLoading) {
      return;
    }

    try {
      const requestId = depositRequestId.trim();
      const txHash = sanitizeTxHashInput(depositTxHash);

      if (!requestId || !depositAddress) {
        showDepositError("Please click Get Deposit Address first.");
        return;
      }

      if (!txHash) {
        showDepositError("Please enter deposit transaction hash.");
        return;
      }

      clearDepositError();
      setDepositConfirmLoading(true);
      const response = await api.confirmDeposit({
        userId: user.id,
        requestId,
        txHash,
      });

      setDepositConfirmResult(response);
      setUser(response.user);

      if (response.status === "credited") {
        clearDepositError();
        setDepositCompletedNotice({
          amount: Number(response.amountPoints || 0),
        });
        notifySuccess(
          `Deposit completed. ${fmt(response.amountPoints || 0)} credited to your balance.`,
        );
      } else {
        showDepositError(
          `Deposit could not be completed. Status: ${response.status}.`,
        );
      }

      setDepositRequestId("");
      setDepositTxHash("");
      setDepositAddress("");
      setDepositNetwork("");
      setDepositExpectedWei("");
      setDepositQrOpen(false);
      await loadBalanceHistory(user.id);
    } catch (error) {
      showDepositError((error as Error).message);
    } finally {
      setDepositConfirmLoading(false);
    }
  };

  const withdraw = async () => {
    if (!user || withdrawLoading) {
      return;
    }

    try {
      const amount = Number(withdrawAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        notifyError("Please enter a positive amount.");
        return;
      }
      const toAddress = withdrawAddress.trim();
      if (!toAddress) {
        notifyError("Please enter your wallet address.");
        return;
      }

      setWithdrawLoading(true);
      const response = await api.withdraw({
        userId: user.id,
        amount,
        toAddress,
      });
      setUser(response.user);
      setWithdrawTxHash(response.txHash);
      setWithdrawTxUrl(response.txUrl || "");
      await loadBalanceHistory(user.id);
      notifySuccess(
        `Withdraw submitted. Sent ${fmt(response.amountPoints ?? amount)} to ${response.toAddress}.`,
      );
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setWithdrawLoading(false);
    }
  };

  const finishOnboarding = () => {
    if (user?.id) {
      window.localStorage.setItem(onboardingSeenKey(user.id), "1");
    }
    setOnboardingOpen(false);
    setOnboardingStep("final");
    void releasePendingNews(user?.id);
  };

  const logout = async (
    reason = "Logged out.",
    options?: { skipApiLogout?: boolean },
  ) => {
    const skipApiLogout = options?.skipApiLogout === true;

    if (user?.id) {
      const socket = getSocket();
      socket.emit("client:disconnecting", { userId: user.id });
    }

    if (!skipApiLogout && getAuthToken()) {
      try {
        await api.logout();
      } catch {}
    }

    clearAuthCredentials();

    setUser(null);
    setActiveMatch(null);
    setMatchView({ mode: "none", matchId: null, price: null, ledger: null });
    setMoveSubmitted(null);
    setQueueStartedAt(null);
    setFinishedAtMs(null);
    setDepositQrOpen(false);
    setAccountModalOpen(false);
    setGuestLoginOpen(false);
    clearOnboardingFinishTimer();
    setOnboardingCongratsOpen(false);
    setOnboardingUiActive(false);
    setUnreadSupportCount(0);
    previousSupportUnreadRef.current = 0;
    supportUnreadReadyRef.current = false;
    notifyOnceRef.current.reset();
    notify(reason);
  };

  useEffect(() => {
    if (!user?.id) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      return;
    }

    const armInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      inactivityTimerRef.current = setTimeout(() => {
        void logout("Logged out after 1 hour of inactivity.", {
          skipApiLogout: false,
        });
      }, INACTIVITY_LOGOUT_MS);
    };

    const onActivity = () => {
      armInactivityTimer();
    };

    armInactivityTimer();

    const activityEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "mousemove",
      "wheel",
      "scroll",
    ] as const;

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity as EventListener);
      });
    };
  }, [user?.id]);

  const matchRoomCards = useMemo(() => {
    const merged = new Map<
      string,
      { ledger: MatchLedger; price: number; count: number }
    >();

    for (const entry of snapshot?.matchCount || []) {
      const price = Number(entry.price);
      if (!Number.isFinite(price) || price <= 0) {
        continue;
      }

      const ledger = (entry.ledger || "rac") as MatchLedger;
      const key = `${ledger}:${price}`;
      const current = merged.get(key) || { ledger, price, count: 0 };
      current.count += Number(entry.count) || 0;
      merged.set(key, current);
    }

    return [...merged.values()].sort((a, b) => {
      if (a.ledger !== b.ledger) {
        return a.ledger === "free" ? -1 : 1;
      }
      return a.price - b.price;
    });
  }, [snapshot?.matchCount]);

  const syncMatchRoomScrollButtons = useCallback(() => {
    const el = matchRoomsScrollerRef.current;
    if (!el) {
      setCanScrollMatchRoomsLeft(false);
      setCanScrollMatchRoomsRight(false);
      return;
    }

    const threshold = 2;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanScrollMatchRoomsLeft(el.scrollLeft > threshold);
    setCanScrollMatchRoomsRight(maxScrollLeft - el.scrollLeft > threshold);
  }, []);

  const scrollMatchRooms = useCallback((direction: "left" | "right") => {
    const el = matchRoomsScrollerRef.current;
    if (!el) {
      return;
    }

    const amount = Math.max(180, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    syncMatchRoomScrollButtons();
  }, [matchRoomCards, syncMatchRoomScrollButtons]);

  useEffect(() => {
    const onResize = () => syncMatchRoomScrollButtons();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncMatchRoomScrollButtons]);

  const getLedgerPlayerCount = (ledger: MatchLedger) =>
    matchRoomCards
      .filter((entry) => entry.ledger === ledger)
      .reduce((sum, entry) => sum + entry.count, 0);

  const handleSelectMatchRoom = async (price: number, ledger: MatchLedger) => {
    await joinPrice(price, ledger);
  };

  const joinPrice = async (price: number, ledger: MatchLedger) => {
    if (!user) {
      notifyError("Please register first.");
      return;
    }

    const availableBalance =
      ledger === "free" ? user.balance_rac || 0 : user.balance_usdt || 0;
    if (availableBalance < price) {
      setInsufficientBalanceModal({ ledger, price });
      return;
    }

    const playerId = getActivePlayerId(user.id);
    const stakeLabel = ledger === "free" ? formatRafc(price) : fmt(price);

    try {
      waitingCancelledRef.current = false;
      cancelledQueueMatchIdsRef.current.clear();
      const response = await api.joinMatchmaking({
        userId: playerId,
        price,
        ledger,
      });
      setMatchView({
        mode: response.mode === "waiting" ? "waiting" : "playing",
        matchId: response.matchId || response.match?.id || null,
        price,
        ledger,
      });
      if (response.mode === "matched" && response.match) {
        setActiveMatch(response.match);
        getSocket().emit("match:join", { matchId: response.match.id });
      }

      if (response.mode === "waiting") {
        if (response.matchId) {
          getSocket().emit("match:join", { matchId: response.matchId });
        }
        setQueueStartedAt(Date.now());
      } else {
        setQueueStartedAt(null);
      }

      await refreshUser(user.id);

      const matchId = response.matchId || response.match?.id;
      if (response.mode === "waiting" && matchId) {
        notifyQueueStarted(
          matchId,
          `Waiting for another player to join your ${stakeLabel} stake.`,
        );
      } else if (response.mode === "matched" && matchId) {
        notifyMatchConnected(
          matchId,
          `Connected to opponent in ${stakeLabel} match.`,
        );
      }
    } catch (error) {
      notifyError((error as Error).message);
    }
  };

  const cancelWaiting = async () => {
    if (!user) {
      return;
    }

    waitingCancelledRef.current = true;
    const waitingMatchId = matchViewRef.current.matchId;
    if (waitingMatchId) {
      cancelledQueueMatchIdsRef.current.add(waitingMatchId);
    }

    try {
      await api.cancelMatchmaking({ userId: user.id });
      clearMatchMatchState();
      setQueueStartedAt(null);
      await refreshUser(user.id);
      notifyQueueCancelled(waitingMatchId);
    } catch (error) {
      waitingCancelledRef.current = false;
      if (waitingMatchId) {
        cancelledQueueMatchIdsRef.current.delete(waitingMatchId);
      }
      notifyError((error as Error).message);
      return;
    }

    waitingCancelledRef.current = false;

    if (waitingMatchId) {
      syncLiveMatchesWithFade(
        liveMatchesRef.current.filter((match) => match.id !== waitingMatchId),
      );
    }
  };

  const submitMove = async (move: "rock" | "paper" | "scissors") => {
    if (!activeMatch) {
      return;
    }

    try {
      await api.submitMove(activeMatch.id, {
        userId: getActivePlayerId(user?.id),
        move,
      });
      setMoveSubmitted(move);
    } catch (error) {
      notifyError((error as Error).message);
    }
  };

  const handleDiscordInviteClick = async (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();

    if (!user?.id) {
      window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer");
      return;
    }

    const popup = window.open("about:blank", "_blank");
    try {
      const result = await api.discordInviteClick();
      if (popup) {
        popup.location.href = result.redirectUrl;
      } else {
        window.location.href = result.redirectUrl;
      }
      window.dispatchEvent(new CustomEvent("rps:daily-mission-refresh"));
    } catch {
      if (popup) {
        popup.location.href = DISCORD_INVITE_URL;
      } else {
        window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleRematchChoice = async (choice: "continue" | "quit") => {
    if (!activeMatch || !user?.id || rematchChoiceLoading) {
      return;
    }

    const sessionId = rematchState?.sessionId || activeMatch.id;
    setRematchChoiceLoading(true);
    try {
      const result = await api.submitRematchChoice({
        matchId: sessionId,
        userId: getActivePlayerId(user.id),
        choice,
      });
      if (result.match) {
        applyRematchStarted(result.match);
      } else if (result.closed) {
        leaveRematchRoom(sessionId, activeMatch.id);
      }
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setRematchChoiceLoading(false);
    }
  };

  const handleConfirmRematchQuit = async (confirmLeave: boolean) => {
    if (!activeMatch || !user?.id || rematchChoiceLoading) {
      return;
    }

    const sessionId = rematchState?.sessionId || activeMatch.id;
    const matchId = activeMatch.id;

    if (confirmLeave) {
      leaveRematchRoom(sessionId, matchId);
    }

    setRematchChoiceLoading(true);
    try {
      const result = await api.confirmRematchQuit({
        matchId: sessionId,
        userId: getActivePlayerId(user.id),
        confirmLeave,
      });
      if (result.match) {
        applyRematchStarted(result.match);
      } else if (result.closed) {
        leaveRematchRoom(sessionId, matchId);
      }
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setRematchChoiceLoading(false);
    }
  };

  const openAccountModalFromTopbar = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openTopbarLogin();
  };

  const scrollToLobbySection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    const scrollContainer = document.querySelector(".lobbyPrimary");
    const useCenterScroll =
      scrollContainer instanceof HTMLElement &&
      window.matchMedia("(min-width: 1431px)").matches;

    if (useCenterScroll) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop =
        scrollContainer.scrollTop + (targetRect.top - containerRect.top) - 12;
      scrollContainer.scrollTo({
        behavior: "smooth",
        top: Math.max(0, nextTop),
      });
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openGuideVideo = () => {
    setGuideVideoModalOpen(true);
  };

  const closeGuideVideoModal = () => {
    setGuideVideoModalOpen(false);
  };

  const openInviteModal = () => {
    setInviteCopied(false);
    setInviteModalOpen(true);
  };

  const closeInviteModal = () => {
    setInviteModalOpen(false);
    setInviteCopied(false);
  };

  const copyInviteLink = async () => {
    if (!inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      notifySuccess("Invite link copied.");
    } catch {
      setAccountError("Could not copy invite link. Please copy manually.");
    }
  };

  const showRegisteredTopbar = Boolean(user?.id) && !onboardingUiActive;
  const topbarUser = showRegisteredTopbar ? user : null;

  const realtimeFeedPanel = (
    <RealtimeFeedPanel
      recentWinnerItems={recentWinnerItems}
      showHistory={SHOW_REALTIME_HISTORY}
      showSeasonalRank={!useMobileRealtimeRail}
      isAuthenticated={showRegisteredTopbar}
      viewerUserId={showRegisteredTopbar ? getActivePlayerId(user?.id) : null}
      onNotify={handleNotify}
    />
  );

  const mobileLeftDrawerPanel = (
    <div className="mobileLeftDrawerPanel">
      <SeasonalRankPanel
        isAuthenticated={showRegisteredTopbar}
        viewerUserId={showRegisteredTopbar ? getActivePlayerId(user?.id) : null}
        onNotify={handleNotify}
      />
      <DailyMissionsPanel
        userId={getActivePlayerId(user?.id)}
        isAuthenticated={showRegisteredTopbar}
        onNotify={handleNotify}
        variant="lobby"
        onShowAllMissions={() => openAccountModalTab("missions")}
      />
    </div>
  );

  return (
    <div className="page">
      {/* â”€â”€ Topbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <header className="topbar">
        <div className="topbarLogoMark">
          <img
            className="topbarLogoImage"
            src="/logo.png"
            alt="RPS Arena logo"
          />
          <div className="topbarWordmark" aria-label="RPS Arena">
            <span>RPS Arena</span>
            <span>Play More, Win Bigger, Earn Faster!</span>
          </div>
        </div>

        <div className="topbarStats" aria-live="polite">
          <span className="statChip">
            <span className="dot" />
            {trustMetrics.playersOnline} connected
          </span>
          <span className="statChip">
            <span className="dot playing" />
            {trustMetrics.playersPlaying} playing
          </span>
        </div>

        <div className="userArea">
          <button
            className="topbarFeedbackButton"
            type="button"
            aria-label="Open feedback and earn 50 RAC"
            onClick={() => {
              if (topbarUser) {
                setFeedbackModalOpen(true);
                return;
              }
              openTopbarLogin();
            }}
          >
            <span className="topbarFeedbackButtonPulse" aria-hidden="true" />
            <span className="topbarFeedbackButtonInner">
              <FeedbackTopbarIcon />
              <span className="topbarFeedbackButtonLabel">Feedback</span>
              <span className="topbarFeedbackButtonReward">+50 RAC</span>
            </span>
          </button>
          <button
            className="avatarButton"
            onClick={openAccountModalFromTopbar}
            type="button"
            aria-label="Open account modal"
          >
            {topbarUser ? (
              <>
                <div className="userInfo">
                  <div className="name">{topbarUser.username}</div>
                  {INVITE_FRIENDS_ENABLED && topbarUser.inviter_username ? (
                    <div className="inviterTag">
                      via {topbarUser.inviter_username}
                    </div>
                  ) : null}
                </div>
                <div className="avatarWrap" style={{ position: "relative" }}>
                  <UserAvatar
                    avatar={topbarUser.avatar}
                    alt="avatar"
                    className="userAvatar"
                  />
                  {unreadSupportCount > 0 ? (
                    <span
                      title="Unread support messages"
                      aria-label={`${unreadSupportCount} unread support messages`}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        padding: "0 5px",
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        border: "2px solid #0b1022",
                      }}
                    >
                      {unreadSupportCount > 99 ? "99+" : unreadSupportCount}
                    </span>
                  ) : null}
                  {!(topbarUser.has_password ?? false) ? (
                    <span
                      className="avatarPasswordWarning"
                      title="Set a password in your profile"
                    >
                      !
                    </span>
                  ) : null}
                </div>
              </>
            ) : onboardingUiActive ? (
              <>
                <span className="guestTag">Welcome match</span>
                <img
                  className="userAvatar"
                  src="/empty-profile.svg"
                  alt="guest avatar"
                />
              </>
            ) : (
              <>
                <span className="guestTag">Log in</span>
                <img
                  className="userAvatar"
                  src="/empty-profile.svg"
                  alt="guest avatar"
                />
              </>
            )}
          </button>
          {topbarUser ? (
            <div className="topbarBalanceGroup">
              <button
                className="topbarBalanceChip"
                type="button"
                onClick={openAccountModalFromTopbar}
                aria-label="Open USDT balance"
              >
                {fmt(topbarUser.balance_usdt || 0)}
              </button>
              <button
                className="topbarBalanceChip topbarBalanceChipFree"
                type="button"
                onClick={openAccountModalFromTopbar}
                aria-label="Open free balance"
              >
                {formatRafc(topbarUser.balance_rac || 0)}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <ProfileNotificationStack
        items={notificationItems}
        isExiting={notificationExiting}
      />

      <main className="main">
        {!useMobileRealtimeRail ? (
          <aside className="leftRail" aria-label="Live player status">
            {realtimeFeedPanel}
          </aside>
        ) : (
          <aside
            className={`leftRail leftRail--mobileDrawer${mobileLeftDrawerOpen ? " isOpen" : ""}`}
            aria-label="Season ranking and daily missions"
            aria-hidden={!mobileLeftDrawerOpen ? true : undefined}
          >
            <button
              type="button"
              className="mobileLeftDrawerClose"
              aria-label="Close season ranking and daily missions"
              onClick={() => setMobileLeftDrawerOpen(false)}
            >
              ✕
            </button>
            {mobileLeftDrawerPanel}
          </aside>
        )}

        <section className="lobbyPrimary">
          <div className="lobbyTopChannels">
            <div className="lobbyTopChannelsVideo">
              <FeaturedLiveChannel isAuthenticated={showRegisteredTopbar} />
            </div>
            {!useMobileRealtimeRail ? (
              <div className="lobbyTopChannelsMissions">
                <DailyMissionsPanel
                  userId={getActivePlayerId(user?.id)}
                  isAuthenticated={showRegisteredTopbar}
                  onNotify={handleNotify}
                  variant="lobby"
                  onShowAllMissions={() => openAccountModalTab("missions")}
                />
              </div>
            ) : null}
          </div>

          <div className="matchPickerShell">
            <div className="matchPickerFrame" aria-hidden="true" />
            <div className="matchPicker" id="match-select-section">
              <div className="matchPickerHeader">
                <h2 className="matchPickerTitle">Choose Your Match</h2>
                <MatchGuideButton onClick={() => setMatchGuideOpen(true)} />
              </div>

              <div className="matchAllRoomsWrap">
                <button
                  type="button"
                  className="matchRoomsArrow matchRoomsArrowLeft"
                  aria-label="Scroll match rooms left"
                  disabled={!canScrollMatchRoomsLeft}
                  onClick={() => scrollMatchRooms("left")}
                >
                  ‹
                </button>

                <div
                  className="matchAllRoomsGrid"
                  ref={matchRoomsScrollerRef}
                  onScroll={syncMatchRoomScrollButtons}
                >
                  {matchRoomCards.map((room) => {
                    const isFree = room.ledger === "free";
                    return (
                      <button
                        key={`${room.ledger}-${room.price}`}
                        type="button"
                        className={`matchCard ${isFree ? "matchCardFree" : "matchCardPaid"}`}
                        disabled={!user || matchView.mode !== "none"}
                        onClick={() =>
                          void handleSelectMatchRoom(room.price, room.ledger)
                        }
                      >
                        <span
                          className={`matchCardIcon ${isFree ? "matchCardIconFree" : "matchCardIconPaid"}`}
                          aria-hidden
                        >
                          {isFree ? (
                            <span className="matchCardLedgerMark">R</span>
                          ) : (
                            <span className="matchCardLedgerMark">U</span>
                          )}
                        </span>
                        <span className="matchCardName">
                          {isFree ? (
                            <span className="matchCardMetaSecondary">
                              {formatRafc(room.price)}
                            </span>
                          ) : (
                            <span className="matchCardMetaPrimary">
                              {fmt(room.price)}
                            </span>
                          )}
                        </span>
                        <span className="matchCardPlaying">
                          <strong>{room.count}</strong> playing
                        </span>
                        <span className="matchCardJoin">Join Now</span>
                      </button>
                    );
                  })}
                  {matchRoomCards.length === 0 ? (
                    <div className="matchRoomPickerEmpty">
                      No match plans available.
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="matchRoomsArrow matchRoomsArrowRight"
                  aria-label="Scroll match rooms right"
                  disabled={!canScrollMatchRoomsRight}
                  onClick={() => scrollMatchRooms("right")}
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {useMobileRealtimeRail ? (
            <section
              className="mobileRealtimeWrap"
              aria-label="Mobile live updates"
            >
              {realtimeFeedPanel}
            </section>
          ) : null}

          <div className="liveHeader" id="live-matches-section">
            <h2>Live Matches</h2>
            <span className="liveBadge">Live</span>
          </div>

          <div
            className={`liveFeed${feedSlots.length === 0 ? " isEmpty" : ""}`}
          >
            {feedSlots.length === 0 ? (
              <div className="emptyState">
                <div className="emptyStateArt" aria-hidden>
                  <img
                    className="emptyStateVisual liveEmptyVisual"
                    src="/live_empty.png"
                    alt="No live matches"
                  />
                </div>
                <div className="emptyStateTitle">No active matches</div>
                <div className="emptyStateSubtitle">
                  Be the first to jump in and start a match!
                </div>
                <button
                  className="emptyStateAction"
                  type="button"
                  onClick={() => scrollToLobbySection("match-select-section")}
                >
                  Pick a match and start.
                </button>
              </div>
            ) : (
              feedSlots.map((slot) => (
                <div className="liveFeedCell" key={slot.key}>
                  {slot.live ? (
                    <LiveMatchCard
                      match={slot.live}
                      nowSec={liveNowSec}
                      isExiting={false}
                      avatar1Url={resolveAvatar(
                        slot.live.avatar1 || DEFAULT_AVATAR,
                      )}
                      avatar2Url={resolveAvatar(
                        slot.live.avatar2 || DEFAULT_AVATAR,
                      )}
                    />
                  ) : null}
                  {slot.exitFade ? (
                    <div className="liveFeedExitOverlay" aria-hidden>
                      <LiveMatchCard
                        match={slot.exitFade}
                        nowSec={liveNowSec}
                        isExiting
                        avatar1Url={resolveAvatar(
                          slot.exitFade.avatar1 || DEFAULT_AVATAR,
                        )}
                        avatar2Url={resolveAvatar(
                          slot.exitFade.avatar2 || DEFAULT_AVATAR,
                        )}
                      />
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {feedSlots.length > 0 ? (
            <div className="liveFeedShowMoreWrap">
              {/* {canShowMoreLiveMatches ? (
                <button
                  className="liveFeedShowMoreBtn"
                  type="button"
                  onClick={showMoreLiveMatches}
                >
                  Show {showMoreLiveMatchCount} more matches
                </button>
              ) : null} */}
              <span className="liveFeedShowMoreHint">
                Showing {displayedLiveMatchCount} of{" "}
                {trustMetrics.matchesInProgress} live matches
              </span>
            </div>
          ) : null}

          <footer className="lobbyFooterBar">
            <div className="lobbyFooterCopy">© 2026 All rights reserved.</div>
            <div className="lobbyFooterSocial" aria-label="Social links">
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord"
                onClick={handleDiscordInviteClick}
              >
                <img
                  src="/icons/discord.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="socialIcon"
                />
              </a>
              <a
                href="https://join.slack.com/t/rpsarena/shared_invite/zt-42wyd677r-HS6Wlg7IPqDH_UBuajZhbw"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Slack"
              >
                <img
                  src="/icons/slack.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="socialIcon"
                />
              </a>
              <a
                href="https://t.me/rps_arena_clubs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
              >
                <img
                  src="/icons/telegram.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="socialIcon"
                />
              </a>
            </div>
          </footer>
        </section>

        <aside
          className={`chatRail${useMobileRealtimeRail ? " chatRail--mobileDrawer" : ""}${mobileChatOpen ? " isOpen" : ""}`}
          aria-label="Live chat"
          aria-hidden={
            useMobileRealtimeRail && !mobileChatOpen ? true : undefined
          }
        >
          {useMobileRealtimeRail ? (
            <button
              type="button"
              className="mobileChatClose"
              aria-label="Close chat room"
              onClick={() => setMobileChatOpen(false)}
            >
              ✕
            </button>
          ) : null}
          <ChatRoom
            onlineCount={trustMetrics.playersOnline}
            activeUserId={getActivePlayerId(user?.id)}
            isAdmin={String(user?.type || "").toLowerCase() === "admin"}
            onNotify={handleNotify}
          />
        </aside>
      </main>

      {useMobileRealtimeRail && !mobileLeftDrawerOpen ? (
        <button
          type="button"
          className="mobileLeftDrawerToggle"
          aria-label="Open season ranking and daily missions"
          onClick={() => {
            setMobileChatOpen(false);
            setMobileLeftDrawerOpen(true);
          }}
        >
          <img src="/shield.png" alt="" width={24} height={24} loading="lazy" />
        </button>
      ) : null}

      {useMobileRealtimeRail && mobileLeftDrawerOpen ? (
        <button
          type="button"
          className="mobileLeftDrawerBackdrop"
          aria-label="Close season ranking and daily missions"
          onClick={() => setMobileLeftDrawerOpen(false)}
        />
      ) : null}

      {useMobileRealtimeRail && !mobileChatOpen ? (
        <button
          type="button"
          className="mobileChatToggle"
          aria-label="Open chat room"
          onClick={() => {
            setMobileLeftDrawerOpen(false);
            setMobileChatOpen(true);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 6.5h14a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H9.8L5 20.2V8.5a2 2 0 0 1 2-2Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 11h7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M8.5 14h4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}

      {useMobileRealtimeRail && mobileChatOpen ? (
        <button
          type="button"
          className="mobileChatBackdrop"
          aria-label="Close chat room"
          onClick={() => setMobileChatOpen(false)}
        />
      ) : null}

      {matchView.mode === "none" && (
        <nav className="mobileBottomBar" aria-label="Mobile quick actions">
          <button
            className="mobileBottomBtn"
            type="button"
            onClick={() => scrollToLobbySection("match-select-section")}
          >
            Matches
          </button>
          <button
            className="mobileBottomBtn"
            type="button"
            onClick={() => scrollToLobbySection("live-matches-section")}
          >
            Live
          </button>
          <button
            className="mobileBottomBtn mobileBottomBtnPrimary"
            type="button"
            onClick={openAccountModal}
          >
            Account
          </button>
        </nav>
      )}

      {/* Guest login */}
      {guestLoginOpen && (
        <div className="backdrop welcomeBackdrop">
          <div className="modal welcomeModal authModalShell visitorAuthModal">
            <div className="authModal">
              <div className="authModalTop">
                <div className="authModalBrand">
                  <img
                    className="authModalLogo"
                    src="/logo.png"
                    alt="RPS Arena logo"
                  />
                  <div className="authModalBrandText">
                    <div className="authModalBrandName">RPS ARENA</div>
                    <div className="authModalBrandTag">PLAY. WIN. EARN.</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="authModalClose"
                  aria-label="Close"
                  onClick={() => setGuestLoginOpen(false)}
                >
                  ×
                </button>
              </div>

              <h2 className="authModalHeading">
                {guestLoginMode === "name_password"
                  ? "Welcome Back!"
                  : "Join RPS Arena ✨"}
              </h2>
              <p className="authModalSubheading">
                {guestLoginMode === "name_password"
                  ? "Log in to continue your battles ⚡"
                  : "Enter your name to get started 🏆"}
              </p>

              {guestLoginError ? (
                <div className="accountAlert authModalAlert">
                  {guestLoginError}
                </div>
              ) : null}

              <div className="authModalBody">
                <div className="authFieldGroup">
                  <label htmlFor="guest-login-name">Name</label>
                  <div className="authInputWrap">
                    <span className="authInputIcon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z" />
                      </svg>
                    </span>
                    <input
                      id="guest-login-name"
                      className="input authInput"
                      value={welcomeName}
                      onChange={(event) => setWelcomeName(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          guestLoginMode === "name_only"
                        ) {
                          void submitGuestLogin();
                        }
                      }}
                      placeholder="Choose a unique username"
                      autoFocus
                    />
                  </div>
                  {guestNamePremiumWarning ? (
                    <p className="premiumNameWarning">
                      {guestNamePremiumWarning}
                    </p>
                  ) : null}
                </div>

                {guestLoginMode === "name_password" ? (
                  <div className="authFieldGroup">
                    <label htmlFor="guest-login-password">Password</label>
                    <div className="authInputWrap">
                      <span className="authInputIcon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z" />
                        </svg>
                      </span>
                      <input
                        id="guest-login-password"
                        className="input authInput authInputWithToggle"
                        type={showWelcomePassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={welcomePassword}
                        onChange={(event) =>
                          setWelcomePassword(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void submitGuestLogin();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="authPasswordToggle"
                        aria-label={
                          showWelcomePassword
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() => setShowWelcomePassword((prev) => !prev)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          {showWelcomePassword ? (
                            <path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-1.65 3.37-5.03 5.5-8.82 5.5S4.83 15.37 3.18 12C4.83 8.63 8.21 6.5 12 6.5m0-2C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5z" />
                          ) : (
                            <path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-.96 1.97-2.46 3.55-4.24 4.55l1.42 1.42C13.1 16.63 14.5 16 16 16v2.08c3.06-.49 5.7-2.1 7.51-4.58C22.27 7.61 17 4.5 12 4.5 10.6 4.5 9.26 4.75 8 5.2l1.45 1.45C9.84 6.58 10.89 6.5 12 6.5zm-6.8 2.1L3.71 4.51 2.29 5.93l2.55 2.55C3.08 9.72 2.05 10.82 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l2.03 2.03 1.41-1.41L5.61 8.6zM12 17.5c-3.79 0-7.17-2.13-8.82-5.5.74-1.52 1.83-2.82 3.15-3.77l1.53 1.53c-.88.35-1.68.9-2.34 1.58.96 1.16 2.4 1.91 4.03 1.91 1.02 0 1.97-.28 2.79-.76l1.5 1.5C14.26 17.25 13.16 17.5 12 17.5z" />
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : null}

                <button
                  className="authSubmitBtn"
                  type="button"
                  disabled={guestLoginLoading}
                  onClick={() => {
                    void submitGuestLogin();
                  }}
                >
                  <span>
                    {guestLoginLoading
                      ? "Please wait..."
                      : guestLoginMode === "name_password"
                        ? "Log in"
                        : "Next"}
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                  </svg>
                </button>
              </div>

              <div className="authModalSecure">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
                <span>Your data is 100% secure and protected</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <MatchGuideModal
        open={matchGuideOpen}
        onClose={() => setMatchGuideOpen(false)}
      />

      {insufficientBalanceModal && user ? (
        <div
          className="backdrop welcomeBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setInsufficientBalanceModal(null);
            }
          }}
        >
          <div
            className="modal welcomeModal authModalShell balanceAlertModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authModal">
              <div className="authModalTop">
                <div className="authModalBrand">
                  <img
                    className="authModalLogo"
                    src="/logo.png"
                    alt="RPS Arena logo"
                  />
                  <div className="authModalBrandText">
                    <div className="authModalBrandName">RPS ARENA</div>
                    <div className="authModalBrandTag">PLAY. WIN. EARN.</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="authModalClose"
                  aria-label="Close"
                  onClick={() => setInsufficientBalanceModal(null)}
                >
                  ×
                </button>
              </div>

              <h2 className="authModalHeading">Insufficient Balance</h2>
              <p className="authModalSubheading">
                {insufficientBalanceModal.ledger === "free"
                  ? "You do not have enough RAC to join this match."
                  : "You do not have enough USDT to join this match."}
              </p>

              <div className="balanceAlertSummary">
                <div className="balanceAlertRow">
                  <span className="balanceAlertLabel">Required</span>
                  <strong className="balanceAlertValue balanceAlertValueRequired">
                    {insufficientBalanceModal.ledger === "free"
                      ? formatRafc(insufficientBalanceModal.price)
                      : fmt(insufficientBalanceModal.price)}
                  </strong>
                </div>
                <div className="balanceAlertRow">
                  <span className="balanceAlertLabel">Your balance</span>
                  <strong className="balanceAlertValue">
                    {insufficientBalanceModal.ledger === "free"
                      ? formatRafc(user.balance_rac || 0)
                      : fmt(user.balance_usdt || 0)}
                  </strong>
                </div>
              </div>

              <button
                className="authSubmitBtn"
                type="button"
                onClick={() => {
                  if (insufficientBalanceModal.ledger === "rac") {
                    openDepositFromInsufficientBalance(
                      insufficientBalanceModal.price,
                    );
                    return;
                  }
                  setInsufficientBalanceModal(null);
                }}
              >
                <span>
                  {insufficientBalanceModal.ledger === "rac" ? "Charge" : "OK"}
                </span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Post-onboarding congratulations */}
      {onboardingCongratsOpen && (
        <div className="backdrop welcomeBackdrop onboardingCongratsBackdrop">
          <div className="modal welcomeModal welcomeRewardModal">
            <div className="welcomeRewardModalInner">
              <div className="welcomeRewardGlow" aria-hidden="true" />

              <div className="authModalTop welcomeRewardTop">
                <div className="authModalBrand">
                  <img
                    className="authModalLogo"
                    src="/logo.png"
                    alt="RPS Arena logo"
                  />
                  <div className="authModalBrandText">
                    <div className="authModalBrandName">RPS ARENA</div>
                    <div className="authModalBrandTag">PLAY. WIN. EARN.</div>
                  </div>
                </div>
              </div>

              <div className="welcomeRewardHero">
                <div className="welcomeRewardIconWrap" aria-hidden="true">
                  <svg className="welcomeRewardIcon" viewBox="0 0 24 24">
                    <path d="M19 5h-2V3H7v2H5a2 2 0 0 0-2 2v2a7 7 0 0 0 7 7 7 7 0 0 0 7-7V7a2 2 0 0 0-2-2zM5 19h14v2H5v-2zm7-14a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5z" />
                  </svg>
                </div>
                <h2 className="welcomeRewardTitle">Welcome to RPS Arena!</h2>
                <p className="welcomeRewardSubtitle">
                  Thanks for joining. Your first-register bonus is ready.
                </p>
              </div>

              <div className="welcomeRewardCard">
                <div className="welcomeRewardAmount">
                  <span className="welcomeRewardAmountValue">50</span>
                  <span className="welcomeRewardAmountLabel">Free Points</span>
                </div>
                <p className="welcomeRewardCardNote">
                  {formatRafc(50)} added for your first visit
                </p>
              </div>

              <button
                className="authSubmitBtn welcomeRewardCta"
                type="button"
                onClick={() => {
                  void startPlayingAfterOnboarding();
                }}
              >
                <span>Start Playing</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                </svg>
              </button>

              <div className="authModalSecure welcomeRewardSecure">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
                <span>Your bonus is secure in your account</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Onboarding modal (new registration) â”€â”€â”€â”€â”€â”€â”€ */}
      {onboardingOpen && (
        <div className="backdrop onboardingBackdrop">
          <div className="modal onboardingModal">
            {onboardingStep === "final" ? (
              <>
                <div className="onboardingHeader">
                  <div className="onboardingTitle">How to Play</div>
                </div>

                <video
                  key={"onboarding_video"}
                  className="onboardingVideo"
                  src={`https://zhfnufzsimulopgojpkb.supabase.co/storage/v1/object/public/Roshambo%20Videos/Play.mp4`}
                  autoPlay
                  muted
                  controls
                  playsInline
                  onEnded={() =>
                    setOnboardingStep((prev) =>
                      prev === "final" ? "guide" : prev,
                    )
                  }
                />
              </>
            ) : (
              <>
                <div className="onboardingGuideLogoWrap" aria-hidden="true">
                  <img
                    className="onboardingGuideLogo"
                    src="/logo_guide.png"
                    alt="Game logo"
                  />
                </div>
                <div className="onboardingHeader">
                  <div className="onboardingTitle">Quick Game Guide</div>
                  <div className="onboardingSubtitle">
                    You are ready to start
                  </div>
                </div>
                <ul className="onboardingTips">
                  <li>Pick a match in the center panel.</li>
                  <li>
                    Select rock, paper, or scissors before the timer ends.
                  </li>
                  <li>Moves are hidden until both players lock in.</li>
                  <li>Win 2 rounds first to take the match.</li>
                </ul>
                <div className="accountModalActions">
                  <button
                    className="btnPrimary"
                    type="button"
                    onClick={finishOnboarding}
                  >
                    Start Playing
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {guideVideoModalOpen && (
        <div
          className="backdrop guideVideoBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeGuideVideoModal();
            }
          }}
        >
          <div
            className="modal guideVideoModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="guideVideoModalTop">
              <div>
                <div className="guideVideoModalTitle">How to Play Video</div>
              </div>
              <button
                className="guideVideoCloseBtn"
                type="button"
                onClick={closeGuideVideoModal}
                aria-label="Close guide video"
              >
                ✕
              </button>
            </div>

            <video
              key={"play_video"}
              className="guideVideoPlayer"
              src={`https://zhfnufzsimulopgojpkb.supabase.co/storage/v1/object/public/Roshambo%20Videos/Play.mp4`}
              controls
              autoPlay
            />
          </div>
        </div>
      )}

      {INVITE_FRIENDS_ENABLED && inviteModalOpen && (
        <div
          className="backdrop guideVideoBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeInviteModal();
            }
          }}
        >
          <div
            className="modal guideVideoModal inviteReferModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="guideVideoModalTop">
              <div>
                <div className="guideVideoModalTitle">Invite Friends</div>
                <div className="guideVideoModalSubtitle">
                  Invite your friends and earn {referFeePercent}% from their win
                  matches.
                </div>
              </div>
              <button
                className="guideVideoCloseBtn"
                type="button"
                onClick={closeInviteModal}
                aria-label="Close invite modal"
              >
                ✕
              </button>
            </div>

            <div className="formGroup">
              <label>Invite Link</label>
              <input className="input" value={inviteLink} readOnly />
            </div>

            <div className="formGroup inviteReferVideoGroup">
              <label>Refer Video</label>
              <video
                key={"refer_video"}
                className="guideVideoPlayer inviteReferVideo"
                src={`https://zhfnufzsimulopgojpkb.supabase.co/storage/v1/object/public/Roshambo%20Videos/Refer.mp4`}
                controls
                autoPlay
              />
            </div>

            <div className="accountModalActions" style={{ marginTop: 0 }}>
              <button
                className="btnSecondary"
                type="button"
                onClick={closeInviteModal}
              >
                Close
              </button>
              <button
                className="btnPrimary"
                type="button"
                onClick={copyInviteLink}
              >
                {inviteCopied ? "Copied" : "Copy Invite Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Account modal (register/profile) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {newsModalOpen && activeNews ? (
        <NewsModal
          newsType={activeNews.type}
          items={activeNews.items}
          onClose={closeNewsModal}
        />
      ) : null}

      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
      />

      {accountModalOpen && (
        <div
          className="backdrop accountBackdrop"
          onClick={(event) => {
            if (Date.now() - accountModalOpenedAtRef.current < 180) {
              return;
            }
            if (event.target === event.currentTarget) {
              setAccountModalOpen(false);
            }
          }}
        >
          <div
            className={`modal accountModal authModalShell${user ? " accountModalProfile" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {!user ? (
              <div className="authModal">
                <div className="authModalTop">
                  <div className="authModalBrand">
                    <img
                      className="authModalLogo"
                      src="/logo.png"
                      alt="RPS Arena logo"
                    />
                    <div className="authModalBrandText">
                      <div className="authModalBrandName">RPS ARENA</div>
                      <div className="authModalBrandTag">PLAY. WIN. EARN.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="authModalClose"
                    aria-label="Close"
                    onClick={() => setAccountModalOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <h2 className="authModalHeading">
                  {accountMode === "login"
                    ? "Welcome Back!"
                    : "Create Your Account"}
                </h2>
                <p className="authModalSubheading">
                  {accountMode === "login"
                    ? "Log in to continue your battles ⚡"
                    : "Register here without leaving the lobby ⚡"}
                </p>

                <div
                  className="authModalTabs"
                  role="tablist"
                  aria-label="Auth mode"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accountMode === "login"}
                    className={`authModalTab${accountMode === "login" ? " active" : ""}`}
                    onClick={() => {
                      setAccountError("");
                      setAccountMode("login");
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z" />
                    </svg>
                    Login
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accountMode === "register"}
                    className={`authModalTab${accountMode === "register" ? " active" : ""}`}
                    onClick={() => {
                      setAccountError("");
                      setAccountMode("register");
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V8H4v2H2v2h2v2h2v-2h2v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                    Register
                  </button>
                </div>

                {accountError ? (
                  <div className="accountAlert authModalAlert">
                    {accountError}
                  </div>
                ) : null}

                {accountMode === "login" ? (
                  <div className="authModalBody">
                    <div className="authFieldGroup">
                      <label htmlFor="auth-login-identifier">
                        Email or Username
                      </label>
                      <div className="authInputWrap">
                        <span className="authInputIcon" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" />
                          </svg>
                        </span>
                        <input
                          id="auth-login-identifier"
                          className="input authInput"
                          placeholder="Enter your email or username"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void login();
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="authFieldGroup">
                      <div className="authFieldLabelRow">
                        <label htmlFor="auth-login-password">Password</label>
                        <span className="authForgotLink">Forgot Password?</span>
                      </div>
                      <div className="authInputWrap">
                        <span className="authInputIcon" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z" />
                          </svg>
                        </span>
                        <input
                          id="auth-login-password"
                          className="input authInput authInputWithToggle"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void login();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="authPasswordToggle"
                          aria-label={
                            showLoginPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          onClick={() => setShowLoginPassword((prev) => !prev)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            {showLoginPassword ? (
                              <path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-1.65 3.37-5.03 5.5-8.82 5.5S4.83 15.37 3.18 12C4.83 8.63 8.21 6.5 12 6.5m0-2C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5z" />
                            ) : (
                              <path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-.96 1.97-2.46 3.55-4.24 4.55l1.42 1.42C13.1 16.63 14.5 16 16 16v2.08c3.06-.49 5.7-2.1 7.51-4.58C22.27 7.61 17 4.5 12 4.5 10.6 4.5 9.26 4.75 8 5.2l1.45 1.45C9.84 6.58 10.89 6.5 12 6.5zm-6.8 2.1L3.71 4.51 2.29 5.93l2.55 2.55C3.08 9.72 2.05 10.82 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l2.03 2.03 1.41-1.41L5.61 8.6zM12 17.5c-3.79 0-7.17-2.13-8.82-5.5.74-1.52 1.83-2.82 3.15-3.77l1.53 1.53c-.88.35-1.68.9-2.34 1.58.96 1.16 2.4 1.91 4.03 1.91 1.02 0 1.97-.28 2.79-.76l1.5 1.5C14.26 17.25 13.16 17.5 12 17.5z" />
                            )}
                          </svg>
                        </button>
                      </div>
                    </div>

                    <button
                      className="authSubmitBtn"
                      type="button"
                      onClick={login}
                    >
                      <span>Login</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                      </svg>
                    </button>

                    <div className="authDivider">
                      <span>OR</span>
                    </div>

                    <div className="authSocialRow">
                      <button
                        type="button"
                        className="authSocialBtn authSocialBtnGoogle"
                        disabled
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M22 12c0-.68-.06-1.35-.17-2H12v3.77h5.92A5.98 5.98 0 0 1 10 17.92v3.09A10 10 0 0 0 22 12z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23a10 10 0 0 0 6.93-2.69l-3.09-3.09A5.98 5.98 0 0 1 10 17.92v-3.09H2.17A10 10 0 0 0 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09A5.98 5.98 0 0 1 5.47 12c0-.69.12-1.36.37-2.09V6.82H2.17A10 10 0 0 0 2 12c0 1.61.39 3.13 1.17 4.59l2.67-2.5z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A9.96 9.96 0 0 0 12 2 10 10 0 0 0 2.17 9.82H5.5v3.09A5.98 5.98 0 0 1 12 4.75z"
                            fill="#EA4335"
                          />
                        </svg>
                        Continue with Google
                      </button>
                      <button
                        type="button"
                        className="authSocialBtn authSocialBtnDiscord"
                        disabled
                      >
                        <img
                          src="/icons/discord.svg"
                          alt=""
                          aria-hidden="true"
                        />
                        Continue with Discord
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="authModalBody authModalBodyRegister">
                    <div className="registerSplit">
                      <div className="registerLeftFields">
                        <div className="authFieldGroup">
                          <label htmlFor="auth-register-mail">
                            Email <span className="requiredMark">*</span>
                          </label>
                          <div className="authInputWrap">
                            <span className="authInputIcon" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" />
                              </svg>
                            </span>
                            <input
                              id="auth-register-mail"
                              className="input authInput"
                              type="email"
                              placeholder="you@example.com"
                              value={form.mail}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, mail: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                        <div className="authFieldGroup">
                          <label htmlFor="auth-register-username">
                            Username <span className="requiredMark">*</span>
                          </label>
                          <div className="authInputWrap">
                            <span className="authInputIcon" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z" />
                              </svg>
                            </span>
                            <input
                              id="auth-register-username"
                              className="input authInput"
                              placeholder="PlayerOne"
                              value={form.username}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  username: e.target.value,
                                }))
                              }
                            />
                          </div>
                          {registerNamePremiumWarning ? (
                            <p className="premiumNameWarning">
                              {registerNamePremiumWarning}
                            </p>
                          ) : null}
                        </div>
                        <div className="authFieldGroup">
                          <label htmlFor="auth-register-password">
                            Password <span className="requiredMark">*</span>
                          </label>
                          <div className="authInputWrap">
                            <span className="authInputIcon" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z" />
                              </svg>
                            </span>
                            <input
                              id="auth-register-password"
                              className="input authInput"
                              type="password"
                              placeholder="Create password"
                              value={registerPassword}
                              onChange={(e) =>
                                setRegisterPassword(e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div className="authFieldGroup">
                          <label htmlFor="auth-register-confirm-password">
                            Confirm Password{" "}
                            <span className="requiredMark">*</span>
                          </label>
                          <div className="authInputWrap">
                            <span className="authInputIcon" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z" />
                              </svg>
                            </span>
                            <input
                              id="auth-register-confirm-password"
                              className="input authInput"
                              type="password"
                              placeholder="Confirm password"
                              value={registerConfirmPassword}
                              onChange={(e) =>
                                setRegisterConfirmPassword(e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div className="authFieldGroup">
                          <label htmlFor="auth-register-birthday">
                            Birthday
                          </label>
                          <div className="authInputWrap">
                            <input
                              id="auth-register-birthday"
                              className="input authInput authInputNoIcon"
                              type="date"
                              value={form.birthday}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  birthday: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        {INVITE_FRIENDS_ENABLED ? (
                          <div className="authFieldGroup">
                            <label htmlFor="auth-register-refer">
                              Referral (Optional)
                            </label>
                            <div className="authInputWrap">
                              <input
                                id="auth-register-refer"
                                className="input authInput authInputNoIcon"
                                placeholder="Referral code or username"
                                value={form.refer}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    refer: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="registerAvatarPane">
                        <label className="registerAvatarLabel">Avatar</label>
                        <div className="avatarPicker" role="radiogroup">
                          {AVATAR_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`avatarOption${resolveAvatar(form.avatar) === option.url ? " active" : ""}`}
                              onClick={() =>
                                setForm((p) => ({ ...p, avatar: option.url }))
                              }
                              aria-pressed={
                                resolveAvatar(form.avatar) === option.url
                              }
                            >
                              <img src={option.url} alt={option.label} />
                              <span>{option.label}</span>
                            </button>
                          ))}
                        </div>
                        <input
                          className="input authInput authInputNoIcon"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          style={{ marginTop: 10 }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            void setAvatarFromFile(file);
                            e.currentTarget.value = "";
                          }}
                        />
                        {isCustomAvatarDataUrlValue(form.avatar) && (
                          <div className="uploadAvatarPreview">
                            <img
                              className="profileAvatarPreview"
                              src={form.avatar}
                              alt="Uploaded avatar preview"
                            />
                            <span>Uploaded avatar selected</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className="authSubmitBtn"
                      type="button"
                      onClick={() => {
                        void register();
                      }}
                    >
                      <span>Create Account</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="authModalSecure">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                  </svg>
                  <span>Your data is 100% secure and protected</span>
                </div>
              </div>
            ) : (
              <div className="profileModal">
                {accountError ? (
                  <div className="accountAlert profileModalAlert">
                    {accountError}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="profileModalClose"
                  aria-label="Close account modal"
                  onClick={() => setAccountModalOpen(false)}
                >
                  ×
                </button>

                <div className="profileModalHeader">
                  <div className="profileModalUserBlock">
                    <div
                      className={`profileModalAvatarWrap${
                        isPremadeRpsAvatar(user.avatar)
                          ? " profileModalAvatarWrapPremade rpsAvatarFrame"
                          : ""
                      }`}
                    >
                      <img
                        className={
                          isPremadeRpsAvatar(user.avatar)
                            ? "rpsAvatarFrameImage"
                            : "profileModalAvatar"
                        }
                        src={resolveAvatar(user.avatar)}
                        alt="avatar"
                      />
                    </div>
                    <div className="profileModalUserMeta">
                      <div className="profileModalUserName">
                        <span>{user.username}</span>
                        <span
                          className="profileModalVerified"
                          aria-hidden="true"
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z" />
                          </svg>
                        </span>
                      </div>
                      {!user.has_password ? (
                        <div className="profileModalSecurityBanner">
                          <span
                            className="profileModalSecurityIcon"
                            aria-hidden="true"
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                            </svg>
                          </span>
                          <span>
                            Set the password to protect account information.
                          </span>
                          <span
                            className="profileModalSecurityChevron"
                            aria-hidden="true"
                          >
                            ›
                          </span>
                        </div>
                      ) : null}
                      {user.mail ? (
                        <div className="profileModalEmail">{user.mail}</div>
                      ) : null}
                      {INVITE_FRIENDS_ENABLED && user.inviter_username ? (
                        <div className="accountInviterText">
                          Invited by {user.inviter_username}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="profileModalBalances">
                    <div className="profileBalanceCard profileBalanceCardUsdt">
                      <span className="profileBalanceIcon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
                        </svg>
                      </span>
                      <div className="profileBalanceCopy">
                        <span className="profileBalanceLabel">
                          USDT Balance
                        </span>
                        <span className="profileBalanceValue profileBalanceValueUsdt">
                          {fmt(user.balance_usdt || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="profileBalanceCard profileBalanceCardFree">
                      <span className="profileBalanceIcon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 12 7.4l3.38 4.6L17 10.83 14.92 8H20v6z" />
                        </svg>
                      </span>
                      <div className="profileBalanceCopy">
                        <span className="profileBalanceLabel">
                          Free Balance
                        </span>
                        <span className="profileBalanceValue profileBalanceValueFree">
                          {formatRafc(user.balance_rac || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="profileTabRow"
                  role="tablist"
                  aria-label="Account sections"
                >
                  <button
                    className={`profileTab${walletTab === "deposit" ? " active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={walletTab === "deposit"}
                    onClick={() => setWalletTab("deposit")}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 4v9" />
                      <path d="M8.5 9.5 12 13l3.5-3.5" />
                      <path d="M5 19h14" />
                    </svg>
                    Deposit
                  </button>
                  <button
                    className={`profileTab${walletTab === "withdraw" ? " active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={walletTab === "withdraw"}
                    onClick={() => setWalletTab("withdraw")}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 20V11" />
                      <path d="M8.5 14.5 12 11l3.5 3.5" />
                      <path d="M5 19h14" />
                    </svg>
                    Withdraw
                  </button>
                  <button
                    className={`profileTab${walletTab === "history" ? " active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={walletTab === "history"}
                    onClick={() =>
                      openAccountModalTab("history", { openModal: false })
                    }
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 8v4.5" />
                      <path d="M12 12h3.5" />
                    </svg>
                    History
                  </button>
                  <button
                    className={`profileTab${walletTab === "missions" ? " active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={walletTab === "missions"}
                    onClick={() =>
                      openAccountModalTab("missions", { openModal: false })
                    }
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3 4.5 6v5.4c0 4.6 3.2 8.8 7.5 9.9 4.3-1.1 7.5-5.3 7.5-9.9V6L12 3Z" />
                      <path d="M8.5 12.3 10.8 14.6 15.7 9.7" />
                    </svg>
                    Missions
                  </button>
                  <button
                    className={`profileTab${walletTab === "store" ? " active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={walletTab === "store"}
                    onClick={() =>
                      openAccountModalTab("store", { openModal: false })
                    }
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 7h10l1 4H6l1-4z" />
                      <path d="M6 11h12v9H6v-9z" />
                      <path d="M9 20v-6h6v6" />
                    </svg>
                    Store
                  </button>
                  <button
                    className={`profileTab${walletTab === "profile" ? " active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={walletTab === "profile"}
                    onClick={() => setWalletTab("profile")}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="9" r="3.5" />
                      <path d="M6 19c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" />
                    </svg>
                    Profile
                    {!(user.has_password ?? false) ? (
                      <span
                        className="profileTabPasswordWarning"
                        title="Set a password in your profile"
                        aria-label="Password not set"
                      >
                        !
                      </span>
                    ) : null}
                  </button>
                  <button
                    className={`profileTab${walletTab === "chat" ? " active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={walletTab === "chat"}
                    onClick={() =>
                      openAccountModalTab("chat", { openModal: false })
                    }
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 6.5h14a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H9.8L5 20.2V8.5a2 2 0 0 1 2-2Z" />
                      <path d="M8.5 11h7" />
                      <path d="M8.5 14h4.5" />
                    </svg>
                    Chat to Admin
                    {unreadSupportCount > 0 ? (
                      <span
                        style={{
                          marginLeft: 8,
                          minWidth: 18,
                          height: 18,
                          borderRadius: 999,
                          padding: "0 5px",
                          background: "#ef4444",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }}
                        aria-label={`${unreadSupportCount} unread support messages`}
                      >
                        {unreadSupportCount > 99 ? "99+" : unreadSupportCount}
                      </span>
                    ) : null}
                  </button>
                </div>

                <div
                  className={`accountTabContent profileTabContent${
                    walletTab === "profile"
                      ? " profileTabContentForm"
                      : walletTab === "history"
                        ? " profileTabContentHistory"
                        : walletTab === "store" || walletTab === "missions"
                          ? " profileTabContentStore"
                          : " profileTabContentWallet"
                  }`}
                >
                  {walletTab === "deposit" ? (
                    <div className="profileWalletPanel profileWalletPanelDeposit">
                      <ProfileWalletArt variant="deposit" />
                      <div className="profileWalletForm">
                        {depositError ? (
                          <div
                            className="depositErrorNotice"
                            role="alert"
                            aria-live="assertive"
                          >
                            <span
                              className="depositErrorIcon"
                              aria-hidden="true"
                            >
                              !
                            </span>
                            <div className="depositErrorCopy">
                              <strong>Deposit failed</strong>
                              <p>{depositError}</p>
                            </div>
                            <button
                              className="depositErrorDismiss"
                              type="button"
                              onClick={clearDepositError}
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : null}

                        {depositCompletedNotice ? (
                          <div
                            className="depositCompletedNotice"
                            role="status"
                            aria-live="polite"
                          >
                            <span
                              className="depositCompletedIcon"
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                            <div className="depositCompletedCopy">
                              <strong>Deposit completed</strong>
                              <p>
                                {fmt(depositCompletedNotice.amount)} has been
                                credited to your balance.
                              </p>
                            </div>
                            <button
                              className="depositCompletedDismiss"
                              type="button"
                              onClick={() => setDepositCompletedNotice(null)}
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : null}

                        <div className="profileAmountHeader">
                          <ProfileFieldLabel icon="amount" as="span">
                            Deposit Amount (USDT)
                          </ProfileFieldLabel>
                          <div className="profileAmountInputWrap">
                            <span
                              className="profileAmountInputIcon"
                              aria-hidden="true"
                            >
                              <img src="/rac-amount-icon.png" alt="" />
                            </span>
                            <input
                              className="input profileAmountInput"
                              type="number"
                              min="1"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                              placeholder="Amount"
                              disabled={depositBusy}
                            />
                          </div>
                        </div>

                        <button
                          className="profilePrimaryBtn profilePrimaryBtnWide depositSubmitBtn"
                          type="button"
                          onClick={deposit}
                          disabled={depositBusy}
                        >
                          {depositLoading ? (
                            <>
                              <span
                                className="inlineSpinner"
                                aria-hidden="true"
                              />
                              Loading...
                            </>
                          ) : (
                            <>
                              <span>Get Deposit Address</span>
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
                              </svg>
                            </>
                          )}
                        </button>

                        {depositLoading ? (
                          <div className="depositLoadingPanel" role="status">
                            <span
                              className="withdrawLoadingSpinner"
                              aria-hidden="true"
                            />
                            <span>Preparing deposit address...</span>
                          </div>
                        ) : null}

                        <div className="profileFieldGroup">
                          <ProfileFieldLabel icon="address">
                            Deposit Address
                          </ProfileFieldLabel>
                          <div className="profileInputWrap profileInputWithIcon">
                            <input
                              className="input profileInput profileInputWithTrail"
                              value={depositAddress}
                              readOnly
                              placeholder="Click Get Deposit Address"
                            />
                            <span
                              className="profileInputIconTrail"
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
                              </svg>
                            </span>
                          </div>
                          {depositNetwork ? (
                            <small className="profileFieldHint">
                              Network: {depositNetwork} · Token: ERC20 USDT
                            </small>
                          ) : null}
                        </div>

                        <div className="profileFieldGroup">
                          <ProfileFieldLabel icon="hash">
                            Hash Link
                          </ProfileFieldLabel>
                          <div className="profileInputWrap profileInputWithIcon">
                            <span
                              className="profileInputIconLead"
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M3.9 12a5 5 0 0 1 5-5h4V5H8.9a7 7 0 1 0 0 14h4v-2H8.9a5 5 0 0 1-5-5zm6.1 0h4V7h-4v5zm2.1-7H17a5 5 0 0 1 0 10h-4v2h4a7 7 0 1 0 0-14h-4.9v2z" />
                              </svg>
                            </span>
                            <input
                              className="input profileInput profileInputWithLead profileInputWithTrail"
                              value={depositTxHash}
                              onChange={(e) =>
                                setDepositTxHash(
                                  sanitizeTxHashInput(e.target.value),
                                )
                              }
                              placeholder="Enter transaction hash link"
                              disabled={depositBusy}
                            />
                            <span
                              className="profileInputIconTrail"
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
                              </svg>
                            </span>
                          </div>
                        </div>

                        {depositConfirmLoading ? (
                          <div className="depositLoadingPanel" role="status">
                            <span
                              className="withdrawLoadingSpinner"
                              aria-hidden="true"
                            />
                            <span>Confirming deposit on-chain...</span>
                          </div>
                        ) : null}

                        <button
                          className="profilePrimaryBtn profilePrimaryBtnWide depositSubmitBtn profilePrimaryBtnCentered"
                          type="button"
                          onClick={confirmDeposit}
                          disabled={depositBusy}
                        >
                          {depositConfirmLoading ? (
                            <>
                              <span
                                className="inlineSpinner"
                                aria-hidden="true"
                              />
                              Confirming...
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                              </svg>
                              <span>Confirm Deposit</span>
                            </>
                          )}
                        </button>

                        {depositConfirmResult ? (
                          <DepositApiResultPanel
                            title="Deposit confirmation result"
                            entries={buildDepositConfirmResultEntries(
                              depositConfirmResult,
                            )}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : walletTab === "withdraw" ? (
                    <div className="profileWalletPanel profileWalletPanelWithdraw">
                      <ProfileWalletArt variant="withdraw" />
                      <div className="profileWalletForm">
                        <div className="profileAmountHeader">
                          <ProfileFieldLabel icon="amount" as="span">
                            Withdraw Amount (USDT)
                          </ProfileFieldLabel>
                          <div className="profileAmountInputWrap">
                            <span
                              className="profileAmountInputIcon"
                              aria-hidden="true"
                            >
                              <img src="/rac-amount-icon.png" alt="" />
                            </span>
                            <input
                              className="input profileAmountInput"
                              type="number"
                              min="1"
                              value={withdrawAmount}
                              onChange={(e) =>
                                setWithdrawAmount(e.target.value)
                              }
                              placeholder="Amount"
                              disabled={withdrawLoading}
                            />
                          </div>
                        </div>
                        <p className="withdrawNetFeeNote">
                          {getWithdrawNetFeeMessage(
                            snapshot?.netWithdrawFee,
                            Number(withdrawAmount),
                          )}
                        </p>

                        <div className="profileFieldGroup">
                          <ProfileFieldLabel icon="wallet">
                            Self Wallet Address
                          </ProfileFieldLabel>
                          <div className="profileInputWrap profileInputWithIcon">
                            <span
                              className="profileInputIconLead"
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                              </svg>
                            </span>
                            <input
                              className="input profileInput profileInputWithLead profileInputWithTrail"
                              value={withdrawAddress}
                              onChange={(e) =>
                                setWithdrawAddress(e.target.value)
                              }
                              placeholder="0x... Enter your wallet address"
                              disabled={withdrawLoading}
                            />
                            <span
                              className="profileInputIconTrail"
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M4 4h6v2H6.41l9.3 9.29-1.41 1.42L5 7.41V10H3V4zm14 16h-6v-2h3.59l-9.3-9.29 1.41-1.42L19 16.59V14h2v6z" />
                              </svg>
                            </span>
                          </div>
                        </div>

                        <button
                          className="profilePrimaryBtn profilePrimaryBtnWide withdrawSubmitBtn"
                          type="button"
                          onClick={withdraw}
                          disabled={withdrawLoading}
                        >
                          {withdrawLoading ? (
                            <>
                              <span
                                className="inlineSpinner"
                                aria-hidden="true"
                              />
                              Withdrawing...
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                              </svg>
                              <span>Run Withdraw</span>
                            </>
                          )}
                        </button>

                        {withdrawLoading ? (
                          <div className="withdrawLoadingPanel" role="status">
                            <span
                              className="withdrawLoadingSpinner"
                              aria-hidden="true"
                            />
                            <span>Processing withdrawal on-chain...</span>
                          </div>
                        ) : null}

                        {withdrawTxHash ? (
                          <div className="profileFieldGroup">
                            <ProfileFieldLabel icon="hash">
                              Withdraw Tx Hash
                            </ProfileFieldLabel>
                            {withdrawTxUrl ? (
                              <a
                                className="profileTxLink"
                                href={withdrawTxUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {withdrawTxHash}
                              </a>
                            ) : (
                              <input
                                className="input profileInput"
                                value={withdrawTxHash}
                                readOnly
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : walletTab === "history" ? (
                    <div className="profileWalletPanel profileWalletPanelHistory">
                      <ProfileWalletArt variant="history" />
                      <div className="profileWalletForm">
                        <div
                          className="profileHistoryTabRow"
                          role="tablist"
                          aria-label="History type"
                        >
                          <button
                            className={`profileHistoryTab${historySubTab === "balance" ? " active" : ""}`}
                            type="button"
                            role="tab"
                            aria-selected={historySubTab === "balance"}
                            onClick={() => setHistorySubTab("balance")}
                          >
                            Balance History
                          </button>
                          <button
                            className={`profileHistoryTab${historySubTab === "match" ? " active" : ""}`}
                            type="button"
                            role="tab"
                            aria-selected={historySubTab === "match"}
                            onClick={() => {
                              setHistorySubTab("match");
                              if (user?.id) {
                                loadMatchHistory(user.id).catch(() => {});
                              }
                            }}
                          >
                            Match History
                          </button>
                        </div>
                        {historySubTab === "balance" ? (
                          <BalanceHistoryPanel
                            history={balanceHistory}
                            loading={balanceHistoryLoading}
                            hideHeading
                          />
                        ) : (
                          <MatchHistoryPanel
                            history={matchHistory}
                            loading={matchHistoryLoading}
                            hideHeading
                          />
                        )}
                      </div>
                    </div>
                  ) : walletTab === "store" ? (
                    <div className="profileWalletPanel profileWalletPanelStore">
                      <div className="profileWalletForm profileWalletFormStore">
                        <ProfileStorePanel
                          currentAvatarUrl={resolveAvatar(
                            form.avatar || user.avatar,
                          )}
                          currentUsername={profileUsername || user.username}
                          balanceUsdt={user.balance_usdt || 0}
                          balanceRac={user.balance_rac || 0}
                          avatars={shopAvatars}
                          avatarsLoading={shopAvatarsLoading}
                          purchasing={shopPurchasing}
                          onPurchaseAvatar={handlePurchaseShopAvatar}
                          onSelectAvatar={handleSelectShopAvatar}
                        />
                      </div>
                    </div>
                  ) : walletTab === "missions" ? (
                    <div className="profileWalletPanel profileWalletPanelStore profileWalletPanelMissions">
                      <div className="profileWalletForm profileWalletFormStore profileWalletFormMissions">
                        <DailyMissionsPanel
                          userId={getActivePlayerId(user?.id)}
                          isAuthenticated={showRegisteredTopbar}
                          onNotify={handleNotify}
                          variant="profile"
                          title="Missions"
                        />
                      </div>
                    </div>
                  ) : walletTab === "chat" ? (
                    <SupportChatPanel
                      activeUserId={getActivePlayerId(user?.id)}
                      onConversationSeen={() => {
                        void loadSupportUnreadCount().then((nextCount) => {
                          previousSupportUnreadRef.current = nextCount;
                          supportUnreadReadyRef.current = true;
                        });
                      }}
                    />
                  ) : (
                    <div className="profileWalletPanel profileWalletPanelProfile">
                      <ProfileSidebar
                        username={profileUsername || user.username}
                        avatarUrl={resolveAvatar(form.avatar || user.avatar)}
                        avatarSource={form.avatar || user.avatar}
                        memberSince={user.created_at || user.createdAt}
                        onEditAvatar={() => setProfileAvatarWindowOpen(true)}
                      />
                      <div className="profileWalletFormColumn">
                        <div className="profileWalletForm">
                          <div className="profileFormCard">
                            <div className="profileFormPanel">
                              <div className="profileFieldGroup">
                                <ProfileFieldLabel
                                  icon="user"
                                  htmlFor="profile-username"
                                >
                                  Username
                                </ProfileFieldLabel>
                                <div className="profileInputWrap profileInputWithIcon">
                                  <input
                                    id="profile-username"
                                    className="input profileInput profileInputWithTrail"
                                    value={profileUsername}
                                    onChange={(e) =>
                                      setProfileUsername(e.target.value)
                                    }
                                    placeholder="PlayerOne"
                                    autoComplete="off"
                                    name="profile-username"
                                  />
                                  {profileUsername.trim() ? (
                                    <span
                                      className="profileInputIconTrail profileInputIconSuccess"
                                      aria-hidden="true"
                                    >
                                      <svg viewBox="0 0 24 24">
                                        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                      </svg>
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="profileFieldGroup">
                                <ProfileFieldLabel
                                  icon="lock"
                                  htmlFor="profile-new-password"
                                >
                                  New Password (optional)
                                </ProfileFieldLabel>
                                <div className="profileInputWrap">
                                  <input
                                    id="profile-new-password"
                                    className="input profileInput profileInputWithToggle"
                                    type={
                                      showProfilePassword ? "text" : "password"
                                    }
                                    value={profilePassword}
                                    onChange={(e) =>
                                      setProfilePassword(e.target.value)
                                    }
                                    placeholder="Leave blank to keep current password"
                                    autoComplete="new-password"
                                    name="profile-new-password"
                                    readOnly
                                    onFocus={(event) => {
                                      event.currentTarget.removeAttribute(
                                        "readOnly",
                                      );
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="profilePasswordToggle"
                                    aria-label={
                                      showProfilePassword
                                        ? "Hide password"
                                        : "Show password"
                                    }
                                    onClick={() =>
                                      setShowProfilePassword((prev) => !prev)
                                    }
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      {showProfilePassword ? (
                                        <path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-1.65 3.37-5.03 5.5-8.82 5.5S4.83 15.37 3.18 12C4.83 8.63 8.21 6.5 12 6.5m0-2C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5z" />
                                      ) : (
                                        <path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-.96 1.97-2.46 3.55-4.24 4.55l1.42 1.42C13.1 16.63 14.5 16 16 16v2.08c3.06-.49 5.7-2.1 7.51-4.58C22.27 7.61 17 4.5 12 4.5 10.6 4.5 9.26 4.75 8 5.2l1.45 1.45C9.84 6.58 10.89 6.5 12 6.5zm-6.8 2.1L3.71 4.51 2.29 5.93l2.55 2.55C3.08 9.72 2.05 10.82 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l2.03 2.03 1.41-1.41L5.61 8.6zM12 17.5c-3.79 0-7.17-2.13-8.82-5.5.74-1.52 1.83-2.82 3.15-3.77l1.53 1.53c-.88.35-1.68.9-2.34 1.58.96 1.16 2.4 1.91 4.03 1.91 1.02 0 1.97-.28 2.79-.76l1.5 1.5C14.26 17.25 13.16 17.5 12 17.5z" />
                                      )}
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              <div className="profileFieldGroup">
                                <ProfileFieldLabel
                                  icon="lock"
                                  htmlFor="profile-confirm-password"
                                >
                                  Confirm New Password
                                </ProfileFieldLabel>
                                <div className="profileInputWrap">
                                  <input
                                    id="profile-confirm-password"
                                    className="input profileInput profileInputWithToggle"
                                    type={
                                      showProfileConfirmPassword
                                        ? "text"
                                        : "password"
                                    }
                                    value={profileConfirmPassword}
                                    onChange={(e) =>
                                      setProfileConfirmPassword(e.target.value)
                                    }
                                    placeholder="Repeat new password"
                                    autoComplete="new-password"
                                    name="profile-confirm-password"
                                    readOnly
                                    onFocus={(event) => {
                                      event.currentTarget.removeAttribute(
                                        "readOnly",
                                      );
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="profilePasswordToggle"
                                    aria-label={
                                      showProfileConfirmPassword
                                        ? "Hide password"
                                        : "Show password"
                                    }
                                    onClick={() =>
                                      setShowProfileConfirmPassword(
                                        (prev) => !prev,
                                      )
                                    }
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      {showProfileConfirmPassword ? (
                                        <path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-1.65 3.37-5.03 5.5-8.82 5.5S4.83 15.37 3.18 12C4.83 8.63 8.21 6.5 12 6.5m0-2C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5z" />
                                      ) : (
                                        <path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-.96 1.97-2.46 3.55-4.24 4.55l1.42 1.42C13.1 16.63 14.5 16 16 16v2.08c3.06-.49 5.7-2.1 7.51-4.58C22.27 7.61 17 4.5 12 4.5 10.6 4.5 9.26 4.75 8 5.2l1.45 1.45C9.84 6.58 10.89 6.5 12 6.5zm-6.8 2.1L3.71 4.51 2.29 5.93l2.55 2.55C3.08 9.72 2.05 10.82 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l2.03 2.03 1.41-1.41L5.61 8.6zM12 17.5c-3.79 0-7.17-2.13-8.82-5.5.74-1.52 1.83-2.82 3.15-3.77l1.53 1.53c-.88.35-1.68.9-2.34 1.58.96 1.16 2.4 1.91 4.03 1.91 1.02 0 1.97-.28 2.79-.76l1.5 1.5C14.26 17.25 13.16 17.5 12 17.5z" />
                                      )}
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              <div className="profileFieldGroup profileAvatarSection">
                                <div className="profileAvatarSectionHeader">
                                  <ProfileFieldLabel icon="avatar" as="span">
                                    Avatar
                                  </ProfileFieldLabel>
                                  <button
                                    className="profileAvatarToggleBtn"
                                    type="button"
                                    onClick={() =>
                                      setProfileAvatarWindowOpen(
                                        (prev) => !prev,
                                      )
                                    }
                                  >
                                    {profileAvatarWindowOpen ? (
                                      <>
                                        <span>Close Avatar Window</span>
                                        <span aria-hidden="true">×</span>
                                      </>
                                    ) : (
                                      "Change Avatar"
                                    )}
                                  </button>
                                </div>
                                <div className="profileAvatarRow">
                                  <img
                                    className="profileAvatarPreview"
                                    src={resolveAvatar(
                                      form.avatar || user.avatar,
                                    )}
                                    alt="Current avatar"
                                  />
                                </div>

                                {profileAvatarWindowOpen ? (
                                  <ProfileAvatarPicker
                                    currentAvatar={form.avatar || user.avatar}
                                    ownedAvatars={ownedShopAvatars}
                                    loading={shopAvatarsLoading}
                                    onSelectAvatar={(avatarUrl) =>
                                      setForm((prev) => ({
                                        ...prev,
                                        avatar: avatarUrl,
                                      }))
                                    }
                                    onFileSelect={setAvatarFromFile}
                                  />
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="profileFormFooter">
                          <button
                            className="profileFooterBtn profileFooterBtnPrimary"
                            type="button"
                            onClick={saveProfile}
                            disabled={profileSaving}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                            </svg>
                            <span>
                              {profileSaving ? "Saving..." : "Save Profile"}
                            </span>
                          </button>
                          <button
                            className="profileFooterBtn profileFooterBtnGhost"
                            type="button"
                            onClick={() => setAccountModalOpen(false)}
                          >
                            Close
                          </button>
                          <button
                            className="profileFooterBtn profileFooterBtnLogout"
                            type="button"
                            onClick={() => {
                              void logout();
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
                            </svg>
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {walletTab !== "profile" ? (
                  <div className="profileModalFooter profileModalFooterCompact">
                    <button
                      className="profileFooterBtn profileFooterBtnGhost"
                      type="button"
                      onClick={() => setAccountModalOpen(false)}
                    >
                      Close
                    </button>
                    <button
                      className="profileFooterBtn profileFooterBtnLogout"
                      type="button"
                      onClick={() => {
                        void logout();
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {depositQrOpen && !!depositAddress && (
            <div
              className="backdrop onboardingBackdrop"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setDepositQrOpen(false);
                }
              }}
            >
              <div
                className="modal qrDepositModal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="accountModalTitle">Deposit QR</div>
                <div className="qrDepositEthMark" aria-hidden>
                  <img
                    className="qrDepositEthIcon"
                    src="/ethereum.png"
                    alt="Ethereum"
                  />
                </div>
                <div className="accountModalSubtitle qrDepositSubtitle">
                  Scan this QR or copy the address to transfer ERC20 USDT.
                </div>
                <div className="qrDepositWarning" role="note">
                  <span className="qrDepositWarningIcon" aria-hidden>
                    ⚠️
                  </span>
                  <span>
                    If you use any other tokens, we cannot accept them and
                    therefore are not responsible.
                  </span>
                </div>
                <div className="qrDepositImageWrap">
                  <img
                    className="qrDepositImage"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(`ethereum:${depositAddress}`)}`}
                    alt="Deposit QR"
                  />
                </div>
                <div className="formGroup" style={{ marginTop: 10 }}>
                  <input className="input" value={depositAddress} readOnly />
                </div>
                <div className="accountModalActions">
                  <button
                    className="btnSecondary"
                    type="button"
                    onClick={() => setDepositQrOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Waiting modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {matchView.mode === "waiting" && (
        <div className="backdrop">
          <div className="modal">
            <div className="waitingFlow" aria-hidden>
              <div className="waitingTrack">
                <span />
                <span />
                <span />
              </div>
              <div className="waitingFlowScene">
                <div className="waitingAvatarWrap left">
                  <span className="waitingAvatarRipple" />
                  <div className="waitingAvatar left">
                    <span className="waitingPersonIcon" aria-hidden />
                  </div>
                </div>
                <div className="waitingCenterHub">
                  <span className="waitingCenterWave waveOne" />
                  <span className="waitingCenterWave waveTwo" />
                  <span className="waitingCenterWave waveThree" />
                  <span className="waitingCenterDot" />
                </div>
                <div className="waitingAvatarWrap right">
                  <span className="waitingAvatarRipple" />
                  <div className="waitingAvatar right">
                    <span className="waitingPersonIcon" aria-hidden />
                  </div>
                </div>
              </div>
            </div>
            <div className="waitingTitle">Connecting you to opponent…</div>
            <div className="waitingSubtitle">
              {matchView.ledger === "free"
                ? `Waiting for another player to join your ${formatRafc(matchView.price || 0)} RAC stake`
                : `Waiting for another player to join your ${fmt(matchView.price || 0)} stake`}
            </div>
            <div className="waitingMeta">
              <span>
                finding opponent among {trustMetrics.playersOnline} active
                players
              </span>
              <span>{trustMetrics.activeSearchers} players searching now</span>
              <span>you have waited {waitingSeconds}s</span>
            </div>
            <div className="waitingActivity">
              {(activityItems.length > 0
                ? activityItems
                : [
                    {
                      id: "waiting-idle",
                      text: "Queue filling fast. Next opponent incoming.",
                      at: Date.now(),
                    },
                  ]
              )
                .slice(0, 3)
                .map((entry) => (
                  <div className="waitingActivityItem" key={entry.id}>
                    <span className="activityDot" />
                    <span>{entry.text}</span>
                  </div>
                ))}
            </div>
            <button
              className="btnDanger"
              onClick={cancelWaiting}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Playing modal ───────────────────────────── */}
      {activeMatch && matchView.mode === "playing" ? (
        <PlayingMatchModal
          activeMatch={activeMatch}
          user={user}
          myInMatch={myInMatch}
          moveSubmitted={moveSubmitted}
          opponentMoveLockedHint={opponentMoveLockedHint}
          showGoBurst={showGoBurst}
          finishedAtMs={finishedAtMs}
          finishedReferralBonuses={finishedReferralBonuses}
          rematchState={rematchState}
          rematchChoiceLoading={rematchChoiceLoading}
          trustMetrics={{
            completedLast10s: trustMetrics.completedLast10s,
            fastestToday: trustMetrics.fastestToday,
            peakActivity: trustMetrics.peakActivity,
          }}
          onSubmitMove={submitMove}
          onRematchChoice={handleRematchChoice}
          onConfirmRematchQuit={handleConfirmRematchQuit}
        />
      ) : null}
    </div>
  );
}

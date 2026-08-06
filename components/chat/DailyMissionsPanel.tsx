"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { ProfileNotificationType } from "../../hooks/useProfileNotifications";
import type { DailyMissionItem } from "../../lib/types";
import {
  DailyMissionsGuideButton,
  DailyMissionsGuideModal,
} from "./DailyMissionsGuideModal";

type DailyMissionsPanelProps = {
  userId: string;
  isAuthenticated?: boolean;
  onNotify?: (message: string, type?: ProfileNotificationType) => void;
  variant?: "lobby" | "profile";
  title?: string;
  onShowAllMissions?: () => void;
};

const formatPreviewContent = (template: string, amount: number) => {
  const required = Math.max(1, amount);
  if (!template.includes("amount")) {
    return template;
  }
  return template.replace(/amount/g, String(required));
};

const DAILY_MISSION_RESET_TZ = "Asia/Shanghai";

const getDatePartsInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

const getCycleKeyInTimeZone = (date: Date, timeZone: string) => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
};

const getNextMidnightTimestamp = (now = new Date()) => {
  const startKey = getCycleKeyInTimeZone(now, DAILY_MISSION_RESET_TZ);
  let ts = now.getTime() + 1000;

  while (ts - now.getTime() < 48 * 60 * 60 * 1000) {
    const candidate = new Date(ts);
    const parts = getDatePartsInTimeZone(candidate, DAILY_MISSION_RESET_TZ);

    if (
      parts.hour === 0 &&
      parts.minute === 0 &&
      getCycleKeyInTimeZone(candidate, DAILY_MISSION_RESET_TZ) !== startKey
    ) {
      return ts;
    }

    ts += 30 * 1000;
  }

  return now.getTime() + 24 * 60 * 60 * 1000;
};

const PREVIEW_MISSIONS: DailyMissionItem[] = [
  {
    id: -1,
    missionKey: "play_matches",
    content: formatPreviewContent("Play amount Matches", 3),
    required: 3,
    reward: 10,
    rewardRac: 10,
    rewardUsdt: 0.1,
    progress: 0,
    completed: false,
    rewardClaimed: false,
    isMeta: false,
    sortOrder: 10,
  },
  {
    id: -2,
    missionKey: "play_rounds",
    content: formatPreviewContent("Play amount Rounds", 10),
    required: 10,
    reward: 10,
    rewardRac: 10,
    rewardUsdt: 0.1,
    progress: 0,
    completed: false,
    rewardClaimed: false,
    isMeta: false,
    sortOrder: 30,
  },
  {
    id: -3,
    missionKey: "watch_live_video",
    content: formatPreviewContent("Watch amount Live Video", 1),
    required: 1,
    reward: 10,
    rewardRac: 10,
    rewardUsdt: 0.1,
    progress: 0,
    completed: false,
    rewardClaimed: false,
    isMeta: false,
    sortOrder: 160,
  },
  {
    id: -4,
    missionKey: "finish_all_missions",
    content: "Finish all missions today",
    required: 1,
    reward: 50,
    rewardRac: 50,
    rewardUsdt: 0.5,
    progress: 0,
    completed: false,
    rewardClaimed: false,
    isMeta: true,
    sortOrder: 1000,
  },
];

const PREVIEW_TOTAL_MISSIONS: DailyMissionItem[] = [
  {
    id: -101,
    missionKey: "win_10_usdt_matches",
    content: formatPreviewContent("Win amount USDT matches", 10),
    required: 10,
    reward: 20,
    rewardRac: 20,
    rewardUsdt: 0.2,
    progress: 0,
    completed: false,
    rewardClaimed: false,
    isMeta: false,
    sortOrder: 10,
  },
  {
    id: -102,
    missionKey: "win_10_rac_matches",
    content: formatPreviewContent("Win amount RAC matches", 10),
    required: 10,
    reward: 20,
    rewardRac: 20,
    rewardUsdt: 0.2,
    progress: 0,
    completed: false,
    rewardClaimed: false,
    isMeta: false,
    sortOrder: 20,
  },
];

const getPreviewPayload = (): DailyMissionsPayload => ({
  cycleKey: "preview",
  resetAt: getNextMidnightTimestamp(),
  resetTimeZone: "Asia/Shanghai",
  missions: PREVIEW_MISSIONS,
  totalMissions: PREVIEW_TOTAL_MISSIONS,
});

const isAuthError = (loadError: unknown) => {
  const message =
    loadError instanceof Error ? loadError.message.toLowerCase() : "";
  return (
    message.includes("auth") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("401") ||
    message.includes("403")
  );
};

type DailyMissionsPayload = {
  cycleKey: string;
  resetAt: number;
  resetTimeZone: string;
  missions: DailyMissionItem[];
  totalMissions?: DailyMissionItem[];
};

type MissionTone =
  | "orange"
  | "purple"
  | "green"
  | "blue"
  | "gold"
  | "violet"
  | "cyan"
  | "rose";

type MissionPulse = "connected" | "playing" | "live";
type MissionScopeTab = "daily" | "total";

const LOBBY_DAILY_MISSION_COUNT = 3;
const LOBBY_TOTAL_MISSION_COUNT = 2;

const formatCountdown = (resetAt: number, now: number) => {
  const remainingMs = Math.max(0, resetAt - now);
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m left`;
  }

  return `${hours}h ${minutes}m left`;
};

const missionTone = (missionKey: string, isMeta: boolean): MissionTone => {
  if (isMeta) {
    return "gold";
  }
  switch (missionKey) {
    case "win_matches":
    case "perfect_matches":
      return "orange";
    case "play_matches":
    case "play_rounds":
      return "purple";
    case "watch_live_video":
    case "stay_online_minutes":
      return "green";
    case "send_chat_messages":
    case "defeat_different_players":
      return "blue";
    case "discord_channel":
      return "blue";
    case "earn_rafc_today":
    case "spend_rafc_today":
      return "cyan";
    case "win_rock":
    case "win_paper":
    case "win_scissors":
    case "use_rock":
    case "use_paper":
    case "use_scissors":
      return "rose";
    case "play_minutes":
      return "violet";
    default:
      return "violet";
  }
};

const missionPulse = (missionKey: string, tone: MissionTone): MissionPulse => {
  switch (missionKey) {
    case "watch_live_video":
      return "live";
    case "play_rounds":
    case "play_minutes":
      return "playing";
    case "stay_online_minutes":
    case "login_today":
    case "send_chat_messages":
    case "discord_channel":
      return "connected";
    case "play_matches":
    case "win_matches":
    case "perfect_matches":
      return "live";
    default:
      break;
  }

  switch (tone) {
    case "green":
      return "connected";
    case "blue":
    case "purple":
    case "violet":
    case "cyan":
      return "playing";
    default:
      return "live";
  }
};

function TrophyCupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M8.2 4h7.6l.9 3.6H7.3L8.2 4Z" fill="currentColor" />
      <path
        d="M7.3 7.6h9.4c0 3.4-1.4 5.8-4.7 6.8-3.3-1-4.7-3.4-4.7-6.8Z"
        fill="currentColor"
      />
      <path
        d="M10.2 14.4h3.6v2.2H10.2V14.4Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path d="M9.1 16.6h5.8v2.4H9.1V16.6Z" fill="currentColor" />
      <path
        d="M6.8 7.8H5.2c0 1.8.9 3 2.3 3.6M17.2 7.8h1.6c0 1.8-.9 3-2.3 3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GameControllerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect
        x="4.5"
        y="8.5"
        width="15"
        height="9"
        rx="3.2"
        fill="currentColor"
      />
      <path
        d="M9.3 12.1 11.2 13.5 9.3 14.9V12.1Z"
        fill="rgba(255,255,255,0.92)"
      />
      <circle cx="15.4" cy="11.1" r="1.15" fill="rgba(255,255,255,0.88)" />
      <circle cx="17.3" cy="13" r="1.15" fill="rgba(255,255,255,0.88)" />
      <path
        d="M8.2 10.8v2.8M6.8 12.2h2.8"
        stroke="rgba(255,255,255,0.82)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MissionIcon({
  missionKey,
  tone,
}: {
  missionKey: string;
  tone: MissionTone;
}) {
  const iconClass = `dailyMissionGlyph dailyMissionGlyph--${tone}`;

  switch (missionKey) {
    case "play_matches":
    case "win_matches":
    case "perfect_matches":
      return (
        <span className={iconClass} aria-hidden="true">
          <TrophyCupIcon />
        </span>
      );
    case "play_rounds":
      return (
        <span className={iconClass} aria-hidden="true">
          <GameControllerIcon />
        </span>
      );
    case "play_minutes":
    case "stay_online_minutes":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="7.5"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 7.5V12l3.2 2.2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    case "earn_rafc_today":
    case "spend_rafc_today":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="7.5" fill="currentColor" />
            <path
              d="M12 8.2v7.6M9.4 10.8c0-1.2 1.1-1.8 2.6-1.8s2.6.6 2.6 1.8-1.1 1.8-2.6 1.8-2.6.6-2.6 1.8 1.1 1.8 2.6 1.8 2.6-.6 2.6-1.8"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case "defeat_different_players":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="9.5" r="3" fill="currentColor" />
            <circle
              cx="16.5"
              cy="11"
              r="2.5"
              fill="currentColor"
              opacity="0.72"
            />
            <path
              d="M5.5 18c0-2.4 1.8-4 3.5-4s3.5 1.6 3.5 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M13.5 18c0-1.8 1.4-3 2.8-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.72"
            />
          </svg>
        </span>
      );
    case "win_rock":
    case "use_rock":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M8.5 16.5 6 11.5l2.8-4.2 4.2-1.3 3.5 2.2 1.2 4.8-3.1 3.5-6.1-.2Z"
              fill="currentColor"
            />
          </svg>
        </span>
      );
    case "win_paper":
    case "use_paper":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect
              x="7"
              y="5.5"
              width="10"
              height="13"
              rx="1.5"
              fill="currentColor"
            />
            <path
              d="M9.5 9h5M9.5 12h5M9.5 15h3.5"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case "win_scissors":
    case "use_scissors":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle
              cx="8"
              cy="8"
              r="2.2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle
              cx="8"
              cy="16"
              r="2.2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10 9.5 18 6M10 14.5 18 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case "watch_live_video":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M4.5 8.5h11.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 14V10a1.5 1.5 0 0 1 1.5-1.5Z"
              fill="currentColor"
            />
            <path d="M17 10.5 21 8.5v7l-4-2v-2.5Z" fill="currentColor" />
          </svg>
        </span>
      );
    case "send_chat_messages":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 19 15.5H10l-3.5 3v-3H5A1.5 1.5 0 0 1 3.5 14V8A1.5 1.5 0 0 1 5 6.5Z"
              fill="currentColor"
            />
            <path
              d="M8 11h8M8 13.5h5"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case "discord_channel":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M18.9 5.5A15.7 15.7 0 0 0 15.3 4c-.2.4-.4.9-.6 1.3a14.4 14.4 0 0 0-5.4 0C9.1 4.9 8.9 4.4 8.7 4a15.7 15.7 0 0 0-3.6 1.5C3.2 8.8 2.5 12 2.7 15.1c1.5 1.1 3 1.8 4.4 2.3.4-.5.7-1.1 1-1.7-.5-.2-1.1-.5-1.6-.8.1-.1.2-.2.3-.3 3.1 1.4 6.4 1.4 9.4 0l.3.3c-.5.3-1 .6-1.6.8.3.6.6 1.2 1 1.7 1.4-.5 2.9-1.2 4.4-2.3.3-3.6-.6-6.7-2.5-9.6ZM9.7 13.2c-.8 0-1.5-.8-1.5-1.7s.6-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Zm4.6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Z"
              fill="currentColor"
            />
          </svg>
        </span>
      );
    case "login_today":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle
              cx="10"
              cy="9.5"
              r="3.2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M5.5 18.5c0-2.8 2-4.8 4.5-4.8s4.5 2 4.5 4.8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M16.5 8.5V16M13.5 12.5h6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case "finish_all_missions":
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M5.5 10.5 8.5 8l3 4.5 6.5-7 2.5 2.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 5.5 18V10.5Z"
              fill="currentColor"
            />
            <path
              d="M8.5 8 11.5 12.5 18 5.5"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    default:
      return (
        <span className={iconClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        </span>
      );
  }
}

export function DailyMissionsPanel({
  userId,
  isAuthenticated = false,
  onNotify,
  variant = "lobby",
  title = "Daily Missions",
  onShowAllMissions,
}: DailyMissionsPanelProps) {
  const [payload, setPayload] = useState<DailyMissionsPayload | null>(() =>
    isAuthenticated ? null : getPreviewPayload(),
  );
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState("");
  const [disabledPreview, setDisabledPreview] = useState(!isAuthenticated);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [profileMissionTab, setProfileMissionTab] =
    useState<MissionScopeTab>("daily");
  const isProfileView = variant === "profile";

  const loadMissions = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId || !isAuthenticated) {
        setPayload(getPreviewPayload());
        setDisabledPreview(true);
        setError("");
        setLoading(false);
        return;
      }

      if (!options?.silent) {
        setLoading(true);
      }
      setError("");

      try {
        const result = await api.dailyMissions(userId);
        setPayload(result);
        setDisabledPreview(false);
      } catch (loadError) {
        if (isAuthError(loadError)) {
          setPayload(getPreviewPayload());
          setDisabledPreview(true);
          setError("");
        } else {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Failed to load daily missions";
          setError(message);
          if (!options?.silent) {
            onNotify?.(message, "error");
          }
          setDisabledPreview(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, onNotify, userId],
  );

  useEffect(() => {
    void loadMissions();
  }, [loadMissions]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return;
    }

    const pulsePresence = () => {
      void api
        .dailyMissionPresence()
        .then((result) => {
          setPayload(result);
          setDisabledPreview(false);
        })
        .catch(() => undefined);
    };

    pulsePresence();
    const timer = window.setInterval(pulsePresence, 60_000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onRefresh = () => {
      void loadMissions({ silent: true });
    };

    window.addEventListener("rps:daily-mission-refresh", onRefresh);
    return () => {
      window.removeEventListener("rps:daily-mission-refresh", onRefresh);
    };
  }, [loadMissions]);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || now == null || !payload?.resetAt) {
      return;
    }

    if (payload.resetAt <= now) {
      void loadMissions();
    }
  }, [loadMissions, mounted, now, payload?.resetAt]);

  const countdownLabel = useMemo(() => {
    if (!mounted || now == null || !payload?.resetAt) {
      return null;
    }
    return formatCountdown(payload.resetAt, now);
  }, [mounted, now, payload?.resetAt]);

  const regularMissions = useMemo(
    () => (payload?.missions || []).filter((mission) => !mission.isMeta),
    [payload?.missions],
  );

  const metaMission = useMemo(
    () => (payload?.missions || []).find((mission) => mission.isMeta) || null,
    [payload?.missions],
  );

  const totalMissions = useMemo(
    () => payload?.totalMissions || [],
    [payload?.totalMissions],
  );

  const visibleRegularMissions = useMemo(
    () =>
      isProfileView
        ? regularMissions
        : regularMissions.slice(0, LOBBY_DAILY_MISSION_COUNT),
    [isProfileView, regularMissions],
  );

  const visibleTotalMissions = useMemo(
    () =>
      isProfileView
        ? totalMissions
        : totalMissions.slice(0, LOBBY_TOTAL_MISSION_COUNT),
    [isProfileView, totalMissions],
  );

  const visibleProfileMissions = useMemo(() => {
    if (profileMissionTab === "daily") {
      const missions = [...regularMissions];
      if (metaMission) {
        missions.push(metaMission);
      }
      return missions;
    }
    return totalMissions;
  }, [metaMission, profileMissionTab, regularMissions, totalMissions]);

  const shouldShowShowAllButton =
    !isProfileView &&
    !loading &&
    !error &&
    typeof onShowAllMissions === "function" &&
    (visibleRegularMissions.length > 0 ||
      visibleTotalMissions.length > 0 ||
      Boolean(metaMission));

  const hasProfileSubTabs =
    isProfileView && (regularMissions.length > 0 || totalMissions.length > 0);

  return (
    <section
      className={`dailyMissionsCard${disabledPreview ? " dailyMissionsCard--disabled" : ""}`}
      aria-label={title}
      aria-disabled={disabledPreview}
    >
      <header className="dailyMissionsHeader">
        <div className="dailyMissionsHeaderMain">
          <span className="dailyMissionsIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="12" cy="12" r="3.5" fill="currentColor" />
            </svg>
          </span>
          <h2 className="dailyMissionsTitle">{title}</h2>
        </div>
        <div className="dailyMissionsHeaderActions">
          <DailyMissionsGuideButton onClick={() => setGuideOpen(true)} />
          <span className="dailyMissionsCountdown">
            {countdownLabel ?? "--"}
          </span>
        </div>
      </header>

      <DailyMissionsGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      {hasProfileSubTabs ? (
        <div
          className="dailyMissionsSubTabs"
          role="tablist"
          aria-label="Mission categories"
        >
          <button
            type="button"
            role="tab"
            className={`dailyMissionsSubTab${profileMissionTab === "daily" ? " active" : ""}`}
            aria-selected={profileMissionTab === "daily"}
            onClick={() => setProfileMissionTab("daily")}
          >
            Daily Missions ({regularMissions.length + (metaMission ? 1 : 0)})
          </button>
          <button
            type="button"
            role="tab"
            className={`dailyMissionsSubTab${profileMissionTab === "total" ? " active" : ""}`}
            aria-selected={profileMissionTab === "total"}
            onClick={() => setProfileMissionTab("total")}
          >
            Total Missions ({totalMissions.length})
          </button>
        </div>
      ) : null}

      <div className="dailyMissionsBody">
        {loading ? (
          <p className="dailyMissionsState">Loading missions...</p>
        ) : error ? (
          <p className="dailyMissionsState dailyMissionsStateError">{error}</p>
        ) : regularMissions.length === 0 &&
          !metaMission &&
          totalMissions.length === 0 ? (
          <p className="dailyMissionsState">No missions available today.</p>
        ) : isProfileView ? (
          profileMissionTab === "daily" ? (
            visibleProfileMissions.length > 0 ? (
              <>
                {visibleProfileMissions.map((mission) => (
                  <MissionRow
                    key={mission.id}
                    mission={mission}
                    isMeta={mission.isMeta}
                    disabled={disabledPreview}
                  />
                ))}
              </>
            ) : (
              <p className="dailyMissionsState">
                No active daily missions in admin panel.
              </p>
            )
          ) : visibleProfileMissions.length > 0 ? (
            <>
              {visibleProfileMissions.map((mission) => (
                <MissionRow
                  key={`total-${mission.id}`}
                  mission={mission}
                  disabled={disabledPreview}
                />
              ))}
            </>
          ) : (
            <p className="dailyMissionsState">
              No active total missions in admin panel.
            </p>
          )
        ) : (
          <>
            {visibleRegularMissions.map((mission) => (
              <MissionRow
                key={mission.id}
                mission={mission}
                disabled={disabledPreview}
              />
            ))}
            {visibleTotalMissions.length > 0 ? (
              <>
                <p className="dailyMissionsSectionTitle">Total Missions</p>
                {visibleTotalMissions.map((mission) => (
                  <MissionRow
                    key={`total-${mission.id}`}
                    mission={mission}
                    disabled={disabledPreview}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </div>

      {shouldShowShowAllButton ? (
        <button
          type="button"
          className="dailyMissionsToggleBtn"
          onClick={onShowAllMissions}
        >
          Show all missions
        </button>
      ) : null}
    </section>
  );
}

type MissionRowProps = {
  mission: DailyMissionItem;
  isMeta?: boolean;
  disabled?: boolean;
};

function MissionRow({
  mission,
  isMeta = false,
  disabled = false,
}: MissionRowProps) {
  const required = Math.max(1, mission.required);
  const progress = Math.min(Math.max(0, mission.progress), required);
  const percent = Math.round((progress / required) * 100);
  const tone = missionTone(mission.missionKey, isMeta || mission.isMeta);
  const pulse = missionPulse(mission.missionKey, tone);
  const completed = mission.completed || progress >= required;

  return (
    <article
      className={`dailyMissionRow dailyMissionRow--${tone}${
        isMeta || mission.isMeta ? " dailyMissionRow--meta" : ""
      }${completed ? " dailyMissionRow--completed" : ""}${
        disabled ? " dailyMissionRow--disabled" : ""
      }`}
    >
      <div
        className={`dailyMissionRowIconShell dailyMissionRowIconShell--${pulse}`}
      >
        {!completed ? (
          <>
            <span className="dailyMissionRowIconRipple" aria-hidden="true" />
            <span
              className="dailyMissionRowIconRipple dailyMissionRowIconRipple--delay"
              aria-hidden="true"
            />
          </>
        ) : null}
        <MissionIcon missionKey={mission.missionKey} tone={tone} />
      </div>

      <div className="dailyMissionRowContent">
        <p className="dailyMissionRowLabel">{mission.content}</p>
        {mission.missionKey === "discord_channel" &&
        mission.discordChannelMessage ? (
          <p
            className={`dailyMissionRowHint${
              mission.discordChannelStatus === "not_joined"
                ? " dailyMissionRowHint--warning"
                : ""
            }`}
          >
            {mission.discordChannelMessage}
          </p>
        ) : null}
        <div className="dailyMissionRowProgressWrap">
          <div
            className="dailyMissionRowProgressBar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={required}
            aria-valuenow={progress}
            aria-label={`${mission.content} progress`}
          >
            <span
              className="dailyMissionRowProgressFill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="dailyMissionRowProgressCount">
            {progress}/{required}
          </span>
        </div>
      </div>

      <div className="dailyMissionRowAside">
        {completed ? (
          <span className="dailyMissionRowCheck" aria-label="Completed">
            ✓
          </span>
        ) : (
          <span className="dailyMissionRowReward">
            {(mission.rewardRac ?? mission.reward) > 0 ? (
              <span className="dailyMissionRowRewardLine">
                <span className="dailyMissionRowRewardValue">
                  +{(mission.rewardRac ?? mission.reward).toLocaleString()}
                </span>
                <span className="dailyMissionRowRewardUnit">RAC</span>
              </span>
            ) : null}
            {(mission.rewardUsdt ?? 0) > 0 ? (
              <span className="dailyMissionRowRewardLine">
                <span className="dailyMissionRowRewardValueUsdt">
                  +{(mission.rewardUsdt ?? 0).toFixed(2)}
                </span>
                <span className="dailyMissionRowRewardUnitUsdt">USDT</span>
              </span>
            ) : null}
          </span>
        )}
      </div>
    </article>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProfileNotificationType = "success" | "error" | "info";

export type ProfileNotificationItem = {
  id: string;
  message: string;
  type: ProfileNotificationType;
};

export const PROFILE_NOTIFICATION_VISIBLE_MS = 4500;
export const PROFILE_NOTIFICATION_EXIT_MS = 260;

export function useProfileNotifications() {
  const [activeItem, setActiveItem] = useState<ProfileNotificationItem | null>(
    null,
  );
  const [isExiting, setIsExiting] = useState(false);
  const queueRef = useRef<ProfileNotificationItem[]>([]);
  const visibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (visibleTimerRef.current) {
      clearTimeout(visibleTimerRef.current);
      visibleTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const showNext = useCallback(() => {
    clearTimers();
    setIsExiting(false);

    const next = queueRef.current.shift() || null;
    if (!next) {
      showingRef.current = false;
      setActiveItem(null);
      return;
    }

    showingRef.current = true;
    setActiveItem(next);

    visibleTimerRef.current = setTimeout(() => {
      visibleTimerRef.current = null;
      setIsExiting(true);

      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        showNext();
      }, PROFILE_NOTIFICATION_EXIT_MS);
    }, PROFILE_NOTIFICATION_VISIBLE_MS);
  }, [clearTimers]);

  const notify = useCallback(
    (message: string, type: ProfileNotificationType = "info") => {
      const normalized = String(message || "").trim();
      if (!normalized) {
        return;
      }

      queueRef.current.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message: normalized,
        type,
      });

      if (!showingRef.current) {
        showNext();
      }
    },
    [showNext],
  );

  const notifySuccess = useCallback(
    (message: string) => notify(message, "success"),
    [notify],
  );

  const notifyError = useCallback(
    (message: string) => notify(message, "error"),
    [notify],
  );

  useEffect(() => {
    return () => {
      clearTimers();
      queueRef.current = [];
      showingRef.current = false;
    };
  }, [clearTimers]);

  return {
    items: activeItem ? [activeItem] : [],
    isExiting,
    notify,
    notifySuccess,
    notifyError,
  };
}

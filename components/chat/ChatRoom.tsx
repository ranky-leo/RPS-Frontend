"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { getSocket } from "../../lib/socket";
import { UserAvatar } from "../UserAvatar";
import {
  CHAT_EMOJIS,
  CHAT_LIVE_STICKERS,
  formatChatMessageTime,
  getLiveStickerMotionClass,
  resolveChatImageUrl,
} from "../../lib/chatMedia";
import type { ProfileNotificationType } from "../../hooks/useProfileNotifications";
import type { ChatMessage } from "../../lib/types";

type ChatTyper = {
  userId: string;
  username: string;
  avatar: string;
};

type ChatRoomProps = {
  onlineCount: number;
  activeUserId?: string | null;
  isAdmin?: boolean;
  onNotify?: (message: string, type?: ProfileNotificationType) => void;
};

type ChatPanelTab = "emoji" | "stickers";

const MAX_PASTE_IMAGE_SIZE = 2 * 1024 * 1024;
const LONG_PRESS_MS = 550;

export function ChatRoom({
  onlineCount,
  activeUserId,
  isAdmin = false,
  onNotify,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<ChatPanelTab>("emoji");
  const [sending, setSending] = useState(false);
  const [activeTyper, setActiveTyper] = useState<ChatTyper | null>(null);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const feedRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingEmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const formattedOnlineCount = useMemo(
    () => onlineCount.toLocaleString(),
    [onlineCount],
  );

  const scrollToBottom = useCallback(() => {
    const feed = feedRef.current;
    if (!feed) {
      return;
    }
    feed.scrollTop = feed.scrollHeight;
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onHistory = (payload: { messages?: ChatMessage[] }) => {
      setMessages(Array.isArray(payload?.messages) ? payload.messages : []);
      requestAnimationFrame(scrollToBottom);
    };

    const onMessage = (payload: { message?: ChatMessage }) => {
      const message = payload.message;
      if (!message) {
        return;
      }
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      if (
        activeUserId &&
        String(message.userId) === String(activeUserId) &&
        typeof window !== "undefined"
      ) {
        window.dispatchEvent(new CustomEvent("rps:daily-mission-refresh"));
      }
      requestAnimationFrame(scrollToBottom);
    };

    const onError = (payload: { message?: string }) => {
      onNotify?.(String(payload?.message || "Unable to send message"), "error");
    };

    const onDeleted = (payload: { messageId?: string }) => {
      const messageId = String(payload?.messageId || "").trim();
      if (!messageId) {
        return;
      }
      setMessages((prev) => prev.filter((item) => item.id !== messageId));
      setActionMessageId((current) => (current === messageId ? null : current));
    };

    const onTyping = (payload: { typers?: ChatTyper[] }) => {
      const nextTypers = Array.isArray(payload?.typers) ? payload.typers : [];
      const visibleTyper =
        nextTypers.find(
          (typer) =>
            !activeUserId || String(typer.userId) !== String(activeUserId),
        ) || null;
      setActiveTyper(visibleTyper);
    };

    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    socket.on("chat:error", onError);
    socket.on("chat:deleted", onDeleted);
    socket.on("chat:typing", onTyping);

    return () => {
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.off("chat:error", onError);
      socket.off("chat:deleted", onDeleted);
      socket.off("chat:typing", onTyping);
    };
  }, [scrollToBottom, activeUserId, onNotify]);

  const identifyForChat = () => {
    const userId = String(activeUserId || "").trim();
    if (!userId) {
      return false;
    }

    getSocket().emit("auth:identify", { userId });
    return true;
  };

  const emitTypingState = useCallback(
    (active: boolean) => {
      const userId = String(activeUserId || "").trim();
      if (!userId) {
        return;
      }

      if (active) {
        if (!identifyForChat()) {
          return;
        }
        getSocket().emit("chat:typing", { active: true });
        isTypingRef.current = true;
        return;
      }

      if (!isTypingRef.current) {
        return;
      }

      getSocket().emit("chat:typing", { active: false });
      isTypingRef.current = false;
    },
    [activeUserId],
  );

  useEffect(() => {
    if (!draft.trim()) {
      emitTypingState(false);
      return;
    }

    if (typingEmitTimerRef.current) {
      clearTimeout(typingEmitTimerRef.current);
    }

    typingEmitTimerRef.current = setTimeout(() => {
      emitTypingState(true);
    }, 250);

    return () => {
      if (typingEmitTimerRef.current) {
        clearTimeout(typingEmitTimerRef.current);
      }
    };
  }, [draft, emitTypingState]);

  useEffect(() => {
    return () => {
      emitTypingState(false);
      if (typingEmitTimerRef.current) {
        clearTimeout(typingEmitTimerRef.current);
      }
    };
  }, [emitTypingState]);

  useEffect(() => {
    if (!actionMessageId) {
      return;
    }

    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-chat-message-action='true']")) {
        return;
      }
      setActionMessageId(null);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside, { passive: true });

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
    };
  }, [actionMessageId]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(scrollToBottom);
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const sendMessage = async (payload: {
    text?: string;
    imageDataUrl?: string | null;
    sticker?: string;
  }) => {
    const normalizedText = String(payload.text || "").trim();
    const normalizedSticker = String(payload.sticker || "").trim();
    const normalizedImage = String(payload.imageDataUrl || "").trim();

    if (!normalizedText && !normalizedSticker && !normalizedImage) {
      return;
    }

    if (!identifyForChat()) {
      onNotify?.("Identify before sending chat messages", "error");
      return;
    }

    setSending(true);
    try {
      emitTypingState(false);
      getSocket().emit("chat:send", {
        text: normalizedText || undefined,
        imageDataUrl: normalizedImage || undefined,
        sticker: normalizedSticker || undefined,
      });
      setDraft("");
      setPendingImage(null);
    } finally {
      setSending(false);
    }
  };

  const applyImageFile = useCallback(
    (file: File | null) => {
      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        onNotify?.("Please choose an image file.", "error");
        return;
      }

      if (file.size > MAX_PASTE_IMAGE_SIZE) {
        onNotify?.("Image is too large. Max size is 2 MB.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "").trim();
        if (result) {
          setPendingImage(result);
        }
      };
      reader.readAsDataURL(file);
    },
    [onNotify],
  );

  const handleSend = () => {
    void sendMessage({
      text: draft,
      imageDataUrl: pendingImage,
    });
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items?.length) {
      return;
    }

    for (const item of items) {
      if (!item.type.startsWith("image/")) {
        continue;
      }

      event.preventDefault();
      const file = item.getAsFile();
      applyImageFile(file);
      return;
    }
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    applyImageFile(file);
    event.target.value = "";
  };

  const openImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const appendEmoji = (value: string) => {
    setDraft((prev) => `${prev}${value}`);
  };

  const sendSticker = (value: string) => {
    void sendMessage({ sticker: value });
  };

  const canDeleteMessage = useCallback(
    (message: ChatMessage) =>
      Boolean(
        isAdmin ||
        (activeUserId && String(message.userId) === String(activeUserId)),
      ),
    [activeUserId, isAdmin],
  );

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = (message: ChatMessage) => {
    if (!canDeleteMessage(message)) {
      return;
    }

    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setActionMessageId(message.id);
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const deleteMessage = (messageId: string) => {
    if (!identifyForChat()) {
      onNotify?.("Identify before deleting chat messages", "error");
      return;
    }

    getSocket().emit("chat:delete", { messageId });
    setActionMessageId(null);
  };

  return (
    <div className="chatRoomCard">
      <div className="chatRoomHeader">
        <div className="chatRoomHeaderMain">
          <h3 className="chatRoomTitle">Chat Room</h3>
        </div>
        <div className="chatRoomOnline">
          <span className="chatRoomOnlineDot" aria-hidden />
          {formattedOnlineCount} Online
        </div>
      </div>

      <div className="chatRoomFeed" ref={feedRef}>
        {messages.length === 0 ? (
          <div className="chatRoomEmpty">Say hello to the arena.</div>
        ) : (
          messages.map((message) => {
            const isSelf = Boolean(
              activeUserId && message.userId === activeUserId,
            );
            const deletable = canDeleteMessage(message);
            const showDelete = actionMessageId === message.id && deletable;
            return (
              <div
                key={message.id}
                className={`chatRoomMessage${isSelf ? " chatRoomMessageSelf" : ""}${showDelete ? " chatRoomMessageActionOpen" : ""}`}
                data-chat-message-action="true"
                onPointerDown={() => startLongPress(message)}
                onPointerUp={clearLongPress}
                onPointerLeave={clearLongPress}
                onPointerCancel={clearLongPress}
                onContextMenu={(event) => {
                  if (!deletable) {
                    return;
                  }
                  event.preventDefault();
                  setActionMessageId(message.id);
                }}
              >
                <UserAvatar
                  avatar={message.avatar}
                  alt={message.username}
                  className="chatRoomAvatar"
                  loading="lazy"
                />
                <div className="chatRoomMessageBody">
                  <div className="chatRoomMessageTop">
                    <div className="chatRoomUsername">{message.username}</div>
                    <div className="chatRoomMessageMeta">
                      {showDelete ? (
                        <button
                          className="chatRoomDeleteBtn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteMessage(message.id);
                          }}
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="chatRoomTime">
                          {formatChatMessageTime(message.createdAt, now)}
                        </span>
                      )}
                    </div>
                  </div>
                  {message.sticker ? (
                    <div
                      className={`chatRoomStickerLive ${getLiveStickerMotionClass(message.sticker)}`}
                    >
                      {message.sticker}
                    </div>
                  ) : null}
                  {message.text ? (
                    <div className="chatRoomText">{message.text}</div>
                  ) : null}
                  {message.imageUrl ? (
                    <a
                      className="chatRoomImageLink"
                      href={resolveChatImageUrl(message.imageUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className="chatRoomImage"
                        src={resolveChatImageUrl(message.imageUrl)}
                        alt="Shared match screenshot"
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {pendingImage ? (
        <div className="chatRoomPastePreview">
          <img
            className="chatRoomPastePreviewImage"
            src={pendingImage}
            alt="Pasted screenshot preview"
          />
          <button
            className="chatRoomPastePreviewRemove"
            type="button"
            onClick={() => setPendingImage(null)}
            aria-label="Remove pasted image"
          >
            ✕
          </button>
        </div>
      ) : null}

      {activeTyper ? (
        <div className="chatRoomTypingBar" aria-live="polite">
          <UserAvatar
            avatar={activeTyper.avatar}
            alt={activeTyper.username}
            className="chatRoomTypingAvatar"
            loading="lazy"
          />
          <span className="chatRoomTypingText">
            {activeTyper.username} is typing
            <span className="chatRoomTypingDots" aria-hidden="true">
              <span className="chatRoomTypingDot">.</span>
              <span className="chatRoomTypingDot">.</span>
              <span className="chatRoomTypingDot">.</span>
            </span>
          </span>
        </div>
      ) : null}

      <div className="chatRoomComposer">
        <div className="chatRoomInputWrap">
          <textarea
            className="chatRoomInput"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={2}
          />
          <input
            ref={fileInputRef}
            className="chatRoomUploadInput"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            tabIndex={-1}
            aria-hidden
          />
          <button
            className="chatRoomUploadBtn"
            type="button"
            onClick={openImageUpload}
            aria-label="Upload image"
            disabled={sending}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 16.5V7.8A1.8 1.8 0 0 1 5.8 6h12.4A1.8 1.8 0 0 1 20 7.8v8.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.2 10.6 11.1 13.5 14.4 10.2 20 15.8V16.5A1.8 1.8 0 0 1 18.2 18.3H5.8A1.8 1.8 0 0 1 4 16.5v-.7Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="9.2" r="1.2" fill="currentColor" />
            </svg>
          </button>
        </div>
        <button
          className="chatRoomSendBtn"
          type="button"
          disabled={sending || (!draft.trim() && !pendingImage)}
          onClick={handleSend}
        >
          Send
        </button>
      </div>

      <div className="chatRoomPanel">
        <button
          className="chatRoomPanelToggle"
          type="button"
          onClick={() => setPanelOpen((prev) => !prev)}
          aria-expanded={panelOpen}
        >
          <span>{panelOpen ? "▾" : "▴"}</span>
        </button>

        {panelOpen ? (
          <>
            <div className="chatRoomPanelTabs">
              <button
                className={`chatRoomPanelTab${panelTab === "emoji" ? " chatRoomPanelTabActive" : ""}`}
                type="button"
                onClick={() => setPanelTab("emoji")}
              >
                Emoji
              </button>
              <button
                className={`chatRoomPanelTab${panelTab === "stickers" ? " chatRoomPanelTabActive" : ""}`}
                type="button"
                onClick={() => setPanelTab("stickers")}
              >
                Stickers
              </button>
            </div>

            <div
              className={`chatRoomPickerGrid${panelTab === "stickers" ? " chatRoomPickerGridStickers" : ""}`}
            >
              {panelTab === "emoji"
                ? CHAT_EMOJIS.map((item) => (
                    <button
                      key={`emoji-${item}`}
                      className="chatRoomPickerItem"
                      type="button"
                      onClick={() => appendEmoji(item)}
                    >
                      {item}
                    </button>
                  ))
                : CHAT_LIVE_STICKERS.map((sticker) => (
                    <button
                      key={`sticker-${sticker.emoji}-${sticker.motion}`}
                      className={`chatRoomPickerItem chatRoomPickerItemLive ${getLiveStickerMotionClass(sticker.emoji)}`}
                      type="button"
                      onClick={() => sendSticker(sticker.emoji)}
                    >
                      {sticker.emoji}
                    </button>
                  ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";

type SupportMessage = {
  id: string;
  userId: string;
  senderRole: "user" | "admin";
  senderUserId: string | null;
  senderName: string | null;
  text: string;
  createdAt: string | null;
  readByUser: boolean;
  readByAdmin: boolean;
};

type SupportChatPanelProps = {
  activeUserId?: string | null;
  onConversationSeen?: () => void;
};

const POLL_MS = 2500;

const formatTime = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function SupportChatPanel({
  activeUserId,
  onConversationSeen,
}: SupportChatPanelProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const refreshConversation = useCallback(async () => {
    if (!activeUserId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const response = await api.supportConversation();
      setMessages(response.messages || []);
      setError(null);
      onConversationSeen?.();
    } catch (err) {
      setError((err as Error).message || "Failed to load support chat");
    } finally {
      setLoading(false);
    }
  }, [activeUserId, onConversationSeen]);

  useEffect(() => {
    setLoading(true);
    void refreshConversation();
    const timer = window.setInterval(() => {
      void refreshConversation();
    }, POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshConversation]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) {
      return;
    }
    feed.scrollTop = feed.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending) {
      return;
    }

    setSending(true);

    try {
      await api.supportSendMessage({ text });
      setDraft("");
      await refreshConversation();
    } catch (err) {
      setError((err as Error).message || "Failed to send support message");
    } finally {
      setSending(false);
    }
  };

  const unreadFromAdmin = useMemo(
    () =>
      messages.filter((item) => item.senderRole === "admin" && !item.readByUser)
        .length,
    [messages],
  );

  if (!activeUserId) {
    return (
      <div
        className="profileWalletPanel profileWalletPanelProfile"
        style={{ width: "100%", gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        <div className="profileWalletForm" style={{ width: "100%" }}>
          <div className="profileFormCard">
            Please log in to chat with admin support.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="profileWalletPanel profileWalletPanelProfile"
      style={{ width: "100%", gridTemplateColumns: "minmax(0, 1fr)" }}
    >
      <div className="profileWalletFormColumn" style={{ width: "100%" }}>
        <div
          className="profileWalletForm"
          style={{
            width: "100%",
            height: "100%",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            className="profileFormCard"
            style={{
              gap: 12,
              display: "grid",
              width: "100%",
              flex: 1,
              minHeight: 0,
              gridTemplateRows: "auto minmax(0, 1fr) auto auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>Admin Support Chat</strong>
              {unreadFromAdmin > 0 ? <span>{unreadFromAdmin} new</span> : null}
            </div>

            <div
              ref={feedRef}
              style={{
                width: "100%",
                minHeight: 0,
                height: "100%",
                overflowY: "auto",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: 12,
                display: "grid",
                gap: 8,
                alignContent: "start",
                alignItems: "start",
              }}
            >
              {loading ? <div>Loading support chat...</div> : null}
              {!loading && messages.length === 0 ? (
                <div>Start the chat. Admin team will reply shortly.</div>
              ) : null}
              {messages.map((message) => {
                const mine = message.senderRole === "user";
                return (
                  <div
                    key={message.id}
                    style={{
                      justifySelf: mine ? "end" : "start",
                      maxWidth: "88%",
                      background: mine
                        ? "rgba(255,255,255,0.12)"
                        : "rgba(89,142,255,0.18)",
                      borderRadius: 10,
                      padding: "6px 9px",
                    }}
                  >
                    <div
                      style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}
                    >
                      {mine ? "You" : message.senderName || "Admin"}
                    </div>
                    <div>{message.text}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 5 }}>
                      {formatTime(message.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            {error ? (
              <div className="accountAlert profileModalAlert">{error}</div>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                className="input profileInput"
                style={{ flex: 1, minWidth: 0 }}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={1000}
                placeholder="Write your message to admin support..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !sending && draft.trim()) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <button
                type="button"
                className="profilePrimaryBtn"
                style={{ padding: 12 }}
                disabled={sending || !draft.trim()}
                onClick={() => {
                  void sendMessage();
                }}
              >
                {sending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

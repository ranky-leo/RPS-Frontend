import { io, Socket } from "socket.io-client";

const normalizeBaseUrl = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\/+$/, "");
};

const resolveSocketBase = () => {
  const wsBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_WS_BASE || "");
  if (wsBase) {
    return wsBase;
  }

  const apiBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE || "");
  if (apiBase) {
    return apiBase;
  }

  if (typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin || "");
  }

  return "http://localhost:4001";
};

let socketRef: Socket | null = null;

export const getSocket = () => {
  if (!socketRef) {
    socketRef = io(resolveSocketBase(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });
  }
  return socketRef;
};

import type { ReactNode } from "react";
import type { ProfileNotificationType } from "../hooks/useProfileNotifications";

export type NotificationCategory =
  | "deposit"
  | "withdraw"
  | "bonus"
  | "security"
  | "error"
  | "info";

export type NotificationPresentation = {
  category: NotificationCategory;
  title: string;
  description: string;
};

type OperationMatch = {
  title: string;
  category: NotificationCategory;
};

const OPERATION_RULES: Array<{
  pattern: RegExp;
  operation: OperationMatch;
}> = [
  {
    pattern: /deposit.*(?:complet|credit)/i,
    operation: { title: "Deposit completed", category: "deposit" },
  },
  {
    pattern: /deposit address ready/i,
    operation: { title: "Deposit ready", category: "deposit" },
  },
  {
    pattern: /deposit could not|deposit failed/i,
    operation: { title: "Deposit failed", category: "deposit" },
  },
  {
    pattern: /deposit/i,
    operation: { title: "Deposit", category: "deposit" },
  },
  {
    pattern: /withdraw.*(?:complet|submit|process)/i,
    operation: { title: "Withdrawal completed", category: "withdraw" },
  },
  {
    pattern: /withdraw/i,
    operation: { title: "Withdrawal", category: "withdraw" },
  },
  {
    pattern:
      /(?:sign-up|signup).*bonus|bonus.*ready|daily mission|mission reward/i,
    operation: { title: "Bonus received", category: "bonus" },
  },
  {
    pattern: /invite.*copied|referral|rafc/i,
    operation: { title: "Bonus received", category: "bonus" },
  },
  {
    pattern: /profile.*saved|profile changes/i,
    operation: { title: "Profile saved", category: "security" },
  },
  {
    pattern: /password|security/i,
    operation: { title: "Security alert", category: "security" },
  },
  {
    pattern: /welcome back/i,
    operation: { title: "Welcome back", category: "info" },
  },
  {
    pattern: /registered|registration|register/i,
    operation: { title: "Registration", category: "info" },
  },
  {
    pattern: /matchmaking cancel/i,
    operation: { title: "Match cancelled", category: "info" },
  },
  {
    pattern: /match.*(?:start|started)|arena bot/i,
    operation: { title: "Match started", category: "info" },
  },
  {
    pattern: /match.*(?:connect|connected)/i,
    operation: { title: "Match connected", category: "info" },
  },
  {
    pattern: /match.*(?:finish|finished|won|lost|release)/i,
    operation: { title: "Match finished", category: "info" },
  },
  {
    pattern: /queue/i,
    operation: { title: "Queue update", category: "info" },
  },
  {
    pattern: /top up|balance/i,
    operation: { title: "Balance update", category: "info" },
  },
  {
    pattern: /insufficient/i,
    operation: { title: "Insufficient balance", category: "error" },
  },
  {
    pattern: /please (?:enter|register|click)/i,
    operation: { title: "Action required", category: "error" },
  },
];

function resolveOperation(
  message: string,
  lower: string,
  type: ProfileNotificationType,
): OperationMatch {
  for (const rule of OPERATION_RULES) {
    if (rule.pattern.test(lower)) {
      return rule.operation;
    }
  }

  if (type === "error") {
    return { title: "Error", category: "error" };
  }

  if (type === "success") {
    return { title: "Success", category: "info" };
  }

  return { title: "Update", category: "info" };
}

function splitSentences(message: string) {
  const match = message.match(/^(.+?[.!?])(?:\s+)([\s\S]+)$/);
  if (!match) {
    return null;
  }

  const title = match[1].replace(/[.!?]$/, "").trim();
  const description = match[2].trim();

  if (!title || !description) {
    return null;
  }

  return { title, description };
}

function isShortOperationTitle(title: string) {
  return (
    title.length > 0 && title.length <= 56 && title.split(/\s+/).length <= 8
  );
}

export function getNotificationPresentation(
  message: string,
  type: ProfileNotificationType,
): NotificationPresentation {
  const trimmed = String(message || "").trim();
  const lower = trimmed.toLowerCase();
  const operation = resolveOperation(trimmed, lower, type);

  const split = splitSentences(trimmed);
  if (split && isShortOperationTitle(split.title)) {
    return {
      category: operation.category,
      title: split.title,
      description: split.description,
    };
  }

  return {
    category: operation.category,
    title: operation.title,
    description: trimmed,
  };
}

const HIGHLIGHT_PATTERN =
  /(\d[\d,]*(?:\.\d+)?\s*(?:USDT|RAC)|\d[\d,]*(?:\.\d+)?(?=\s+credited))/gi;

function shouldHighlightNotificationPart(part: string) {
  return /^(?:\d[\d,]*(?:\.\d+)?\s*(?:USDT|RAC)|\d[\d,]*(?:\.\d+)?)$/i.test(
    part.trim(),
  );
}

export function renderNotificationDescription(description: string): ReactNode {
  if (!description) {
    return null;
  }

  const parts = description.split(HIGHLIGHT_PATTERN).filter(Boolean);

  return parts.map((part, index) => {
    if (!shouldHighlightNotificationPart(part)) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <span className="profileNotificationHighlight" key={`${part}-${index}`}>
        {part}
      </span>
    );
  });
}

export function NotificationCategoryIcon({
  category,
}: {
  category: NotificationCategory;
}) {
  switch (category) {
    case "deposit":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h14a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
          <path d="M17 13h3" />
        </svg>
      );
    case "withdraw":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 16V8" />
          <path d="M8.5 11.5 12 8l3.5 3.5" />
        </svg>
      );
    case "bonus":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="8" width="16" height="11" rx="2" />
          <path d="M12 8V5" />
          <path d="M8.5 5h7" />
          <path d="M12 8c-2 0-3 1.2-3 2.5S10 13 12 13s3-1.2 3-2.5S14 8 12 8z" />
        </svg>
      );
    case "security":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 4 6.5V12c0 4.2 3.2 7.9 8 9 4.8-1.1 8-4.8 8-9V6.5L12 3z" />
          <path d="m9.5 12.5 1.8 1.8 3.7-3.7" />
        </svg>
      );
    case "error":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
          <path d="M10.3 4.3h3.4L20 18H4L10.3 4.3z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v4.5" />
          <path d="M12 16h.01" />
        </svg>
      );
  }
}

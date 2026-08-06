import type { ReactNode } from "react";

type ProfileFieldLabelIcon =
  | "user"
  | "lock"
  | "avatar"
  | "amount"
  | "address"
  | "hash"
  | "history"
  | "wallet";

type ProfileFieldLabelProps = {
  icon: ProfileFieldLabelIcon;
  children: ReactNode;
  htmlFor?: string;
  as?: "label" | "span";
};

const ICONS: Record<ProfileFieldLabelIcon, ReactNode> = {
  user: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M6 19c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="11" width="12" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  avatar: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 16c0-2 1.8-3 4-3s4 1 4 3" />
    </svg>
  ),
  amount: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8.5v7" />
      <path d="M9.5 11h5" />
    </svg>
  ),
  address: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 10h16" />
    </svg>
  ),
  hash: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.41 1.41" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07l1.41-1.41" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5" />
      <path d="M12 12h3.5" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h14a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
      <path d="M17 13h3" />
    </svg>
  ),
};

export function ProfileFieldLabel({
  icon,
  children,
  htmlFor,
  as = "label",
}: ProfileFieldLabelProps) {
  const Tag = as;

  return (
    <Tag className="profileFieldLabelRow" htmlFor={htmlFor}>
      <span className="profileFieldLabelIcon">{ICONS[icon]}</span>
      <span className="profileFieldLabelText">{children}</span>
    </Tag>
  );
}

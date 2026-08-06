type MatchIconProps = {
  className?: string;
};

export function FreeMatchGiftIcon({ className }: MatchIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="9"
        width="18"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 9v12" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 13h18" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 9c-1.8-2.6-4.5-2.8-5.8-0.6C5.2 9.8 6.8 11.6 12 9c5.2 2.6 6.8 0.8 5.8-0.6C16.5 6.2 13.8 6.4 12 9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PaidMatchCupIcon({ className }: MatchIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 20h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 16v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 4h10v5.2c0 2.9-2.2 5.3-5 5.3s-5-2.4-5-5.3V4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 5H3.5v1.8c0 1.6 1.1 2.9 2.5 2.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M19 5h1.5v1.8c0 1.6-1.1 2.9-2.5 2.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

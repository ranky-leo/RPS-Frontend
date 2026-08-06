"use client";

import { useMemo, useState } from "react";
import "./news-modal.css";
import { resolveAvatar } from "../../lib/avatars";
import {
  extractNewsPreviewImage,
  formatNewsContentHtml,
  isHtmlNewsContent,
} from "../../lib/newsContent";
import {
  formatSeasonWinnerReward,
  getWinnerByRank,
  normalizeNewsWinners,
} from "../../lib/newsWinners";
import type { News, NewsWinner, ActiveNewsResponse } from "../../lib/types";

type NewsModalProps = {
  newsType: ActiveNewsResponse["type"];
  items: News[];
  onClose: (dismissToday: boolean) => void;
};

function splitNewsTitle(title: string) {
  const parts = title
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      eyebrow: parts[0],
      headline: parts.slice(1).join(" "),
    };
  }

  return {
    eyebrow: "Announcement",
    headline: title,
  };
}

function formatMetaDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatShortDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function splitIntroLines(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const SEASON_NEWS_ASSETS = {
  trophy: "/news/trophy-laurel.png",
  badgeGold: "/news/badge-gold.png",
  badgeSilver: "/news/badge-silver.png",
  badgeBronze: "/news/badge-bronze.png",
} as const;

function TrophyLaurelIcon() {
  return (
    <div className="newsSeasonTrophyWrap">
      <div className="newsSeasonTrophyGlow" aria-hidden="true" />
      <img
        src={SEASON_NEWS_ASSETS.trophy}
        alt=""
        className="newsSeasonTrophy"
        aria-hidden="true"
      />
    </div>
  );
}

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 13h6l8-5v16l-8-5H6V13Z"
        fill="url(#adminMegaphone)"
        stroke="rgba(255,230,160,0.5)"
      />
      <path
        d="M20 11c3 2.2 5 5.4 5 9s-2 6.8-5 9"
        stroke="#f0c85a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="4" y="12" width="3" height="8" rx="1" fill="#c8942f" />
      <defs>
        <linearGradient id="adminMegaphone" x1="6" y1="8" x2="20" y2="24">
          <stop stopColor="#ffe082" />
          <stop offset="1" stopColor="#c8942f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PodiumWinnerCard({
  winner,
  placement,
}: {
  winner: NewsWinner;
  placement: "first" | "second" | "third";
}) {
  const medalClass =
    placement === "first"
      ? "gold"
      : placement === "second"
        ? "silver"
        : "bronze";
  const badgeSrc =
    placement === "first"
      ? SEASON_NEWS_ASSETS.badgeGold
      : placement === "second"
        ? SEASON_NEWS_ASSETS.badgeSilver
        : SEASON_NEWS_ASSETS.badgeBronze;

  return (
    <article className={`newsSeasonPodiumCard ${placement}`}>
      <div className={`newsSeasonMedalHang ${medalClass}`}>
        <img
          src={badgeSrc}
          alt={`Rank ${winner.rank}`}
          className={`newsSeasonMedalBadge ${medalClass}`}
        />
      </div>
      <div className={`newsSeasonAvatarRing ${medalClass}`}>
        <img
          src={resolveAvatar(winner.avatar)}
          alt={winner.username}
          className="newsSeasonAvatar"
        />
      </div>
      <div
        className={`newsSeasonPlayerName${placement === "first" ? " featured" : ""}`}
      >
        {winner.username}
      </div>
      <div
        className={`newsSeasonStatValue ${placement === "first" ? "featured" : ""}`}
      >
        {formatSeasonWinnerReward(winner)}
      </div>
    </article>
  );
}

function WinnerListRow({ winner }: { winner: NewsWinner }) {
  return (
    <div className="newsSeasonListRow">
      <div className="newsSeasonListRank">{winner.rank}</div>
      <div className="newsSeasonListPlayer">
        <img
          src={resolveAvatar(winner.avatar)}
          alt={winner.username}
          className="newsSeasonListAvatar"
        />
        <div className="newsSeasonListCopy">
          <div className="newsSeasonListName">{winner.username}</div>
        </div>
      </div>
      <div className="newsSeasonListValue">
        {formatSeasonWinnerReward(winner)}
      </div>
    </div>
  );
}

function SeasonWinnerModal({
  news,
  eyebrow,
  headline,
  dismissToday,
  onDismissChange,
  onClose,
}: {
  news: News;
  eyebrow: string;
  headline: string;
  dismissToday: boolean;
  onDismissChange: (value: boolean) => void;
  onClose: (dismissToday: boolean) => void;
}) {
  const winners = useMemo(
    () => normalizeNewsWinners(news.winners),
    [news.winners],
  );

  const firstPlace = getWinnerByRank(winners, 1);
  const secondPlace = getWinnerByRank(winners, 2);
  const thirdPlace = getWinnerByRank(winners, 3);
  const remainingWinners = winners.filter((winner) => winner.rank >= 4);

  const introLines = useMemo(
    () => (news.content ? splitIntroLines(news.content) : []),
    [news.content],
  );

  return (
    <>
      <div className="newsSeasonFx" aria-hidden="true">
        <div className="newsSeasonStardust" />
        <div className="newsSeasonConfetti" />
        <div className="newsSeasonHeaderGlow" />
        <div className="newsSeasonGlow" />
      </div>

      <button
        className="newsModalCloseBtn"
        type="button"
        onClick={() => onClose(dismissToday)}
        aria-label="Close announcement"
      >
        ✕
      </button>

      <div className="newsSeasonInner">
        <header className="newsSeasonHeader">
          <TrophyLaurelIcon />
          <div className="newsSeasonEyebrow">{eyebrow}</div>
          <h2 className="newsSeasonHeadline">{headline}</h2>
          {introLines.length > 0 ? (
            <div className="newsSeasonIntro">
              {introLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </header>

        {firstPlace ? (
          <div className="newsSeasonPodium">
            {secondPlace ? (
              <PodiumWinnerCard winner={secondPlace} placement="second" />
            ) : (
              <div className="newsSeasonPodiumSpacer" />
            )}
            <PodiumWinnerCard winner={firstPlace} placement="first" />
            {thirdPlace ? (
              <PodiumWinnerCard winner={thirdPlace} placement="third" />
            ) : (
              <div className="newsSeasonPodiumSpacer" />
            )}
          </div>
        ) : null}

        {remainingWinners.length > 0 ? (
          <div className="newsSeasonListCard">
            {remainingWinners.map((winner) => (
              <WinnerListRow key={winner.rank} winner={winner} />
            ))}
          </div>
        ) : null}

        <div className="newsSeasonFooter">
          {news.created_at ? (
            <div className="newsSeasonExpiry">
              <span className="newsSeasonExpiryIcon" aria-hidden="true">
                🕐
              </span>
              <span>Available until {formatMetaDate(news.created_at)}</span>
            </div>
          ) : (
            <div />
          )}

          <div className="newsSeasonActions">
            <button
              className="newsSeasonLaterBtn"
              type="button"
              onClick={() => onClose(false)}
            >
              Later
            </button>
            <button
              className="newsSeasonPrimaryBtn"
              type="button"
              onClick={() => onClose(dismissToday)}
            >
              Continue
            </button>
          </div>
        </div>

        <label className="newsSeasonDismiss">
          <input
            type="checkbox"
            checked={dismissToday}
            onChange={(event) => onDismissChange(event.target.checked)}
          />
          <span className="newsSeasonDismissBox" aria-hidden="true" />
          <span>Don&apos;t show this again today</span>
        </label>
      </div>
    </>
  );
}

function AdminNewsCollapseItem({
  news,
  isOpen,
  onToggle,
}: {
  news: News;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { eyebrow, headline } = useMemo(
    () => splitNewsTitle(news.title),
    [news.title],
  );
  const isHtml = isHtmlNewsContent(news.content);
  const contentHtml = useMemo(
    () => (isHtml ? formatNewsContentHtml(news.content) : ""),
    [isHtml, news.content],
  );
  const plainIntro = useMemo(() => {
    if (isHtml) {
      return "";
    }
    return news.content.trim();
  }, [isHtml, news.content]);

  return (
    <section className={`newsAdminCollapseItem${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="newsAdminCollapseTrigger"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="newsAdminCollapseIcon" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
        <span className="newsAdminCollapseCopy">
          <span className="newsAdminCollapseEyebrow">{eyebrow}</span>
          <span className="newsAdminCollapseTitle">{headline}</span>
        </span>
        {news.created_at ? (
          <span className="newsAdminCollapseDate">
            {formatShortDate(news.created_at)}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <div className="newsAdminCollapseBody">
          {plainIntro ? <p className="newsAdminIntro">{plainIntro}</p> : null}
          {contentHtml ? (
            <div
              className="newsAdminBody newsAdminRichContent"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function AdminNewsModal({
  items,
  dismissToday,
  onDismissChange,
  onClose,
}: {
  items: News[];
  dismissToday: boolean;
  onDismissChange: (value: boolean) => void;
  onClose: (dismissToday: boolean) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(items[0]?.id ? [items[0].id] : []),
  );

  const featured = items[0];
  const featuredTitle = useMemo(
    () => (featured ? splitNewsTitle(featured.title) : null),
    [featured],
  );
  const heroImage = useMemo(
    () =>
      featured
        ? extractNewsPreviewImage(featured.content, featured.image)
        : null,
    [featured],
  );

  const toggleItem = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      <button
        className="newsModalCloseBtn newsModalCloseBtn--admin"
        type="button"
        onClick={() => onClose(dismissToday)}
        aria-label="Close announcement"
      >
        ✕
      </button>

      <div className="newsAdminSplit">
        <aside className="newsAdminVisual">
          <span className="newsAdminRibbon">NEW</span>
          {heroImage ? (
            <img src={heroImage} alt="" className="newsAdminVisualImage" />
          ) : (
            <div className="newsAdminVisualFallback" aria-hidden="true" />
          )}
          <div className="newsAdminVisualOverlay" aria-hidden="true" />
          <div className="newsAdminVisualCopy">
            {items.length > 1 ? (
              <>
                <strong>Announcements</strong>
                <span>{items.length} updates</span>
              </>
            ) : featuredTitle ? (
              <>
                <strong>{featuredTitle.eyebrow}</strong>
                <span>{featuredTitle.headline}</span>
              </>
            ) : null}
          </div>
        </aside>

        <div className="newsAdminPanel">
          <header className="newsAdminHeader">
            <div className="newsAdminMegaphone">
              <MegaphoneIcon />
            </div>
            <div className="newsAdminHeaderCopy">
              <div className="newsAdminEyebrow">
                {items.length > 1 ? "Announcements" : featuredTitle?.eyebrow}
              </div>
              <h2 className="newsAdminTitle">
                {items.length > 1
                  ? `${items.length} active announcements`
                  : featuredTitle?.headline}
              </h2>
            </div>
          </header>

          <div className="newsAdminCollapseList">
            {items.map((item) => (
              <AdminNewsCollapseItem
                key={item.id}
                news={item}
                isOpen={expandedIds.has(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </div>

          <footer className="newsAdminFooter">
            <label className="newsAdminDismiss">
              <input
                type="checkbox"
                checked={dismissToday}
                onChange={(event) => onDismissChange(event.target.checked)}
              />
              <span className="newsAdminDismissBox" aria-hidden="true" />
              <span>Don&apos;t show this again</span>
            </label>
            <button
              className="newsAdminPrimaryBtn"
              type="button"
              onClick={() => onClose(dismissToday)}
            >
              Got it!
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}

export function NewsModal({ newsType, items, onClose }: NewsModalProps) {
  const [dismissToday, setDismissToday] = useState(false);
  const seasonNews = items[0];
  const isSeasonWinner =
    newsType === "season_winner" || seasonNews?.type === "season_winner";

  const { eyebrow, headline } = useMemo(
    () => splitNewsTitle(seasonNews?.title || ""),
    [seasonNews?.title],
  );

  if (!items.length) {
    return null;
  }

  return (
    <div
      className={`backdrop newsBackdrop${isSeasonWinner ? " newsBackdrop--season" : " newsBackdrop--admin"}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose(dismissToday);
        }
      }}
    >
      <div
        className={`modal newsModalShell${isSeasonWinner ? " newsModalShell--season" : " newsModalShell--admin"}`}
        onClick={(event) => event.stopPropagation()}
      >
        {isSeasonWinner && seasonNews ? (
          <SeasonWinnerModal
            news={seasonNews}
            eyebrow={eyebrow}
            headline={headline}
            dismissToday={dismissToday}
            onDismissChange={setDismissToday}
            onClose={onClose}
          />
        ) : (
          <AdminNewsModal
            items={items}
            dismissToday={dismissToday}
            onDismissChange={setDismissToday}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

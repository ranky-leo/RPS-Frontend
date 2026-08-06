"use client";

import type { ProfileNotificationItem } from "../../hooks/useProfileNotifications";
import {
  getNotificationPresentation,
  NotificationCategoryIcon,
  renderNotificationDescription,
} from "../../lib/notificationPresentation";

type ProfileNotificationStackProps = {
  items: ProfileNotificationItem[];
  isExiting?: boolean;
};

export function ProfileNotificationStack({
  items,
  isExiting = false,
}: ProfileNotificationStackProps) {
  const item = items[0];
  if (!item) {
    return null;
  }

  const presentation = getNotificationPresentation(item.message, item.type);

  return (
    <div className="profileNotificationStack" aria-live="polite">
      <div
        key={item.id}
        className={`profileNotification profileNotification--${item.type} profileNotification--${presentation.category}${
          isExiting
            ? " profileNotification--exit"
            : " profileNotification--enter"
        }`}
        role={item.type === "error" ? "alert" : "status"}
      >
        <span
          className={`profileNotificationIconWrap profileNotificationIconWrap--${presentation.category}`}
          aria-hidden="true"
        >
          <NotificationCategoryIcon category={presentation.category} />
        </span>

        <div className="profileNotificationBody">
          <div className="profileNotificationTitle">{presentation.title}</div>
          {presentation.description ? (
            <div className="profileNotificationMessage">
              {renderNotificationDescription(presentation.description)}
            </div>
          ) : null}
        </div>

        <span className="profileNotificationDot" aria-hidden="true" />
      </div>
    </div>
  );
}

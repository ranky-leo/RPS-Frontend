import type { ProfileNotificationType } from "../hooks/useProfileNotifications";

type NotifyHandler = (message: string, type?: ProfileNotificationType) => void;

let notifyHandler: NotifyHandler | null = null;

export const registerNotifyHandler = (handler: NotifyHandler | null) => {
  notifyHandler = handler;
};

export const notifyFromApi = (message: string, type: ProfileNotificationType = "error") => {
  notifyHandler?.(message, type);
};

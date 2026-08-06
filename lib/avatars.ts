const API_BASE_ORIGIN = String(process.env.NEXT_PUBLIC_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

const MALE_AVATAR_FILES = [
  "people-man-1.jpg",
  "people-man-2.jpg",
  "people-man-3.jpg",
  "people-man-5.jpg",
  "people-man-6.jpg",
  "people-man-8.jpg",
] as const;

const FEMALE_AVATAR_FILES = [
  "people-woman-1.jpg",
  "people-woman-2.jpg",
  "people-woman-3.jpg",
  "people-woman-4.jpg",
  "people-woman-6.jpg",
  "people-woman-7.jpg",
] as const;

export const AVATAR_OPTIONS = [
  ...MALE_AVATAR_FILES.map((file, index) => ({
    id: `male-${index + 1}`,
    label: `Male ${ROMAN[index]}`,
    url: `/avatars/${file}`,
  })),
  ...FEMALE_AVATAR_FILES.map((file, index) => ({
    id: `female-${index + 1}`,
    label: `Female ${ROMAN[index]}`,
    url: `/avatars/${file}`,
  })),
] as const;

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0].url;

const isCustomAvatarDataUrl = (value?: string | null) =>
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(
    String(value || "").trim(),
  );

const isLocalPublicAvatarPath = (value?: string | null) =>
  /^\/avatars\/.+\.(png|jpe?g|webp|gif)$/i.test(String(value || "").trim());

const isBackendStoredAvatarPath = (value?: string | null) =>
  /^\/media\/(?:avatars|shop\/avatars)\/.+\.(png|jpe?g|webp|gif)$/i.test(
    String(value || "").trim(),
  );

const isExternalAvatarUrl = (value?: string | null) =>
  /^https?:\/\/.+/i.test(String(value || "").trim());

const resolveBackendAssetUrl = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!isBackendStoredAvatarPath(normalized)) {
    return normalized;
  }

  if (!API_BASE_ORIGIN) {
    return normalized;
  }

  return `${API_BASE_ORIGIN}${normalized}`;
};

export const resolveAvatar = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (isExternalAvatarUrl(normalized)) {
    return normalized;
  }

  return AVATAR_OPTIONS.some((option) => option.url === normalized) ||
    isCustomAvatarDataUrl(normalized) ||
    isLocalPublicAvatarPath(normalized) ||
    isBackendStoredAvatarPath(normalized)
    ? resolveBackendAssetUrl(normalized)
    : DEFAULT_AVATAR;
};

export const isCustomAvatarDataUrlValue = isCustomAvatarDataUrl;

export const isPremadeRpsAvatar = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }

  return (
    /\/avatars\/rps\//i.test(normalized) ||
    /\/media\/shop\/avatars\//i.test(normalized) ||
    /(?:^|\/)avatars\/rps\//i.test(normalized) ||
    /rps-\d+\.png/i.test(normalized)
  );
};

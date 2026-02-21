// Static avatar files available
const AVATAR_FILES = [
  'bantah-guys-2-2d (1).png',
  'bantah-guys-2-2d 1.png',
  'bantah-guys-2-2d 2.png',
  'bantah-guys-2-2d 3.png',
  'bantah-guys-avatar (1).png',
  'bantah-guys-avatar 1.png',
  'bantah-guys-avatar 2.png',
  'bantah-guys-avatar 3.png',
  'bantah-guys-avatar 4.png'
];

export const generateAvatar = (seed: string, size: number = 128) => {
  // Simple hash function to select avatar based on seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % AVATAR_FILES.length;
  return `/assets/avatar/${AVATAR_FILES[index]}`;
};

function looksLikeImageUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:image/")) return true;
  if (v.startsWith("/attached_assets/") || v.startsWith("/uploads/") || v.startsWith("/assets/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(v);
}

// Backward-compatible signature:
// - getAvatarUrl(userId, username)
// - getAvatarUrl(userId, username, size)
// - getAvatarUrl(userId, profileImageUrl, username)
// - getAvatarUrl(userId, profileImageUrl, username, size)
export function getAvatarUrl(
  userId: string,
  profileImageOrUsername?: string | null,
  usernameOrSize?: string | number,
  size: number = 128
): string {
  if (profileImageOrUsername && looksLikeImageUrl(profileImageOrUsername)) {
    return profileImageOrUsername;
  }

  const username =
    typeof usernameOrSize === "string"
      ? usernameOrSize
      : profileImageOrUsername || undefined;

  const resolvedSize =
    typeof usernameOrSize === "number"
      ? usernameOrSize
      : size;

  const seed = userId || username || 'default';
  return generateAvatar(seed, resolvedSize);
}

import React, { useEffect, useMemo, useState } from "react";
import { getAvatarUrl } from "@/utils/avatarUtils";
import { getUserDisplayName, usePublicUserBasic } from "@/hooks/usePublicUserBasic";

interface UserAvatarProps {
  user?: {
    id?: string;
    username?: string;
    firstName?: string;
    profileImageUrl?: string | null;
  };
  userId?: string;
  username?: string;
  firstName?: string;
  profileImageUrl?: string | null;
  seed?: string;
  src?: string;
  alt?: string;
  size?: number | "sm" | "md" | "lg";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function UserAvatar({
  user,
  userId,
  username,
  firstName,
  profileImageUrl,
  seed,
  src,
  alt,
  size = 40,
  className = "",
  onClick,
}: UserAvatarProps) {
  const [imageErrored, setImageErrored] = useState(false);

  const normalizedSize = (() => {
    if (typeof size === "number") return size;
    if (size === "sm") return 32;
    if (size === "lg") return 48;
    return 40;
  })();

  const resolvedUserId = userId || user?.id;
  const resolvedUser = usePublicUserBasic(resolvedUserId, {
    id: resolvedUserId,
    username: username || user?.username || seed || null,
    firstName: firstName || user?.firstName || null,
    profileImageUrl: src || profileImageUrl || user?.profileImageUrl || null,
  });

  const resolvedName =
    alt ||
    getUserDisplayName(
      {
        id: resolvedUserId,
        firstName: resolvedUser?.firstName ?? firstName ?? user?.firstName,
        username: resolvedUser?.username ?? username ?? user?.username ?? seed,
      },
      "user"
    );
  const resolvedImage =
    src ??
    resolvedUser?.profileImageUrl ??
    profileImageUrl ??
    user?.profileImageUrl ??
    null;

  const generatedFallback = useMemo(
    () => getAvatarUrl(resolvedUserId || "", null, resolvedName),
    [resolvedUserId, resolvedName]
  );

  const avatarUrl = imageErrored
    ? generatedFallback
    : getAvatarUrl(resolvedUserId || "", resolvedImage || undefined, resolvedName);

  useEffect(() => {
    setImageErrored(false);
  }, [resolvedImage, resolvedUserId, resolvedName]);

  return (
    <img
      src={avatarUrl}
      alt={`${resolvedName} avatar`}
      width={normalizedSize}
      height={normalizedSize}
      className={`rounded-full ${className}`}
      onClick={onClick}
      onError={() => setImageErrored(true)}
    />
  );
}

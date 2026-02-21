import { getUserDisplayName, getUserHandle, usePublicUserBasic } from "@/hooks/usePublicUserBasic";

interface UserDisplayNameProps {
  userId?: string;
  username?: string;
  firstName?: string;
  fallback?: string;
  asHandle?: boolean;
  className?: string;
}

export function UserDisplayName({
  userId,
  username,
  firstName,
  fallback = "unknown",
  asHandle = false,
  className,
}: UserDisplayNameProps) {
  const resolvedUser = usePublicUserBasic(userId, {
    id: userId,
    username: username || null,
    firstName: firstName || null,
  });

  const text = asHandle
    ? getUserHandle(resolvedUser, fallback)
    : getUserDisplayName(resolvedUser, fallback);

  return <span className={className}>{text}</span>;
}

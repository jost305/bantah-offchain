import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SocialMediaShare } from "@/components/SocialMediaShare";
import {
  MessageCircle,
  Check,
  X,
  Eye,
  Trophy,
  Share2,
  Zap,
  Lock,
  Pin,
  Hourglass,
} from "lucide-react";
import { CompactShareButton } from "@/components/ShareButton";
import { shareChallenge } from "@/utils/sharing";
import { UserAvatar } from "@/components/UserAvatar";
import { getUserDisplayName, getUserHandle } from "@/hooks/usePublicUserBasic";
import { useLocation } from "wouter";
import { useState } from "react";
import ProfileCard from "@/components/ProfileCard";
import { AcceptChallengeModal } from "@/components/AcceptChallengeModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ChallengeCardProps {
  challenge: {
    id: number;
    challenger: string;
    challenged: string;
    title: string;
    description?: string;
    category: string;
    amount: string;
    status: string;
    result?: string;
    challengerSide?: string;
    challengedSide?: string;
    dueDate?: string;
    createdAt: string;
    adminCreated?: boolean;
    bonusSide?: string;
    bonusMultiplier?: string;
    bonusEndsAt?: string;
    bonusAmount?: number; // Custom bonus amount in naira
    yesStakeTotal?: number;
    noStakeTotal?: number;
    coverImageUrl?: string;
    participantCount?: number;
    commentCount?: number;
    participantPreviewUsers?: Array<{
      id: string;
      username?: string | null;
      firstName?: string | null;
      profileImageUrl?: string | null;
      side?: string | null;
    }>;
    earlyBirdSlots?: number;
    earlyBirdBonus?: number;
    streakBonusEnabled?: boolean;
    convictionBonusEnabled?: boolean;
    firstTimeBonusEnabled?: boolean;
    socialTagBonus?: number;
    challengerUser?: {
      id: string;
      firstName?: string;
      lastName?: string;
      username?: string;
      profileImageUrl?: string;
    };
    challengedUser?: {
      id: string;
      firstName?: string;
      lastName?: string;
      username?: string;
      profileImageUrl?: string;
    };
    isPinned?: boolean;
    community?: {
      programId?: number;
      name?: string | null;
      slug?: string | null;
      logoUrl?: string | null;
      badgeText?: string | null;
    };
  };
  onChatClick?: (challenge: any) => void;
  onJoin?: (challenge: any) => void;
}

export function ChallengeCard({
  challenge,
  onChatClick,
  onJoin,
}: ChallengeCardProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated, login, user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);

  const effectiveStatus = (() => {
    const rawStatus = String(challenge.status || "").toLowerCase();
    if (challenge.adminCreated) return rawStatus || "open";

    const challenged = typeof (challenge as any).challenged === "string"
      ? String((challenge as any).challenged).trim()
      : (challenge as any).challenged;
    const hasDesignatedOpponent = !!challenged;

    if (rawStatus === "open" || rawStatus === "pending") {
      return hasDesignatedOpponent ? "pending" : "open";
    }

    return rawStatus || "pending";
  })();

  const handleAvatarClick = (e: React.MouseEvent, profileId: string | undefined) => {
    if (challenge.adminCreated || !profileId) return;
    e.stopPropagation();

    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to view user profiles",
      });
      login();
      return;
    }

    setSelectedProfileId(profileId);
    setShowProfileModal(true);
  };

  // Check if bonus is active
  const isBonusActive =
    challenge.bonusEndsAt && new Date(challenge.bonusEndsAt) > new Date();

  const getBonusBadge = () => {
    const bonuses: any[] = [];
    
    // Original weak side bonus
    if (isBonusActive && challenge.bonusSide) {
      const amount = challenge.bonusAmount ? `₦${challenge.bonusAmount.toLocaleString()}` : `${challenge.bonusMultiplier}x`;
      bonuses.push({
        type: "weak_side",
        label: amount,
        icon: <Zap className="w-3 h-3" />,
        side: challenge.bonusSide,
        description: `Bonus for ${challenge.bonusSide} side`
      });
    }

    // Early Bird
    if (challenge.earlyBirdSlots && challenge.earlyBirdSlots > 0) {
      bonuses.push({
        type: "early_bird",
        label: "Early",
        icon: <Zap className="w-3 h-3" />,
        description: `Bonus for first ${challenge.earlyBirdSlots} users`
      });
    }

    // Streak
    if (challenge.streakBonusEnabled) {
      bonuses.push({
        type: "streak",
        label: "Streak",
        icon: <Trophy className="w-3 h-3" />,
        description: "Win streak bonus active"
      });
    }

    return bonuses;
  };

  const activeBonuses = getBonusBadge();

  // Generate sharing data for the challenge
  const challengeShareData = shareChallenge(
    challenge.id.toString(),
    challenge.title,
    challenge.amount,
  );

  const acceptChallengeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/challenges/${challenge.id}/accept`);
    },
    onSuccess: () => {
      try {
        sessionStorage.setItem(`challenge_accepted_${challenge.id}`, new Date().toISOString());
      } catch {
        // non-fatal; continue with redirect
      }
      toast({
        title: "Challenge Accepted",
        description: "Redirecting to chat...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      // Redirect to chat page after successful accept
      setTimeout(() => {
        navigate(`/challenges/${challenge.id}/chat?accepted=1`);
      }, 450);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const declineChallengeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/challenges/${challenge.id}`, {
        status: "cancelled",
      });
    },
    onSuccess: () => {
      toast({
        title: "Challenge Declined",
        description: "You have declined the challenge.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pinChallengeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/challenges/${challenge.id}/pin`, {
        pin: !challenge.isPinned
      });
    },
    onSuccess: () => {
      toast({
        title: challenge.isPinned ? "Unpinned" : "Pinned",
        description: challenge.isPinned ? "Challenge unpinned from top" : "Challenge pinned to top",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isEnded = effectiveStatus === 'completed' || (challenge.dueDate && new Date(challenge.dueDate).getTime() <= Date.now());
  const isFinishedChallengeCard =
    isEnded ||
    effectiveStatus === "completed" ||
    effectiveStatus === "cancelled" ||
    effectiveStatus === "disputed";

  const getStatusBadge = (status: string) => {
    if (challenge.adminCreated) {
      if (status === "pending_admin" || status === "active") {
        return (
          <Badge className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
            Awaiting Result
          </Badge>
        );
      }
      if (status === "completed") {
        return (
          <Badge className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
            Ended
          </Badge>
        );
      }
      return null;
    }

    switch (status) {
      // Pending status is intentionally not shown as a badge to avoid
      // confusing users — newly created challenges are already 'created'.
      // case "pending":
      //   return (
      //     <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
      //       Pending
      //     </Badge>
      //   );
      case "active":
        return (
          <Badge className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
            {isFinishedChallengeCard ? "Ended" : "Live"}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
            Ended
          </Badge>
        );
      case "disputed":
        return (
          <Badge className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
            Disputed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
            Cancelled
          </Badge>
        );
      case "pending_admin":
        return (
          <Badge className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 flex items-center gap-1 w-fit">
            <Hourglass className="w-3 h-3" />
            Payout
          </Badge>
        );
      default:
        return null;
    }
  };

  // Check if current user is a participant in this challenge
  const isMyChallenge =
    user?.id === challenge.challenger || user?.id === challenge.challenged;

  // Display challenger vs challenged format for all challenges
  // For admin-created open challenges with no users, show "Open Challenge"
  const isOpenAdminChallenge =
    challenge.adminCreated &&
    effectiveStatus === "open" &&
    !challenge.challenger &&
    !challenge.challenged;

  const challengerName =
    getUserDisplayName({
      id: challenge.challengerUser?.id,
      firstName: challenge.challengerUser?.firstName,
      username: challenge.challengerUser?.username,
    }, "challenger");
  const hasChallengedProfile = !!(
    challenge.challengedUser?.id ||
    challenge.challengedUser?.username ||
    challenge.challengedUser?.firstName ||
    challenge.challengedUser?.lastName
  );
  const challengedName =
    (hasChallengedProfile
      ? getUserDisplayName({
          id: challenge.challengedUser?.id,
          firstName: challenge.challengedUser?.firstName,
          username: challenge.challengedUser?.username,
        }, "opponent")
      : null) || "opponent";
  const challengerHandle = getUserHandle({
    id: challenge.challengerUser?.id,
    username: challenge.challengerUser?.username,
    firstName: challenge.challengerUser?.firstName,
  }, "challenger");
  const challengedHandle = getUserHandle({
    id: challenge.challengedUser?.id,
    username: challenge.challengedUser?.username,
    firstName: challenge.challengedUser?.firstName,
  }, "opponent");
  
  // Show challenge title for all challenges - avatar pair at bottom shows who has joined
  const isOpenChallenge = effectiveStatus === "open";
  const displayName = challenge.title;
  const communityName = typeof challenge.community?.name === "string" ? challenge.community.name.trim() : "";
  const communityLogoUrl = typeof challenge.community?.logoUrl === "string" ? challenge.community.logoUrl.trim() : "";
  const communityBadgeTextRaw = typeof challenge.community?.badgeText === "string" ? challenge.community.badgeText.trim() : "";
  const communityBadgeText = (communityBadgeTextRaw || communityName.slice(0, 2) || "CM").toUpperCase().slice(0, 4);
  const hasCommunityMeta = !!(communityName || communityBadgeTextRaw || communityLogoUrl);
  const communityDisplayName = communityName || `Community ${communityBadgeText}`;

  // For avatar, show the other user (opponent) if current user is involved, otherwise show challenger
  const otherUser =
    user?.id === challenge.challenger
      ? challenge.challengedUser
      : user?.id === challenge.challenged
        ? challenge.challengerUser
        : challenge.challengerUser;
  const timeAgo = formatDistanceToNow(new Date(challenge.createdAt), {
    addSuffix: true,
  });

  // Helper function to get status text for the card
  const getStatusText = () => {
    switch (effectiveStatus) {
      case "pending":
        return "Waiting for your response";
      case "active":
        return "Challenge in progress";
      case "completed":
        return "Challenge concluded";
      case "disputed":
        return "Challenge disputed";
      case "cancelled":
        return "Challenge cancelled";
      case "pending_admin":
        return "Processing payout";
      default:
        return effectiveStatus;
    }
  };

  // Helper function for compact time format
  const getCompactTimeAgo = (date: string) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks}w`;
  };

  const isHeadToHeadMatched = !challenge.adminCreated && !!challenge.challenger && !!challenge.challenged;
  const hasJoined = user?.id === challenge.challenger || user?.id === challenge.challenged;
  const isAwaitingAcceptance = effectiveStatus === "open" || effectiveStatus === "pending";
  const challengedId = typeof (challenge as any).challenged === "string"
    ? String((challenge as any).challenged).trim()
    : (challenge as any).challenged;
  const hasDesignatedOpponent = !!challengedId;
  const showWaitingOpponent =
    !challenge.adminCreated &&
    effectiveStatus === "open" &&
    !hasDesignatedOpponent &&
    !hasChallengedProfile;
  const canAcceptChallenge =
    !challenge.adminCreated &&
    !isEnded &&
    isAwaitingAcceptance &&
    !hasJoined &&
    (!hasDesignatedOpponent || (user && user.id === challengedId));

  // Normalize challenger/challenged side fields (support multiple possible field names)
  const challengerSideRaw = (challenge.challengerSide || (challenge as any).challenger_side || (challenge as any).challengerChoice || (challenge as any).challenger_choice) ?? null;
  const challengedSideRaw = (challenge.challengedSide || (challenge as any).challenged_side || (challenge as any).challengedChoice || (challenge as any).challenged_choice) ?? null;
  let challengerSide = challengerSideRaw ? String(challengerSideRaw).trim().toUpperCase() : null;
  let challengedSide = challengedSideRaw ? String(challengedSideRaw).trim().toUpperCase() : null;

  // Backfill side display for legacy rows where only one side is stored.
  if (!challengerSide && (challengedSide === "YES" || challengedSide === "NO")) {
    challengerSide = challengedSide === "YES" ? "NO" : "YES";
  }
  if (!challengedSide && (challengerSide === "YES" || challengerSide === "NO") && !!challenge.challenged) {
    challengedSide = challengerSide === "YES" ? "NO" : "YES";
  }

  if (challengerSide !== "YES" && challengerSide !== "NO") challengerSide = null;
  if (challengedSide !== "YES" && challengedSide !== "NO") challengedSide = null;

  const isValidParticipantId = (id: unknown): id is string => {
    if (typeof id !== "string") return false;
    const normalized = id.trim().toLowerCase();
    return normalized.length > 0 && normalized !== "null" && normalized !== "undefined";
  };
  const adminPreviewUsers = Array.isArray(challenge.participantPreviewUsers)
    ? challenge.participantPreviewUsers
        .filter((p) => p && isValidParticipantId(p.id))
        .filter((p, index, arr) => arr.findIndex((entry) => entry.id === p.id) === index)
        .slice(0, 2)
    : [];
  const adminDisplayedUsers = adminPreviewUsers;
  const normalizedParticipantCount = Number.isFinite(Number(challenge.participantCount))
    ? Number(challenge.participantCount)
    : 0;
  const adminParticipantCount = Math.max(
    normalizedParticipantCount,
    adminDisplayedUsers.length,
  );
  const adminRenderedPreviewCount = adminDisplayedUsers.length > 0 ? adminDisplayedUsers.length : (adminParticipantCount > 0 ? 1 : 0);
  const adminExtraCount = Math.max(adminParticipantCount - adminRenderedPreviewCount, 0);

  const normalizedResult = String(challenge.result || "").toLowerCase();
  const challengerIsWinner = normalizedResult === "challenger_won";
  const challengedIsWinner = normalizedResult === "challenged_won";

  // Do not make the whole card clickable. Only the action buttons (Join, Chat, Share)
  // should be interactive to avoid accidental opens of modals or chat.
  const cardClickProps = {};

  return (
    <Card
      className="border border-slate-200 dark:border-slate-600 theme-transition h-full overflow-hidden"
      {...cardClickProps}
    >
      <CardContent className="p-2 md:p-3 flex flex-col h-full">
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <div className="flex items-start space-x-2 min-w-0 flex-1">
            {/* Show cover art for all challenges */}
            {challenge.coverImageUrl ? (
              <div className="flex items-center flex-shrink-0">
                <img
                  src={challenge.coverImageUrl}
                  alt="challenge cover"
                  className="w-9 h-9 md:w-10 md:h-10 rounded-md object-cover"
                />
              </div>
            ) : (
              <div className="flex items-center flex-shrink-0">
                <img
                  src="/assets/bantahblue.svg"
                  alt="platform"
                  className="w-9 h-9 md:w-10 md:h-10"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {isFinishedChallengeCard ? (
                <span className="block font-bold text-xs md:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 mb-0 text-left w-full max-h-10 md:max-h-12 overflow-hidden">
                  {String(challenge.title)}
                </span>
              ) : (
                <button
                  onClick={() => navigate(`/challenges/${challenge.id}/activity`)}
                  className="font-bold text-xs md:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 mb-0 hover:text-primary dark:hover:text-primary/80 transition-colors text-left w-full max-h-10 md:max-h-12 overflow-hidden"
                  data-testid="link-challenge-detail"
                >
                  {String(challenge.title)}
                </button>
              )}
              <div className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                <span className="uppercase">{getCompactTimeAgo(challenge.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 flex-wrap">
            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5">
              {effectiveStatus === "open" && isEnded && (
                <Badge className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-none text-[10px] px-2 py-0.5">
                  Ended
                </Badge>
              )}
              {effectiveStatus !== "open" && getStatusBadge(effectiveStatus)}
              {canAcceptChallenge && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAcceptModal(true);
                  }}
                  className="text-[10px] px-2 py-0.5 ml-1 rounded border border-transparent bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  Accept
                </button>
              )}
              {/* P2P badge removed - UI simplified */}
              {/* Bonus badges - show right before share icon */}
              {activeBonuses.map((bonus, idx) => (
                <Badge key={idx} variant="secondary" className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-none px-1.5 py-0.5">
                  {bonus.icon}
                  <span className="ml-0.5 font-bold">{bonus.label}</span>
                </Badge>
              ))}
            </div>
            {/* Admin pin button */}
            {(user as any)?.isAdmin && challenge.adminCreated && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  pinChallengeMutation.mutate();
                }}
                data-testid="button-pin-challenge"
                className="text-primary hover:scale-110 transition-transform flex-shrink-0"
                title={challenge.isPinned ? "Unpin from top" : "Pin to top"}
              >
                <Pin className={`h-4 w-4 ${challenge.isPinned ? "fill-current" : ""}`} />
              </button>
            )}
            {/* Always show share button */}
            <div onClick={(e) => e.stopPropagation()}>
              <CompactShareButton
                shareData={challengeShareData.shareData}
                className="text-primary h-4 w-4 hover:scale-110 transition-transform flex-shrink-0"
              />
            </div>
          </div>
        </div>

        <div className="mb-2">
          {!challenge.adminCreated ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 rounded-lg py-2 px-3 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center relative">
                    <UserAvatar 
                      userId={challenge.challengerUser?.id || ""} 
                      username={challenge.challengerUser?.username || challengerName}
                      firstName={challenge.challengerUser?.firstName}
                      profileImageUrl={challenge.challengerUser?.profileImageUrl}
                      size={36}
                      className={`w-9 h-9 ring-2 ring-white dark:ring-slate-800 shadow-sm ${!challenge.adminCreated ? 'cursor-pointer hover:opacity-80' : ''}`}
                      onClick={(e) => handleAvatarClick(e, challenge.challengerUser?.id)}
                    />
                    {challengerSide && (
                      <span className={`absolute -top-1 -right-1 text-[9px] px-1 py-0.5 rounded-full font-bold ${challengerSide === 'YES' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                        {challengerSide}
                      </span>
                    )}
                    {isFinishedChallengeCard && challengerIsWinner && (
                      <span className="absolute -bottom-1 -right-1 text-[7px] px-1 py-[1px] rounded-full font-black bg-amber-400 text-black border border-white dark:border-slate-900 leading-none">
                        WIN
                      </span>
                    )}
                    <div className="mt-1 flex items-center gap-1 max-w-[60px]">
                      <span className="text-[8px] font-semibold text-slate-500 truncate max-w-[48px]">{challengerHandle}</span>
                      <span
                        className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-sky-100 dark:bg-sky-900/40 text-[7px] font-black text-sky-700 dark:text-sky-300 flex-shrink-0"
                        title="Challenger"
                        aria-label="Challenger"
                      >
                        C
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 italic uppercase leading-none">VS</span>
                  </div>

                  <div className="flex flex-col items-center relative">
                    {showWaitingOpponent ? (
                      <div className="w-9 h-9 ring-2 ring-white dark:ring-slate-800 shadow-sm rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
                        ?
                      </div>
                    ) : (
                      <UserAvatar
                        userId={challenge.challengedUser?.id || ""}
                        username={challenge.challengedUser?.username || challengedName}
                        firstName={challenge.challengedUser?.firstName}
                        profileImageUrl={challenge.challengedUser?.profileImageUrl}
                        size={36}
                        className={`w-9 h-9 ring-2 ring-white dark:ring-slate-800 shadow-sm ${!challenge.adminCreated ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={(e) => handleAvatarClick(e, challenge.challengedUser?.id)}
                      />
                    )}
                    {!showWaitingOpponent && challengedSide && (
                      <span className={`absolute -top-1 -right-1 text-[9px] px-1 py-0.5 rounded-full font-bold ${challengedSide === 'YES' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                        {challengedSide}
                      </span>
                    )}
                    {isFinishedChallengeCard && challengedIsWinner && !showWaitingOpponent && (
                      <span className="absolute -bottom-1 -right-1 text-[7px] px-1 py-[1px] rounded-full font-black bg-amber-400 text-black border border-white dark:border-slate-900 leading-none">
                        WIN
                      </span>
                    )}
                    <span className="text-[8px] font-semibold text-slate-500 mt-1 truncate max-w-[56px]">
                      {showWaitingOpponent ? "waiting" : challengedHandle}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {/* Regular Admin Challenges: Show Yes/No buttons */}
              {effectiveStatus === 'open' && (
                <div className="flex flex-row items-center justify-center h-10 gap-2 w-full">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if ((challenge.status !== "completed" && challenge.status !== "ended") && !hasJoined) {
                        onJoin?.({ ...challenge, selectedSide: "yes" });
                      }
                    }}
                    disabled={challenge.status === "completed" || challenge.status === "ended" || hasJoined}
                    className={`flex items-center justify-center text-sm font-bold rounded-lg py-2 flex-1 transition-opacity ${
                      (challenge.status !== "completed" && challenge.status !== "ended") && !hasJoined
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/20 hover:opacity-80 cursor-pointer"
                        : "text-emerald-600/40 dark:text-emerald-400/40 bg-emerald-500/5 dark:bg-emerald-500/10 cursor-not-allowed"
                    }`}
                    data-testid="button-challenge-yes"
                  >
                    Yes
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if ((challenge.status !== "completed" && challenge.status !== "ended") && !hasJoined) {
                        onJoin?.({ ...challenge, selectedSide: "no" });
                      }
                    }}
                    disabled={challenge.status === "completed" || challenge.status === "ended" || hasJoined}
                    className={`flex items-center justify-center text-sm font-bold rounded-lg py-2 flex-1 transition-opacity ${
                      (challenge.status !== "completed" && challenge.status !== "ended") && !hasJoined
                        ? "text-red-600 dark:text-red-400 bg-red-500/15 dark:bg-red-500/20 hover:opacity-80 cursor-pointer"
                        : "text-red-600/40 dark:text-red-400/40 bg-red-500/5 dark:bg-red-500/10 cursor-not-allowed"
                    }`}
                    data-testid="button-challenge-no"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 mb-1.5">
          <Badge variant="outline" className="flex flex-col items-center py-0.5 px-2 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 rounded-lg h-auto min-w-[60px] shadow-sm">
            <span className="text-[8px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-tight mb-0">Stake</span>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none">₦{(parseFloat(String(challenge.amount)) || 0).toLocaleString()}</span>
          </Badge>
          <Badge variant="outline" className="flex flex-col items-center py-0.5 px-2 bg-emerald-50/40 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/50 rounded-lg h-auto min-w-[60px] shadow-sm">
            <span className="text-[8px] text-emerald-600/70 dark:text-emerald-400/70 uppercase font-bold tracking-tight mb-0">Win</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 leading-none">₦{(Math.round((parseFloat(String(challenge.amount)) || 0) * 2 * (parseFloat(String(challenge.bonusMultiplier || "1.00")) || 1))).toLocaleString()}</span>
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            {/* Only show chat count for admin-created challenges */}
            {challenge.adminCreated && (
              <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                   onClick={(e) => {
                     e.stopPropagation();
                     if (onChatClick) onChatClick({ ...challenge, amount: String(challenge.amount) });
                   }}>
                <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold">
                  {challenge.commentCount ?? 0}
                </span>
              </div>
            )}

            {/* Only show participant avatars and count for admin-created challenges */}
            {challenge.adminCreated && (
              <div className="flex items-center gap-0.5 bg-slate-100/50 dark:bg-slate-800/50 px-1.5 py-1 rounded-full">
                <div className="flex items-center -space-x-1.5">
                  {adminDisplayedUsers.length === 0 && adminParticipantCount > 0 && (
                    <div className="relative flex-shrink-0">
                      <UserAvatar
                        seed={`participants-${challenge.id}`}
                        username="participant"
                        size={16}
                        className="w-4 h-4 ring-1 ring-white dark:ring-slate-800"
                      />
                    </div>
                  )}

                  {adminDisplayedUsers.map((participant, index) => {
                    const participantSideRaw = participant.side ? String(participant.side).toUpperCase() : null;
                    const participantSide = participantSideRaw === "YES" || participantSideRaw === "NO" ? participantSideRaw : null;
                    return (
                      <div key={`${participant.id}-${index}`} className="relative flex-shrink-0">
                        <UserAvatar
                          userId={participant.id}
                          username={participant.username || undefined}
                          firstName={participant.firstName || undefined}
                          profileImageUrl={participant.profileImageUrl || undefined}
                          size={16}
                          className="w-4 h-4 ring-1 ring-white dark:ring-slate-800"
                        />
                        {participantSide && (
                          <span className={`absolute -top-1 -right-1 text-[6px] leading-none px-1 py-[1px] rounded-full font-bold ${participantSide === 'YES' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                            {participantSide}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {adminExtraCount > 0 && (
                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 ring-1 ring-white dark:ring-slate-800 flex items-center justify-center -ml-1">
                      <span className="text-[7px] font-bold text-slate-600 dark:text-slate-400">
                        +{adminExtraCount}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold ml-1">
                  {adminParticipantCount}
                </span>
              </div>
            )}
          </div>
          {hasCommunityMeta && (
            <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 max-w-[48%]">
              <span className="relative inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600 text-[7px] font-black text-slate-800 dark:text-slate-200 overflow-hidden flex-shrink-0">
                <span>{communityBadgeText}</span>
                {communityLogoUrl && (
                  <img
                    src={communityLogoUrl}
                    alt={`${communityDisplayName} badge`}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
              </span>
              <span className="text-[10px] font-semibold truncate">
                {communityDisplayName}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      {showProfileModal && selectedProfileId && (
        <ProfileCard 
          userId={selectedProfileId} 
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {!challenge.adminCreated && (
        <AcceptChallengeModal
          isOpen={showAcceptModal}
          onClose={() => setShowAcceptModal(false)}
          challenge={challenge}
          onAccept={() => acceptChallengeMutation.mutateAsync()}
          isSubmitting={acceptChallengeMutation.isPending}
        />
      )}
    </Card>
  );
}

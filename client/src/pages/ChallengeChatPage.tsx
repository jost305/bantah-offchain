import { useParams } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ProfileCard from "@/components/ProfileCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getChallengeChannel } from "@/lib/pusher";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Users, Activity, Send, Trophy, DollarSign, UserPlus, Zap, Heart, Share2, Reply, ArrowLeft, Lock, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/UserAvatar";
import P2PChallengeTradePanel from "@/components/P2PChallengeTradePanel";
import { JoinChallengeModal } from "@/components/JoinChallengeModal";

interface ExtendedMessage {
  id: string;
  challengeId: number;
  userId: string;
  message: string;
  createdAt: string;
  type?: 'system' | 'user';
  user: {
    id: string;
    username?: string;
    firstName?: string;
    profileImageUrl?: string;
  };
}

interface ActivityEvent {
  id: string;
  user?: {
    id: string;
    username?: string;
    firstName?: string;
    avatarUrl?: string;
    profileImageUrl?: string;
  };
  action: string;
  createdAt: string;
}

interface Challenge {
  id: number;
  challenger?: string;
  challenged?: string;
  challengerSide?: string;
  challengedSide?: string;
  challenger_side?: string;
  challenged_side?: string;
  challengerChoice?: string;
  challengedChoice?: string;
  challenger_choice?: string;
  challenged_choice?: string;
  title: string;
  description?: string;
  category: string;
  amount: string;
  dueDate: string;
  coverImageUrl?: string;
  status: string;
  adminCreated?: boolean;
  challengerUser?: {
    id: string;
    username?: string;
    firstName?: string;
    profileImageUrl?: string;
  };
  challengedUser?: {
    id: string;
    username?: string;
    firstName?: string;
    profileImageUrl?: string;
  };
}

export default function ChallengeChatPage() {
  const params = useParams();
  const challengeId = params.id ? parseInt(params.id) : null;
  const { user, isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'comments' | 'matches' | 'activity'>('comments');
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showHeaderProofMenu, setShowHeaderProofMenu] = useState(false);
  const [countdownNowMs, setCountdownNowMs] = useState<number>(() => Date.now());
  const [showUpDownJoinModal, setShowUpDownJoinModal] = useState(false);
  const [upDownJoinSide, setUpDownJoinSide] = useState<"YES" | "NO">("YES");
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<"+$1" | "+$5" | "+$10" | "+$100" | "Max" | null>(null);
  const quickAmountOptions: Array<"+$1" | "+$5" | "+$10" | "+$100" | "Max"> = ["+$1", "+$5", "+$10", "+$100", "Max"];
  const [upDownStakeAmount, setUpDownStakeAmount] = useState<number>(0);

  const getRelativeTime = (value: unknown, fallback = "just now") => {
    if (!value) return fallback;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return fallback;
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const getDisplayName = (input?: {
    firstName?: string;
    username?: string;
    id?: string;
  } | null, fallback = "unknown") => {
    if (!input) return fallback;
    return input.firstName || input.username || (input.id ? `user_${input.id.slice(-6)}` : fallback);
  };

  const normalizeSide = (value: unknown): "YES" | "NO" | null => {
    if (!value) return null;
    const normalized = String(value).trim().toUpperCase();
    return normalized === "YES" || normalized === "NO" ? normalized : null;
  };
  const isBtcUpDownChallenge = (input?: Partial<Challenge> | null) => {
    if (!input) return false;
    const title = String(input.title || "").toLowerCase();
    const category = String(input.category || "").toLowerCase();
    return (
      category === "crypto" &&
      (title.includes("bitcoin") || title.includes("btc")) &&
      (
        title.includes("up or down") ||
        title.includes("up/down") ||
        (title.includes("up") && title.includes("down"))
      )
    );
  };
  const renderSideLabel = (side: "YES" | "NO" | null, asUpDown: boolean) => {
    if (!side) return null;
    if (!asUpDown) return side;
    return side === "YES" ? "UP" : "DOWN";
  };

  const formatGameEndsCountdown = (value: unknown): string => {
    if (!value) return "Game ends in --";
    const dueMs = new Date(String(value)).getTime();
    if (Number.isNaN(dueMs)) return "Game ends in --";
    const remainingMs = dueMs - countdownNowMs;
    if (remainingMs <= 0) return "Game ended";
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `Game ends in ${hours}h:${minutes}m:${seconds}s`;
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Determine if current user is a participant in the challenge
  const { data: challenge } = useQuery<Challenge>({
    queryKey: [`/api/challenges/${challengeId}`],
    enabled: !!challengeId,
    retry: false,
  });
  const isBtcUpDownMarket = isBtcUpDownChallenge(challenge);
  const isAdminUpDownMarket = isBtcUpDownMarket && challenge?.adminCreated === true;
  const minUpDownStakeAmount = Math.max(1, Number.parseInt(String(challenge?.amount || "0"), 10) || 0);
  const normalizedChallengeStatus = String(challenge?.status || "").toLowerCase();
  const challengeDueDateMs = challenge?.dueDate ? new Date(String(challenge.dueDate)).getTime() : NaN;
  const isChallengeEndedForActions =
    !!challenge &&
    (
      ["completed", "ended", "cancelled", "disputed"].includes(normalizedChallengeStatus) ||
      (Number.isFinite(challengeDueDateMs) && challengeDueDateMs <= countdownNowMs)
    );

  useEffect(() => {
    if (!isAdminUpDownMarket) return;
    setUpDownStakeAmount(minUpDownStakeAmount);
    setSelectedQuickAmount(null);
  }, [challenge?.id, isAdminUpDownMarket, minUpDownStakeAmount]);

  useEffect(() => {
    if (!isAdminUpDownMarket) return;
    const params = new URLSearchParams(window.location.search);
    const side = String(params.get("side") || "").toUpperCase();
    if (side === "YES" || side === "NO") {
      setUpDownJoinSide(side);
    }
  }, [challenge?.id, isAdminUpDownMarket]);
  
  const isAdminChallenge = challenge?.adminCreated === true;
  const isMatchedUserChallenge = !!(
    !isAdminChallenge &&
    challenge?.challenger &&
    challenge?.challenged
  );
  const isParticipant = !!(
    user &&
    challenge &&
    (
      user.id === challenge.challengerUser?.id ||
      user.id === challenge.challengedUser?.id ||
      user.id === challenge.challenger ||
      user.id === challenge.challenged
    )
  );

  // Non-admin challenges (direct + open) use private chat for participants only.
  // Admin challenges expose public comments.
  const canAccessChat = !isAdminChallenge && isParticipant;
  const canAccessComments = isAdminChallenge;
  const isPrivateTradeChallenge = challenge?.adminCreated === false;

  const opponentUser =
    user?.id === challenge?.challenger || user?.id === challenge?.challengerUser?.id
      ? challenge?.challengedUser
      : challenge?.challengerUser;
  const opponentName =
    opponentUser?.firstName ||
    opponentUser?.username ||
    (challenge?.challengedUser?.firstName || challenge?.challengedUser?.username ? undefined : "Counterparty");
  const isCurrentUserChallenger = !!(
    user &&
    challenge &&
    (
      user.id === challenge.challengerUser?.id ||
      user.id === challenge.challenger
    )
  );
  const myVoteChoice = isCurrentUserChallenger ? "challenger" : "challenged";
  const opponentVoteChoice = isCurrentUserChallenger ? "challenged" : "challenger";
  const creatorUser = challenge?.challengerUser;
  const creatorSidePrimary = normalizeSide(
    challenge?.challengerSide ??
    challenge?.challenger_side ??
    challenge?.challengerChoice ??
    challenge?.challenger_choice
  );
  const challengedSideNormalized = normalizeSide(
    challenge?.challengedSide ??
    challenge?.challenged_side ??
    challenge?.challengedChoice ??
    challenge?.challenged_choice
  );
  const creatorSide =
    creatorSidePrimary ||
    (challengedSideNormalized ? (challengedSideNormalized === "YES" ? "NO" : "YES") : null);
  const creatorSideLabel = renderSideLabel(creatorSide, isBtcUpDownMarket);
  const creatorIsOpponent = !!(creatorUser?.id && creatorUser.id === opponentUser?.id);
  const [btcSeries, setBtcSeries] = useState<number[]>([]);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [btcPriceToBeat, setBtcPriceToBeat] = useState<number | null>(null);
  const [btcFeedLoading, setBtcFeedLoading] = useState(false);
  const [btcFeedError, setBtcFeedError] = useState<string | null>(null);
  const roundDurationMs = 5 * 60 * 1000;
  const currentRoundStartMs = Math.floor(countdownNowMs / roundDurationMs) * roundDurationMs;
  const currentRoundEndMs = currentRoundStartMs + roundDurationMs;
  const upDownRemainingMs = Math.max(currentRoundEndMs - countdownNowMs, 0);
  const upDownMinutes = Math.floor(upDownRemainingMs / 60000);
  const upDownSeconds = Math.floor((upDownRemainingMs % 60000) / 1000);
  const upDownCountdown = `${String(upDownMinutes).padStart(2, "0")}m ${String(upDownSeconds).padStart(2, "0")}s`;
  const formatUsd = (value: number | null) => {
    if (!Number.isFinite(value ?? NaN)) return "--";
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const formatEtDate = (ms: number) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "long",
      day: "numeric",
    }).format(new Date(ms));
  const formatEtTime = (ms: number) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .format(new Date(ms))
      .replace(" ", "");
  const upDownWindowLabel = `${formatEtDate(currentRoundStartMs)}, ${formatEtTime(currentRoundStartMs)}-${formatEtTime(currentRoundEndMs)} ET`;
  const upDownDirectionLabel = (() => {
    if (btcPriceToBeat === null || btcPrice === null) return "--";
    return btcPrice >= btcPriceToBeat ? "UP" : "DOWN";
  })();
  const btcSparklinePath = (() => {
    if (btcSeries.length < 2) return "";
    const min = Math.min(...btcSeries);
    const max = Math.max(...btcSeries);
    const range = Math.max(max - min, 1);
    return btcSeries
      .map((value, index) => {
        const x = (index / (btcSeries.length - 1)) * 100;
        const y = 40 - ((value - min) / range) * 40;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  })();

  useEffect(() => {
    if (!isAdminUpDownMarket) {
      setBtcSeries([]);
      setBtcPrice(null);
      setBtcPriceToBeat(null);
      setBtcFeedError(null);
      setBtcFeedLoading(false);
      return;
    }

    let cancelled = false;

    const loadBtc = async () => {
      try {
        setBtcFeedLoading(true);
        const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=60");
        if (!response.ok) {
          throw new Error(`BTC feed unavailable (${response.status})`);
        }
        const raw = await response.json();
        if (!Array.isArray(raw)) {
          throw new Error("Invalid BTC feed payload");
        }

        const candles = raw
          .map((item: any) => ({
            openTime: Number(item?.[0]),
            closeTime: Number(item?.[6]),
            open: Number(item?.[1]),
            close: Number(item?.[4]),
          }))
          .filter((item: any) =>
            Number.isFinite(item.openTime) &&
            Number.isFinite(item.closeTime) &&
            Number.isFinite(item.open) &&
            Number.isFinite(item.close),
          );

        if (candles.length === 0) {
          throw new Error("No BTC candles available");
        }

        const latestClose = candles[candles.length - 1].close;
        const roundCandle =
          candles.find((candle: any) => candle.openTime === currentRoundStartMs) ||
          candles.find((candle: any) => candle.openTime <= currentRoundStartMs && currentRoundStartMs < candle.closeTime) ||
          candles[candles.length - 1];

        if (!cancelled) {
          setBtcSeries(candles.slice(-30).map((item: any) => item.close));
          setBtcPrice(latestClose);
          setBtcPriceToBeat(roundCandle?.open ?? null);
          setBtcFeedError(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setBtcFeedError(error?.message || "Live BTC feed unavailable");
        }
      } finally {
        if (!cancelled) {
          setBtcFeedLoading(false);
        }
      }
    };

    loadBtc();
    const interval = window.setInterval(loadBtc, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAdminUpDownMarket, currentRoundStartMs]);
  
  // Keep the selected tab valid as access context changes.
  useEffect(() => {
    if (!challenge) return;
    if (!isAdminChallenge && !isParticipant && activeTab === 'comments') {
      setActiveTab('matches');
    }
  }, [challenge, isAdminChallenge, isParticipant, activeTab]);

  useEffect(() => {
    if (!challengeId) return;
    const storageKey = `challenge_accepted_${challengeId}`;
    const acceptedFromStorage = (() => {
      try {
        return !!sessionStorage.getItem(storageKey);
      } catch {
        return false;
      }
    })();
    const url = new URL(window.location.href);
    const acceptedFromQuery = url.searchParams.get("accepted") === "1";

    if (acceptedFromStorage || acceptedFromQuery) {
      toast({
        title: "Challenge accepted",
        description: "You can now chat privately with your opponent.",
      });
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore storage cleanup failures
      }
      if (acceptedFromQuery) {
        url.searchParams.delete("accepted");
        const qs = url.searchParams.toString();
        window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
      }
    }
  }, [challengeId, toast]);

  const messagesQueryKey = [`/api/challenges/${challengeId}/messages`];
  const { data: messages = [], refetch: refetchMessages } = useQuery<ExtendedMessage[]>({
    queryKey: messagesQueryKey,
    enabled: !!challengeId && (canAccessChat || canAccessComments),
    retry: false,
  });

  const { data: matches = [], refetch: refetchMatches } = useQuery<any[]>({
    queryKey: [`/api/challenges/${challengeId}/matches`],
    queryFn: async () => {
      if (!challengeId) return [];
      const res = await fetch(`/api/challenges/${challengeId}/matches`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!challengeId,
    retry: false,
  });

  const { data: activityEvents = [] } = useQuery<ActivityEvent[]>({
    queryKey: [`/api/challenges/${challengeId}/activity`],
    enabled: !!challengeId,
    retry: false,
  });
  const { data: walletBalance = 0 } = useQuery<number>({
    queryKey: ["/api/wallet/balance"],
    enabled: !!user?.id,
    retry: false,
    refetchInterval: 5000,
  });

  const handleQuickAmountPick = (option: "+$1" | "+$5" | "+$10" | "+$100" | "Max") => {
    setSelectedQuickAmount(option);
    setUpDownStakeAmount((prev) => {
      const current = prev > 0 ? prev : minUpDownStakeAmount;
      if (option === "Max") {
        const maxFromWallet = Math.floor(Number(walletBalance || 0));
        return maxFromWallet > 0 ? maxFromWallet : current;
      }
      const increment = Number.parseInt(option.replace("+$", ""), 10);
      if (!Number.isFinite(increment) || increment <= 0) return current;
      return current + increment;
    });
  };
  useEffect(() => {
    if (!challengeId) return;
    
    const channel = getChallengeChannel(challengeId);
    
    // Listen for new messages in real-time
    channel.bind('new-message', () => {
      refetchMessages();
    });

    return () => {
      channel.unbind('new-message');
      channel.unsubscribe();
    };
  }, [challengeId, refetchMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string }) => {
      return await apiRequest("POST", `/api/challenges/${challengeId}/messages`, messageData);
    },
    onMutate: async (messageData: { message: string }) => {
      const trimmedMessage = messageData.message.trim();
      if (!trimmedMessage || !challengeId || !user?.id) {
        return { previousMessages: [] as ExtendedMessage[], sentMessage: messageData.message };
      }

      await queryClient.cancelQueries({ queryKey: messagesQueryKey });
      const previousMessages = queryClient.getQueryData<ExtendedMessage[]>(messagesQueryKey) || [];

      const optimisticMessage: ExtendedMessage = {
        id: `tmp-${Date.now()}`,
        challengeId,
        userId: user.id,
        message: trimmedMessage,
        createdAt: new Date().toISOString(),
        type: "user",
        user: {
          id: user.id,
          username: (user as any)?.username || undefined,
          firstName: (user as any)?.firstName || undefined,
          profileImageUrl: (user as any)?.profileImageUrl || undefined,
        },
      };

      queryClient.setQueryData<ExtendedMessage[]>(messagesQueryKey, [
        ...previousMessages,
        optimisticMessage,
      ]);

      setNewMessage("");
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);

      return { previousMessages, sentMessage: messageData.message };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessages);
      }
      if (context?.sentMessage) {
        setNewMessage(context.sentMessage);
      }
      toast({
        title: "Message failed",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      refetchMessages();
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  // --- Proof upload and voting ---
  const apiFetch = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  useEffect(() => {
    // Ensure signing keypair exists and is registered when component mounts
    (async () => {
      try {
        const { ensureKeypairRegistered } = await import('@/lib/signing');
        await ensureKeypairRegistered(apiFetch);
      } catch (err) {
        // non-fatal
      }
    })();
  }, []);

  const handleUploadProof = async (file: File) => {
    // Upload to server image endpoint
    const form = new FormData();
    form.append('image', file);
    const res = await fetch('/api/upload/image', { method: 'POST', credentials: 'include', body: form });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    // compute sha256
    const arrayBuffer = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    // register proof record
    await apiFetch(`/api/challenges/${challengeId}/proofs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proofUri: data.imageUrl, proofHash: hashHex })
    });
    return { uri: data.imageUrl, hash: hashHex };
  };

  const handleVote = async (voteChoice: string) => {
    if (!isParticipant) return alert('Only participants can vote');
    try {
      // Ask user to pick proof file (simple prompt for demo)
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.onchange = async () => {
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        const proof = await handleUploadProof(file);

        // Sign vote using stored key
        const kpRaw = localStorage.getItem('challenge_signing_keypair_v1');
        if (!kpRaw) return alert('No signing keypair found');
        const kp = JSON.parse(kpRaw);
        const timestamp = Date.now();
        const nonce = Math.random().toString(36).slice(2);
        const message = `${challengeId}:${voteChoice}:${proof.hash}:${timestamp}:${nonce}`;
        const { signVote } = await import('@/lib/signing');
        const signature = signVote(kp.secretKey, message);

        const signedVote = JSON.stringify({ signature, timestamp, nonce });

        await apiFetch(`/api/challenges/${challengeId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voteChoice, proofHash: proof.hash, signedVote })
        });

        alert('Vote submitted');
      };
      input.click();
    } catch (err: any) {
      console.error('Vote failed', err);
      alert('Vote failed: ' + (err.message || err));
    }
  };

  const handleOpenDispute = async () => {
    if (!challengeId || !isParticipant) return;
    const reason = window.prompt("State your dispute reason (optional):") || undefined;
    try {
      await apiFetch(`/api/challenges/${challengeId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      toast({
        title: "Dispute opened",
        description: "Admin review has been requested.",
      });
    } catch (err: any) {
      toast({
        title: "Dispute failed",
        description: err?.message || "Could not open dispute.",
        variant: "destructive",
      });
    }
  };

  const submitSignedVote = async (voteChoice: string, proofHash: string) => {
    const kpRaw = localStorage.getItem('challenge_signing_keypair_v1');
    if (!kpRaw) {
      throw new Error('No signing keypair found');
    }
    const kp = JSON.parse(kpRaw);
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).slice(2);
    const message = `${challengeId}:${voteChoice}:${proofHash}:${timestamp}:${nonce}`;
    const { signVote } = await import('@/lib/signing');
    const signature = signVote(kp.secretKey, message);
    const signedVote = JSON.stringify({ signature, timestamp, nonce });

    await apiFetch(`/api/challenges/${challengeId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteChoice, proofHash, signedVote }),
    });
  };

  const handleQuickVote = async (voteChoice: string) => {
    if (!challengeId || !user?.id || !isParticipant) return;
    try {
      const res = await fetch(`/api/challenges/${challengeId}/proofs`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to load proofs');
      }
      const proofs = await res.json();
      const ownProofs = (Array.isArray(proofs) ? proofs : []).filter((p: any) => {
        const ownerId = p?.participant_id ?? p?.participantId ?? p?.userId;
        return ownerId === user.id;
      });
      ownProofs.sort((a: any, b: any) => {
        const aTime = new Date(a?.uploaded_at ?? a?.uploadedAt ?? 0).getTime();
        const bTime = new Date(b?.uploaded_at ?? b?.uploadedAt ?? 0).getTime();
        return bTime - aTime;
      });
      const latestProof = ownProofs[0];
      const proofHash = latestProof?.proof_hash ?? latestProof?.proofHash;
      if (!proofHash) {
        toast({
          title: 'Proof required',
          description: 'Upload proof first using the Proof button.',
          variant: 'destructive',
        });
        return;
      }

      await submitSignedVote(voteChoice, proofHash);
      toast({
        title: 'Vote submitted',
        description: 'Your vote has been recorded.',
      });
    } catch (err: any) {
      toast({
        title: 'Vote failed',
        description: err?.message || 'Could not submit vote.',
        variant: 'destructive',
      });
    }
  };

  const handleReportChallenge = async () => {
    if (!challengeId || !isParticipant) return;
    const reason = window.prompt("State your report reason (optional):") || "";
    if (reason === null) return;
    const reportReason = reason.trim() ? `REPORT: ${reason.trim()}` : "REPORT";
    try {
      await apiFetch(`/api/challenges/${challengeId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason }),
      });
      toast({
        title: "Report submitted",
        description: "Admin review has been requested.",
      });
    } catch (err: any) {
      toast({
        title: "Report failed",
        description: err?.message || "Could not submit report.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = () => {
    const message = newMessage.trim();
    if (!message) return;
    sendMessageMutation.mutate({ message });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLikeMessage = (messageId: string) => {
    setLikedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleReplyMessage = (messageId: string) => {
    setReplyingTo(replyingTo === messageId ? null : messageId);
  };

  const handleShareMessage = (messageId: string, messageText: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      const shareText = `"${messageText}"\n- ${message.user?.username || message.user?.firstName || `user_${message.userId?.slice(-8) || 'unknown'}`}`;
      if (navigator.share) {
        navigator.share({
          title: 'Shared from Challenge',
          text: shareText
        }).catch(() => {});
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
          alert('Message copied to clipboard!');
        }).catch(() => {
          alert('Copy to clipboard failed');
        });
      }
    }
  };

  if (!challengeId) return <div className="flex items-center justify-center h-[100dvh]">Challenge Not Found</div>;
  if (!challenge) return <div className="flex items-center justify-center h-[100dvh] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">Loading challenge...</div>;

  if (isPrivateTradeChallenge) {
    const stakeAmount = parseFloat(String(challenge?.amount || 0)) || 0;
    const potentialWin = stakeAmount * 2;
    const handleBack = () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/challenges";
      }
    };

    return (
      <>
        <style>{`
          nav { display: none !important; }
        `}</style>
      <div className="h-[100dvh] min-h-[100dvh] bg-slate-50 dark:bg-slate-900 theme-transition overflow-hidden">
        <div className="h-full max-w-6xl mx-auto flex flex-col overflow-hidden">
          <div className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={handleBack}
                  className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                </button>
                <UserAvatar
                  userId={opponentUser?.id || ""}
                  username={opponentUser?.username || opponentName}
                  firstName={opponentUser?.firstName}
                  profileImageUrl={opponentUser?.profileImageUrl}
                  size={34}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                    <span className="truncate">{opponentName || "Counterparty"}</span>
                    {creatorIsOpponent && creatorSideLabel && (
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${creatorSide === "YES" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                        {creatorSideLabel}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      p2p
                    </span>
                    <span>•</span>
                    <span className="truncate">{challenge?.title || "Challenge Chat"}</span>
                    {!creatorIsOpponent && creatorSideLabel && (
                      <>
                        <span>•</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${creatorSide === "YES" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                          {creatorSideLabel}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="sm:hidden space-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold">Stake:</span> NGN {stakeAmount.toLocaleString()}</p>
                  <p><span className="font-semibold">Win:</span> NGN {potentialWin.toLocaleString()}</p>
                  <p>{formatGameEndsCountdown(challenge?.dueDate)}</p>
                </div>
                <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Countdown</div>
                  <div>{formatGameEndsCountdown(challenge?.dueDate)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 px-3 sm:px-4 py-2 grid grid-cols-1 xl:grid-cols-[270px_1fr] gap-2">
            <aside className="hidden xl:flex flex-col gap-1.5">
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-amber-500/10" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Order Summary</p>
                    <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      live
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900 p-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Stake</p>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">NGN {stakeAmount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/20 p-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Potential Win</p>
                      <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">NGN {potentialWin.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900 px-2 py-1">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Category</span>
                    <span className="rounded-full bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200 capitalize">
                      {challenge?.category || "general"}
                    </span>
                  </div>
                </div>
              </div>

              {isMatchedUserChallenge && isParticipant && (
                <P2PChallengeTradePanel
                  challengeId={challengeId}
                  challenge={challenge}
                  compact={true}
                  hideVotingSection={true}
                  hideProofSection={true}
                  quickVote={{
                    onMyVote: () => handleQuickVote(myVoteChoice),
                    onOppVote: () => handleQuickVote(opponentVoteChoice),
                    myLabel: "I Won",
                    oppLabel: "Opp Won",
                  }}
                  userRole={user?.id === challenge?.challengerUser?.id ? 'challenger' : 'challenged'}
                  onVote={() => {
                    const voteChoice = user?.id === challenge?.challengerUser?.id ? 'challenger' : 'challenged';
                    handleVote(voteChoice);
                  }}
                />
              )}

              <div id="activity-section" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-0.5">Recent Activity</p>
                {activityEvents.length === 0 ? (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">No activity yet.</p>
                ) : (
                  <div className="space-y-0.5">
                    {activityEvents.slice(0, 2).map((event) => (
                      <div key={event.id} className="text-[10px] rounded-lg bg-slate-50 dark:bg-slate-900 p-1">
                        <p className="text-slate-700 dark:text-slate-200">
                          {event.user?.firstName || event.user?.username || "System"}: {event.action}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{getRelativeTime(event.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  onClick={handleOpenDispute}
                  disabled={!isParticipant}
                  className="h-8 px-2 text-xs border-slate-300 dark:border-slate-600"
                >
                  Dispute
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReportChallenge}
                  disabled={!isParticipant}
                  className="h-8 px-2 text-xs border-slate-300 dark:border-slate-600"
                >
                  Report
                </Button>
              </div>
            </aside>

            <section className="min-h-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col overflow-hidden">
              <div className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                <div className="xl:hidden relative flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="capitalize">{challenge?.category || "general"}</span>
                  <span>•</span>
                  <button
                    onClick={handleOpenDispute}
                    disabled={!isParticipant}
                    className="underline underline-offset-2 disabled:no-underline disabled:opacity-50"
                  >
                    Dispute
                  </button>
                  {isMatchedUserChallenge && isParticipant && (
                    <>
                      <span>•</span>
                      <button
                        onClick={() => handleQuickVote(myVoteChoice)}
                        className="h-6 px-1.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-semibold"
                      >
                        I Won
                      </button>
                      <button
                        onClick={() => handleQuickVote(opponentVoteChoice)}
                        className="h-6 px-1.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-semibold"
                      >
                        Opp Won
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setShowHeaderProofMenu((v) => !v)}
                          className="h-6 px-1.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-semibold"
                        >
                          Proof
                        </button>
                        {showHeaderProofMenu && (
                          <div className="absolute right-0 mt-1 w-[min(92vw,340px)] max-h-[65svh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl z-20 p-1.5">
                            <P2PChallengeTradePanel
                              challengeId={challengeId}
                              challenge={challenge}
                              compact={true}
                              hideVotingSection={true}
                              userRole={user?.id === challenge?.challengerUser?.id ? 'challenger' : 'challenged'}
                              onVote={() => {
                                const voteChoice = user?.id === challenge?.challengerUser?.id ? 'challenger' : 'challenged';
                                handleVote(voteChoice);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
                <div className="flex items-center gap-1.5 mb-1">
                  <Pin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Pinned Info</span>
                </div>
                {activityEvents.length === 0 ? (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">No activity yet.</p>
                ) : (
                  <div className="space-y-1">
                    {activityEvents.slice(0, 2).map((event) => (
                      <div key={event.id} className="text-[11px]">
                        <p className="text-slate-700 dark:text-slate-200">
                          {event.user ? getDisplayName({
                            firstName: event.user.firstName,
                            username: event.user.username,
                            id: event.user.id,
                          }, "System") : "System"}: {event.action}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{getRelativeTime(event.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 space-y-3 bg-slate-50 dark:bg-slate-900/40">
                {!canAccessChat ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-sm px-2">
                      <Lock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Private Conversation</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Only the challenger and accepted opponent can view and send messages here.
                      </p>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <MessageCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-700 dark:text-slate-300">No messages yet</p>
                      <p className="text-xs text-slate-500 mt-1">Start the challenge conversation.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((m: ExtendedMessage) => {
                    const isMe = m.userId === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[88%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          {!isMe && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 ml-1">
                              {getDisplayName({ firstName: m.user?.firstName, username: m.user?.username, id: m.userId })}
                            </span>
                          )}
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                              isMe
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-md'
                            }`}
                          >
                            {m.message}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 px-1">{getRelativeTime(m.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}

                <div ref={messagesEndRef} />
              </div>

              {isAuthenticated && canAccessChat && (
                <div
                  className="px-3 sm:px-4 pt-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Type your message..."
                      className="rounded-full bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600"
                    />
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="rounded-full"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {selectedProfileUserId && <ProfileCard userId={selectedProfileUserId} onClose={() => setSelectedProfileUserId(null)} />}
        </div>
      </div>
      </>
    );
  }
  return (
    <>
    <div className="h-[calc(100dvh-3rem)] md:h-[calc(100dvh-4rem)] min-h-[calc(100dvh-3rem)] md:min-h-[calc(100dvh-4rem)] overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className={`h-full flex flex-col overflow-hidden ${isAdminUpDownMarket ? "max-w-6xl" : "max-w-4xl"} mx-auto w-full`}>
        {/* Challenge Banner */}
        {challenge && (
          isAdminUpDownMarket ? (
            <div className="mx-2 mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-amber-500 text-white text-xl font-black flex items-center justify-center shadow-sm flex-shrink-0">
                      ₿
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                        {challenge.title}
                      </h1>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{upDownWindowLabel}</p>
                    </div>
                  </div>
                  {isChallengeEndedForActions ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold px-2 py-1">
                      ENDED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-1">
                      <span className="relative inline-flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      LIVE
                    </span>
                  )}
                </div>
              </div>

              <div className="px-3 sm:px-4 py-3">
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-3">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="uppercase tracking-wide">price to beat</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{formatUsd(btcPriceToBeat)}</span>
                    </div>
                    <div className="mt-1.5 flex items-end justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">current price</p>
                        <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">{formatUsd(btcPrice)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">countdown</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">{upDownCountdown}</p>
                      </div>
                    </div>
                    <div className="mt-2 h-12 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1">
                      {btcSparklinePath ? (
                        <svg viewBox="0 0 100 40" className="w-full h-full">
                          <path
                            d={btcSparklinePath}
                            fill="none"
                            stroke={upDownDirectionLabel === "UP" ? "#16a34a" : upDownDirectionLabel === "DOWN" ? "#dc2626" : "#64748b"}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <div className="h-full rounded bg-slate-100 dark:bg-slate-700" />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      {btcFeedLoading ? "Loading live BTC feed..." : (btcFeedError ? "Live BTC feed unavailable right now." : "Resolution: UP when close >= open, else DOWN.")}
                    </p>
                  </div>

                  <aside className="hidden xl:flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setUpDownJoinSide("YES")}
                        disabled={isChallengeEndedForActions}
                        className={`h-10 rounded-full border text-sm font-bold transition-colors ${
                          upDownJoinSide === "YES"
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpDownJoinSide("NO")}
                        disabled={isChallengeEndedForActions}
                        className={`h-10 rounded-full border text-sm font-bold transition-colors ${
                          upDownJoinSide === "NO"
                            ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300"
                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Down
                      </button>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-end">
                      <div className="w-36">
                        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">NGN</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={upDownStakeAmount > 0 ? upDownStakeAmount : ""}
                            disabled={isChallengeEndedForActions}
                            onChange={(e) => {
                              const nextValue = Number.parseInt(e.target.value, 10);
                              setSelectedQuickAmount(null);
                              if (!Number.isFinite(nextValue) || nextValue <= 0) {
                                setUpDownStakeAmount(0);
                                return;
                              }
                              setUpDownStakeAmount(nextValue);
                            }}
                            className="h-6 border-0 bg-transparent p-0 text-right text-base font-black text-slate-900 dark:text-slate-100 focus-visible:ring-0 focus-visible:ring-offset-0"
                            aria-label="Trade amount in NGN"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-5 gap-1">
                      {quickAmountOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleQuickAmountPick(option)}
                          disabled={isChallengeEndedForActions}
                          className={`h-7 rounded-md border text-[11px] font-bold transition-colors ${
                            selectedQuickAmount === option
                              ? "border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                          aria-label={`Quick amount ${option}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>

                    <Button
                      className="mt-4 h-11 text-sm font-bold"
                      disabled={isChallengeEndedForActions}
                      onClick={() => {
                        if (isChallengeEndedForActions) {
                          toast({
                            title: "Challenge ended",
                            description: "New entries are closed while participants wait for resolution.",
                          });
                          return;
                        }
                        if (!isAuthenticated) {
                          login();
                          return;
                        }
                        const effectiveStake = upDownStakeAmount > 0 ? upDownStakeAmount : minUpDownStakeAmount;
                        if (effectiveStake < minUpDownStakeAmount) {
                          toast({
                            title: "Invalid amount",
                            description: `Minimum entry is NGN ${minUpDownStakeAmount.toLocaleString()}`,
                            variant: "destructive",
                          });
                          return;
                        }
                        setShowUpDownJoinModal(true);
                      }}
                    >
                      {isChallengeEndedForActions ? "Ended" : (isAuthenticated ? "Trade Now" : "Sign in to trade")}
                    </Button>
                  </aside>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-24 sm:h-28 bg-gradient-to-b from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 overflow-hidden rounded-lg mx-2 mt-2">
              {challenge.coverImageUrl ? (
                <img
                  src={challenge.coverImageUrl}
                  alt={challenge.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Trophy className="w-8 h-8 text-white mx-auto mb-2 opacity-80" />
                    <p className="text-white text-xs opacity-70">Challenge</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 dark:bg-black/40 rounded-lg"></div>

              <div className="absolute inset-0 flex flex-col justify-between p-2 sm:p-3">
                <div className="text-white drop-shadow-lg">
                  <h1 className="text-sm sm:text-base font-bold truncate">{challenge.title}</h1>
                </div>
                <div className="text-white drop-shadow-lg text-[10px] sm:text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-white/20 px-2 py-0.5 rounded-full capitalize">{challenge.category}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold">₦{parseInt(challenge.amount).toLocaleString()}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full capitalize">{challenge.status}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full">
                      {getRelativeTime(challenge.dueDate, "time unknown")}
                    </span>
                  </div>
                  {challenge.description && (
                    <p className="text-white/80 line-clamp-1">{challenge.description}</p>
                  )}
                </div>
              </div>
            </div>
          )
        )}
        
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
            <TabsList className={`grid ${canAccessChat || canAccessComments ? 'grid-cols-3' : 'grid-cols-2'} w-full bg-transparent p-0 rounded-none`}>
              {/* Chat tab for P2P challenges OR Comments tab for Admin challenges */}
              {(canAccessChat || canAccessComments) && (
                <TabsTrigger 
                  value="comments" 
                  className="flex items-center gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-500 py-2 text-slate-600 dark:text-slate-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">{canAccessComments ? 'Comments' : 'Chat'}</span>
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="matches" 
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-500 py-2 text-slate-600 dark:text-slate-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 transition-all"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Matches</span>
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-500 py-2 text-slate-600 dark:text-slate-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 transition-all"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
            {(canAccessChat || canAccessComments) && (
            <TabsContent value="comments" className="m-0 p-4 h-full flex flex-col data-[state=inactive]:hidden">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
                    <p>No messages yet. Be the first to talk!</p>
                  </div>
                ) : (
                  messages.map((m: ExtendedMessage) => {
                    const isMe = m.userId === user?.id;
                    return (
                      <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isMe && (
                          <div className="flex-shrink-0">
                            <UserAvatar
                              userId={m.userId}
                              username={m.user?.username}
                              firstName={m.user?.firstName}
                              profileImageUrl={m.user?.profileImageUrl}
                              size={32}
                            />
                          </div>
                        )}
                        <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && (
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 ml-1">
                              {getDisplayName({ firstName: m.user?.firstName, username: m.user?.username, id: m.userId })}
                            </span>
                          )}
                          <div className={`p-3 rounded-2xl shadow-sm group hover:shadow-md transition-shadow ${
                            isMe 
                              ? 'bg-blue-500 text-white rounded-tr-none' 
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'
                          }`}>
                            <p className="text-sm break-words">{m.message}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {getRelativeTime(m.createdAt)}
                            </span>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleReplyMessage(m.id)}
                                className={`p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors ${
                                  replyingTo === m.id ? 'bg-blue-200 dark:bg-blue-900' : ''
                                }`}
                                title="Reply"
                              >
                                <Reply className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                              </button>
                              <button 
                                onClick={() => handleLikeMessage(m.id)}
                                className={`p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors ${
                                  likedMessages.has(m.id) ? 'bg-red-200 dark:bg-red-900' : ''
                                }`}
                                title="Like"
                              >
                                <Heart className={`w-3 h-3 ${
                                  likedMessages.has(m.id) ? 'fill-red-500 text-red-500' : 'text-slate-700 dark:text-slate-300'
                                }`} />
                              </button>
                              <button 
                                onClick={() => handleShareMessage(m.id, m.message)}
                                className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors"
                                title="Share"
                              >
                                <Share2 className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </TabsContent>
            )}

            <TabsContent value="matches" className="m-0 p-4 h-full data-[state=inactive]:hidden overflow-y-auto">
                  {/* Voting UI for participants when active */}
                  {isParticipant && challenge?.status === 'active' && (
                    <div className="p-3 mb-3 flex gap-2">
                      <Button onClick={() => handleVote('challenger')} className="bg-green-600">Vote Challenger</Button>
                      <Button onClick={() => handleVote('challenged')} className="bg-red-600">Vote Opponent</Button>
                    </div>
                  )}
              {(!matches || matches.length === 0) ? (
                <div className="text-center text-slate-500 py-20">
                  <Users className="w-12 h-12 mb-4 mx-auto opacity-20" />
                  <p>No active matches for this challenge yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((m: any) => {
                    const user = m.user;
                    const matched = m.matchedWithUser;
                    return (
                      <div key={m.entry?.id || m.entry?.userId || Math.random()} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            userId={user?.id}
                            username={user?.username}
                            firstName={user?.firstName}
                            profileImageUrl={user?.profileImageUrl}
                            size={40}
                          />
                          <div className="flex flex-col">
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                              {getDisplayName({ firstName: user?.firstName, username: user?.username, id: user?.id })}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Matched with</div>
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                              {matched?.firstName || matched?.username || 'Opponent'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="m-0 p-4 h-full data-[state=inactive]:hidden overflow-y-auto">
              {activityEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Activity className="w-12 h-12 mb-4 opacity-20" />
                  <p>No activity yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activityEvents.map((event: ActivityEvent) => {
                    const getActivityIcon = () => {
                      if (event.action.includes('created challenge')) {
                        return <Zap className="w-4 h-4 text-blue-500" />;
                      } else if (event.action.includes('added') && event.action.includes('bonus')) {
                        return <Trophy className="w-4 h-4 text-yellow-500" />;
                      } else if (event.action.includes('awaiting participants')) {
                        return <Users className="w-4 h-4 text-slate-400" />;
                      } else if (event.action.includes('defeated') || event.action.includes('Winner')) {
                        return <Trophy className="w-4 h-4 text-yellow-500" />;
                      } else if (event.action.includes('Payout') || event.action.includes('coins')) {
                        return <DollarSign className="w-4 h-4 text-green-500" />;
                      } else if (event.action.includes('joined')) {
                        return <UserPlus className="w-4 h-4 text-blue-500" />;
                      } else if (event.action.includes('matched')) {
                        return <Zap className="w-4 h-4 text-purple-500" />;
                      }
                      return <Activity className="w-4 h-4 text-slate-400" />;
                    };

                    return (
                      <div key={event.id} className="flex gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
                        <div className="flex-shrink-0 flex items-start pt-1">
                          {event.user ? (
                            <UserAvatar
                              userId={event.user.id}
                              username={event.user.username}
                              firstName={event.user.firstName}
                              profileImageUrl={event.user.profileImageUrl || event.user.avatarUrl}
                              size={32}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                              {getActivityIcon()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 dark:text-slate-100">
                            {event.user ? (
                              <>
                                <span className="font-medium">
                                  {getDisplayName({ firstName: event.user.firstName, username: event.user.username, id: event.user.id })}
                                </span>{' '}
                                <span className="text-slate-600 dark:text-slate-400">{event.action}</span>
                              </>
                            ) : (
                              <span className="text-slate-600 dark:text-slate-400 italic">{event.action}</span>
                            )}
                          </p>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                            {getRelativeTime(event.createdAt)}
                          </span>
                        </div>
                        <div className="flex-shrink-0">
                          {getActivityIcon()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {isAuthenticated && activeTab === 'comments' && (canAccessChat || canAccessComments) && (
          <div
            className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2 shrink-0"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            {/* P2P Challenge: Show proof upload + voting only for participants */}
            {isMatchedUserChallenge && isParticipant && (
              <div className="mb-2">
                {/* P2P Trade Panel - Bybit-style */}
                <P2PChallengeTradePanel
                  challengeId={challengeId!}
                  challenge={challenge}
                  userRole={user?.id === challenge?.challengerUser?.id ? 'challenger' : 'challenged'}
                  onVote={() => {
                    const voteChoice = user?.id === challenge?.challengerUser?.id ? 'challenger' : 'challenged';
                    handleVote(voteChoice);
                  }}
                />
              </div>
            )}
            {replyingTo && (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500 rounded">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Replying to: {getDisplayName(messages.find(m => m.id === replyingTo)?.user)}
                </span>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  x
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message..."
                  className="pr-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                />
              </div>
              <Button 
                size="icon" 
                onClick={handleSendMessage} 
                disabled={!newMessage.trim()}
                className="rounded-full shadow-lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        
        {selectedProfileUserId && <ProfileCard userId={selectedProfileUserId} onClose={() => setSelectedProfileUserId(null)} />}
        {isAdminUpDownMarket && (
          <JoinChallengeModal
            isOpen={showUpDownJoinModal}
            onClose={() => setShowUpDownJoinModal(false)}
            challenge={{
              id: challenge.id,
              title: challenge.title,
              category: challenge.category,
              amount: String(upDownStakeAmount > 0 ? upDownStakeAmount : minUpDownStakeAmount),
              description: challenge.description,
              selectedSide: upDownJoinSide,
            }}
            userBalance={Number(walletBalance || 0)}
          />
        )}
      </div>
    </div>
    </>
  );
}


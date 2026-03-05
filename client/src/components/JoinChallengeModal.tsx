import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Zap, Trophy } from "lucide-react";

interface JoinChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: {
    id: number;
    title: string;
    category: string;
    amount: string | number;
    description?: string;
    selectedSide?: string;
    status?: string;
    dueDate?: string;
  };
  userBalance: number;
}

function normalizeSide(value?: string): "YES" | "NO" | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized === "YES" || normalized === "NO" ? normalized : null;
}

export function JoinChallengeModal({
  isOpen,
  onClose,
  challenge,
  userBalance,
}: JoinChallengeModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSide, setSelectedSide] = useState<"YES" | "NO" | null>(normalizeSide(challenge.selectedSide));
  const [isWaiting, setIsWaiting] = useState(false);
  const [btcSeries, setBtcSeries] = useState<number[]>([]);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [btcDelta, setBtcDelta] = useState<number | null>(null);
  const [btcLoading, setBtcLoading] = useState(false);
  const [btcError, setBtcError] = useState<string | null>(null);

  const challengeTitleLower = String(challenge.title || "").toLowerCase();
  const isUpDownMarket =
    String(challenge.category || "").toLowerCase() === "crypto" &&
    (challengeTitleLower.includes("bitcoin") || challengeTitleLower.includes("btc")) &&
    (
      challengeTitleLower.includes("up or down") ||
      challengeTitleLower.includes("up/down") ||
      (challengeTitleLower.includes("up") && challengeTitleLower.includes("down"))
    );
  const positiveSideLabel = isUpDownMarket ? "UP" : "YES";
  const negativeSideLabel = isUpDownMarket ? "DOWN" : "NO";

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSide(normalizeSide(challenge.selectedSide));
  }, [challenge.id, challenge.selectedSide, isOpen]);

  useEffect(() => {
    if (!isOpen || !isUpDownMarket) {
      setBtcSeries([]);
      setBtcPrice(null);
      setBtcDelta(null);
      setBtcError(null);
      setBtcLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchBtcData = async () => {
      try {
        setBtcLoading(true);
        const response = await fetch(
          "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=20",
        );
        if (!response.ok) {
          throw new Error(`BTC feed unavailable (${response.status})`);
        }

        const raw = await response.json();
        if (!Array.isArray(raw)) {
          throw new Error("Invalid BTC feed payload");
        }

        const closes = raw
          .map((item: any) => Number(item?.[4]))
          .filter((value: number) => Number.isFinite(value));

        if (closes.length < 2) {
          throw new Error("Insufficient BTC data");
        }

        const latest = closes[closes.length - 1];
        const previous = closes[closes.length - 2];

        if (!isCancelled) {
          setBtcSeries(closes);
          setBtcPrice(latest);
          setBtcDelta(latest - previous);
          setBtcError(null);
        }
      } catch (error: any) {
        if (!isCancelled) {
          setBtcError(error?.message || "Live BTC feed unavailable");
        }
      } finally {
        if (!isCancelled) {
          setBtcLoading(false);
        }
      }
    };

    fetchBtcData();
    const interval = setInterval(fetchBtcData, 15000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isOpen, isUpDownMarket]);

  const stakeAmount = Number.parseInt(String(challenge.amount || "0"), 10) || 0;
  const potentialWin = stakeAmount * 2;
  const normalizedBalance = Number(userBalance || 0);
  const isChallengeEnded = (() => {
    const status = String(challenge.status || "").toLowerCase();
    if (["completed", "ended", "cancelled", "disputed"].includes(status)) {
      return true;
    }
    if (!challenge.dueDate) return false;
    const dueMs = new Date(challenge.dueDate).getTime();
    if (Number.isNaN(dueMs)) return false;
    return dueMs <= Date.now();
  })();
  const sparklinePath = (() => {
    if (btcSeries.length < 2) return "";
    const min = Math.min(...btcSeries);
    const max = Math.max(...btcSeries);
    const range = Math.max(max - min, 1);
    return btcSeries
      .map((value, index) => {
        const x = (index / (btcSeries.length - 1)) * 100;
        const y = 24 - ((value - min) / range) * 24;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  })();

  const getCategoryEmoji = (category: string) => {
    const cats: Record<string, string> = {
      crypto: "BTC",
      sports: "SPORT",
      gaming: "GAME",
      music: "MUSIC",
      politics: "POL",
      tech: "TECH",
      lifestyle: "LIFE",
      entertainment: "ENT",
    };
    return cats[category.toLowerCase()] || "CH";
  };

  const updateChallengesCache = (challengeSnapshot?: any) => {
    queryClient.setQueryData<any[]>(["/api/challenges"], (existing) => {
      if (!Array.isArray(existing)) return existing;

      return existing.map((item: any) => {
        if (Number(item?.id) !== Number(challenge.id)) return item;

        const incomingPreviewUsers = Array.isArray(challengeSnapshot?.participantPreviewUsers)
          ? challengeSnapshot.participantPreviewUsers
          : [];
        const currentPreviewUsers = Array.isArray(item?.participantPreviewUsers)
          ? item.participantPreviewUsers
          : [];

        const mergedPreviewUsers = incomingPreviewUsers.length > 0
          ? incomingPreviewUsers
          : currentPreviewUsers;

        const fallbackJoinedUser = user?.id
          ? [{
              id: user.id,
              username: (user as any)?.username || null,
              firstName: (user as any)?.firstName || null,
              profileImageUrl: (user as any)?.profileImageUrl || null,
              side: selectedSide,
            }]
          : [];

        const dedupedPreviewUsers = [...mergedPreviewUsers, ...fallbackJoinedUser]
          .filter((entry: any, idx: number, arr: any[]) => {
            const entryId = String(entry?.id || "").trim();
            if (!entryId) return false;
            return arr.findIndex((x: any) => String(x?.id || "").trim() === entryId) === idx;
          })
          .slice(0, 2);

        const currentCount = Number(item?.participantCount || 0);
        const incomingCount = Number(challengeSnapshot?.participantCount || 0);
        const nextCount = Math.max(
          currentCount + (incomingCount > currentCount ? 0 : 1),
          incomingCount,
          dedupedPreviewUsers.length,
        );

        return {
          ...item,
          participantCount: nextCount,
          participantPreviewUsers: dedupedPreviewUsers,
          ...(challengeSnapshot ? {
            status: challengeSnapshot.status ?? item?.status,
            yesStakeTotal: challengeSnapshot.yesStakeTotal ?? item?.yesStakeTotal,
            noStakeTotal: challengeSnapshot.noStakeTotal ?? item?.noStakeTotal,
          } : {}),
        };
      });
    });
  };

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (isChallengeEnded) {
        throw new Error("Challenge has ended. New entries are closed while participants wait for resolution.");
      }
      if (!selectedSide) {
        throw new Error(`Please select ${positiveSideLabel} or ${negativeSideLabel}`);
      }

      if (stakeAmount <= 0) {
        throw new Error("Invalid stake amount");
      }

      if (stakeAmount > normalizedBalance) {
        throw new Error("Insufficient balance");
      }

      return await apiRequest("POST", `/api/challenges/${challenge.id}/queue/join`, {
        side: selectedSide,
        stakeAmount,
      });
    },
    onSuccess: (result) => {
      setIsWaiting(true);
      updateChallengesCache(result?.challenge);

      if (result?.match) {
        toast({
          title: "Matched",
          description: `Opponent found. NGN ${stakeAmount.toLocaleString()} locked in escrow.`,
        });
      } else {
        toast({
          title: "Queued for matching",
          description: `Position ${result?.queuePosition || 1}. NGN ${stakeAmount.toLocaleString()} held in escrow.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });

      setTimeout(() => {
        onClose();
        setIsWaiting(false);
        setSelectedSide(null);
      }, 1200);
    },
    onError: (error: Error) => {
      const isUnauthorized = /401|unauthorized/i.test(error.message || "");
      toast({
        title: isUnauthorized ? "Session expired" : "Error",
        description: isUnauthorized
          ? "Please sign in again, then retry joining this challenge."
          : error.message,
        variant: "destructive",
      });
    },
  });

  const isBalanceSufficient = normalizedBalance >= stakeAmount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-xs p-3 rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="w-4 h-4 text-yellow-500" />
            {isUpDownMarket ? "Join 5m Market" : "Join Challenge"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isUpDownMarket ? "Pick a direction and lock stake" : "Pick your side and lock stake"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-slate-900 dark:bg-slate-800 px-3 py-1.5 rounded-t-md flex items-center justify-between">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">Challenge Entry</span>
            <Zap className="w-3 h-3 text-white/40" />
          </div>

          <div className="bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-b-md p-3 -mt-4">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight">
                {challenge.title}
              </h3>

              <div className="flex flex-wrap items-center justify-between gap-y-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-5 bg-slate-100 dark:bg-slate-700 border-0 px-2 font-medium">
                      <span className="mr-1">{getCategoryEmoji(challenge.category)}</span>
                      {challenge.category}
                    </Badge>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Stake: NGN {stakeAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                      WIN: NGN {potentialWin.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isBalanceSufficient
                        ? "text-green-600 bg-green-50 dark:bg-green-900/20"
                        : "text-red-600 bg-red-50 dark:bg-red-900/20"
                    }`}
                  >
                    {isBalanceSufficient ? "FUNDED" : "INSUFFICIENT"}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    Wallet: NGN {normalizedBalance.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary px-3 py-1.5 rounded-t-md flex items-center justify-between">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">
              {isUpDownMarket ? "Your Direction" : "Your Claim"}
            </span>
            <Trophy className="w-3 h-3 text-white/40" />
          </div>

          {isUpDownMarket && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-md p-2 bg-slate-50 dark:bg-slate-900/40 -mt-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  BTC Live (1m)
                </div>
                <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                  {btcPrice
                    ? `$${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : "--"}
                </div>
              </div>
              {sparklinePath ? (
                <svg viewBox="0 0 100 24" className="w-full h-8">
                  <path
                    d={sparklinePath}
                    fill="none"
                    stroke={btcDelta !== null && btcDelta >= 0 ? "#16a34a" : "#dc2626"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <div className="h-8 rounded bg-slate-100 dark:bg-slate-800" />
              )}
              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                {btcLoading
                  ? "Loading live BTC movement..."
                  : btcError
                    ? "Live BTC chart unavailable right now."
                    : btcDelta !== null
                      ? `Last 1m move: ${btcDelta >= 0 ? "+" : ""}${btcDelta.toFixed(2)}`
                      : "Live BTC movement"}
              </div>
            </div>
          )}

          <div className={`grid grid-cols-2 gap-2 ${isUpDownMarket ? "" : "-mt-4"}`}>
            <button
              onClick={() => setSelectedSide("YES")}
              disabled={isChallengeEnded}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                selectedSide === "YES"
                  ? "bg-green-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white"
              }`}
              data-testid="button-choice-yes"
            >
              {positiveSideLabel}
            </button>
            <button
              onClick={() => setSelectedSide("NO")}
              disabled={isChallengeEnded}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                selectedSide === "NO"
                  ? "bg-red-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white"
              }`}
              data-testid="button-choice-no"
            >
              {negativeSideLabel}
            </button>
          </div>

          {isWaiting && (
            <div className="p-2 text-center text-sm text-slate-600 bg-slate-50 dark:bg-slate-800/30 rounded-md">
              Processing stake and queue placement...
            </div>
          )}
          {isChallengeEnded && (
            <div className="p-2 text-center text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 rounded-md">
              This challenge has ended. New entries are closed.
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => joinMutation.mutate()}
            disabled={isChallengeEnded || !selectedSide || !isBalanceSufficient || joinMutation.isPending}
            className="w-full border-0"
            size="sm"
            data-testid="button-confirm-join"
          >
            {joinMutation.isPending ? "Joining..." : "Join"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


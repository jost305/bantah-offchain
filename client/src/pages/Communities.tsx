import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { ChallengeCard } from "@/components/ChallengeCard";
import { JoinChallengeModal } from "@/components/JoinChallengeModal";
import { MobileNavigation } from "@/components/MobileNavigation";
import { useAuth } from "@/hooks/useAuth";

function CommunityChallengeSkeleton() {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[160px] bg-white dark:bg-slate-900 shadow-sm rounded-2xl animate-pulse">
      <CardContent className="p-4 flex flex-col h-full space-y-4">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-800" />
            <Skeleton className="h-3 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800/50" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-8 w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-8 w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Communities() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    const onSearch = (e: any) => setSearchTerm(String(e?.detail || ""));
    const onOpen = () => setSearchTerm("");
    window.addEventListener("communities-search", onSearch as EventListener);
    window.addEventListener("open-communities-search", onOpen as EventListener);
    return () => {
      window.removeEventListener("communities-search", onSearch as EventListener);
      window.removeEventListener("open-communities-search", onOpen as EventListener);
    };
  }, []);

  const { data: challenges = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/communities/challenges"],
    queryFn: async () => {
      const res = await fetch("/api/communities/challenges?limit=120", { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: Failed to fetch communities challenges`);
      }
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 30,
  });

  const { data: balance = 0 } = useQuery<any>({
    queryKey: ["/api/wallet/balance"],
    enabled: !!user,
    retry: false,
  });

  const filteredChallenges = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return challenges;
    return challenges.filter((challenge: any) => {
      return (
        String(challenge?.title || "").toLowerCase().includes(q) ||
        String(challenge?.description || "").toLowerCase().includes(q) ||
        String(challenge?.category || "").toLowerCase().includes(q) ||
        String(challenge?.community?.name || "").toLowerCase().includes(q)
      );
    });
  }, [challenges, searchTerm]);

  const handleChallengeClick = (challenge: any) => {
    window.location.href = `/challenges/${challenge.id}/activity`;
  };

  const handleJoin = (challenge: any) => {
    setSelectedChallenge(challenge);
    setShowJoinModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-[50px]">
      <div className="max-w-7xl mx-auto px-3 md:px-4 sm:px-6 lg:px-8 py-3 md:py-4">
        <div className="mb-4">
          <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100">Communities</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
            Partner community challenges with YES/NO matching.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
            {[...Array(6)].map((_, i) => (
              <CommunityChallengeSkeleton key={i} />
            ))}
          </div>
        ) : filteredChallenges.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
            {filteredChallenges.map((challenge: any) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onChatClick={handleChallengeClick}
                onJoin={handleJoin}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No community challenges found</h3>
            <p className="text-slate-500 dark:text-slate-400">Try adjusting your search keywords</p>
          </div>
        )}
      </div>

      {showJoinModal && selectedChallenge && (
        <JoinChallengeModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          challenge={selectedChallenge}
          userBalance={balance && typeof balance === "object" ? (balance as any).balance : (typeof balance === "number" ? balance : 0)}
        />
      )}

      <MobileNavigation />
    </div>
  );
}

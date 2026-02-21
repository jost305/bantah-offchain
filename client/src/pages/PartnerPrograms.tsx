import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowDownToLine, BarChart3, CheckCircle2, Coins, Eye, MessageSquare, Radar, RefreshCcw, Rocket, Shield, Sparkles, UserPlus, Wallet, XCircle } from "lucide-react";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type AuthUser = { id: string; isAdmin?: boolean };
type PartnerProgram = { id: number; name: string; slug: string; defaultFeeBps: number; role?: string };
type PartnerMember = { id: number; userId: string; role: string; createdAt: string; user?: { username?: string | null; firstName?: string | null } };
type PartnerChallenge = {
  challengeId: number;
  partnerFeeBps: number;
  challenge: {
    title: string;
    amount: number;
    category: string;
    status: string;
    result?: string | null;
    participantCount: number;
    commentCount: number;
  };
};
type PartnerWalletSummary = { programId: number; balance: number; totalCredited: number; totalWithdrawn: number; pendingWithdrawals: number; availableBalance: number; updatedAt: string };
type PartnerWalletTransaction = { id: number; type: string; amount: number; balanceAfter: number; challengeId: number | null; createdAt: string };
type PartnerWithdrawal = {
  id: number;
  programId: number;
  requestedBy: string;
  amount: number;
  status: string;
  note?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  processedAt?: string | null;
  requestedByUser?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  program?: { name: string; slug: string } | null;
};
type PartnerWalletPayload = { programId: number; wallet: PartnerWalletSummary; recentTransactions: PartnerWalletTransaction[]; withdrawals: PartnerWithdrawal[] };
type PartnerDashboardAccess = { allowed: boolean; reason: string };

const categories = ["sports", "gaming", "crypto", "trading", "music", "entertainment", "politics", "general"];
const roles = ["manager", "moderator", "viewer"];

const rel = (value: unknown) => {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "recently";
  return formatDistanceToNow(date, { addSuffix: true });
};

const naira = (value: number) => `NGN ${Number(value || 0).toLocaleString()}`;
const canManageProgramRole = (role?: string) => ["owner", "manager", "admin"].includes(String(role || "").toLowerCase());
const formatTxType = (type: string) => (type === "settlement_credit" ? "Settlement credit" : type === "withdrawal_debit" ? "Withdrawal debit" : type.replace(/_/g, " "));
const formatChallengeResult = (result?: string | null) => {
  if (result === "challenger_won") return "YES won";
  if (result === "challenged_won") return "NO won";
  if (result === "draw") return "Draw";
  return "Pending";
};

export default function PartnerPrograms() {
  const { user, isAuthenticated, isLoading, login } = useAuth();
  const { toast } = useToast();

  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
  const [tab, setTab] = useState("challenges");

  const [programName, setProgramName] = useState("");
  const [programSlug, setProgramSlug] = useState("");
  const [programGroupId, setProgramGroupId] = useState("");
  const [programFee, setProgramFee] = useState("1000");

  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("manager");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("sports");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [feeBps, setFeeBps] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBankName, setWithdrawBankName] = useState("");
  const [withdrawAccountName, setWithdrawAccountName] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  const authUserQuery = useQuery<AuthUser>({ queryKey: ["/api/auth/user"], enabled: !!user, retry: false });
  const isAdminUser = Boolean(authUserQuery.data?.isAdmin);

  const partnerAccessQuery = useQuery<PartnerDashboardAccess>({
    queryKey: ["/api/partners/dashboard-access"],
    enabled: !!user,
    retry: false,
  });
  const hasPartnerAccess = Boolean(partnerAccessQuery.data?.allowed);

  const programsQuery = useQuery<PartnerProgram[]>({
    queryKey: ["/api/partners/programs/me"],
    enabled: !!user && hasPartnerAccess,
    retry: false,
  });
  const programs = programsQuery.data || [];

  useEffect(() => {
    if (!selectedProgramId && programs.length > 0) setSelectedProgramId(programs[0].id);
  }, [programs, selectedProgramId]);

  const selectedProgram = useMemo(() => programs.find((program) => program.id === selectedProgramId) || null, [programs, selectedProgramId]);
  const canManageSelectedProgram = canManageProgramRole(selectedProgram?.role);

  const challengesKey = selectedProgramId ? `/api/partners/programs/${selectedProgramId}/challenges` : "";
  const membersKey = selectedProgramId ? `/api/partners/programs/${selectedProgramId}/members` : "";
  const walletKey = selectedProgramId ? `/api/partners/programs/${selectedProgramId}/wallet` : "";

  const challengesQuery = useQuery<PartnerChallenge[]>({
    queryKey: [challengesKey],
    enabled: !!selectedProgramId && !!user && hasPartnerAccess,
    retry: false,
  });
  const membersQuery = useQuery<PartnerMember[]>({
    queryKey: [membersKey],
    enabled: !!selectedProgramId && !!user && hasPartnerAccess,
    retry: false,
  });
  const walletQuery = useQuery<PartnerWalletPayload>({
    queryKey: [walletKey],
    enabled: !!selectedProgramId && !!user && hasPartnerAccess,
    retry: false,
  });

  const challenges = challengesQuery.data || [];
  const members = membersQuery.data || [];
  const selectedChallenge = useMemo(
    () => challenges.find((item) => item.challengeId === selectedChallengeId) || null,
    [challenges, selectedChallengeId],
  );

  useEffect(() => {
    if (!selectedChallengeId && challenges.length > 0) setSelectedChallengeId(challenges[0].challengeId);
  }, [challenges, selectedChallengeId]);

  const monitorKey = selectedChallengeId ? `/api/partners/challenges/${selectedChallengeId}/monitor` : "";
  const feeKey = selectedChallengeId ? `/api/partners/challenges/${selectedChallengeId}/fees` : "";

  const monitorQuery = useQuery<any>({
    queryKey: [monitorKey],
    enabled: !!selectedChallengeId && !!user && hasPartnerAccess,
    retry: false,
  });
  const feeQuery = useQuery<any>({
    queryKey: [feeKey],
    enabled: !!selectedChallengeId && !!user && hasPartnerAccess,
    retry: false,
  });
  const pendingAdminWithdrawalsQuery = useQuery<PartnerWithdrawal[]>({
    queryKey: ["/api/partners/admin/withdrawals/pending"],
    enabled: !!user && isAdminUser && hasPartnerAccess,
    retry: false,
  });

  const createProgram = useMutation({
    mutationFn: () => apiRequest("POST", "/api/partners/programs", {
      name: programName.trim(),
      slug: programSlug.trim() || programName.trim(),
      defaultFeeBps: Number(programFee || 1000),
      ...(programGroupId.trim() ? { groupId: Number(programGroupId) } : {}),
    }),
    onSuccess: async (created: PartnerProgram) => {
      setProgramName("");
      setProgramSlug("");
      setProgramGroupId("");
      setProgramFee("1000");
      await queryClient.invalidateQueries({ queryKey: ["/api/partners/programs/me"] });
      setSelectedProgramId(created.id);
      toast({ title: "Program created", description: created.name });
    },
    onError: (error: any) => toast({ title: "Create failed", description: error?.message || "Try again", variant: "destructive" }),
  });

  const upsertMember = useMutation({
    mutationFn: () => apiRequest("POST", `/api/partners/programs/${selectedProgramId}/members`, { userId: memberUserId.trim(), role: memberRole }),
    onSuccess: async () => {
      setMemberUserId("");
      await queryClient.invalidateQueries({ queryKey: [membersKey] });
      toast({ title: "Member updated", description: `Role: ${memberRole}` });
    },
    onError: (error: any) => toast({ title: "Member update failed", description: error?.message || "Try again", variant: "destructive" }),
  });

  const createChallenge = useMutation({
    mutationFn: () => apiRequest("POST", `/api/partners/programs/${selectedProgramId}/challenges`, {
      title: title.trim(),
      description: description.trim(),
      category,
      amount: Number(amount),
      ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
      ...(feeBps.trim() ? { partnerFeeBps: Number(feeBps) } : {}),
    }),
    onSuccess: async (response: any) => {
      setTitle("");
      setDescription("");
      setAmount("");
      setDueDate("");
      setFeeBps("");
      await queryClient.invalidateQueries({ queryKey: [challengesKey] });
      if (response?.challenge?.id) setSelectedChallengeId(response.challenge.id);
      toast({ title: "Partner challenge created", description: `#${response?.challenge?.id || ""}` });
    },
    onError: (error: any) => toast({ title: "Create failed", description: error?.message || "Try again", variant: "destructive" }),
  });

  const settleChallenge = useMutation({
    mutationFn: ({ challengeId, result }: { challengeId: number; result: "challenger_won" | "challenged_won" | "draw" }) =>
      apiRequest("POST", `/api/partners/challenges/${challengeId}/result`, { result }),
    onSuccess: async (response: any) => {
      await queryClient.invalidateQueries({ queryKey: [challengesKey] });
      await queryClient.invalidateQueries({ queryKey: [monitorKey] });
      await queryClient.invalidateQueries({ queryKey: [feeKey] });
      await queryClient.invalidateQueries({ queryKey: [walletKey] });
      toast({
        title: "Challenge settled",
        description: response?.message || "Result saved and payouts queued.",
      });
    },
    onError: (error: any) =>
      toast({
        title: "Settlement failed",
        description: error?.message || "Try again",
        variant: "destructive",
      }),
  });

  const requestWithdrawal = useMutation({
    mutationFn: () => apiRequest("POST", `/api/partners/programs/${selectedProgramId}/withdrawals`, {
      amount: Number(withdrawAmount),
      destination: {
        bankName: withdrawBankName.trim(),
        accountName: withdrawAccountName.trim(),
        accountNumber: withdrawAccountNumber.trim(),
      },
      note: withdrawNote.trim() || undefined,
    }),
    onSuccess: async () => {
      setWithdrawAmount("");
      setWithdrawBankName("");
      setWithdrawAccountName("");
      setWithdrawAccountNumber("");
      setWithdrawNote("");
      await queryClient.invalidateQueries({ queryKey: [walletKey] });
      if (isAdminUser) await queryClient.invalidateQueries({ queryKey: ["/api/partners/admin/withdrawals/pending"] });
      toast({ title: "Withdrawal requested", description: "Your request was submitted for review." });
    },
    onError: (error: any) => toast({ title: "Withdrawal failed", description: error?.message || "Try again", variant: "destructive" }),
  });

  const decideWithdrawal = useMutation({
    mutationFn: ({ withdrawalId, action, note }: { withdrawalId: number; action: "approve" | "reject"; note?: string }) =>
      apiRequest("POST", `/api/partners/admin/withdrawals/${withdrawalId}/decision`, { action, note: note || undefined }),
    onSuccess: async (result: any) => {
      const programId = Number(result?.withdrawal?.programId || 0);
      await queryClient.invalidateQueries({ queryKey: ["/api/partners/admin/withdrawals/pending"] });
      if (programId > 0) await queryClient.invalidateQueries({ queryKey: [`/api/partners/programs/${programId}/wallet`] });
      if (selectedProgramId) await queryClient.invalidateQueries({ queryKey: [walletKey] });
      toast({ title: "Withdrawal updated", description: `Request #${result?.withdrawal?.id || ""}` });
    },
    onError: (error: any) => toast({ title: "Decision failed", description: error?.message || "Try again", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader><CardTitle>Partner Dashboard</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to manage partner campaigns and wallet operations.</p>
              <Button onClick={() => login()} className="h-9 text-xs font-bold uppercase tracking-wide border-0">Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (partnerAccessQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!hasPartnerAccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge className="bg-[#ccff00]/25 text-[#ccff00] border border-[#ccff00]/40 hover:bg-[#ccff00]/25">Community Hub</Badge>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#ccff00]" />
                  Community Command Center
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl">
                  Launch community challenges, earn your partner fee share from settled pools, and track wallet balance plus withdrawals in one command center.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                <Shield className="w-4 h-4" />
                <span className="text-xs font-semibold">Partner Mode</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/80 dark:bg-sky-950/30 px-3 py-2.5 text-xs text-sky-700 dark:text-sky-300 flex items-center gap-2">
                <Rocket className="w-4 h-4 text-sky-300" />
                <span>Campaign Mission Control</span>
              </div>
              <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/80 dark:bg-violet-950/30 px-3 py-2.5 text-xs text-violet-700 dark:text-violet-300 flex items-center gap-2">
                <Radar className="w-4 h-4 text-violet-300" />
                <span>Chat + Proof Radar</span>
              </div>
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/30 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-300" />
                <span>Fee + Payout Engine</span>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Your current account is not linked to a partner profile yet. If you already applied, use the same account/email you used during signup.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button className="h-9 text-xs font-bold uppercase tracking-wide border-0 bg-[#ccff00] text-slate-900 hover:bg-[#b8e600]" onClick={() => (window.location.href = "/partner-signup")}>
                Sign Up as Partner
              </Button>
              <Button className="h-9 text-xs font-bold uppercase tracking-wide border-0 bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600" onClick={() => partnerAccessQuery.refetch()}>
                Check Access
              </Button>
              <Button className="h-9 text-xs font-bold uppercase tracking-wide border-0 bg-slate-200 hover:bg-slate-300 text-slate-900" onClick={() => (window.location.href = "/challenges")}>
                Back to Challenges
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const wallet = walletQuery.data?.wallet;
  const walletTransactions = walletQuery.data?.recentTransactions || [];
  const walletWithdrawals = walletQuery.data?.withdrawals || [];
  const pendingAdminWithdrawals = pendingAdminWithdrawalsQuery.data || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Badge className="bg-[#ccff00]/30 text-slate-900 border border-[#ccff00]/50 hover:bg-[#ccff00]/30">Partner Campaigns</Badge>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Partner Challenge Dashboard</h1>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">{programs.length} programs | {challenges.length} challenges | {members.length} members</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" />Programs</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {programs.map((program) => (
                  <button key={program.id} onClick={() => { setSelectedProgramId(program.id); setSelectedChallengeId(null); }} className={`w-full text-left rounded-xl border px-3 py-2 ${selectedProgramId === program.id ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"}`}>
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{program.name}</span>
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-0 capitalize">{program.role || "member"}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">/{program.slug}</p>
                  </button>
                ))}
                {programs.length === 0 && <p className="text-xs text-slate-500">No programs yet.</p>}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Create Program</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Input placeholder="Program name" value={programName} onChange={(event) => setProgramName(event.target.value)} className="h-9" />
                <Input placeholder="Slug (optional)" value={programSlug} onChange={(event) => setProgramSlug(event.target.value)} className="h-9" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Group ID" value={programGroupId} onChange={(event) => setProgramGroupId(event.target.value)} className="h-9" />
                  <Input placeholder="Fee bps" value={programFee} onChange={(event) => setProgramFee(event.target.value)} className="h-9" />
                </div>
                <Button onClick={() => createProgram.mutate()} disabled={createProgram.isPending} className="h-9 w-full text-xs font-bold uppercase tracking-wide border-0">{createProgram.isPending ? "Creating..." : "Create"}</Button>
              </CardContent>
            </Card>

            {isAdminUser && (
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" />Pending Withdrawals</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {pendingAdminWithdrawalsQuery.isLoading && <Skeleton className="h-20 w-full" />}
                  {!pendingAdminWithdrawalsQuery.isLoading && pendingAdminWithdrawals.length === 0 && <p className="text-xs text-slate-500">No pending partner withdrawals.</p>}
                  {pendingAdminWithdrawals.slice(0, 6).map((withdrawal) => (
                    <div key={withdrawal.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-950 space-y-2">
                      <p className="text-xs font-semibold truncate">{withdrawal.program?.name || `Program #${withdrawal.programId}`}</p>
                      <p className="text-xs text-slate-500">{naira(withdrawal.amount)} | {rel(withdrawal.createdAt)}</p>
                      <Input placeholder="Admin note (optional)" value={adminNotes[withdrawal.id] || ""} onChange={(event) => setAdminNotes((prev) => ({ ...prev, [withdrawal.id]: event.target.value }))} className="h-8 text-xs" />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 text-[11px] flex-1 border-0" disabled={decideWithdrawal.isPending} onClick={() => decideWithdrawal.mutate({ withdrawalId: withdrawal.id, action: "approve", note: adminNotes[withdrawal.id] })}><CheckCircle2 className="w-3 h-3 mr-1" />Approve</Button>
                        <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" disabled={decideWithdrawal.isPending} onClick={() => decideWithdrawal.mutate({ withdrawalId: withdrawal.id, action: "reject", note: adminNotes[withdrawal.id] })}><XCircle className="w-3 h-3 mr-1" />Reject</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" />{selectedProgram ? selectedProgram.name : "Select Program"}</CardTitle></CardHeader>
            <CardContent>
              {!selectedProgram ? <p className="text-sm text-slate-500">Select a program to continue.</p> : (
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="grid grid-cols-4 w-full max-w-xl">
                    <TabsTrigger value="challenges">Challenges</TabsTrigger>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="monitor">Monitor</TabsTrigger>
                    <TabsTrigger value="wallet">Wallet</TabsTrigger>
                  </TabsList>

                  <TabsContent value="challenges" className="space-y-3 mt-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-950 space-y-2">
                      <Label className="text-xs">Create Partner Challenge</Label>
                      <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-9" />
                      <Textarea placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-[72px]" />
                      <div className="grid grid-cols-2 gap-2">
                        <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm">{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                        <Input placeholder="Stake amount" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-9" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-9" />
                        <Input placeholder={`Fee bps (default ${selectedProgram.defaultFeeBps})`} value={feeBps} onChange={(event) => setFeeBps(event.target.value)} className="h-9" />
                      </div>
                      <Button onClick={() => createChallenge.mutate()} disabled={createChallenge.isPending} className="h-9 text-xs font-bold uppercase tracking-wide border-0">{createChallenge.isPending ? "Creating..." : "Create Challenge"}</Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Program Challenges</p>
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => challengesQuery.refetch()}><RefreshCcw className="w-3 h-3 mr-1" />Refresh</Button>
                      </div>
                      {challengesQuery.isLoading && <Skeleton className="h-20 w-full" />}
                      {!challengesQuery.isLoading && challenges.map((challengeItem) => (
                        <div key={challengeItem.challengeId} className={`rounded-xl border p-3 ${selectedChallengeId === challengeItem.challengeId ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"}`}>
                          <div className="flex justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{challengeItem.challenge.title}</p>
                              <p className="text-[11px] text-slate-500">{challengeItem.challenge.category} | {naira(challengeItem.challenge.amount)} | {challengeItem.challenge.status}</p>
                            </div>
                            <div className="text-[11px] text-slate-500 text-right">{challengeItem.challenge.participantCount} players<br />{challengeItem.challenge.commentCount} comments</div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSelectedChallengeId(challengeItem.challengeId); setTab("monitor"); }}><Eye className="w-3 h-3 mr-1" />Monitor</Button>
                            <a href={`/challenges/${challengeItem.challengeId}/activity`} className="inline-flex h-8 items-center rounded-md border border-slate-200 dark:border-slate-700 px-2 text-xs"><MessageSquare className="w-3 h-3 mr-1" />Chat</a>
                          </div>
                        </div>
                      ))}
                      {challenges.length === 0 && !challengesQuery.isLoading && <p className="text-sm text-slate-500">No partner challenges yet.</p>}
                    </div>
                  </TabsContent>

                  <TabsContent value="members" className="space-y-3 mt-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-950 space-y-2">
                      <Label className="text-xs">Add / Update Member</Label>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
                        <Input value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} placeholder="User ID" className="h-9" />
                        <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm">{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                        <Button onClick={() => upsertMember.mutate()} disabled={upsertMember.isPending} className="h-9 text-xs font-bold uppercase tracking-wide border-0"><UserPlus className="w-3 h-3 mr-1" />Save</Button>
                      </div>
                    </div>
                    {membersQuery.isLoading && <Skeleton className="h-20 w-full" />}
                    {!membersQuery.isLoading && members.map((member) => (
                      <div key={member.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-950">
                        <div className="flex justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{member.user?.username || member.user?.firstName || member.userId}</p>
                            <p className="text-[11px] text-slate-500 truncate">{member.userId}</p>
                          </div>
                          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-0 capitalize">{member.role}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">Added {rel(member.createdAt)}</p>
                      </div>
                    ))}
                    {members.length === 0 && !membersQuery.isLoading && <p className="text-sm text-slate-500">No members found.</p>}
                  </TabsContent>

                  <TabsContent value="monitor" className="space-y-3 mt-4">
                    {!selectedChallengeId ? <p className="text-sm text-slate-500">Pick a challenge to monitor.</p> : (
                      <>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-950 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">Challenge #{selectedChallengeId}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{selectedChallenge?.challenge?.title || "Community challenge"}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Status: {selectedChallenge?.challenge?.status || "-"} | Result: {formatChallengeResult(selectedChallenge?.challenge?.result)}
                              </p>
                            </div>
                            {canManageSelectedProgram && (
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  className="h-7 text-[11px] border-0"
                                  disabled={settleChallenge.isPending || Boolean(selectedChallenge?.challenge?.result)}
                                  onClick={() => settleChallenge.mutate({ challengeId: Number(selectedChallengeId), result: "challenger_won" })}
                                >
                                  YES Won
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-[11px] border-0"
                                  disabled={settleChallenge.isPending || Boolean(selectedChallenge?.challenge?.result)}
                                  onClick={() => settleChallenge.mutate({ challengeId: Number(selectedChallengeId), result: "challenged_won" })}
                                >
                                  NO Won
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px]"
                                  disabled={settleChallenge.isPending || Boolean(selectedChallenge?.challenge?.result)}
                                  onClick={() => settleChallenge.mutate({ challengeId: Number(selectedChallengeId), result: "draw" })}
                                >
                                  Draw
                                </Button>
                              </div>
                            )}
                          </div>
                          {feeQuery.data?.settlement ? (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Partner fee: {naira(feeQuery.data.settlement.partnerFee)} | Settled {rel(feeQuery.data.settlement.settledAt)}</p>
                          ) : (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Settlement appears after result is set.</p>
                          )}
                          {canManageSelectedProgram && !selectedChallenge?.challenge?.result && (
                            <p className="text-[11px] text-slate-500">Set the final result to release winnings and update partner earnings.</p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Messages</CardTitle></CardHeader>
                            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                              {(monitorQuery.data?.monitor?.messages || []).map((message: any, index: number) => (
                                <div key={message.id ?? index} className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-xs">
                                  <p className="font-semibold">{message.user?.username || message.userId || "User"}<span className="text-slate-500 font-normal"> | {rel(message.createdAt)}</span></p>
                                  <p className="mt-0.5">{message.message}</p>
                                </div>
                              ))}
                              {(monitorQuery.data?.monitor?.messages || []).length === 0 && <p className="text-xs text-slate-500">No messages yet.</p>}
                            </CardContent>
                          </Card>
                          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Proofs and Votes</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-xs max-h-64 overflow-y-auto">
                              <p className="font-semibold">Proofs</p>
                              {(monitorQuery.data?.monitor?.proofs || []).map((proof: any, index: number) => <p key={proof.id ?? `proof-${index}`}>{proof.username || proof.participant_id} | {rel(proof.uploaded_at)}</p>)}
                              {(monitorQuery.data?.monitor?.proofs || []).length === 0 && <p className="text-slate-500">No proofs</p>}
                              <p className="font-semibold pt-2">Votes</p>
                              {(monitorQuery.data?.monitor?.votes || []).map((vote: any, index: number) => <p key={vote.id ?? `vote-${index}`}>{vote.username || vote.participant_id} {"->"} {vote.vote_choice || "-"}</p>)}
                              {(monitorQuery.data?.monitor?.votes || []).length === 0 && <p className="text-slate-500">No votes</p>}
                            </CardContent>
                          </Card>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="wallet" className="space-y-3 mt-4">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Partner Wallet</p>
                      <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => walletQuery.refetch()}><RefreshCcw className="w-3 h-3 mr-1" />Refresh</Button>
                    </div>
                    {walletQuery.isLoading && <Skeleton className="h-28 w-full" />}
                    {!walletQuery.isLoading && wallet && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Balance</p><p className="text-sm font-semibold mt-1">{naira(wallet.balance)}</p></div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Available</p><p className="text-sm font-semibold mt-1">{naira(wallet.availableBalance)}</p></div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Pending Withdrawals</p><p className="text-sm font-semibold mt-1">{naira(wallet.pendingWithdrawals)}</p></div>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-950 space-y-2">
                          <Label className="text-xs flex items-center gap-1"><Wallet className="w-3.5 h-3.5" />Request Withdrawal</Label>
                          <Input placeholder="Amount" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} className="h-9" />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <Input placeholder="Bank name" value={withdrawBankName} onChange={(event) => setWithdrawBankName(event.target.value)} className="h-9" />
                            <Input placeholder="Account name" value={withdrawAccountName} onChange={(event) => setWithdrawAccountName(event.target.value)} className="h-9" />
                            <Input placeholder="Account number" value={withdrawAccountNumber} onChange={(event) => setWithdrawAccountNumber(event.target.value)} className="h-9" />
                          </div>
                          <Input placeholder="Note (optional)" value={withdrawNote} onChange={(event) => setWithdrawNote(event.target.value)} className="h-9" />
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-slate-500">Available now: {naira(wallet.availableBalance)}</p>
                            <Button onClick={() => requestWithdrawal.mutate()} disabled={requestWithdrawal.isPending || !canManageSelectedProgram || !withdrawAmount.trim() || Number(withdrawAmount) <= 0} className="h-9 text-xs font-bold uppercase tracking-wide border-0"><ArrowDownToLine className="w-3 h-3 mr-1" />{requestWithdrawal.isPending ? "Submitting..." : "Request"}</Button>
                          </div>
                          {!canManageSelectedProgram && <p className="text-[11px] text-amber-600 dark:text-amber-400">Only owner or manager can request withdrawals.</p>}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Withdrawal Requests</CardTitle></CardHeader>
                            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                              {walletWithdrawals.map((withdrawal) => (
                                <div key={withdrawal.id} className="rounded border border-slate-200 dark:border-slate-700 px-2 py-2 text-xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <div><p className="font-semibold">{naira(withdrawal.amount)}</p><p className="text-slate-500 mt-0.5">Requested {rel(withdrawal.createdAt)}</p></div>
                                    <Badge className="border-0 capitalize bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{withdrawal.status}</Badge>
                                  </div>
                                  {withdrawal.reviewNote && <p className="mt-1 text-slate-600 dark:text-slate-300">Review: {withdrawal.reviewNote}</p>}
                                </div>
                              ))}
                              {walletWithdrawals.length === 0 && <p className="text-xs text-slate-500">No withdrawals yet.</p>}
                            </CardContent>
                          </Card>

                          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Wallet Transactions</CardTitle></CardHeader>
                            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                              {walletTransactions.map((transaction) => (
                                <div key={transaction.id} className="rounded border border-slate-200 dark:border-slate-700 px-2 py-2 text-xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <div><p className="font-semibold capitalize">{formatTxType(transaction.type)}</p><p className="text-slate-500 mt-0.5">{rel(transaction.createdAt)}</p></div>
                                    <p className={`font-semibold ${transaction.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{transaction.amount >= 0 ? "+" : ""}{naira(transaction.amount)}</p>
                                  </div>
                                  <p className="text-slate-500 mt-1">Balance after: {naira(transaction.balanceAfter)}</p>
                                </div>
                              ))}
                              {walletTransactions.length === 0 && <p className="text-xs text-slate-500">No wallet transactions yet.</p>}
                            </CardContent>
                          </Card>
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

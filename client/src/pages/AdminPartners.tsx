import { useMemo, useState } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock3, ShieldCheck, Users, Wallet } from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { adminApiRequest, useAdminQuery } from "@/lib/adminApi";

type PartnerSignupApplication = {
  id: number;
  fullName: string;
  email: string;
  communityName: string;
  roleTitle?: string | null;
  phone?: string | null;
  telegramHandle?: string | null;
  website?: string | null;
  status: "pending" | "reviewing" | "approved" | "rejected";
  reviewNote?: string | null;
  createdAt: string;
  socialLinks?: Record<string, string> | null;
};

type PartnerProgramSummary = {
  id: number;
  name: string;
  slug: string;
  ownerUserId: string;
  defaultFeeBps: number;
  status: string;
  memberCount: number;
  challengeCount: number;
  activeChallengeCount: number;
  pendingSettlementCount: number;
  pendingWithdrawalsCount: number;
  wallet: {
    balance: number;
    availableBalance: number;
    pendingWithdrawals: number;
    totalCredited: number;
    totalWithdrawn: number;
  };
};

type PartnerProgramDetail = {
  program: PartnerProgramSummary;
  members: Array<{
    id: number;
    userId: string;
    role: string;
    status: string;
    user?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  }>;
  challenges: Array<{
    challengeId: number;
    settlementStatus: string;
    challenge: {
      title: string;
      status: string;
      result?: string | null;
      amount: number;
      participantCount: number;
      commentCount: number;
      category: string;
    };
  }>;
  wallet: PartnerProgramSummary["wallet"];
  withdrawals: PartnerWithdrawal[];
  pendingWithdrawals: PartnerWithdrawal[];
};

type PartnerWithdrawal = {
  id: number;
  programId: number;
  amount: number;
  status: string;
  createdAt: string;
  reviewNote?: string | null;
  requestedBy: string;
  requestedByUser?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  program?: { name: string; slug: string } | null;
};

const rel = (value: unknown) => {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "recently";
  return formatDistanceToNow(date, { addSuffix: true });
};

const naira = (value: number) => `NGN ${Number(value || 0).toLocaleString()}`;

export default function AdminPartners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [withdrawalNotes, setWithdrawalNotes] = useState<Record<number, string>>({});
  const [applicationFilter, setApplicationFilter] = useState<"all" | "pending" | "reviewing" | "approved" | "rejected">("all");

  const applicationsKey = applicationFilter === "all"
    ? "/api/admin/partners/signup-applications"
    : `/api/admin/partners/signup-applications?status=${applicationFilter}`;

  const { data: applications = [], isLoading: applicationsLoading } = useAdminQuery<PartnerSignupApplication[]>(
    applicationsKey,
    { retry: false },
  );

  const { data: programs = [], isLoading: programsLoading } = useAdminQuery<PartnerProgramSummary[]>(
    "/api/admin/partners/programs",
    { retry: false },
  );

  const { data: pendingWithdrawals = [], isLoading: withdrawalsLoading } = useAdminQuery<PartnerWithdrawal[]>(
    "/api/admin/partners/withdrawals/pending",
    { retry: false },
  );

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) || null,
    [programs, selectedProgramId],
  );

  const detailKey = selectedProgramId ? `/api/admin/partners/programs/${selectedProgramId}` : "";
  const { data: selectedProgramDetail, isLoading: detailLoading } = useAdminQuery<PartnerProgramDetail>(
    detailKey,
    {
      enabled: !!selectedProgramId,
      retry: false,
    } as any,
  );

  const reviewApplication = useMutation({
    mutationFn: ({ id, status, reviewNote }: { id: number; status: string; reviewNote?: string }) =>
      adminApiRequest(`/api/admin/partners/signup-applications/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, reviewNote }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [applicationsKey] });
      toast({ title: "Application updated", description: "Partner signup status saved." });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error?.message || "Try again", variant: "destructive" });
    },
  });

  const decideWithdrawal = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: "approve" | "reject"; note?: string }) =>
      adminApiRequest(`/api/admin/partners/withdrawals/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ action, note: note || undefined }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/withdrawals/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/programs"] }),
        selectedProgramId
          ? queryClient.invalidateQueries({ queryKey: [`/api/admin/partners/programs/${selectedProgramId}`] })
          : Promise.resolve(),
      ]);
      toast({ title: "Withdrawal updated", description: "Decision saved." });
    },
    onError: (error: any) => {
      toast({ title: "Decision failed", description: error?.message || "Try again", variant: "destructive" });
    },
  });

  const approvedCount = applications.filter((item) => item.status === "approved").length;
  const totalProgramMembers = programs.reduce((sum, program) => sum + Number(program.memberCount || 0), 0);
  const totalProgramChallenges = programs.reduce((sum, program) => sum + Number(program.challengeCount || 0), 0);
  const totalPartnerBalance = programs.reduce((sum, program) => sum + Number(program.wallet?.balance || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black text-white">Partner Management</h1>
          <p className="text-sm text-slate-400 mt-1">Review signup applications, inspect partner programs, and process partner withdrawal requests.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-300 uppercase">Approved Partners</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-white">{approvedCount}</p></CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-300 uppercase">Programs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-white">{programs.length}</p></CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-300 uppercase">Program Members</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-white">{totalProgramMembers}</p></CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-300 uppercase">Partner Wallet Balance</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-black text-white">{naira(totalPartnerBalance)}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="applications" className="space-y-3">
          <TabsList className="grid grid-cols-3 w-full max-w-[640px] bg-slate-900 border border-slate-700">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>

          <TabsContent value="applications">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-white text-base">Partner Signup Applications</CardTitle>
                  <select
                    value={applicationFilter}
                    onChange={(event) => setApplicationFilter(event.target.value as any)}
                    className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {applicationsLoading && <Skeleton className="h-24 w-full bg-slate-800" />}
                {!applicationsLoading && applications.length === 0 && <p className="text-sm text-slate-400">No partner applications found.</p>}
                {!applicationsLoading && applications.map((application) => (
                  <div key={application.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{application.communityName}</p>
                        <p className="text-xs text-slate-400">{application.fullName} • {application.email}</p>
                        <p className="text-[11px] text-slate-500 mt-1">Submitted {rel(application.createdAt)}</p>
                      </div>
                      <Badge className="bg-slate-800 text-slate-200 border border-slate-700 capitalize">{application.status}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                      <p>Role: {application.roleTitle || "-"}</p>
                      <p>Phone: {application.phone || "-"}</p>
                      <p>Telegram: {application.telegramHandle || "-"}</p>
                      <p>Website: {application.website || "-"}</p>
                    </div>
                    <Textarea
                      value={reviewNotes[application.id] || ""}
                      onChange={(event) => setReviewNotes((prev) => ({ ...prev, [application.id]: event.target.value }))}
                      placeholder="Review note (optional)"
                      className="min-h-[62px] bg-slate-900 border-slate-700 text-slate-100"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-[11px] border-0"
                        disabled={reviewApplication.isPending}
                        onClick={() => reviewApplication.mutate({ id: application.id, status: "approved", reviewNote: reviewNotes[application.id] })}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-slate-600 text-slate-200"
                        disabled={reviewApplication.isPending}
                        onClick={() => reviewApplication.mutate({ id: application.id, status: "reviewing", reviewNote: reviewNotes[application.id] })}
                      >
                        <Clock3 className="w-3 h-3 mr-1" />Reviewing
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-rose-700 text-rose-300 hover:bg-rose-900/30"
                        disabled={reviewApplication.isPending}
                        onClick={() => reviewApplication.mutate({ id: application.id, status: "rejected", reviewNote: reviewNotes[application.id] })}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="programs">
            <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-3">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2"><CardTitle className="text-white text-base">Partner Programs</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {programsLoading && <Skeleton className="h-20 w-full bg-slate-800" />}
                  {!programsLoading && programs.length === 0 && <p className="text-sm text-slate-400">No partner programs yet.</p>}
                  {!programsLoading && programs.map((program) => (
                    <button
                      key={program.id}
                      onClick={() => setSelectedProgramId(program.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 ${
                        selectedProgramId === program.id
                          ? "border-primary bg-primary/10"
                          : "border-slate-700 bg-slate-950"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white truncate">{program.name}</p>
                      <p className="text-[11px] text-slate-500">/{program.slug}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {program.memberCount} members • {program.challengeCount} challenges
                      </p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">
                    {selectedProgram ? selectedProgram.name : "Select a Program"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!selectedProgramId && <p className="text-sm text-slate-400">Pick a partner program to inspect members, challenges, and wallet activity.</p>}
                  {selectedProgramId && detailLoading && <Skeleton className="h-40 w-full bg-slate-800" />}
                  {selectedProgramDetail && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="rounded-lg border border-slate-700 bg-slate-950 p-2.5">
                          <p className="text-[11px] text-slate-500 uppercase">Members</p>
                          <p className="text-base font-bold text-white">{selectedProgramDetail.members.length}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950 p-2.5">
                          <p className="text-[11px] text-slate-500 uppercase">Challenges</p>
                          <p className="text-base font-bold text-white">{selectedProgramDetail.challenges.length}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950 p-2.5">
                          <p className="text-[11px] text-slate-500 uppercase">Wallet</p>
                          <p className="text-base font-bold text-white">{naira(selectedProgramDetail.wallet.balance)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950 p-2.5">
                          <p className="text-[11px] text-slate-500 uppercase">Pending WDs</p>
                          <p className="text-base font-bold text-white">{selectedProgramDetail.pendingWithdrawals.length}</p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                        <p className="text-xs font-semibold text-slate-300 mb-2">Program Members</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {selectedProgramDetail.members.slice(0, 12).map((member) => (
                            <p key={member.id} className="text-xs text-slate-400">
                              {(member.user?.username || member.user?.firstName || member.userId)} • <span className="capitalize">{member.role}</span>
                            </p>
                          ))}
                          {selectedProgramDetail.members.length === 0 && <p className="text-xs text-slate-500">No members.</p>}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                        <p className="text-xs font-semibold text-slate-300 mb-2">Recent Challenges</p>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto">
                          {selectedProgramDetail.challenges.slice(0, 20).map((item) => (
                            <div key={item.challengeId} className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-slate-300 truncate">{item.challenge.title}</p>
                              <p className="text-[11px] text-slate-500">
                                {item.challenge.status} • {item.settlementStatus} • {naira(item.challenge.amount)}
                              </p>
                            </div>
                          ))}
                          {selectedProgramDetail.challenges.length === 0 && <p className="text-xs text-slate-500">No challenges.</p>}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2"><CardTitle className="text-white text-base">Pending Partner Withdrawals</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {withdrawalsLoading && <Skeleton className="h-20 w-full bg-slate-800" />}
                {!withdrawalsLoading && pendingWithdrawals.length === 0 && <p className="text-sm text-slate-400">No pending withdrawals.</p>}
                {!withdrawalsLoading && pendingWithdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{withdrawal.program?.name || `Program #${withdrawal.programId}`}</p>
                        <p className="text-xs text-slate-400">
                          Requested by {withdrawal.requestedByUser?.username || withdrawal.requestedByUser?.firstName || withdrawal.requestedBy}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{naira(withdrawal.amount)}</p>
                        <p className="text-[11px] text-slate-500">{rel(withdrawal.createdAt)}</p>
                      </div>
                    </div>
                    <Input
                      value={withdrawalNotes[withdrawal.id] || ""}
                      onChange={(event) => setWithdrawalNotes((prev) => ({ ...prev, [withdrawal.id]: event.target.value }))}
                      placeholder="Admin note (optional)"
                      className="h-8 bg-slate-900 border-slate-700 text-slate-100"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-[11px] border-0"
                        disabled={decideWithdrawal.isPending}
                        onClick={() => decideWithdrawal.mutate({ id: withdrawal.id, action: "approve", note: withdrawalNotes[withdrawal.id] })}
                      >
                        <ShieldCheck className="w-3 h-3 mr-1" />Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-rose-700 text-rose-300 hover:bg-rose-900/30"
                        disabled={decideWithdrawal.isPending}
                        onClick={() => decideWithdrawal.mutate({ id: withdrawal.id, action: "reject", note: withdrawalNotes[withdrawal.id] })}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {totalProgramMembers} partner members</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {totalProgramChallenges} partner challenges tracked</span>
            <span className="inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> {naira(totalPartnerBalance)} cumulative partner wallet balance</span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

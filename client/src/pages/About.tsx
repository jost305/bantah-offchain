import {
  ShieldCheck,
  Trophy,
  Users,
  MessageSquare,
  Bot,
  CheckCircle2,
  Coins,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const highlights = [
  {
    label: "Escrow Secured",
    value: "100%",
    note: "Locked before challenge starts",
    icon: ShieldCheck,
    iconClass: "text-emerald-600 dark:text-emerald-300",
    chipClass: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  {
    label: "P2P Flow",
    value: "Direct + Open",
    note: "1v1 invites and open-market join",
    icon: Users,
    iconClass: "text-blue-600 dark:text-blue-300",
    chipClass: "bg-blue-100 dark:bg-blue-900/40",
  },
  {
    label: "Settlement",
    value: "Vote + Proof",
    note: "Both sides submit and confirm",
    icon: Trophy,
    iconClass: "text-amber-600 dark:text-amber-300",
    chipClass: "bg-amber-100 dark:bg-amber-900/40",
  },
  {
    label: "Communities",
    value: "Sports, Crypto, Gaming",
    note: "Multiple niches, one challenge engine",
    icon: MessageSquare,
    iconClass: "text-violet-600 dark:text-violet-300",
    chipClass: "bg-violet-100 dark:bg-violet-900/40",
  },
];

const flows = [
  {
    step: "01",
    title: "Create or Accept",
    text: "Start a direct challenge with a friend or accept an open challenge from the board.",
    icon: Users,
  },
  {
    step: "02",
    title: "Play and Submit Proof",
    text: "After the match window closes, both sides upload proof to support their result.",
    icon: MessageSquare,
  },
  {
    step: "03",
    title: "Vote and Settle",
    text: "Both players vote. Matching votes settle instantly, disputes route for review.",
    icon: Trophy,
  },
];

const trustPoints = [
  "Stake is held before challenge starts",
  "Both users can upload proof and vote",
  "Dispute path exists when votes conflict",
  "Leaderboard reflects real settled performance",
];

export default function About() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6 md:space-y-8">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-7 shadow-sm">
          <div className="flex flex-col gap-4">
            <Badge className="w-fit bg-[#ccff00]/30 text-slate-900 dark:text-slate-100 border border-[#ccff00]/50 hover:bg-[#ccff00]/30">
              Built for real P2P challenges
            </Badge>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                  Bantah turns arguments into structured, escrow-backed challenges.
                </h1>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  Create challenges, lock stakes, submit proof, vote outcomes, and settle transparently.
                  No vague flow, no guesswork.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <Button
                    className="h-10 px-5 text-xs font-bold uppercase tracking-wide border-0"
                    onClick={() => (window.location.href = "/challenges")}
                  >
                    Explore Challenges
                  </Button>
                  <Button
                    className="h-10 px-5 text-xs font-bold uppercase tracking-wide border-0 bg-[#ccff00]/70 text-slate-900 hover:bg-[#ccff00]"
                    onClick={() => (window.location.href = "/partner-signup")}
                  >
                    Sign Up as Partner
                  </Button>
                  <Button
                    className="h-10 px-5 text-xs font-bold uppercase tracking-wide border-0 bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={() => (window.location.href = "/friends")}
                  >
                    Find Opponents
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                    Platform Snapshot
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Core Mechanics
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {highlights.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                              {item.label}
                            </p>
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5 leading-tight">
                              {item.value}
                            </p>
                          </div>
                          <span className={`w-8 h-8 rounded-md inline-flex items-center justify-center ${item.chipClass}`}>
                            <Icon className={`w-4 h-4 ${item.iconClass}`} />
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">
                          {item.note}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-7 shadow-sm">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                How it works
              </p>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
                A clean 3-step challenge cycle
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {flows.map((flow) => {
              const Icon = flow.icon;
              return (
                <article
                  key={flow.step}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black text-primary">{flow.step}</span>
                    <span className="w-8 h-8 rounded-md bg-slate-900 dark:bg-slate-800 text-white inline-flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    {flow.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {flow.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Why users trust Bantah</h3>
            </div>
            <div className="space-y-2.5">
              {trustPoints.map((point) => (
                <div key={point} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                  <p className="text-sm text-slate-700 dark:text-slate-300">{point}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-[#ccff00]" />
              <h3 className="text-lg font-black">Meet Bantzz Bot</h3>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed mb-4">
              Join Bantzz on Telegram for updates, challenge prompts, and quick engagement with the community.
            </p>
            <a href="https://t.me/bantzzbot" target="_blank" rel="noopener noreferrer">
              <Button className="h-10 px-4 text-xs font-bold uppercase tracking-wide bg-[#ccff00] text-slate-900 hover:bg-[#ccff00]/90 border-0">
                Open Bantzz
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </a>
            <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-800 p-2.5">
                <p className="text-[11px] text-slate-400">Focus</p>
                <p className="text-sm font-bold">Challenge alerts</p>
              </div>
              <div className="rounded-lg bg-slate-800 p-2.5">
                <p className="text-[11px] text-slate-400">Mode</p>
                <p className="text-sm font-bold">Community-first</p>
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Ready to start?
              </p>
              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100">
                Pick a side, stake smart, settle fairly.
              </h3>
            </div>
            <div className="flex gap-2">
              <Button
                className="h-9 px-4 text-xs font-bold uppercase tracking-wide border-0 bg-[#ccff00]/70 text-slate-900 hover:bg-[#ccff00]"
                onClick={() => (window.location.href = "/partner-signup")}
              >
                Sign Up as Partner
              </Button>
              <Button
                className="h-9 px-4 text-xs font-bold uppercase tracking-wide border-0 bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => (window.location.href = "/leaderboard")}
              >
                <Coins className="w-4 h-4 mr-1.5" />
                Leaderboard
              </Button>
              <Button
                className="h-9 px-4 text-xs font-bold uppercase tracking-wide border-0"
                onClick={() => (window.location.href = "/challenges")}
              >
                Challenges
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

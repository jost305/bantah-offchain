import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { useToast } from '@/hooks/use-toast';
import { getUserDisplayName, usePublicUserBasic } from '@/hooks/usePublicUserBasic';

interface AcceptChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: any;
  onAccept?: () => Promise<void> | void;
  isSubmitting?: boolean;
}

export function AcceptChallengeModal({
  isOpen,
  onClose,
  challenge,
  onAccept,
  isSubmitting = false,
}: AcceptChallengeModalProps) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const challenger = challenge?.challengerUser || null;
  const resolvedChallenger = usePublicUserBasic(challenger?.id, {
    id: challenger?.id,
    firstName: challenger?.firstName ?? challenge?.challengerName ?? null,
    username: challenger?.username ?? null,
    profileImageUrl: challenger?.profileImageUrl ?? null,
  });
  const challengerName = getUserDisplayName(resolvedChallenger, "opponent");

  if (!challenge) return null;

  // Normalize side from multiple payload variants and only render known values.
  const rawChallengerSide =
    challenge?.challengerSide ??
    challenge?.challenger_side ??
    (challenge as any)?.challengerChoice ??
    (challenge as any)?.challenger_choice ??
    (challenge as any)?.selectedSide ??
    (challenge as any)?.side ??
    challenger?.side ??
    null;
  const normalizedChallengerSide = rawChallengerSide
    ? String(rawChallengerSide).trim().toUpperCase()
    : null;
  const normalizedChallengedSide = challenge?.challengedSide
    ? String(challenge.challengedSide).trim().toUpperCase()
    : null;
  let challengerSideBadge =
    normalizedChallengerSide === "YES" || normalizedChallengerSide === "NO"
      ? normalizedChallengerSide
      : null;

  // Legacy fallback: infer creator side if only challengedSide exists.
  if (!challengerSideBadge && (normalizedChallengedSide === "YES" || normalizedChallengedSide === "NO")) {
    challengerSideBadge = normalizedChallengedSide === "YES" ? "NO" : "YES";
  }

  const handleConfirm = async () => {
    try {
      setError(null);
      if (onAccept) {
        await onAccept();
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to accept challenge');
      toast({
        title: 'Error',
        description: err?.message || 'Failed to accept challenge',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xs">
            <DialogHeader className="sr-only">
              <DialogTitle>Accept Challenge</DialogTitle>
              <DialogDescription>
                Confirm acceptance of this challenge and hold stake in escrow.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                userId={challenger?.id}
                username={challenger?.username}
                firstName={challenger?.firstName}
                profileImageUrl={challenger?.profileImageUrl}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{challenge.title}</p>
                <p className="text-xs text-slate-500 flex items-center gap-2 min-w-0">
                  <span className="truncate">From {challengerName}</span>
                  {challengerSideBadge && (
                    <span
                      className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        challengerSideBadge === "YES"
                          ? "bg-emerald-500 text-white"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {challengerSideBadge}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 flex items-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800">
                <div className="flex-1">
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Stake</div>
                  <div className="text-xl md:text-2xl font-extrabold text-emerald-700 dark:text-emerald-200">₦{(parseFloat(String(challenge.amount)) || 0).toLocaleString()}</div>
                </div>
              </div>

              <div className="flex-1 flex items-center p-2 rounded-lg bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800">
                <div className="flex-1 text-right">
                  <div className="text-[11px] text-sky-600 dark:text-sky-400 uppercase font-semibold">Potential win</div>
                  <div className="text-xl md:text-2xl font-extrabold text-sky-700 dark:text-sky-200">₦{((parseFloat(String(challenge.amount)) || 0) * 2).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium">₦{(parseFloat(String(challenge.amount)) || 0).toLocaleString()}</span> will be held in escrow. You can upload proofs and vote after the match.
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="bg-[#7440ff] text-white hover:bg-[#7440ff]"
              >
                {isSubmitting ? 'Accepting...' : `Accept ₦${(parseFloat(String(challenge.amount)) || 0).toLocaleString()}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
    </Dialog>
  );
}

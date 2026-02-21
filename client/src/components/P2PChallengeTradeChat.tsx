import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Flag, Send, Upload, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';
import { apiRequest } from '@/lib/queryClient';

type ChallengeStatus = 'pending' | 'active' | 'awaiting_proofs' | 'voting' | 'completed' | 'disputed';
type ProofStatus = 'not_uploaded' | 'uploaded' | 'verified';
type VoteStatus = 'not_voted' | 'voted' | 'matched' | 'mismatched';

interface P2PChallengeTradeState {
  challengeId: number;
  status: ChallengeStatus;
  challenger: any;
  challenged: any;
  amount: number;
  createdAt: Date;
  acceptedAt?: Date;
  deadline?: Date;

  // Proof states
  challengerProofStatus: ProofStatus;
  challengedProofStatus: ProofStatus;

  // Vote states
  challengerVote?: string;
  challengedVote?: string;
  voteMatchStatus: VoteStatus;

  // Timeline
  timelinePhase: 'awaiting_acceptance' | 'proof_submission' | 'voting' | 'resolution';
  timeRemainingMs?: number;

  // Dispute
  isDisputed: boolean;
  disputeReason?: string;
  disputeOpenedBy?: string;
}

interface Props {
  challenge: any;
  currentUserId: string;
  onOpenDispute?: () => void;
  onVote?: (voteChoice: string) => void;
}

export default function P2PChallengeTradeChat({
  challenge,
  currentUserId,
  onOpenDispute,
  onVote,
}: Props) {
  const { user } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [proofs, setProofs] = useState<any[]>([]);
  const [votes, setVotes] = useState<any>({});
  const [showDisputeMenu, setShowDisputeMenu] = useState(false);
  const [selectedProof, setSelectedProof] = useState<any>(null);

  const isChallenger = currentUserId === challenge?.challenger;
  const opponent = isChallenger ? challenge?.challengedUser : challenge?.challengerUser;
  const opponentId = isChallenger ? challenge?.challenged : challenge?.challenger;

  // Fetch proofs and votes
  useEffect(() => {
    if (!challenge?.id) return;

    const fetchData = async () => {
      try {
        const [proofsRes, votesRes] = await Promise.all([
          fetch(`/api/challenges/${challenge.id}/proofs`, { credentials: 'include' }),
          fetch(`/api/challenges/${challenge.id}/votes`, { credentials: 'include' }),
        ]);

        if (proofsRes.ok) {
          setProofs(await proofsRes.json());
        }
        if (votesRes.ok) {
          setVotes(await votesRes.json());
        }
      } catch (err) {
        console.error('Failed to fetch challenge data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [challenge?.id]);

  // Calculate countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (challenge?.acceptedAt) {
        const acceptedTime = new Date(challenge.acceptedAt).getTime();
        const expiryTime = acceptedTime + 10 * 60 * 1000; // 10 min deadline
        const now = Date.now();
        const remaining = expiryTime - now;

        if (remaining > 0) {
          setTimeRemaining(remaining);
        } else {
          setTimeRemaining(0);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge?.acceptedAt]);

  const formatTimeRemaining = (ms: number | null) => {
    if (ms === null || ms === 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getChallengerProofStatus = () => {
    const proof = proofs.find((p) => p.participant_id === challenge?.challenger);
    return proof ? 'uploaded' : 'not_uploaded';
  };

  const getChallengedProofStatus = () => {
    const proof = proofs.find((p) => p.participant_id === challenge?.challenged);
    return proof ? 'uploaded' : 'not_uploaded';
  };

  const challengerProofStatus = getChallengerProofStatus();
  const challengedProofStatus = getChallengedProofStatus();

  const challengerHasVoted = !!votes[challenge?.challenger];
  const challengedHasVoted = !!votes[challenge?.challenged];

  // Determine trade phase
  const phaseLabel =
    challenge?.status === 'active'
      ? challengerProofStatus === 'uploaded' && challengedProofStatus === 'uploaded'
        ? 'Voting Phase'
        : 'Proof Submission'
      : 'Awaiting Acceptance';

  const handleUploadProof = async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    try {
      const uploadRes = await fetch('/api/upload/image', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');

      const { imageUrl } = await uploadRes.json();
      const arrayBuffer = await file.arrayBuffer();
      const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuf));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      await apiRequest('POST', `/api/challenges/${challenge.id}/proofs`, {
        proofUri: imageUrl,
        proofHash: hashHex,
      });

      // Refresh proofs
      const res = await fetch(`/api/challenges/${challenge.id}/proofs`, { credentials: 'include' });
      if (res.ok) setProofs(await res.json());
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload proof');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with trade info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-blue-900 dark:text-blue-200">Trade Phase:</span>
            <span className="text-blue-700 dark:text-blue-300">{phaseLabel}</span>
          </div>
          {timeRemaining !== null && (
            <div className={`text-lg font-bold ${timeRemaining < 60000 ? 'text-red-600' : 'text-blue-600'}`}>
              {formatTimeRemaining(timeRemaining)}
            </div>
          )}
        </div>

        {/* Trade info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <UserAvatar
                userId={challenge?.challengerUser?.id || ''}
                username={challenge?.challengerUser?.username}
                size={40}
              />
              <div className="text-xs mt-1 font-semibold">{challenge?.challengerUser?.firstName || 'Challenger'}</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">VS</div>
              <div className="text-xs text-slate-500 mt-1">₦{(challenge?.amount || 0).toLocaleString()}</div>
            </div>

            <div className="text-center">
              <UserAvatar
                userId={challenge?.challengedUser?.id || ''}
                username={challenge?.challengedUser?.username}
                size={40}
              />
              <div className="text-xs mt-1 font-semibold">{challenge?.challengedUser?.firstName || 'Challenged'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Proof Submission Status */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 className="font-semibold mb-3">📤 Proof Submission</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Challenger proof status */}
          <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-2">
              {challengerProofStatus === 'uploaded' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              <span className="text-sm font-medium">
                {isChallenger ? 'You' : challenge?.challengerUser?.firstName}
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {challengerProofStatus === 'uploaded' ? '✓ Proof uploaded' : '⏳ Awaiting proof...'}
            </div>
          </div>

          {/* Challenged proof status */}
          <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-2">
              {challengedProofStatus === 'uploaded' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              <span className="text-sm font-medium">
                {!isChallenger ? 'You' : challenge?.challengedUser?.firstName}
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {challengedProofStatus === 'uploaded' ? '✓ Proof uploaded' : '⏳ Awaiting proof...'}
            </div>
          </div>
        </div>

        {/* Proof upload area */}
        {challenge?.status === 'active' && !selectedProof && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer"
               onClick={() => {
                 const input = document.createElement('input');
                 input.type = 'file';
                 input.accept = 'image/*,video/*';
                 input.onchange = async (e) => {
                   const file = (e.target as HTMLInputElement).files?.[0];
                   if (file) {
                     await handleUploadProof(file);
                   }
                 };
                 input.click();
               }}>
            <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Click to upload proof</div>
            <div className="text-xs text-slate-500">or drag & drop</div>
          </div>
        )}

        {/* Proofs gallery */}
        {proofs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {proofs.map((proof) => (
              <div
                key={proof.id}
                className="relative cursor-pointer group"
                onClick={() => setSelectedProof(proof)}
              >
                <img
                  src={proof.proof_uri}
                  alt="proof"
                  className="w-full aspect-square object-cover rounded-lg group-hover:opacity-80 transition"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected proof preview */}
        {selectedProof && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex gap-4">
              <img src={selectedProof.proof_uri} alt="selected" className="w-24 h-24 rounded-lg object-cover" />
              <div className="flex-1">
                <div className="font-semibold mb-2">Selected Proof</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-3 break-all">
                  Hash: {selectedProof.proof_hash}
                </div>
                <Button
                  onClick={() => onVote?.(selectedProof.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Confirm & Vote
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Voting Status */}
      {challengerProofStatus === 'uploaded' && challengedProofStatus === 'uploaded' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h3 className="font-semibold mb-3">🗳️ Voting Phase</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 mb-2">
                {challengerHasVoted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
                <span className="text-sm font-medium">
                  {isChallenger ? 'Your Vote' : challenge?.challengerUser?.firstName}
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {challengerHasVoted ? '✓ Voted' : '⏳ Awaiting vote...'}
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 mb-2">
                {challengedHasVoted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
                <span className="text-sm font-medium">
                  {!isChallenger ? 'Your Vote' : challenge?.challengedUser?.firstName}
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {challengedHasVoted ? '✓ Voted' : '⏳ Awaiting vote...'}
              </div>
            </div>
          </div>

          {challenge?.status === 'active' && !challengerHasVoted && isChallenger && (
            <Button className="w-full" onClick={() => onVote?.('yes')}>
              Vote on Challenger Win
            </Button>
          )}
          {challenge?.status === 'active' && !challengedHasVoted && !isChallenger && (
            <Button className="w-full" onClick={() => onVote?.('no')}>
              Vote on Challenged Win
            </Button>
          )}
        </div>
      )}

      {/* Dispute Section */}
      {challenge?.status !== 'completed' && (
        <div className="relative">
          <Button
            variant="outline"
            className="w-full border-red-200 hover:border-red-400 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
            onClick={() => setShowDisputeMenu(!showDisputeMenu)}
          >
            <Flag className="w-4 h-4 mr-2" />
            Report Issue / Open Dispute
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>

          {showDisputeMenu && (
            <div className="absolute bottom-full mb-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 space-y-2 z-10">
              <button
                className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600"
                onClick={() => {
                  onOpenDispute?.();
                  setShowDisputeMenu(false);
                }}
              >
                Opponent not responding
              </button>
              <button
                className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600"
                onClick={() => {
                  onOpenDispute?.();
                  setShowDisputeMenu(false);
                }}
              >
                Invalid proof submitted
              </button>
              <button
                className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600"
                onClick={() => {
                  onOpenDispute?.();
                  setShowDisputeMenu(false);
                }}
              >
                Other issue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { Check, X, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Proof = {
  id: number;
  proof_uri: string;
  proof_hash: string;
  participant_id?: string;
  uploaded_at?: string;
};

type Vote = {
  userId: string;
  choice: 'challenger' | 'challenged';
  timestamp: string;
};

interface P2PChallengeTradeProps {
  challengeId: number;
  challenge: any;
  onVote?: () => void;
  userRole: 'challenger' | 'challenged' | null;
  compact?: boolean;
  hideVotingSection?: boolean;
  hideProofSection?: boolean;
  quickVote?: {
    onMyVote: () => void;
    onOppVote: () => void;
    myLabel?: string;
    oppLabel?: string;
  };
}

export default function P2PChallengeTradePanel({
  challengeId,
  challenge,
  onVote,
  userRole,
  compact = false,
  hideVotingSection = false,
  hideProofSection = false,
  quickVote,
}: P2PChallengeTradeProps) {
  const { user } = useAuth();
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [votes, setVotes] = useState<{ [key: string]: Vote }>({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedProof, setSelectedProof] = useState<Proof | null>(null);
  const [myVote, setMyVote] = useState<'challenger' | 'challenged' | null>(null);
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const [showDisputeMenu, setShowDisputeMenu] = useState(false);
  const [showProofMenu, setShowProofMenu] = useState(false);
  const [status, setStatus] = useState<'uploading' | 'voting' | 'released' | 'disputed' | 'auto-released' | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [isProofsModalOpen, setIsProofsModalOpen] = useState(false);

  // Calculate countdown from challenge due date
  useEffect(() => {
    if (!challenge?.dueDate) return;
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const due = new Date(challenge.dueDate).getTime();
      const remaining = Math.max(0, due - now);
      setCountdownTime(remaining);
      
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge?.dueDate]);

  useEffect(() => {
    fetchProofs();
    fetchVotes();
  }, [challengeId]);

  async function fetchProofs() {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/proofs`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setProofs(data || []);
    } catch (err) {
      console.error('Error fetching proofs:', err);
    }
  }

  async function fetchVotes() {
    try {
      const res = await fetch(`/api/admin/challenges/${challengeId}/votes`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const voteMap: { [key: string]: Vote } = {};
      data.forEach((v: any) => {
        voteMap[v.userId] = {
          userId: v.userId,
          choice: v.choice,
          timestamp: v.timestamp,
        };
      });
      setVotes(voteMap);

      // Check if votes match for auto-release
      if (Object.keys(voteMap).length === 2) {
        const voteChoices = Object.values(voteMap).map(v => v.choice);
        if (voteChoices[0] === voteChoices[1]) {
          setStatus('auto-released');
        }
      }
    } catch (err) {
      console.error('Error fetching votes:', err);
    }
  }

  async function handleFile(file: File): Promise<boolean> {
    setUploading(true);
    setProgress(5);
    setStatus('uploading');

    try {
      // Upload file
      const form = new FormData();
      form.append('image', file);
      const uploadRes = await fetch('/api/upload/image', { method: 'POST', credentials: 'include', body: form });
      if (!uploadRes.ok) {
        let uploadMessage = 'Upload failed';
        try {
          const errJson = await uploadRes.json();
          if (errJson?.message) uploadMessage = String(errJson.message);
        } catch {
          // ignore json parse errors
        }
        alert(uploadMessage);
        setUploading(false);
        setStatus(null);
        return false;
      }
      const uploadJson = await uploadRes.json();
      setProgress(40);

      // Compute hash
      const arrayBuffer = await file.arrayBuffer();
      const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuf));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setProgress(60);

      // Register proof
      const proof = await apiRequest('POST', `/api/challenges/${challengeId}/proofs`, {
        proofUri: uploadJson.imageUrl,
        proofHash: hashHex,
      });
      setProgress(90);
      await fetchProofs();
      setUploading(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 700);
      setSelectedProof(proof);
      setStatus('voting');
      return true;
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert(err?.message || 'Upload failed');
      setUploading(false);
      setStatus(null);
      return false;
    }
  }

  async function handleVote(choice: 'challenger' | 'challenged') {
    if (!selectedProof) {
      alert('Please select a proof first');
      return;
    }

    try {
      await apiRequest('POST', `/api/challenges/${challengeId}/vote`, {
        voteChoice: choice,
        proofHash: selectedProof.proof_hash,
      });
      setMyVote(choice);
      await fetchVotes();
    } catch (err) {
      console.error('Error voting:', err);
      alert('Vote failed');
    }
  }

  async function handleOpenDispute() {
    try {
      await apiRequest('POST', `/api/challenges/${challengeId}/dispute`, {});
      setStatus('disputed');
      setShowDisputeMenu(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to open dispute');
    }
  }

  function openProofUploadModal() {
    if (uploading || status === 'released' || status === 'disputed') return;
    setPendingUploadFile(null);
    setShowProofMenu(false);
    setIsUploadModalOpen(true);
  }

  async function confirmProofUpload() {
    if (!pendingUploadFile) return;
    const success = await handleFile(pendingUploadFile);
    if (success) {
      setIsUploadModalOpen(false);
      setPendingUploadFile(null);
    }
  }

  const opponentId = userRole === 'challenger' ? challenge?.challengedUser?.id : challenge?.challengerUser?.id;
  const opponentName = userRole === 'challenger' ? challenge?.challengedUser?.firstName || challenge?.challengedUser?.username : challenge?.challengerUser?.firstName || challenge?.challengerUser?.username;
  const opponentHasVoted = opponentId && !!votes[opponentId];
  const currentUserVote = user?.id && votes[user.id];
  const bothVoted = Object.keys(votes).length === 2;
  const votesMatch = bothVoted && Object.values(votes).every((v: Vote) => v.choice === Object.values(votes)[0].choice);

  const formatCountdown = (ms: number | null) => {
    if (ms === null || ms <= 0) return 'Expired';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const containerClass = compact
    ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 shadow-sm"
    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-md";
  const sectionSpacingClass = compact ? "mb-2" : "mb-4";
  const proofImageHeightClass = compact ? "h-14" : "h-20";
  const voteRowTextClass = compact ? "text-xs" : "text-sm";
  const canSubmitVote = !!selectedProof && status !== 'released' && status !== 'disputed';
  const hasStatusBadge = status === 'auto-released' || status === 'disputed';
  const getProofOwnerLabel = (proof: Proof) => {
    if (proof.participant_id === user?.id) return 'You';
    if (proof.participant_id === challenge?.challengerUser?.id) {
      return challenge?.challengerUser?.firstName || challenge?.challengerUser?.username || 'Challenger';
    }
    if (proof.participant_id === challenge?.challengedUser?.id) {
      return challenge?.challengedUser?.firstName || challenge?.challengedUser?.username || 'Opponent';
    }
    return 'Participant';
  };

  return (
    <div className={containerClass}>
      {(hasStatusBadge || !compact) && (
      <div className={`flex items-center ${hasStatusBadge ? "justify-between" : "justify-end"} ${compact ? "mb-2" : "mb-4"}`}>
        <div className="flex items-center gap-2">
          {status === 'auto-released' && (
            <>
              <Check className="w-5 h-5 text-green-500" />
              <span className={`${voteRowTextClass} font-semibold text-green-600 dark:text-green-400`}>Released</span>
            </>
          )}
          {status === 'disputed' && (
            <>
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <span className={`${voteRowTextClass} font-semibold text-orange-600 dark:text-orange-400`}>Disputed</span>
            </>
          )}
        </div>
        {!compact && (
          <div className={`flex items-center gap-2 ${voteRowTextClass} text-slate-600 dark:text-slate-400`}>
            <Clock className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
            <span>{formatCountdown(countdownTime)}</span>
          </div>
        )}
      </div>
      )}

      {/* Proofs Section */}
      {!hideProofSection && (
      <div id={`proofs-section-${challengeId}`} className={sectionSpacingClass}>
        <div className={`flex items-center justify-between ${compact ? "mb-1.5" : "mb-2"}`}>
          <h4 className={`${voteRowTextClass} font-semibold`}>Proofs</h4>
          <span className="text-xs text-slate-500">{proofs.length} uploaded</span>
        </div>
        <div className={`grid ${compact ? "grid-cols-4" : "grid-cols-3 md:grid-cols-4"} gap-2 ${compact ? "mb-2" : "mb-3"}`}>
          {proofs.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedProof(p)}
              className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${
                selectedProof?.id === p.id ? 'ring-2 ring-blue-500 scale-105' : 'hover:opacity-80'
              }`}
            >
              <img src={p.proof_uri} alt="proof" className={`w-full ${proofImageHeightClass} object-cover`} />
              {p.participant_id === user?.id && (
                <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">You</div>
              )}
            </div>
          ))}
        </div>

        {/* Upload Button */}
        <Button
          onClick={openProofUploadModal}
          disabled={uploading || status === 'released' || status === 'disputed'}
          className={`w-full ${compact ? "h-8 text-xs mb-1.5" : "mb-2"}`}
        >
          {uploading ? `Uploading ${progress}%` : 'Upload Proof'}
        </Button>

        {uploading && <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded overflow-hidden mb-2">
          <div style={{ width: `${progress}%` }} className="h-2 bg-blue-500 transition-all" />
        </div>}
      </div>
      )}

      {/* Voting Section */}
      {!hideVotingSection && (
      <div className={`${sectionSpacingClass} ${compact ? "p-2" : "p-3"} bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg`}>
        <div className={`flex items-center justify-between ${compact ? "mb-2" : "mb-3"}`}>
          <div>
            <p className={`${voteRowTextClass} font-semibold text-slate-900 dark:text-slate-100`}>Cast Your Vote</p>
            {!compact && (
              <p className="text-xs text-slate-600 dark:text-slate-400">Both must agree to auto-release funds</p>
            )}
          </div>
          {currentUserVote && (
            <div className={`${voteRowTextClass} font-bold text-green-600 dark:text-green-400`}>Voted</div>
          )}
        </div>

        {!selectedProof && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 mb-2">
            Select a proof first to enable voting.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleVote('challenger')}
            variant={myVote === 'challenger' ? 'default' : 'outline'}
            disabled={!canSubmitVote}
            className={compact ? "h-8 text-xs" : "text-sm"}
          >
            {userRole === 'challenger' ? 'I Won' : 'Challenger Won'}
          </Button>
          <Button
            onClick={() => handleVote('challenged')}
            variant={myVote === 'challenged' ? 'default' : 'outline'}
            disabled={!canSubmitVote}
            className={compact ? "h-8 text-xs" : "text-sm"}
          >
            {userRole === 'challenged' ? 'I Won' : 'Challenged Won'}
          </Button>
        </div>
      </div>
      )}
      {/* Vote - Opponent Visibility */}
      <div className={`${sectionSpacingClass} ${compact ? "p-2" : "p-3"} bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`${voteRowTextClass} font-semibold`}>Vote</p>
          {quickVote && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                onClick={quickVote.onMyVote}
                className={`${compact ? "h-7 text-[11px] px-2" : "h-8 text-xs px-2"} border-slate-300 dark:border-slate-600`}
              >
                {quickVote.myLabel || "I Won"}
              </Button>
              <Button
                variant="outline"
                onClick={quickVote.onOppVote}
                className={`${compact ? "h-7 text-[11px] px-2" : "h-8 text-xs px-2"} border-slate-300 dark:border-slate-600`}
              >
                {quickVote.oppLabel || "Opp Won"}
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setShowProofMenu((v) => !v)}
                  className={`${compact ? "h-7 text-[11px] px-2" : "h-8 text-xs px-2"} border-slate-300 dark:border-slate-600`}
                >
                  Proof
                  <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showProofMenu ? "rotate-180" : ""}`} />
                </Button>
                {showProofMenu && (
                  <div className="absolute right-0 mt-1 w-32 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-20">
                    <button
                      onClick={() => {
                        openProofUploadModal();
                        setShowProofMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Upload Proof
                    </button>
                    <button
                      onClick={() => {
                        setIsProofsModalOpen(true);
                        setShowProofMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border-t border-slate-200 dark:border-slate-700"
                    >
                      View Proofs
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {/* My Vote */}
          <div className={`flex items-center justify-between ${voteRowTextClass}`}>
            <span className="text-slate-700 dark:text-slate-300">
              Your Vote
            </span>
            {currentUserVote ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
                <Check className="w-4 h-4" />
                {currentUserVote.choice === 'challenger' ? 'Challenger' : 'Challenged'}
              </div>
            ) : (
              <span className="text-slate-500">Waiting...</span>
            )}
          </div>

          {/* Opponent Vote */}
          <div className={`flex items-center justify-between ${voteRowTextClass}`}>
            <span className="text-slate-700 dark:text-slate-300">
              {opponentName}'s Vote
            </span>
            {opponentHasVoted ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
                <Check className="w-4 h-4" />
                {votes[opponentId!]?.choice === 'challenger' ? 'Challenger' : 'Challenged'}
              </div>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">Pending</span>
            )}
          </div>

          {/* Vote Result */}
          {bothVoted && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              {votesMatch ? (
                <div className={`flex items-center gap-2 text-green-600 dark:text-green-400 font-bold ${voteRowTextClass}`}>
                  <Check className="w-4 h-4" />
                  Votes Match - Funds Released
                </div>
              ) : (
                <div className={`flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold ${voteRowTextClass}`}>
                  <X className="w-4 h-4" />
                  Votes Disagree - Dispute Opened
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dispute Menu */}
      {bothVoted && !votesMatch && (
        <div className={`${sectionSpacingClass} ${compact ? "p-2" : "p-3"} bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${voteRowTextClass} font-bold text-orange-900 dark:text-orange-100`}>Vote Mismatch</p>
              <p className="text-xs text-orange-800 dark:text-orange-200">Admin will review evidence and resolve</p>
            </div>
            {!showDisputeMenu && (
              <Button
                onClick={() => setShowDisputeMenu(true)}
                variant="outline"
                size="sm"
                className="text-orange-600 dark:text-orange-400"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            )}
          </div>
          {showDisputeMenu && (
            <div className="mt-3">
              <Button
                onClick={handleOpenDispute}
                variant="destructive"
                className={`w-full ${compact ? "h-8 text-xs" : ""}`}
                disabled={status === 'disputed'}
              >
                {status === 'disputed' ? 'Dispute Opened' : 'Open Dispute'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Auto-Release Info */}
      {votesMatch && (
        <div className={`${compact ? "p-2" : "p-3"} bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg`}>
          <div className={`flex items-center gap-2 ${compact ? "mb-1" : "mb-2"}`}>
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className={`${voteRowTextClass} font-semibold text-green-900 dark:text-green-100`}>Transaction Complete</p>
          </div>
          <p className={`${voteRowTextClass} text-green-800 dark:text-green-200`}>
            Funds have been automatically released to {votesMatch ? 'the winner' : 'both parties'}.
          </p>
        </div>
      )}

      <Dialog
        open={isUploadModalOpen}
        onOpenChange={(open) => {
          setIsUploadModalOpen(open);
          if (!open && !uploading) {
            setPendingUploadFile(null);
          }
        }}
      >
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Upload Proof</DialogTitle>
            <DialogDescription className="text-xs">
              Select an image proof (JPEG, PNG, GIF, WebP, max 5MB).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPendingUploadFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
              className="w-full text-xs text-slate-700 dark:text-slate-200 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium dark:file:bg-slate-700"
            />
            {pendingUploadFile && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {pendingUploadFile.name}
              </p>
            )}
            {uploading && (
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded overflow-hidden">
                <div style={{ width: `${progress}%` }} className="h-2 bg-blue-500 transition-all" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUploadModalOpen(false)}
              disabled={uploading}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmProofUpload}
              disabled={!pendingUploadFile || uploading}
              className="h-8 text-xs"
            >
              {uploading ? `Uploading ${progress}%` : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProofsModalOpen} onOpenChange={setIsProofsModalOpen}>
        <DialogContent className="max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Uploaded Proofs</DialogTitle>
            <DialogDescription className="text-xs">
              {proofs.length} proof{proofs.length === 1 ? '' : 's'} uploaded for this challenge.
            </DialogDescription>
          </DialogHeader>
          {proofs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">No proofs uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {proofs.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProof(p);
                    setIsProofsModalOpen(false);
                  }}
                  className={`text-left rounded-lg overflow-hidden border ${
                    selectedProof?.id === p.id
                      ? 'border-blue-500 ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <img src={p.proof_uri} alt="proof" className="w-full h-20 object-cover" />
                  <div className="px-1.5 py-1 bg-white dark:bg-slate-900">
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">{getProofOwnerLabel(p)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProofsModalOpen(false)} className="h-8 text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



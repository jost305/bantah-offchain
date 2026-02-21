import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

type Proof = {
  id: number;
  proof_uri: string;
  proof_hash: string;
  participant_id?: string;
  uploaded_at?: string;
};

export default function ProofUploadPanel({ challengeId, onVote }: { challengeId: number; onVote?: () => void }) {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedProof, setSelectedProof] = useState<Proof | null>(null);

  useEffect(() => {
    fetchProofs();
  }, [challengeId]);

  async function fetchProofs() {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/proofs`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setProofs(data || []);
    } catch (err) {
      // ignore
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setProgress(5);

    // Upload file
    const form = new FormData();
    form.append('image', file);
    const uploadRes = await fetch('/api/upload/image', { method: 'POST', credentials: 'include', body: form });
    if (!uploadRes.ok) {
      setUploading(false);
      alert('Upload failed');
      return;
    }
    const uploadJson = await uploadRes.json();
    setProgress(40);

    // compute hash
    const arrayBuffer = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    setProgress(60);

    // register proof
    const proof = await apiRequest('POST', `/api/challenges/${challengeId}/proofs`, { proofUri: uploadJson.imageUrl, proofHash: hashHex });
    setProgress(90);
    await fetchProofs();
    setUploading(false);
    setProgress(100);
    setTimeout(() => setProgress(0), 700);
    setSelectedProof(proof);
    return proof;
  }

  function openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      await handleFile(input.files[0]);
    };
    input.click();
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm max-h-56 overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Proofs & Vote</div>
        <div className="text-xs text-slate-500">Both parties must submit proof to auto-release</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="space-y-2">
            {(proofs.length === 0) && (
              <div className="text-xs text-slate-500">No proofs uploaded yet.</div>
            )}
            {proofs.map((p) => (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer" onClick={() => setSelectedProof(p)}>
                <img src={p.proof_uri} alt="proof" className="w-12 h-12 md:w-16 md:h-16 object-cover rounded" />
                <div className="flex-1 text-xs">
                  <div className="truncate">{p.proof_uri.split('/').pop()}</div>
                  <div className="text-[10px] text-slate-400">{new Date(p.uploaded_at || Date.now()).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={openFilePicker} disabled={uploading}>Upload proof</Button>
            <div className="text-xs text-slate-500">or drag & drop (coming soon)</div>
          </div>

          {uploading && (
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded overflow-hidden">
              <div style={{ width: `${progress}%` }} className="h-2 bg-green-500" />
            </div>
          )}

          {selectedProof && (
            <div className="mt-2 p-2 border rounded bg-slate-50 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <img src={selectedProof.proof_uri} alt="selected" className="w-20 h-20 md:w-24 md:h-24 object-cover rounded" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Selected proof</div>
                  <div className="text-xs text-slate-500 break-words">Hash: {selectedProof.proof_hash}</div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <div className="w-full sm:w-auto">
                      <Button onClick={async () => {
                        if (onVote) onVote();
                      }} className="w-full sm:w-auto">Vote (use this proof)</Button>
                    </div>
                    <div className="w-full sm:w-auto">
                      <Button variant="ghost" onClick={() => setSelectedProof(null)} className="w-full sm:w-auto">Clear</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

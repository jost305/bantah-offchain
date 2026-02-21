import React, { useEffect, useState } from 'react';

export default function AdminChallengePage({ challengeId }: { challengeId?: number }) {
  const [votes, setVotes] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolution, setResolution] = useState<string>('');

  useEffect(() => {
    if (!challengeId) return;
    fetchAll();
  }, [challengeId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [vRes, pRes, hRes, mRes] = await Promise.all([
        fetch(`/api/admin/challenges/${challengeId}/votes`, { credentials: 'include' }),
        fetch(`/api/admin/challenges/${challengeId}/proofs`, { credentials: 'include' }),
        fetch(`/api/admin/challenges/${challengeId}/state-history`, { credentials: 'include' }),
        fetch(`/api/admin/challenges/${challengeId}/messages`, { credentials: 'include' }),
      ]);
      if (vRes.ok) setVotes(await vRes.json());
      if (pRes.ok) setProofs(await pRes.json());
      if (hRes.ok) setHistory(await hRes.json());
      if (mRes.ok) setMessages(await mRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function postResolve(type: string) {
    if (!challengeId) return;
    const body: any = { resolution: { type } };
    if (type === 'winner') {
      const winnerId = window.prompt('Enter winner participant id');
      if (!winnerId) return;
      body.resolution.winnerParticipantId = winnerId;
    }
    if (type === 'split') {
      const a = window.prompt('Enter split JSON (e.g. [{"participantId":"id","pct":50},{"participantId":"id2","pct":50}])');
      try {
        body.resolution.split = JSON.parse(a || '[]');
      } catch (err) {
        alert('Invalid JSON');
        return;
      }
    }

    const res = await fetch(`/api/admin/challenges/${challengeId}/resolve`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      alert('Resolved');
      fetchAll();
    } else {
      alert('Resolve failed');
    }
  }

  if (!challengeId) return <div>Select a challenge</div>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Admin: Challenge {challengeId}</h2>
      {loading && <div>Loading...</div>}

      <section className="mb-4">
        <h3 className="font-semibold">Votes</h3>
        <ul className="divide-y">
          {votes.map(v => (
            <li key={v.id} className="py-2">
              <div><strong>{v.username || v.participant_id}</strong> — {v.vote_choice}</div>
              <div className="text-xs text-slate-500">proof: {v.proof_hash} — at {v.submitted_at}</div>
              <div className="text-xs">signed: {v.signed_vote?.slice?.(0,80)}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <h3 className="font-semibold">Proofs</h3>
        <div className="grid grid-cols-2 gap-2">
          {proofs.map(p => (
            <div key={p.id} className="border p-2">
              <img src={p.proof_uri} alt="proof" className="w-full h-36 object-cover" />
              <div className="text-xs mt-1">{p.username || p.participant_id} — {p.proof_hash}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="font-semibold">State History</h3>
        <ul className="text-xs text-slate-600">
          {history.map(h => (
            <li key={h.id}>{h.changed_at} — {h.prev_state} → {h.new_state} — {h.note}</li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <h3 className="font-semibold">Messages</h3>
        <div className="max-h-48 overflow-auto border p-2">
          {messages.map(m => (
            <div key={m.id} className="mb-2 text-sm">
              <div className="text-xs text-slate-500">{m.username || m.user_id} • {m.created_at}</div>
              <div>{m.message}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="font-semibold">Resolve</h3>
        <div className="flex gap-2">
          <button onClick={() => postResolve('refund')} className="px-3 py-1 bg-gray-200 rounded">Refund</button>
          <button onClick={() => postResolve('winner')} className="px-3 py-1 bg-green-200 rounded">Pick Winner</button>
          <button onClick={() => postResolve('split')} className="px-3 py-1 bg-yellow-200 rounded">Split</button>
        </div>
      </section>
    </div>
  );
}

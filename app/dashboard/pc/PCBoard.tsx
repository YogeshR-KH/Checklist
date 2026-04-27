'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Instance = {
  id: string;
  status: string;
  dueDatetime: string;
  isAbsentSwap: boolean;
  followUpNotes: { note: string; created_by: string; created_at: string }[];
  task: { title: string; isCritical: boolean };
  doer: { fullName: string };
};

export default function PCBoard({
  todays, overdue, doers, filters
}: {
  todays: Instance[];
  overdue: Instance[];
  doers: { id: string; fullName: string }[];
  filters: { doer: string; from: string; to: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(k: string, v: string) {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v); else sp.delete(k);
    router.push(`/dashboard/pc?${sp.toString()}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">PC Dashboard</h1>

      <div className="card grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Filter by doer</label>
          <select className="input" value={filters.doer} onChange={(e) => setParam('doer', e.target.value)}>
            <option value="">All doers</option>
            {doers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={filters.from} onChange={(e) => setParam('from', e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={filters.to} onChange={(e) => setParam('to', e.target.value)} />
        </div>
      </div>

      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Today's Tasks ({todays.length})</h2>
        <div className="space-y-3">
          {todays.map((i) => <InstanceCard key={i.id} ins={i} variant="pending" />)}
          {todays.length === 0 && <p className="text-sm text-gray-500">All clear today.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-danger mb-3">Overdue ({overdue.length})</h2>
        <div className="space-y-3">
          {overdue.map((i) => <InstanceCard key={i.id} ins={i} variant="overdue" />)}
          {overdue.length === 0 && <p className="text-sm text-gray-500">No overdue tasks.</p>}
        </div>
      </section>
    </div>
  );
}

function InstanceCard({ ins, variant }: { ins: Instance; variant: 'pending' | 'overdue' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/instances/${ins.id}/follow-up`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note })
    });
    setBusy(false);
    if (res.ok) {
      setNote('');
      setOpen(false);
      router.refresh();
    }
  }

  const due = new Date(ins.dueDatetime);
  return (
    <div className={variant === 'overdue' ? 'card-overdue' : 'card-pending'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{ins.task.title}</h3>
            {ins.task.isCritical && <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold">CRITICAL</span>}
            {ins.isAbsentSwap && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">BACKUP</span>}
          </div>
          <p className="text-xs text-gray-700 mt-1">
            Doer: <span className="font-medium">{ins.doer.fullName}</span> · Due {due.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={() => setOpen(!open)} className="text-xs underline text-primary whitespace-nowrap">
          {open ? 'Cancel' : 'Add note'}
        </button>
      </div>

      {ins.followUpNotes.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-gray-700">
          {ins.followUpNotes.map((n, idx) => (
            <li key={idx} className="border-l-2 border-gray-300 pl-2">
              <span className="text-gray-500">{new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {' — '}{n.note}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 flex gap-2">
          <input
            className="input text-sm"
            placeholder="Follow-up note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn-primary text-sm whitespace-nowrap" onClick={addNote} disabled={busy || !note.trim()}>
            {busy ? '…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

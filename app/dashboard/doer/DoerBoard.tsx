'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Instance = {
  id: string;
  status: string;
  dueDatetime: string;
  completedAt: string | null;
  remarks: string | null;
  task: { title: string; remarksRequired: boolean; isCritical: boolean };
};

export default function DoerBoard({
  instances, score
}: {
  instances: Instance[];
  score: { missed: number; late: number };
}) {
  const pending = instances.filter((i) => i.status !== 'done');
  const done = instances.filter((i) => i.status === 'done');

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-xl font-semibold">My Tasks Today</h1>

      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-3">To do ({pending.length})</h2>
        <div className="space-y-3">
          {pending.map((i) => <TaskCard key={i.id} ins={i} />)}
          {pending.length === 0 && <p className="text-sm text-gray-500">Nothing pending. Nice.</p>}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Done today ({done.length})</h2>
          <div className="space-y-3">
            {done.map((i) => (
              <div key={i.id} className="card-done">
                <h3 className="font-semibold line-through text-gray-500">{i.task.title}</h3>
                {i.remarks && <p className="text-xs text-gray-600 mt-1">Remarks: {i.remarks}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-primary text-white px-4 py-3 text-xs flex justify-around">
        <div><span className="font-bold text-base text-danger-200">{score.missed}</span> tasks missed this month</div>
        <div><span className="font-bold text-base">{score.late}</span> tasks completed late this month</div>
      </div>
    </div>
  );
}

function TaskCard({ ins }: { ins: Instance }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const overdue = new Date(ins.dueDatetime) < new Date();
  const needsRemarks = ins.task.remarksRequired;
  const canComplete = !needsRemarks || remarks.trim().length > 0;

  async function markDone() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/instances/${ins.id}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ remarks: remarks.trim() || null })
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'Failed');
      return;
    }
    router.refresh();
  }

  const due = new Date(ins.dueDatetime);
  return (
    <div className={overdue ? 'card-overdue' : 'card-pending'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{ins.task.title}</h3>
            {ins.task.isCritical && <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold">CRITICAL</span>}
            {needsRemarks && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">REMARKS</span>}
          </div>
          <p className="text-xs text-gray-700 mt-1">
            Due {due.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {overdue && <span className="text-danger ml-1 font-medium">(overdue)</span>}
          </p>
        </div>
      </div>
      {needsRemarks && (
        <input
          className="input mt-3 text-sm"
          placeholder="Remarks (required)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      )}
      {err && <p className="text-xs text-danger mt-2">{err}</p>}
      <div className="mt-3 flex justify-end">
        <button
          className="btn-accent text-sm"
          onClick={markDone}
          disabled={busy || !canComplete}
        >
          {busy ? 'Saving…' : 'Mark Done'}
        </button>
      </div>
    </div>
  );
}

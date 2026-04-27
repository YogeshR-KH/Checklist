'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Profile = {
  id: string; fullName: string;
  role: 'super_admin' | 'admin' | 'pc' | 'doer';
  isActive: boolean;
};

type Task = {
  id: string;
  title: string;
  deadlineTime: string;
  frequency: string;
  isCritical: boolean;
  remarksRequired: boolean;
  isActive: boolean;
  doer: { id: string; fullName: string };
  backupDoer: { id: string; fullName: string } | null;
  pc: { id: string; fullName: string };
};

const FREQS = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['fortnightly', 'Fortnightly'],
  ['monthly', 'Monthly'],
  ['first_sunday', 'Every 1st Sunday'],
  ['second_sunday', 'Every 2nd Sunday'],
  ['half_yearly', 'Half-Yearly'],
  ['yearly', 'Yearly'],
  ['custom', 'Custom']
] as const;

export default function TasksTab({ tasks, team }: { tasks: Task[]; team: Profile[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const doers = team.filter((t) => t.role === 'doer' && t.isActive);
  const pcs = team.filter((t) => t.role === 'pc' && t.isActive);

  async function deleteTask(id: string) {
    if (!confirm('Delete this task and all its instances?')) return;
    setBusy(id);
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Tasks ({tasks.length})</h2>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Create task</button>
      </div>

      {showForm && (
        <CreateTaskForm
          doers={doers}
          pcs={pcs}
          onDone={() => { setShowForm(false); router.refresh(); }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tasks.map((t) => (
          <div key={t.id} className="card space-y-2">
            <div className="flex justify-between gap-2">
              <h3 className={`font-semibold ${!t.isActive ? 'text-gray-400 line-through' : ''}`}>
                {t.title}
              </h3>
              <div className="flex gap-1 text-[10px]">
                {t.isCritical && <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold">CRITICAL</span>}
                {t.remarksRequired && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">REMARKS</span>}
              </div>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div>Doer: <span className="font-medium text-gray-800">{t.doer.fullName}</span>{t.backupDoer && <> (backup: {t.backupDoer.fullName})</>}</div>
              <div>PC: <span className="font-medium text-gray-800">{t.pc.fullName}</span></div>
              <div>{labelOf(t.frequency)} at {t.deadlineTime.slice(0, 5)}</div>
            </div>
            <div className="flex gap-3 text-xs pt-1">
              <button onClick={() => deleteTask(t.id)} className="text-danger underline" disabled={busy === t.id}>
                {busy === t.id ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-gray-500 text-sm">No tasks yet — create one to get started.</p>}
      </div>
    </div>
  );
}

function labelOf(f: string) {
  return FREQS.find(([k]) => k === f)?.[1] ?? f;
}

function CreateTaskForm({
  doers, pcs, onDone
}: {
  doers: Profile[]; pcs: Profile[]; onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [doerId, setDoerId] = useState(doers[0]?.id ?? '');
  const [backupDoerId, setBackupDoerId] = useState<string>('');
  const [pcId, setPcId] = useState(pcs[0]?.id ?? '');
  const [deadline, setDeadline] = useState('09:00');
  const [frequency, setFrequency] = useState<string>('daily');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [remarksRequired, setRemarksRequired] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const config: Record<string, unknown> = {};
    if (frequency === 'weekly') config.dayOfWeek = parseInt(dayOfWeek, 10);
    if (frequency === 'monthly') config.dayOfMonth = parseInt(dayOfMonth, 10);
    if (frequency === 'fortnightly') config.anchorDate = new Date().toISOString().slice(0, 10);
    if (frequency === 'half_yearly') config.months = [1, 7];
    if (frequency === 'yearly') { config.month = 1; config.day = 1; }

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title, doerId,
        backupDoerId: backupDoerId || null,
        pcId,
        deadlineTime: deadline + ':00',
        frequency,
        frequencyConfig: config,
        remarksRequired,
        isCritical
      })
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'Failed');
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="md:col-span-2">
        <label className="label">Task title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label">Doer</label>
        <select className="input" value={doerId} onChange={(e) => setDoerId(e.target.value)} required>
          {doers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Backup doer (optional)</label>
        <select className="input" value={backupDoerId} onChange={(e) => setBackupDoerId(e.target.value)}>
          <option value="">— none —</option>
          {doers.filter((d) => d.id !== doerId).map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Process Coordinator</label>
        <select className="input" value={pcId} onChange={(e) => setPcId(e.target.value)} required>
          {pcs.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Deadline time</label>
        <input type="time" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
      </div>
      <div>
        <label className="label">Frequency</label>
        <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          {FREQS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {frequency === 'weekly' && (
        <div>
          <label className="label">Day of week</label>
          <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        </div>
      )}
      {frequency === 'monthly' && (
        <div>
          <label className="label">Day of month</label>
          <input type="number" min={1} max={28} className="input" value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)} />
        </div>
      )}
      <div className="flex items-center gap-3 md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remarksRequired} onChange={(e) => setRemarksRequired(e.target.checked)} />
          Remarks required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isCritical} onChange={(e) => setIsCritical(e.target.checked)} />
          Critical task
        </label>
      </div>
      {err && <p className="text-sm text-danger md:col-span-2">{err}</p>}
      <div className="md:col-span-2 flex gap-2 justify-end">
        <button type="button" className="btn-outline" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Create task'}
        </button>
      </div>
    </form>
  );
}

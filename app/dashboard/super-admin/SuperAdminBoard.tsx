'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Row = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  taskCount: number;
};

export default function SuperAdminBoard({ companies }: { companies: Row[] }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function deactivate(id: string) {
    if (!confirm('Deactivate this company?')) return;
    setBusy(id);
    const res = await fetch(`/api/companies/${id}/deactivate`, { method: 'POST' });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Super Admin — Companies</h1>
        <button className="btn-primary" onClick={() => setShow(true)}>+ Add company</button>
      </div>

      {show && <AddCompany onDone={() => { setShow(false); router.refresh(); }} />}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Users</th>
              <th className="py-2 pr-3">Tasks</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{c.name}</td>
                <td className="py-2 pr-3">{c.userCount}</td>
                <td className="py-2 pr-3">{c.taskCount}</td>
                <td className="py-2 pr-3 text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="py-2 pr-3">
                  {c.isActive
                    ? <span className="text-success">Active</span>
                    : <span className="text-gray-400">Disabled</span>}
                </td>
                <td className="py-2 text-right">
                  {c.isActive && (
                    <button
                      className="text-xs underline text-danger"
                      onClick={() => deactivate(c.id)}
                      disabled={busy === c.id}
                    >
                      {busy === c.id ? '…' : 'Deactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-gray-500">No companies yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddCompany({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, adminName, adminEmail })
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
    <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
      <div>
        <label className="label">Company name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="label">Admin name</label>
        <input className="input" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
      </div>
      <div>
        <label className="label">Admin email</label>
        <input type="email" className="input" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
      </div>
      {err && <p className="text-sm text-danger md:col-span-3">{err}</p>}
      <div className="md:col-span-3 flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create company'}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Profile = {
  id: string;
  fullName: string;
  email: string | null;
  role: 'super_admin' | 'admin' | 'pc' | 'doer';
  isActive: boolean;
};

export default function TeamTab({ team }: { team: Profile[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function action(url: string, body: any, key: string) {
    setBusy(key);
    setError(null);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Request failed');
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Team members ({team.length})</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add user</button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {showAdd && <AddUserForm onDone={() => { setShowAdd(false); router.refresh(); }} />}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{m.fullName}</td>
                <td className="py-2 pr-3 text-gray-600">{m.email ?? '—'}</td>
                <td className="py-2 pr-3 uppercase text-xs">{m.role.replace('_', ' ')}</td>
                <td className="py-2 pr-3">
                  {m.isActive
                    ? <span className="text-success">Active</span>
                    : <span className="text-gray-400">Disabled</span>}
                </td>
                <td className="py-2 text-right space-x-2">
                  {m.role === 'doer' && m.isActive && (
                    <button
                      className="text-xs underline text-gray-700"
                      disabled={busy === 'absent-' + m.id}
                      onClick={() => action('/api/team/mark-absent', { doerId: m.id }, 'absent-' + m.id)}
                    >
                      {busy === 'absent-' + m.id ? '…' : 'Mark absent today'}
                    </button>
                  )}
                  {m.isActive && (
                    <button
                      className="text-xs underline text-danger"
                      disabled={busy === 'deact-' + m.id}
                      onClick={() => action('/api/team/deactivate', { userId: m.id }, 'deact-' + m.id)}
                    >
                      {busy === 'deact-' + m.id ? '…' : 'Deactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'pc' | 'doer'>('doer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/team/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fullName: name, email, role })
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error ?? 'Failed');
      return;
    }
    setCreated({ email: j.email, tempPassword: j.tempPassword });
  }

  if (created) {
    return (
      <div className="card space-y-3">
        <div>
          <h3 className="font-semibold text-success">User created</h3>
          <p className="text-xs text-gray-600">Share these credentials with the new user. They can change the password after first sign-in.</p>
        </div>
        <div className="bg-neutral rounded-md p-3 font-mono text-sm space-y-1">
          <div><span className="text-gray-500">Email:</span> {created.email}</div>
          <div><span className="text-gray-500">Password:</span> <span className="font-bold">{created.tempPassword}</span></div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-outline text-sm"
            onClick={() => navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.tempPassword}\nLogin: ${window.location.origin}/login`)}
          >
            Copy credentials
          </button>
          <button type="button" className="btn-primary text-sm" onClick={onDone}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
      <div>
        <label className="label">Full name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="label">Email</label>
        <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label">Role</label>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="doer">Doer</option>
          <option value="pc">Process Coordinator</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
      {err && <p className="text-sm text-danger md:col-span-4">{err}</p>}
      <p className="text-xs text-gray-500 md:col-span-4">
        A temporary password will be generated. Share it with the new user — they can change it after sign-in.
      </p>
    </form>
  );
}

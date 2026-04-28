'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function SetupPasswordForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw1.length < 8) { setErr('Use at least 8 characters'); return; }
    if (pw1 !== pw2)    { setErr('Passwords do not match');     return; }

    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="pw1">New password</label>
        <input
          id="pw1"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="pw2">Confirm password</label>
        <input
          id="pw2"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save password and continue'}
      </button>
    </form>
  );
}

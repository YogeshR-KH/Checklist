'use client';

import { useState } from 'react';

type ScoreRow = {
  id: string; name: string; total: number;
  kra1Completion: number; kra1Missed: number;
  kra2Timeliness: number; kra2Late: number;
};

export default function ScoresTab({ scores }: { scores: ScoreRow[] }) {
  const [view, setView] = useState<'positive' | 'negative'>('positive');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-700">Scores — current month</h2>
        <div className="flex bg-white border rounded-md text-xs overflow-hidden">
          <button
            onClick={() => setView('positive')}
            className={`px-3 py-1 ${view === 'positive' ? 'bg-primary text-white' : 'text-gray-600'}`}
          >
            Positive
          </button>
          <button
            onClick={() => setView('negative')}
            className={`px-3 py-1 ${view === 'negative' ? 'bg-primary text-white' : 'text-gray-600'}`}
          >
            Negative
          </button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="py-2 pr-3">Doer</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2 pr-3">{view === 'positive' ? 'KRA1 — Completion %' : 'KRA1 — Missed %'}</th>
              <th className="py-2 pr-3">{view === 'positive' ? 'KRA2 — On-time %' : 'KRA2 — Late %'}</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{s.name}</td>
                <td className="py-2 pr-3">{s.total}</td>
                <td className="py-2 pr-3">{view === 'positive' ? s.kra1Completion : s.kra1Missed}%</td>
                <td className="py-2 pr-3">{view === 'positive' ? s.kra2Timeliness : s.kra2Late}%</td>
              </tr>
            ))}
            {scores.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-gray-500">No doers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

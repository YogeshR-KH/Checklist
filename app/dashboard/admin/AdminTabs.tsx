'use client';

import Link from 'next/link';
import { useState } from 'react';
import TeamTab from './TeamTab';
import TasksTab from './TasksTab';
import ScoresTab from './ScoresTab';

type Profile = {
  id: string;
  fullName: string;
  email: string | null;
  role: 'super_admin' | 'admin' | 'pc' | 'doer';
  isActive: boolean;
};

type TaskRow = any;
type ScoreRow = {
  id: string; name: string; total: number;
  kra1Completion: number; kra1Missed: number;
  kra2Timeliness: number; kra2Late: number;
};

export default function AdminTabs({
  tab, team, tasks, scores
}: {
  tab: string;
  team: Profile[];
  tasks: TaskRow[];
  scores: ScoreRow[];
}) {
  const tabs = [
    { id: 'team', label: 'Team' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'scores', label: 'Scores' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      </div>
      <nav className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/admin?tab=${t.id}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'team' && <TeamTab team={team} />}
      {tab === 'tasks' && <TasksTab tasks={tasks} team={team} />}
      {tab === 'scores' && <ScoresTab scores={scores} />}
    </div>
  );
}

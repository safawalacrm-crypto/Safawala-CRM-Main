'use client';

import { useState, type ReactNode } from 'react';
import { KeyRound, UsersRound } from 'lucide-react';

export function StaffPageTabs({
  directory,
  access,
}: {
  directory: ReactNode;
  access: ReactNode;
}) {
  const [tab, setTab] = useState<'directory' | 'access'>('directory');
  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-border bg-white p-1 shadow-level-1">
        <button
          type="button"
          onClick={() => setTab('directory')}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${tab === 'directory' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <UsersRound className="size-4" /> Staff directory
        </button>
        <button
          type="button"
          onClick={() => setTab('access')}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${tab === 'access' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <KeyRound className="size-4" /> Manage access
        </button>
      </div>
      {tab === 'directory' ? directory : access}
    </div>
  );
}

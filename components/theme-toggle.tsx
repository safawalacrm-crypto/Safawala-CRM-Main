'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, SunMedium } from 'lucide-react';

const STORAGE_KEY = 'safawala-theme';

// Scoped to the nearest [data-theme-root] ancestor (the Admin Panel shell)
// rather than <html> -- dark mode is an Admin-only feature and must never
// touch the Staff Portal, so this toggle only ever flips class="dark" on
// its own themed container, never globally.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = buttonRef.current?.closest<HTMLElement>('[data-theme-root]');
    setIsDark(!!root?.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const root = buttonRef.current?.closest<HTMLElement>('[data-theme-root]');
    if (!root) return;
    const next = !isDark;
    setIsDark(next);
    root.classList.toggle('dark', next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {}
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
    >
      {isDark ? (
        <SunMedium aria-hidden="true" className="size-4" />
      ) : (
        <Moon aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

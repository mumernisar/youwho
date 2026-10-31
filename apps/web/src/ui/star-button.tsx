'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/client/api-fetch';

/** Bordered Star button with the live count in mono. Without a count it shows only "Star". */
export function StarButton({ repoUrl }: { repoUrl: string }) {
  const pathname = usePathname();
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ stars: number | null }>('/api/github').then((r) => setStars(r.stars), () => {});
  }, []);

  if (pathname.startsWith('/admin')) return null;
  return (
    <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded border border-rule px-3 text-sm hover:border-ink">
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.7" strokeLinejoin="round">
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
      </svg>
      Star on GitHub
      {stars !== null && <span className="font-mono text-muted">{stars.toLocaleString('en')}</span>}
    </a>
  );
}

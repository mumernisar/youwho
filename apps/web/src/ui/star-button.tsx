'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/client/api-fetch';
import { Star } from './icons';

/** Star on GitHub with the live count in mono. Without a count it shows only "Star". */
export function StarButton({ repoUrl }: { repoUrl: string }) {
  const pathname = usePathname();
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ stars: number | null }>('/api/github').then((r) => setStars(r.stars), () => {});
  }, []);

  if (pathname.startsWith('/admin')) return null;
  return (
    <a
      href={repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={stars === null ? 'Star on GitHub' : `Star on GitHub, ${stars} stars`}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/25 px-3 text-sm font-medium text-head-ink transition hover:border-white/60 hover:bg-white/10"
    >
      <Star className="h-4 w-4" />
      <span className="hidden sm:inline">Star</span>
      {stars !== null && <span className="border-l border-white/25 pl-2 font-mono text-xs">{stars.toLocaleString('en')}</span>}
    </a>
  );
}

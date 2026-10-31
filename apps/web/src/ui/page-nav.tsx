import Link from 'next/link';
import { ChevronLeft, ChevronRight } from './icons';

export interface Crumb {
  href?: string;
  label: string;
}

/** Back button plus a breadcrumb trail. The trail hides on small screens; the button never does. */
export function PageNav({ back, crumbs }: { back: { href: string; label: string }; crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-6 pb-2">
      <Link href={back.href} className="btn btn-secondary btn-sm pl-2">
        <ChevronLeft className="h-4 w-4" />
        {back.label}
      </Link>
      <ol className="hidden items-center gap-1.5 text-sm text-muted sm:flex">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            {c.href ? (
              <Link href={c.href} className="rounded hover:text-ink hover:underline">{c.label}</Link>
            ) : (
              <span aria-current="page" className="font-medium text-ink-2">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

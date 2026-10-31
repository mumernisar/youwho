import Link from 'next/link';
import { StarButton } from './star-button';
import { ThemeSwitch } from './theme-switch';
import type { ThemeId } from './themes';

function Logo() {
  // Nine seats, the middle one is you.
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <span aria-hidden className="grid h-8 w-8 grid-cols-3 gap-[2px] rounded-lg bg-white/12 p-[5px]">
      {cells.map((i) => (
        <span key={i} className={`rounded-[2px] ${i === 4 ? 'bg-accent' : 'bg-white/55'}`} />
      ))}
    </span>
  );
}

export function Header({ theme, repoUrl }: { theme: ThemeId; repoUrl: string }) {
  return (
    <header className="bg-head text-head-ink">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-lg">
          <Logo />
          <span className="text-lg font-bold tracking-tight">youwho</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitch initial={theme} />
          <StarButton repoUrl={repoUrl} />
        </div>
      </div>
    </header>
  );
}

import Link from 'next/link';
import { StarButton } from './star-button';
import { ThemeSwitch } from './theme-switch';

export function Header({ theme, repoUrl }: { theme: string | null; repoUrl: string }) {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/" className="font-mono text-lg font-semibold tracking-tight">youwho</Link>
        <ThemeSwitch initial={theme} />
      </div>
      <StarButton repoUrl={repoUrl} />
    </header>
  );
}

import Link from 'next/link';
import { getServices } from '@/server/services';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { AddDepartmentButton } from '@/ui/add-link';
import { DeptBadge } from '@/ui/dept-badge';
import { ErrorState } from '@/ui/error-state';
import { ArrowRight, Calendar, Chair, ThumbsUp, Users } from '@/ui/icons';
import { RollForm } from '@/ui/roll-form';
import { count, fmtUpdated, sourceHost } from '@/ui/format';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    icon: Calendar,
    title: 'Your papers',
    text: 'Every exam on the board, sorted by date, with room and seat.',
  },
  {
    icon: Chair,
    title: 'The room',
    text: 'The whole seating plan, drawn as the room is laid out.',
  },
  {
    icon: Users,
    title: 'Who is around you',
    text: 'Tap any seat for the name, roll number and course.',
  },
];

export default async function Home() {
  const s = getServices();
  const board = await loadPage(async () => s.datasets.list(await viewerHash(s)));
  return (
    <>
      <section className="bleed bg-head pt-10 pb-14 text-head-ink sm:pt-16 sm:pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-head-ink/60!">Exam seating, room by room</p>
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight sm:text-6xl">HEck or HAck?</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-head-ink/80">
            Type your registration number to see your room, your seat and who sits around you.
          </p>
          <div className="mt-8 text-left">
            <RollForm />
          </div>
        </div>
      </section>

      <section aria-label="How it works" className="-mt-8 grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card flex items-start gap-3 p-4">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="mt-0.5 text-sm text-muted">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-14" aria-labelledby="board">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="board" className="text-2xl font-bold tracking-tight">
              On the board
            </h2>
            <p className="mt-1 text-sm text-muted">
              Departments whose seating plans youwho can read.
            </p>
          </div>
          {board.ok && board.data.length > 0 && <AddDepartmentButton />}
        </div>

        {!board.ok ? (
          <div className="card p-4">
            <ErrorState error={board.error} compact />
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {board.data.map((d) => (
              <li key={d.slug} className="min-w-0">
                <Link href={`/d/${d.slug}`} className="card-link flex h-full flex-col justify-between p-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <DeptBadge slug={d.slug} label={d.label} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 leading-snug font-semibold">{d.label}</span>
                      <span className="block truncate font-mono text-xs text-muted">{sourceHost(d.sourceUrl)}</span>
                    </span>
                    <span className="go">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </span>
                  <span className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-semibold text-ink-2">{count(d.students)}</span> students
                    </span>
                    <span className="inline-flex items-center gap-1.5" title="Looks right">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span className="font-semibold text-ink-2">{d.confirms}</span>
                      <span className="sr-only">looks right</span>
                    </span>
                    <span className="ml-auto">Updated {fmtUpdated(d.updatedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <AddDepartmentButton variant="card" />
            </li>
          </ul>
        )}
      </section>
    </>
  );
}

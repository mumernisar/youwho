import { Emblem } from './special-fx';
import { Star } from './icons';
import { ROLE_LABEL, SPECIAL_PEOPLE, withRole, type SpecialPerson, type SpecialRole } from './special-people';

function Person({ p, skip }: { p: SpecialPerson; skip: SpecialRole }) {
  const others = p.roles.filter((r) => r !== skip);
  return (
    <li className="fx-roll" data-fx={p.id}>
      <Emblem id={p.id} />
      <div className="min-w-0 flex-1">
        <p className="leading-tight font-bold">{p.name}</p>
        <p className="font-mono text-xs text-muted">{p.reg}</p>
      </div>
      {others.map((r) => (
        <span key={r} className="fx-role" data-role={r}>{ROLE_LABEL[r]}</span>
      ))}
    </li>
  );
}

function Group({ role, title, note, children }: { role: SpecialRole; title: string; note: string; children?: React.ReactNode }) {
  const list = withRole(role);
  return (
    <section className="card p-4 sm:p-5" aria-labelledby={`credits-${role}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`credits-${role}`} className="text-lg font-bold tracking-tight">{title}</h3>
        <span className="fx-count" aria-label={`${list.length} people`}>{list.length}</span>
      </div>
      <p className="mt-0.5 text-sm text-muted">{note}</p>
      <ul className="mt-2">
        {list.map((p) => (
          <Person key={p.id} p={p} skip={role} />
        ))}
      </ul>
      {children}
    </section>
  );
}

/** Home page: who owns youwho, who tests it and who starred it. */
export function SpecialCredits({ repoUrl }: { repoUrl: string }) {
  const owner = SPECIAL_PEOPLE.find((p) => p.roles.includes('owner'))!;
  return (
    <section className="fx-credits mt-14" aria-labelledby="credits">
      <div className="mb-4">
        <h2 id="credits" className="text-2xl font-bold tracking-tight">Made and tested by</h2>
        <p className="mt-1 text-sm text-muted">The owner, the A/B testers and the people who starred the repo.</p>
      </div>

      <div className="fx-owner-card" data-fx={owner.id}>
        <Emblem id={owner.id} />
        <div className="min-w-0 flex-1">
          <span className="fx-role" data-role="owner">{ROLE_LABEL.owner}</span>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight">{owner.name}</p>
          <p className="font-mono text-sm text-muted">{owner.reg}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Group role="tester" title="A/B testers" note="Tested youwho and gave feedback." />
        <Group role="stargazer" title="Stargazers" note="Starred the repo on GitHub.">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm mt-3"
          >
            <Star className="h-4 w-4" />
            Star it too
          </a>
        </Group>
      </div>
    </section>
  );
}

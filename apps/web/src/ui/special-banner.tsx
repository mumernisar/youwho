import { Emblem } from './special-fx';
import { ROLE_LABEL, byRank, specialById, type SpecialId } from './special-people';

/** Someone to announce. The name and number shown are the list's in special-people.ts. */
export interface Present {
  id: SpecialId;
}

/** Seeded positions, so the server and the browser draw the same pattern. */
function scatter(n: number, seed: number): [number, number, number][] {
  let x = seed;
  const next = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: n }, () => [next(), next(), next()]);
}

/** The pattern drawn behind the page for one person. */
function WashArt({ id }: { id: SpecialId }) {
  const stroke = 'var(--fx-a)';
  switch (id) {
    case '118':
      return (
        <>
          <svg className="fx-wash-art" aria-hidden>
            <defs>
              <pattern id="wash118" width="56" height="56" patternUnits="userSpaceOnUse">
                {Array.from({ length: 9 }, (_, i) => (
                  <rect key={i} x={13 + (i % 3) * 10} y={13 + Math.floor(i / 3) * 10} width="7" height="7" rx="2" fill={stroke} opacity={i === 4 ? 0.55 : 0.16} />
                ))}
              </pattern>
            </defs>
            <rect className="fx-wash-slide" x="-56" y="-56" width="200%" height="200%" fill="url(#wash118)" style={{ '--dur': '48s' } as React.CSSProperties} />
          </svg>
          <div className="fx-wash-beam" />
        </>
      );
    case '077':
      return (
        <>
          <svg className="fx-wash-art" aria-hidden>
            <defs>
              <pattern id="wash077" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="26" height="6" fill="var(--fx-b)" opacity="0.1" />
                <rect y="9" width="26" height="1.6" fill="var(--fx-a)" opacity="0.2" />
                <rect y="14" width="26" height="3" fill="var(--fx-c)" opacity="0.12" />
              </pattern>
            </defs>
            <rect className="fx-wash-slide" x="-80" y="-80" width="200%" height="200%" fill="url(#wash077)" style={{ '--dur': '30s', '--dx': '-36.77px', '--dy': '0px' } as React.CSSProperties} />
          </svg>
          <div className="fx-wash-heat" />
          {scatter(16, 77).map(([x, , r], i) => (
            <span
              key={i}
              className="fx-wash-ember"
              style={{ left: `${x * 100}%`, '--s': `${3 + r * 5}px`, '--dur': `${9 + r * 9}s`, '--delay': `${-r * 14}s`, '--drift': `${(r - 0.5) * 120}px`, '--k': i % 3 ? 'var(--fx-a)' : 'var(--fx-b)' } as React.CSSProperties}
            />
          ))}
        </>
      );
    case '073':
      return (
        <>
          <svg className="fx-wash-art" aria-hidden>
            <defs>
              <pattern id="wash073" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M48 0H0V48" fill="none" stroke={stroke} strokeWidth="1" opacity="0.14" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wash073)" />
          </svg>
          {[0, -3, -6].map((d) => (
            <span key={d} className="fx-wash-ring" style={{ '--delay': `${d}s` } as React.CSSProperties} />
          ))}
        </>
      );
    case '092':
      return (
        <>
          <svg className="fx-wash-art" aria-hidden>
            <defs>
              <pattern id="wash092" width="44" height="38.1" patternUnits="userSpaceOnUse">
                <circle cx="0" cy="0" r="2" fill={stroke} opacity="0.3" />
                <circle cx="44" cy="0" r="2" fill={stroke} opacity="0.3" />
                <circle cx="22" cy="19.05" r="2" fill={stroke} opacity="0.3" />
                <path d="M0 0 L22 19.05 L44 0 M22 19.05 V38.1" fill="none" stroke={stroke} strokeWidth="1" opacity="0.13" />
              </pattern>
            </defs>
            <rect className="fx-wash-slide" x="-44" y="-38" width="200%" height="200%" fill="url(#wash092)" style={{ '--dur': '36s', '--dx': '44px', '--dy': '38.1px' } as React.CSSProperties} />
          </svg>
          <div className="fx-wash-scan" />
        </>
      );
    case '127':
      return (
        <>
          <svg className="fx-wash-art" aria-hidden>
            <defs>
              <pattern id="wash127" width="52" height="52" patternUnits="userSpaceOnUse">
                <path d="M26 4 L48 26 L26 48 L4 26Z" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.22" />
                <path d="M26 17 L35 26 L26 35 L17 26Z" fill={stroke} opacity="0.12" />
              </pattern>
            </defs>
            <rect className="fx-wash-slide" x="-52" y="-52" width="200%" height="200%" fill="url(#wash127)" style={{ '--dur': '44s', '--dx': '52px', '--dy': '-52px' } as React.CSSProperties} />
          </svg>
          {scatter(10, 127).map(([x, y, r], i) => (
            <span key={i} className="fx-wash-star" style={{ left: `${x * 100}%`, top: `${y * 100}%`, '--s': `${4 + r * 6}px`, '--dur': `${3 + r * 3}s`, '--delay': `${-r * 5}s`, '--fx-a': 'var(--fx-b)' } as React.CSSProperties} />
          ))}
        </>
      );
    case '085':
      return (
        <>
          {scatter(34, 85).map(([x, y, r], i) => (
            <span key={i} className="fx-wash-star" style={{ left: `${x * 100}%`, top: `${y * 100}%`, '--s': `${2 + r * 4}px`, '--dur': `${2.5 + r * 4}s`, '--delay': `${-r * 6}s` } as React.CSSProperties} />
          ))}
          {[0, 4.5].map((d, i) => (
            <span key={d} className="fx-wash-shoot" style={{ '--delay': `${d - 3}s`, '--x': `${8 + i * 40}%`, '--y': `${6 + i * 10}%` } as React.CSSProperties} />
          ))}
        </>
      );
  }
}

/** The colour of the page behind the content: set by the highest-ranked person present. */
export function SpecialWash({ id }: { id: SpecialId }) {
  return (
    <div className="fx-wash" data-fx={id} aria-hidden>
      <div className="fx-wash-glow" />
      <WashArt id={id} />
    </div>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Owner, A/B testers and stargazers in this room", from the roles actually present. */
function headline(people: Present[], where: 'room' | 'papers'): string {
  const roles = people.map((p) => specialById(p.id).roles);
  const count = (r: 'owner' | 'tester' | 'stargazer') => roles.filter((x) => x.includes(r)).length;
  const parts = [
    count('owner') ? 'Owner' : null,
    count('tester') ? plural(count('tester'), 'A/B tester', 'A/B testers') : null,
    count('stargazer') ? plural(count('stargazer'), 'Stargazer', 'Stargazers') : null,
  ].filter((x): x is string => x !== null);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)!.toLowerCase()}` : parts[0]!;
  return where === 'room' ? `${list} in this room` : `${list} on youwho`;
}

/**
 * Announces who is here: the page colour behind it and a banner whose rows slide in from alternating
 * sides, the owner's with a larger entrance. `where` says whether they sit in this room or the page is theirs.
 */
export function SpecialStage({ people, where }: { people: Present[]; where: 'room' | 'papers' }) {
  const list = byRank(people);
  const top = list[0];
  if (!top) return null;
  return (
    <>
      <SpecialWash id={top.id} />
      <section className="fx-banner" data-fx={top.id} aria-label={headline(list, where)}>
        <p className="fx-banner-head">{headline(list, where)}</p>
        <ul className="fx-banner-list">
          {list.map((p, i) => {
            const who = specialById(p.id);
            return (
              <li key={p.id} className="fx-person" data-fx={p.id} data-owner={who.roles.includes('owner')} data-side={i % 2 ? 'right' : 'left'} style={{ '--i': i } as React.CSSProperties}>
                <Emblem id={p.id} />
                <div className="fx-person-text">
                  <p className="fx-person-reg">{who.reg}</p>
                  <p className="fx-person-name">{who.name}</p>
                  <p className="fx-person-roles">
                    {who.roles.map((r) => (
                      <span key={r} className="fx-role">{ROLE_LABEL[r]}</span>
                    ))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

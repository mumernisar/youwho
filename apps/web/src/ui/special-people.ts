/**
 * The people who get special treatment: the owner, the A/B testers and the people who starred the
 * repo. One list feeds the landing page credits, the room banner, the page wash and the seat effects.
 * Names here are the ones shown on the landing page; a room or papers page uses the name in the
 * seating data and falls back to this one.
 */

export type SpecialId = '118' | '077' | '073' | '092' | '127' | '085';
export type SpecialRole = 'owner' | 'tester' | 'stargazer';

export interface SpecialPerson {
  id: SpecialId;
  /** Canonical registration number, as the decoder writes it. */
  reg: string;
  name: string;
  roles: readonly SpecialRole[];
  /** Higher wins when several are in one room: it sets the page wash. */
  rank: number;
}

export const SPECIAL_PEOPLE: readonly SpecialPerson[] = [
  { id: '118', reg: 'FA23-BSE-118', name: 'M. Umer Nisar', roles: ['owner', 'stargazer'], rank: 6 },
  { id: '077', reg: 'FA23-BSE-077', name: 'M. Shiraz Kamran', roles: ['tester', 'stargazer'], rank: 5 },
  { id: '073', reg: 'FA23-BSE-073', name: 'M. Idrees', roles: ['tester'], rank: 4 },
  { id: '092', reg: 'FA23-BSE-092', name: 'Syed Asad Ali Shah', roles: ['tester'], rank: 3 },
  { id: '127', reg: 'FA23-BSE-127', name: 'Asad Naeem Malik', roles: ['tester'], rank: 2 },
  { id: '085', reg: 'FA23-BSE-085', name: 'Rabia Tahir', roles: ['stargazer'], rank: 1 },
] as const;

const BY_REG = new Map(SPECIAL_PEOPLE.map((p) => [p.reg, p]));
const BY_ID = new Map(SPECIAL_PEOPLE.map((p) => [p.id, p]));

/** The special person for a registration number (any case), or null. */
export const specialOf = (reg: string): SpecialPerson | null => BY_REG.get(reg.trim().toUpperCase()) ?? null;

export const specialById = (id: SpecialId): SpecialPerson => BY_ID.get(id)!;

/** What each role is called on the page. */
export const ROLE_LABEL: Record<SpecialRole, string> = {
  owner: 'Owner',
  tester: 'A/B tester',
  stargazer: 'Starred the repo',
};

export const withRole = (role: SpecialRole): SpecialPerson[] => SPECIAL_PEOPLE.filter((p) => p.roles.includes(role));

/** Highest-ranked first. */
export const byRank = <T extends { id: SpecialId }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => specialById(b.id).rank - specialById(a.id).rank);

/** A short spoken label for a seat: "owner", "A/B tester, starred the repo". */
export const roleText = (p: SpecialPerson): string => p.roles.map((r) => ROLE_LABEL[r].toLowerCase()).join(', ');

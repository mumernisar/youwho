import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { logicFingerprint, parseRawPlan, selectDecoder, type DecodedPlan, type SeatPosition } from '@youwho/core';

const dir = fileURLToPath(new URL('../packages/core/fixtures/', import.meta.url));
const problems: string[] = [];
const expect = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
};

const raw = parseRawPlan(readFileSync(dir + 'cs-fa26-mid.json', 'utf8'));
const logic = readFileSync(dir + 'cs-fa26-mid.logic.js', 'utf8');
const logicHash = createHash('sha256').update(logicFingerprint(logic)).digest('hex');
const { decoder, known } = selectDecoder(logicHash);
expect(known, `page script hash ${logicHash} is not registered`);
const plan: DecodedPlan = decoder.decode(raw);

const withSeats = new Set(plan.seats.map((s) => s.reg));
expect(withSeats.size === 2533, `students with seats: ${withSeats.size}, want 2533`);
expect(plan.seats.length === 13916, `seats: ${plan.seats.length}, want 13916`);
const tbaOnly = plan.students.filter((s) => !withSeats.has(s.reg));
expect(tbaOnly.length === 1 && tbaOnly[0]?.reg === 'SP21-BDS-002', `TBA-only students: ${tbaOnly.map((s) => s.reg).join(',')}`);
expect(plan.meta.tba['SP21-BDS-002']?.length === 2, 'SP21-BDS-002 should have 2 TBA papers');
expect(plan.warnings.length === 0, `unexpected warnings: ${plan.warnings.join('; ')}`);

interface Want {
  slot: string;
  course: string;
  section: string;
  room: string;
  position: SeatPosition;
}
const resolve = (reg: string) =>
  plan.seats
    .filter((s) => s.reg === reg)
    .map((s) => ({
      slot: plan.meta.slots[s.slot]!.key,
      course: plan.meta.courses[s.course]!.code,
      section: plan.meta.sections[s.section]!,
      room: plan.meta.rooms[s.room]!,
      position: s.position,
    }));
const has = (reg: string, want: Want, label: string) => {
  const got = resolve(reg);
  expect(
    got.some((g) => JSON.stringify(g) === JSON.stringify(want)),
    `${label}: ${reg} should have ${JSON.stringify(want)}; has ${JSON.stringify(got)}`,
  );
};

has('FA21-BAI-011', { slot: '2026-11-03T14:30-15:50', course: 'MGT101', section: 'F', room: 'G-05', position: { kind: 'grid', row: 1, col: 3 } }, 'ordinary seat');
has('FA21-BAI-019', { slot: '2026-11-07T08:30-09:50', course: 'CSC322', section: 'BCS-5B', room: 'G-06', position: { kind: 'grid', row: 3, col: 5 } }, 'section override');
has('FA22-BDS-024', { slot: '2026-11-05T14:30-15:50', course: 'CSC301', section: 'BSE-5B', room: 'Clash Room', position: { kind: 'clash', label: 'CR-05', order: 2, start: '15:50', end: '17:10' } }, 'clash room');
has('FA21-BCT-013', { slot: '2026-11-05T13:00-14:20', course: 'MGT210', section: 'BCT-4', room: 'G-07', position: { kind: 'extra', n: 1 } }, 'extra chair');

if (problems.length > 0) {
  console.error(`check:decoder failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check:decoder ok: ${withSeats.size} students with seats, ${plan.seats.length} seats, 1 TBA-only`);

# Planned change: special seats (stargazers, testers, owner)

Status: **implemented on `dev`, not committed**. This file records what was asked and what was
decided. See spec section 9 ("Special seats") for the behaviour as built.

## The people

| Roll number | Name | Roles |
| --- | --- | --- |
| FA23-BSE-118 | M. Umer Nisar | Owner |
| FA23-BSE-077 | M. Shiraz Kamran | A/B tester, starred the repo |
| FA23-BSE-073 | M. Idrees | A/B tester |
| FA23-BSE-092 | Syed Asad Ali Shah | A/B tester |
| FA23-BSE-127 | Asad Naeem Malik | A/B tester |
| FA23-BSE-085 | Rabia Tahir | Starred the repo |

Notes:
- 118 is the owner. The others are A/B testers.
- 077, 118 and 085 have starred the repo. So 077 and 118 hold two roles each (118: owner and stargazer; 077: tester and stargazer).
- The roll number was typed as `FA23-bse-118` in one place; match case-insensitively
  (use `normalizeReg`).
- Rank order (used when several people are in one room): owner (118) > 077 > other testers
  (073, 092, 127) > stargazer only (085).

## What was asked

### 1. Landing page: credits section
- Show these statistics on the main landing page, in a good-looking way: who the **stargazers**
  are, who the **beta testers (A/B testers)** are, and who the **owner** is.
- Names come from a hardcoded config file (the owner typed the names above), not from a database
  lookup.
- Copy stays short and literal (spec section 9: no jokes in status or error text).

### 2. Room page: page-level takeover
- When a room (seating plan) page contains any of these roll numbers, the page detects it first.
- If at least one is present, the whole page takes on a colour wash.
- A banner animates in from the side with the roll number and name, saying that people who
  starred the repo or tested it are in this room.
- The owner's entry gets the best animation of all.

### 3. Per-person seat effects
Each person gets a different effect. The seats must glow with a good, clearly visible SVG
effect. It must not look like generic AI-generated design.

- **FA23-BSE-077 (Shiraz):** a golden/yellow effect with crimson and black hints, always moving,
  on his seat. This applies on any page where he sits. It also gets a very nice effect on the
  seat logo.
- **FA23-BSE-118 (owner):** the best effect of all, plus an animated **SVG logo** on his seat.
  The logo is designed by us (original mark, drawn in SVG, animated).
- **FA23-BSE-073, 092, 127 (testers) and 085 (stargazer):** each gets their own distinct glow
  and SVG effect, different from each other and from 077 and 118.
- **Orbit (added later):** the owner (118) and 077 also get an orbit that circles their seat
  along a curvy Bezier path, continuously animated.

### 4. Papers list page
- Scope was extended to the papers page (`/r/<reg>`): when the person being viewed is one of
  these people, the page gets the colour wash and the banner as well.

## Decisions

| Topic | Decision |
| --- | --- |
| Names on the landing page | Hardcoded in one small config file, the names above. |
| Names in the room banner | Changed during the build: the config's names are used everywhere (the seating data has "MUHAMMAD UMER", the owner wrote "M. Umer Nisar"). |
| Owner logo | We design an original animated SVG mark for 118. |
| Several of them in one room | Highest rank sets the page wash. The banner shows one line per person present, each with their own accent colour and role. |
| Scope | Room view **and** papers list (`/r/<reg>`). |
| Rank order | 118 > 077 > 073 / 092 / 127 > 085. |
| Colours | Defined as dedicated effect tokens (CSS variables) so CSS stays variable-driven (spec rule: colours only from theme variables). |
| Reduced motion | Effects stay visible but static (spec: respect `prefers-reduced-motion`). |
| Accessibility | Text contrast stays at WCAG AA under the wash. Seats keep their accessible labels. Effects are `aria-hidden` decoration. Banner is readable by screen readers. |
| Privacy | Page-derived text rendered as text only, never `dangerouslySetInnerHTML`. Names are never logged. |
| Verification | The owner will not run the frontend. Verify by running typecheck, lint and a headless Playwright render of a dev-only fixture containing these roll numbers (none of them are in the current fixture). |
| Workflow | One branch (`feat/special-seats`), small Conventional Commits, update spec section 9 in the same PR, run lint and typecheck, then list "Check by hand" steps. |

## Technical plan

- New config: `apps/web/src/ui/special-people.ts` (roll number, name, roles, rank, effect id,
  accent colours). Single source of truth for the landing page, banner and seats.
- `buildRoomModel` (`apps/web/src/ui/room-model.ts`): mark seats whose `reg` matches, add a
  `special` field to `SeatModel`, and expose the list of people present in the room.
- `RoomGrid` (`apps/web/src/ui/room-grid.tsx`): render per-person effect layers inside the seat
  cell (SVG, `aria-hidden`), keep the existing `YOU` / found / dim states working with them.
- Room page (`apps/web/app/d/[slug]/[room]/[slotKey]/page.tsx`) and papers page
  (`apps/web/app/r/[reg]/page.tsx`): render a `SpecialBanner` and set a `data-special` attribute
  that drives the page colour wash (CSS variables on the wash, not hard-coded colours in
  components).
- Landing page (`apps/web/app/page.tsx`): new credits section (owner, testers, stargazers).
- `apps/web/app/globals.css`: effect tokens, keyframes, wash, banner slide-in, orbit (Bezier
  path via SVG `animateMotion` or CSS `offset-path`), reduced-motion fallbacks.
- Spec: update section 9 (Screens, Accessibility) and add a note in section 13.

## Not verified
- Checked in headless Chrome only (Sand and Dusk, desktop and 390 px, reduced motion). Not checked in
  Firefox or Safari.

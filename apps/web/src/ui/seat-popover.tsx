'use client';

import * as Popover from '@radix-ui/react-popover';
import type { LegendItem, SeatModel } from './room-model';
import { relativeTo } from './room-model';
import { hueStyle, initials } from './palette';
import { Chair, Layers, Pin, X } from './icons';
import { ROLE_LABEL, specialById } from './special-people';

/**
 * Seat details in a popover pinned to the tapped seat. Non-modal, so tapping another seat moves it
 * there. It flips and shifts to stay on screen, caps its width at the viewport on phones, and
 * follows the seat while the map scrolls.
 */
export function SeatPopover({
  seat,
  anchor,
  me,
  course,
  onClose,
}: {
  seat: SeatModel | null;
  anchor: React.RefObject<HTMLElement | null>;
  me: SeatModel | null;
  course: (s: SeatModel) => LegendItem & { titleFull: string };
  onClose: () => void;
}) {
  const c = seat ? course(seat) : null;
  const rel = seat && me ? relativeTo(me, seat) : null;
  return (
    <Popover.Root open={seat !== null} onOpenChange={(o) => !o && onClose()}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={12}
          hideWhenDetached
          // Tapping a seat is handled by the seat itself (open, switch or close), not as an outside tap.
          onInteractOutside={(e) => {
            if ((e.target as Element | null)?.closest?.('[data-seat]')) e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            anchor.current?.focus({ preventScroll: true });
          }}
          className="seat-pop z-50 w-[min(21rem,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-line bg-surface p-4 text-ink shadow-2xl"
        >
          {seat && c && (
            <>
              <div className="flex items-start gap-3">
                <span style={hueStyle(c.hue)} className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-base font-bold ${seat.me ? 'bg-accent text-accent-ink' : 'hue-soft hue-ink'}`}>
                  {initials(seat.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-base leading-tight font-bold">{seat.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">{seat.reg}</span>
                    {seat.me && <span className="you-chip">You</span>}
                  </p>
                  {seat.special && (
                    <p data-fx={seat.special} className="mt-1.5 flex flex-wrap gap-1.5">
                      {specialById(seat.special).roles.map((r) => (
                        <span key={r} className="fx-role" data-role={r}>{ROLE_LABEL[r]}</span>
                      ))}
                    </p>
                  )}
                </div>
                <Popover.Close className="btn btn-quiet btn-icon -mt-1.5 -mr-2 h-9 min-h-9 w-9" aria-label="Close">
                  <X className="h-4 w-4" />
                </Popover.Close>
              </div>

              {rel && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-brand-soft px-2.5 py-2 text-sm font-semibold text-brand">
                  <Pin className="h-4 w-4 flex-none" />
                  {rel}
                </p>
              )}

              <dl className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
                <div className="flex gap-2.5 p-2.5">
                  <dt className="sr-only">Course</dt>
                  <span style={hueStyle(c.hue)} className="mini-seat mt-0.5" data-tex={c.tex} />
                  <dd className="min-w-0">
                    <p className="leading-snug font-semibold">{c.titleFull}</p>
                    <p className="font-mono text-xs text-muted">{c.code}</p>
                  </dd>
                </div>
                <div className="grid grid-cols-2 divide-x divide-line">
                  <div className="flex items-center gap-2 p-2.5">
                    <Chair className="h-4 w-4 flex-none text-muted" />
                    <dt className="sr-only">Seat</dt>
                    <dd className="font-semibold">{seat.label}</dd>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 p-2.5">
                    <Layers className="h-4 w-4 flex-none text-muted" />
                    <dt className="sr-only">Section</dt>
                    <dd className="min-w-0 font-mono leading-snug font-semibold break-words">{seat.section}</dd>
                  </div>
                </div>
              </dl>
              {(seat.mySection || seat.sectionDiffers) && (
                <p className="mt-2 text-xs text-muted">
                  {[seat.mySection && 'In your section.', seat.sectionDiffers && 'Sitting with another section.'].filter(Boolean).join(' ')}
                </p>
              )}
              <Popover.Arrow className="fill-surface" width={14} height={7} />
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

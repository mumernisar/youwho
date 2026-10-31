'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { LegendItem, SeatModel } from './room-model';
import { relativeTo } from './room-model';
import { hueStyle, initials } from './palette';
import { Chair, Layers, Pin, X } from './icons';

/** Seat details: a bottom sheet on phones, a centred card on desktop. */
export function SeatSheet({ seat, me, course, onClose }: { seat: SeatModel | null; me: SeatModel | null; course: (s: SeatModel) => LegendItem & { titleFull: string }; onClose: () => void }) {
  const c = seat ? course(seat) : null;
  const rel = seat && me ? relativeTo(me, seat) : null;
  return (
    <Dialog.Root open={seat !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-surface p-6 pb-8 text-ink shadow-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          {seat && c && (
            <>
              <div aria-hidden className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" />
              <div className="flex items-start gap-4">
                <span style={hueStyle(c.hue)} className={`grid h-14 w-14 flex-none place-items-center rounded-2xl text-lg font-bold ${seat.me ? 'bg-accent text-accent-ink' : 'hue-soft hue-ink'}`}>
                  {initials(seat.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-xl leading-tight font-bold">{seat.name}</Dialog.Title>
                  <Dialog.Description className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-muted">{seat.reg}</span>
                    {seat.me && <span className="you-chip">You</span>}
                  </Dialog.Description>
                </div>
                <Dialog.Close className="btn btn-quiet btn-icon -mt-1 -mr-2 h-10 min-h-10 w-10" aria-label="Close">
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>

              {rel && (
                <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand">
                  <Pin className="h-4 w-4 flex-none" />
                  {rel}
                </p>
              )}

              <dl className="mt-5 divide-y divide-line rounded-2xl border border-line">
                <div className="flex gap-3 p-3.5">
                  <dt className="sr-only">Course</dt>
                  <span style={hueStyle(c.hue)} className="mini-seat mt-0.5" data-tex={c.tex} />
                  <dd className="min-w-0">
                    <p className="font-semibold">{c.titleFull}</p>
                    <p className="font-mono text-xs text-muted">{c.code}</p>
                  </dd>
                </div>
                <div className="flex items-center gap-3 p-3.5">
                  <Chair className="h-[18px] w-[18px] flex-none text-muted" />
                  <dt className="sr-only">Seat</dt>
                  <dd className="font-semibold">{seat.label}</dd>
                </div>
                <div className="flex items-center gap-3 p-3.5">
                  <Layers className="h-[18px] w-[18px] flex-none text-muted" />
                  <dt className="sr-only">Section</dt>
                  <dd>
                    <span className="font-mono font-semibold">{seat.section}</span>
                    {seat.sectionDiffers && <span className="ml-2 text-sm text-muted">sitting with another section</span>}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

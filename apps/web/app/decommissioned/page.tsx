import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { DECOMMISSIONED } from '@/site-status';
import goodbye from './goodbye.jpg';

export const metadata: Metadata = { title: 'Site retired' };

/** Shown at "/" while the site is decommissioned (see src/site-status.ts). */
export default function Decommissioned() {
  if (!DECOMMISSIONED) notFound();
  return (
    <section className="mx-auto max-w-2xl pt-8 pb-10 sm:pt-14">
      <div className="card overflow-hidden">
        <Image src={goodbye} alt="" priority placeholder="blur" sizes="(min-width: 672px) 672px, 100vw" className="aspect-[40/27] h-auto w-full object-cover" />
        <div className="p-6 sm:p-8">
          <p className="eyebrow">Site retired</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">This site has been taken down</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            We found out that the seating data it showed was not official, so youwho is switched off.
          </p>
          <p className="mt-3 leading-relaxed text-muted">If an official seating plan is ever shared, it might just come back.</p>
          <p className="mt-6 border-t border-line pt-5 text-ink-2">Thanks to everyone who used it :)</p>
        </div>
      </div>
    </section>
  );
}

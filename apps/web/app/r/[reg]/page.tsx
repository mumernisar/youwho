import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { normalizeReg } from '@youwho/core';
import { getServices } from '@/server/services';
import { showInstallRibbon } from '@/server/install';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { ErrorState } from '@/ui/error-state';
import { InstallRibbon } from '@/ui/install-ribbon';
import { PageNav } from '@/ui/page-nav';
import { PaperList, StudentHeader } from '@/ui/paper-list';
import { SaveGate } from '@/ui/save-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your papers', robots: { index: false } };

export default async function Papers({ params }: { params: Promise<{ reg: string }> }) {
  const raw = decodeURIComponent((await params).reg);
  const canonical = normalizeReg(raw);
  if (canonical && canonical !== raw) redirect(`/r/${canonical}`);

  const s = getServices();
  const [res, ribbon] = await Promise.all([loadPage(async () => s.lookup.lookup(raw, await viewerHash(s))), showInstallRibbon()]);
  if (!res.ok) {
    return (
      <>
        <PageNav back={{ href: '/', label: 'Search again' }} crumbs={[{ href: '/', label: 'Home' }, { label: raw }]} />
        <div className="card mt-4"><ErrorState error={res.error} /></div>
      </>
    );
  }
  const view = res.data;

  return (
    <article>
      {ribbon && <InstallRibbon />}
      <PageNav back={{ href: '/', label: 'Home' }} crumbs={[{ href: '/', label: 'Home' }, { label: view.reg }]} />
      <StudentHeader view={view}>
        <SaveGate reg={view.reg} />
      </StudentHeader>
      <PaperList view={view} />
    </article>
  );
}

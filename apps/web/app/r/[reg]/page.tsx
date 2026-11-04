import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { normalizeReg } from '@youwho/core';
import { getServices } from '@/server/services';
import { showInstallButton } from '@/server/install';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { ErrorState } from '@/ui/error-state';
import { InstallButton } from '@/ui/install-button';
import { PageNav } from '@/ui/page-nav';
import { PaperList, StudentHeader } from '@/ui/paper-list';
import { SaveGate } from '@/ui/save-gate';
import { SpecialStage } from '@/ui/special-banner';
import { specialOf } from '@/ui/special-people';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your papers', robots: { index: false } };

export default async function Papers({ params }: { params: Promise<{ reg: string }> }) {
  const raw = decodeURIComponent((await params).reg);
  const canonical = normalizeReg(raw);
  if (canonical && canonical !== raw) redirect(`/r/${canonical}`);

  const s = getServices();
  const [res, install] = await Promise.all([loadPage(async () => s.lookup.lookup(raw, await viewerHash(s))), showInstallButton()]);
  if (!res.ok) {
    return (
      <>
        <PageNav back={{ href: '/', label: 'Search again' }} crumbs={[{ href: '/', label: 'Home' }, { label: raw }]} />
        <div className="card mt-4"><ErrorState error={res.error} /></div>
      </>
    );
  }
  const view = res.data;
  const special = specialOf(view.reg);

  return (
    <article>
      <PageNav
        back={{ href: '/', label: 'Home' }}
        crumbs={[{ href: '/', label: 'Home' }, { label: view.reg }]}
        aside={install && <InstallButton />}
      />
      {special && <SpecialStage people={[{ id: special.id }]} where="papers" />}
      <StudentHeader view={view}>
        <SaveGate reg={view.reg} />
      </StudentHeader>
      <PaperList view={view} />
    </article>
  );
}

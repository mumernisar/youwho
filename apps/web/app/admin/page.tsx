import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, verifyAdminSession } from '@/server/admin-session';
import { loadPage } from '@/server/page-data';
import { getServices } from '@/server/services';
import { AdminDatasets } from '@/ui/admin-datasets';
import { AdminSignIn } from '@/ui/admin-sign-in';
import { ErrorState } from '@/ui/error-state';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function Admin() {
  const s = getServices();
  const session = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!verifyAdminSession(session, s.env.SESSION_SECRET, s.now().getTime())) return <AdminSignIn />;

  const res = await loadPage(() => s.admin.list());
  if (!res.ok) return <ErrorState error={res.error} />;
  const rows = res.data.map((d) => ({
    slug: d.slug,
    label: d.label,
    sourceUrl: d.sourceUrl,
    students: d.students,
    seats: d.seats,
    confirms: d.confirms,
    reports: d.reports,
    createdAt: d.createdAt,
  }));
  return <AdminDatasets rows={rows} />;
}

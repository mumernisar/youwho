import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import { getServices } from '@/server/services';
import { AddDepartmentProvider } from '@/ui/add-department';
import { Header } from '@/ui/header';
import { OfflineBar } from '@/ui/offline-bar';
import { normalizeTheme } from '@/ui/themes';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'youwho', template: '%s · youwho' },
  description: 'See who is sitting around you in the exam room.',
};

// Pinch-zoom stays enabled.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0b2a5c' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1526' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = normalizeTheme((await cookies()).get('yw_theme')?.value);
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} {...(theme ? { 'data-theme': theme } : {})}>
      <body className="font-sans text-ink antialiased">
        <AddDepartmentProvider>
          <OfflineBar />
          <Header theme={theme} repoUrl={getServices().github.url} />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">{children}</main>
        </AddDepartmentProvider>
      </body>
    </html>
  );
}

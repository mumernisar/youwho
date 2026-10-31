import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { Header } from '@/ui/header';
import './globals.css';

const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'youwho', template: '%s · youwho' },
  description: 'See who is sitting around you in the exam room.',
};

// Pinch-zoom stays enabled.
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

const THEMES = ['paper', 'chalkboard', 'night'];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const picked = (await cookies()).get('yw_theme')?.value ?? null;
  const theme = picked && THEMES.includes(picked) ? picked : null;
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} {...(theme ? { 'data-theme': theme } : {})}>
      <body className="font-sans antialiased">
        <Header theme={theme} />
        <main className="mx-auto w-full max-w-3xl px-4 pb-24">{children}</main>
      </body>
    </html>
  );
}

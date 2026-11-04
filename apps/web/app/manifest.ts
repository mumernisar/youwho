import type { MetadataRoute } from 'next';

/**
 * Makes youwho installable (home screen, full screen). A manifest cannot read CSS variables, so the
 * two colours are copied from the Sand theme: the masthead (also viewport.themeColor in layout.tsx)
 * and the page background. Icons are made from the header's seat mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'youwho',
    short_name: 'youwho',
    description: 'See who is sitting around you in the exam room.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4eee3',
    theme_color: '#2b2016',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

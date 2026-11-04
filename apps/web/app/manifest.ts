import type { MetadataRoute } from 'next';

/**
 * Makes youwho installable (home screen, full screen). A manifest cannot read CSS variables, so the
 * two colours are copied from the Sand theme: the masthead (also viewport.themeColor in layout.tsx)
 * and the page background. Icons are made from the header's seat mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Shown under the icon on the home screen, where a capital reads as a proper app name.
    name: 'Youwho',
    short_name: 'Youwho',
    description: 'See who is sitting around you in the exam room.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4eee3',
    theme_color: '#2b2016',
    // Lets the browser tell the site whether its own app is installed (navigator.getInstalledRelatedApps).
    related_applications: [{ platform: 'webapp', url: '/manifest.webmanifest' }],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

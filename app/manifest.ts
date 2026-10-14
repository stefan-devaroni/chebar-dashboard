import type { MetadataRoute } from 'next';

// Lets staff add the dashboard to a phone or the POS iPad home screen,
// where it opens full-screen like an app, straight to reservations.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Che Bar Dashboard',
    short_name: 'Che Bar',
    description: 'Reservations, schedule and deliveries for the Che Bar team',
    start_url: '/dashboard/reservations',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f1ea',
    theme_color: '#1a1a1a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

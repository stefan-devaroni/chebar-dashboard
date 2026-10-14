import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Che Bar — Dashboard',
  description: 'Internal operations dashboard for Che Bar Aruba',
  applicationName: 'Che Bar',
  // Opens full-screen when added to an iPhone/iPad home screen
  appleWebApp: { capable: true, title: 'Che Bar', statusBarStyle: 'black' },
  icons: { icon: '/favicon-32.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#1a1a1a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

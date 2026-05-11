import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Che Bar — Dashboard',
  description: 'Internal operations dashboard for Che Bar Aruba',
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

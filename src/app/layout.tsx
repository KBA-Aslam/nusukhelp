import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'nusukhelp.com',
  description: 'Hajj & Umrah ground handling — site under construction.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AKALAN Atelier',
  description: 'AI paralegal — E-2 · EB-1A · EB-1B · EB-1C',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}

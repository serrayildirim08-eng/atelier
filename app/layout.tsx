import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: 'variable',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const metadata: Metadata = {
  title: 'AKALAN Atelier',
  description: 'AI paralegal — E-2 · EB-1A · EB-1B · EB-1C',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${fraunces.variable}`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}

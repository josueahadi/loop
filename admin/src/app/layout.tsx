import type { Metadata } from 'next';
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/query-provider';
import { ThemeProvider } from '@/lib/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Loop Admin',
  description: 'Loop internal admin — verification queue + metrics',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>
            <QueryProvider>{children}</QueryProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

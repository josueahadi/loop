'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Wraps next-themes: toggles the `.dark` class shadcn's tokens key off of.
// defaultTheme="system" honours the OS preference (the original bug was that the
// UI ignored dark mode, not that dark mode was unwanted).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="arctic"
      themes={["arctic", "dark", "high-contrast"]}
      storageKey="arctos-theme"
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  );
}

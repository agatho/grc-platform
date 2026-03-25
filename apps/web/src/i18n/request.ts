import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const SUPPORTED_LOCALES = ["de", "en"] as const;
const DEFAULT_LOCALE = "de";
const LOCALE_COOKIE = "NEXT_LOCALE";

export default getRequestConfig(async () => {
  // Read locale from cookie (set by language switcher / profile save)
  let locale: string = DEFAULT_LOCALE;
  try {
    const cookieStore = await cookies();
    const stored = cookieStore.get(LOCALE_COOKIE)?.value;
    if (stored && SUPPORTED_LOCALES.includes(stored as typeof SUPPORTED_LOCALES[number])) {
      locale = stored;
    }
  } catch {
    // cookies() may throw in edge cases (e.g., static generation); fall back to default
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}/common.json`)).default,
  };
});

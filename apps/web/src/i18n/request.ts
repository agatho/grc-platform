import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const locale = "de"; // default locale; will be user-configurable in S1-20

  return {
    locale,
    messages: (await import(`../../messages/${locale}/common.json`)).default,
  };
});

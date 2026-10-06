import { getRequestConfig } from "next-intl/server";

export const DEFAULT_LOCALE = "fr";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    timeZone: "Europe/Paris",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

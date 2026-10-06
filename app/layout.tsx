import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { SwRegister } from "@/components/SwRegister";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: `${t("name")} — ${t("tagline")}`, template: `%s · ${t("name")}` },
    description: t("description"),
    applicationName: t("name"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={instrument.variable}>
      <body className="font-sans">
        <NextIntlClientProvider>
          <div className="flex min-h-dvh items-center justify-center bg-stage">
            <div className="relative flex h-dvh w-full max-w-[402px] flex-col overflow-hidden bg-white shadow-[0_30px_80px_rgba(0,0,0,.16)] min-[460px]:max-h-[874px] min-[460px]:rounded-[28px]">
              {children}
            </div>
          </div>
          <SwRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

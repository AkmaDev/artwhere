import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

export default async function Privacy() {
  const t = await getTranslations("privacy");
  // Adresse de contact du responsable du traitement (le client) : à renseigner dans Vercel.
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const sections: [string, string][] = [
    [t("whatTitle"), t("what")],
    [t("whyTitle"), t("why")],
    [t("keepTitle"), t("keep")],
    [t("alertsTitle"), t("alerts")],
  ];
  return (
    <div className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-5 pt-6 pb-10">
      <Link href="/" className="text-[14px] leading-none font-semibold text-accent no-underline">
        {t("back")}
      </Link>
      <h1 className="m-0 text-[28px] leading-[1.15] font-semibold tracking-[-.02em]">{t("title")}</h1>
      <p className="m-0 text-[15px] leading-[1.5] text-muted">{t("intro")}</p>
      {sections.map(([title, body]) => (
        <section key={title} className="flex flex-col gap-1.5">
          <h2 className="m-0 text-[17px] leading-[1.3] font-semibold">{title}</h2>
          <p className="m-0 text-[14.5px] leading-[1.55] text-ink">{body}</p>
        </section>
      ))}
      {email && <p className="m-0 text-[14.5px] leading-[1.55] text-muted">{t("contact", { email })}</p>}
    </div>
  );
}

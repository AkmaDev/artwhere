import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("detail");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="m-0 text-[16px] leading-[1.45] text-muted">{t("notFound")}</p>
      <Link href="/" className="flex h-11 items-center rounded-[10px] bg-ink px-5 text-[14px] font-semibold text-white no-underline hover:text-white">
        {t("backHome")}
      </Link>
    </div>
  );
}

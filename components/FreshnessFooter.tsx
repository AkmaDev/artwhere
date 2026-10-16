"use client";

import { useLocale, useTranslations } from "next-intl";
import { fmtRelative } from "@/lib/dates";

// Pied de l'accueil : fraîcheur de la liste et nombre de sources, + « Comment on choisit ? ».
export function FreshnessFooter({ lastIngestedAt, sources, onHow }: { lastIngestedAt: string | null; sources: number; onHow: () => void }) {
  const t = useTranslations("home");
  const locale = useLocale();
  return (
    <div className="flex flex-col items-center gap-1 pt-2 text-center text-[12px] leading-normal text-subtle">
      {lastIngestedAt && sources > 0 && <span>{t("freshness", { ago: fmtRelative(lastIngestedAt, locale), count: sources })}</span>}
      <button type="button" onClick={onHow} className="h-11 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-subtle underline">
        {t("howWeChoose")}
      </button>
    </div>
  );
}

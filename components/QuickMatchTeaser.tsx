"use client";

import { useTranslations } from "next-intl";

// Carte d'entrée du Quick Match dans Explorer (derrière NEXT_PUBLIC_QUICK_MATCH).
export function QuickMatchTeaser({ count, city, onPlay }: { count: number; city: string; onPlay: () => void }) {
  const t = useTranslations("home");
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] bg-accent-soft p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[16px] leading-tight font-semibold">{t("quickMatchTitle")}</span>
        <span className="text-[13px] leading-[1.4] text-muted">{t("quickMatchText", { count, city })}</span>
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="flex-none cursor-pointer rounded-[10px] border-0 bg-accent px-3.5 py-2.5 text-[14px] leading-none font-semibold text-white"
      >
        {t("quickMatchCta")}
      </button>
    </div>
  );
}

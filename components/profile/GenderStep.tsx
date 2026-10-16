"use client";

import { useTranslations } from "next-intl";
import { GENDERS, type Gender } from "@/lib/profile";

export function GenderStep({ value, onPick }: { value: Gender | null; onPick: (g: Gender) => void }) {
  const t = useTranslations("profile");
  return (
    <div role="radiogroup" aria-label={t("genderTitle")} className="flex flex-col gap-2.5">
      {GENDERS.map((g) => {
        const on = value === g;
        return (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(g)}
            className={`flex min-h-14 cursor-pointer items-center justify-between rounded-[14px] border-[1.5px] px-[18px] text-left text-[16px] leading-tight font-semibold text-ink ${
              on ? "border-ink bg-sand" : "border-border bg-white"
            }`}
          >
            {t(`genders.${g}`)}
            <span aria-hidden className={`text-[16px] font-semibold ${on ? "opacity-100" : "opacity-0"}`}>
              ✓
            </span>
          </button>
        );
      })}
    </div>
  );
}

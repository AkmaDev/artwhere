"use client";

import { useTranslations } from "next-intl";
import { AGE_RANGES, type AgeRange } from "@/lib/profile";

// Tranches d'âge en grille de 2 colonnes ; un choix passe à l'étape suivante (géré par ProfileFlow).
export function AgeStep({ value, onPick }: { value: AgeRange | null; onPick: (a: AgeRange) => void }) {
  const t = useTranslations("profile");
  return (
    <div role="radiogroup" aria-label={t("ageTitle")} className="grid grid-cols-2 gap-2.5">
      {AGE_RANGES.map((a) => {
        const on = value === a;
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(a)}
            className={`min-h-14 cursor-pointer rounded-[14px] border-[1.5px] text-[16px] leading-tight font-semibold text-ink ${on ? "border-ink bg-sand" : "border-border bg-white"}`}
          >
            {t(`ages.${a}`)}
          </button>
        );
      })}
    </div>
  );
}

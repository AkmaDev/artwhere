"use client";

import { useLocale, useTranslations } from "next-intl";
import { km, shortArea, whenShort } from "@/lib/format";
import { joinDots } from "@/lib/neighborhood";
import type { EventItem } from "@/lib/types";
import { EventImage } from "./ui";

interface Props {
  e: EventItem;
  from: string | null;
  isFav: boolean;
  onOpen: () => void;
  onFav: () => void;
}

// Ligne compacte (rangées par catégorie) : miniature 72, titre, date · heure, lieu · distance, ♡.
export function EventRow({ e, from, isFav, onOpen, onFav }: Props) {
  const t = useTranslations("card");
  const locale = useLocale();
  const when = whenShort(e, from, e.timezone, locale, (date) => t("until", { date }));
  const where = joinDots([e.venueName, e.distanceKm != null ? km(e.distanceKm, locale) : shortArea(e.address)]);
  return (
    <article onClick={onOpen} className="grid cursor-pointer grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3">
      <EventImage src={e.imageUrl} alt="" className="h-[72px] w-[72px]" rounded="rounded-xl" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="m-0 truncate text-[15px] leading-tight font-semibold">{e.title}</h3>
        <span className="truncate text-[13.5px] leading-[1.3] font-medium">{when}</span>
        {where && <span className="truncate text-[13.5px] leading-[1.3] text-muted">{where}</span>}
      </div>
      <button
        type="button"
        aria-label={isFav ? t("removeFav") : t("addFav")}
        aria-pressed={isFav}
        onClick={(ev) => {
          ev.stopPropagation();
          onFav();
        }}
        className={`flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent text-[20px] leading-none ${isFav ? "text-heart" : "text-muted"}`}
      >
        {isFav ? "♥" : "♡"}
      </button>
    </article>
  );
}

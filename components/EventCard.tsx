"use client";

import { useLocale, useTranslations } from "next-intl";
import { isBlocked, km, shortArea, whenShort } from "@/lib/format";
import type { EventItem } from "@/lib/types";
import { EventImage, NewBadge, StatusBadge, usePriceShort } from "./ui";

export interface CardProps {
  e: EventItem;
  from: string | null;
  tz: string;
  isNew: boolean;
  isFav: boolean;
  onOpen: () => void;
  onFav: () => void;
  variant?: "big" | "compact";
}

export function EventCard({ e, from, tz, isNew, isFav, onOpen, onFav, variant = "big" }: CardProps) {
  const t = useTranslations("card");
  const locale = useLocale();
  const price = usePriceShort()(e);
  const when = whenShort(e, from, tz, locale, (date) => t("until", { date }));
  const where = `${e.venueName ?? ""}${e.distanceKm != null ? ` · ${km(e.distanceKm, locale)}` : e.address ? ` · ${shortArea(e.address)}` : ""}`;
  const dim = isBlocked(e.status) ? "opacity-[.62]" : "";

  const fav = (
    <button
      type="button"
      aria-label={isFav ? t("removeFav") : t("addFav")}
      aria-pressed={isFav}
      onClick={(ev) => {
        ev.stopPropagation();
        onFav();
      }}
      className="absolute flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent"
      style={
        variant === "big"
          ? { top: 4, right: 4, fontSize: 24, color: isFav ? "#E5533D" : "#FFFFFF", textShadow: "0 1px 4px rgba(0,0,0,.35)" }
          : { top: -8, right: -8, fontSize: 22, color: isFav ? "#D2402B" : "#6A6A66" }
      }
    >
      {isFav ? "♥" : "♡"}
    </button>
  );

  if (variant === "compact") {
    return (
      <article
        onClick={onOpen}
        className={`relative grid cursor-pointer grid-cols-[92px_minmax(0,1fr)] gap-3.5 ${dim}`}
      >
        <div className="relative h-[92px] overflow-hidden rounded-xl">
          <EventImage src={e.imageUrl} alt="" className="h-full w-full" />
          {isNew && (
            <span className="absolute top-1.5 left-1.5">
              <NewBadge size="sm" />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-[3px] pr-[34px]">
          <h3 className="m-0 text-[15px] leading-tight font-semibold">{e.title}</h3>
          <span className="text-[13.5px] leading-[1.3] font-medium">{when}</span>
          <span className="truncate text-[13.5px] leading-[1.3] text-muted">{where}</span>
          <div className="flex items-center gap-2 pt-[3px]">
            <span className="text-[14px] leading-none font-semibold">{price}</span>
            <StatusBadge status={e.status} size="sm" />
          </div>
        </div>
        {fav}
      </article>
    );
  }

  return (
    <article onClick={onOpen} className={`flex cursor-pointer flex-col gap-2.5 ${dim}`}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[14px]">
        <EventImage src={e.imageUrl} alt="" className="h-full w-full" />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {isNew && <NewBadge />}
          <StatusBadge status={e.status} />
        </div>
        {fav}
      </div>
      <div className="flex flex-col gap-[3px]">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="pretty m-0 text-[16px] leading-tight font-semibold">{e.title}</h3>
          <span className="flex-none text-[15px] leading-tight font-semibold">{price}</span>
        </div>
        <span className="text-[14px] leading-[1.35] font-medium">{when}</span>
        <span className="text-[14px] leading-[1.35] text-muted">{where}</span>
      </div>
    </article>
  );
}

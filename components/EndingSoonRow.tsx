"use client";

import { useLocale, useTranslations } from "next-intl";
import { km, shortArea } from "@/lib/format";
import { joinDots } from "@/lib/neighborhood";
import type { EventItem } from "@/lib/types";
import { getUrgency } from "@/lib/urgency";
import { EventImage, UrgencyBadge } from "./ui";

interface Props {
  events: EventItem[];
  isFav: (id: string) => boolean;
  onOpen: (e: EventItem) => void;
  onFav: (e: EventItem) => void;
  onSeeAll: () => void;
}

// « Dernière chance » : carrousel horizontal des événements qui se terminent ou affichent bientôt complet.
export function EndingSoonRow({ events, isFav, onOpen, onFav, onSeeAll }: Props) {
  const t = useTranslations("home");
  const tc = useTranslations("card");
  const locale = useLocale();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-[18px] leading-[1.2] font-semibold tracking-[-.01em]">{t("endingSoon")}</h2>
        <button type="button" onClick={onSeeAll} className="h-11 cursor-pointer border-0 bg-transparent p-0 text-[13px] leading-none font-semibold text-muted">
          {t("seeAllShort")}
        </button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto overscroll-x-contain px-4">
        {events.map((e) => {
          const u = getUrgency(e);
          const fav = isFav(e.id);
          return (
            <article key={e.id} onClick={() => onOpen(e)} className="flex w-[220px] flex-none cursor-pointer flex-col gap-2">
              <div className="relative h-[138px] w-[220px] overflow-hidden rounded-[14px]">
                <EventImage src={e.imageUrl} alt="" className="h-full w-full" />
                {u && (
                  <span className="absolute top-2.5 left-2.5">
                    <UrgencyBadge urgency={u} />
                  </span>
                )}
                <button
                  type="button"
                  aria-label={fav ? tc("removeFav") : tc("addFav")}
                  aria-pressed={fav}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onFav(e);
                  }}
                  className={`absolute top-1 right-1 flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent text-[24px] [text-shadow:0_1px_4px_rgba(0,0,0,.35)] ${
                    fav ? "text-heart-light" : "text-white"
                  }`}
                >
                  {fav ? "♥" : "♡"}
                </button>
              </div>
              <h3 className="m-0 line-clamp-2 text-[15px] leading-tight font-semibold">{e.title}</h3>
              <span className="truncate text-[14px] leading-[1.35] text-muted">
                {joinDots([e.venueName, e.distanceKm != null ? km(e.distanceKm, locale) : shortArea(e.address)])}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

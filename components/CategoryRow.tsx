"use client";

import { useTranslations } from "next-intl";
import type { CategoryId } from "@/lib/categories";
import type { EventItem } from "@/lib/types";
import { EventRow } from "./EventRow";

interface Props {
  cat: CategoryId;
  /** Tous les événements de la catégorie (le compteur « Voir les n »). */
  events: EventItem[];
  from: string | null;
  isFav: (id: string) => boolean;
  onOpen: (e: EventItem) => void;
  onFav: (e: EventItem) => void;
  onSeeAll: () => void;
}

export const ROW_SIZE = 3;

// Rangée d'une catégorie : 3 événements au plus, « Voir les n › » ouvre la liste filtrée.
export function CategoryRow({ cat, events, from, isFav, onOpen, onFav, onSeeAll }: Props) {
  const t = useTranslations("home");
  const tc = useTranslations("categories");
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-[18px] leading-[1.2] font-semibold tracking-[-.01em]">{tc(`${cat}.name`)}</h2>
        {events.length > ROW_SIZE && (
          <button type="button" onClick={onSeeAll} className="h-11 cursor-pointer border-0 bg-transparent p-0 text-[13px] leading-none font-semibold text-muted">
            {t("seeAll", { count: events.length })}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {events.slice(0, ROW_SIZE).map((e) => (
          <EventRow key={e.id} e={e} from={from} isFav={isFav(e.id)} onOpen={() => onOpen(e)} onFav={() => onFav(e)} />
        ))}
      </div>
    </section>
  );
}

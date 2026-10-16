"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { whenShort } from "@/lib/format";
import type { EventItem } from "@/lib/types";
import type { VenueData } from "@/lib/types";
import { SyncCard } from "./SyncCard";
import { EventImage, Pill, StatusBadge, usePriceShort } from "./ui";
import { FollowButton } from "./VenueBlock";

type Followed = { id: string; name: string };

interface Props {
  favs: EventItem[];
  onOpen: (e: EventItem) => void;
  onRemove: (e: EventItem) => void;
  venues: Followed[];
  onOpenVenue: (v: Followed) => void;
  onUnfollow: (id: string) => void;
  flash: (s: string) => void;
}

// Nombre de dates à venir, chargé à la demande (rien n'est affiché si l'appel échoue).
function useUpcomingCounts(ids: string[], enabled: boolean): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = ids.join(",");
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    for (const id of key ? key.split(",") : []) {
      fetch(`/api/venues/${encodeURIComponent(id)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : r.status === 404 ? { events: [] } : null))
        .then((d: Pick<VenueData, "events"> | null) => d && setCounts((c) => ({ ...c, [id]: d.events.length })))
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [key, enabled]);
  return counts;
}

export function Favorites({ favs, onOpen, onRemove, venues, onOpenVenue, onUnfollow, flash }: Props) {
  const t = useTranslations("favs");
  const tc = useTranslations("card");
  const locale = useLocale();
  const price = usePriceShort();
  const now = Date.now();
  const sorted = [...favs].sort((a, b) => a.nextAt.localeCompare(b.nextAt));
  const tv = useTranslations("venue");
  const [view, setView] = useState<"events" | "venues">("events");
  // Bascule masquée tant qu'aucun lieu n'est suivi : l'écran reste celui d'avant.
  const showVenues = venues.length > 0 && view === "venues";
  const counts = useUpcomingCounts(venues.map((v) => v.id), showVenues);

  return (
    <div className="no-scrollbar flex h-full flex-col gap-1.5 overflow-y-auto px-4 pt-6 pb-[90px]">
      <h1 className="m-0 mb-1 text-[28px] leading-[1.15] font-semibold tracking-[-.02em]">{t("title")}</h1>
      <span className="text-[13px] leading-[1.4] text-muted">{t("sub")}</span>
      {venues.length > 0 && (
        <div className="flex gap-2 pt-2.5">
          <Pill on={view === "events"} onClick={() => setView("events")} className="h-8 px-3.5 text-[14px] leading-none font-semibold">
            {t("events", { count: favs.length })}
          </Pill>
          <Pill on={view === "venues"} onClick={() => setView("venues")} className="h-8 px-3.5 text-[14px] leading-none font-semibold">
            {t("venues", { count: venues.length })}
          </Pill>
        </div>
      )}
      {showVenues ? (
        <div className="flex flex-col pt-2.5">
          {venues.map((v) => (
            <article
              key={v.id}
              onClick={() => onOpenVenue(v)}
              className="grid cursor-pointer grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line py-3.5"
            >
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[10px] bg-sand text-[22px] leading-none font-semibold text-muted">
                {v.name.trim()[0]?.toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col gap-[3px]">
                <h3 className="m-0 truncate text-[15px] leading-tight font-semibold">{v.name}</h3>
                {counts[v.id] != null && <span className="text-[13.5px] leading-[1.3] text-muted">{tv("upcoming", { count: counts[v.id] })}</span>}
              </div>
              <FollowButton name={v.name} following onClick={() => onUnfollow(v.id)} />
            </article>
          ))}
        </div>
      ) : sorted.length > 0 ? (
        <div className="flex flex-col pt-2.5">
          {sorted.map((e) => {
            const past = new Date(e.endAt).getTime() < now;
            return (
              <article
                key={e.id}
                onClick={() => !past && onOpen(e)}
                className={`relative grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 border-b border-line py-3.5 ${past ? "opacity-[.62]" : "cursor-pointer"}`}
              >
                <EventImage src={e.imageUrl} alt="" className="h-[72px] w-[72px]" rounded="rounded-[10px]" />
                <div className="flex min-w-0 flex-col gap-[3px] pr-9">
                  <h3 className="m-0 text-[15px] leading-tight font-semibold">{e.title}</h3>
                  <span className="text-[13.5px] leading-[1.3] font-medium">{whenShort(e, null, e.timezone, locale, (date) => tc("until", { date }))}</span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[13px] leading-[1.3] text-muted">{price(e)}</span>
                    {past ? (
                      <span className="flex h-[22px] items-center rounded-[6px] bg-line px-[7px] text-[11.5px] leading-none font-semibold text-[#55534E]">
                        {t("past")}
                      </span>
                    ) : (
                      <StatusBadge status={e.status} size="sm" />
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={tc("removeFav")}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onRemove(e);
                  }}
                  className="absolute top-1.5 -right-2 h-11 w-11 cursor-pointer border-0 bg-transparent text-[22px] leading-none text-heart"
                >
                  ♥
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-2.5 py-[60px] text-center">
          <span className="text-[17px] leading-[1.3] font-semibold">{t("emptyTitle")}</span>
          <span className="max-w-[260px] text-[14px] leading-[1.45] text-muted">{t("emptyMsg")}</span>
        </div>
      )}
      {process.env.NEXT_PUBLIC_SYNC === "1" && (favs.length >= 3 || venues.length > 0) && <SyncCard flash={flash} />}
    </div>
  );
}

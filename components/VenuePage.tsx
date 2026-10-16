"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fmtRelative } from "@/lib/dates";
import { getNeighborhood } from "@/lib/neighborhood";
import type { EventItem, VenueData } from "@/lib/types";
import { EventRow } from "./EventRow";
import { EventImage } from "./ui";
import { FollowButton } from "./VenueBlock";

interface Props {
  id: string;
  /** Nom connu avant chargement (bloc lieu, Favoris). */
  name: string;
  /** Données déjà chargées côté serveur (lien partagé /l/[id]). */
  initial?: VenueData | null;
  from: string | null;
  following: boolean;
  alertsOn: boolean;
  isFav: (id: string) => boolean;
  onFav: (e: EventItem) => void;
  onOpenEvent: (e: EventItem) => void;
  onFollow: () => void;
  /** « Gérer dans Alertes » / « Activer les alertes » ; absent sur un lien partagé. */
  onAlerts?: () => void;
  onClose: () => void;
}

// Page lieu (spec 05), en surimpression comme la fiche. Jamais de nombre d'abonnés : aucun compteur côté serveur.
export function VenuePage({ id, name, initial, from, following, alertsOn, isFav, onFav, onOpenEvent, onFollow, onAlerts, onClose }: Props) {
  const t = useTranslations("venuePage");
  const ts = useTranslations("sources");
  const locale = useLocale();
  const [data, setData] = useState<VenueData | null>(initial ?? null);
  const [state, setState] = useState<"loading" | "ok" | "error" | "missing">(initial ? "ok" : "loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (initial) return;
    const ctrl = new AbortController();
    setState("loading");
    fetch(`/api/venues/${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 404) return setState("missing");
        if (!r.ok) throw new Error(String(r.status));
        setData((await r.json()) as VenueData);
        setState("ok");
      })
      .catch(() => !ctrl.signal.aborted && setState("error"));
    return () => ctrl.abort();
  }, [id, initial, reload]);

  const v = data?.venue;
  const title = v?.name || name;
  const events = data?.events ?? [];
  const area = v ? (getNeighborhood(v) ?? v.cityName) : null;
  const sourceNames = (data?.sources ?? []).map((s) => (ts.has(s) ? ts(s) : s));

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="relative h-[240px]">
          <EventImage src={v?.imageUrl ?? null} alt="" className="h-full w-full" />
          <button
            type="button"
            aria-label={t("back")}
            onClick={onClose}
            className="absolute top-3.5 left-3.5 h-10 w-10 cursor-pointer rounded-full border-0 bg-white text-[18px] leading-none font-medium shadow-[0_2px_8px_rgba(0,0,0,.15)]"
          >
            ←
          </button>
        </div>
        <div className="relative -mt-[18px] flex flex-col gap-3.5 rounded-t-[20px] bg-white px-5 pt-5 pb-6">
          {(v?.isPlace || area) && (
            <div className="flex flex-wrap gap-1.5">
              {v?.isPlace && <span className="flex h-[26px] items-center rounded-[7px] bg-sand px-[9px] text-[12px] leading-none font-medium">{t("place")}</span>}
              {area && <span className="flex h-[26px] items-center rounded-[7px] bg-sand px-[9px] text-[12px] leading-none font-medium">{area}</span>}
            </div>
          )}
          <h1 className="balance m-0 text-[26px] leading-[1.15] font-semibold tracking-[-.02em]">{title}</h1>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] leading-[1.4] text-muted">{state === "ok" ? t("upcoming", { count: events.length }) : state === "loading" ? t("loading") : ""}</span>
            <FollowButton name={title} following={following} onClick={onFollow} />
          </div>
          {following && (
            <div className="rounded-[14px] bg-accent-soft px-3.5 py-3 text-[13px] leading-[1.45] text-[#3F3F3B]">
              {alertsOn ? t("followingInfo", { venue: title }) : t("followingInfoOff", { venue: title })}
              {onAlerts && (
                <>
                  {" "}
                  <button type="button" onClick={onAlerts} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-ink underline">
                    {alertsOn ? t("manageAlerts") : t("enableAlerts")}
                  </button>
                </>
              )}
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-2.5 py-8 text-center">
              <span className="text-[14px] leading-[1.45] text-muted">{t("error")}</span>
              <button
                type="button"
                onClick={() => setReload((x) => x + 1)}
                className="h-11 cursor-pointer rounded-[10px] border border-ink bg-white px-[18px] text-[14px] leading-none font-semibold"
              >
                {t("retry")}
              </button>
            </div>
          )}
          {state === "missing" && <p className="m-0 py-6 text-center text-[14px] leading-[1.45] text-muted">{t("notFound")}</p>}

          {state === "ok" && (
            <>
              <h2 className="m-0 pt-2 text-[18px] leading-[1.2] font-semibold">{t("onStage")}</h2>
              {events.length ? (
                <div className="flex flex-col gap-3.5">
                  {events.map((e) => (
                    <EventRow key={e.id} e={e} from={from} isFav={isFav(e.id)} onOpen={() => onOpenEvent(e)} onFav={() => onFav(e)} />
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[14px] leading-[1.45] text-muted">{t("nothing")}</p>
              )}
              {sourceNames.length > 0 && data?.lastIngestedAt && (
                <p className="m-0 pt-3 text-center text-[12px] leading-normal text-subtle">
                  {t("source", { sources: sourceNames.join(", "), ago: fmtRelative(data.lastIngestedAt, locale) })}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

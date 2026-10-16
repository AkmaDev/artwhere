"use client";

import { useLocale, useTranslations } from "next-intl";
import { fmtDayLong, fmtRelative, fmtTime, localDay } from "@/lib/dates";
import { useIsIos } from "@/lib/device";
import { isBlocked, km, money } from "@/lib/format";
import { cityLabel, getNeighborhood, joinDots } from "@/lib/neighborhood";
import type { EventItem } from "@/lib/types";
import { getUrgency } from "@/lib/urgency";
import { EventImage, NewBadge, StatusBadge, UrgencyBadge, usePriceShort } from "./ui";
import { VenueBlock } from "./VenueBlock";

interface Props {
  e: EventItem;
  isNew: boolean;
  isFav: boolean;
  onClose: () => void;
  onFav: () => void;
  flash: (s: string) => void;
  /** Nombre de dates à venir au même lieu parmi les événements chargés (inconnu sur une fiche partagée). */
  venueUpcoming?: number | null;
  /** Page lieu et Suivre : seulement si la ville de l'événement est connue. */
  onOpenVenue?: () => void;
  venueFollowing?: boolean;
  onFollowVenue?: () => void;
}

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

function fullDate(day: string, locale: string): string {
  const s = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00Z`),
  );
  return s;
}

export function EventDetail({ e, isNew, isFav, onClose, onFav, flash, venueUpcoming = null, onOpenVenue, venueFollowing = false, onFollowVenue }: Props) {
  const t = useTranslations("detail");
  const tc = useTranslations("card");
  const tcat = useTranslations("categories");
  const ts = useTranslations("sources");
  const tt = useTranslations("toast");
  const locale = useLocale();
  const ios = useIsIos();
  const priceShort = usePriceShort()(e);
  const tz = e.timezone;
  const isPlace = e.kind === "place";

  const startDay = localDay(e.startAt, tz);
  const endDay = localDay(e.endAt, tz);
  const dates = e.allDay
    ? t("until", { date: fullDate(endDay, locale) })
    : startDay === endDay
      ? fmtDayLong(startDay, locale)
      : t("fromTo", { a: fmtDayLong(startDay, locale, false), b: fmtDayLong(endDay, locale, false) });
  const nextTime = fmtTime(e.nextAt, tz, locale);
  const hours = e.hoursText ?? (e.allDay || nextTime === "00h00" ? null : nextTime);

  const priceLong =
    e.priceMin == null
      ? t("priceUnknown")
      : e.priceMin === 0
        ? t("freeLong")
        : e.priceMax != null && e.priceMax > e.priceMin
          ? t("fromLong", { price: money(e.priceMin, locale, e.currency) })
          : t("exactLong", { price: money(e.priceMin, locale, e.currency) });

  const sourceNames = e.sources.map((s) => (ts.has(s) ? ts(s) : s));
  const blocked = isBlocked(e.status);
  const urgency = getUrgency(e);
  // « Dernières places » remplace le badge de statut « bientôt complet » (pas de doublon).
  const showStatus = !isPlace && !(e.status === "almost_full" && urgency);
  const area = getNeighborhood(e) ?? cityLabel(e);
  const whereLine2 = joinDots([area, e.distanceKm != null ? km(e.distanceKm, locale) : null]);
  const whereLine1 = [e.venueName, e.address].filter(Boolean).join(", ");
  const href = blocked ? (e.officialUrl ?? e.ticketUrl) : (e.ticketUrl ?? e.officialUrl);
  const isBooking = !blocked && !!e.ticketUrl && e.priceMin !== 0;
  const ctaSub =
    e.status === "cancelled"
      ? t("cancelled")
      : e.status === "full"
        ? t("noMoreSeats")
        : e.status === "closed"
          ? t("salesClosed")
          : sourceNames[0]
            ? t("on", { source: sourceNames[0] })
            : "";

  const dest = e.lat != null && e.lng != null ? `${e.lat},${e.lng}` : encodeURIComponent(`${e.venueName ?? ""} ${e.address ?? ""}`);
  const directions = ios ? `https://maps.apple.com/?daddr=${dest}` : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;

  const share = async () => {
    const url = `${window.location.origin}/e/${e.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: e.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash(tt("linkCopied"));
    } catch {}
  };

  const row = (label: string, body: React.ReactNode) => (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-line py-3.5">
      <span className="text-[13px] leading-[1.4] font-medium text-muted">{label}</span>
      {body}
    </div>
  );

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="relative h-[280px]">
          <EventImage src={e.imageUrl} alt={tc("photo")} className="h-full w-full" />
          <button
            type="button"
            aria-label={t("back")}
            onClick={onClose}
            className="absolute top-3.5 left-3.5 h-10 w-10 cursor-pointer rounded-full border-0 bg-white text-[18px] leading-none font-medium shadow-[0_2px_8px_rgba(0,0,0,.15)]"
          >
            ←
          </button>
          <div className="absolute top-3.5 right-3.5 flex gap-2">
            <button
              type="button"
              onClick={share}
              className="h-10 cursor-pointer rounded-full border-0 bg-white px-3.5 text-[13px] leading-none font-semibold shadow-[0_2px_8px_rgba(0,0,0,.15)]"
            >
              {t("share")}
            </button>
            <button
              type="button"
              aria-label={isFav ? tc("removeFav") : tc("addFav")}
              aria-pressed={isFav}
              onClick={onFav}
              className="h-10 w-10 cursor-pointer rounded-full border-0 bg-white text-[19px] leading-none shadow-[0_2px_8px_rgba(0,0,0,.15)]"
              style={{ color: isFav ? "#D2402B" : "#6A6A66" }}
            >
              {isFav ? "♥" : "♡"}
            </button>
          </div>
        </div>
        <div className="relative -mt-[18px] flex flex-col gap-[18px] rounded-t-[20px] bg-white px-5 pt-[22px] pb-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-1.5">
              {urgency && <UrgencyBadge urgency={urgency} />}
              {isNew && <NewBadge />}
              {showStatus && <StatusBadge status={e.status} />}
              {e.categories.map((c) => (
                <span key={c} className="flex h-[26px] items-center rounded-[7px] bg-sand px-[9px] text-[12px] leading-none font-medium">
                  {tcat(`${c}.name`)}
                </span>
              ))}
            </div>
            <h1 className="balance m-0 text-[26px] leading-[1.15] font-semibold tracking-[-.02em]">{e.title}</h1>
            {e.description && <p className="pretty m-0 text-[15px] leading-normal text-[#3F3F3B]">{e.description}</p>}
          </div>
          <div className="flex flex-col border-t border-line">
            {isPlace ? (
              row(t("hours"), <span className="text-[15px] leading-[1.4]">{e.hoursText ?? t("hoursUnknown")}</span>)
            ) : row(
              t("when"),
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] leading-[1.4] font-semibold">{dates}</span>
                {hours && <span className="text-[14px] leading-[1.4]">{hours}</span>}
                {e.durationText && <span className="text-[13px] leading-[1.4] text-muted">{t("duration", { d: e.durationText })}</span>}
              </div>,
            )}
            {row(
              t("where"),
              <div className="flex flex-col gap-0.5">
                {whereLine1 && <span className="text-[15px] leading-[1.4] text-ink">{whereLine1}</span>}
                {whereLine2 && <span className="text-[15px] leading-[1.4] text-muted">{whereLine2}</span>}
                <a href={directions} target="_blank" rel="noopener noreferrer" className="text-[14px] leading-[1.6] font-semibold text-ink">
                  {t("directions")}
                </a>
              </div>,
            )}
            {(!isPlace || e.priceMin != null) && row(t("price"), <span className="text-[15px] leading-[1.4] font-semibold">{priceLong}</span>)}
            {row(
              t("source"),
              <span className="flex flex-col gap-0.5 text-[14px] leading-[1.45]">
                <span className="text-ink">{sourceNames.join(" + ")}</span>
                <span className="text-muted">{t("verified", { when: fmtRelative(e.lastCheckedAt, locale) })}</span>
              </span>,
            )}
          </div>
          {!isPlace && e.venueName && (
            <VenueBlock name={e.venueName} upcoming={venueUpcoming} onOpen={onOpenVenue} following={venueFollowing} onFollow={onFollowVenue} />
          )}
          <p className={`m-0 text-[12px] leading-normal text-subtle ${isPlace ? "hidden" : ""}`}>
            {t("relay")}
            {CONTACT && (
              <>
                {" "}
                <a
                  href={`mailto:${CONTACT}?subject=${encodeURIComponent(t("reportSubject", { title: e.title, id: e.id }))}`}
                  className="text-subtle underline"
                >
                  {t("report")}
                </a>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-none items-center justify-between gap-4 border-t border-line bg-white px-5 pt-3 pb-[18px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[17px] leading-tight font-semibold">{isPlace ? t("placeLabel") : priceShort}</span>
          <span className="text-[12.5px] leading-tight text-muted">{ctaSub}</span>
        </div>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-[50px] flex-none items-center rounded-xl px-[22px] text-[16px] leading-none font-semibold no-underline ${
              blocked ? "bg-sand text-ink hover:text-ink" : "bg-accent text-white hover:text-white"
            }`}
          >
            {isPlace ? t("website") : isBooking ? t("book") : t("official")}
          </a>
        )}
      </div>
    </div>
  );
}

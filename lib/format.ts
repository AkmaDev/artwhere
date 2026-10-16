import { fmtDayShort, fmtTime, localDay } from "./dates";
import type { EventItem, EventStatus } from "./types";

export const STATUS_STYLE: Record<EventStatus, { bg: string; fg: string }> = {
  available: { bg: "#E2F0E6", fg: "#17613A" },
  almost_full: { bg: "var(--color-urgent-bg)", fg: "var(--color-urgent-fg)" },
  full: { bg: "#1E1E1C", fg: "#FFFFFF" },
  closed: { bg: "#ECEAE5", fg: "#55534E" },
  cancelled: { bg: "#ECEAE5", fg: "#55534E" },
};

export function isBlocked(s: EventStatus): boolean {
  return s === "full" || s === "closed" || s === "cancelled";
}

export function money(n: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

export function firstDay(e: EventItem, from: string | null, tz: string): string {
  const d = localDay(e.nextAt, tz);
  return from && from > d ? from : d;
}

export const ordinalFr = (n: number) => (n === 1 ? "1er" : `${n}e`);

/** Arrondissement tiré d'un code postal (Paris, Lyon, Marseille), sinon null. */
export function arrondissement(text: string | null | undefined): { city: string; n: number } | null {
  if (!text) return null;
  const paris = text.match(/\b75(0\d{2}|116)\b/);
  if (paris) return { city: "Paris", n: paris[1] === "116" ? 16 : Number(paris[1]) };
  const lyon = text.match(/\b6900([1-9])\b/);
  if (lyon) return { city: "Lyon", n: Number(lyon[1]) };
  const marseille = text.match(/\b130(0[1-9]|1[0-6])\b/);
  if (marseille) return { city: "Marseille", n: Number(marseille[1]) };
  return null;
}

export function shortArea(address: string | null): string {
  if (!address) return "";
  const arr = arrondissement(address);
  if (arr) return `${arr.city} ${ordinalFr(arr.n)}`;
  const parts = address.split(",").map((s) => s.trim());
  return parts[parts.length - 1].replace(/^\d{4,5}\s+/, "");
}

export function km(d: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(d)} km`;
}

export function whenShort(
  e: EventItem,
  from: string | null,
  tz: string,
  locale: string,
  until: (date: string) => string,
): string {
  if (e.allDay) return until(fmtDayShort(localDay(e.endAt, tz), locale).replace(/^\S+\s/, ""));
  const day = fmtDayShort(firstDay(e, from, tz), locale);
  const time = fmtTime(e.nextAt, tz, locale);
  // 00h00 = heure non communiquée par la source.
  return time === "00h00" ? day : `${day} · ${time}`;
}

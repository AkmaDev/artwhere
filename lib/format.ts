import { fmtDayShort, fmtTime, localDay } from "./dates";
import type { EventItem, EventStatus } from "./types";

export const STATUS_STYLE: Record<EventStatus, { bg: string; fg: string }> = {
  available: { bg: "#E2F0E6", fg: "#17613A" },
  almost_full: { bg: "#FDE9C2", fg: "#6E3D00" },
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

export function shortArea(address: string | null): string {
  if (!address) return "";
  const m = address.match(/\b75(0\d{2}|116)\b/);
  if (m) {
    const n = m[1] === "116" ? 16 : Number(m[1]);
    return `Paris ${n === 1 ? "1er" : `${n}e`}`;
  }
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

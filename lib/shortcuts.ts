import { addDays, localDay, localHour, shortcutRanges } from "./dates";
import type { EventItem } from "./types";

export const SHORTCUT_IDS = ["today", "weekend", "new", "free"] as const;
export type ShortcutId = (typeof SHORTCUT_IDS)[number];

type E = Pick<EventItem, "allDay" | "startAt" | "endAt" | "nextAt" | "timezone" | "priceMin">;

/** L'événement a lieu ce jour-là (jour local de sa ville). */
export function onDay(e: E, day: string): boolean {
  if (e.allDay) {
    const endDay = localDay(new Date(new Date(e.endAt).getTime() - 1), e.timezone);
    return localDay(e.startAt, e.timezone) <= day && endDay >= day;
  }
  return localDay(e.nextAt, e.timezone) === day;
}

/** Samedi + dimanche à venir, vendredi soir inclus après 18h. */
export function onWeekend(e: E, today: string): boolean {
  const we = shortcutRanges(today).find((r) => r.id === "weekend")!;
  if (e.allDay) {
    const endDay = localDay(new Date(new Date(e.endAt).getTime() - 1), e.timezone);
    return localDay(e.startAt, e.timezone) <= we.to && endDay >= we.from;
  }
  const d = localDay(e.nextAt, e.timezone);
  if (d >= we.from && d <= we.to) return true;
  return d === addDays(we.from, -1) && we.from !== today && localHour(e.nextAt, e.timezone) >= 18;
}

export function matchesShortcut(id: ShortcutId, e: E, ctx: { today: string; isNew: boolean }): boolean {
  switch (id) {
    case "today":
      return onDay(e, ctx.today);
    case "weekend":
      return onWeekend(e, ctx.today);
    case "new":
      return ctx.isNew;
    case "free":
      return e.priceMin === 0;
  }
}

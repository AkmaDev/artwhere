import { addDays, localDay, localHour } from "./dates";
import type { EventItem } from "./types";

export type UrgencyKey = "tonight" | "endsToday" | "endsTomorrow" | "daysLeft" | "lastSeats";
export type Urgency = { key: UrgencyKey; days?: number; lastSeats?: boolean } | null;

type UrgencyInput = Pick<EventItem, "kind" | "status" | "startAt" | "endAt" | "nextAt" | "allDay" | "timezone">;

const DAY_MS = 86_400_000;

/**
 * Badge d'urgence d'un événement, calculé dans le fuseau de sa ville.
 * Ordre : dernières places (combinable avec « ce soir »), ce soir, se termine aujourd'hui / demain, plus que 2-3 jours.
 */
export function getUrgency(e: UrgencyInput, now = new Date()): Urgency {
  if (e.kind === "place") return null;
  const end = new Date(e.endAt).getTime();
  if (end < now.getTime()) return null;

  const tz = e.timezone;
  const today = localDay(now, tz);
  // Une fin pile à minuit appartient au jour précédent.
  const endDay = localDay(new Date(end - 1), tz);
  // « Sur plusieurs jours » : exposition, festival… ; une soirée 22h-1h reste un événement ponctuel.
  const multiDay = e.allDay || end - new Date(e.startAt).getTime() > DAY_MS;
  const tonight = !e.allDay && !multiDay && localDay(e.nextAt, tz) === today && localHour(e.nextAt, tz) >= 17;

  if (e.status === "almost_full") return tonight ? { key: "tonight", lastSeats: true } : { key: "lastSeats" };
  if (tonight) return { key: "tonight" };
  if (!multiDay) return null;
  if (endDay === today) return { key: "endsToday" };
  if (endDay === addDays(today, 1)) return { key: "endsTomorrow" };
  for (const days of [2, 3]) if (endDay === addDays(today, days)) return { key: "daysLeft", days };
  return null;
}

/** Date de fin utilisée pour trier « Dernière chance ». */
export function urgencyEnd(e: Pick<EventItem, "endAt">): number {
  return new Date(e.endAt).getTime();
}

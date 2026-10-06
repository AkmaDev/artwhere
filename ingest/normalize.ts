import type { EventStatus } from "../lib/types";
import type { NormalizedEvent } from "./types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", hellip: "…", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text || null;
}

export function truncate(s: string | null, max = 600): string | null {
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" "))).trim() + "…";
}

export function normText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[«»"'’`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP_TITLE = /\b(exposition|expo|concert|spectacle|visite guidee|visite|atelier|festival|le|la|les|l|de|du|des|d|et|a)\b/g;
export function normTitle(s: string): string {
  return normText(s).replace(STOP_TITLE, " ").replace(/\s+/g, " ").trim() || normText(s);
}

export function normVenue(s: string | null): string | null {
  if (!s) return null;
  const v = normText(s).replace(/\b(le|la|les|l|de|du|des|d|paris|salle|theatre|musee)\b/g, " ").replace(/\s+/g, " ").trim();
  return v || null;
}

/** Extrait min/max des montants en euros d'un texte libre. */
export function parsePrices(text: string | null): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };
  const nums = [...text.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur\b)/gi)].map((m) => Number(m[1].replace(",", ".")));
  const ranges = [...text.matchAll(/de\s+(\d+(?:[.,]\d{1,2})?)\s+à\s+(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/gi)].flatMap((m) => [
    Number(m[1].replace(",", ".")),
    Number(m[2].replace(",", ".")),
  ]);
  const all = [...nums, ...ranges].filter((n) => Number.isFinite(n) && n < 2000);
  if (!all.length) return { min: null, max: null };
  return { min: Math.min(...all), max: Math.max(...all) };
}

export function fmtHourRange(startIso: string, endIso: string, tz: string): string {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const a = f.format(new Date(startIso)).replace(":", "h");
  const b = f.format(new Date(endIso)).replace(":", "h");
  return a === b ? a : `${a}–${b}`;
}

export function fmtDuration(startIso: string, endIso: string): string | null {
  const min = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (min <= 0 || min > 12 * 60) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

const STATUS_RANK: Record<EventStatus, number> = { available: 0, almost_full: 1, full: 2, closed: 3, cancelled: 4 };
export function moreRestrictive(a: EventStatus, b: EventStatus): EventStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/** Une période continue de plus de 24 h ou des séances étalées sur plus de 2 semaines = « en cours » (expo, lieu). */
export function looksOngoing(e: Pick<NormalizedEvent, "startAt" | "endAt" | "occurrences">): boolean {
  const span = new Date(e.endAt).getTime() - new Date(e.startAt).getTime();
  if (e.occurrences.length <= 1) return span > 24 * 3600e3;
  const wholeDays = e.occurrences.every(([a, b]) => new Date(b).getTime() - new Date(a).getTime() >= 20 * 3600e3);
  return wholeDays || (span > 14 * 86400e3 && e.occurrences.length > 10);
}

export function isHttpUrl(s: unknown): s is string {
  return typeof s === "string" && /^https?:\/\/[^\s]+$/i.test(s);
}

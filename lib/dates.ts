// Les jours (YYYY-MM-DD) sont toujours des jours locaux du fuseau de la ville.

export function localDay(instant: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(instant),
  );
}

export function localHour(instant: Date | string, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(instant));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

function tzOffsetMs(instant: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - instant;
}

export function zonedDayStart(day: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - tzOffsetMs(guess, tz);
  return new Date(guess - tzOffsetMs(first, tz));
}

export function zonedDayEnd(day: string, tz: string): Date {
  return new Date(zonedDayStart(addDays(day, 1), tz).getTime() - 1);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function todayIn(tz: string): string {
  return localDay(new Date(), tz);
}

export function shortcutRanges(today: string): { id: "today" | "weekend" | "week"; from: string; to: string }[] {
  const wd = weekday(today);
  const toSunday = (7 - wd) % 7;
  const sunday = addDays(today, toSunday);
  const saturday = wd === 0 ? today : addDays(today, (6 - wd + 7) % 7);
  return [
    { id: "today", from: today, to: today },
    { id: "weekend", from: wd === 0 ? today : saturday, to: sunday },
    { id: "week", from: today, to: sunday },
  ];
}

const fmt = (locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });

const asUtcNoon = (day: string) => new Date(`${day}T12:00:00Z`);

export function fmtDayShort(day: string, locale: string): string {
  return fmt(locale, { weekday: "short", day: "numeric", month: "short" }).format(asUtcNoon(day));
}

export function fmtDayLong(day: string, locale: string, capitalize = true): string {
  const s = fmt(locale, { weekday: "long", day: "numeric", month: "long" }).format(asUtcNoon(day));
  return capitalize ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function fmtMonthYear(day: string, locale: string): string {
  const s = fmt(locale, { month: "long", year: "numeric" }).format(asUtcNoon(day));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtRange(from: string, to: string, locale: string): string {
  if (from === to) return fmtDayShort(from, locale);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const a = sameMonth
    ? fmt(locale, { day: "numeric" }).format(asUtcNoon(from))
    : fmt(locale, { day: "numeric", month: "short" }).format(asUtcNoon(from));
  const b = fmt(locale, { day: "numeric", month: "short" }).format(asUtcNoon(to));
  return `${a} – ${b}`;
}

export function fmtTime(instant: string, tz: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit" })
    .format(new Date(instant))
    .replace(":", "h");
}

export function fmtRelative(instant: string, locale: string): string {
  const diffMin = Math.round((new Date(instant).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const h = Math.round(diffMin / 60);
  if (Math.abs(h) < 48) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
}

import "server-only";
import { getArea } from "./areas-server";
import { zonedDayEnd, zonedDayStart } from "./dates";
import { supabaseAdmin } from "./supabase";
import type { EventItem, SearchQuery } from "./types";

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fromRow(r: Row): EventItem {
  return {
    id: r.id as string,
    kind: (r.kind as EventItem["kind"]) ?? "event",
    timezone: r.timezone as string,
    currency: r.currency as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    categories: r.categories as EventItem["categories"],
    startAt: r.start_at as string,
    endAt: r.end_at as string,
    nextAt: (r.next_at as string) ?? (r.start_at as string),
    allDay: r.all_day as boolean,
    hoursText: (r.hours_text as string) ?? null,
    durationText: (r.duration_text as string) ?? null,
    venueName: (r.venue_name as string) ?? null,
    address: (r.address as string) ?? null,
    lat: (r.lat as number) ?? null,
    lng: (r.lng as number) ?? null,
    priceMin: r.price_min == null ? null : Number(r.price_min),
    priceMax: r.price_max == null ? null : Number(r.price_max),
    status: r.status as EventItem["status"],
    ticketUrl: (r.ticket_url as string) ?? null,
    officialUrl: (r.official_url as string) ?? null,
    firstDetectedAt: r.first_detected_at as string,
    lastCheckedAt: r.last_checked_at as string,
    sources: (r.sources as string[]) ?? [],
    distanceKm: (r.distance_km as number) ?? null,
  };
}

export async function searchEvents(q: SearchQuery): Promise<EventItem[]> {
  const area = await getArea(q.city);
  if (!area) return [];
  const from = zonedDayStart(q.from, area.timezone);
  const to = zonedDayEnd(q.to, area.timezone);

  const { data, error } = await supabaseAdmin().rpc("search_events", {
    p_city: q.city,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_cats: q.cats,
    p_moments: q.moments,
    p_free: q.free,
    p_lat: q.lat,
    p_lng: q.lng,
    p_max_km: q.maxKm,
  });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function getEventsByIds(ids: string[]): Promise<EventItem[]> {
  const valid = ids.filter((id) => UUID.test(id)).slice(0, 200);
  if (!valid.length) return [];
  const { data, error } = await supabaseAdmin().rpc("get_events", { p_ids: valid });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function getEvent(id: string): Promise<EventItem | null> {
  return (await getEventsByIds([id]))[0] ?? null;
}

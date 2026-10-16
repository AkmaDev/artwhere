import "server-only";
import { getArea } from "./areas-server";
import { zonedDayEnd, zonedDayStart } from "./dates";
import { supabaseAdmin } from "./supabase";
import type { EventItem, SearchQuery, VenueData } from "./types";
import { parseVenueId } from "./venue";

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
    city: (r.city as string) ?? null,
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
  return (data as Row[]).map((r) => ({ ...fromRow(r), city: q.city }));
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

/** Événements à venir d'un lieu (puis le lieu culturel lui-même s'il existe). Nécessite la migration 0007. */
export async function getVenueEvents(city: string, norm: string): Promise<EventItem[]> {
  const { data, error } = await supabaseAdmin().rpc("venue_event_ids", { p_city: city, p_norm: norm });
  if (error) throw error;
  const ids = (data as string[] | null) ?? [];
  if (!ids.length) return [];
  const rows = await getEventsByIds(ids);
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Page lieu : null si l'identifiant est invalide ou si le lieu n'a ni fiche ni événement à venir. Lève en cas d'erreur base. */
export async function getVenueData(id: string): Promise<VenueData | null> {
  const p = parseVenueId(id);
  if (!p) return null;
  const area = await getArea(p.city);
  if (!area) return null;
  const all = await getVenueEvents(p.city, p.norm);
  const place = all.find((e) => e.kind === "place") ?? null;
  const events = all.filter((e) => e.kind === "event").map((e) => ({ ...e, city: p.city }));
  if (!place && !events.length) return null;
  return {
    venue: {
      id,
      name: place?.title ?? events[0].venueName ?? "",
      city: p.city,
      cityName: area.name,
      address: place?.address ?? events.find((e) => e.address)?.address ?? null,
      isPlace: !!place,
      imageUrl: place?.imageUrl ?? events.find((e) => e.imageUrl)?.imageUrl ?? null,
    },
    events,
    sources: [...new Set(events.flatMap((e) => e.sources))],
    lastIngestedAt: area.lastIngestedAt ?? null,
  };
}

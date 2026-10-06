import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventStatus } from "../lib/types";
import { moreRestrictive, normTitle, normVenue } from "./normalize";
import type { NormalizedEvent } from "./types";

export type UpsertResult = "new" | "updated" | "merged";

const point = (n: NormalizedEvent) => (n.lat != null && n.lng != null ? `SRID=4326;POINT(${n.lng} ${n.lat})` : null);
const ranges = (occ: [string, string][]) => (occ.length ? occ.map(([a, b]) => `[${a},${b}]`) : null);

function ownFields(n: NormalizedEvent) {
  return {
    title: n.title,
    title_norm: normTitle(n.title),
    description: n.description,
    image_url: n.imageUrl,
    start_at: n.startAt,
    end_at: n.endAt,
    occurrences: ranges(n.occurrences),
    all_day: n.allDay,
    hours_text: n.hoursText,
    duration_text: n.durationText,
    venue_name: n.venueName,
    venue_norm: normVenue(n.venueName),
    address: n.address,
    location: point(n),
    ticket_url: n.ticketUrl,
    official_url: n.officialUrl,
    lang: n.lang,
  };
}

type Existing = Record<string, unknown> & { id: string; categories: string[]; price_min: number | null; price_max: number | null };

export class Store {
  private bySourceId = new Map<string, string>();

  constructor(private sb: SupabaseClient) {}

  async preload(source: string): Promise<number> {
    this.bySourceId.clear();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb
        .from("event_sources")
        .select("source_id, event_id")
        .eq("source", source)
        .range(from, from + 999);
      if (error) throw error;
      for (const r of data) this.bySourceId.set(r.source_id, r.event_id);
      if (data.length < 1000) break;
    }
    return this.bySourceId.size;
  }

  async upsert(n: NormalizedEvent): Promise<UpsertResult> {
    let eventId = this.bySourceId.get(n.sourceId);
    let result: UpsertResult = "updated";

    if (!eventId) {
      const { data: dup, error } = await this.sb.rpc("find_duplicate", {
        p_city: n.city,
        p_title_norm: normTitle(n.title),
        p_venue_norm: normVenue(n.venueName),
        p_lat: n.lat,
        p_lng: n.lng,
        p_start: n.startAt,
        p_end: n.endAt,
      });
      if (error) throw error;
      if (dup) {
        eventId = dup as string;
        result = "merged";
      }
    }

    if (!eventId) {
      const { data, error } = await this.sb
        .from("events")
        .insert({
          ...ownFields(n),
          categories: n.categories,
          city: n.city,
          country: n.country,
          price_min: n.priceMin,
          price_max: n.priceMax,
          status: n.status,
        })
        .select("id")
        .single();
      if (error) throw error;
      eventId = data.id as string;
      this.bySourceId.set(n.sourceId, eventId);
      await this.saveSource(eventId, n);
      return "new";
    }

    const { data: ex, error: exErr } = await this.sb
      .from("events")
      .select("id, categories, price_min, price_max, title, description, image_url, hours_text, duration_text, venue_name, address, location, ticket_url, official_url, occurrences")
      .eq("id", eventId)
      .single<Existing>();
    if (exErr) throw exErr;

    const { data: primary } = await this.sb
      .from("event_sources")
      .select("source, source_id")
      .eq("event_id", eventId)
      .order("id")
      .limit(1)
      .maybeSingle();
    const isPrimary = !primary || (primary.source === n.source && primary.source_id === n.sourceId);

    await this.saveSource(eventId, n);
    this.bySourceId.set(n.sourceId, eventId);

    const { data: statuses } = await this.sb
      .from("event_sources")
      .select("status")
      .eq("event_id", eventId)
      .gte("fetched_at", new Date(Date.now() - 2 * 86400e3).toISOString());
    const status = (statuses ?? []).reduce<EventStatus>((s, r) => moreRestrictive(s, r.status as EventStatus), n.status);

    const own = ownFields(n);
    const patch: Record<string, unknown> = isPrimary
      ? own
      : Object.fromEntries(Object.entries(own).filter(([k, v]) => v != null && ex[k] == null));
    const mins = [ex.price_min, n.priceMin].filter((x): x is number => x != null).map(Number);
    const maxs = [ex.price_max, n.priceMax].filter((x): x is number => x != null).map(Number);

    const { error } = await this.sb
      .from("events")
      .update({
        ...patch,
        categories: [...new Set([...ex.categories, ...n.categories])],
        price_min: mins.length ? Math.min(...mins) : null,
        price_max: maxs.length ? Math.max(...maxs) : null,
        status,
        last_checked_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    if (error) throw error;
    return result;
  }

  private async saveSource(eventId: string, n: NormalizedEvent) {
    const { error } = await this.sb.from("event_sources").upsert(
      {
        event_id: eventId,
        source: n.source,
        source_id: n.sourceId,
        source_url: n.sourceUrl,
        status: n.status,
        raw: n.raw,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "source,source_id" },
    );
    if (error) throw error;
  }

  /** Événements disparus de la source depuis runStart et vus par aucune autre source : masqués. */
  async retireMissing(source: string, runStart: string): Promise<number> {
    const { data, error } = await this.sb
      .from("event_sources")
      .select("event_id")
      .eq("source", source)
      .lt("fetched_at", runStart);
    if (error) throw error;
    let n = 0;
    for (const { event_id } of data) {
      const { count } = await this.sb
        .from("event_sources")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event_id)
        .gte("fetched_at", runStart);
      if (count) continue;
      const { data: hit, error: e } = await this.sb
        .from("events")
        .update({ status: "cancelled", last_updated_at: new Date().toISOString() })
        .eq("id", event_id)
        .gte("end_at", new Date().toISOString())
        .neq("status", "cancelled")
        .select("id");
      if (e) throw e;
      n += hit.length;
    }
    return n;
  }

  async purgeOld(days = 30): Promise<void> {
    const { error } = await this.sb.from("events").delete().lt("end_at", new Date(Date.now() - days * 86400e3).toISOString());
    if (error) throw error;
  }
}

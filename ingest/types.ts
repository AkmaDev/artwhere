import type { CategoryId } from "../lib/categories";
import type { EventStatus } from "../lib/types";

export interface NormalizedEvent {
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  raw: unknown;
  title: string;
  description: string | null;
  imageUrl: string | null;
  categories: CategoryId[];
  /** Séances [début, fin] en ISO ; vide si la source ne donne qu'une période. */
  occurrences: [string, string][];
  startAt: string;
  endAt: string;
  allDay: boolean;
  hoursText: string | null;
  durationText: string | null;
  venueName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  country: string;
  priceMin: number | null;
  priceMax: number | null;
  status: EventStatus;
  ticketUrl: string | null;
  officialUrl: string | null;
  lang: string;
}

export interface CityConfig {
  slug: string;
  name: string;
  country: string;
  timezone: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface Connector {
  id: string;
  /** Renvoie null si le connecteur n'est pas utilisable (clé manquante, ville non couverte). */
  fetch(city: CityConfig, log: (msg: string) => void): Promise<NormalizedEvent[] | null>;
}

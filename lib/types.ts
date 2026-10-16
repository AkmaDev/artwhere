import type { CategoryId } from "./categories";

export type EventStatus = "available" | "almost_full" | "full" | "closed" | "cancelled";
export type Moment = "m" | "a" | "s";

export interface EventItem {
  id: string;
  /** « place » = lieu culturel permanent (musée, monument…), sans date. */
  kind: "event" | "place";
  timezone: string;
  currency: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  categories: CategoryId[];
  startAt: string;
  endAt: string;
  /** Prochaine séance dans le créneau recherché (ou à venir). */
  nextAt: string;
  allDay: boolean;
  hoursText: string | null;
  durationText: string | null;
  venueName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  priceMin: number | null;
  priceMax: number | null;
  status: EventStatus;
  ticketUrl: string | null;
  officialUrl: string | null;
  firstDetectedAt: string;
  lastCheckedAt: string;
  sources: string[];
  distanceKm: number | null;
  /** Ville (slug de zone) ; null si inconnue (get_events antérieur à la migration 0007). */
  city?: string | null;
}

/** Réponse de /api/venues/[id] (page lieu). */
export interface VenueData {
  venue: {
    id: string;
    name: string;
    city: string;
    cityName: string;
    address: string | null;
    /** true si le lieu est référencé comme lieu culturel (ligne `place`). */
    isPlace: boolean;
    imageUrl: string | null;
  };
  events: EventItem[];
  sources: string[];
  lastIngestedAt: string | null;
}

export interface SearchQuery {
  city: string;
  from: string;
  to: string;
  cats: CategoryId[];
  moments: Moment[];
  free: boolean;
  lat: number | null;
  lng: number | null;
  maxKm: number | null;
}

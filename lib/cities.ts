export interface City {
  slug: string;
  name: string;
  timezone: string;
  lat: number;
  lng: number;
  active: boolean;
}

// Miroir de la table `cities` pour l'UI (suggestions, centre de carte).
export const CITIES: City[] = [
  { slug: "paris", name: "Paris", timezone: "Europe/Paris", lat: 48.8566, lng: 2.3522, active: true },
  { slug: "lyon", name: "Lyon", timezone: "Europe/Paris", lat: 45.764, lng: 4.8357, active: false },
  { slug: "bordeaux", name: "Bordeaux", timezone: "Europe/Paris", lat: 44.8378, lng: -0.5792, active: false },
  { slug: "marseille", name: "Marseille", timezone: "Europe/Paris", lat: 43.2965, lng: 5.3698, active: false },
];

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function nearestActiveCity(lat: number, lng: number, maxKm = 40): City | undefined {
  let best: { c: City; d: number } | undefined;
  for (const c of CITIES.filter((x) => x.active)) {
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (!best || d < best.d) best = { c, d };
  }
  return best && best.d <= maxKm ? best.c : undefined;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

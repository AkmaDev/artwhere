export interface Area {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  currency: string;
  status: "pending" | "ready";
}

export interface Place {
  name: string;
  country: string;
  countryCode: string;
  region: string | null;
  lat: number;
  lng: number;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

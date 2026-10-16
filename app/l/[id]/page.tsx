import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getVenueData } from "@/lib/events-repo";
import { SharedVenue } from "@/components/SharedVenue";

type Params = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => getVenueData(id).catch(() => null));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = await load((await params).id);
  if (!d) return {};
  const title = `${d.venue.name} · ${d.venue.cityName}`;
  return { title, openGraph: { title, images: d.venue.imageUrl ? [d.venue.imageUrl] : undefined } };
}

export default async function VenueSharePage({ params }: Params) {
  const d = await load((await params).id);
  if (!d) notFound();
  return <SharedVenue data={d} />;
}

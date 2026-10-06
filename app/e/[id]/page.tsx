import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/events-repo";
import { SharedEvent } from "@/components/SharedEvent";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const e = await getEvent((await params).id);
  if (!e) return {};
  return {
    title: e.title,
    description: e.description ?? undefined,
    openGraph: { title: e.title, description: e.description ?? undefined, images: e.imageUrl ? [e.imageUrl] : undefined },
  };
}

export default async function EventPage({ params }: Params) {
  const e = await getEvent((await params).id);
  if (!e || new Date(e.endAt).getTime() < Date.now()) notFound();
  return <SharedEvent e={e} />;
}

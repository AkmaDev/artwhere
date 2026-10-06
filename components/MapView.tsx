"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import type { EventItem } from "@/lib/types";
import { EventCard } from "./EventCard";
import { usePriceShort } from "./ui";

interface Props {
  events: EventItem[];
  center: { lat: number; lng: number };
  me: { lat: number; lng: number } | null;
  from: string | null;
  tz: string;
  isNew: (e: EventItem) => boolean;
  isFav: (id: string) => boolean;
  onOpen: (e: EventItem) => void;
  onFav: (e: EventItem) => void;
}

const STYLE = "https://tiles.openfreemap.org/styles/positron";

if (typeof window !== "undefined") maplibregl.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);

export default function MapView({ events, center, me, from, tz, isNew, isFav, onOpen, onFav }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const priceShort = usePriceShort();
  const located = events.filter((e) => e.lat != null && e.lng != null);
  const [selId, setSelId] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const t = useTranslations("explore");
  const sel = located.find((e) => e.id === selId) ?? located.find((e) => !e.allDay) ?? located[0];

  useEffect(() => {
    if (!box.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: box.current,
        style: STYLE,
        center: [center.lng, center.lat],
        zoom: 12,
        attributionControl: { compact: true },
      });
    } catch {
      setUnsupported(true);
      return;
    }
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    const m = map.current;
    if (!m || !me) return;
    const dot = document.createElement("span");
    dot.style.cssText =
      "width:18px;height:18px;border-radius:50%;background:#2E3BD6;border:3px solid #fff;box-shadow:0 0 0 8px rgba(46,59,214,.16)";
    const mk = new maplibregl.Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(m);
    return () => {
      mk.remove();
    };
  }, [me]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = located.map((e) => {
      const on = sel?.id === e.id;
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = priceShort(e) + (isNew(e) ? " ·" : "");
      el.style.cssText = `height:32px;padding:0 11px;border:0;border-radius:999px;background:${on ? "#1E1E1C" : "#FFFFFF"};color:${
        on ? "#FFFFFF" : "#1E1E1C"
      };font:600 13px/1 var(--font-instrument),sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.22);cursor:pointer;white-space:nowrap;z-index:${on ? 3 : 1}`;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelId(e.id);
      });
      return new maplibregl.Marker({ element: el }).setLngLat([e.lng!, e.lat!]).addTo(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.map((e) => e.id).join(","), sel?.id]);

  useEffect(() => {
    const m = map.current;
    if (!m || located.length < 2) return;
    const b = new maplibregl.LngLatBounds();
    located.forEach((e) => b.extend([e.lng!, e.lat!]));
    if (me) b.extend([me.lng, me.lat]);
    m.fitBounds(b, { padding: { top: 40, left: 40, right: 40, bottom: 200 }, maxZoom: 14, duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.map((e) => e.id).join(",")]);

  return (
    <div className="relative flex-1 overflow-hidden bg-[#E9E7E0]">
      <div ref={box} className="absolute inset-0" />
      {unsupported && (
        <p className="absolute inset-x-6 top-1/3 m-0 text-center text-[14px] leading-[1.45] text-muted">{t("mapUnsupported")}</p>
      )}
      {sel && (
        <div className="absolute right-3 bottom-[72px] left-3 z-[6] rounded-2xl bg-white p-2.5 shadow-[0_8px_28px_rgba(0,0,0,.18)]">
          <EventCard
            e={sel}
            from={from}
            tz={tz}
            isNew={isNew(sel)}
            isFav={isFav(sel.id)}
            onOpen={() => onOpen(sel)}
            onFav={() => onFav(sel)}
            variant="compact"
          />
        </div>
      )}
    </div>
  );
}

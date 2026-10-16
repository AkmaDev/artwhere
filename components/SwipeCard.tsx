"use client";

import { useImperativeHandle, useRef, type Ref } from "react";
import { useLocale, useTranslations } from "next-intl";
import { km } from "@/lib/format";
import { getNeighborhood, joinDots } from "@/lib/neighborhood";
import type { EventItem } from "@/lib/types";
import { getUrgency } from "@/lib/urgency";
import { EventImage, UrgencyBadge } from "./ui";

export type SwipeDir = "keep" | "pass";
export interface SwipeHandle {
  fly: (dir: SwipeDir) => void;
}

const THRESHOLD = 110;
const VELOCITY = 0.5; // px/ms
const OUT = 480;
const TAP_SLOP = 6;

interface Props {
  e: EventItem;
  onDecide: (dir: SwipeDir) => void;
  onTap: () => void;
  ref?: Ref<SwipeHandle>;
}

// Carte du dessus. Le geste écrit directement le transform (pas de re-rendu React pendant le glissement).
export function SwipeCard({ e, onDecide, onTap, ref }: Props) {
  const t = useTranslations("qm");
  const tcat = useTranslations("categories");
  const locale = useLocale();
  const card = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLSpanElement>(null);
  const pass = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x0: number; dx: number; lastX: number; lastT: number; v: number; moved: boolean } | null>(null);
  const done = useRef(false);

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const paint = (dx: number, transition: string) => {
    const el = card.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 22}deg)` : "";
    const o = Math.min(Math.abs(dx) / 120, 1);
    if (keep.current) keep.current.style.opacity = String(dx > 0 ? o : 0);
    if (pass.current) pass.current.style.opacity = String(dx < 0 ? o : 0);
  };

  const fly = (dir: SwipeDir) => {
    if (done.current) return;
    done.current = true;
    navigator.vibrate?.(10);
    const el = card.current;
    if (reduced() && el) {
      el.style.transition = "opacity 120ms linear";
      el.style.opacity = "0";
      setTimeout(() => onDecide(dir), 120);
      return;
    }
    paint(dir === "keep" ? OUT : -OUT, "transform 280ms cubic-bezier(.2,.8,.2,1)");
    setTimeout(() => onDecide(dir), 280);
  };
  useImperativeHandle(ref, () => ({ fly }));

  const urgency = getUrgency(e);
  const where = joinDots([e.venueName, getNeighborhood(e), e.distanceKm != null ? km(e.distanceKm, locale) : null]);

  return (
    <div
      ref={card}
      role="button"
      tabIndex={-1}
      onPointerDown={(ev) => {
        if (done.current) return;
        ev.currentTarget.setPointerCapture(ev.pointerId);
        drag.current = { x0: ev.clientX, dx: 0, lastX: ev.clientX, lastT: ev.timeStamp, v: 0, moved: false };
      }}
      onPointerMove={(ev) => {
        const d = drag.current;
        if (!d) return;
        d.dx = ev.clientX - d.x0;
        const dt = ev.timeStamp - d.lastT;
        if (dt > 0) d.v = (ev.clientX - d.lastX) / dt;
        d.lastX = ev.clientX;
        d.lastT = ev.timeStamp;
        if (Math.abs(d.dx) > TAP_SLOP) d.moved = true;
        if (d.moved && !reduced()) paint(d.dx, "none");
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (!d.moved) return onTap();
        if (Math.abs(d.dx) > THRESHOLD || Math.abs(d.v) > VELOCITY) fly((Math.abs(d.dx) > THRESHOLD ? d.dx : d.v) > 0 ? "keep" : "pass");
        else paint(0, "transform 200ms ease-out");
      }}
      onPointerCancel={() => {
        drag.current = null;
        paint(0, "transform 200ms ease-out");
      }}
      className="absolute inset-0 flex cursor-grab touch-pan-y flex-col overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_8px_28px_rgba(0,0,0,.18)] select-none motion-safe:animate-[qm-rise_200ms_ease-out]"
    >
      <div className="relative h-[320px] max-h-[55%] flex-none">
        <EventImage src={e.imageUrl} alt="" className="pointer-events-none h-full w-full" />
        <span
          ref={keep}
          aria-hidden
          style={{ opacity: 0 }}
          className="absolute top-4 left-4 -rotate-8 rounded-[7px] bg-accent px-3 py-1.5 text-[18px] leading-none font-bold text-white"
        >
          {t("keep")}
        </span>
        <span
          ref={pass}
          aria-hidden
          style={{ opacity: 0 }}
          className="absolute top-4 right-4 rotate-8 rounded-[7px] bg-ink px-3 py-1.5 text-[18px] leading-none font-bold text-white"
        >
          {t("pass")}
        </span>
      </div>
      <div className="flex min-h-0 flex-col gap-1.5 px-4 pt-3.5 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {e.categories.slice(0, 2).map((c) => (
            <span key={c} className="flex h-[26px] items-center rounded-[7px] bg-sand px-[9px] text-[12px] leading-none font-medium">
              {tcat(`${c}.name`)}
            </span>
          ))}
          {urgency && <UrgencyBadge urgency={urgency} size="sm" />}
        </div>
        <h2 className="m-0 line-clamp-2 text-[20px] leading-[1.2] font-semibold tracking-[-.02em]">{e.title}</h2>
        {where && <span className="truncate text-[14px] leading-[1.35] text-muted">{where}</span>}
      </div>
    </div>
  );
}

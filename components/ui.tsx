"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { money, STATUS_STYLE } from "@/lib/format";
import type { EventItem, EventStatus } from "@/lib/types";

export function StatusBadge({ status, size = "md" }: { status: EventStatus; size?: "md" | "sm" }) {
  const t = useTranslations("status");
  const s = STATUS_STYLE[status];
  return (
    <span
      className={
        size === "md"
          ? "flex h-[26px] items-center rounded-[7px] px-[9px] text-[12px] leading-none font-semibold"
          : "flex h-[22px] items-center rounded-[6px] px-[7px] text-[11.5px] leading-none font-semibold"
      }
      style={{ background: s.bg, color: s.fg }}
    >
      {t(status)}
    </span>
  );
}

export function NewBadge({ size = "md" }: { size?: "md" | "sm" }) {
  const t = useTranslations("card");
  return (
    <span
      className={
        size === "md"
          ? "flex h-[26px] items-center rounded-[7px] bg-accent px-[9px] text-[12px] leading-none font-semibold text-white"
          : "flex h-[20px] items-center rounded-[5px] bg-accent px-[6px] text-[10.5px] leading-none font-semibold text-white"
      }
    >
      {t("new")}
    </span>
  );
}

export function usePriceShort() {
  const t = useTranslations("card");
  const locale = useLocale();
  return (e: Pick<EventItem, "priceMin" | "priceMax" | "currency">) => {
    if (e.priceMin == null) return t("priceUnknown");
    if (e.priceMin === 0) return t("free");
    if (e.priceMax != null && e.priceMax > e.priceMin) return t("from", { price: money(e.priceMin, locale, e.currency) });
    return money(e.priceMin, locale, e.currency);
  };
}

export function EventImage({ src, alt, className, rounded }: { src: string | null; alt: string; className?: string; rounded?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={`placeholder-img ${rounded ?? ""} ${className ?? ""}`} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`placeholder-img object-cover ${rounded ?? ""} ${className ?? ""}`}
    />
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div
      role="status"
      className="absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-[14px] leading-none font-medium whitespace-nowrap text-white"
    >
      {text}
    </div>
  );
}

export function Pill({
  on,
  children,
  onClick,
  className,
}: {
  on: boolean;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`cursor-pointer rounded-full border font-medium ${on ? "border-ink bg-ink text-white" : "border-border-2 bg-white text-ink"} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { whenShort } from "@/lib/format";
import type { EventItem } from "@/lib/types";
import { EventImage, StatusBadge, usePriceShort } from "./ui";

interface Props {
  favs: EventItem[];
  tz: string;
  onOpen: (e: EventItem) => void;
  onRemove: (e: EventItem) => void;
}

export function Favorites({ favs, tz, onOpen, onRemove }: Props) {
  const t = useTranslations("favs");
  const tc = useTranslations("card");
  const locale = useLocale();
  const price = usePriceShort();
  const now = Date.now();
  const sorted = [...favs].sort((a, b) => a.nextAt.localeCompare(b.nextAt));

  return (
    <div className="no-scrollbar flex h-full flex-col gap-1.5 overflow-y-auto px-4 pt-6 pb-[90px]">
      <h1 className="m-0 mb-1 text-[28px] leading-[1.15] font-semibold tracking-[-.02em]">{t("title")}</h1>
      <span className="text-[13px] leading-[1.4] text-muted">{t("sub")}</span>
      {sorted.length > 0 ? (
        <div className="flex flex-col pt-2.5">
          {sorted.map((e) => {
            const past = new Date(e.endAt).getTime() < now;
            return (
              <article
                key={e.id}
                onClick={() => !past && onOpen(e)}
                className={`relative grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 border-b border-line py-3.5 ${past ? "opacity-[.62]" : "cursor-pointer"}`}
              >
                <EventImage src={e.imageUrl} alt="" className="h-[72px] w-[72px]" rounded="rounded-[10px]" />
                <div className="flex min-w-0 flex-col gap-[3px] pr-9">
                  <h3 className="m-0 text-[15px] leading-tight font-semibold">{e.title}</h3>
                  <span className="text-[13.5px] leading-[1.3] font-medium">{whenShort(e, null, tz, locale, (date) => tc("until", { date }))}</span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[13px] leading-[1.3] text-muted">{price(e)}</span>
                    {past ? (
                      <span className="flex h-[22px] items-center rounded-[6px] bg-line px-[7px] text-[11.5px] leading-none font-semibold text-[#55534E]">
                        {t("past")}
                      </span>
                    ) : (
                      <StatusBadge status={e.status} size="sm" />
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={tc("removeFav")}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onRemove(e);
                  }}
                  className="absolute top-1.5 -right-2 h-11 w-11 cursor-pointer border-0 bg-transparent text-[22px] leading-none text-heart"
                >
                  ♥
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-2.5 py-[60px] text-center">
          <span className="text-[17px] leading-[1.3] font-semibold">{t("emptyTitle")}</span>
          <span className="max-w-[260px] text-[14px] leading-[1.45] text-muted">{t("emptyMsg")}</span>
        </div>
      )}
    </div>
  );
}

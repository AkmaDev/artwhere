"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventItem } from "@/lib/types";
import { SwipeCard, type SwipeDir, type SwipeHandle } from "./SwipeCard";

interface Props {
  /** Paquet de départ (lib/taste.ts › buildDeck). */
  deck: EventItem[];
  /** Nombre de cartes disponibles pour une nouvelle série (Rejouer masqué sous 5). */
  canReplay: boolean;
  /** Fiche ouverte par-dessus : clavier en pause. */
  paused: boolean;
  onSwipe: (e: EventItem, dir: SwipeDir) => void;
  onOpen: (e: EventItem) => void;
  onReplay: () => void;
  onClose: () => void;
}

// Quick Match (spec 06), plein écran en surimpression. Chaque geste est enregistré tout de suite (fermer ne l'annule pas).
export function QuickMatch({ deck, canReplay, paused, onSwipe, onOpen, onReplay, onClose }: Props) {
  const t = useTranslations("qm");
  const tcat = useTranslations("categories");
  const [i, setI] = useState(0);
  const [kept, setKept] = useState<string[]>([]);
  const top = useRef<SwipeHandle>(null);
  const n = deck.length;
  const finished = i >= n;
  const cur = deck[i];

  const decide = (dir: SwipeDir) => {
    if (!cur) return;
    onSwipe(cur, dir);
    if (dir === "keep") setKept((k) => [...new Set([...k, ...cur.categories])]);
    setI((x) => x + 1);
  };

  useEffect(() => {
    if (paused || finished) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft") top.current?.fly("pass");
      else if (ev.key === "ArrowRight") top.current?.fly("keep");
      else if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, finished, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="qm-title" className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="flex flex-none items-start justify-between px-5 pt-2">
        <div className="flex flex-col gap-0.5 pt-1.5">
          <h1 id="qm-title" className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-.02em]">
            {t("title")}
          </h1>
          <span aria-live="polite" className="text-[13px] leading-tight text-muted">
            {finished ? t("done") : t("counter", { i: i + 1, n })}
          </span>
        </div>
        <button
          type="button"
          aria-label={t("close")}
          onClick={onClose}
          className="h-10 w-10 cursor-pointer rounded-full border border-[#DAD8D2] bg-white text-[18px] leading-none text-ink"
        >
          ×
        </button>
      </div>
      <div className="mx-5 mt-3.5 h-1 flex-none overflow-hidden rounded-[2px] bg-line">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${n ? (Math.min(i, n) / n) * 100 : 100}%` }} />
      </div>

      {finished ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 text-center">
          <h2 className="m-0 text-[28px] leading-[1.15] font-semibold tracking-[-.02em]">{t("doneTitle")}</h2>
          <p className="m-0 max-w-[300px] text-[15px] leading-[1.45] text-muted">{t("doneText")}</p>
          {kept.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              {kept.map((c) => (
                <span key={c} className="flex h-8 items-center rounded-full bg-ink px-3.5 text-[14px] leading-none font-semibold text-white">
                  {tcat(`${c}.name`)}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[14px] leading-[1.45] text-muted">{t("noneKept")}</span>
          )}
          {canReplay && (
            <button
              type="button"
              onClick={() => {
                setI(0);
                setKept([]);
                onReplay();
              }}
              className="mt-1 h-11 cursor-pointer rounded-[10px] border border-ink bg-white px-[18px] text-[14px] leading-none font-semibold"
            >
              {t("replay")}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative mx-5 mt-[18px] min-h-0 flex-1">
            {deck[i + 1] && <div aria-hidden className="absolute inset-0 translate-y-[10px] scale-[.96] rounded-[14px] border border-border bg-sand" />}
            {cur && <SwipeCard key={cur.id} ref={top} e={cur} onDecide={decide} onTap={() => onOpen(cur)} />}
          </div>
          <div className="flex flex-none justify-center gap-6 pt-[18px] pb-[max(30px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              aria-label={t("pass")}
              onClick={() => top.current?.fly("pass")}
              className="h-16 w-16 cursor-pointer rounded-full border-[1.5px] border-border-2 bg-white text-[24px] leading-none text-ink"
            >
              ×
            </button>
            <button
              type="button"
              aria-label={t("keep")}
              onClick={() => top.current?.fly("keep")}
              className="h-16 w-16 cursor-pointer rounded-full border-0 bg-ink text-[26px] leading-none text-heart-light"
            >
              ♥
            </button>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Area, Place } from "@/lib/area";
import { addDays, fmtMonthYear, fmtRange, shortcutRanges, weekday } from "@/lib/dates";
import type { Prefs } from "@/lib/device";
import type { Moment } from "@/lib/types";
import { CategoryPicker } from "./Onboarding";
import { Pill } from "./ui";

export type Step = "where" | "when" | "what";

interface Props {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  step: Step;
  setStep: (s: Step) => void;
  today: string;
  count: number | null;
  onClose: () => void;
  onRun: () => void;
  onGeo: () => void;
  onPickPlace: (p: Place) => void;
  recent: Area[];
  onPickArea: (a: Area) => void;
  busy: boolean;
  flash: (s: string) => void;
}

const MOMENTS: Moment[] = ["m", "a", "s"];

export function SearchSheet({ prefs, setPrefs, step, setStep, today, count, onClose, onRun, onGeo, onPickPlace, recent, onPickArea, busy, flash }: Props) {
  const t = useTranslations("search");
  const tm = useTranslations("moments");
  const tc = useTranslations("categories");
  const to = useTranslations("onboarding");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [month, setMonth] = useState((prefs.from ?? today).slice(0, 7) + "-01");

  const from = prefs.from ?? today;
  const toDay = prefs.to ?? from;
  const cityName = prefs.area?.name ?? t("chooseCity");
  const [results, setResults] = useState<Place[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/geo/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { places: [] }))
        .then((d: { places: Place[] }) => setResults(d.places))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);
  const momTxt = prefs.moments.map((m) => tm(`${m}.name`)).join(", ");
  const whenSum = fmtRange(from, toDay, locale) + (momTxt ? ` · ${momTxt}` : "");
  const catsInline = prefs.cats.length ? prefs.cats.map((c) => tc(`${c}.name`)).join(", ") : t("noCategory");

  const summary = (label: string, value: string, open: () => void) => (
    <button
      type="button"
      onClick={open}
      className="flex min-h-[58px] cursor-pointer items-center justify-between gap-3 rounded-2xl border-0 bg-white px-[18px] shadow-[0_1px_4px_rgba(0,0,0,.06)]"
    >
      <span className="flex-none text-[14px] leading-none font-medium text-muted">{label}</span>
      <span className="text-right text-[14px] leading-tight font-semibold text-ink">{value}</span>
    </button>
  );

  const panel = "flex flex-col gap-3.5 rounded-[20px] bg-white px-[18px] py-5 shadow-[0_4px_18px_rgba(0,0,0,.08)]";
  const h2 = "m-0 text-[24px] leading-[1.2] font-semibold tracking-[-.02em]";

  const monthDays = (() => {
    const lead = (weekday(month) + 6) % 7;
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = month; d.slice(0, 7) === month.slice(0, 7); d = addDays(d, 1)) cells.push(d);
    return cells;
  })();
  const shiftMonth = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 10));
  };
  const canPrev = month > today.slice(0, 7) + "-01";

  const pickDay = (d: string) => {
    if (!picking || d < from) {
      setPrefs({ from: d, to: d });
      setPicking(true);
    } else {
      setPrefs({ to: d });
      setPicking(false);
    }
  };


  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-paper">
      <div className="flex flex-none items-center justify-between px-4 pt-3.5 pb-1.5">
        <button
          type="button"
          aria-label={t("close")}
          onClick={onClose}
          className="h-10 w-10 cursor-pointer rounded-full border border-[#DAD8D2] bg-white text-[20px] leading-none"
        >
          ×
        </button>
        <span className="text-[15px] leading-none font-semibold">{t("title")}</span>
        <span className="w-10" />
      </div>

      <div className="no-scrollbar flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 pt-2.5 pb-5">
        {step === "where" ? (
          <div className={panel}>
            <h2 className={h2}>{t("whereTitle")}</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("cityPlaceholder")}
              aria-label={t("cityPlaceholder")}
              className="h-[54px] rounded-xl border border-border-3 bg-white px-4 text-[16px] leading-none font-medium text-ink outline-none focus:border-ink"
            />
            <div className="flex flex-col">
              <button type="button" onClick={onGeo} className="flex min-h-14 cursor-pointer items-center gap-3.5 border-0 bg-transparent p-0 text-left">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent-soft text-[18px] leading-none font-semibold text-accent">◎</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] leading-tight font-semibold text-ink">{t("aroundMe")}</span>
                  <span className="text-[13px] leading-tight text-muted">{t("useMyPosition")}</span>
                </span>
              </button>
              {(query.trim().length >= 2 ? results : []).map((p) => (
                <button
                  key={`${p.name}-${p.countryCode}-${p.lat}`}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setQuery("");
                    onPickPlace(p);
                  }}
                  className="flex min-h-14 cursor-pointer items-center gap-3.5 border-0 bg-transparent p-0 text-left disabled:opacity-50"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-sand text-[14px] leading-none font-semibold text-muted">
                    {p.name[0]}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] leading-tight font-semibold text-ink">{p.name}</span>
                    <span className="text-[13px] leading-tight text-muted">{[p.region, p.country].filter(Boolean).join(", ")}</span>
                  </span>
                </button>
              ))}
              {query.trim().length < 2 &&
                recent.map((a) => (
                  <button
                    key={a.slug}
                    type="button"
                    onClick={() => onPickArea(a)}
                    className="flex min-h-14 cursor-pointer items-center gap-3.5 border-0 bg-transparent p-0 text-left"
                  >
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-sand text-[14px] leading-none font-semibold text-muted">
                      {a.name[0]}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15px] leading-tight font-semibold text-ink">{a.name}</span>
                      <span className="text-[13px] leading-tight text-muted">{t("recent")}</span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ) : (
          summary(t("where"), prefs.geo ? `${t("aroundMe")} · ${cityName}` : cityName, () => setStep("where"))
        )}

        {step === "when" ? (
          <div className={panel}>
            <h2 className={h2}>{t("whenTitle")}</h2>
            <div className="flex flex-wrap gap-1.5">
              {shortcutRanges(today).map((r) => (
                <Pill
                  key={r.id}
                  on={prefs.from === r.from && prefs.to === r.to}
                  onClick={() => {
                    setPrefs({ from: r.from, to: r.to });
                    setPicking(false);
                    setMonth(r.from.slice(0, 7) + "-01");
                  }}
                  className="h-[38px] px-3.5 text-[14px] leading-none"
                >
                  {t(r.id)}
                </Pill>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between py-1">
                <span className="text-[14px] leading-none font-semibold">{fmtMonthYear(month, locale)}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={t("prevMonth")}
                    disabled={!canPrev}
                    onClick={() => shiftMonth(-1)}
                    className="h-8 w-8 cursor-pointer rounded-full border border-border bg-white text-[14px] disabled:cursor-default disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label={t("nextMonth")}
                    onClick={() => shiftMonth(1)}
                    className="h-8 w-8 cursor-pointer rounded-full border border-border bg-white text-[14px]"
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {["L", "M", "M", "J", "V", "S", "D"].map((w, i) => (
                  <span key={i} className="pb-1.5 text-center text-[11px] leading-none font-medium text-subtle">
                    {w}
                  </span>
                ))}
                {monthDays.map((d, i) => {
                  if (!d) return <span key={`b${i}`} />;
                  const past = d < today;
                  const edge = d === from || d === toDay;
                  const inR = from !== toDay && d >= from && d <= toDay;
                  return (
                    <div
                      key={d}
                      className="flex h-[46px] items-center justify-center"
                      style={{
                        background: inR ? "#F0EFEA" : "transparent",
                        borderRadius: inR ? (d === from ? "999px 0 0 999px" : d === toDay ? "0 999px 999px 0" : 0) : 0,
                      }}
                    >
                      <button
                        type="button"
                        disabled={past}
                        onClick={() => pickDay(d)}
                        aria-pressed={edge}
                        className={`h-[42px] w-[42px] rounded-full border-0 text-[15px] leading-none font-semibold ${
                          edge ? "bg-ink text-white" : past ? "cursor-default bg-transparent text-off line-through" : "cursor-pointer bg-transparent text-ink"
                        }`}
                      >
                        {Number(d.slice(8))}
                      </button>
                    </div>
                  );
                })}
              </div>
              <span className="pt-1 text-[12.5px] leading-[1.4] text-muted">{picking ? t("pickEnd") : t("pickStart")}</span>
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <span className="text-[14px] leading-tight font-semibold">
                {t("momentTitle")} <span className="font-normal text-muted">{t("optional")}</span>
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {MOMENTS.map((m) => {
                  const on = prefs.moments.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPrefs({ moments: on ? prefs.moments.filter((x) => x !== m) : [...prefs.moments, m] })}
                      className={`flex h-14 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-xl border-[1.5px] ${on ? "border-ink bg-sand" : "border-border bg-white"}`}
                    >
                      <span className="text-[14px] leading-none font-semibold text-ink">{tm(`${m}.name`)}</span>
                      <span className="text-[11.5px] leading-none text-muted">{tm(`${m}.hours`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          summary(t("when"), whenSum, () => setStep("when"))
        )}

        {step === "what" ? (
          <div className={panel}>
            <div className="flex items-baseline justify-between">
              <h2 className={h2}>{t("whatTitle")}</h2>
              <span className="text-[13px] leading-none font-medium text-muted">{to("count", { n: prefs.cats.length })}</span>
            </div>
            <CategoryPicker cats={prefs.cats} onChange={(cats) => setPrefs({ cats })} onMax={() => flash(to("max"))} variant="chips" />
          </div>
        ) : (
          summary(t("what"), catsInline, () => setStep("what"))
        )}
      </div>

      <div className="flex flex-none items-center justify-between border-t border-line bg-white px-5 pt-3 pb-[18px]">
        <button
          type="button"
          onClick={() => {
            setPrefs({ from: today, to: today, moments: [], geo: null });
            setPicking(false);
            setStep("when");
          }}
          className="h-11 cursor-pointer border-0 bg-transparent p-0 text-[15px] leading-none font-semibold text-ink underline"
        >
          {t("clear")}
        </button>
        <button
          type="button"
          onClick={() => (prefs.cats.length ? onRun() : flash(to("needOne")))}
          className="h-[50px] cursor-pointer rounded-xl border-0 bg-accent px-6 text-[16px] leading-none font-semibold text-white"
        >
          {count == null ? "…" : t("cta", { n: count })}
        </button>
      </div>
    </div>
  );
}

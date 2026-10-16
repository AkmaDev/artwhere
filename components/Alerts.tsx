"use client";

import { useTranslations } from "next-intl";
import type { AlertPrefs } from "@/lib/device";

interface Props {
  alerts: AlertPrefs;
  busy: boolean;
  title: string;
  sub: string;
  notifText: string;
  showIosHint: boolean;
  onToggle: () => void;
  onFreq: (f: AlertPrefs["freq"]) => void;
  onHowTo: () => void;
  onMyData: () => void;
}

export function Alerts({ alerts, busy, title, sub, notifText, showIosHint, onToggle, onFreq, onHowTo, onMyData }: Props) {
  const t = useTranslations("alerts");
  const ta = useTranslations("app");
  const freqs: [AlertPrefs["freq"], string, string][] = [
    ["now", t("now"), t("nowHint")],
    ["daily", t("daily"), t("dailyHint")],
  ];

  return (
    <div className="no-scrollbar flex h-full flex-col gap-[18px] overflow-y-auto px-4 pt-6 pb-[90px]">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] leading-[1.15] font-semibold tracking-[-.02em]">{t("title")}</h1>
        <span className="text-[14px] leading-[1.45] text-muted">{t("lead")}</span>
      </div>
      <div className="flex flex-col gap-3.5 rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-[15px] leading-[1.3] font-semibold">{title}</span>
            <span className="text-[13px] leading-[1.35] text-muted">{sub}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={alerts.on}
            aria-label={t("title")}
            disabled={busy}
            onClick={onToggle}
            className={`relative h-8 w-[52px] flex-none cursor-pointer rounded-full border-0 disabled:opacity-60 ${alerts.on ? "bg-accent" : "bg-border-3"}`}
          >
            <span
              className="absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left] duration-150"
              style={{ left: alerts.on ? 23 : 3 }}
            />
          </button>
        </div>
        {alerts.on && (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-[13px] leading-none font-semibold text-muted">{t("frequency")}</span>
            {freqs.map(([id, name, hint]) => {
              const on = alerts.freq === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onFreq(id)}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] bg-white px-3.5 text-left ${on ? "border-ink" : "border-border"}`}
                >
                  <span
                    className="h-5 w-5 flex-none rounded-full"
                    style={{ border: on ? "6px solid #1E1E1C" : "1.5px solid #B8B6AF" }}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px] leading-tight font-semibold text-ink">{name}</span>
                    <span className="text-[12.5px] leading-tight text-muted">{hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] leading-none font-semibold text-muted">{t("preview")}</span>
        <div className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-sand px-3.5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-ink text-[15px] leading-none font-bold text-white">a</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-[13.5px] leading-[1.3] font-semibold">{ta("name")}</span>
              <span className="text-[12px] leading-[1.3] text-subtle">{t("justNow")}</span>
            </div>
            <span className="text-[13.5px] leading-[1.35]">{notifText}</span>
          </div>
        </div>
      </div>
      {showIosHint && (
        <div className="flex flex-col gap-2 rounded-[14px] bg-warn-bg px-4 py-3.5">
          <span className="text-[14px] leading-[1.3] font-semibold text-warn-fg">{t("iphone")}</span>
          <span className="text-[13.5px] leading-[1.45] text-warn-fg">{t("iphoneMsg")}</span>
          <button
            type="button"
            onClick={onHowTo}
            className="h-10 cursor-pointer self-start rounded-[10px] border-0 bg-warn-fg px-3.5 text-[13px] leading-none font-semibold text-white"
          >
            {t("iphoneHow")}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onMyData}
        className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] leading-tight font-semibold text-ink">{t("myData")}</span>
          <span className="text-[13px] leading-tight text-muted">{t("myDataHint")}</span>
        </span>
        <span aria-hidden className="text-[18px] leading-none text-muted">›</span>
      </button>
    </div>
  );
}

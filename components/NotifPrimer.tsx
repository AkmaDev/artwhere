"use client";

import { useTranslations } from "next-intl";

interface Props {
  city: string;
  busy: boolean;
  onEnable: () => void;
  onLater: () => void;
}

function Logo() {
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-ink text-[15px] leading-none font-bold text-white">
      a<span className="text-accent">.</span>
    </span>
  );
}

// Pré-écran avant la demande système : seul « Activer les alertes » déclenche Notification.requestPermission().
export function NotifPrimer({ city, busy, onEnable, onLater }: Props) {
  const t = useTranslations("notif");
  const samples = [
    { text: t("sample1", { city }), when: t("now"), faded: false },
    { text: t("sample2", { city }), when: t("yesterday"), faded: true },
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-title"
      className="absolute inset-0 z-50 flex flex-col bg-white motion-safe:animate-[sheet-in_220ms_cubic-bezier(.2,.8,.2,1)]"
    >
      <div className="flex flex-1 flex-col justify-center gap-7 px-5">
        <div aria-hidden className="flex flex-col gap-2.5 rounded-[20px] bg-paper px-4 py-5">
          {samples.map((s) => (
            <div
              key={s.when}
              className={`flex gap-2.5 rounded-[14px] bg-white p-3 ${s.faded ? "scale-[.96] opacity-60" : "shadow-[0_4px_18px_rgba(0,0,0,.08)]"}`}
            >
              <Logo />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] leading-tight">
                  <span className="font-semibold">artwhere</span> <span className="text-subtle">· {s.when}</span>
                </span>
                <span className="text-[13px] leading-[1.35] text-[#3F3F3B]">{s.text}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h1 id="notif-title" className="m-0 text-[28px] leading-[1.15] font-semibold tracking-[-.02em]">
            {t("title")}
          </h1>
          <p className="m-0 text-[15px] leading-[1.45] text-muted">{t("text")}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-5 pb-[max(34px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={busy}
          onClick={onEnable}
          className="h-[50px] w-full cursor-pointer rounded-xl border-0 bg-accent text-[16px] leading-none font-semibold text-white disabled:opacity-60"
        >
          {t("enable")}
        </button>
        <button type="button" onClick={onLater} className="h-11 w-full cursor-pointer border-0 bg-transparent text-[15px] leading-none font-semibold text-muted">
          {t("later")}
        </button>
      </div>
    </div>
  );
}

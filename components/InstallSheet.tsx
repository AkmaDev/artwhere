"use client";

import { useTranslations } from "next-intl";

export function InstallSheet({ ios, onClose }: { ios: boolean; onClose: () => void }) {
  const t = useTranslations("install");
  const steps = (ios ? ["ios1", "ios2", "ios3"] : ["and1", "and2", "and3"]).map((k) => ({
    a: t(`${k}a`),
    b: t(`${k}b`),
    c: t(`${k}c`),
  }));
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-[rgba(20,20,18,.45)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-4 rounded-t-[22px] bg-white px-5 pt-2.5 pb-6"
      >
        <span className="h-[5px] w-9 self-center rounded-[3px] bg-[#DAD8D2]" />
        <div className="flex flex-col gap-1.5">
          <h2 id="install-title" className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-.02em]">
            {t("title")}
          </h2>
          <span className="text-[14px] leading-[1.45] text-muted">{t("lead")}</span>
        </div>
        <ol className="m-0 flex list-none flex-col p-0">
          {steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 border-b border-line py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sand text-[14px] leading-none font-semibold">{i + 1}</span>
              <span className="text-[15px] leading-[1.4]">
                {s.a} <strong className="font-semibold">{s.b}</strong> {s.c}
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="h-[50px] cursor-pointer rounded-xl border-0 bg-ink text-[16px] leading-none font-semibold text-white"
        >
          {t("ok")}
        </button>
      </div>
    </div>
  );
}

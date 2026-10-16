"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Synchro entre appareils (spec 07), derrière NEXT_PUBLIC_SYNC. Interface seule : aucun serveur derrière,
// « Envoyer le lien » n'envoie rien et le dit.
export function SyncCard({ flash }: { flash: (s: string) => void }) {
  const t = useTranslations("sync");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <>
      <div className="mt-1.5 flex flex-col gap-2.5 rounded-[14px] bg-sand p-4">
        <span className="text-[15px] leading-tight font-semibold">{t("title")}</span>
        <span className="text-[13px] leading-[1.45] text-muted">{t("text")}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 w-full cursor-pointer rounded-[10px] border-0 bg-ink text-[14px] leading-none font-semibold text-white"
        >
          {t("cta")}
        </button>
        <span className="text-[12.5px] leading-tight text-muted">{t("nickname")}</span>
      </div>
      {open && (
        <div className="absolute inset-0 z-40 flex items-end bg-[rgba(20,20,18,.45)]" onClick={() => setOpen(false)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              setOpen(false);
              flash(t("soon"));
            }}
            className="flex w-full flex-col gap-4 rounded-t-[22px] bg-white px-5 pt-2.5 pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <span className="h-[5px] w-9 self-center rounded-[3px] bg-[#DAD8D2]" />
            <h2 id="sync-title" className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-.02em]">
              {t("title")}
            </h2>
            <input
              type="email"
              required
              autoComplete="email"
              aria-label={t("email")}
              placeholder={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[54px] rounded-xl border border-border-2 px-4 text-[16px] outline-none focus:border-ink"
            />
            <button type="submit" className="h-[50px] cursor-pointer rounded-xl border-0 bg-ink text-[16px] leading-none font-semibold text-white">
              {t("send")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

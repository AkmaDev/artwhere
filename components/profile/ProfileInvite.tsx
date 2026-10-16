"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  /** « invite » : au 1er favori (confirme l'ajout) ; « edit » : depuis Mes données, sans consentement encore donné. */
  variant: "invite" | "edit";
  onLater: () => void;
  onStart: () => void;
}

// Invitation au parcours profil : la case de consentement (non cochée) conditionne « C'est parti ».
export function ProfileInvite({ variant, onLater, onStart }: Props) {
  const t = useTranslations("profile");
  const [consent, setConsent] = useState(false);
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-[rgba(20,20,18,.45)]" onClick={onLater}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-3.5 rounded-t-[22px] bg-white px-5 pt-2.5 pb-[max(30px,env(safe-area-inset-bottom))] motion-safe:animate-[sheet-in_220ms_cubic-bezier(.2,.8,.2,1)]"
      >
        <span className="h-[5px] w-9 self-center rounded-[3px] bg-[#DAD8D2]" />
        {variant === "invite" && (
          <span className="flex items-center gap-2 text-[14px] leading-none font-semibold text-ink">
            <span className="text-heart">♥</span>
            {t("added")}
          </span>
        )}
        <h2 id="invite-title" className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-.02em]">
          {variant === "invite" ? t("inviteTitle") : t("editTitle")}
        </h2>
        <p className="m-0 text-[15px] leading-[1.45] text-muted">{variant === "invite" ? t("inviteText") : t("editText")}</p>
        <div
          role="checkbox"
          aria-checked={consent}
          tabIndex={0}
          onClick={() => setConsent(!consent)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              setConsent(!consent);
            }
          }}
          className="flex w-full cursor-pointer items-start gap-3 rounded-[14px] bg-sand p-3.5 text-left"
        >
          <span
            aria-hidden
            className={`mt-px flex h-5 w-5 flex-none items-center justify-center rounded-[5px] text-[12px] leading-none font-semibold text-white ${
              consent ? "bg-ink" : "border-[1.5px] border-[#B8B6AF] bg-white"
            }`}
          >
            {consent ? "✓" : ""}
          </span>
          <span className="text-[13px] leading-[1.45] text-[#3F3F3B]">
            {t("consent")}{" "}
            <a href="/confidentialite" target="_blank" onClick={(e) => e.stopPropagation()} className="font-semibold text-ink underline">
              {t("privacy")}
            </a>
          </span>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={onLater} className="h-[50px] flex-1 cursor-pointer rounded-xl border-0 bg-transparent text-[16px] leading-none font-semibold text-muted">
            {variant === "invite" ? t("later") : t("close")}
          </button>
          <button
            type="button"
            aria-disabled={!consent}
            onClick={() => consent && onStart()}
            className={`h-[50px] flex-1 rounded-xl border-0 text-[16px] leading-none font-semibold ${consent ? "cursor-pointer bg-ink text-white" : "cursor-default bg-sand text-off"}`}
          >
            {t("start")}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AGE_RANGES, GENDERS, type AgeRange, type Gender, type Profile } from "@/lib/profile";

interface Props {
  /** "ask" : proposée au premier favori ; "edit" : ouverte depuis « Mes données ». */
  mode: "ask" | "edit";
  profile: Profile;
  busy: boolean;
  onSave: (ageRange: AgeRange | null, gender: Gender | null) => void;
  onClose: () => void;
  onWithdraw: () => void;
}

export function ProfileSheet({ mode, profile, busy, onSave, onClose, onWithdraw }: Props) {
  const t = useTranslations("profile");
  const [age, setAge] = useState<AgeRange | null>(profile.ageRange);
  const [gender, setGender] = useState<Gender | null>(profile.gender);
  const [consent, setConsent] = useState(mode === "edit" && profile.consent);

  const chip = (on: boolean) =>
    `h-10 cursor-pointer rounded-full border-[1.5px] px-3.5 text-[14px] leading-none font-medium text-ink ${on ? "border-ink bg-sand" : "border-border bg-white"}`;

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-[rgba(20,20,18,.45)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
        className="no-scrollbar flex max-h-full w-full flex-col gap-4 overflow-y-auto rounded-t-[22px] bg-white px-5 pt-2.5 pb-6"
      >
        <span className="h-[5px] w-9 flex-none self-center rounded-[3px] bg-[#DAD8D2]" />
        <div className="flex flex-col gap-1.5">
          <h2 id="profile-title" className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-.02em]">
            {mode === "ask" ? t("title") : t("editTitle")}
          </h2>
          <span className="text-[14px] leading-[1.45] text-muted">{mode === "ask" ? t("lead") : t("editLead")}</span>
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] leading-none font-semibold text-muted">{t("age")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {AGE_RANGES.map((a) => (
              <button key={a} type="button" aria-pressed={age === a} onClick={() => setAge(age === a ? null : a)} className={chip(age === a)}>
                {t(`ages.${a}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] leading-none font-semibold text-muted">{t("gender")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {GENDERS.map((g) => (
              <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(gender === g ? null : g)} className={chip(gender === g)}>
                {t(`genders.${g}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-sand px-3.5 py-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-[#2e3bd6]"
          />
          <span className="text-[13.5px] leading-[1.45] text-ink">
            {t("consent")}{" "}
            <a href="/confidentialite" target="_blank" className="font-semibold text-accent underline">
              {t("privacy")}
            </a>
          </span>
        </label>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-[50px] flex-1 cursor-pointer rounded-xl border border-border-2 bg-white text-[16px] leading-none font-semibold text-ink"
          >
            {mode === "ask" ? t("skip") : t("close")}
          </button>
          <button
            type="button"
            disabled={!consent || busy}
            onClick={() => onSave(age, gender)}
            className={`h-[50px] flex-1 cursor-pointer rounded-xl border-0 text-[16px] leading-none font-semibold text-white disabled:cursor-default ${consent ? "bg-ink" : "bg-off"}`}
          >
            {t("save")}
          </button>
        </div>

        {mode === "edit" && profile.consent && (
          <button
            type="button"
            disabled={busy}
            onClick={onWithdraw}
            className="h-11 cursor-pointer border-0 bg-transparent text-[14px] leading-none font-semibold text-heart underline"
          >
            {t("withdraw")}
          </button>
        )}
      </div>
    </div>
  );
}

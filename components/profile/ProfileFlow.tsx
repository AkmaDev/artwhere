"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AgeRange, Gender } from "@/lib/profile";
import { AgeStep } from "./AgeStep";
import { GenderStep } from "./GenderStep";

interface Props {
  initialAge: AgeRange | null;
  initialGender: Gender | null;
  busy: boolean;
  /** Depuis Mes données : propose aussi de retirer son accord. */
  editing: boolean;
  /** « × » à l'étape 1 : ferme sans rien enregistrer. */
  onClose: () => void;
  onFinish: (age: AgeRange | null, gender: Gender | null) => void;
  onWithdraw: () => void;
}

const AUTO_NEXT_MS = 250;

// Parcours plein écran, une question par écran : âge (1/2) puis genre (2/2).
export function ProfileFlow({ initialAge, initialGender, busy, editing, onClose, onFinish, onWithdraw }: Props) {
  const t = useTranslations("profile");
  const [step, setStep] = useState<1 | 2>(1);
  const [age, setAge] = useState<AgeRange | null>(initialAge);
  const [gender, setGender] = useState<Gender | null>(initialGender);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pickAge = (a: AgeRange) => {
    setAge(a);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStep(2), AUTO_NEXT_MS);
  };

  const primary = (enabled: boolean) =>
    `h-[50px] w-full rounded-xl border-0 text-[16px] leading-none font-semibold ${enabled ? "cursor-pointer bg-ink text-white" : "cursor-default bg-sand text-off"}`;
  const textBtn = "h-11 w-full cursor-pointer border-0 bg-transparent text-[15px] leading-none font-semibold text-muted";

  const question = (title: string, text: string) => (
    <div className="flex flex-col gap-2 px-5 pt-8">
      <h1 className="m-0 text-[28px] leading-[1.15] font-semibold tracking-[-.02em]">{title}</h1>
      <p className="m-0 text-[15px] leading-[1.45] text-muted">{text}</p>
    </div>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label={step === 1 ? t("ageTitle") : t("genderTitle")} className="absolute inset-0 z-50 flex flex-col bg-white">
      <div className="flex flex-none items-center gap-3.5 px-5 pt-2 pb-2">
        <button
          type="button"
          aria-label={step === 1 ? t("close") : t("back")}
          onClick={() => (step === 1 ? onClose() : setStep(1))}
          className="h-10 w-10 flex-none cursor-pointer rounded-full border border-[#DAD8D2] bg-white text-[18px] leading-none"
        >
          {step === 1 ? "×" : "←"}
        </button>
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {[1, 2].map((s) => (
            <span key={s} className={`h-1 flex-1 rounded-[2px] ${s <= step ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
        <span className="flex-none text-[13px] leading-none font-medium text-subtle">{t("step", { current: step, total: 2 })}</span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full w-[200%] transition-transform duration-[220ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{ transform: step === 1 ? "translateX(0)" : "translateX(-50%)" }}
        >
          <section className="flex h-full w-1/2 flex-col" aria-hidden={step !== 1} inert={step !== 1}>
            {question(t("ageTitle"), t("ageText"))}
            <div className="no-scrollbar flex flex-1 flex-col justify-center overflow-y-auto px-5 py-4">
              <AgeStep value={age} onPick={pickAge} />
            </div>
            <div className="flex flex-col gap-1 px-5 pb-[max(34px,env(safe-area-inset-bottom))]">
              <button type="button" aria-disabled={!age} onClick={() => age && setStep(2)} className={primary(!!age)}>
                {t("continue")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAge(null);
                  setStep(2);
                }}
                className={textBtn}
              >
                {t("skipAnswer")}
              </button>
              {editing && (
                <button type="button" disabled={busy} onClick={onWithdraw} className="h-11 w-full cursor-pointer border-0 bg-transparent text-[14px] leading-none font-semibold text-heart underline">
                  {t("withdraw")}
                </button>
              )}
            </div>
          </section>

          <section className="flex h-full w-1/2 flex-col" aria-hidden={step !== 2} inert={step !== 2}>
            {question(t("genderTitle"), t("genderText"))}
            <div className="no-scrollbar flex flex-1 flex-col justify-center overflow-y-auto px-5 py-4">
              <GenderStep value={gender} onPick={setGender} />
            </div>
            <div className="flex flex-col gap-1 px-5 pb-[max(34px,env(safe-area-inset-bottom))]">
              <button type="button" aria-disabled={!gender || busy} onClick={() => gender && !busy && onFinish(age, gender)} className={primary(!!gender && !busy)}>
                {t("finish")}
              </button>
              <button type="button" disabled={busy} onClick={() => onFinish(age, null)} className={textBtn}>
                {t("skip")}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

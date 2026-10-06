"use client";

import { useTranslations } from "next-intl";
import { CATEGORY_IDS, MAX_CATEGORIES, type CategoryId } from "@/lib/categories";

export function CategoryPicker({
  cats,
  onChange,
  onMax,
  variant,
}: {
  cats: CategoryId[];
  onChange: (c: CategoryId[]) => void;
  onMax: () => void;
  variant: "tiles" | "chips";
}) {
  const t = useTranslations("categories");
  return (
    <div className={variant === "tiles" ? "grid grid-cols-2 gap-2.5" : "flex flex-wrap gap-1.5"}>
      {CATEGORY_IDS.map((id) => {
        const on = cats.includes(id);
        const disabled = !on && cats.length >= MAX_CATEGORIES;
        const toggle = () => {
          if (disabled) return onMax();
          onChange(on ? cats.filter((x) => x !== id) : [...cats, id]);
        };
        const tone = `${on ? "border-ink bg-sand" : "border-border bg-white"} ${disabled ? "opacity-40" : ""}`;
        return variant === "tiles" ? (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={toggle}
            className={`flex min-h-[76px] cursor-pointer flex-col justify-between gap-1.5 rounded-[14px] border-[1.5px] p-3.5 text-left text-ink ${tone}`}
          >
            <span className="text-[15px] leading-tight font-semibold">{t(`${id}.name`)}</span>
            <span className="text-[12.5px] leading-[1.3] text-muted">{t(`${id}.hint`)}</span>
          </button>
        ) : (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={toggle}
            className={`h-10 cursor-pointer rounded-full border-[1.5px] px-3.5 text-[14px] leading-none font-medium text-ink ${tone}`}
          >
            {t(`${id}.name`)}
          </button>
        );
      })}
    </div>
  );
}

export function Onboarding({
  cats,
  onChange,
  onDone,
  flash,
}: {
  cats: CategoryId[];
  onChange: (c: CategoryId[]) => void;
  onDone: () => void;
  flash: (s: string) => void;
}) {
  const t = useTranslations("onboarding");
  const tl = useTranslations("lang");
  const ta = useTranslations("app");
  const canGo = cats.length > 0;
  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-5 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <span className="text-[20px] leading-none font-bold tracking-[-.02em]">
            {ta("name").toLowerCase()}
            <span className="text-accent">.</span>
          </span>
          <div className="flex gap-1 rounded-full bg-sand p-[3px]">
            <span className="flex h-[30px] items-center rounded-full bg-white px-3 text-[13px] leading-none font-semibold shadow-[0_1px_2px_rgba(0,0,0,.1)]">
              {tl("fr")}
            </span>
            <span className="flex h-[30px] items-center px-3 text-[13px] leading-none font-medium text-faint">{tl("enSoon")}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="balance m-0 text-[28px] leading-[1.15] font-semibold tracking-[-.02em]">{t("title")}</h1>
          <p className="pretty m-0 text-[15px] leading-[1.45] text-muted">{t("lead")}</p>
        </div>
        <CategoryPicker cats={cats} onChange={onChange} onMax={() => flash(t("max"))} variant="tiles" />
      </div>
      <div className="flex flex-none items-center justify-between gap-4 border-t border-line px-5 pt-3.5 pb-5">
        <span className="text-[14px] leading-[1.3] font-medium text-muted">{t("count", { n: cats.length })}</span>
        <button
          type="button"
          onClick={() => (canGo ? onDone() : flash(t("needOne")))}
          className={`h-[50px] cursor-pointer rounded-xl border-0 px-[26px] text-[16px] leading-none font-semibold text-white ${canGo ? "bg-ink" : "bg-off"}`}
        >
          {t("cta")}
        </button>
      </div>
    </div>
  );
}

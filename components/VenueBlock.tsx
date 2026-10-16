"use client";

import { useTranslations } from "next-intl";

interface Props {
  name: string;
  /** Type de lieu (« Musée »…) ; omis s'il est inconnu. */
  type?: string | null;
  /** Dates à venir connues pour ce lieu ; omis si inconnu (fiche partagée). */
  upcoming?: number | null;
}

// Bloc lieu de la fiche. Pas de bouton « Suivre » ni de page lieu avant la spec 05 : le bloc est informatif.
export function VenueBlock({ name, type, upcoming }: Props) {
  const t = useTranslations("venue");
  const sub = [type, upcoming != null ? t("upcoming", { count: upcoming }) : null].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-border px-3.5 py-3">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-sand text-[16px] leading-none font-semibold text-muted">
        {name.trim()[0]?.toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] leading-tight font-semibold text-ink">{name}</span>
        {sub && <span className="text-[13px] leading-tight text-muted">{sub}</span>}
      </span>
    </div>
  );
}

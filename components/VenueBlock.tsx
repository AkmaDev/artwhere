"use client";

import { useTranslations } from "next-intl";

interface Props {
  name: string;
  /** Type de lieu (« Musée »…) ; omis s'il est inconnu. */
  type?: string | null;
  /** Dates à venir connues pour ce lieu ; omis si inconnu (fiche partagée). */
  upcoming?: number | null;
  /** Ouvre la page lieu ; sans lui (ville inconnue), le bloc reste informatif et sans bouton Suivre. */
  onOpen?: () => void;
  following?: boolean;
  onFollow?: () => void;
}

/** Bouton Suivre / Suivi ✓ (page lieu, bloc lieu de la fiche, Favoris). */
export function FollowButton({ name, following, onClick }: { name: string; following: boolean; onClick: () => void }) {
  const t = useTranslations("venue");
  return (
    <button
      type="button"
      aria-pressed={following}
      aria-label={following ? t("unfollowName", { venue: name }) : t("followName", { venue: name })}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      className={`h-9 flex-none cursor-pointer rounded-[10px] border border-ink px-4 text-[14px] leading-none font-semibold ${
        following ? "bg-white text-ink" : "bg-ink text-white"
      }`}
    >
      {following ? t("following") : t("follow")}
    </button>
  );
}

// Bloc lieu de la fiche : tap → page lieu, bouton Suivre à droite.
export function VenueBlock({ name, type, upcoming, onOpen, following = false, onFollow }: Props) {
  const t = useTranslations("venue");
  const sub = [type, upcoming != null ? t("upcoming", { count: upcoming }) : null].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-sand text-[16px] leading-none font-semibold text-muted">
        {name.trim()[0]?.toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] leading-tight font-semibold text-ink">{name}</span>
        {sub && <span className="text-[13px] leading-tight text-muted">{sub}</span>}
      </span>
    </>
  );
  if (!onOpen) return <div className="flex items-center gap-3 rounded-[14px] border border-border px-3.5 py-3">{body}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("open", { venue: name })}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.target === ev.currentTarget && (ev.key === "Enter" || ev.key === " ")) {
          ev.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-border px-3.5 py-3"
    >
      {body}
      {onFollow && <FollowButton name={name} following={following} onClick={onFollow} />}
    </div>
  );
}

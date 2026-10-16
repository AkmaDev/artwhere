"use client";

export interface ShortcutItem {
  id: string;
  label: string;
  /** Omis pour une bascule sans compteur. */
  count?: number;
  on: boolean;
  onClick: () => void;
}

// Rangée horizontale de raccourcis (« Aujourd'hui · 12 »…) ; défile sans barre, sans bloquer le défilement vertical.
export function ShortcutPills({ items }: { items: ShortcutItem[] }) {
  if (!items.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 [touch-action:pan-x_pan-y]">
      {items.map((x) => (
        <button
          key={x.id}
          type="button"
          aria-pressed={x.on}
          onClick={x.onClick}
          className={`flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[14px] leading-none font-semibold whitespace-nowrap ${
            x.on ? "border-ink bg-ink text-white" : "border-border-2 bg-white text-ink"
          }`}
        >
          {x.label}
          {x.count != null && <span className={`text-[12px] font-medium ${x.on ? "text-off" : "text-subtle"}`}>{x.count}</span>}
        </button>
      ))}
    </div>
  );
}

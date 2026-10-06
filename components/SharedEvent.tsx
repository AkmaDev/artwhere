"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useStored, type Favorites } from "@/lib/device";
import type { EventItem } from "@/lib/types";
import { EventDetail } from "./EventDetail";
import { Toast } from "./ui";

export function SharedEvent({ e }: { e: EventItem }) {
  const router = useRouter();
  const [favs, setFavs] = useStored<Favorites>("favs", {});
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = useCallback((s: string) => {
    setToast(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  return (
    <div className="relative flex-1">
      <EventDetail
        e={e}
        tz="Europe/Paris"
        isNew={false}
        isFav={!!favs[e.id]}
        onClose={() => router.push("/")}
        onFav={() =>
          setFavs((prev) => {
            const next = { ...prev };
            if (next[e.id]) delete next[e.id];
            else next[e.id] = e;
            return next;
          })
        }
        flash={flash}
      />
      <Toast text={toast} />
    </div>
  );
}

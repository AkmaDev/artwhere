"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useStored, type AlertPrefs, type Favorites } from "@/lib/device";
import { useFollows } from "@/lib/follows";
import type { EventItem, VenueData } from "@/lib/types";
import { Toast } from "./ui";
import { VenuePage } from "./VenuePage";

// Lien partagé /l/[id] : page lieu sans état préalable ; un événement ouvre /e/[id].
export function SharedVenue({ data }: { data: VenueData }) {
  const router = useRouter();
  const t = useTranslations("venuePage");
  const [favs, setFavs] = useStored<Favorites>("favs", {});
  const [alerts] = useStored<AlertPrefs>("alerts", { on: false, freq: "now" });
  const { isFollowing, toggleFollow } = useFollows();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = useCallback((s: string) => {
    setToast(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1800);
  }, []);
  const v = data.venue;

  return (
    <div className="relative flex-1">
      <VenuePage
        id={v.id}
        name={v.name}
        initial={data}
        from={null}
        following={isFollowing(v.id)}
        alertsOn={alerts.on}
        isFav={(id) => !!favs[id]}
        onFav={(e: EventItem) =>
          setFavs((prev) => {
            const next = { ...prev };
            if (next[e.id]) delete next[e.id];
            else next[e.id] = e;
            return next;
          })
        }
        onOpenEvent={(e) => router.push(`/e/${e.id}`)}
        onFollow={() => flash(t(toggleFollow(v.id, v.name, v.city) ? "toastFollow" : "toastUnfollow", { venue: v.name }))}
        onAlerts={() => router.push("/")}
        onClose={() => router.push("/")}
      />
      <Toast text={toast} />
    </div>
  );
}

"use client";

import { useCallback } from "react";
import { useStored } from "./device";
import { venueKey } from "./venue";

// Lieux suivis, sur l'appareil (pas de compte). Nom et ville gardés pour afficher la liste sans appel réseau.
export type Follows = Record<string, { name: string; city: string }>;

export function useFollows() {
  const [follows, setFollows, ready] = useStored<Follows>("follows", {});
  const isFollowing = useCallback((id: string) => !!follows[id], [follows]);
  /** Renvoie true si le lieu est maintenant suivi. */
  const toggleFollow = useCallback(
    (id: string, name: string, city: string): boolean => {
      const was = !!follows[id];
      setFollows((prev) => {
        const next = { ...prev };
        if (was) delete next[id];
        else next[id] = { name, city };
        return next;
      });
      return !was;
    },
    [follows, setFollows],
  );
  return { follows, ready, isFollowing, toggleFollow };
}

/** Clés « ville|venue_norm » envoyées avec l'abonnement aux alertes. */
export function followKeys(follows: Follows): string[] {
  return Object.keys(follows)
    .map(venueKey)
    .filter((k): k is string => !!k)
    .sort();
}

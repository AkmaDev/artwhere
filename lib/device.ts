"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { CategoryId } from "./categories";
import type { EventItem, Moment } from "./types";

const PREFIX = "aw:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

export function useStored<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValue(read(key, initial));
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFIX + key) setValue(read(key, initial));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        write(key, next);
        return next;
      });
    },
    [key],
  );

  return [value, set, ready];
}

export function getDeviceId(): string {
  let id = read<string | null>("device", null);
  if (!id) {
    id = crypto.randomUUID();
    write("device", id);
  }
  return id;
}

// Début de la visite précédente : sert au badge « Nouveau ». Calculé une fois par session.
export function previousVisitAt(): string {
  try {
    const cached = sessionStorage.getItem(PREFIX + "prevVisit");
    if (cached) return cached;
    // Première visite : rien n'est « nouveau ».
    const prev = read<string | null>("lastVisit", null) ?? new Date().toISOString();
    sessionStorage.setItem(PREFIX + "prevVisit", prev);
    write("lastVisit", new Date().toISOString());
    return prev;
  } catch {
    return new Date().toISOString();
  }
}

export interface Prefs {
  onboarded: boolean;
  cats: CategoryId[];
  city: string;
  geo: { lat: number; lng: number } | null;
  from: string | null;
  to: string | null;
  moments: Moment[];
}

export const DEFAULT_PREFS: Prefs = {
  onboarded: false,
  cats: [],
  city: "paris",
  geo: null,
  from: null,
  to: null,
  moments: [],
};

export type Favorites = Record<string, EventItem>;

export interface AlertPrefs {
  on: boolean;
  freq: "now" | "daily";
}

const noop = () => () => {};

export function useIsStandalone(): boolean {
  return useSyncExternalStore(
    noop,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

export function useIsIos(): boolean {
  return useSyncExternalStore(
    noop,
    () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    () => false,
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Area, Place } from "@/lib/area";
import { fmtDayLong, fmtRange, shortcutRanges, todayIn } from "@/lib/dates";
import {
  DEFAULT_PREFS,
  previousVisitAt,
  useIsIos,
  useIsStandalone,
  useStored,
  type AlertPrefs,
  type Favorites as FavMap,
  type Prefs,
} from "@/lib/device";
import { firstDay } from "@/lib/format";
import { CATEGORY_IDS, type CategoryId } from "@/lib/categories";
import { followKeys, useFollows } from "@/lib/follows";
import { placeLabel } from "@/lib/neighborhood";
import {
  DEFAULT_PROFILE,
  DEFAULT_PROFILE_PROMPT,
  deferInvite,
  shouldInvite,
  topCities,
  type AgeRange,
  type Gender,
  type Profile,
  type ProfilePrompt,
} from "@/lib/profile";
import { deleteProfile, sendProfile } from "@/lib/profile-client";
import { disablePush, enablePush, notifPermission, updatePush, type Criteria, type PushResult } from "@/lib/push-client";
import { matchesShortcut, SHORTCUT_IDS, type ShortcutId } from "@/lib/shortcuts";
import type { EventItem } from "@/lib/types";
import { getUrgency, isLastChance, urgencyEnd } from "@/lib/urgency";
import { addSeen, buildDeck, DECK_MIN, rankRows, recordSwipe, type TasteScores } from "@/lib/taste";
import { venueId } from "@/lib/venue";
import { Alerts } from "./Alerts";
import { CategoryRow } from "./CategoryRow";
import { EndingSoonRow } from "./EndingSoonRow";
import { EventCard } from "./EventCard";
import { EventDetail } from "./EventDetail";
import { Favorites } from "./Favorites";
import { FreshnessFooter } from "./FreshnessFooter";
import { InfoSheet } from "./InfoSheet";
import { InstallSheet } from "./InstallSheet";
import { NotifPrimer } from "./NotifPrimer";
import { Onboarding } from "./Onboarding";
import { ProfileFlow } from "./profile/ProfileFlow";
import { ProfileInvite } from "./profile/ProfileInvite";
import { QuickMatch } from "./QuickMatch";
import { QuickMatchTeaser } from "./QuickMatchTeaser";
import { SearchSheet, type Step } from "./SearchSheet";
import type { SwipeDir } from "./SwipeCard";
import { ShortcutPills, type ShortcutItem } from "./ShortcutPills";
import { Toast } from "./ui";
import { VenuePage } from "./VenuePage";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

type Screen = "explore" | "favs" | "alerts";
type NotifPrompt = { seen: boolean; decision: "granted" | "denied" | "later" | null };
type ProfileUi ={ kind: "invite"; variant: "invite" | "edit" } | { kind: "flow"; editing: boolean };
type HomeFilter ={ kind: "shortcut"; id: ShortcutId } | { kind: "cat"; id: CategoryId } | { kind: "urgent" };
const PAGE = 30;
const ONGOING_PREVIEW = 4;
const AREA_POLL_MS = 15000;
const QUICK_MATCH = process.env.NEXT_PUBLIC_QUICK_MATCH === "1";
type BeforeInstallPrompt = Event & { prompt: () => Promise<void> };

export function ArtwhereApp({ cardVariant = "big" }: { cardVariant?: "big" | "compact" }) {
  const t = useTranslations();
  const locale = useLocale();
  const ios = useIsIos();
  const standalone = useIsStandalone();

  const [prefs, setPrefsRaw, ready] = useStored<Prefs>("prefs", DEFAULT_PREFS);
  const [favs, setFavs] = useStored<FavMap>("favs", {});
  const [alerts, setAlerts] = useStored<AlertPrefs>("alerts", { on: false, freq: "now" });
  // Lieux suivis : possédés ici (une seule instance de useStored) et passés aux écrans.
  const { follows, ready: followsReady, isFollowing, toggleFollow } = useFollows();
  const [venue, setVenue] = useState<{ id: string; name: string } | null>(null);
  // Goûts appris (null = pas encore initialisés : on part des favoris existants).
  const [taste, setTaste, tasteReady] = useStored<TasteScores | null>("tasteScores", null);
  const [seen, setSeen] = useStored<string[]>("quickMatchSeen", []);
  const [qmPool, setQmPool] = useState<EventItem[] | null>(null);
  const [qmDeck, setQmDeck] = useState<EventItem[] | null>(null);
  const qmKeptFav = useRef(false);
  const [bannerHidden, setBannerHidden] = useStored("bannerHidden", false);
  const [recent, setRecent] = useStored<Area[]>("recentAreas", []);
  const [areaCounts, setAreaCounts] = useStored<Record<string, number>>("areaCounts", {});
  const [profile, setProfile, profileReady] = useStored<Profile>("profile", DEFAULT_PROFILE);
  const [prompt, setPrompt, promptReady] = useStored<ProfilePrompt>("profilePrompt", DEFAULT_PROFILE_PROMPT);
  const [profileUi, setProfileUi] = useState<ProfileUi | null>(null);
  const [notifPrompt, setNotifPrompt, notifReady] = useStored<NotifPrompt>("notifPrompt", { seen: false, decision: null });
  const [primerOpen, setPrimerOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [areaBusy, setAreaBusy] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);

  const [screen, setScreen] = useState<Screen>("explore");
  const [search, setSearch] = useState(false);
  const [step, setStep] = useState<Step>("when");
  const [view, setView] = useState<"list" | "map">("list");
  const [tab, setTab] = useState<string>("all");
  // Accueil éditorialisé : sans filtre ; avec un raccourci, une catégorie ou « Dernière chance » : liste par jour filtrée.
  const [filter, setFilter] = useState<HomeFilter | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const [near, setNear] = useState(false);
  const [detail, setDetail] = useState<EventItem | null>(null);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [prevVisit, setPrevVisit] = useState<string | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPrompt | null>(null);
  const [alertBusy, setAlertBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [renderLimit, setRenderLimit] = useState(PAGE);
  const [ongoingOpen, setOngoingOpen] = useState(false);
  const io = useRef<IntersectionObserver | null>(null);
  const sentinel = useCallback((el: HTMLDivElement | null) => {
    io.current?.disconnect();
    if (!el) return;
    io.current = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setRenderLimit((l) => l + PAGE), {
      rootMargin: "800px",
    });
    io.current.observe(el);
  }, []);

  const openDetail = useCallback((e: EventItem) => {
    setDetail(e);
    if (e.description != null) return;
    fetch(`/api/events/by-ids?ids=${encodeURIComponent(e.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { events: EventItem[] } | null) => {
        const full = d?.events[0];
        if (full) setDetail((cur) => (cur?.id === full.id ? { ...full, nextAt: cur.nextAt, distanceKm: cur.distanceKm, city: full.city ?? cur.city } : cur));
      })
      .catch(() => {});
  }, []);

  const area = prefs.area ?? null;
  const tz = area?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = ready ? todayIn(tz) : "";
  const from = prefs.from && prefs.from >= today ? prefs.from : today;
  const to = prefs.to && prefs.to >= from ? prefs.to : from;

  const flash = useCallback((s: string, ms = 1800) => {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const setPrefs = useCallback((p: Partial<Prefs>) => setPrefsRaw((prev) => ({ ...prev, ...p })), [setPrefsRaw]);

  useEffect(() => {
    setPrevVisit(previousVisitAt());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (ready && prefs.onboarded && !prefs.area) {
      setSearch(true);
      setStep("where");
    }
  }, [ready, prefs.onboarded, prefs.area]);

  useEffect(() => {
    if (!area || area.status !== "pending") return;
    const timer = setInterval(() => {
      fetch(`/api/areas/${area.slug}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { area: Area } | null) => {
          setReload((x) => x + 1);
          if (d?.area.status === "ready") setPrefsRaw((prev) => (prev.area?.slug === d.area.slug ? { ...prev, area: d.area } : prev));
        })
        .catch(() => {});
    }, AREA_POLL_MS);
    return () => clearInterval(timer);
  }, [area, setPrefsRaw]);

  useEffect(() => {
    if (!ready || !prefs.onboarded) return;
    if (!prefs.from) {
      const we = shortcutRanges(todayIn(tz)).find((r) => r.id === "weekend")!;
      setPrefs({ from: we.from, to: we.to });
    }
  }, [ready, prefs.onboarded, prefs.from, tz, setPrefs]);

  const queryKey = useMemo(() => {
    if (!ready || !today || !prefs.cats.length || !area) return null;
    const p = new URLSearchParams({ city: area.slug, from, to, cats: prefs.cats.join(",") });
    if (prefs.moments.length) p.set("moments", prefs.moments.join(","));
    if (prefs.geo) {
      p.set("lat", String(prefs.geo.lat));
      p.set("lng", String(prefs.geo.lng));
      if (near) p.set("maxKm", "2");
    }
    return p.toString();
  }, [ready, today, area, prefs.cats, prefs.moments, prefs.geo, from, to, near]);

  useEffect(() => {
    setRenderLimit(PAGE);
    setOngoingOpen(false);
    setPlacesOpen(false);
  }, [queryKey, tab, filter]);

  // Date de dernière collecte (pied de liste) : la zone stockée sur l'appareil peut être ancienne.
  const areaSlug = area?.slug;
  useEffect(() => {
    if (!areaSlug) return;
    fetch(`/api/areas/${areaSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { area: Area } | null) => {
        if (d) setPrefsRaw((prev) => (prev.area?.slug === d.area.slug ? { ...prev, area: d.area } : prev));
      })
      .catch(() => {});
  }, [areaSlug, setPrefsRaw]);

  useEffect(() => {
    if (!queryKey) {
      setEvents([]);
      return;
    }
    const ctrl = new AbortController();
    setError(false);
    const timer = setTimeout(() => {
      fetch(`/api/events?${queryKey}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: { events: EventItem[] }) => setEvents(d.events))
        .catch((e) => {
          if (ctrl.signal.aborted) return;
          console.error(e);
          setError(true);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [queryKey, reload]);

  const favIds = useMemo(() => Object.keys(favs), [favs]);
  useEffect(() => {
    if (screen !== "favs" || !favIds.length) return;
    fetch(`/api/events/by-ids?ids=${favIds.join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { events: EventItem[] } | null) => {
        if (!d) return;
        setFavs((prev) => {
          const next = { ...prev };
          for (const e of d.events) if (next[e.id]) next[e.id] = e;
          return next;
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (!tasteReady || taste !== null || !ready) return;
    let s: TasteScores = {};
    for (const f of Object.values(favs)) s = recordSwipe(s, f.categories, "fav");
    setTaste(s);
  }, [tasteReady, taste, ready, favs, setTaste]);

  // Quick Match : la recherche courante, toutes catégories (pour découvrir), chargée seulement si le drapeau est actif.
  const qmKey = useMemo(() => {
    if (!QUICK_MATCH || !ready || !today || !area) return null;
    const p = new URLSearchParams({ city: area.slug, from, to, cats: CATEGORY_IDS.join(",") });
    if (prefs.moments.length) p.set("moments", prefs.moments.join(","));
    if (prefs.geo) {
      p.set("lat", String(prefs.geo.lat));
      p.set("lng", String(prefs.geo.lng));
    }
    return p.toString();
  }, [ready, today, area, from, to, prefs.moments, prefs.geo]);
  useEffect(() => {
    if (!qmKey) return;
    const ctrl = new AbortController();
    fetch(`/api/events?${qmKey}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { events: EventItem[] } | null) => setQmPool(d?.events ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [qmKey]);

  const criteria: Criteria = useMemo(
    () => ({ city: area?.slug ?? "", from, to, cats: prefs.cats, moments: prefs.moments, frequency: alerts.freq, venues: followKeys(follows) }),
    [area, from, to, prefs.cats, prefs.moments, alerts.freq, follows],
  );
  const criteriaKey = JSON.stringify(criteria);
  const lastSent = useRef<string | null>(null);
  useEffect(() => {
    // Renvoyé aussi une fois à l'ouverture : les lieux suivis ont pu changer ailleurs (lien partagé /l/[id]).
    if (!alerts.on || !today || !followsReady) return;
    if (lastSent.current === criteriaKey) return;
    lastSent.current = criteriaKey;
    const timer = setTimeout(() => updatePush(criteria).catch(() => {}), 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.on, criteriaKey, today, followsReady]);

  // Profil anonyme : synchronisé seulement après consentement, à chaque changement (et une fois par session).
  const cities = useMemo(() => topCities(areaCounts), [areaCounts]);
  const tasteOut = useMemo(() => taste ?? {}, [taste]);
  const profileKey = JSON.stringify([prefs.cats, profile.ageRange, profile.gender, cities, tasteOut]);
  const lastProfile = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !profileReady || !profile.consent) {
      lastProfile.current = null;
      return;
    }
    if (lastProfile.current === profileKey) return;
    const timer = setTimeout(() => {
      sendProfile({ categories: prefs.cats, ageRange: profile.ageRange, gender: profile.gender, topCities: cities, taste: tasteOut }).then((ok) => {
        if (ok) lastProfile.current = profileKey;
      });
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profileReady, profile.consent, profileKey]);

  if (!ready) return null;

  const isNew = (e: EventItem) => !!prevVisit && e.firstDetectedAt > prevVisit;
  const isFav = (id: string) => !!favs[id];
  const toggleFav = (e: EventItem, quiet = false) => {
    const had = !!favs[e.id];
    setFavs((prev) => {
      const next = { ...prev };
      if (had) delete next[e.id];
      else next[e.id] = e;
      return next;
    });
    if (had || quiet) return;
    setTaste((s) => recordSwipe(s ?? {}, e.categories, "fav"));
    // 1er favori (puis une fois au 3e après « Plus tard ») : l'invitation au profil remplace le toast.
    const count = favIds.length + 1;
    if (profileReady && promptReady && shouldInvite(prompt, profile, count)) setProfileUi({ kind: "invite", variant: "invite" });
    else flash(t("toast.favAdded"));
  };

  // Pré-écran des notifications : seulement si la permission n'a jamais été demandée et que l'appareil peut
  // recevoir des alertes (sur iPhone, uniquement l'appli installée). Jamais à l'ouverture de l'appli.
  const canPrime = () => !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && notifPermission() === "default" && !(ios && !standalone);
  const openPrimer = () => {
    setNotifPrompt((p) => ({ ...p, seen: true }));
    setPrimerOpen(true);
  };
  const maybePrime = () => {
    if (notifReady && !notifPrompt.seen && canPrime()) setTimeout(openPrimer, 400);
  };

  const toggleVenue = (id: string, name: string, city: string) => {
    const now = toggleFollow(id, name, city);
    flash(t(now ? "venuePage.toastFollow" : "venuePage.toastUnfollow", { venue: name }));
    // Premier « Suivre » sans alertes : le pré-écran (une seule fois, si l'appareil peut les recevoir).
    if (now && !alerts.on) maybePrime();
  };

  // « Plus tard » sur l'invitation, ou « × » avant d'avoir répondu : reproposé une seule fois, au 3e favori.
  const deferProfile = () => {
    const fromInvite = profileUi?.kind === "invite" && profileUi.variant === "invite";
    if (fromInvite || (profileUi?.kind === "flow" && !profileUi.editing)) setPrompt((p) => deferInvite(p, favIds.length));
    setProfileUi(null);
    if (fromInvite) maybePrime();
  };

  const finishProfile = async (ageRange: AgeRange | null, gender: Gender | null) => {
    setProfileBusy(true);
    const ok = await sendProfile({ categories: prefs.cats, ageRange, gender, topCities: cities, taste: tasteOut });
    setProfileBusy(false);
    if (!ok) return flash(t("profile.failed"));
    lastProfile.current = JSON.stringify([prefs.cats, ageRange, gender, cities, tasteOut]);
    setProfile({ consent: true, ageRange, gender, answeredAt: new Date().toISOString() });
    setPrompt((p) => ({ ...p, done: true }));
    setProfileUi(null);
    flash(t("profile.thanks"));
    maybePrime();
  };

  const withdrawProfile = async () => {
    setProfileBusy(true);
    const ok = await deleteProfile();
    setProfileBusy(false);
    if (!ok) return flash(t("profile.failed"));
    setProfile(DEFAULT_PROFILE);
    setTaste({});
    setSeen([]);
    setPrompt((p) => ({ ...p, done: true }));
    setProfileUi(null);
    flash(t("profile.withdrawn"));
  };

  // Mes données : directement l'âge si l'accord est déjà donné, sinon l'invitation (consentement d'abord).
  const openMyData = () => setProfileUi(profile.consent ? { kind: "flow", editing: true } : { kind: "invite", variant: "edit" });

  // Codes GeolocationPositionError : 1 refusée, 2 indisponible, 3 délai dépassé.
  const geoError = (code: number) =>
    flash(t(code === 1 ? (ios ? "search.geoBlockedIos" : "search.geoBlocked") : code === 3 ? "search.geoTimeout" : "search.geoUnavailable"), 7000);

  const requestGeo = async (then: (lat: number, lng: number) => void) => {
    if (!("geolocation" in navigator)) return geoError(2);
    // Une permission déjà refusée ne redéclenche pas la demande du navigateur : on explique directement.
    try {
      const st = await navigator.permissions?.query({ name: "geolocation" });
      if (st?.state === "denied") return geoError(1);
    } catch {}
    flash(t("search.geoLocating"), 20000);
    // D'abord rapide (réseau, cache 5 min), puis précis si la position n'arrive pas.
    const attempt = (precise: boolean) =>
      navigator.geolocation.getCurrentPosition(
        (pos) => then(pos.coords.latitude, pos.coords.longitude),
        (err) => (!precise && err.code !== 1 ? attempt(true) : geoError(err.code)),
        precise ? { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 } : { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
      );
    attempt(false);
  };

  const chooseArea = (a: Area, geo: Prefs["geo"] = null) => {
    setPrefs({ area: a, geo });
    setRecent((prev) => [a, ...prev.filter((x) => x.slug !== a.slug)].slice(0, 5));
    setAreaCounts((prev) => ({ ...prev, [a.slug]: (prev[a.slug] ?? 0) + 1 }));
    setStep("when");
  };

  const pickPlace = async (p: Place, geo: Prefs["geo"] = null) => {
    setAreaBusy(true);
    try {
      const r = await fetch("/api/areas/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name, country: p.country, countryCode: p.countryCode, lat: p.lat, lng: p.lng }),
      });
      if (!r.ok) throw new Error(String(r.status));
      chooseArea(((await r.json()) as { area: Area }).area, geo);
    } catch {
      flash(t("search.geoFailed"));
    } finally {
      setAreaBusy(false);
    }
  };

  // Position + quartier (pour le titre « Paris · Le Marais, 4e »), sans bloquer si le géocodage échoue.
  const geoWithLabel = async (lat: number, lng: number): Promise<NonNullable<Prefs["geo"]>> => {
    const r = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`).catch(() => null);
    const place = r?.ok ? ((await r.json()) as { place: Place }).place : null;
    return { lat, lng, district: place?.district ?? null, postcode: place?.postcode ?? null };
  };

  const onGeo = () =>
    requestGeo(async (lat, lng) => {
      const r = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`).catch(() => null);
      const place = r?.ok ? ((await r.json()) as { place: Place }).place : null;
      if (!place) return flash(t("search.geoFailed"));
      await pickPlace(place, { lat, lng, district: place.district ?? null, postcode: place.postcode ?? null });
      flash(t("search.geoFound"));
    });

  if (!prefs.onboarded) {
    return (
      <>
        <Onboarding
          cats={prefs.cats}
          onChange={(cats) => setPrefs({ cats })}
          onDone={() => {
            setPrefs({ onboarded: true });
            setSearch(true);
            setStep("where");
          }}
          flash={flash}
        />
        <Toast text={toast} />
      </>
    );
  }

  const all = events ?? [];
  const allEvs = all.filter((e) => e.kind === "event");
  const matchFilter = (e: EventItem): boolean =>
    !filter
      ? true
      : filter.kind === "cat"
        ? e.categories.includes(filter.id)
        : filter.kind === "urgent"
          ? e.kind === "event" && isLastChance(getUrgency(e))
          : e.kind === "event" && matchesShortcut(filter.id, e, { today, isNew: isNew(e) });
  // Carte : onglets de catégorie existants. Liste : accueil éditorialisé, ou liste par jour filtrée.
  const shown = view === "map" ? (tab === "all" ? all : all.filter((e) => e.categories.includes(tab as never))) : all.filter(matchFilter);
  const editorial = view === "list" && !filter;
  const evs = shown.filter((e) => e.kind === "event");
  const places = shown.filter((e) => e.kind === "place");
  const ongoing = evs.filter((e) => e.allDay);
  const dated = evs.filter((e) => !e.allDay);
  const days = [...new Set(dated.map((e) => firstDay(e, from, tz)))].sort();
  let budget = renderLimit;
  const groups = [
    ...(ongoing.length
      ? [{ key: "ongoing", label: t("explore.ongoing"), sub: t("explore.places", { n: ongoing.length }), items: ongoingOpen ? ongoing : ongoing.slice(0, ONGOING_PREVIEW), total: ongoing.length }]
      : []),
    ...days.map((d) => {
      const items = dated.filter((e) => firstDay(e, from, tz) === d);
      return { key: d, label: d === today ? t("explore.today") : fmtDayLong(d, locale), sub: t("explore.eventsN", { n: items.length }), items, total: items.length };
    }),
    ...(places.length
      ? [{ key: "places", label: t("explore.placesTitle"), sub: t("explore.placesN", { n: places.length }), items: placesOpen || !evs.length ? places : places.slice(0, ONGOING_PREVIEW), total: places.length }]
      : []),
  ]
    .map((g) => {
      const items = g.items.slice(0, Math.max(budget, 0));
      budget -= items.length;
      return { ...g, items };
    })
    .filter((g) => g.items.length);
  const hasMore = budget <= 0;
  const newN = all.filter((e) => e.kind === "event" && isNew(e)).length;
  const n = prefs.cats.length;
  const momTxt = prefs.moments.map((m) => t(`moments.${m}.name`)).join(", ");
  const range = fmtRange(from, to, locale);
  const geoLabel = placeLabel(prefs.geo);
  const pillTitle = `${area?.name ?? t("search.chooseCity")}${prefs.geo ? ` · ${geoLabel ?? t("explore.aroundMe")}` : ""}`;

  // Accueil éditorialisé.
  const todayInRange = from <= today && today <= to;
  const toggleNear = () => {
    if (near) return setNear(false);
    if (prefs.geo) return setNear(true);
    requestGeo(async (lat, lng) => {
      setPrefs({ geo: await geoWithLabel(lat, lng) });
      setNear(true);
      flash(t("search.geoFound"));
    });
  };
  const filterLabel = filter?.kind === "cat" ? t(`categories.${filter.id}.name`) : filter?.kind === "urgent" ? t("home.endingSoon") : null;
  const shortcutItems: ShortcutItem[] = [
    ...(filterLabel ? [{ id: "clear", label: t("home.clearFilter", { label: filterLabel }), on: true, onClick: () => setFilter(null) }] : []),
    ...SHORTCUT_IDS.filter((id) => id !== "today" || todayInRange)
      .map((id) => ({
        id,
        label: t(`shortcuts.${id}`),
        count: allEvs.filter((e) => matchesShortcut(id, e, { today, isNew: isNew(e) })).length,
        on: filter?.kind === "shortcut" && filter.id === id,
        onClick: () => setFilter(filter?.kind === "shortcut" && filter.id === id ? null : { kind: "shortcut", id }),
      }))
      .filter((x) => x.count > 0 || x.on),
    { id: "near", label: t("explore.near"), on: near, onClick: toggleNear },
  ];
  const endingSoon = allEvs
    .filter((e) => isLastChance(getUrgency(e)))
    .sort((a, b) => urgencyEnd(a) - urgencyEnd(b))
    .slice(0, 10);
  // Ordre des rangées : goûts appris (favoris +1, Quick Match), puis catégories les plus fournies.
  const rows = rankRows(
    (prefs.cats.length ? prefs.cats : [...CATEGORY_IDS])
      .map((cat) => ({ cat, events: allEvs.filter((e) => e.categories.includes(cat)).sort((a, b) => a.nextAt.localeCompare(b.nextAt)) }))
      .filter((r) => r.events.length),
    tasteOut,
  );
  const qmAvailable = QUICK_MATCH && qmPool ? buildDeck(qmPool, { favIds: new Set(favIds), seen: new Set(seen) }) : [];
  const showTeaser = qmAvailable.length >= DECK_MIN;
  const onSwipe = (e: EventItem, dir: SwipeDir) => {
    setSeen((s) => addSeen(s, e.id));
    setTaste((s) => recordSwipe(s ?? {}, e.categories, dir));
    if (dir === "keep" && !favs[e.id]) {
      toggleFav(e, true);
      qmKeptFav.current = true;
    }
  };
  // Fermeture : l'invitation au profil, si elle est due, arrive après la série, jamais au milieu.
  const closeQuickMatch = () => {
    setQmDeck(null);
    if (qmKeptFav.current && profileReady && promptReady && shouldInvite(prompt, profile, favIds.length)) setProfileUi({ kind: "invite", variant: "invite" });
    qmKeptFav.current = false;
  };
  const pillSub = `${range} · ${momTxt || t("moments.allDay")} · ${t("explore.catCount", { n })}`;
  const sourceNames = [...new Set(all.flatMap((e) => e.sources))].map((s) => (t.has(`sources.${s}`) ? t(`sources.${s}`) : s));
  const showBanner = !standalone && !bannerHidden && (ios || !!installEvt);

  // Abonnement effectif. La demande système n'arrive ici que depuis le pré-écran (permission « default »)
  // ou quand la permission est déjà accordée.
  const activateAlerts = async (): Promise<PushResult> => {
    setAlertBusy(true);
    try {
      const r = await enablePush(criteria);
      if (r === "ok") {
        lastSent.current = criteriaKey;
        setAlerts({ ...alerts, on: true });
        flash(t("alerts.on"));
      } else if (r === "unsupported" && ios && !standalone) setSheet(true);
      else
        flash(
          t(
            r === "denied"
              ? "alerts.denied"
              : r === "unsupported"
                ? "alerts.unsupported"
                : r === "not-configured"
                  ? "alerts.notConfigured"
                  : "alerts.failed",
          ),
        );
      return r;
    } finally {
      setAlertBusy(false);
    }
  };

  const toggleAlerts = async () => {
    if (alerts.on) {
      setAlertBusy(true);
      try {
        await disablePush();
        setAlerts({ ...alerts, on: false });
        flash(t("alerts.off"));
      } finally {
        setAlertBusy(false);
      }
      return;
    }
    const perm = notifPermission();
    if (ios && !standalone && perm !== "granted") return setSheet(true);
    if (perm === "default") return openPrimer();
    if (perm === "denied") return flash(t("alerts.denied"));
    if (perm === "unsupported") return flash(t("alerts.unsupported"));
    await activateAlerts();
  };

  const primerEnable = async () => {
    const r = await activateAlerts();
    setNotifPrompt((p) => ({ ...p, decision: r === "ok" ? "granted" : r === "denied" ? "denied" : p.decision }));
    setPrimerOpen(false);
  };

  const primerLater = () => {
    setNotifPrompt((p) => ({ ...p, decision: "later" }));
    setPrimerOpen(false);
  };

  const detailVenue = detail && detail.kind === "event" ? venueId(detail.city, detail.venueName) : null;

  const tabs: [Screen, string][] = [
    ["explore", t("tabs.explore")],
    ["favs", t("tabs.favs")],
    ["alerts", t("tabs.alerts")],
  ];

  return (
    <>
      <div className="relative min-h-0 flex-1">
        {screen === "explore" && (
          <div className="flex h-full flex-col">
            <div className="flex flex-none flex-col gap-3 border-b border-line bg-white px-4 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  setSearch(true);
                  setStep("when");
                }}
                className="flex w-full cursor-pointer items-center gap-3.5 rounded-full border border-border bg-white py-2.5 pr-2.5 pl-5 text-left text-ink shadow-[0_3px_14px_rgba(0,0,0,.08)]"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-[15px] leading-tight font-semibold">{pillTitle}</span>
                  <span className="truncate text-[13px] leading-tight text-muted">{pillSub}</span>
                </span>
                <span className="flex h-10 flex-none items-center rounded-full bg-sand px-3.5 text-[13px] leading-none font-semibold">
                  {t("explore.edit")}
                </span>
              </button>
              {view === "list" && (
                <div className="pb-3">
                  <ShortcutPills items={shortcutItems} />
                </div>
              )}
              <div className={`no-scrollbar -mx-4 gap-[22px] overflow-x-auto px-4 ${view === "map" ? "flex" : "hidden"}`}>
                {[{ id: "all", name: t("explore.all") }, ...prefs.cats.map((c) => ({ id: c, name: t(`categories.${c}.name`) }))].map((x) => {
                  const on = tab === x.id;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => setTab(x.id)}
                      aria-pressed={on}
                      className={`flex-none cursor-pointer border-0 border-b-2 bg-transparent px-0 pt-2 pb-3 text-[14px] leading-none font-semibold ${
                        on ? "border-ink text-ink" : "border-transparent text-[#77756F]"
                      }`}
                    >
                      {x.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {view === "list" ? (
              <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-20">
                {showBanner && (
                  <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-[14px] bg-sand py-3 pr-1.5 pl-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[14px] leading-[1.3] font-semibold">{t("explore.installTitle")}</span>
                      <span className="text-[12.5px] leading-[1.35] text-muted">{t("explore.installSub")}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => (installEvt ? installEvt.prompt().then(() => setInstallEvt(null)) : setSheet(true))}
                      className="h-10 cursor-pointer rounded-[10px] border-0 bg-ink px-3.5 text-[13px] leading-none font-semibold text-white"
                    >
                      {installEvt ? t("explore.installInstall") : t("explore.installHow")}
                    </button>
                    <button
                      type="button"
                      aria-label={t("explore.dismiss")}
                      onClick={() => setBannerHidden(true)}
                      className="h-11 w-9 cursor-pointer border-0 bg-transparent text-[20px] leading-none text-muted"
                    >
                      ×
                    </button>
                  </div>
                )}
                {(events == null || !editorial) && (
                  <div className="pt-4 pb-0.5">
                    <span className="text-[14px] leading-[1.3] font-semibold">
                      {events == null ? t("explore.loading") : t("explore.results", { n: evs.length })}
                    </span>
                  </div>
                )}
                {area?.status === "pending" && (
                  <div className="mt-3.5 flex flex-col gap-1 rounded-[14px] bg-accent-soft px-3.5 py-3">
                    <span className="text-[14px] leading-[1.3] font-semibold text-ink">{t("explore.preparingTitle", { city: area.name })}</span>
                    <span className="text-[12.5px] leading-[1.4] text-muted">{t("explore.preparingMsg")}</span>
                  </div>
                )}
                {events != null && !error && evs.length === 0 && places.length > 0 && (
                  <span className="block pt-2 text-[13px] leading-[1.4] text-muted">{t("explore.fewEvents")}</span>
                )}
                {!editorial && newN > 0 && (
                  <span className="block pt-1 text-[13px] leading-[1.3] font-medium text-accent">{t("explore.newSince", { n: newN })}</span>
                )}

                {editorial && events != null && !error && (endingSoon.length >= 2 || rows.length > 0) && (
                  <div className="flex flex-col gap-6 pt-4">
                    {endingSoon.length >= 2 && (
                      <EndingSoonRow events={endingSoon} isFav={isFav} onOpen={openDetail} onFav={toggleFav} onSeeAll={() => setFilter({ kind: "urgent" })} />
                    )}
                    {showTeaser && <QuickMatchTeaser count={qmAvailable.length} city={area?.name ?? ""} onPlay={() => setQmDeck(qmAvailable)} />}
                    {rows.map((r) => (
                      <CategoryRow
                        key={r.cat}
                        cat={r.cat}
                        events={r.events}
                        from={from}
                        isFav={isFav}
                        onOpen={openDetail}
                        onFav={toggleFav}
                        onSeeAll={() => setFilter({ kind: "cat", id: r.cat })}
                      />
                    ))}
                  </div>
                )}

                {error && (
                  <div className="flex flex-col items-center gap-2.5 px-2 py-12 text-center">
                    <span className="max-w-[280px] text-[14px] leading-[1.45] text-muted">{t("explore.error")}</span>
                    <button
                      type="button"
                      onClick={() => setReload((x) => x + 1)}
                      className="h-11 cursor-pointer rounded-[10px] border border-ink bg-white px-[18px] text-[14px] leading-none font-semibold"
                    >
                      {t("explore.retry")}
                    </button>
                  </div>
                )}

                {(!editorial || rows.length === 0) && groups.map((g) => (
                  <section key={g.key}>
                    <div className="flex items-baseline justify-between pt-[22px] pb-3">
                      <h2 className="m-0 text-[18px] leading-[1.2] font-semibold tracking-[-.01em]">{g.label}</h2>
                      <span className="text-[13px] leading-none text-muted">{g.sub}</span>
                    </div>
                    <div className={`flex flex-col ${cardVariant === "big" ? "gap-[26px]" : "gap-[18px]"}`}>
                      {g.items.map((e) => (
                        <EventCard
                          key={e.id}
                          e={e}
                          from={from}
                          isNew={isNew(e)}
                          isFav={isFav(e.id)}
                          onOpen={() => openDetail(e)}
                          onFav={() => toggleFav(e)}
                          variant={cardVariant}
                        />
                      ))}
                    </div>
                    {g.key === "places" && evs.length > 0 && g.total > ONGOING_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setPlacesOpen(!placesOpen)}
                        className="mt-4 h-11 w-full cursor-pointer rounded-[10px] border border-ink bg-white text-[14px] leading-none font-semibold"
                      >
                        {placesOpen ? t("explore.showLess") : t("explore.showAll", { n: g.total })}
                      </button>
                    )}
                    {g.key === "ongoing" && g.total > ONGOING_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setOngoingOpen(!ongoingOpen)}
                        className="mt-4 h-11 w-full cursor-pointer rounded-[10px] border border-ink bg-white text-[14px] leading-none font-semibold"
                      >
                        {ongoingOpen ? t("explore.showLess") : t("explore.showAll", { n: g.total })}
                      </button>
                    )}
                  </section>
                ))}
                {(!editorial || rows.length === 0) && hasMore && <div ref={sentinel} className="h-px" />}

                {events != null && !error && shown.length === 0 && area?.status !== "pending" && (
                  <div className="flex flex-col items-center gap-2.5 px-2 py-12 text-center">
                    <span className="text-[18px] leading-[1.3] font-semibold">{t("explore.emptyTitle")}</span>
                    <span className="max-w-[280px] text-[14px] leading-[1.45] text-muted">{t("explore.emptyMsg")}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const wk = shortcutRanges(today).find((r) => r.id === "week")!;
                        setPrefs({ from: wk.from, to: wk.to, moments: [] });
                        setFilter(null);
                        setNear(false);
                        setTab("all");
                      }}
                      className="mt-1.5 h-11 cursor-pointer rounded-[10px] border border-ink bg-white px-[18px] text-[14px] leading-none font-semibold"
                    >
                      {t("explore.widen")}
                    </button>
                  </div>
                )}

                {editorial ? (
                  <div className="mt-6">
                    <FreshnessFooter lastIngestedAt={area?.lastIngestedAt ?? null} sources={sourceNames.length} onHow={() => setHowOpen(true)} />
                  </div>
                ) : (
                  <p className="m-0 mt-7 text-center text-[12px] leading-normal text-subtle">
                    {t("explore.footer1")}
                    {sourceNames.length > 0 && (
                      <>
                        <br />
                        {t("explore.footer2", { sources: sourceNames.join(", ") })}
                      </>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <MapView
                events={shown}
                center={{ lat: area?.lat ?? 0, lng: area?.lng ?? 0 }}
                me={prefs.geo}
                from={from}
                isNew={isNew}
                isFav={isFav}
                onOpen={openDetail}
                onFav={toggleFav}
              />
            )}

            <button
              type="button"
              onClick={() => setView(view === "list" ? "map" : "list")}
              className="absolute bottom-4 left-1/2 z-[7] h-11 -translate-x-1/2 cursor-pointer rounded-full border-0 bg-ink px-5 text-[14px] leading-none font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,.25)]"
            >
              {view === "list" ? t("explore.map") : t("explore.list")}
            </button>
          </div>
        )}

        {screen === "favs" && (
          <Favorites
            favs={Object.values(favs)}
            onOpen={openDetail}
            onRemove={toggleFav}
            venues={Object.entries(follows).map(([id, f]) => ({ id, name: f.name }))}
            onOpenVenue={(v) => setVenue(v)}
            onUnfollow={(id) => {
              const f = follows[id];
              if (f) toggleVenue(id, f.name, f.city);
            }}
            flash={flash}
          />
        )}

        {screen === "alerts" && (
          <Alerts
            venues={Object.entries(follows).map(([id, f]) => ({ id, name: f.name }))}
            onOpenVenue={(id) => setVenue({ id, name: follows[id]?.name ?? "" })}
            onRemoveVenue={(id) => {
              const f = follows[id];
              if (f) toggleVenue(id, f.name, f.city);
            }}
            alerts={alerts}
            busy={alertBusy}
            title={pillTitle}
            sub={pillSub}
            notifText={t("alerts.notif", { n: Math.max(newN, 2), city: area?.name ?? "", range })}
            showIosHint={ios && !standalone}
            onToggle={toggleAlerts}
            onFreq={(freq) => setAlerts({ ...alerts, freq })}
            onHowTo={() => setSheet(true)}
            onMyData={openMyData}
          />
        )}

        {qmDeck && (
          <QuickMatch
            deck={qmDeck}
            canReplay={showTeaser}
            paused={!!detail || !!venue}
            onSwipe={onSwipe}
            onOpen={openDetail}
            onReplay={() => setQmDeck(qmAvailable)}
            onClose={closeQuickMatch}
          />
        )}

        {venue && (
          <VenuePage
            key={venue.id}
            id={venue.id}
            name={venue.name}
            from={from}
            following={isFollowing(venue.id)}
            alertsOn={alerts.on}
            isFav={isFav}
            onFav={toggleFav}
            onOpenEvent={openDetail}
            onFollow={() => {
              const city = venue.id.split("--")[0];
              toggleVenue(venue.id, follows[venue.id]?.name ?? venue.name, city);
            }}
            onAlerts={() => {
              if (!alerts.on) return void toggleAlerts();
              setDetail(null);
              setVenue(null);
              setScreen("alerts");
            }}
            onClose={() => setVenue(null)}
          />
        )}

        {detail && (
          <EventDetail
            e={detail}
            isNew={isNew(detail)}
            isFav={isFav(detail.id)}
            onClose={() => setDetail(null)}
            onFav={() => toggleFav(detail)}
            flash={flash}
            venueUpcoming={
              detail.venueName && events
                ? events.filter((x) => x.kind === "event" && x.venueName?.toLowerCase() === detail.venueName!.toLowerCase()).length
                : null
            }
            onOpenVenue={detailVenue ? () => setVenue({ id: detailVenue, name: detail.venueName! }) : undefined}
            venueFollowing={!!detailVenue && isFollowing(detailVenue)}
            onFollowVenue={detailVenue ? () => toggleVenue(detailVenue, detail.venueName!, detail.city!) : undefined}
          />
        )}

        {search && (
          <SearchSheet
            prefs={{ ...prefs, from, to }}
            setPrefs={setPrefs}
            step={step}
            setStep={setStep}
            today={today}
            count={events ? events.length : null}
            onClose={() => area && setSearch(false)}
            onRun={() => {
              setSearch(false);
              setView("list");
              setTab("all");
            }}
            onGeo={onGeo}
            onPickPlace={(p) => pickPlace(p)}
            recent={recent}
            onPickArea={(a) => chooseArea(a)}
            busy={areaBusy}
            flash={flash}
          />
        )}

        {sheet && <InstallSheet ios={ios} onClose={() => setSheet(false)} />}
        {howOpen && (
          <InfoSheet title={t("home.howWeChooseTitle")} text={t("home.howWeChooseText")} ok={t("home.gotIt")} onClose={() => setHowOpen(false)} />
        )}
        {profileUi?.kind === "invite" && (
          <ProfileInvite
            variant={profileUi.variant}
            onLater={deferProfile}
            onStart={() => setProfileUi({ kind: "flow", editing: profileUi.variant === "edit" })}
          />
        )}
        {profileUi?.kind === "flow" && (
          <ProfileFlow
            initialAge={profile.ageRange}
            initialGender={profile.gender}
            busy={profileBusy}
            editing={profileUi.editing && profile.consent}
            onClose={deferProfile}
            onFinish={finishProfile}
            onWithdraw={withdrawProfile}
          />
        )}
        {primerOpen && <NotifPrimer city={area?.name ?? ""} busy={alertBusy} onEnable={primerEnable} onLater={primerLater} />}
        <Toast text={toast} />
      </div>

      {!detail && !venue && !qmDeck && !search && profileUi?.kind !== "flow" && !primerOpen && (
        <nav className="grid flex-none grid-cols-3 border-t border-line bg-white px-2 pt-1.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          {tabs.map(([id, name]) => {
            const on = screen === id;
            const badge = id === "favs" && favIds.length ? String(favIds.length) : "";
            return (
              <button
                key={id}
                type="button"
                onClick={() => setScreen(id)}
                aria-current={on ? "page" : undefined}
                className={`relative flex h-[50px] cursor-pointer flex-col items-center justify-center gap-[5px] border-0 bg-transparent ${on ? "text-ink" : "text-subtle"}`}
              >
                <span className={`h-[5px] w-[5px] rounded-full ${on ? "bg-accent" : "bg-transparent"}`} />
                <span className="text-[13px] leading-none font-semibold">{name}</span>
                {badge && (
                  <span className="absolute top-1.5 left-[calc(50%+18px)] h-[18px] min-w-[18px] rounded-[9px] bg-accent px-[5px] text-[11px] leading-[18px] font-semibold text-white">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

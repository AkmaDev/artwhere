import assert from "node:assert/strict";
import { test } from "node:test";
import { addSeen, buildDeck, isTasteScores, rankRows, recordSwipe, SEEN_MAX } from "./taste";
import type { EventItem } from "./types";

const NOW = new Date("2026-10-16T10:00:00Z");
let n = 0;
function ev(over: Partial<EventItem> = {}): EventItem {
  n++;
  return {
    id: `id${n}`,
    kind: "event",
    timezone: "Europe/Paris",
    currency: "EUR",
    title: `E${n}`,
    description: null,
    imageUrl: "https://x/img.jpg",
    categories: ["concert"],
    startAt: "2026-10-30T19:00:00Z",
    endAt: "2026-10-30T21:00:00Z",
    nextAt: `2026-10-30T19:${String(n % 60).padStart(2, "0")}:00Z`,
    allDay: false,
    hoursText: null,
    durationText: null,
    venueName: null,
    address: null,
    lat: null,
    lng: null,
    priceMin: null,
    priceMax: null,
    status: "available",
    ticketUrl: null,
    officialUrl: null,
    firstDetectedAt: "2026-10-01T00:00:00Z",
    lastCheckedAt: "2026-10-16T00:00:00Z",
    sources: [],
    distanceKm: null,
    ...over,
  };
}

test("Garder +2, Passer −1, favori +1, bornés entre −10 et +20", () => {
  let s = recordSwipe({}, ["concert", "danse"], "keep");
  assert.deepEqual(s, { concert: 2, danse: 2 });
  s = recordSwipe(s, ["concert"], "pass");
  s = recordSwipe(s, ["concert"], "fav");
  assert.equal(s.concert, 2);
  for (let i = 0; i < 20; i++) s = recordSwipe(s, ["expo"], "keep");
  assert.equal(s.expo, 20);
  for (let i = 0; i < 40; i++) s = recordSwipe(s, ["expo"], "pass");
  assert.equal(s.expo, -10);
});

test("déjà vus : 300 derniers, sans doublon", () => {
  let seen: string[] = [];
  for (let i = 0; i < 310; i++) seen = addSeen(seen, `e${i}`);
  seen = addSeen(seen, "e309");
  assert.equal(seen.length, SEEN_MAX);
  assert.equal(seen[0], "e10");
  assert.equal(seen.at(-1), "e309");
});

test("paquet : exclut favoris, vus, complets ; 3 par catégorie ; sans image en dernier", () => {
  const fav = ev();
  const seen = ev();
  const full = ev({ status: "full" });
  const concerts = [ev(), ev(), ev(), ev()];
  const noImg = ev({ categories: ["expo"], imageUrl: null });
  const theatre = ev({ categories: ["theatre"] });
  const place = ev({ kind: "place", categories: ["musee"] });
  const deck = buildDeck([fav, seen, full, ...concerts, noImg, theatre, place], {
    favIds: new Set([fav.id]),
    seen: new Set([seen.id]),
    now: NOW,
  });
  const ids = deck.map((e) => e.id);
  assert.ok(!ids.includes(fav.id) && !ids.includes(seen.id) && !ids.includes(full.id) && !ids.includes(place.id));
  assert.equal(deck.filter((e) => e.categories[0] === "concert").length, 3);
  assert.equal(ids.at(-1), noImg.id);
  assert.equal(deck.length, 5);
});

test("rangées : score de goût puis nombre d'événements", () => {
  const rows = [
    { cat: "concert", events: [1, 2, 3] },
    { cat: "danse", events: [1] },
    { cat: "expo", events: [1, 2] },
  ];
  assert.deepEqual(rankRows(rows, { danse: 4 }).map((r) => r.cat), ["danse", "concert", "expo"]);
});

test("validation des scores reçus", () => {
  assert.equal(isTasteScores({ concert: 4, danse: -2 }), true);
  assert.equal(isTasteScores({ inconnu: 1 }), false);
  assert.equal(isTasteScores({ concert: 99 }), false);
  assert.equal(isTasteScores({ concert: 1.5 }), false);
  assert.equal(isTasteScores([]), false);
});

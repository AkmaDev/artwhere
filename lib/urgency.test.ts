import assert from "node:assert/strict";
import { test } from "node:test";
import { getUrgency } from "./urgency";

const TZ = "Europe/Paris";
// Jeudi 15 octobre 2026, 10h à Paris (UTC+2).
const NOW = new Date("2026-10-15T08:00:00Z");

function ev(over: Partial<Parameters<typeof getUrgency>[0]> = {}) {
  return {
    kind: "event" as const,
    status: "available" as const,
    startAt: "2026-10-15T18:00:00Z",
    endAt: "2026-10-15T20:00:00Z",
    nextAt: "2026-10-15T18:00:00Z",
    allDay: false,
    timezone: TZ,
    ...over,
  };
}

test("dernières places", () => {
  assert.deepEqual(getUrgency(ev({ status: "almost_full", startAt: "2026-10-20T18:00:00Z", endAt: "2026-10-20T20:00:00Z", nextAt: "2026-10-20T18:00:00Z" }), NOW), { key: "lastSeats" });
});

test("ce soir (après 17h, ponctuel)", () => {
  assert.deepEqual(getUrgency(ev(), NOW), { key: "tonight" });
});

test("ce soir + dernières places", () => {
  assert.deepEqual(getUrgency(ev({ status: "almost_full" }), NOW), { key: "tonight", lastSeats: true });
});

test("aujourd'hui mais avant 17h : pas d'urgence", () => {
  assert.equal(getUrgency(ev({ startAt: "2026-10-15T12:00:00Z", endAt: "2026-10-15T14:00:00Z", nextAt: "2026-10-15T12:00:00Z" }), NOW), null);
});

test("se termine aujourd'hui (plusieurs jours)", () => {
  assert.deepEqual(getUrgency(ev({ allDay: true, startAt: "2026-09-01T08:00:00Z", endAt: "2026-10-15T16:00:00Z", nextAt: "2026-10-15T08:00:00Z" }), NOW), { key: "endsToday" });
});

test("se termine demain", () => {
  assert.deepEqual(getUrgency(ev({ allDay: true, startAt: "2026-09-01T08:00:00Z", endAt: "2026-10-16T16:00:00Z" }), NOW), { key: "endsTomorrow" });
});

test("plus que 2 et 3 jours", () => {
  assert.deepEqual(getUrgency(ev({ allDay: true, startAt: "2026-09-01T08:00:00Z", endAt: "2026-10-17T16:00:00Z" }), NOW), { key: "daysLeft", days: 2 });
  assert.deepEqual(getUrgency(ev({ allDay: true, startAt: "2026-09-01T08:00:00Z", endAt: "2026-10-18T16:00:00Z" }), NOW), { key: "daysLeft", days: 3 });
});

test("4 jours ou plus : pas d'urgence", () => {
  assert.equal(getUrgency(ev({ allDay: true, startAt: "2026-09-01T08:00:00Z", endAt: "2026-10-19T16:00:00Z" }), NOW), null);
});

test("à cheval sur minuit (22h-1h) : « ce soir », pas « se termine demain »", () => {
  assert.deepEqual(getUrgency(ev({ startAt: "2026-10-15T20:00:00Z", endAt: "2026-10-15T23:00:00Z", nextAt: "2026-10-15T20:00:00Z" }), NOW), { key: "tonight" });
});

test("fin à minuit pile = fin la veille", () => {
  // Fin le 16 à 00h00 heure de Paris (15 à 22h UTC) : se termine aujourd'hui.
  assert.deepEqual(getUrgency(ev({ allDay: true, startAt: "2026-09-01T08:00:00Z", endAt: "2026-10-15T22:00:00Z" }), NOW), { key: "endsToday" });
});

test("événement passé ou lieu : jamais", () => {
  assert.equal(getUrgency(ev({ endAt: "2026-10-14T20:00:00Z", startAt: "2026-10-14T18:00:00Z" }), NOW), null);
  assert.equal(getUrgency(ev({ kind: "place" }), NOW), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { onDay, onWeekend } from "./shortcuts";

const TZ = "Europe/Paris";
const base = { allDay: false, timezone: TZ, priceMin: null };
// Jeudi 15 octobre 2026 ; week-end = 17-18 octobre.
const TODAY = "2026-10-15";

test("aujourd'hui : séance du jour, expo en cours", () => {
  assert.equal(onDay({ ...base, startAt: "2026-10-15T18:00:00Z", endAt: "2026-10-15T20:00:00Z", nextAt: "2026-10-15T18:00:00Z" }, TODAY), true);
  assert.equal(onDay({ ...base, allDay: true, startAt: "2026-09-01T08:00:00Z", endAt: "2026-11-01T17:00:00Z", nextAt: "2026-10-15T08:00:00Z" }, TODAY), true);
  assert.equal(onDay({ ...base, startAt: "2026-10-16T18:00:00Z", endAt: "2026-10-16T20:00:00Z", nextAt: "2026-10-16T18:00:00Z" }, TODAY), false);
});

test("week-end : samedi oui, vendredi soir oui, vendredi midi non, mercredi suivant non", () => {
  const at = (iso: string) => ({ ...base, startAt: iso, endAt: iso, nextAt: iso });
  assert.equal(onWeekend(at("2026-10-17T15:00:00Z"), TODAY), true);
  assert.equal(onWeekend(at("2026-10-16T18:30:00Z"), TODAY), true); // vendredi 20h30 Paris
  assert.equal(onWeekend(at("2026-10-16T10:00:00Z"), TODAY), false); // vendredi midi
  assert.equal(onWeekend(at("2026-10-21T18:00:00Z"), TODAY), false);
});

test("week-end : expo qui couvre le samedi", () => {
  assert.equal(onWeekend({ ...base, allDay: true, startAt: "2026-10-01T08:00:00Z", endAt: "2026-10-17T16:00:00Z", nextAt: "2026-10-15T08:00:00Z" }, TODAY), true);
});

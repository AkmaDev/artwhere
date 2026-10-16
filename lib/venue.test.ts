import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVenueId, venueId, venueKey } from "./venue";

test("identifiant de lieu réversible", () => {
  const id = venueId("paris", "Le Sunside");
  assert.equal(id, "paris--sunside");
  assert.deepEqual(parseVenueId(id!), { city: "paris", norm: "sunside" });
  assert.equal(venueKey(id!), "paris|sunside");
});

test("nom à plusieurs mots, ville à tiret", () => {
  const id = venueId("cotonou-bj", "Centre Culturel Artisttik Africa");
  assert.equal(id, "cotonou-bj--centre culturel artisttik africa".replace(/ /g, "-"));
  assert.deepEqual(parseVenueId(id!), { city: "cotonou-bj", norm: "centre culturel artisttik africa" });
});

test("entrées invalides", () => {
  assert.equal(venueId(null, "Sunside"), null);
  assert.equal(venueId("paris", null), null);
  assert.equal(parseVenueId("paris"), null);
  assert.equal(parseVenueId("paris--Sun side"), null);
});

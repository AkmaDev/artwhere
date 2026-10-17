import assert from "node:assert/strict";
import { test } from "node:test";
import { pickDistrict, pickStreet, placeLabel } from "./neighborhood";

// Réponse réelle de Photon rue Rambuteau (16/10/2026).
const RAMBUTEAU = { type: "house", name: "Le kiosque de Paris", street: "Rue Rambuteau", district: "Paris", locality: "Quartier Saint-Merri", city: "Paris", postcode: "75004" };

test("Paris : district = ville ignoré, quartier tiré de locality", () => {
  assert.equal(pickDistrict(RAMBUTEAU), "Saint-Merri");
  assert.equal(pickDistrict({ locality: "Quartier de la Sorbonne", city: "Paris" }), "Sorbonne");
  assert.equal(pickDistrict({ district: "Le Marais", city: "Paris" }), "Le Marais");
  assert.equal(pickDistrict({ district: "Lyon", city: "Lyon" }), null);
});

test("rue : champ street, ou nom d'un résultat de type rue", () => {
  assert.equal(pickStreet(RAMBUTEAU), "Rue Rambuteau");
  assert.equal(pickStreet({ type: "street", name: "Boulevard Voltaire" }), "Boulevard Voltaire");
  assert.equal(pickStreet({ type: "house", name: "Kiosque" }), null);
});

test("libellé : rue + arrondissement, sinon quartier", () => {
  const base = { lat: 0, lng: 0 };
  assert.equal(placeLabel({ ...base, street: "Rue Rambuteau", district: "Saint-Merri", postcode: "75004" }), "Rue Rambuteau, 4e");
  assert.equal(placeLabel({ ...base, district: "Saint-Merri", postcode: "75004" }), "Saint-Merri, 4e");
  assert.equal(placeLabel({ ...base, postcode: "75001" }), "1er");
  assert.equal(placeLabel({ ...base }), null);
});

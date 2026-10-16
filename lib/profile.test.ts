import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PROFILE, DEFAULT_PROFILE_PROMPT, deferInvite, shouldInvite } from "./profile";

test("1er favori → invitation ; « Plus tard » → rien au 2e, invitation au 3e, plus rien au 4e", () => {
  let p = DEFAULT_PROFILE_PROMPT;
  assert.equal(shouldInvite(p, DEFAULT_PROFILE, 1), true);
  p = deferInvite(p, 1);
  assert.equal(shouldInvite(p, DEFAULT_PROFILE, 2), false);
  assert.equal(shouldInvite(p, DEFAULT_PROFILE, 3), true);
  p = deferInvite(p, 3);
  assert.equal(p.done, true);
  assert.equal(shouldInvite(p, DEFAULT_PROFILE, 4), false);
});

test("jamais si le profil a été rempli", () => {
  assert.equal(shouldInvite(DEFAULT_PROFILE_PROMPT, { ...DEFAULT_PROFILE, answeredAt: "2026-10-16T10:00:00Z" }, 1), false);
});

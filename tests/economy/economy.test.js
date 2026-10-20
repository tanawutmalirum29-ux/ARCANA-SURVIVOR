import test from "node:test";
import assert from "node:assert/strict";
import {
  createEconomyState, applyEconomyCommand, hydrateEconomyState,
  validateEconomyState, MAX_EARNED_BALANCE
} from "../../src/economy/index.js";
import { FREE_COSMETICS, FREE_SHOP_OFFERS, CRAFT_RECIPES } from "../../src/content/economy/catalog.js";

const cmd = (type, name, extra = {}) => ({
  type, idempotencyKey: "test:" + name, sourceRef: "test:fixture", ...extra
});
const perform = (state, type, name, extra = {}) =>
  applyEconomyCommand(state, cmd(type, name, extra));
function funded(gold = 1000, dust = 250) {
  let state = createEconomyState();
  state = perform(state, "EARN_GOLD", "seed-gold", { amount: gold }).state;
  state = perform(state, "EARN_DUST", "seed-dust", { amount: dust }).state;
  return state;
}

test("new wallet is versioned, empty and JSON serializable", () => {
  const s = createEconomyState();
  assert.equal(s.schema_version, 1);
  assert.deepEqual(s.balances, { gold: 0, dust: 0 });
  assert.deepEqual(s.inventory, []);
  assert.deepEqual(s.rewardClaims, []);
  assert.equal(validateEconomyState(s), null);
  assert.deepEqual(hydrateEconomyState(JSON.stringify(s)), { state: s, status: "LOADED" });
});

test("gold/dust earns, spending and immutable input", () => {
  const initial = createEconomyState();
  const earn = perform(initial, "EARN_GOLD", "run-1", { amount: 200 });
  assert.equal(earn.result.ok, true);
  assert.equal(earn.state.balances.gold, 200);
  assert.equal(initial.balances.gold, 0);
  const dust = perform(earn.state, "EARN_DUST", "boss-1", { amount: 40 });
  const spend = perform(dust.state, "SPEND_GOLD", "sink-1", { amount: 75 });
  assert.deepEqual(spend.state.balances, { gold: 125, dust: 40 });
  assert.equal(spend.state.ledger.length, 3);
  assert.equal(validateEconomyState(spend.state), null);
});

test("exact replay is idempotent after JSON save/reload", () => {
  const initial = createEconomyState();
  const command = cmd("EARN_GOLD", "run:loot-10", { amount: 45 });
  const first = applyEconomyCommand(initial, command);
  const loaded = hydrateEconomyState(JSON.stringify(first.state));
  const replay = applyEconomyCommand(loaded.state, command);
  assert.equal(replay.result.code, "ALREADY_APPLIED");
  assert.strictEqual(replay.state, loaded.state);
  assert.equal(replay.state.balances.gold, 45);
  assert.equal(replay.state.ledger.length, 1);
});

test("same key cannot grant another reward or charge again", () => {
  const s = funded();
  const spent = perform(s, "SPEND_GOLD", "checkout", { amount: 50 });
  const replay = perform(spent.state, "EARN_GOLD", "checkout", { amount: 9000 });
  assert.equal(replay.result.code, "ALREADY_APPLIED");
  assert.deepEqual(replay.state, spent.state);
});

test("insufficient balance leaves state untouched", () => {
  const initial = createEconomyState();
  for (const type of ["SPEND_GOLD", "CRAFT_COSMETIC", "BUY_FREE_COSMETIC"]) {
    const arg = type === "SPEND_GOLD" ? { amount: 1 } :
      type === "CRAFT_COSMETIC" ? { recipeId: "recipe_starfall_crown" } :
      { offerId: "offer_ember_trail" };
    const r = perform(initial, type, type, arg);
    assert.equal(r.result.code, "INSUFFICIENT_BALANCE");
    assert.strictEqual(r.state, initial);
  }
});

test("free shop purchase is priced from catalog rather than client", () => {
  const initial = funded();
  const r = perform(initial, "BUY_FREE_COSMETIC", "shop-1", {
    offerId: "offer_ember_trail", price: 0, gold: 0, paid: true
  });
  assert.equal(r.result.ok, true);
  assert.equal(r.state.balances.gold, 860);
  assert.deepEqual(r.state.inventory, ["cosmetic_ember_trail"]);
  assert.equal(perform(r.state, "BUY_FREE_COSMETIC", "shop-2",
    { offerId: "offer_ember_trail" }).result.code, "ALREADY_OWNED");
});

test("crafting mythical cosmetics has a free earning path", () => {
  const initial = funded();
  const r = perform(initial, "CRAFT_COSMETIC", "craft-mythic",
    { recipeId: "recipe_starfall_crown" });
  assert.deepEqual(r.state.balances, { gold: 100, dust: 70 });
  assert.ok(r.state.inventory.includes("cosmetic_starfall_crown"));
  assert.equal(FREE_COSMETICS.cosmetic_starfall_crown.rarity, "mythic");
  assert.equal(r.result.cosmeticId, "cosmetic_starfall_crown");
  assert.equal(validateEconomyState(r.state), null);
  assert.equal(perform(r.state, "CRAFT_COSMETIC", "craft-again",
    { recipeId: "recipe_starfall_crown" }).result.code, "ALREADY_OWNED");
});

test("same cosmetic can be crafted or bought, but never bought twice", () => {
  let s = funded();
  s = perform(s, "CRAFT_COSMETIC", "craft-aura",
    { recipeId: "recipe_moonlit_aura" }).state;
  assert.equal(perform(s, "BUY_FREE_COSMETIC", "shop-aura",
    { offerId: "offer_moonlit_aura" }).result.code, "ALREADY_OWNED");
});

test("reward grants deduplicate; duplicated cosmetic converts to dust once", () => {
  let s = funded();
  const reward = cmd("GRANT_REWARD", "achievement-1", {
    rewardType: "cosmetic", cosmeticId: "cosmetic_ember_trail"
  });
  s = applyEconomyCommand(s, reward).state;
  assert.equal(s.inventory.length, 1);
  assert.ok(s.rewardClaims.includes(reward.idempotencyKey));
  const duplicate = perform(s, "GRANT_REWARD", "achievement-2", {
    rewardType: "cosmetic", cosmeticId: "cosmetic_ember_trail"
  });
  assert.equal(duplicate.result.duplicateConverted, true);
  assert.equal(duplicate.state.balances.dust, 262);
  assert.equal(perform(duplicate.state, "GRANT_REWARD", "achievement-2", {
    rewardType: "cosmetic", cosmeticId: "cosmetic_ember_trail"
  }).result.code, "ALREADY_APPLIED");
});

test("event-style intents grant earned gold and dust, not premium", () => {
  let s = createEconomyState();
  const gold = perform(s, "GRANT_REWARD", "event:level-1",
    { rewardType: "gold", amount: 30 });
  s = gold.state;
  s = perform(s, "GRANT_REWARD", "event:boss-1",
    { rewardType: "dust", amount: 15 }).state;
  assert.deepEqual(s.balances, { gold: 30, dust: 15 });
  assert.equal(s.rewardClaims.length, 2);
  assert.equal(perform(s, "GRANT_REWARD", "premium",
    { rewardType: "astral_gems", amount: 100 }).result.code, "INVALID_REWARD");
});

test("bad amounts, unknown offers and commands are rejected", () => {
  const s = createEconomyState();
  for (const amount of [0, -1, 1.1, NaN, Infinity, "10", null, 1_000_001]) {
    assert.equal(perform(s, "EARN_GOLD", "bad", { amount }).result.code, "INVALID_AMOUNT");
  }
  assert.equal(perform(s, "CRAFT_COSMETIC", "bad2",
    { recipeId: "__proto__" }).result.code, "UNKNOWN_OFFER");
  assert.equal(perform(s, "BUY_FREE_COSMETIC", "bad3",
    { offerId: "fake" }).result.code, "UNKNOWN_OFFER");
  assert.equal(perform(s, "PAID_CHECKOUT", "bad4", { amount: 100 }).result.code,
    "INVALID_COMMAND");
  assert.equal(applyEconomyCommand(s, { type: "EARN_GOLD", amount: 5 }).result.code,
    "INVALID_COMMAND");
});

test("balance overflow rejects without applying a key", () => {
  let s = createEconomyState();
  for (let i = 0; i < 1000; i++) {
    s = perform(s, "EARN_GOLD", "bulk-" + i, { amount: 1_000_000 }).state;
  }
  assert.equal(s.balances.gold, MAX_EARNED_BALANCE);
  const x = perform(s, "EARN_GOLD", "overflow", { amount: 1 });
  assert.equal(x.result.code, "BALANCE_OVERFLOW");
  assert.strictEqual(x.state, s);
});

test("invalid, corrupted, unsupported or paid-looking saves never grant items", () => {
  for (const raw of [
    "not json", null, "null", "[]",
    JSON.stringify({ schema_version: 99, balances: { gold: 3000 } }),
    JSON.stringify({ ...createEconomyState(), balances: { gold: -5, dust: 2 } }),
    JSON.stringify({ ...createEconomyState(), inventory: ["cosmetic_paid_unknown"] }),
    JSON.stringify({ ...createEconomyState(), paid: true, rewardClaims: ["fake"] }),
    JSON.stringify({ ...createEconomyState(), ledger: [{ money: "fake" }] })
  ]) {
    const result = hydrateEconomyState(raw);
    assert.equal(result.status, "CORRUPT_RESET");
    assert.deepEqual(result.state, createEconomyState());
  }
});

test("legacy v0 explicitly migrates only free items/balances", () => {
  const legacy = {
    schema_version: 0, gold: 500, dust: 4,
    unlocked_free_cosmetics: ["cosmetic_ember_trail"],
    owned_premium_cosmetics: ["cosmetic_paid_unknown"]
  };
  const r = hydrateEconomyState(JSON.stringify(legacy));
  assert.equal(r.status, "MIGRATED_V0");
  assert.equal(r.state.schema_version, 1);
  assert.deepEqual(r.state.inventory, ["cosmetic_ember_trail"]);
  assert.equal(r.state.appliedKeys.length, 0);
  assert.equal(hydrateEconomyState({
    ...legacy, unlocked_free_cosmetics: ["cosmetic_unknown"]
  }).status, "CORRUPT_RESET");
});

test("stat and paid fields in commands never become cosmetic state", () => {
  const s = funded();
  const r = perform(s, "GRANT_REWARD", "visual-only", {
    rewardType: "cosmetic", cosmeticId: "cosmetic_starfall_crown",
    hp: 999, attack: 100, crit: 100, paid: true
  });
  assert.equal(r.result.ok, true);
  assert.equal(JSON.stringify(r.state).includes("999"), false);
  assert.equal(JSON.stringify(r.state).includes('"attack"'), false);
  for (const product of Object.values(FREE_COSMETICS)) {
    assert.equal(product.availability, "earned_only");
    for (const key of ["hp", "attack", "crit", "cooldown", "damage", "stat_bonus"]) {
      assert.equal(key in product, false);
    }
  }
});

test("catalog entries reference known free cosmetics with positive recipe costs", () => {
  for (const table of [FREE_SHOP_OFFERS, CRAFT_RECIPES]) {
    for (const entry of Object.values(table)) {
      assert.ok(FREE_COSMETICS[entry.cosmetic_id]);
      assert.ok(Number.isInteger(entry.cost.gold) && entry.cost.gold >= 0);
      assert.ok(Number.isInteger(entry.cost.dust) && entry.cost.dust >= 0);
      assert.ok(entry.cost.gold + entry.cost.dust > 0);
    }
  }
});

test("pure reducer returns no mutation on invalid saved state", () => {
  const state = { ...createEconomyState(), inventory: ["unknown"] };
  const snapshot = JSON.stringify(state);
  const r = perform(state, "EARN_GOLD", "bad-state", { amount: 5 });
  assert.equal(r.result.code, "INVALID_INVENTORY");
  assert.strictEqual(r.state, state);
  assert.equal(JSON.stringify(state), snapshot);
});

test("key validation is bounded and catalog is not vulnerable to prototype IDs", () => {
  const s = funded();
  for (const key of ["", "two words", "../path", "x".repeat(170)]) {
    const r = applyEconomyCommand(s, {
      type: "EARN_GOLD", idempotencyKey: key, sourceRef: "test:fixture", amount: 10
    });
    assert.equal(r.result.code, "INVALID_COMMAND");
  }
});

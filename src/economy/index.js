import { FREE_COSMETICS, FREE_SHOP_OFFERS, CRAFT_RECIPES } from "../content/economy/catalog.js";

export const ECONOMY_SCHEMA_VERSION = 1;
export const MAX_EARNED_BALANCE = 1_000_000_000;
const MAX_AMOUNT = 1_000_000;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_./-]{0,159}$/;

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value);
const validAmount = value => Number.isSafeInteger(value) && value > 0 && value <= MAX_AMOUNT;
const validBalance = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_EARNED_BALANCE;
const validKey = value => typeof value === "string" && KEY_PATTERN.test(value);
const validSource = value => validKey(value);
const knownCosmetic = id => typeof id === "string" && own(FREE_COSMETICS, id);
const uniqueStrings = (value, check) =>
  Array.isArray(value) && value.every(check) && new Set(value).size === value.length;

export function createEconomyState() {
  return {
    schema_version: ECONOMY_SCHEMA_VERSION,
    balances: { gold: 0, dust: 0 },
    inventory: [],
    rewardClaims: [],
    appliedKeys: [],
    ledger: []
  };
}

// Returns an error code, or null if the local-demo snapshot is well formed.
// This is not a server authorization check or proof of a legitimate reward.
export function validateEconomyState(state) {
  if (!plain(state) || state.schema_version !== ECONOMY_SCHEMA_VERSION) return "UNSUPPORTED_SCHEMA";
  if (!plain(state.balances) || !validBalance(state.balances.gold) ||
      !validBalance(state.balances.dust)) return "INVALID_BALANCE";
  if (!uniqueStrings(state.inventory, knownCosmetic)) return "INVALID_INVENTORY";
  if (!uniqueStrings(state.rewardClaims, validKey)) return "INVALID_CLAIMS";
  if (!uniqueStrings(state.appliedKeys, validKey)) return "INVALID_KEYS";
  if (!state.rewardClaims.every(key => state.appliedKeys.includes(key))) return "INVALID_CLAIMS";
  if (!Array.isArray(state.ledger) || !state.ledger.every(entry =>
    plain(entry) && validKey(entry.ledger_id) && validKey(entry.idempotency_key) &&
    validSource(entry.source_ref) && typeof entry.reason === "string" &&
    ["gold", "dust", "cosmetic"].includes(entry.currency) &&
    Number.isSafeInteger(entry.delta) && Math.abs(entry.delta) <= MAX_EARNED_BALANCE &&
    state.appliedKeys.includes(entry.idempotency_key)
  )) return "INVALID_LEDGER";
  if (new Set(state.ledger.map(entry => entry.ledger_id)).size !== state.ledger.length) {
    return "INVALID_LEDGER";
  }
  return null;
}

// Parse an untrusted local save. Corruption resets explicitly rather than granting items.
// Legacy v0 accepts only earned balances and already-known free cosmetic IDs.
export function hydrateEconomyState(raw) {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!plain(value)) return { state: createEconomyState(), status: "CORRUPT_RESET" };
    if (value.schema_version === 0) {
      const gold = value.gold ?? 0;
      const dust = value.dust ?? 0;
      const inventory = value.unlocked_free_cosmetics ?? [];
      if (!validBalance(gold) || !validBalance(dust) ||
          !uniqueStrings(inventory, knownCosmetic)) {
        return { state: createEconomyState(), status: "CORRUPT_RESET" };
      }
      return {
        state: { ...createEconomyState(), balances: { gold, dust }, inventory: [...inventory] },
        status: "MIGRATED_V0"
      };
    }
    if (validateEconomyState(value) !== null) {
      return { state: createEconomyState(), status: "CORRUPT_RESET" };
    }
    return {
      state: {
        schema_version: ECONOMY_SCHEMA_VERSION,
        balances: { ...value.balances },
        inventory: [...value.inventory],
        rewardClaims: [...value.rewardClaims],
        appliedKeys: [...value.appliedKeys],
        ledger: value.ledger.map(entry => ({ ...entry }))
      },
      status: "LOADED"
    };
  } catch {
    return { state: createEconomyState(), status: "CORRUPT_RESET" };
  }
}

function rejected(state, code) {
  return { state, result: { ok: false, code } };
}

function costFor(command) {
  const table = command.type === "CRAFT_COSMETIC" ? CRAFT_RECIPES : FREE_SHOP_OFFERS;
  const id = command.type === "CRAFT_COSMETIC" ? command.recipeId : command.offerId;
  if (!validKey(id) || !own(table, id)) return null;
  const { cosmetic_id, cost } = table[id];
  if (!knownCosmetic(cosmetic_id)) return null;
  return { cosmeticId: cosmetic_id, cost };
}

// Pure local prototype reducer. The caller must validate gameplay/event progress.
// All commands (including spending) require a stable, unique key across reloads.
export function applyEconomyCommand(state, command) {
  const stateError = validateEconomyState(state);
  if (stateError) return rejected(state, stateError);
  if (!plain(command) || !validKey(command.idempotencyKey) ||
      !validSource(command.sourceRef)) return rejected(state, "INVALID_COMMAND");
  if (state.appliedKeys.includes(command.idempotencyKey)) {
    return { state, result: { ok: true, code: "ALREADY_APPLIED", duplicate: true } };
  }

  let gold = 0;
  let dust = 0;
  let cosmeticId = null;
  let rewardClaim = false;
  let duplicateConverted = false;
  switch (command.type) {
    case "EARN_GOLD":
      if (!validAmount(command.amount)) return rejected(state, "INVALID_AMOUNT");
      gold = command.amount;
      break;
    case "EARN_DUST":
      if (!validAmount(command.amount)) return rejected(state, "INVALID_AMOUNT");
      dust = command.amount;
      break;
    case "SPEND_GOLD":
      if (!validAmount(command.amount)) return rejected(state, "INVALID_AMOUNT");
      gold = -command.amount;
      break;
    case "GRANT_REWARD":
      rewardClaim = true;
      if (command.rewardType === "gold" || command.rewardType === "dust") {
        if (!validAmount(command.amount)) return rejected(state, "INVALID_AMOUNT");
        if (command.rewardType === "gold") gold = command.amount;
        else dust = command.amount;
      } else if (command.rewardType === "cosmetic") {
        if (!knownCosmetic(command.cosmeticId)) return rejected(state, "INVALID_COSMETIC");
        if (state.inventory.includes(command.cosmeticId)) {
          duplicateConverted = true;
          dust = FREE_COSMETICS[command.cosmeticId].duplicate_dust;
        } else {
          cosmeticId = command.cosmeticId;
        }
      } else {
        return rejected(state, "INVALID_REWARD");
      }
      break;
    case "CRAFT_COSMETIC":
    case "BUY_FREE_COSMETIC": {
      const item = costFor(command);
      if (!item) return rejected(state, "UNKNOWN_OFFER");
      if (state.inventory.includes(item.cosmeticId)) return rejected(state, "ALREADY_OWNED");
      cosmeticId = item.cosmeticId;
      gold = -item.cost.gold;
      dust = -item.cost.dust;
      break;
    }
    default:
      return rejected(state, "INVALID_COMMAND");
  }

  const nextGold = state.balances.gold + gold;
  const nextDust = state.balances.dust + dust;
  if (nextGold < 0 || nextDust < 0) return rejected(state, "INSUFFICIENT_BALANCE");
  if (!validBalance(nextGold) || !validBalance(nextDust)) {
    return rejected(state, "BALANCE_OVERFLOW");
  }

  const key = command.idempotencyKey;
  const source = command.sourceRef;
  const ledger = [];
  const push = (currency, delta) => {
    if (delta === 0) return;
    ledger.push({
      ledger_id: key + ":" + currency,
      idempotency_key: key,
      source_ref: source,
      currency,
      delta,
      reason: command.type
    });
  };
  push("gold", gold);
  push("dust", dust);
  if (cosmeticId) push("cosmetic", 1);
  // A zero-currency reward is still tracked by appliedKeys/rewardClaims.
  const nextState = {
    schema_version: ECONOMY_SCHEMA_VERSION,
    balances: { gold: nextGold, dust: nextDust },
    inventory: cosmeticId ? [...state.inventory, cosmeticId] : [...state.inventory],
    rewardClaims: rewardClaim ? [...state.rewardClaims, key] : [...state.rewardClaims],
    appliedKeys: [...state.appliedKeys, key],
    ledger: [...state.ledger, ...ledger]
  };
  return {
    state: nextState,
    result: {
      ok: true,
      code: "APPLIED",
      duplicate: false,
      cosmeticId,
      duplicateConverted,
      delta: { gold, dust }
    }
  };
}

// Local, earned-only prototype catalog. There are no real-money SKUs or stat grants.
export const ECONOMY_CATALOG_VERSION = 1;

export const FREE_COSMETICS = Object.freeze({
  cosmetic_ember_trail: Object.freeze({
    schema_version: 1, id: "cosmetic_ember_trail",
    display_name_key: "cosmetic.ember_trail", category: "cosmetic",
    rarity: "rare", slot: "trail", availability: "earned_only",
    duplicate_dust: 12
  }),
  cosmetic_moonlit_aura: Object.freeze({
    schema_version: 1, id: "cosmetic_moonlit_aura",
    display_name_key: "cosmetic.moonlit_aura", category: "cosmetic",
    rarity: "epic", slot: "aura", availability: "earned_only",
    duplicate_dust: 35
  }),
  cosmetic_starfall_crown: Object.freeze({
    schema_version: 1, id: "cosmetic_starfall_crown",
    display_name_key: "cosmetic.starfall_crown", category: "cosmetic",
    rarity: "mythic", slot: "head", availability: "earned_only",
    duplicate_dust: 100
  })
});

export const FREE_SHOP_OFFERS = Object.freeze({
  offer_ember_trail: Object.freeze({
    schema_version: 1, id: "offer_ember_trail",
    display_name_key: "offer.ember_trail", category: "free_shop",
    availability: "always", cosmetic_id: "cosmetic_ember_trail",
    cost: Object.freeze({ gold: 140, dust: 0 })
  }),
  offer_moonlit_aura: Object.freeze({
    schema_version: 1, id: "offer_moonlit_aura",
    display_name_key: "offer.moonlit_aura", category: "free_shop",
    availability: "always", cosmetic_id: "cosmetic_moonlit_aura",
    cost: Object.freeze({ gold: 450, dust: 30 })
  })
});

export const CRAFT_RECIPES = Object.freeze({
  recipe_moonlit_aura: Object.freeze({
    schema_version: 1, id: "recipe_moonlit_aura",
    display_name_key: "recipe.moonlit_aura", category: "craft",
    availability: "always", cosmetic_id: "cosmetic_moonlit_aura",
    cost: Object.freeze({ gold: 100, dust: 110 })
  }),
  recipe_starfall_crown: Object.freeze({
    schema_version: 1, id: "recipe_starfall_crown",
    display_name_key: "recipe.starfall_crown", category: "craft",
    availability: "always", cosmetic_id: "cosmetic_starfall_crown",
    cost: Object.freeze({ gold: 900, dust: 180 })
  })
});

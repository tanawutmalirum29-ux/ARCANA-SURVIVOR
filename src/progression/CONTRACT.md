# Local progression contract

This module is pure/offline. Storage is owned by the integration lead. Never treat
local rewards as verified online entitlements.

## Exports from index.js

- `createCampaign(legacyProfile)`: requires a valid normalized v1 profile, returns envelope.
- `validateCampaign(state)`: strict campaign schema v3 boolean, no writes/default replacement. `validateCampaignV2` is retained exclusively to validate historic v2 before explicit migration.
- `migrateCampaignV2ToV3(validV2)`: pure conversion (no revision bump; store handles that atomically); null on invalid input.
- `getEquippedSkin(campaign,heroId)`: namespaced cosmetic string or null for invalid hero. `getSkinDefinition(skinId)` and `listSkinsForHero(heroId)` return immutable presentation metadata; previews are never grants.
- `applyCommand(state, command)`: `{ok, code, state, details}`. Failure returns original state.
  Success increments `revision` once. Store must commit before showing success.
- `deriveLoadout(state)`: immutable-by-value engine config; cosmetics excluded.
- `getProfileLevel(state)`, `getFeatureState(state, key) -> {unlocked, reason}`.
- `getItemStats(item)` (alias `itemStats`), `getUpgradeCost(item)`.
- `getForgeCandidates(state, itemId)`: array of eligible same-definition/rank instances.
- `getMissionProgress(state, missionId) -> {current,target,complete,claimed}`.
- `getCommandCost(state, command) -> {gold?,essence?,research?,dust?,fragments?}`.
- `getCommandRewardPreview(state, command)` and `getDismantleReward(item)` return
  plain reward/refund objects for confirmation UI; reducers use the same formulas.
- Catalog arrays: `HEROES, EQUIPMENT, SLOTS, RARITIES, CHAPTERS, MODES, RELICS,
  TALENTS, RUNES, JEWELS, ARTIFACTS, COMPANIONS, GUARDIANS, RESEARCH, BUILDINGS,
  MISSIONS, SHOP_OFFERS, SEASON_REWARDS, GEAR_SETS`.
- `ERROR_MESSAGES`: Thai text keyed by reducer code.

Every catalog entry has `id, name, description`. Collections contain data only.
Rarity indices 0–5: Common/Uncommon/Rare/Epic/Legendary/Mythic.
Equipment definitions: `id, slot, name, description, icon, stats, effect, set,
craftCost:{gold,essence}`; instance stats come from getItemStats.
Slots: `weapon, armor, ring1, ring2, locket, book, bracelet, spirit1, spirit2`.
`slot.type` matches definition.slot (rings share ring; spirits share spirit).

## Envelope

```
{
 schemaVersion: 3, revision: 0,
 profile: {version:1,gold,totalKills,runs,bestSeconds,skin,owned,settings},
 progression: {
  xp:0, heroId:'mage', heroes:{mage:{level:1,stars:0,shards:0,awakening:0},...},
  wardrobe:{mage:{owned:['mage:base'],equipped:'mage:base'},
            guardian:{owned:['guardian:base'],equipped:'guardian:base'},
            ranger:{owned:['ranger:base'],equipped:'ranger:base'}},
  supportHeroId:null, chapterId:'astral', mode:'campaign', cleared:[],
  inventory:[{id:'item-1',definitionId:'star_wand',rarity:0,level:1,
              locked:false,refinement:0,glyph:null,invested:{gold:0,essence:0}}],
  equipment:{weapon:'item-1',armor:'item-2',ring1:null,...},
  materials:{essence:0,research:0,dust:0},
  relics:{compass:{fragments:0,level:0,stars:0},...},
  talents:{vitality:0,...},
  runes:{owned:{power:0,...},equipped:{attack:null,defense:null,utility:null}},
  jewels:{owned:{ruby:0,...},equipped:{weapon:null,armor:null,ring1:null,...}},
  artifacts:{hourglass:0,...}, artifactId:null,
  companions:{wisp:0,...}, companionIds:[],
  guardians:{phoenix:0,...}, guardianId:null,
  research:{...levels},
  homestead:{buildings:{observatory:0,garden:0,archive:0},
             pending:{essence:0,research:0,dust:0}},
  presets:[null,null,null],
  missions:{stats:{runs:0,kills:0,wins:0,upgrades:0,crafted:0},
            claimed:[],day:'',dailyRuns:0,dailyKills:0,dailyWins:0,dailyClaimed:[],
            week:'',weeklyRuns:0,weeklyKills:0,weeklyWins:0,weeklyClaimed:[]},
  season:{xp:0,claimed:[]}, claimed:[],
  nextItem:3,nextRun:1,activeRun:null
 }
}
```

profile.gold is the sole Gold wallet. Level zero means not owned for companions,
relics, runes, jewels, artifacts and guardians. Hero level zero means locked.
Content unlocks from run milestones, not paid transactions.
Active run stores `{id,seed,chapterId,mode,day,runConfig,appearance:{heroId,skinId}}`; appearance is frozen at run start and kept separate from combat-only `runConfig`. Never recompute its config
after starting. START_RUN while active returns RUN_ACTIVE (not a replacement).

## Commands

All take `type` plus fields below. Reducer owns all costs and grants.

| Type | Fields |
| --- | --- |
| SELECT_HERO | heroId |
| UNLOCK_HERO / UPGRADE_HERO / STAR_HERO | heroId |
| AWAKEN_HERO | heroId; requires max level and stars; 3 ranks; catalog awakeningStats per rank |
| SELECT_SUPPORT | heroId or null |
| SELECT_CHAPTER | chapterId |
| SELECT_MODE | mode |
| EQUIP_ITEM | itemId, slot |
| UNEQUIP_ITEM | slot |
| LOCK_ITEM | itemId, locked boolean |
| UPGRADE_ITEM / RESET_ITEM / REFINE_ITEM | itemId |
| GLYPH_ITEM | itemId, glyph ('power','guard','haste') |
| FUSE_ITEMS | itemIds array of exactly 3; first is the surviving main item |
| DISMANTLE_ITEM | itemId (not locked/equipped/preset) |
| CRAFT_ITEM | definitionId |
| SAVE_PRESET / LOAD_PRESET | index 0–2 |
| UNLOCK_RELIC / UPGRADE_RELIC / STAR_RELIC | relicId |
| CONVERT_RELIC_FRAGMENTS | relicId, amount integer > 0; max level/stars; 1 fragment -> 1 Dust |
| UPGRADE_TALENT | talentId |
| RESET_TALENTS | none |
| UPGRADE_RUNE / UPGRADE_JEWEL | runeId / jewelId (zero->one unlock) |
| EQUIP_RUNE | runeId, slot ('attack','defense','utility'); null runeId removes |
| EQUIP_JEWEL | jewelId, slot; null jewelId removes |
| UPGRADE_ARTIFACT / UPGRADE_COMPANION / UPGRADE_GUARDIAN | artifactId / companionId / guardianId |
| EQUIP_ARTIFACT / EQUIP_GUARDIAN | artifactId / guardianId; null removes |
| EQUIP_COMPANION | companionId (toggle, max 2) |
| UPGRADE_RESEARCH | researchId |
| UPGRADE_BUILDING | buildingId |
| CLAIM_HOMESTEAD | none |
| CLAIM_MISSION | missionId |
| CLAIM_SEASON | tier integer 1–50 |
| BUY_OFFER | offerId |
| START_RUN | optional day 'YYYY-MM-DD'; stable id/seed derived internally |
| FINISH_RUN | runId, stats:{kills,seconds,won}; no caller-supplied reward amounts |
| ABANDON_RUN | runId |
| PROFILE_SETTINGS | settings:{vfx?,reduceMotion?} |
| EQUIP_COSMETIC / UNLOCK_COSMETIC | heroId, cosmeticId (namespaced `<hero>:<variant>`; cross-hero rejected) |

START_RUN details: `{runId,seed,runConfig}`; FINISH_RUN details:
`{gold,essence,research,dust,xp,items:[instances],relicFragments:[{id,amount}],
firstClear,unlockedChapterIds,won}`.
Successful claim keys remain in the state; repeated FINISH_RUN returns ALREADY_CLAIMED.
Daily tasks use the explicitly provided local UTC day; date cannot move backwards.
Weekly tasks reset on Monday UTC. Period counters advance on START_RUN; no wall-clock
reads occur in this module. Jewels are reusable slot upgrades: one jewel type occupies
one slot at a time, and moving it clears its previous slot. An empty gear slot gives
no jewel bonus. Inventory holds 1,000 items; excess run drops convert to 10 Essence.
Refinement and glyphs require Rare gear or better. Equipped/preset main items can be
fused; fodder cannot be locked, equipped, in a preset, refined, or glyphed. Main item
identity and investment survive; fodder level investment is refunded atomically.
Gear sets expose `bonuses:[{pieces,stats}]` for 2- and 4-piece thresholds; both apply
when four pieces are equipped. Awakening costs earned Gold, Essence, Research and
hero shards; costs and bonuses are shown from catalog/selectors. Excess relic
conversion rejects insufficient fragments, malformed amounts and Dust overflow.
Season is an evergreen free Chronicle, not a simulated/live paid season.

## Engine config

```
{version:1,balanceVersion:1,heroId,chapterId,mode,
 stats:{maxHp,attack,speed,fireDelay,armor,critChance,critDamage,pickupRadius,
        healingMultiplier,skillMultiplier,bossDamageMultiplier},
 weaponId,weaponEffect,
 artifact:{id,level}|null,companions:[{id,level}],guardian:{id,level}|null,
 modifiers:{novaRadius,chainTargets,orbitRadius,shieldEvery,killHeal},
 chapter:{enemyHpMultiplier,enemyDamageMultiplier,spawnMultiplier,
          bossAtSeconds,bossHpMultiplier,bossName,durationSeconds}}
```

Daily Challenge returns standardized config independent of owned upgrades.
All effects must be consumed by engine or omitted from the presented item stats.

## Cosmetic migration and persistence v3

- The IndexedDB DB/store/key remain `arcana-campaign-v2` / `campaign` / `profile`; existing strict v2 records migrate atomically to v3 once inside an IDB readwrite transaction. Saved `revision` advances **exactly once** on v2 conversion, while fresh v1 localStorage -> v3 starts at revision zero. A stale caller cannot execute a command inside the migration transaction; it must reload. Valid v3 loads do not write.
- Historical `profile.version=1`, `profile.skin`, `profile.owned` remain for compatibility, but no longer select the displayed costume; all three heroes have separate `progression.wardrobe[heroId].{owned,equipped}`. No cosmetic data enters `deriveLoadout`, combat stats or `runConfig`.
- Legacy `apprentice` grants all base IDs; an already-owned old `ember` or `moon` grants that variant to **all three** heroes and retains old equipped choice individually. `ember` costs 120 GOLD for the whole three-hero bundle; 30 lifetime kills grants the whole `moon` bundle. Preview-only `lantern`, `verdant`, `aurora`, `crimson`, `celestial` cannot be granted or equipped.
- Saved presets have an `appearance:{heroId,skinId}` snapshot, and LOAD_PRESET selects its stored hero skin while leaving other heroes' choices untouched. Saved active runs freeze appearance from that run's hero even when tab/wardrobe changes; migrated v2 runs preserve the original global skin.
- Unknown/future/corrupt/denied saves must not be overwritten, auto-defaulted, silently downgraded, or partially granted. Optimistic revision checks and spend/receipt atomicity remain mandatory.

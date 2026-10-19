# Content Pipeline — Art, Skins, Bosses, Events & Localization

## 1. Asset quality targets
- Art direction: dark fantasy crystal-lit magic; readable silhouettes first, bright and premium presentation second
- Every skin has 1) concept key art 2) in-game sprite atlas 3) idle/move/cast frames 4) VFX set 5) thumbnail/preview 6) sound/haptic spec 7) low-quality fallback
- Keep body anchors and hitbox identical across skins; minor cosmetics should reuse base animation set
- Animations must be legible at real mobile size; confirm screenshots at 320px width and low brightness

## 2. Reusable event kit
- Biome palette, icon set, UI banner, event music cue (licensed), objective cards, event shop theme, reward reveal effect
- Define event from reusable templates; new mechanic requires separate feature QA and cannot ship solely as config
- Seasonal art reuse policy: recolor variants are labelled honestly; no advertised unique asset if it reuses a previous one without meaningful changes

## 3. Production board stages
Idea -> design brief -> balance approval -> concept art -> animation/VFX prototype -> integration -> low/high graphics QA -> localization -> catalog validation -> staging -> live -> archive & retrospective
- Each deliverable has owner, due milestone, visual reference, dependency, acceptance evidence, source file path
- Adopt content naming IDs from DATA_SCHEMA; Git LFS/CDN decision only if assets require it
- Do not copy third-party assets, fonts, music, anime/IP without permission. Record license and provenance

## 4. Seasonal content budget allocation (capacity template)
- 45% core game/boss/system polish, 30% seasonal skins/VFX, 15% events/quests/UX, 10% QA/localization/marketing
- Suggested first-season package: 1 map re-theme + 1 boss pattern set + 3 event templates + 8 cosmetics + pass reward filler
- Reduce items rather than ship broken content: order of priority core playable > free main reward > event availability > premium cosmetics > optional social

## 5. Release acceptance per asset
- Visual matches preview; skin has no gameplay modifiers; low settings never hide boss telegraph
- Verified text/price/source/claim windows; image atlases fit memory test; license provenance
- Event and season end states tested; missing asset renders safe fallback without crashing

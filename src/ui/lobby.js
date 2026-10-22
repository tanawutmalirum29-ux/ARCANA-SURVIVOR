import {
  HEROES, EQUIPMENT, GEAR_SETS, SLOTS, RARITIES, CHAPTERS, MODES, RELICS, TALENTS,
  RUNES, JEWELS, ARTIFACTS, COMPANIONS, GUARDIANS, RESEARCH, BUILDINGS,
  MISSIONS, SHOP_OFFERS, SEASON_REWARDS, ERROR_MESSAGES,
  deriveLoadout, getProfileLevel, getFeatureState, getItemStats,
  getForgeCandidates, getMissionProgress, getCommandCost, getCommandRewardPreview,
} from '../progression/index.js';
import { COSMETICS } from '../storage.js';
import { icon, chapterArt } from './icons.js';
import {heroActorSvg} from '../characters/visual/hero-art.js';
import {getSkinDefinition,getEquippedSkin} from '../characters/skins/index.js';

const TABS = [
  ['shop', 'ร้านค้า', 'shop'], ['hero', 'นักรบ', 'hero'],
  ['adventure', 'ผจญภัย', 'adventure'], ['growth', 'เติบโต', 'growth'], ['events', 'ภารกิจ', 'events'],
];
const GROWTH = [
  ['talents', 'พรสวรรค์', 'growth'], ['relics', 'วัตถุโบราณ', 'relic'],
  ['artifacts', 'อาร์ติแฟกต์', 'artifact'], ['runes', 'รูน', 'rune'],
  ['jewels', 'อัญมณี', 'jewel'], ['companions', 'คู่หู', 'companion'],
  ['guardians', 'ผู้พิทักษ์', 'guardian'], ['research', 'งานวิจัย', 'research'], ['homestead', 'วิหาร', 'home'],
];
const MATERIALS = { gold: ['ทอง', 'gold'], essence: ['แก่นเวท', 'essence'], research: ['ตำราวิจัย', 'research'], dust: ['ผงดวงดาว', 'dust'], fragments: ['ชิ้นส่วน', 'relic'], shards: ['ชิ้นส่วนนักรบ', 'hero'] };
const STATS = { attack: 'โจมตี', maxHp: 'พลังชีวิต', armor: 'เกราะ', speed: 'ความเร็ว', fireDelay: 'ช่วงโจมตี', critChance: 'คริติคอล', critDamage: 'แรงคริติคอล', pickupRadius: 'ระยะเก็บ', healingMultiplier: 'การฟื้นฟู', skillMultiplier: 'พลังสกิล', bossDamageMultiplier: 'ความเสียหายบอส', attackMultiplier: 'พลังโจมตี', hpMultiplier: 'พลังชีวิต', haste: 'ความเร็วโจมตี' };
const PERCENT_STATS = new Set(['armor', 'critChance', 'critDamage', 'healingMultiplier', 'skillMultiplier', 'bossDamageMultiplier', 'attackMultiplier', 'hpMultiplier', 'haste']);
const SUCCESS = { EQUIP_ITEM: 'สวมใส่อุปกรณ์แล้ว', UNEQUIP_ITEM: 'ถอดอุปกรณ์แล้ว', LOCK_ITEM: 'บันทึกการล็อกอุปกรณ์แล้ว', UPGRADE_ITEM: 'อัปเกรดอุปกรณ์แล้ว', FUSE_ITEMS: 'หลอมรวมอุปกรณ์แล้ว', RESET_ITEM: 'คืนระดับและวัตถุดิบแล้ว', DISMANTLE_ITEM: 'แยกชิ้นส่วนแล้ว', CRAFT_ITEM: 'สร้างอุปกรณ์แล้ว', SAVE_PRESET: 'บันทึกชุดอุปกรณ์แล้ว', LOAD_PRESET: 'สลับชุดอุปกรณ์แล้ว', CLAIM_MISSION: 'รับรางวัลภารกิจแล้ว', CLAIM_SEASON: 'รับรางวัลบันทึกดวงดาวแล้ว', BUY_OFFER: 'แลกเปลี่ยนสำเร็จ', CLAIM_HOMESTEAD: 'เก็บผลผลิตแล้ว', SELECT_HERO: 'เปลี่ยนนักรบแล้ว', SELECT_SUPPORT: 'เลือกนักรบสนับสนุนแล้ว', SELECT_MODE: 'เลือกโหมดแล้ว', SELECT_CHAPTER: 'เลือกบทแล้ว', REFINE_ITEM: 'ขัดเกลาอุปกรณ์แล้ว', GLYPH_ITEM: 'จารึกอุปกรณ์แล้ว', RESET_TALENTS: 'คืนแต้มพรสวรรค์แล้ว' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number(value) || 0);
const find = (catalog, id) => catalog.find(entry => entry.id === id);
const missionDescription = entry => ({ runs: `จบการผจญภัย ${num(entry.target)} รอบ`, kills: `กำจัดศัตรู ${num(entry.target)} ตัว`, wins: `ชนะการผจญภัย ${num(entry.target)} รอบ`, upgrades: `อัปเกรดพลัง ${num(entry.target)} ครั้ง`, crafted: `สร้างอุปกรณ์ ${num(entry.target)} ชิ้น` })[entry.stat] || entry.description;
const levelOf = entry => typeof entry === 'object' ? Number(entry?.level || 0) : Number(entry || 0);
const nameOf = entry => entry?.name || entry?.id || 'ไม่ทราบรายการ';
const rarityName = rank => typeof RARITIES[rank] === 'string' ? RARITIES[rank] : RARITIES[rank]?.name || ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'][rank] || 'Common';
const statValue = (key, value) => PERCENT_STATS.has(key) ? `${num(Number(value) * 100)}%` : key === 'fireDelay' ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(value) / 60)}s` : num(value);

/**
 * Local view state only. onCommand is responsible for durable storage, and must
 * resolve successfully only after its returned state has been committed.
 */
export function mountLobby(host, options) {
  let campaign = options.campaign;
  let disposed = false;
  let busy = false;
  let notice = null;
  let noticeTimer;
  let modal = null;
  let returnFocus = null;
  let focusIdentity = '';
  let serial = 0;
  const saved = options.viewState || {};
  const view = {
    tab: TABS.some(([id]) => id === (saved.tab || options.initialTab)) ? saved.tab || options.initialTab : 'adventure',
    hero: ['equipment', 'heroes', 'forge', 'presets'].includes(saved.hero) ? saved.hero : 'equipment',
    growth: GROWTH.some(([id]) => id === saved.growth) ? saved.growth : 'talents',
    events: saved.events === 'season' ? 'season' : 'missions',
    inventorySlot: saved.inventorySlot || 'all',
    inventoryRarity: saved.inventoryRarity === 'all' || Number.isInteger(saved.inventoryRarity) ? saved.inventoryRarity : 'all',
    inventorySort: ['rarity', 'level', 'newest'].includes(saved.inventorySort) ? saved.inventorySort : 'rarity',
  };
  const uid = `lb-${Math.random().toString(36).slice(2, 9)}`;
  const p = () => campaign.progression;
  const profile = () => campaign.profile;
  const hero = () => find(HEROES, p().heroId) || HEROES[0];
  const itemById = id => p().inventory.find(item => item.id === id);
  const defOf = item => find(EQUIPMENT, item?.definitionId);
  const hasFunds = (cost, command) => Object.entries(cost || {}).every(([key, value]) => !Number(value) || (key === 'gold' ? profile().gold : key === 'fragments' ? p().relics[command.relicId]?.fragments : key === 'shards' ? p().heroes[command.heroId]?.shards : p().materials[key]) >= value);
  const costFor = command => getCommandCost(campaign, command) || {};
  const feature = key => getFeatureState(campaign, key);
  const personalLoadout = () => deriveLoadout({ ...campaign, progression: { ...p(), mode: 'campaign' } });
  const costText = cost => Object.entries(cost || {}).filter(([, value]) => Number(value) > 0).map(([key, value]) => `${num(value)} ${MATERIALS[key]?.[0] || key}`).join(' · ');
  const costMarkup = cost => Object.entries(cost || {}).filter(([, value]) => Number(value) > 0).map(([key, value]) => `<span class="lb-cost-part">${icon(MATERIALS[key]?.[1] || 'spark')}<span>${num(value)}</span><span class="lb-sr-only">${esc(MATERIALS[key]?.[0] || key)}</span></span>`).join('');
  const tag = (text, className = '') => `<span class="lb-tag ${className}">${esc(text)}</span>`;
  const button = (label, action, { className = '', iconName, disabled = false, id = '', attrs = '' } = {}) => `<button type="button" class="lb-btn ${className}" data-action="${esc(action)}"${id ? ` data-id="${esc(id)}"` : ''}${disabled || busy ? ' disabled' : ''} ${attrs}>${iconName ? icon(iconName) : ''}<span>${esc(label)}</span></button>`;
  function commandButton(label, command, config = {}) {
    const cost = costFor(command);
    const unaffordable = !hasFunds(cost, command);
    const disabled = config.disabled || busy || unaffordable;
    const withCost = config.cost !== false && Object.values(cost).some(value => Number(value) > 0);
    return `<button type="button" class="lb-btn ${config.className || ''}${Object.values(cost).filter(value => Number(value) > 0).length > 2 ? ' lb-btn-multicost' : ''}" data-command="${esc(command.type)}" data-payload="${esc(JSON.stringify(command))}"${Object.entries(command).filter(([key, value]) => key !== 'type' && typeof value !== 'object').map(([key, value]) => ` data-${key.replace(/[A-Z]/g, ch => `-${ch.toLowerCase()}`)}="${esc(value)}"`).join('')}${config.confirm ? ` data-confirm="${esc(config.confirm)}"` : ''}${disabled ? ' disabled' : ''} ${config.attrs || ''}${unaffordable ? ` title="ต้องใช้ ${esc(costText(cost))}"` : ''}>${config.iconName ? icon(config.iconName) : ''}<span>${esc(label)}</span>${withCost ? `<span class="lb-btn-cost">${costMarkup(cost)}</span>` : ''}</button>`;
  }
  function resource(key, value) {
    return `<div class="lb-resource lb-resource-${key}" title="${esc(MATERIALS[key]?.[0] || key)}">${icon(MATERIALS[key]?.[1] || key)}<strong>${num(value)}</strong><span class="lb-sr-only">${esc(MATERIALS[key]?.[0] || key)}</span></div>`;
  }
  function heading(eyebrow, title, description = '', extra = '') {
    return `<div class="lb-heading"><div><p class="lb-eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${description ? `<p class="lb-muted">${esc(description)}</p>` : ''}</div>${extra}</div>`;
  }
  function subnav(entries, selected, scope) {
    return `<div class="lb-subnav" role="tablist" aria-label="${esc(scope === 'hero' ? 'นักรบ' : scope === 'growth' ? 'การเติบโต' : 'ภารกิจ')}">${entries.map(([id, label, mark]) => `<button type="button" role="tab" class="lb-subtab ${selected === id ? 'is-active' : ''}" aria-selected="${selected === id}" data-subtab="${id}" data-scope="${scope}"${busy ? ' disabled' : ''}>${mark ? icon(mark) : ''}${esc(label)}</button>`).join('')}</div>`;
  }
  function statBlocks(stats) {
    return `<div class="lb-stat-blocks">${[['attack', 'sword'], ['maxHp', 'heart'], ['armor', 'shield']].map(([key, mark]) => `<div>${icon(mark)}<strong>${statValue(key, stats[key])}</strong><span>${STATS[key]}</span></div>`).join('')}</div>`;
  }
  function statsMarkup(stats, compare) {
    const entries = Object.keys({ ...(compare || {}), ...(stats || {}) })
      .filter(key => STATS[key] && (Number(stats?.[key]) || Number(compare?.[key])))
      .map(key => [key, Number(stats?.[key]) || 0]);
    if (!entries.length) return '';
    return `<div class="lb-stat-list">${entries.length ? entries.map(([key, value]) => {
      const diff = compare ? value - (compare[key] || 0) : 0;
      const positive = key === 'fireDelay' ? diff < 0 : diff > 0;
      return `<div><span>${STATS[key]}</span><strong>${statValue(key, value)}</strong>${compare ? `<small class="${!diff ? 'lb-muted' : positive ? 'lb-positive' : 'lb-negative'}">${diff > 0 ? '+' : ''}${statValue(key, diff)}</small>` : ''}</div>`;
    }).join('') : '<p class="lb-muted">พลังพิเศษตามรายละเอียดด้านบน</p>'}</div>`;
  }
  function setInfo(setId) {
    const set = find(GEAR_SETS, setId);
    if (!set) return '';
    const count = Object.values(p().equipment).filter(id => defOf(itemById(id))?.set === setId).length;
    return `<div class="lb-set-info"><div><strong>เซ็ต${esc(set.name)}</strong><span>สวมใส่ ${count} ชิ้น</span></div>${set.bonuses.map(bonus => `<p class="${count >= bonus.pieces ? 'lb-positive' : ''}">${icon(count >= bonus.pieces ? 'check' : 'lock')}<b>${bonus.pieces} ชิ้น</b> ${Object.entries(bonus.stats).map(([key, value]) => `${STATS[key]} +${statValue(key, value)}`).join(' · ')}</p>`).join('')}</div>`;
  }
  function rewardReview(command, title = 'ทรัพยากรที่จะได้รับ') {
    const reward = getCommandRewardPreview(campaign, command);
    if (!Object.values(reward).some(value => Number(value) > 0)) return '';
    return `<div class="lb-transaction-preview"><strong>${esc(title)}</strong><div class="lb-rewards">${rewardsMarkup(reward)}</div></div>`;
  }
  function relicConversion(entry, state) {
    if (state.level < entry.maxLevel || state.stars < entry.maxStars) return `<p class="lb-card-caption">เมื่อระดับและดาวสูงสุด จะแปลงชิ้นส่วนที่เหลือเป็นผงดวงดาวได้</p>`;
    return `<div class="lb-relic-conversion"><h3>แปลงชิ้นส่วนส่วนเกิน</h3><p class="lb-muted">1 ชิ้นส่วน → 1 ผงดวงดาว</p><div class="lb-card-actions">${[1, 5, 10].map(amount => commandButton(`${amount} ชิ้น`, { type: 'CONVERT_RELIC_FRAGMENTS', relicId: entry.id, amount }, { disabled: state.fragments < amount, className: 'lb-btn-small', confirm: `แปลงชิ้นส่วน${nameOf(entry)} ${amount} ชิ้น เป็นผงดวงดาว ${amount} หน่วย?` })).join('')}</div></div>`;
  }
  function lockedPanel(key) {
    const state = feature(key);
    if (state.unlocked) return '';
    return `<div class="lb-unlock-banner">${icon('lock')}<div><strong>เส้นทางใหม่กำลังรอคุณ</strong><p>${esc(state.reason || 'ผจญภัยต่อเพื่อปลดล็อกระบบนี้')}</p></div>${button('ไปผจญภัย', 'tab', { id: 'adventure', className: 'lb-btn-small' })}</div>`;
  }
  function empty(title, description, mark = 'chest') {
    return `<div class="lb-empty">${icon(mark)}<strong>${esc(title)}</strong><p>${esc(description)}</p></div>`;
  }
  function header() {
    const currentHero = hero();
    const level = getProfileLevel(campaign);
    return `<header class="lb-header"><button type="button" class="lb-profile" data-action="tab" data-id="hero" aria-label="นักรบ ${esc(nameOf(currentHero))}, ระดับบัญชี ${level}">${icon('hero')}<span><strong>ARCANA<span> SURVIVOR</span></strong><small>นักเดินทาง · LV ${level}</small></span></button><div class="lb-wallet">${resource('gold', profile().gold)}${resource('essence', p().materials.essence)}</div><button type="button" class="lb-icon-button" data-action="settings" aria-label="ตั้งค่า"${busy ? ' disabled' : ''}>${icon('settings')}</button></header>`;
  }
  function adventure() {
    const activeRun = p().activeRun;
    const loadout = activeRun?.runConfig || deriveLoadout(campaign);
    const chapter = find(CHAPTERS, loadout.chapterId) || CHAPTERS[0];
    const modeId = loadout.mode;
    const currentHero = find(HEROES, loadout.heroId) || hero();
    const heroState = p().mode === 'daily' ? { level: 1 } : p().heroes[p().heroId];
    const skin = getSkinDefinition(activeRun?.appearance?.skinId || getEquippedSkin(campaign,currentHero.id));
    const mission = MISSIONS.find(entry => { const progress = getMissionProgress(campaign, entry.id); return !progress.claimed; });
    const progress = mission ? getMissionProgress(campaign, mission.id) : null;
    return `<div class="lb-adventure"><section class="lb-sanctum"><div class="lb-sanctum-heading"><span class="lb-eyebrow">THE ASTRAL SANCTUM</span><h1>วิหารแห่งดวงดาว</h1><span class="lb-local-mark"><i></i>เส้นทางของคุณ · เล่นออฟไลน์</span></div><div class="lb-hero-stage"><div class="lb-orbit lb-orbit-one"></div><div class="lb-orbit lb-orbit-two"></div><span class="lb-stage-star lb-stage-star-a">✧</span><span class="lb-stage-star lb-stage-star-b">✦</span>${heroActorSvg({heroId:currentHero.id,skin})}<button type="button" class="lb-stage-chip lb-stage-gear" data-action="hero-view" data-id="equipment">${icon('sword')}<span>อุปกรณ์</span></button><button type="button" class="lb-stage-chip lb-stage-skin" data-action="wardrobe">${icon('wardrobe')}<span>รูปลักษณ์</span></button></div><div class="lb-hero-caption"><span class="lb-eyebrow">${esc(currentHero.title || 'STARBOUND HERO')}</span><h2>${esc(nameOf(currentHero))}<span>${activeRun ? 'ชุดรอบค้าง' : `Lv.${heroState?.level || 1}`}</span></h2><p>${esc(currentHero.description)}</p></div>${statBlocks(loadout.stats)}</section><section class="lb-journey"><div class="lb-journey-heading"><span class="lb-eyebrow">YOUR NEXT JOURNEY</span>${tag(`${p().cleared.length} / ${CHAPTERS.length} บทพิชิตแล้ว`)}</div><div class="lb-chapter-card">${chapterArt(chapter.id)}<div class="lb-chapter-card-content"><span class="lb-eyebrow">CHAPTER ${String(CHAPTERS.indexOf(chapter) + 1).padStart(2, '0')}</span><h2>${esc(nameOf(chapter))}</h2><p>${esc(chapter.description)}</p><button type="button" class="lb-chapter-select" data-action="chapters"${busy || activeRun ? ' disabled' : ''}>เลือกบท${icon('chevron')}</button></div></div><button type="button" class="lb-mode-select" data-action="modes"${busy || activeRun ? ' disabled' : ''}>${icon(find(MODES, modeId)?.icon || 'adventure')}<span><small>โหมดการเล่น</small><strong>${esc(nameOf(find(MODES, modeId)))}</strong></span><span class="lb-mode-change">เปลี่ยน</span>${icon('chevron')}</button><p class="lb-mode-description">${esc(find(MODES, modeId)?.description || '')}</p><div class="lb-launch"><div class="lb-launch-note">${icon(activeRun ? 'reset' : 'spark')}<span>${activeRun ? 'โหลดหน้าใหม่จะเริ่มรอบเดิมตั้งแต่ต้น โดยใช้ชุดที่บันทึกไว้' : 'ไม่มีค่าพลังงาน · เติบโตได้ทุกครั้งที่ออกเดินทาง'}</span></div>${button(activeRun ? 'เล่นรอบค้างต่อ' : 'ออกผจญภัย', 'start', { className: 'lb-btn-primary lb-start', iconName: 'adventure' })}${activeRun ? commandButton('ยกเลิกรอบค้าง', { type: 'ABANDON_RUN', runId: activeRun.id }, { className: 'lb-btn-text lb-btn-small', confirm: 'ยุติรอบค้างโดยไม่ได้รางวัล? จากนั้นจะเริ่มรอบใหม่ด้วยชุดอุปกรณ์ปัจจุบันได้' }) : ''}</div>${profile().runs === 0 ? '<div class="lb-first-steps"><span><b>1</b>เล่นรอบแรก</span><i>→</i><span><b>2</b>รับของรางวัล</span><i>→</i><span><b>3</b>อัปเกรดชุด</span></div>' : ''}<button type="button" class="lb-mission-preview" data-action="tab" data-id="events">${icon('events')}<span><small>${progress?.complete ? 'มีรางวัลรอให้รับ' : 'ภารกิจของนักเดินทาง'}</small><strong>${esc(mission ? nameOf(mission) : 'บันทึกการผจญภัยของคุณ')}</strong>${progress ? `<span class="lb-mini-progress"><i style="width:${Math.min(100, progress.current / Math.max(1, progress.target) * 100)}%"></i></span>` : ''}</span>${progress ? `<b>${num(progress.current)}<small>/${num(progress.target)}</small></b>` : icon('chevron')}</button></section></div>`;
  }
  function itemTile(item, { equipped = false, selected = false, action = 'item' } = {}) {
    const definition = defOf(item);
    return `<button type="button" class="lb-item rarity-${item.rarity} ${selected ? 'is-selected' : ''}" data-action="${action}" data-id="${esc(item.id)}" aria-label="${esc(nameOf(definition))}, ${rarityName(item.rarity)}, ระดับ ${item.level}${equipped ? ', สวมใส่' : ''}${item.locked ? ', ล็อก' : ''}"><span class="lb-item-rank">${item.rarity + 1}</span>${icon(definition?.icon || definition?.slot || 'wand')}<strong>Lv.${item.level}</strong>${item.locked ? `<span class="lb-item-lock">${icon('lock')}</span>` : ''}${equipped ? '<span class="lb-equipped-dot"></span>' : ''}${selected ? `<span class="lb-item-selected">${icon('check')}</span>` : ''}</button>`;
  }
  function equipmentView() {
    const equipped = new Set(Object.values(p().equipment));
    const sorters = { rarity: (a, b) => b.rarity - a.rarity || b.level - a.level, level: (a, b) => b.level - a.level || b.rarity - a.rarity, newest: (a, b) => Number(b.id.slice(5)) - Number(a.id.slice(5)) };
    const inventory = p().inventory.filter(item => (view.inventorySlot === 'all' || defOf(item)?.slot === view.inventorySlot) && (view.inventoryRarity === 'all' || item.rarity === view.inventoryRarity)).slice().sort(sorters[view.inventorySort]);
    const slotTypes = [...new Set(SLOTS.map(slot => slot.type))];
    return `<div class="lb-equipment-layout"><section class="lb-panel lb-loadout-panel"><div class="lb-section-heading"><h2>ชุดอุปกรณ์ปัจจุบัน</h2>${button('สกิน', 'wardrobe', { iconName: 'wardrobe', className: 'lb-btn-small lb-btn-text' })}</div><div class="lb-equipped-grid">${SLOTS.map(slot => { const item = itemById(p().equipment[slot.id]); const available = feature(`slot:${slot.id}`); return `<div class="lb-equipment-slot">${item ? itemTile(item, { equipped: true }) : `<button type="button" class="lb-item lb-item-empty" data-action="slot" data-id="${slot.id}" aria-label="${esc(slot.name)} ${available.unlocked ? 'ว่าง' : esc(available.reason)}"${!available.unlocked ? ' disabled' : ''}>${icon(available.unlocked ? slot.type || slot.id : 'lock')}${available.unlocked ? icon('plus', 'lb-slot-plus') : ''}</button>`}<span>${esc(slot.name)}</span>${!available.unlocked ? `<small class="lb-slot-requirement">จบ ${slot.unlockRuns} รอบ</small>` : ''}</div>`; }).join('')}</div>${statBlocks(personalLoadout().stats)}<div class="lb-gear-sets">${GEAR_SETS.filter(set => Object.values(p().equipment).some(id => defOf(itemById(id))?.set === set.id)).map(set => setInfo(set.id)).join('')}</div><div class="lb-panel-foot">${icon('info')}<span>แตะอุปกรณ์เพื่อเปรียบเทียบ อัปเกรด และหลอมรวม</span></div></section><section class="lb-panel lb-inventory-panel"><div class="lb-section-heading"><h2>คลังอุปกรณ์ <small>${inventory.length} / ${p().inventory.length}</small></h2>${button('สร้างอุปกรณ์', 'hero-view', { id: 'forge', iconName: 'forge', className: 'lb-btn-small lb-btn-text' })}</div><div class="lb-filter-row" aria-label="กรองอุปกรณ์">${[['all', 'ทั้งหมด'], ...slotTypes.map(type => [type, SLOTS.find(slot => slot.type === type)?.name || type])].map(([id, label]) => `<button type="button" class="lb-filter ${view.inventorySlot === id ? 'is-active' : ''}" data-action="filter" data-id="${id}">${esc(label)}</button>`).join('')}</div><div class="lb-filter-row lb-rarity-filters" aria-label="กรองความหายาก">${[['all', 'ทุกระดับ'], ...RARITIES.map((rarity, index) => [index, rarity.name])].map(([id, label]) => `<button type="button" class="lb-filter rarity-${id} ${view.inventoryRarity === id ? 'is-active' : ''}" data-action="rarity-filter" data-id="${id}">${id !== 'all' ? '<i></i>' : ''}${esc(label)}</button>`).join('')}</div><div class="lb-sort-row"><span>เรียงตาม</span>${[['rarity', 'ความหายาก'], ['level', 'ระดับ'], ['newest', 'ล่าสุด']].map(([id, label]) => `<button type="button" class="lb-sort ${view.inventorySort === id ? 'is-active' : ''}" data-action="sort" data-id="${id}" aria-pressed="${view.inventorySort === id}">${label}</button>`).join('')}</div>${inventory.length ? `<div class="lb-inventory-grid">${inventory.map(item => itemTile(item, { equipped: equipped.has(item.id) })).join('')}</div>` : empty('ไม่พบอุปกรณ์ที่เลือก', 'ลองเปลี่ยนตัวกรอง หรือรับอุปกรณ์เพิ่มจากการผจญภัยและโรงหลอม', 'forge')}<div class="lb-legend"><span><i class="lb-equipped-dot"></i>สวมใส่</span><span>${icon('lock')}ป้องกันการหลอมและแยกชิ้นส่วน</span></div></section></div>`;
  }
  function heroesView() {
    return `<div class="lb-card-grid lb-heroes-grid">${HEROES.map((entry, index) => {
      const state = p().heroes[entry.id];
      const level = state?.level || 0;
      const active = p().heroId === entry.id;
      const awakening = state?.awakening || 0;
      const awakened = level >= entry.maxLevel && state.stars >= entry.maxStars;
      const supportStats = Object.fromEntries(Object.entries(entry.support || {}).map(([key, value]) => [key, value * (1 + Math.max(0, level - 1) * .02 + awakening * .1)]));
      return `<article class="lb-panel lb-hero-card ${active ? 'is-equipped' : ''}"><div class="lb-card-topline">${tag(active ? 'นักรบหลัก' : level ? 'ปลดล็อกแล้ว' : 'ยังไม่ปลดล็อก', active ? 'lb-tag-gold' : '')}<span class="lb-stars">${'★'.repeat(state?.stars || 0)}${'☆'.repeat(Math.max(0, (entry.maxStars || 5) - (state?.stars || 0)))}</span></div><div class="lb-hero-card-art">${heroActorSvg({heroId:entry.id,skin:getSkinDefinition(getEquippedSkin(campaign,entry.id))})}</div><div class="lb-collection-title"><h2>${esc(nameOf(entry))}</h2><span>${level ? `Lv.${level}` : icon('lock')}</span></div><p class="lb-muted">${esc(entry.description)}</p><div class="lb-support-bonus"><span class="lb-stat-caption">โบนัสเมื่อเป็นผู้สนับสนุน${p().supportHeroId === entry.id ? ' · ใช้งานอยู่' : ''}</span>${statsMarkup(supportStats)}</div><div class="lb-card-actions">${level ? `${commandButton(active ? 'นักรบหลัก' : 'เลือกนักรบ', { type: 'SELECT_HERO', heroId: entry.id }, { disabled: active, iconName: active ? 'check' : 'hero' })}${commandButton('เพิ่มระดับ', { type: 'UPGRADE_HERO', heroId: entry.id }, { disabled: level >= entry.maxLevel, className: 'lb-btn-accent' })}${commandButton('เลื่อนดาว', { type: 'STAR_HERO', heroId: entry.id }, { disabled: state.stars >= (entry.maxStars || 5), iconName: 'star' })}${commandButton(p().supportHeroId === entry.id ? 'ถอดผู้สนับสนุน' : 'เป็นผู้สนับสนุน', { type: 'SELECT_SUPPORT', heroId: p().supportHeroId === entry.id ? null : entry.id }, { disabled: active || !feature('support').unlocked, className: 'lb-btn-text lb-btn-small' })}${commandButton(`ปลุกพลัง ${awakening} / ${entry.maxAwakening || 3}`, { type: 'AWAKEN_HERO', heroId: entry.id }, { disabled: !awakened || awakening >= (entry.maxAwakening || 3), iconName: 'spark', className: 'lb-btn-text lb-btn-small' })}` : commandButton('ปลดล็อกนักรบ', { type: 'UNLOCK_HERO', heroId: entry.id }, { className: 'lb-btn-accent', iconName: 'unlock', disabled: !feature(`hero:${entry.id}`).unlocked })}</div>${!level && !feature(`hero:${entry.id}`).unlocked ? `<p class="lb-unlock-reason">${icon('lock')}${esc(feature(`hero:${entry.id}`).reason)}</p>` : level && !feature('support').unlocked ? `<p class="lb-unlock-reason">ผู้สนับสนุน: ${esc(feature('support').reason)}</p>` : ''}<p class="lb-card-caption">ชิ้นส่วนนักรบ ${num(state?.shards || 0)} · รับจากการจบรอบผจญภัย</p>${level ? `<div class="lb-awakening-note"><span class="lb-stat-caption">ปลุกพลัง: ต้อง Lv.${entry.maxLevel} และ ${entry.maxStars} ดาว · โบนัสต่อขั้น</span>${statsMarkup(entry.awakeningStats || {})}</div>` : ''}</article>`;
    }).join('')}</div><div class="lb-tip">${icon('info')}<span>นักรบเปลี่ยนความสามารถในการต่อสู้ ส่วนสกินในตู้เสื้อผ้าเปลี่ยนเฉพาะรูปลักษณ์</span></div>`;
  }
  function forgeView() {
    return `${lockedPanel('forge')}<div class="lb-tip">${icon('forge')}<span>สร้างอุปกรณ์ Common ที่เลือกได้แน่นอน แล้วหลอมอุปกรณ์ชนิดและระดับความหายากเดียวกัน 3 ชิ้นเพื่อเลื่อนระดับ</span></div><div class="lb-card-grid lb-forge-grid">${EQUIPMENT.map(entry => `<article class="lb-panel lb-craft-card"><div class="lb-emblem">${icon(entry.icon || entry.slot)}</div><div><span class="lb-eyebrow">${esc(SLOTS.find(slot => slot.type === entry.slot)?.name || entry.slot)}</span><h2>${esc(nameOf(entry))}</h2><p class="lb-muted">${esc(entry.description)}</p></div>${statsMarkup(getItemStats({ definitionId: entry.id, rarity: 0, level: 1, refinement: 0, glyph: null }))}${commandButton('สร้างอุปกรณ์', { type: 'CRAFT_ITEM', definitionId: entry.id }, { className: 'lb-btn-accent', iconName: 'forge', disabled: !feature('forge').unlocked || !SLOTS.some(slot => slot.type === entry.slot && feature(`slot:${slot.id}`).unlocked) })}${!SLOTS.some(slot => slot.type === entry.slot && feature(`slot:${slot.id}`).unlocked) ? `<p class="lb-unlock-reason">${esc(feature(`slot:${SLOTS.find(slot => slot.type === entry.slot).id}`).reason)}</p>` : ''}</article>`).join('')}</div>`;
  }
  function presetsView() {
    return `<div class="lb-tip">${icon('preset')}<span>บันทึกชุดอุปกรณ์และพลังเสริม แล้วสลับกลับมาใช้ได้ทันที อุปกรณ์ในชุดที่บันทึกจะได้รับการป้องกันจากการหลอมและแยกชิ้นส่วน</span></div><div class="lb-card-grid">${[0, 1, 2].map(index => { const preset = p().presets[index]; const equipment = preset?.equipment || {}; return `<article class="lb-panel lb-preset-card"><div class="lb-section-heading"><h2>ชุดที่ ${index + 1}</h2>${tag(preset ? 'บันทึกแล้ว' : 'ช่องว่าง')}</div>${preset ? `<div class="lb-preset-items">${Object.values(equipment).filter(Boolean).map(id => { const item = itemById(id); return item ? itemTile(item) : ''; }).join('')}</div><p class="lb-muted">${esc(nameOf(find(HEROES, preset.heroId) || hero()))}</p>` : empty('วางแผนการต่อสู้', 'บันทึกชุดปัจจุบันลงในช่องนี้', 'preset')}<div class="lb-card-actions">${commandButton(preset ? 'บันทึกทับชุดนี้' : 'บันทึกชุดปัจจุบัน', { type: 'SAVE_PRESET', index }, { confirm: preset ? `บันทึกทับชุดที่ ${index + 1} ด้วยชุดปัจจุบัน?` : '', iconName: 'preset' })}${commandButton('ใช้ชุดนี้', { type: 'LOAD_PRESET', index }, { disabled: !preset, className: 'lb-btn-accent' })}</div></article>`; }).join('')}</div>`;
  }
  function heroView() {
    return `${heading('YOUR STARBOUND HERO', 'นักรบของคุณ', 'เตรียมอุปกรณ์และกำหนดสไตล์การต่อสู้')}${subnav([['equipment', 'อุปกรณ์', 'sword'], ['heroes', 'นักรบ', 'hero'], ['forge', 'โรงหลอม', 'forge'], ['presets', 'ชุดบันทึก', 'preset']], view.hero, 'hero')}${{ equipment: equipmentView, heroes: heroesView, forge: forgeView, presets: presetsView }[view.hero]()}`;
  }
  function collectionCard(entry, { level = 0, maxLevel = 10, mark = 'spark', command, equip, equipped = false, locked = false, extra = '', footer = '' }) {
    return `<article class="lb-panel lb-collection-card ${equipped ? 'is-equipped' : ''} ${locked ? 'is-locked' : ''}"><div class="lb-collection-head"><div class="lb-emblem">${icon(entry.icon || mark)}</div><div><span class="lb-eyebrow">${level ? `LEVEL ${level} / ${maxLevel}` : 'UNDISCOVERED'}</span><h2>${esc(nameOf(entry))}</h2></div>${equipped ? tag('ใช้งาน', 'lb-tag-gold') : ''}</div><p class="lb-muted">${esc(entry.description)}</p>${extra}${entry.stats ? '<span class="lb-stat-caption">โบนัสพื้นฐานต่อระดับ</span>' : ''}${statsMarkup(entry.stats || {})}<div class="lb-card-actions">${command ? commandButton(level >= maxLevel ? 'ระดับสูงสุด' : level ? 'อัปเกรด' : 'ปลดล็อก', command, { disabled: locked || level >= maxLevel, className: 'lb-btn-accent', iconName: level ? 'plus' : 'unlock' }) : ''}${equip ? commandButton(equipped ? 'ถอดออก' : 'สวมใส่', equip, { disabled: locked || !level, iconName: equipped ? 'check' : mark }) : ''}</div>${footer ? `<p class="lb-card-caption">${footer}</p>` : ''}</article>`;
  }
  function talentsView() {
    const unlocked = feature('talents').unlocked;
    return `${lockedPanel('talents')}<div class="lb-card-grid">${TALENTS.map(entry => collectionCard(entry, { level: levelOf(p().talents[entry.id]), maxLevel: entry.maxLevel || 10, mark: 'growth', command: { type: 'UPGRADE_TALENT', talentId: entry.id }, locked: !unlocked || Object.values(p().talents).reduce((sum, value) => sum + value, 0) < entry.requiresLevels })).join('')}</div><div class="lb-panel lb-inline-panel"><div><h2>เส้นทางที่เลือกใหม่ได้</h2><p class="lb-muted">คืนระดับพรสวรรค์เพื่อจัดสรรทรัพยากรใหม่</p></div>${commandButton('รีเซ็ตพรสวรรค์', { type: 'RESET_TALENTS' }, { disabled: !Object.values(p().talents).some(value => levelOf(value) > 0), iconName: 'reset', confirm: 'คืนระดับพรสวรรค์ทั้งหมดและรับทรัพยากรคืนตามระบบ? โบนัสพรสวรรค์ปัจจุบันจะถูกถอดออก' })}</div>`;
  }
  function relicsView() {
    const unlocked = feature('relics').unlocked;
    return `${lockedPanel('relics')}<div class="lb-tip">${icon('relic')}<span>สะสมชิ้นส่วนจากการผจญภัย วัตถุโบราณที่ปลดล็อกจะเพิ่มพลังติดตัวโดยไม่ต้องสวมใส่</span></div><div class="lb-card-grid">${RELICS.map(entry => { const state = p().relics[entry.id] || {}; const level = state.level || 0; return collectionCard(entry, { level, maxLevel: entry.maxLevel || 10, mark: 'relic', command: { type: level ? 'UPGRADE_RELIC' : 'UNLOCK_RELIC', relicId: entry.id }, locked: !unlocked, extra: `<div class="lb-collection-fragments">${icon('relic')}<span>ชิ้นส่วน ${num(state.fragments || 0)}</span><span class="lb-stars">${'★'.repeat(state.stars || 0)}${'☆'.repeat(Math.max(0, (entry.maxStars || 5) - (state.stars || 0)))}</span></div>${level ? commandButton('เลื่อนดาว', { type: 'STAR_RELIC', relicId: entry.id }, { disabled: !unlocked || state.stars >= (entry.maxStars || 5), className: 'lb-btn-text lb-btn-small', iconName: 'star' }) : ''}${relicConversion(entry, state)}` }); }).join('')}</div>`;
  }
  function runesView() {
    const unlocked = feature('runes').unlocked;
    const slots = [['attack', 'โจมตี'], ['defense', 'ป้องกัน'], ['utility', 'สนับสนุน']];
    return `${lockedPanel('runes')}<div class="lb-socket-row">${slots.map(([slot, label]) => { const entry = find(RUNES, p().runes.equipped[slot]); return `<div class="lb-panel lb-socket"><div class="lb-emblem">${icon('rune')}</div><span>${label}</span><strong>${entry ? esc(nameOf(entry)) : 'ช่องว่าง'}</strong>${entry ? commandButton('ถอด', { type: 'EQUIP_RUNE', runeId: null, slot }, { className: 'lb-btn-text lb-btn-small' }) : ''}</div>`; }).join('')}</div><div class="lb-card-grid">${RUNES.map(entry => { const level = levelOf(p().runes.owned[entry.id]); const slot = entry.category; return collectionCard(entry, { level, maxLevel: entry.maxLevel || 10, mark: 'rune', command: { type: 'UPGRADE_RUNE', runeId: entry.id }, locked: !unlocked, equipped: Object.values(p().runes.equipped).includes(entry.id), equip: { type: 'EQUIP_RUNE', runeId: p().runes.equipped[slot] === entry.id ? null : entry.id, slot }, footer: `ช่อง${slots.find(([id]) => id === slot)?.[1] || slot}` }); }).join('')}</div>`;
  }
  function jewelsView() {
    const unlocked = feature('jewels').unlocked;
    return `${lockedPanel('jewels')}<div class="lb-tip">${icon('jewel')}<span>ฝังอัญมณีลงในช่องอุปกรณ์ แต่ละอัญมณีใช้ได้หนึ่งช่องและถอดเปลี่ยนได้</span></div><div class="lb-card-grid">${JEWELS.map(entry => { const level = levelOf(p().jewels.owned[entry.id]); const equippedSlots = SLOTS.filter(slot => p().jewels.equipped[slot.id] === entry.id); return `<article class="lb-panel lb-collection-card ${equippedSlots.length ? 'is-equipped' : ''}"><div class="lb-collection-head"><div class="lb-emblem">${icon('jewel')}</div><div><span class="lb-eyebrow">${level ? `LEVEL ${level} / ${entry.maxLevel || 10}` : 'UNDISCOVERED'}</span><h2>${esc(nameOf(entry))}</h2></div></div><p class="lb-muted">${esc(entry.description)}</p>${entry.stats ? '<span class="lb-stat-caption">โบนัสพื้นฐานต่อระดับ</span>' : ''}${statsMarkup(entry.stats || {})}<div class="lb-card-actions">${commandButton(level ? 'อัปเกรด' : 'ปลดล็อก', { type: 'UPGRADE_JEWEL', jewelId: entry.id }, { disabled: !unlocked || level >= (entry.maxLevel || 10), className: 'lb-btn-accent' })}${button('เลือกช่องฝัง', 'jewel', { id: entry.id, disabled: !unlocked || !level, iconName: 'jewel' })}</div><p class="lb-card-caption">${equippedSlots.length ? `ฝังอยู่: ${equippedSlots.map(slot => esc(slot.name)).join(', ')}` : 'ยังไม่ได้ฝัง'}</p></article>`; }).join('')}</div>`;
  }
  function collectionView(kind) {
    const config = {
      artifacts: { catalog: ARTIFACTS, mark: 'artifact', singular: 'artifact', equipped: id => p().artifactId === id, field: 'artifactId', command: 'UPGRADE_ARTIFACT', equip: 'EQUIP_ARTIFACT', description: 'เลือกอาร์ติแฟกต์ได้ 1 ชิ้น พลังเฉพาะตัวจะทำงานจริงในการต่อสู้' },
      companions: { catalog: COMPANIONS, mark: 'companion', singular: 'companion', equipped: id => p().companionIds.includes(id), field: 'companionId', command: 'UPGRADE_COMPANION', equip: 'EQUIP_COMPANION', description: 'พาคู่หูร่วมเดินทางได้สูงสุด 2 ตัว แต่ละตัวสนับสนุนการต่อสู้ต่างกัน' },
      guardians: { catalog: GUARDIANS, mark: 'guardian', singular: 'guardian', equipped: id => p().guardianId === id, field: 'guardianId', command: 'UPGRADE_GUARDIAN', equip: 'EQUIP_GUARDIAN', description: 'เรียกผู้พิทักษ์ได้ 1 ตน เพื่อช่วยปกป้องนักรบระหว่างการต่อสู้' },
    }[kind];
    const unlocked = feature(kind).unlocked;
    return `${lockedPanel(kind)}<div class="lb-tip">${icon(config.mark)}<span>${config.description}</span></div><div class="lb-card-grid">${config.catalog.map(entry => { const equipped = config.equipped(entry.id); return collectionCard(entry, { level: levelOf(p()[kind][entry.id]), maxLevel: entry.maxLevel || 10, mark: config.mark, command: { type: config.command, [config.field]: entry.id }, equipped, equip: { type: config.equip, [config.field]: equipped && kind !== 'companions' ? null : entry.id }, locked: !unlocked }); }).join('')}</div>`;
  }
  function researchView() {
    const unlocked = feature('research').unlocked;
    return `${lockedPanel('research')}<div class="lb-material-bar">${resource('research', p().materials.research)}${resource('dust', p().materials.dust)}</div><div class="lb-card-grid">${RESEARCH.map(entry => collectionCard(entry, { level: levelOf(p().research[entry.id]), maxLevel: entry.maxLevel || 10, mark: 'research', command: { type: 'UPGRADE_RESEARCH', researchId: entry.id }, locked: !unlocked })).join('')}</div>`;
  }
  function homesteadView() {
    const unlocked = feature('homestead').unlocked;
    const pending = p().homestead.pending;
    return `${lockedPanel('homestead')}<div class="lb-panel lb-homestead-claim"><div class="lb-emblem">${icon('home')}</div><div><span class="lb-eyebrow">A PLACE TO RETURN</span><h2>ผลผลิตแห่งวิหาร</h2><p class="lb-muted">อาคารสร้างผลผลิตเมื่อจบการผจญภัย</p><div class="lb-material-bar">${Object.entries(pending).map(([key, value]) => resource(key, value)).join('')}</div></div>${commandButton('เก็บผลผลิต', { type: 'CLAIM_HOMESTEAD' }, { disabled: !unlocked || !Object.values(pending).some(value => value > 0), className: 'lb-btn-accent', iconName: 'chest' })}</div><div class="lb-card-grid">${BUILDINGS.map(entry => collectionCard(entry, { level: levelOf(p().homestead.buildings[entry.id]), maxLevel: entry.maxLevel || 10, mark: 'home', command: { type: 'UPGRADE_BUILDING', buildingId: entry.id }, locked: !unlocked })).join('')}</div>`;
  }
  function growthView() {
    const collections = [[RELICS, p().relics], [RUNES, p().runes.owned], [JEWELS, p().jewels.owned], [ARTIFACTS, p().artifacts], [COMPANIONS, p().companions], [GUARDIANS, p().guardians]];
    const total = collections.reduce((count, [catalog]) => count + catalog.length, 0);
    const owned = collections.reduce((count, [catalog, levels]) => count + catalog.filter(entry => levelOf(levels[entry.id]) > 0).length, 0);
    return `${heading('POWER BEYOND THE STARS', 'เส้นทางการเติบโต', 'สะสมพลังถาวร และสร้างรูปแบบการเล่นของคุณ', `<div class="lb-collection-total"><strong>${owned} <small>/ ${total}</small></strong><span>คอลเลกชันที่ค้นพบ</span></div>`)}${subnav(GROWTH, view.growth, 'growth')}<div data-growth-panel="${view.growth}">${{ talents: talentsView, relics: relicsView, runes: runesView, jewels: jewelsView, artifacts: () => collectionView('artifacts'), companions: () => collectionView('companions'), guardians: () => collectionView('guardians'), research: researchView, homestead: homesteadView }[view.growth]()}</div>`;
  }
  function rewardsMarkup(reward) {
    if (!reward) return '';
    if (typeof reward === 'string') return esc(reward);
    const parts = [];
    for (const [key, value] of Object.entries(reward)) {
      if (MATERIALS[key] && Number(value) > 0) parts.push(`<span>${icon(MATERIALS[key][1])}${num(value)} ${MATERIALS[key][0]}</span>`);
      else if (key === 'xp' || key === 'seasonXp') parts.push(`<span>${icon('spark')}${num(value)} ${key === 'seasonXp' ? 'แต้มบันทึก' : 'XP'}</span>`);
      else if (key === 'materials' && value && typeof value === 'object') parts.push(rewardsMarkup(value));
      else if (['item', 'definitionId', 'equipment'].includes(key) && typeof value === 'string') parts.push(`<span>${icon('chest')}${esc(nameOf(find(EQUIPMENT, value)))}</span>`);
      else if (key === 'relicFragments' && Array.isArray(value)) parts.push(...value.map(fragment => `<span>${icon('relic')}${esc(nameOf(find(RELICS, fragment.id)))} ×${num(fragment.amount)}</span>`));
      else if (key === 'heroShards' && value && typeof value === 'object') parts.push(`<span>${icon('hero')}ชิ้นส่วนนักรบ ${Object.values(value).reduce((sum, amount) => sum + Number(amount || 0), 0)}</span>`);
    }
    return parts.join('');
  }
  function missionsView() {
    const daily = MISSIONS.filter(entry => entry.period === 'daily');
    const weekly = MISSIONS.filter(entry => entry.period === 'weekly');
    const journey = MISSIONS.filter(entry => entry.period === 'lifetime');
    const cards = entries => `<div class="lb-mission-list">${entries.map(entry => { const progress = getMissionProgress(campaign, entry.id); return `<article class="lb-panel lb-mission ${progress.claimed ? 'is-claimed' : ''}"><div class="lb-mission-mark">${icon(entry.icon || (progress.claimed ? 'check' : 'events'))}</div><div class="lb-mission-body"><h2>${esc(nameOf(entry))}</h2><p class="lb-muted">${esc(missionDescription(entry))}</p><div class="lb-progress-label"><span>${progress.claimed ? 'รับรางวัลแล้ว' : progress.complete ? 'สำเร็จแล้ว' : 'ความคืบหน้า'}</span><strong>${num(Math.min(progress.current, progress.target))} / ${num(progress.target)}</strong></div><div class="lb-progress"><i style="width:${Math.min(100, progress.current / Math.max(1, progress.target) * 100)}%"></i></div><div class="lb-rewards">${rewardsMarkup(entry.reward || entry.rewards)}</div></div>${commandButton(progress.claimed ? 'รับแล้ว' : 'รับรางวัล', { type: 'CLAIM_MISSION', missionId: entry.id }, { disabled: progress.claimed || !progress.complete, className: progress.complete && !progress.claimed ? 'lb-btn-accent' : '', iconName: progress.claimed ? 'check' : 'chest' })}</article>`; }).join('')}</div>`;
    return `<div class="lb-tip">${icon('clock')}<span>รอบภารกิจใช้เวลา UTC และเปลี่ยนเป็นวันหรือสัปดาห์ใหม่เมื่อเริ่มการเล่นรอบถัดไป รับรางวัลที่ค้างก่อนออกเดินทาง</span></div>${daily.length ? `<div class="lb-section-heading"><h2>ภารกิจประจำวัน</h2>${tag(p().missions.day ? `${p().missions.day} UTC` : 'เริ่มรอบแรกเพื่อเปิด')}</div>${cards(daily)}` : ''}${weekly.length ? `<div class="lb-section-heading"><h2>ภารกิจประจำสัปดาห์</h2>${tag(p().missions.week ? `สัปดาห์ ${p().missions.week}` : 'เริ่มรอบแรกเพื่อเปิด')}</div>${cards(weekly)}` : ''}${journey.length ? `<div class="lb-section-heading"><h2>ความสำเร็จของนักเดินทาง</h2>${tag(`${journey.filter(entry => getMissionProgress(campaign, entry.id).claimed).length} / ${journey.length}`)}</div>${cards(journey)}` : ''}`;
  }
  function seasonView() {
    return `<section class="lb-chronicle-banner"><div class="lb-emblem">${icon('book')}</div><div><span class="lb-eyebrow">THE STARBOUND CHRONICLE</span><h2>บันทึกดวงดาว</h2><p>เส้นทางรางวัลฟรีถาวร รับแต้มจากการผจญภัยและภารกิจ</p></div><div class="lb-chronicle-xp"><strong>${num(p().season.xp)}</strong><span>แต้มบันทึก</span></div></section><div class="lb-season-grid">${SEASON_REWARDS.map((entry, index) => { const tier = entry.tier || index + 1; const needed = entry.xp || entry.requiredXp || tier * 100; const claimed = p().season.claimed.includes(tier); const ready = p().season.xp >= needed; return `<article class="lb-panel lb-season-card ${claimed ? 'is-claimed' : ready ? 'is-ready' : ''}"><div class="lb-card-topline"><span class="lb-eyebrow">TIER ${String(tier).padStart(2, '0')}</span>${tag('ฟรี', 'lb-tag-gold')}</div><div class="lb-season-chest">${icon(claimed ? 'check' : 'chest')}</div><h2>${esc(entry.name || `รางวัลขั้น ${tier}`)}</h2><div class="lb-rewards">${rewardsMarkup(entry.reward || entry.rewards || entry)}</div><p class="lb-card-caption">${num(needed)} แต้มบันทึก</p>${commandButton(claimed ? 'รับแล้ว' : ready ? 'รับรางวัล' : 'ยังไม่ถึงขั้น', { type: 'CLAIM_SEASON', tier }, { disabled: claimed || !ready, className: ready && !claimed ? 'lb-btn-accent' : '', iconName: claimed ? 'check' : undefined })}</article>`; }).join('')}</div><p class="lb-footnote">บันทึกนี้ไม่มีวันหมดอายุและไม่มีพาสแบบชำระเงิน</p>`;
  }
  function eventsView() {
    return `${heading('EVERY JOURNEY COUNTS', 'ภารกิจและรางวัล', 'รางวัลที่ได้รับจากความก้าวหน้าของคุณ')}${subnav([['missions', 'ภารกิจ', 'events'], ['season', 'บันทึกดวงดาว · ฟรี', 'book']], view.events, 'events')}${view.events === 'season' ? seasonView() : missionsView()}`;
  }
  function shopView() {
    return `${heading('THE STARLIGHT EXCHANGE', 'ตลาดแสงดาว', 'ใช้ทองและวัตถุดิบจากการเล่นแลกสิ่งที่ต้องการ')}${'<div class="lb-shop-banner"><div class="lb-emblem">' + icon('shop') + '</div><div><span class="lb-eyebrow">EARNED THROUGH ADVENTURE</span><h2>ของทุกชิ้นมีเส้นทางให้หา</h2><p>เลือกของรางวัลได้แน่นอน ไม่มีการสุ่มซื้อหรือใช้เงินจริง</p></div></div>'}<div class="lb-material-bar">${resource('gold', profile().gold)}${resource('essence', p().materials.essence)}${resource('research', p().materials.research)}${resource('dust', p().materials.dust)}</div><div class="lb-card-grid lb-shop-grid">${SHOP_OFFERS.map(entry => { const claimed = p().claimed.includes(`offer:${entry.id}`) || p().claimed.includes(entry.id); const unlocked = !entry.reward?.relicFragments || feature('relics').unlocked; return `<article class="lb-panel lb-offer"><div class="lb-emblem">${icon(entry.icon || 'chest')}</div><div class="lb-card-topline"><span class="lb-eyebrow">${entry.once ? 'ONE-TIME EXCHANGE' : 'SUPPLY EXCHANGE'}</span>${claimed && entry.once ? tag('รับแล้ว') : ''}</div><h2>${esc(nameOf(entry))}</h2><p class="lb-muted">${esc(entry.description)}</p><div class="lb-rewards">${rewardsMarkup(entry.reward || entry.rewards)}</div>${commandButton(claimed && entry.once ? 'แลกแล้ว' : 'แลกเปลี่ยน', { type: 'BUY_OFFER', offerId: entry.id }, { disabled: (claimed && entry.once) || !unlocked, className: 'lb-btn-accent', iconName: 'shop' })}${!unlocked ? `<p class="lb-unlock-reason">${esc(feature('relics').reason)}</p>` : ''}</article>`; }).join('')}</div><div class="lb-panel lb-inline-panel"><div><h2>คอลเลกชันรูปลักษณ์</h2><p class="lb-muted">ปรับสไตล์นักรบ สกินไม่มีผลกับค่าสถานะการต่อสู้</p></div>${button('เปิดตู้เสื้อผ้า', 'wardrobe', { iconName: 'wardrobe' })}</div>`;
  }
  function itemModal(itemId) {
    const item = itemById(itemId);
    if (!item) return empty('ไม่พบอุปกรณ์ชิ้นนี้', 'รายการอาจเปลี่ยนหลังการหลอมรวม กรุณาปิดหน้าต่างและเลือกอีกครั้ง');
    const definition = defOf(item);
    const slots = SLOTS.filter(slot => slot.type === definition.slot);
    const equippedSlot = slots.find(slot => p().equipment[slot.id] === item.id);
    const compareSlot = slots.find(slot => p().equipment[slot.id] && p().equipment[slot.id] !== item.id);
    const compareItem = compareSlot ? itemById(p().equipment[compareSlot.id]) : null;
    const candidates = getForgeCandidates(campaign, item.id).filter(candidate => (typeof candidate === 'string' ? candidate : candidate.id) !== item.id);
    const presetProtected = p().presets.some(preset => preset && Object.values(preset.equipment || {}).includes(item.id));
    const stats = getItemStats(item);
    return `<div class="lb-item-detail-head rarity-${item.rarity}"><div class="lb-emblem">${icon(definition.icon || definition.slot)}</div><div><span class="lb-eyebrow">${esc(rarityName(item.rarity))} · LEVEL ${item.level}</span><h2>${esc(nameOf(definition))}</h2><p>${esc(definition.description)}</p></div></div>${equippedSlot ? `<div class="lb-detail-note lb-positive">${icon('check')}สวมใส่อยู่ในช่อง${esc(equippedSlot.name)}</div>` : compareItem ? `<p class="lb-detail-note">เทียบกับ ${esc(nameOf(defOf(compareItem)))} · Lv.${compareItem.level} (${esc(compareSlot.name)})</p>` : '<p class="lb-detail-note">ยังไม่มีอุปกรณ์ประเภทนี้สวมใส่</p>'}${statsMarkup(stats, compareItem ? getItemStats(compareItem) : undefined)}${setInfo(definition.set)}<div class="lb-detail-meta">${tag(`ขัดเกลา ${item.refinement || 0}`)}${tag(item.glyph ? `จารึก: ${({ power: 'พลัง', guard: 'คุ้มกัน', haste: 'เร่งร่าย' })[item.glyph] || item.glyph}` : 'ยังไม่มีจารึก')}${item.locked ? tag('ล็อกแล้ว') : ''}${presetProtected ? tag('อยู่ในชุดบันทึก') : ''}</div><div class="lb-detail-actions">${equippedSlot ? commandButton('ถอดอุปกรณ์', { type: 'UNEQUIP_ITEM', slot: equippedSlot.id }, { iconName: 'sword' }) : slots.map(slot => commandButton(`สวมใส่${slots.length > 1 ? ` · ${slot.name}` : ''}`, { type: 'EQUIP_ITEM', itemId: item.id, slot: slot.id }, { iconName: 'sword', className: 'lb-btn-accent', disabled: !feature(`slot:${slot.id}`).unlocked })).join('')}${commandButton(item.locked ? 'ปลดล็อก' : 'ล็อกอุปกรณ์', { type: 'LOCK_ITEM', itemId: item.id, locked: !item.locked }, { iconName: item.locked ? 'unlock' : 'lock' })}</div><div class="lb-detail-section"><h3>เพิ่มพลังอุปกรณ์</h3>${commandButton('อัปเกรด 1 ระดับ', { type: 'UPGRADE_ITEM', itemId: item.id }, { className: 'lb-btn-accent', iconName: 'plus', disabled: item.level >= RARITIES[item.rarity].maxLevel })}<p class="lb-muted">สูงสุด Lv.${RARITIES[item.rarity].maxLevel} ในความหายากนี้ · ค่าพลังเพิ่มตามระดับและความหายากของอุปกรณ์</p></div><div class="lb-detail-section"><h3>หลอมรวม 3 ชิ้น</h3><p class="lb-muted">ใช้อุปกรณ์ชนิดและความหายากเดียวกัน 3 ชิ้น โดยชิ้นนี้เป็นชิ้นหลัก วัตถุดิบต้องไม่ถูกล็อก สวมใส่ หรืออยู่ในชุดบันทึก</p>${button(`เลือกวัตถุดิบ (${candidates.length} ชิ้น)`, 'fusion', { id: item.id, iconName: 'forge', disabled: !feature('forge').unlocked || candidates.length < 2 || item.rarity >= 5 })}</div><div class="lb-detail-section"><h3>ขัดเกลาและจารึก</h3><div class="lb-detail-actions">${commandButton('ขัดเกลา', { type: 'REFINE_ITEM', itemId: item.id }, { iconName: 'spark', disabled: !feature('refine').unlocked || item.rarity < 2 || item.refinement >= 10 })}${button('เลือกจารึก', 'glyph', { id: item.id, iconName: 'rune', disabled: !feature('glyph').unlocked || item.rarity < 2 })}</div><p class="lb-muted">${!feature('refine').unlocked ? esc(feature('refine').reason) + ' · ' : ''}ใช้อุปกรณ์หายากขึ้นไป · ขัดเกลาได้สูงสุด 10 ขั้น · จารึกได้ 1 แบบ</p></div><div class="lb-detail-section"><h3>จัดการทรัพยากร</h3><div class="lb-detail-actions">${commandButton('รีเซ็ตระดับ', { type: 'RESET_ITEM', itemId: item.id }, { disabled: item.level <= 1, iconName: 'reset', confirm: 'รีเซ็ตระดับอุปกรณ์ชิ้นนี้? คืนทองและแก่นเวทที่ลงทุนอัปเกรดไว้ โดยยังเก็บความหายากเดิม' })}${commandButton('แยกชิ้นส่วน', { type: 'DISMANTLE_ITEM', itemId: item.id }, { disabled: Boolean(item.locked || equippedSlot || presetProtected || item.refinement > 0 || item.glyph), className: 'lb-btn-danger', confirm: 'แยกอุปกรณ์ชิ้นนี้เป็นวัตถุดิบ? อุปกรณ์จะถูกลบออกจากคลัง การดำเนินการนี้ย้อนกลับไม่ได้' })}</div>${item.locked || equippedSlot || presetProtected || item.refinement > 0 || item.glyph ? '<p class="lb-muted">อุปกรณ์ที่ล็อก สวมใส่ อยู่ในชุดบันทึก ขัดเกลา หรือมีจารึกจะไม่ถูกแยกชิ้นส่วน</p>' : ''}</div>`;
  }
  function modalContent() {
    if (modal.type === 'item') return itemModal(modal.id);
    if (modal.type === 'chapters') return `<div class="lb-chapter-list">${CHAPTERS.map((entry, index) => { const selected = p().chapterId === entry.id; const cleared = p().cleared.includes(entry.id); return `<article class="lb-panel lb-chapter-choice">${chapterArt(entry.id)}<div><span class="lb-eyebrow">CHAPTER ${String(index + 1).padStart(2, '0')}</span><h2>${esc(nameOf(entry))}</h2><p class="lb-muted">${esc(entry.description)}</p>${tag(cleared ? 'พิชิตแล้ว' : index === 0 || p().cleared.includes(CHAPTERS[index - 1]?.id) ? 'พร้อมผจญภัย' : `พิชิตบท ${index} เพื่อปลดล็อก`)}${commandButton(selected ? 'บทปัจจุบัน' : 'เลือกบทนี้', { type: 'SELECT_CHAPTER', chapterId: entry.id }, { disabled: selected || (index > 0 && !p().cleared.includes(CHAPTERS[index - 1].id)), className: 'lb-btn-accent' })}</div></article>`; }).join('')}</div>`;
    if (modal.type === 'modes') return `<div class="lb-choice-list">${MODES.map(entry => { const availability = feature(`mode:${entry.id}`); const selected = p().mode === entry.id; return `<article class="lb-panel lb-mode-choice"><div class="lb-emblem">${icon(entry.icon)}</div><div><h2>${esc(nameOf(entry))}</h2><p class="lb-muted">${esc(entry.description)}</p>${!availability.unlocked ? `<p class="lb-unlock-reason">${icon('lock')}${esc(availability.reason)}</p>` : ''}</div>${commandButton(selected ? 'โหมดปัจจุบัน' : 'เลือกโหมด', { type: 'SELECT_MODE', mode: entry.id }, { disabled: selected || !availability.unlocked, className: 'lb-btn-accent' })}</article>`; }).join('')}</div>`;
    if (modal.type === 'fusion') {
      const main = itemById(modal.id);
      const candidates = getForgeCandidates(campaign, modal.id).map(candidate => typeof candidate === 'string' ? itemById(candidate) : candidate).filter(candidate => candidate && candidate.id !== modal.id);
      return `<div class="lb-fusion-target">${itemTile(main)}${icon('chevron')}<div class="lb-emblem rarity-${Math.min(5, main.rarity + 1)}">${icon(defOf(main)?.icon || defOf(main)?.slot)}</div><div><strong>${esc(rarityName(Math.min(5, main.rarity + 1)))}</strong><p class="lb-muted">ชิ้นหลักจะเลื่อนความหายาก</p></div></div><p class="lb-muted">เลือกวัตถุดิบ 2 ชิ้น วัตถุดิบจะถูกใช้ในการหลอมรวม</p><div class="lb-inventory-grid">${candidates.map(item => itemTile(item, { selected: modal.selected.includes(item.id), action: 'fusion-select' })).join('')}</div>${rewardReview({ type: 'FUSE_ITEMS', itemIds: [modal.id, ...modal.selected] }, 'คืนทรัพยากรที่เคยอัปเกรดวัตถุดิบ')}<div class="lb-modal-bottom">${commandButton(`หลอมรวม · เลือก ${modal.selected.length}/2`, { type: 'FUSE_ITEMS', itemIds: [modal.id, ...modal.selected] }, { disabled: modal.selected.length !== 2, className: 'lb-btn-primary', iconName: 'forge', confirm: 'หลอมรวมอุปกรณ์ทั้ง 3 ชิ้น? ชิ้นหลักจะเลื่อนความหายาก และวัตถุดิบอีก 2 ชิ้นจะถูกใช้ไป' })}</div>`;
    }
    if (modal.type === 'glyph') return `<p class="lb-muted">เลือกจารึกได้หนึ่งแบบต่ออุปกรณ์ การจารึกใหม่จะแทนที่แบบเดิม</p><div class="lb-choice-list">${[['power', 'พลัง', 'เพิ่มพลังโจมตี 1.5', 'sword'], ['guard', 'คุ้มกัน', 'เพิ่มพลังชีวิต 8', 'shield'], ['haste', 'เร่งร่าย', 'ลดช่วงโจมตี 0.006 วินาที', 'spark']].map(([glyph, name, description, mark]) => `<article class="lb-panel lb-glyph-choice"><div class="lb-emblem">${icon(mark)}</div><div><h2>${name}</h2><p class="lb-muted">${description}</p></div>${commandButton('จารึก', { type: 'GLYPH_ITEM', itemId: modal.id, glyph }, { className: 'lb-btn-accent', disabled: itemById(modal.id)?.glyph === glyph })}</article>`).join('')}</div>`;
    if (modal.type === 'jewel') return `<p class="lb-muted">เลือกช่องอุปกรณ์ที่จะฝัง ${esc(nameOf(find(JEWELS, modal.id)))} อัญมณีที่อยู่เดิมจะถูกถอดกลับมา</p><div class="lb-choice-list">${SLOTS.map(slot => { const equipped = p().jewels.equipped[slot.id]; return `<article class="lb-panel lb-jewel-choice">${icon(slot.type)}<div><strong>${esc(slot.name)}</strong><p class="lb-muted">${equipped ? esc(nameOf(find(JEWELS, equipped))) : 'ยังไม่ได้ฝัง'}</p></div>${commandButton(equipped === modal.id ? 'ถอดออก' : 'ฝังช่องนี้', { type: 'EQUIP_JEWEL', jewelId: equipped === modal.id ? null : modal.id, slot: slot.id }, { className: equipped === modal.id ? '' : 'lb-btn-accent', disabled: !p().equipment[slot.id] && equipped !== modal.id })}</article>`; }).join('')}</div>`;
    if (modal.type === 'confirm') return `<div class="lb-confirm-icon">${icon('info')}</div><p class="lb-confirm-text">${esc(modal.text)}</p>${rewardReview(modal.command, ['FUSE_ITEMS', 'RESET_ITEM', 'RESET_TALENTS'].includes(modal.command.type) ? 'ทรัพยากรที่จะคืนให้' : 'ทรัพยากรที่จะได้รับ')}<div class="lb-detail-actions">${button('กลับ', 'cancel-confirm')}${commandButton('ยืนยัน', modal.command, { className: 'lb-btn-accent' })}</div>`;
    return '';
  }
  function modalMarkup() {
    const titles = { item: 'รายละเอียดอุปกรณ์', chapters: 'เลือกเส้นทาง', modes: 'เลือกโหมดการเล่น', fusion: 'หลอมรวมอุปกรณ์', glyph: 'จารึกอุปกรณ์', jewel: 'ฝังอัญมณี', confirm: 'ยืนยันการเปลี่ยนแปลง' };
    return `<div class="lb-modal-backdrop" data-modal-backdrop><section class="lb-modal" role="dialog" aria-modal="true" aria-labelledby="${uid}-modal-title"><header class="lb-modal-header"><h2 id="${uid}-modal-title">${titles[modal.type]}</h2><button type="button" class="lb-icon-button" data-action="close-modal" aria-label="ปิด"${busy ? ' disabled' : ''}>${icon('close')}</button></header><div class="lb-modal-scroll">${modalContent()}</div></section></div>`;
  }
  function showNotice(text, error = false) {
    notice = { text, error };
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { if (!disposed) { notice = null; const el = host.querySelector('.lb-notice'); el?.remove(); } }, error ? 7000 : 3500);
  }
  function render({ resetScroll = false, focusModal = false } = {}) {
    if (disposed) return;
    const scroll = resetScroll ? 0 : host.querySelector('.lb-scroll')?.scrollTop || 0;
    const modalScroll = host.querySelector('.lb-modal-scroll')?.scrollTop || 0;
    const focus = host.contains(document.activeElement) ? document.activeElement : null;
    // The command payload is its stable identity. Keep it across the disabled
    // saving render so keyboard focus returns to the same card after commit.
    const focusKey = focus ? ['data-action', 'data-payload', 'data-id', 'data-lobby-tab', 'data-subtab', 'data-scope'].filter(key => focus.hasAttribute(key)).map(key => `[${key}="${CSS.escape(focus.getAttribute(key))}"]`).join('') : '';
    if (focusKey) focusIdentity = focusKey;
    const content = { adventure, hero: heroView, growth: growthView, events: eventsView, shop: shopView }[view.tab]();
    host.innerHTML = `<div class="lobby-shell${busy ? ' is-busy' : ''}" data-vfx="${esc(profile().settings.vfx)}"${modal ? ' data-modal-open="true"' : ''}><div class="lb-base"${profile().settings.reduceMotion ? ' data-reduce-motion="true"' : ''}${modal ? ' inert' : ''}>${header()}<div class="lb-scroll" tabindex="-1"><main class="lb-content lb-view-${view.tab}" data-lobby-panel="${view.tab}">${content}</main></div><nav class="lb-nav" aria-label="เมนูหลัก">${TABS.map(([id, label, mark]) => `<button type="button" class="lb-nav-tab ${view.tab === id ? 'is-active' : ''} ${id === 'adventure' ? 'lb-nav-adventure' : ''}" data-lobby-tab="${id}" aria-label="${label}"${view.tab === id ? ' aria-current="page"' : ''}${busy ? ' disabled' : ''}><span class="lb-nav-icon">${icon(mark)}</span><span>${label}</span>${id === 'events' && MISSIONS.some(entry => { const progress = getMissionProgress(campaign, entry.id); return progress.complete && !progress.claimed; }) ? '<i class="lb-nav-dot"></i>' : ''}</button>`).join('')}</nav></div>${modal ? modalMarkup() : ''}${notice ? `<div class="lb-notice ${notice.error ? 'is-error' : ''}" role="${notice.error ? 'alert' : 'status'}">${icon(notice.error ? 'info' : 'check')}<span>${esc(notice.text)}</span></div>` : ''}${busy ? '<div class="lb-saving" role="status">กำลังบันทึก…</div>' : ''}</div>`;
    host.querySelector('.lb-scroll').scrollTop = scroll;
    if (modal && host.querySelector('.lb-modal-scroll')) host.querySelector('.lb-modal-scroll').scrollTop = focusModal ? 0 : modalScroll;
    if (focusModal) {
      focusIdentity = '[data-action="close-modal"]';
      host.querySelector('.lb-modal [data-action="close-modal"]')?.focus({ preventScroll: true });
    } else if (!busy && focusIdentity) host.querySelector(focusIdentity)?.focus({ preventScroll: true });
  }
  function openModal(next) {
    if (!modal) returnFocus = document.activeElement;
    modal = next;
    render({ focusModal: true });
  }
  function closeModal() {
    if (busy) return;
    const focusAction = returnFocus?.getAttribute('data-action');
    const focusId = returnFocus?.getAttribute('data-id');
    modal = null;
    render();
    if (focusAction) host.querySelector(`[data-action="${CSS.escape(focusAction)}"]${focusId ? `[data-id="${CSS.escape(focusId)}"]` : ''}`)?.focus({ preventScroll: true });
    returnFocus = null;
  }
  async function execute(command) {
    if (busy || disposed) return;
    busy = true;
    const ticket = ++serial;
    render();
    try {
      const result = await options.onCommand(command);
      if (disposed || ticket !== serial) return;
      if (result?.state) campaign = result.state;
      if (!result?.ok) showNotice(ERROR_MESSAGES[result?.code] || result?.details?.message || ({ STORAGE_FAILED: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง ความก้าวหน้าเดิมยังอยู่', CONFLICT: 'ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณาลองอีกครั้ง' })[result?.code] || 'ยังทำรายการนี้ไม่ได้ กรุณาตรวจเงื่อนไขและทรัพยากรแล้วลองอีกครั้ง', true);
      else {
        showNotice(SUCCESS[command.type] || 'บันทึกความก้าวหน้าแล้ว');
        if (modal?.type === 'confirm') modal = modal.previous || null;
        if (command.type === 'FUSE_ITEMS') modal = { type: 'item', id: command.itemIds[0] };
        if (command.type === 'DISMANTLE_ITEM' || command.type === 'SELECT_CHAPTER' || command.type === 'SELECT_MODE') modal = null;
        if (command.type === 'GLYPH_ITEM') modal = { type: 'item', id: command.itemId };
      }
    } catch {
      if (!disposed) showNotice('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง ความก้าวหน้าเดิมยังอยู่', true);
    } finally {
      if (!disposed && ticket === serial) { busy = false; render(); }
    }
  }
  function changeTab(tab) {
    if (!TABS.some(([id]) => id === tab)) return;
    view.tab = tab;
    modal = null;
    render({ resetScroll: true });
  }
  async function handleClick(event) {
    const target = event.target.closest('button');
    if (!target || !host.contains(target)) return;
    event.stopPropagation();
    if (target.disabled || busy) return;
    if (target.dataset.lobbyTab) return changeTab(target.dataset.lobbyTab);
    if (target.dataset.subtab) { view[target.dataset.scope] = target.dataset.subtab; render({ resetScroll: true }); return; }
    if (target.dataset.command) {
      const command = JSON.parse(target.dataset.payload);
      if (target.dataset.confirm) { openModal({ type: 'confirm', text: target.dataset.confirm, command, previous: modal }); return; }
      await execute(command); return;
    }
    const { action, id } = target.dataset;
    if (action === 'tab') return changeTab(id);
    if (action === 'hero-view') { view.hero = id; return changeTab('hero'); }
    if (action === 'filter') { view.inventorySlot = id; render(); return; }
    if (action === 'rarity-filter') { view.inventoryRarity = id === 'all' ? 'all' : Number(id); render(); return; }
    if (action === 'sort') { view.inventorySort = id; render(); return; }
    if (action === 'slot') { view.inventorySlot = find(SLOTS, id)?.type || 'all'; render(); host.querySelector('.lb-inventory-panel')?.scrollIntoView({ block: 'nearest' }); return; }
    if (action === 'item') return openModal({ type: 'item', id });
    if (action === 'fusion') return openModal({ type: 'fusion', id, selected: [] });
    if (action === 'fusion-select') { if (modal.selected.includes(id)) modal.selected = modal.selected.filter(value => value !== id); else if (modal.selected.length < 2) modal.selected.push(id); render(); return; }
    if (action === 'glyph' || action === 'jewel') return openModal({ type: action, id });
    if (action === 'chapters' || action === 'modes') return openModal({ type: action });
    if (action === 'close-modal') return closeModal();
    if (action === 'cancel-confirm') { modal = modal.previous; render({ focusModal: Boolean(modal) }); return; }
    if (action === 'wardrobe') return options.onWardrobe?.();
    if (action === 'settings') return options.onSettings?.();
    if (action === 'start') {
      busy = true; render();
      try { const result = await options.onStart({ chapterId: p().chapterId, mode: p().mode }); if (!disposed && result?.ok === false) showNotice(ERROR_MESSAGES[result.code] || 'เริ่มการผจญภัยไม่สำเร็จ กรุณาลองอีกครั้ง', true); }
      catch { if (!disposed) showNotice('เริ่มการผจญภัยไม่สำเร็จ กรุณาลองอีกครั้ง', true); }
      finally { if (!disposed) { busy = false; render(); } }
    }
  }
  function handleKey(event) {
    if (!modal || disposed) return;
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
    if (event.key !== 'Tab') return;
    const focusable = [...host.querySelectorAll('.lb-modal button:not(:disabled), .lb-modal [tabindex="0"]')];
    const first = focusable[0]; const last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  host.addEventListener('click', handleClick);
  host.addEventListener('keydown', handleKey);
  render();
  return {
    update(nextCampaign) { if (disposed) return; campaign = nextCampaign; render(); },
    getViewState() { return { ...view }; },
    dispose() { disposed = true; serial++; clearTimeout(noticeTimer); host.removeEventListener('click', handleClick); host.removeEventListener('keydown', handleKey); },
  };
}

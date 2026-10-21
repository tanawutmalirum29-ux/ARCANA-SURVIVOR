// Original, code-native marks used by the Astral lobby. No remote image requests.
const paths = {
  star: '<path d="m12 2 2.8 6.3 6.9.7-5.2 4.5 1.5 6.8-6-3.5-6 3.5 1.5-6.8L2.3 9l6.9-.7Z"/>',
  spark: '<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z"/>',
  gold: '<circle cx="12" cy="12" r="8.5"/><path d="m12 6 4 6-4 6-4-6Z"/>',
  essence: '<path d="m12 2 7 8-2 10H7L5 10Z"/><path d="m5 10 7 4 7-4M12 2v12l-5 6m5-6 5 6"/>',
  research: '<path d="M7 3h10M9 3v7L4 19q-.5 2 2 2h12q2.5 0 2-2l-5-9V3M7 15h10"/><path d="m10 17 1 1m3-5 1 1"/>',
  dust: '<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z"/><path d="m20 2 1 1M3 4l1 1m15 14 2 2M3 20l1-1"/>',
  adventure: '<path d="m3 19 6-14 3 6 3-3 6 11Z"/><path d="m7 10 2 2 2-2m2 3 2 2 2-2M12 3l2-1 2 1 2-1v5l-2 1-2-1-2 1"/>',
  hero: '<path d="m12 2 5 5-1 6-4 3-4-3-1-6Z"/><path d="m8 13-4 6 8 3 8-3-4-6M8 8l4 2 4-2"/>',
  growth: '<path d="M12 21V9m0 7-7-4m7 0 7-4M5 12V6m14 2V3"/><path d="m12 2 3 4-3 4-3-4ZM3 3h4v4H3Zm14-2h4v4h-4ZM3 10h4v4H3Zm14-4h4v4h-4Z"/>',
  shop: '<path d="M4 9h16l-2-6H6ZM5 9v11h14V9M9 20v-7h6v7"/><path d="M3 9q0 4 3 4t3-4q0 4 3 4t3-4q0 4 3 4t3-4"/>',
  events: '<path d="M5 5h14v16H5ZM8 2v6m8-6v6M5 10h14"/><path d="m12 12 1.2 2.4 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4Z"/>',
  settings: '<path d="m10 2-.7 3-2.5 1.4L4 5.5 2 9l2.3 2v2L2 15l2 3.5 2.8-.9L9.3 19l.7 3h4l.7-3 2.5-1.4 2.8.9 2-3.5-2.3-2v-2L22 9l-2-3.5-2.8.9L14.7 5 14 2Z"/><circle cx="12" cy="12" r="3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0m-4 9v2"/>',
  sword: '<path d="m15 3 6-1-1 6-11 11-4-4ZM5 13l6 6m-8 2 5-5M2 20l2 2"/>',
  wand: '<path d="m4 21 11-11m-4-6 4-3 3 4 4 3-4 3-3 4-3-4-4-3Z"/><path d="m4 3 1 2M2 9h2m16 8 2 1"/>',
  armor: '<path d="m8 3 4 2 4-2 5 4-3 5-2-1v10H8V11l-2 1-3-5Z"/><path d="m9 7 3 2 3-2m-3 2v8"/>',
  ring: '<circle cx="12" cy="14" r="7"/><path d="m8 4 4-3 4 3-4 5Z"/>',
  locket: '<path d="M5 3q1 10 7 10T19 3"/><path d="m12 10 5 5-5 7-5-7Z"/>',
  book: '<path d="M12 5Q7 1 2 4v15q5-3 10 1 5-4 10-1V4q-5-3-10 1Zm0 0v15M5 7l4 1m6 0 4-1M5 11l4 1m6 0 4-1"/>',
  bracelet: '<ellipse cx="12" cy="13" rx="9" ry="6"/><path d="M3 10v4m18-4v4M5 8l3-4h8l3 4m-7 2 3 3-3 3-3-3Z"/>',
  spirit: '<path d="M12 2c7 4 10 10 7 16l-3-2-1 5-3-3-3 3-1-5-3 2C2 12 5 6 12 2Z"/><path d="m8 10 2 2m6-2-2 2"/>',
  relic: '<circle cx="12" cy="12" r="9"/><path d="m12 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm-8-1 2 2m12-2-2 2m-12 12 2-2m12 2-2-2"/>',
  artifact: '<path d="M6 2h12M6 22h12M7 2q0 6 5 10-5 4-5 10M17 2q0 6-5 10 5 4 5 10M8 5h8m-8 14h8"/>',
  rune: '<path d="m12 2 8 5v10l-8 5-8-5V7Z"/><path d="m8 8 4-3v14m-4-5 8-4m-4 5 4 3"/>',
  jewel: '<path d="m6 3-4 6 10 13L22 9l-4-6ZM2 9h20M6 3l6 19 6-19M6 3h12"/>',
  companion: '<path d="M12 9Q7 0 3 3q-3 4 5 9-7 7-3 9 5 1 7-7 2 8 7 7 4-2-3-9 8-5 5-9-4-3-9 6Z"/><path d="M12 6v13"/>',
  guardian: '<path d="m12 2 9 4-2 10-7 6-7-6L3 6Z"/><path d="m7 10 5-4 5 4-5 7Z"/>',
  home: '<path d="m2 10 10-8 10 8M5 8v13h14V8M9 21v-7h6v7M9 8h6"/>',
  forge: '<path d="m3 5 5-3 9 9-5 3Zm11 8 7 7-2 2-7-7M3 19h8v3H3Zm1-4h6v4H4Z"/>',
  chest: '<path d="M3 11h18v10H3ZM3 11V8q0-5 5-5h8q5 0 5 5v3M7 3v8m10-8V3"/><path d="M10 10h4v6h-4Z"/>',
  crown: '<path d="m3 6 5 4 4-7 4 7 5-4-3 14H6ZM6 16h12"/>',
  heart: '<path d="M12 21 3 12C-3 4 8-1 12 7c4-8 15-3 9 5Z"/>',
  shield: '<path d="m12 2 9 4-2 10-7 6-7-6L3 6ZM12 2v20M3 6l18 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  preset: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  wardrobe: '<path d="M10 6a2 2 0 1 1 4 0q0 1-2 3v2L2 18v2h20v-2l-10-7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

export function icon(name, extraClass = '') {
  const aliases = { weapon: 'wand', '✦': 'spark', '↟': 'wand', '⌁': 'wand', '♜': 'guardian', '⬡': 'shield', '◉': 'relic', '◎': 'ring', '◇': 'relic', '▣': 'book', '⟐': 'bracelet', '☾': 'spirit', '✷': 'spark', '⚔': 'sword', '◆': 'jewel', '✧': 'essence', '♛': 'crown', '⌖': 'adventure', '☀': 'star', '∞': 'reset', '◈': 'rune', '♦': 'jewel', '⌛': 'artifact', '◕': 'companion', '♧': 'growth', '♨': 'guardian', '⌘': 'research', '▤': 'book', '✓': 'check' };
  return `<svg class="lb-icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[aliases[name] || name] || paths.spark}</svg>`;
}

export function heroArt(heroId = 'mage', color = '#98c7ff', id = 'hero') {
  const ranger = heroId === 'ranger';
  const knight = heroId === 'guardian';
  return `<svg class="lb-hero-art" viewBox="0 0 320 350" role="img" aria-label="นักรบอาร์คานาบนแท่นดวงดาว">
    <defs><linearGradient id="${id}-cloak" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset=".28" stop-color="#6175b9"/><stop offset="1" stop-color="#121b3d"/></linearGradient><linearGradient id="${id}-gold" x2="0" y2="1"><stop stop-color="#fff2c9"/><stop offset="1" stop-color="#ab8050"/></linearGradient><radialGradient id="${id}-aura"><stop stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient><filter id="${id}-glow"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <ellipse cx="160" cy="305" rx="103" ry="25" fill="url(#${id}-aura)"/>
    <g class="lb-art-rune" fill="none" stroke="${color}" opacity=".42"><ellipse cx="160" cy="305" rx="110" ry="30"/><ellipse cx="160" cy="305" rx="89" ry="23" stroke-dasharray="25 9 3 9"/><path d="m64 298 96-24 96 24-96 28Z"/></g>
    <circle cx="160" cy="160" r="118" fill="url(#${id}-aura)"/>
    <g class="lb-art-float">
      <path d="M142 90q-38 42-58 164l60 28 56-8 37-24q-22-75-59-154Z" fill="#0a102c" stroke="#99a5dc" stroke-opacity=".2"/>
      <path d="M142 93q-20 20-25 67l-19 94 50 21 55-3 28-23q-27-78-53-150Z" fill="url(#${id}-cloak)"/>
      <path d="m139 116-23 51-18 87 27-14 13-54 4 63 15 24 16-22 9-74 17 78 29-6-48-136Z" fill="#18284e" opacity=".8"/>
      <path d="m118 160 24-35 18 37 22-37 20 41-22 21h-40Z" fill="url(#${id}-cloak)" stroke="#d2c296" stroke-width="2"/>
      <path d="m147 273-7 27 16 3 9-31m11 0 8 29 17-4-11-26" fill="#111a35" stroke="#8b8ea6"/>
      <path d="m124 161-16 30-12-2-13-38 10-5 13 21 15-18m76 16 17 30 13-3 12-39-12-4-13 23-15-23" fill="url(#${id}-cloak)" stroke="#b7c9ef" stroke-opacity=".45"/>
      <path d="m117 116 20-39 25-16 25 16 21 39-25 25h-44Z" fill="url(#${id}-cloak)" stroke="#c9c5be" stroke-width="1.5"/>
      <path d="m133 111 28-30 28 30-9 29h-38Z" fill="#080f26"/>
      <path d="m145 117 11 2m10 0 11-2" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
      <path d="m140 99 21-25 19 23M132 118l9 21 20 16 20-16 9-22" fill="none" stroke="url(#${id}-gold)" stroke-width="2"/>
      <path d="m160 147 8 15-8 12-8-12Z" fill="url(#${id}-gold)"/>
      <path d="m140 195 20 6 23-6-1 9-21 6-21-6Z" fill="url(#${id}-gold)"/>
      ${ranger ? `<path d="M237 83q47 55-2 120l-7-6q34-57-1-110Z" fill="url(#${id}-gold)"/><path d="m231 87 5 109m-22-48 45-2-7-4m7 4-6 4" fill="none" stroke="${color}" stroke-width="2"/>` : knight ? `<path d="m227 105 12-14 8 14-10 87-9 0Z" fill="url(#${id}-gold)"/><path d="m216 187 35 4m-20 0-2 35" fill="none" stroke="#d9b583" stroke-width="6"/>` : `<path d="m229 95-7 175" stroke="#a99069" stroke-width="6"/><path d="m228 82 17 21-18 25-17-25Z" fill="#172a55" stroke="url(#${id}-gold)" stroke-width="2"/><path d="m228 92 10 11-11 13-8-13Z" fill="${color}"/><circle cx="229" cy="103" r="12" fill="${color}" opacity=".55" filter="url(#${id}-glow)"/>`}
      <g fill="${color}"><path d="m74 131 3-10 3 10 10 3-10 3-3 10-3-10-10-3Z"/><circle cx="199" cy="57" r="2"/><circle cx="111" cy="78" r="2"/><circle cx="257" cy="189" r="2"/><path d="m100 209 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" opacity=".7"/></g>
    </g>
  </svg>`;
}

export function chapterArt(chapterId = 'astral') {
  const bright = chapterId === 'citadel' ? '#b49add' : chapterId === 'grove' ? '#91bea7' : '#97bbd2';
  return `<svg class="lb-chapter-art" viewBox="0 0 500 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="map-${chapterId}" x2="1" y2="1"><stop stop-color="${bright}" stop-opacity=".2"/><stop offset="1" stop-color="#101c34"/></linearGradient></defs><path fill="url(#map-${chapterId})" d="M0 0h500v150H0z"/><circle cx="385" cy="40" r="30" fill="${bright}" opacity=".16"/><g fill="#17233a" stroke="${bright}" stroke-opacity=".16"><path d="m0 110 85-80 42 41 45-27 110 86 67-61 47 28 52-48 52 32v69H0Z"/><path d="m280 130 20-68 13-4V25l9-12 10 12v26l15 7 7 73m-72-1h80m-68-60h61M310 38h20"/><path d="m99 130 10-26 41-11 12 23 16 9 67 15-13 10H74Z"/></g><path d="m209 150 31-32 53-6 11-19h22l-13 25-53 10-14 22" fill="${bright}" opacity=".13"/><g fill="${bright}" opacity=".5"><circle cx="83" cy="20" r="1"/><circle cx="230" cy="30" r="1"/><circle cx="450" cy="19" r="1.3"/></g></svg>`;
}

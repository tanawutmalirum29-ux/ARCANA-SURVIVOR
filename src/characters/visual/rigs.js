// Canonical actor geometry extracted from the original lobby heroArt in src/ui/icons.js.
// Actor only: lobby platform, orbit/rune, particle and aura belong to the client layer.
// All source coordinates are in the original 320 x 350 lobby art viewBox.
const P = (d, fill, stroke = 'none', width = 1.5) => ({ d, fill, stroke, width });
const G = (name, x, y, layers) => ({ name, pivot: { x, y }, layers });
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const mage = {
  id: 'mage', name: 'Astra', signature: 'staff',
  palette: { primary: '#99c9ff', shadow: '#6175b9', dark: '#121b3d',
    inner: '#080f26', trim: '#dfcda4', metal: '#b3c0de', leather: '#a99069',
    glow: '#99c9ff', face: '#080f26' },
  // Named pivots are stable. ENGINEER-MOTION owns the numeric pose timelines.
  parts: [
    G('cape', 160, 160, [
      P('M142 90q-38 42-58 164l60 28 56-8 37-24q-22-75-59-154Z', 'inner', 'shadow'),
      P('M142 93q-20 20-25 67l-19 94 50 21 55-3 28-23q-27-78-53-150Z', 'shadow', 'primary'),
    ]),
    G('legLeft', 151, 258, [
      P('m139 248-7 51 24 4 9-47Z', 'dark', 'metal'),
      P('m135 298-1 8 25 1-2-8Z', 'inner', 'trim'),
    ]),
    G('legRight', 179, 258, [
      P('m174 253 8 49 24-5-13-48Z', 'dark', 'metal'),
      P('m182 299 1 8 26-4-4-8Z', 'inner', 'trim'),
    ]),
    G('robe', 160, 220, [
      P('m153 173-9 71 16 27 16-27-6-71Z', 'primary', 'trim'),
    ]),
    G('torso', 160, 160, [
      P('m139 116-23 51-18 87 27-14 13-54 4 63 15 24 16-22 9-74 17 78 29-6-48-136Z', 'dark'),
      P('m118 160 24-35 18 37 22-37 20 41-22 21h-40Z', 'shadow', 'trim', 2),
      P('m160 147 8 15-8 12-8-12Z', 'trim', 'inner'),
      P('m140 195 20 6 23-6-1 9-21 6-21-6Z', 'trim'),
    ]),
    G('weapon', 229, 174, [
      P('m229 95-7 175', 'none', 'leather', 6),
      P('m228 82 17 21-18 25-17-25Z', 'inner', 'trim', 2),
      P('m228 92 10 11-11 13-8-13Z', 'glow', 'trim'),
      P('M219 103h19M229 94v19', 'none', 'glow', 2),
    ]),
    G('armLeft', 115, 165, [
      P('m124 161-16 30-12-2-13-38 10-5 13 21 15-18Z', 'shadow', 'metal'),
      P('m83 146-8 3 4 10 12-6Z', 'trim', 'dark'),
    ]),
    G('armRight', 206, 166, [
      P('m197 165 17 30 13-3 12-39-12-4-13 23-15-23Z', 'shadow', 'metal'),
      P('m224 148 11-4 8 11-12 6Z', 'trim', 'dark'),
    ]),
    G('head', 160, 115, [
      P('m117 116 20-39 25-16 25 16 21 39-25 25h-44Z', 'shadow', 'trim', 1.5),
      P('m133 111 28-30 28 30-9 29h-38Z', 'face'),
      P('m140 99 21-25 19 23M132 118l9 21 20 16 20-16 9-22', 'none', 'trim', 2),
      P('m145 117 11 2m10 0 11-2', 'none', 'glow', 3),
      P('m149 68 12-14 11 15-11-5Z', 'trim'),
    ]),
  ],
};

const guardian = {
  id: 'guardian', name: 'Orin', signature: 'sword-shield',
  palette: { primary: '#a0d9b1', shadow: '#5d719a', dark: '#1b2949',
    inner: '#0b142a', trim: '#e4c991', metal: '#cad8df', leather: '#8c6e54',
    glow: '#a0d9b1', face: '#101728' },
  parts: [
    G('cape', 160, 158, [
      P('M143 102q-37 34-64 144l55 34 62-2 48-32q-30-111-65-143Z', 'inner', 'shadow'),
      P('M140 113q-20 66-39 129l41 21 20-25 29 24 38-21-43-129Z', 'shadow', 'trim'),
    ]),
    G('legLeft', 145, 251, [
      P('M127 238h32l-3 59-31 1Z', 'metal', 'dark', 3),
      P('m125 294-6 12 42-2-5-12Z', 'inner', 'trim', 2),
      P('m133 259 20 0', 'none', 'shadow', 4),
    ]),
    G('legRight', 186, 251, [
      P('M169 240h32l6 57-33 3Z', 'metal', 'dark', 3),
      P('m172 294-4 12 44-1-7-13Z', 'inner', 'trim', 2),
      P('m177 260 22-2', 'none', 'shadow', 4),
    ]),
    G('torso', 161, 164, [
      P('M125 136 143 121 180 121 199 137 209 224 189 258 136 257 111 227Z', 'dark', 'trim', 3),
      P('M119 151 144 133 180 133 204 151 198 227 181 244 140 244 123 224Z', 'metal', 'shadow', 4),
      P('m143 145 18 14 20-14-4 68-16 17-15-18Z', 'shadow', 'trim', 2),
      P('m161 163 10 17-10 20-11-20Z', 'trim', 'inner', 2),
      P('m123 211 76 0-4 18-67 0Z', 'dark', 'trim', 3),
    ]),
    G('weapon', 239, 163, [
      P('m239 93 10-11 9 15-12 94-11 0Z', 'metal', 'trim', 2.5),
      P('m239 90 10-11 8 13-9 16-12-2Z', 'glow', 'trim', 1.5),
      P('m219 191 42 3', 'none', 'trim', 7),
      P('m241 196-3 34', 'none', 'leather', 7),
      P('m233 227h12', 'none', 'trim', 5),
    ]),
    G('armLeft', 117, 168, [
      P('M125 142 100 139 88 158 97 201 118 209 131 180Z', 'metal', 'trim', 3),
      P('m92 183 15-2 8 21-16 8Z', 'shadow', 'dark', 2),
    ]),
    G('offhand', 96, 187, [
      P('M68 155 103 141 129 154 125 214 99 241 72 217Z', 'dark', 'trim', 4),
      P('M77 163 100 153 121 164 116 207 99 226 80 208Z', 'shadow', 'metal', 2),
      P('m99 157 1 62M79 188h40', 'none', 'trim', 3),
      P('m100 170 11 17-11 17-11-17Z', 'trim', 'inner', 2),
    ]),
    G('armRight', 206, 166, [
      P('M197 141 216 139 231 155 232 192 211 205 192 179Z', 'metal', 'trim', 3),
      P('m220 184 15-8 10 16-12 11Z', 'shadow', 'dark', 2),
    ]),
    G('head', 161, 115, [
      P('m124 105 17-34 20-8 26 10 13 34-15 33h-45Z', 'metal', 'trim', 3),
      P('m137 106 24-24 23 24-8 30h-30Z', 'face', 'shadow', 2),
      P('m140 116 42 0-7 13h-27Z', 'inner', 'trim', 2),
      P('m146 120 11 2m10 0 11-2', 'none', 'glow', 3),
      P('m153 70 8-20 8 19 22 5-30 8-30-8Z', 'trim', 'dark'),
    ]),
  ],
};

const ranger = {
  id: 'ranger', name: 'Lyra', signature: 'bow',
  palette: { primary: '#ebb991', shadow: '#4a8a86', dark: '#173c46',
    inner: '#0c1c30', trim: '#dfc894', metal: '#b1ccd0', leather: '#9c7856',
    glow: '#ebb991', face: '#0a1726' },
  parts: [
    G('cape', 160, 156, [
      P('M151 88Q105 117 83 262l56 17 25-34 43 35 40-37Q203 106 169 88Z', 'inner', 'shadow'),
      P('M146 103q-31 54-42 147l34 14 27-34 38 29 21-17q-34-110-48-138Z', 'shadow', 'trim'),
      P('M103 234 90 280 140 258m64-1 25 34 16-44', 'none', 'primary', 3),
    ]),
    G('legLeft', 151, 256, [
      P('m142 238-12 60 21 5 12-59Z', 'dark', 'leather', 2),
      P('m130 291-7 15 29 0 3-13Z', 'inner', 'trim', 1.5),
    ]),
    G('legRight', 184, 251, [
      P('m175 243 14 60 22-8-16-58Z', 'dark', 'leather', 2),
      P('m189 295 0 12 33-8-11-11Z', 'inner', 'trim', 1.5),
    ]),
    G('torso', 162, 173, [
      P('M140 126 178 127 195 167 188 235 163 253 136 234 127 164Z', 'dark', 'trim', 2),
      P('m143 142 17 16 18-15 13 38-30 20-29-19Z', 'shadow', 'primary', 2),
      P('m151 187 10 13 11-13-3 40-8 14-9-14Z', 'primary', 'trim'),
      P('m131 207 56-1-2 13-48 0Z', 'leather', 'trim', 2),
      P('m161 150 8 12-8 12-8-12Z', 'trim'),
    ]),
    G('weapon', 234, 156, [
      // Curved limbs and a distinct string, never a generic staff.
      P('M235 79Q276 111 255 157Q276 205 231 243', 'none', 'trim', 8),
      P('M230 83Q248 159 228 238', 'none', 'primary', 2.5),
      P('M235 79 231 243', 'none', 'glow', 2),
      P('m225 151 22-4', 'none', 'leather', 5),
      P('m230 80 10-7m-10 173 8-10', 'none', 'metal', 3),
    ]),
    G('armLeft', 131, 165, [
      P('m137 157-24 7-11 27 21 9 22-23Z', 'shadow', 'trim', 2),
      P('m102 184 17-1 6 18-18 5Z', 'leather', 'trim', 1.5),
    ]),
    G('armRight', 205, 161, [
      P('m182 155 21-13 25 9 9 21-14 14-25-14Z', 'shadow', 'trim', 2),
      P('m219 155 18-7 9 11-15 12Z', 'leather', 'trim', 1.5),
    ]),
    G('head', 161, 115, [
      P('M118 115Q130 77 153 63l15-10 19 23 24 39-29 25h-41Z', 'shadow', 'trim', 2),
      P('m132 110 29-30 28 29-12 30h-34Z', 'face', 'leather', 2),
      P('m135 101 24-28 27 29-18-6-17 4Z', 'primary', 'trim', 2),
      P('m146 118 10 2m11 0 10-2', 'none', 'glow', 3),
      P('m166 56 24-15-10 36', 'primary', 'trim', 2),
    ]),
    G('arrow', 228, 155, [
      P('M183 152 258 152', 'none', 'metal', 3),
      P('m257 152-13-7v14Z', 'trim', 'inner', 1.3),
      P('m185 152-11-7 5 7-5 7Z', 'primary', 'trim', 1.2),
    ]),
  ],
};

export const HERO_RIGS = freeze({ mage, guardian, ranger });
export const HERO_IDS = freeze(['mage', 'guardian', 'ranger']);

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
  // The hem is separate from the shoulder yoke: the collar stays attached
  // while the lower fabric trails a few fixed simulation ticks behind motion.
  parts: [
    G('capeTail', 160, 183, [
      P('M122 166Q102 206 85 261L111 278 137 286 164 270 190 285 217 277 238 257Q218 201 199 166Z', 'inner', 'shadow', 2),
      P('M131 174Q111 222 106 261L138 276 162 259 188 273 216 259Q208 215 191 174Z', 'shadow', 'primary', 2),
      P('M108 260 138 276 162 259 188 273 214 259', 'none', 'trim', 3),
      P('M135 202Q129 235 126 252M191 203Q200 231 203 251', 'none', 'primary', 2),
      P('m160 222 4 8 9 2-9 3-4 8-4-8-9-3 9-2Z', 'trim', 'inner', 1),
    ]),
    G('cape', 160, 119, [
      P('M134 116Q146 108 160 113Q176 107 187 116L208 172 199 209Q180 196 159 198Q139 196 117 210L111 171Z', 'inner', 'shadow', 2.5),
      P('M138 121Q150 116 160 122Q172 116 183 121L196 168 187 190Q172 182 160 185Q146 183 130 192L125 169Z', 'shadow', 'primary', 2),
      P('M136 120Q147 129 160 128Q175 129 185 120M130 181Q143 176 160 179Q178 176 191 181', 'none', 'trim', 3),
      P('m159 143 4 7 8 1-8 3-4 7-4-7-8-3 8-1Z', 'trim', 'inner', 1.2),
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
      P('M144 171Q137 210 126 262L143 281 160 270 178 281 195 260Q182 207 176 171Z', 'dark', 'trim', 2.2),
      P('M151 178 142 260 160 268 180 260 169 178Z', 'primary', 'shadow', 2),
      P('M143 269 160 278 180 268M160 197V264', 'none', 'trim', 2.5),
      P('m159 217 5 8-5 7-5-7Z', 'trim', 'inner', 1),
    ]),
    G('torso', 160, 160, [
      P('M133 120 116 146 105 201 113 246 134 233 139 189 145 235 160 251 178 234 184 189 191 242 214 242 207 178 191 122Z', 'dark', 'shadow', 2),
      P('M127 138Q142 124 160 139Q177 124 193 139L191 174 177 197 160 207 141 197 126 171Z', 'shadow', 'trim', 2.5),
      P('M143 147 160 170 177 147 172 181 160 193 148 181Z', 'primary', 'metal', 1.5),
      P('m160 155 8 13-8 14-8-14Z', 'trim', 'inner', 1.5),
      P('M133 202Q160 216 186 202L182 215Q160 226 139 216Z', 'trim', 'dark', 1.5),
      P('M123 151 135 132 147 139 138 160M173 139 187 132 198 152 184 162', 'none', 'metal', 4),
    ]),
    G('weapon', 229, 174, [
      P('M229 94 229 271', 'none', 'leather', 6),
      P('M229 132 229 195', 'none', 'metal', 2.6),
      P('M229 92 246 111 229 133 212 111Z', 'inner', 'trim', 2.6),
      P('M229 100 239 111 229 124 219 111Z', 'glow', 'metal', 2),
      P('M229 76 234 91 247 96 234 101 229 116 224 101 211 96 224 91Z', 'trim', 'shadow', 1.5),
      P('M219 111 229 123 240 111M229 83V127', 'none', 'glow', 2.5),
      P('M218 145 240 145M222 167 237 167M224 265 234 265', 'none', 'trim', 3),
    ]),
    G('armLeft', 115, 165, [
      P('M125 141 106 148 95 180 101 196 115 200 133 171Z', 'shadow', 'metal', 2.3),
      P('M107 170 100 185 107 194 120 191 125 181Z', 'primary', 'trim', 1.6),
      P('m100 184-8 1 4 12 12-4Z', 'trim', 'dark', 1.5),
    ]),
    G('armRight', 206, 166, [
      P('M195 141 213 143 231 165 236 181 225 194 212 180 199 169Z', 'shadow', 'metal', 2.2),
      P('M209 154 223 146 237 153 238 164 223 171 216 164Z', 'primary', 'trim', 1.8),
      // Visible palm is centered at (230,153), on the staff shaft at (229,153).
      P('M221 148 231 145 239 149 239 159 228 164 221 159Z', 'trim', 'dark', 1.7),
      P('M225 151 236 152', 'none', 'leather', 2.5),
    ]),
    G('head', 160, 115, [
      P('M117 116Q127 83 147 71L160 57 174 72Q195 79 207 116L188 143 160 153 132 142Z', 'shadow', 'trim', 2),
      P('M131 113Q142 86 160 80Q180 86 190 113L181 139 160 146 141 139Z', 'face', 'metal', 1.5),
      P('M126 113Q139 87 160 74Q183 87 195 113L181 105 160 95 139 105Z', 'primary', 'trim', 2.1),
      P('M131 119 141 139 160 153 180 139 189 118M144 123 155 125M166 125 177 123', 'none', 'trim', 2.2),
      P('m145 118 11 2m10 0 11-2', 'none', 'glow', 3.1),
      P('M160 54 165 66 178 69 165 73 160 86 155 73 142 69 155 66Z', 'trim', 'shadow', 1.3),
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

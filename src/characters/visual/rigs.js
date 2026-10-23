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


/**
 * Rear-only hood for Astra. Keep the same pivot/name as the animated front head
 * so the normal fixed-tick head joint works in both SVG and real Canvas.
 * Crucially there is no forward face aperture or eye-glow geometry.
 * The back panel reads as continuous cloth rather than a mask looking at us.
 */
export const ASTRA_REAR_HOOD = freeze(G('head', 160, 115, [
  // Same outlined silhouette as the forward hood so turning never pops in size.
  P('M117 116Q127 83 147 71L160 57 174 72Q195 79 207 116L188 143 160 153 132 142Z', 'shadow', 'trim', 2),
  // Single closed back cloth panel covers the front-face location.
  P('M126 112Q136 89 160 78Q184 89 195 112L186 140Q172 149 160 151Q143 148 134 139Z', 'primary', 'metal', 1.8),
  // Side seam shadows and stitched hood panels taper naturally into the yoke.
  P('M132 111Q139 97 146 93L142 125 152 146Q140 141 134 132Z', 'shadow', 'none'),
  P('M188 110Q181 97 175 93L180 126 169 145Q182 139 187 131Z', 'shadow', 'none'),
  P('M144 94Q151 86 160 82Q169 85 176 94M160 84Q159 109 160 137M141 134Q160 145 179 134', 'none', 'trim', 2),
  // The single embroidered star is a garment detail, not front-facing eyes.
  P('M160 104 164 113 174 115 165 120 162 131 156 122 146 119 156 115Z', 'trim', 'shadow', 1.6),
  P('M139 137Q150 147 160 149Q174 147 183 137', 'none', 'metal', 2),
]));

// Orin's shoulder yoke and trailing hem share one collar anchor, but animate
// separately. Armour is drawn in distinct steel, under-plate, trim and leather
// layers, so it remains legible on both lobby SVG and 0.16-scale map Canvas.
const guardian = {
  id: 'guardian', name: 'Orin', signature: 'sword-shield',
  palette: { primary: '#a0d9b1', shadow: '#5d719a', dark: '#1b2949',
    inner: '#0b142a', trim: '#e4c991', metal: '#cad8df', leather: '#8c6e54',
    glow: '#a0d9b1', face: '#101728' },
  parts: [
    G('capeTail', 160, 120, [
      P('M132 116Q105 145 87 211L77 266 114 281 141 274 164 289 192 273 215 281 247 257Q224 158 188 116Z', 'inner', 'shadow', 2.7),
      P('M138 130Q115 184 104 255L130 266 159 278 184 262 214 269 226 248Q208 174 183 130Z', 'shadow', 'primary', 2),
      P('M102 257 130 269 160 281 185 266 216 270M124 180Q117 218 113 250M196 179Q211 220 213 253', 'none', 'trim', 2.2),
      P('M151 218 160 229 170 218 166 236 160 245 153 236Z', 'trim', 'dark', 1.3),
    ]),
    G('legLeft', 145, 251, [
      P('M128 235 158 235 159 279 151 302 123 299 123 271Z', 'dark', 'metal', 2.5),
      P('M130 242 154 242 153 273 144 287 127 282Z', 'metal', 'shadow', 2.2),
      P('M131 250 153 250M128 273 150 279M144 241 140 278', 'none', 'trim', 2.2),
      P('M126 288 153 288 164 304Q147 310 116 306Z', 'inner', 'trim', 2),
      P('M121 303 157 305', 'none', 'metal', 2),
    ]),
    G('legRight', 187, 251, [
      P('M170 237 200 235 204 274 210 299 180 302 171 280Z', 'dark', 'metal', 2.5),
      P('M176 242 197 241 202 281 183 287 174 273Z', 'metal', 'shadow', 2.2),
      P('M176 251 197 250M179 278 203 273M188 242 192 278', 'none', 'trim', 2.2),
      P('M180 290 207 288 217 305Q188 310 171 305Z', 'inner', 'trim', 2),
      P('M176 304 210 303', 'none', 'metal', 2),
    ]),
    G('torso', 161, 164, [
      P('M136 123 151 117 175 118 190 126 214 159 208 226 190 259 133 258 109 228 108 163Z', 'dark', 'trim', 3.2),
      P('M125 149 145 133 181 133 200 149 200 208 185 239 140 238 121 208Z', 'metal', 'shadow', 3),
      P('M146 142 161 154 179 142 188 171 182 205 161 221 141 205 135 172Z', 'shadow', 'trim', 2.6),
      P('M144 156 161 174 179 155 174 194 161 204 148 193Z', 'primary', 'metal', 2),
      P('M161 166 169 182 161 195 152 183Z', 'trim', 'inner', 1.5),
      P('M159 173 161 181 164 173M156 186 161 193 167 185', 'none', 'dark', 2),
      P('M119 204Q157 217 203 205L195 229 185 242 140 243 126 231Z', 'dark', 'trim', 2.5),
      P('M127 217Q161 229 196 217M140 230 141 243M181 230 182 243', 'none', 'metal', 2.4),
      P('M124 151 143 135M199 151 180 135M125 190 136 202M188 201 199 190', 'none', 'trim', 2),
    ]),
    G('cape', 160, 120, [
      P('M126 119Q143 111 160 117Q176 109 194 120L213 148 201 173 187 154 172 144 160 153 148 143 130 156 118 174 108 150Z', 'inner', 'trim', 2.4),
      P('M130 125Q143 122 159 130Q177 121 189 126L203 147 193 159 175 140 160 148 145 141 126 161 117 150Z', 'shadow', 'metal', 2),
      P('M133 129Q148 137 160 136Q175 136 187 129M119 149 127 153M195 153 203 148', 'none', 'primary', 3),
      P('M156 134 160 139 165 134 164 146 159 150 155 145Z', 'trim', 'dark', 1),
    ]),
    G('weapon', 239, 163, [
      // Blade, fuller, crossguard and pommel are kept on ONE animated sword part.
      // Grip point (239,188) is contact-locked to the right-hand palm (233,185).
      P('M234 178 235 103 240 66 248 83 256 101 247 178Z', 'metal', 'trim', 2.4),
      P('M239 80 245 103 243 167 240 178 238 167Z', 'glow', 'shadow', 1.6),
      P('M239 101 239 166M250 102 244 164', 'none', 'inner', 1.8),
      P('M217 177Q225 185 239 184Q252 185 263 175L265 185 253 196 239 188 225 197 213 186Z', 'trim', 'dark', 2),
      P('M238 189 243 189 244 222 237 223Z', 'leather', 'trim', 1.7),
      P('M237 197 244 203M237 209 244 215', 'none', 'dark', 2),
      P('M231 222Q239 229 249 222L246 235 233 234Z', 'trim', 'dark', 2),
    ]),
    G('armLeft', 117, 168, [
      P('M125 141 105 138 88 150 86 173 99 195 116 204 135 173Z', 'metal', 'trim', 3),
      P('M98 151 119 147 126 164 108 177 91 169Z', 'shadow', 'metal', 2),
      P('M99 176 115 179 113 198 97 201 91 188Z', 'dark', 'trim', 2),
      P('M94 187 107 186 110 198 96 202Z', 'leather', 'metal', 1.7),
      P('M97 191 103 191', 'none', 'trim', 2),
    ]),
    G('offhand', 96, 187, [
      // Shield grip point (99,193) is tied to Orin's left palm (100,195).
      P('M61 156 98 140 134 156 132 207 115 236 98 249 78 234 63 206Z', 'dark', 'trim', 4),
      P('M71 163 98 151 124 163 122 203 107 224 98 233 85 221 73 201Z', 'metal', 'shadow', 2.8),
      P('M78 171 98 162 116 171 115 196 104 213 98 220 87 210 80 195Z', 'shadow', 'trim', 1.5),
      P('M98 158 98 234M71 188 124 188', 'none', 'trim', 3),
      P('M98 171 112 192 98 213 84 192Z', 'trim', 'dark', 2),
      P('M98 179 105 191 98 203 91 191Z', 'primary', 'metal', 1.6),
      P('M69 158 62 173M128 162 134 174M82 232 94 243M115 234 102 244', 'none', 'primary', 2.3),
    ]),
    G('armRight', 206, 166, [
      P('M193 139 218 138 234 150 241 171 232 190 217 202 195 178Z', 'metal', 'trim', 3),
      P('M207 146 226 148 233 163 216 178 196 166Z', 'shadow', 'metal', 2.2),
      P('M220 173 236 172 245 184 237 195 224 196 213 187Z', 'dark', 'trim', 2),
      P('M226 181 236 178 244 186 239 194 227 194 222 188Z', 'leather', 'metal', 1.7),
      P('M227 185 240 185', 'none', 'trim', 2.5),
    ]),
    G('head', 161, 115, [
      P('M123 112 134 83 149 69 162 61 177 72 190 82 202 112 186 143 139 143Z', 'metal', 'trim', 3),
      P('M135 109 145 92 179 93 190 110 181 140 145 140Z', 'face', 'shadow', 2),
      P('M136 113L145 95 177 95 187 113 178 139 145 139Z', 'dark', 'metal', 1.8),
      P('M134 112 188 112 182 121 140 121Z', 'inner', 'trim', 2),
      P('M145 119h10m14 0h10', 'none', 'glow', 3),
      P('M148 130 160 135 173 130M160 113v17', 'none', 'trim', 2),
      P('M143 75 160 49 178 76 193 81 161 88 128 81Z', 'trim', 'dark', 2.3),
      P('M160 53 161 84M140 82 181 82', 'none', 'metal', 2),
    ]),
  ],
};

// Back view is solid engraved plate: never display front slit or glowing eyes.
// It keeps the same pivot and silhouette, so turning does not change hit size.
export const ORIN_REAR_HELM = freeze(G('head', 161, 115, [
  P('M123 112 134 83 149 69 162 61 177 72 190 82 202 112 186 143 139 143Z', 'metal', 'trim', 3),
  P('M135 109Q138 90 161 82Q183 90 189 109L181 140Q162 147 143 140Z', 'shadow', 'metal', 2),
  P('M144 98 159 88 176 98 176 130 161 141 145 130Z', 'metal', 'trim', 2),
  P('M161 89V140M145 125 161 134 176 125M135 112 145 108M176 108 188 112', 'none', 'dark', 2.4),
  P('M143 75 160 49 178 76 193 81 161 88 128 81Z', 'trim', 'dark', 2.3),
  P('M160 53 161 84M140 82 181 82', 'none', 'metal', 2),
]));

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

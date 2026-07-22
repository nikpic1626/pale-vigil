// Pale Vigil overworld generator — rebuilds the 20 outdoor maps as larger,
// organic, hand-specced "places" (FireRed-style) while preserving the world
// graph, gate flags, encounter tables, npcs, trainers, signs, items and ambience.
// Emits scripts/.newmaps.json: { maps: {key: literalText}, doorpos, start }.
// Run: node scripts/genmaps.mjs [--preview [key]]
import fs from "node:fs";

const OLD = JSON.parse(fs.readFileSync("scripts/.oldmaps.json", "utf8"));

// ---------- tiny seeded rng ----------
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash = (s) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7);

// ---------- grid primitives ----------
const mk = (w, h, base = ".") => Array.from({ length: h }, () => Array(w).fill(base));
const W_ = (g) => g[0].length, H_ = (g) => g.length;
const inb = (g, x, y) => x >= 0 && y >= 0 && x < W_(g) && y < H_(g);
const set = (g, x, y, ch) => { if (inb(g, x, y)) g[y][x] = ch; };
const get = (g, x, y) => (inb(g, x, y) ? g[y][x] : "#");

// irregular tree border: hard ring + a smoothed random inner depth (1..3)
function border(g, rng, ch = "#") {
  const w = W_(g), h = H_(g);
  for (let x = 0; x < w; x++) { g[0][x] = ch; g[h - 1][x] = ch; }
  for (let y = 0; y < h; y++) { g[y][0] = ch; g[y][w - 1] = ch; }
  const walk = (len) => {
    let d = 1; const out = [];
    for (let i = 0; i < len; i++) { if (rng() < 0.4) d += rng() < 0.5 ? -1 : 1; d = Math.max(1, Math.min(3, d)); out.push(d); }
    return out;
  };
  const top = walk(w), bot = walk(w), lef = walk(h), rig = walk(h);
  for (let x = 1; x < w - 1; x++) {
    for (let i = 1; i < top[x]; i++) set(g, x, i, ch);
    for (let i = 1; i < bot[x]; i++) set(g, x, h - 1 - i, ch);
  }
  for (let y = 1; y < h - 1; y++) {
    for (let i = 1; i < lef[y]; i++) set(g, i, y, ch);
    for (let i = 1; i < rig[y]; i++) set(g, w - 1 - i, y, ch);
  }
}

// punch a 2-wide opening through the border (depth 4 so bumps never seal it)
function opening(g, edge, at, ch = ",") {
  const w = W_(g), h = H_(g);
  for (let i = 0; i < 2; i++) for (let d = 0; d < 4; d++) {
    if (edge === "n") set(g, at + i, d, ch);
    if (edge === "s") set(g, at + i, h - 1 - d, ch);
    if (edge === "w") set(g, d, at + i, ch);
    if (edge === "e") set(g, w - 1 - d, at + i, ch);
  }
}

// organic blob (lake / tree clump / grass patch)
function blob(g, rng, cx, cy, rx, ry, ch, over = [".", "t", "m", "n"]) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!inb(g, x, y) || x === 0 || y === 0 || x === W_(g) - 1 || y === H_(g) - 1) continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1 - rng() * 0.45 && over.includes(g[y][x])) g[y][x] = ch;
    }
}

// 2-wide rectilinear road through waypoints; carves over everything but the hard ring
function road(g, pts, wpath = 2, ch = ",") {
  const stamp = (x, y) => {
    for (let dy = 0; dy < wpath; dy++) for (let dx = 0; dx < wpath; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx > 0 && yy > 0 && xx < W_(g) - 1 && yy < H_(g) - 1) g[yy][xx] = ch;
    }
  };
  for (let i = 0; i + 1 < pts.length; i++) {
    let [x, y] = pts[i]; const [tx, ty] = pts[i + 1];
    while (x !== tx) { stamp(x, y); x += Math.sign(tx - x); }
    while (y !== ty) { stamp(x, y); y += Math.sign(ty - y); }
    stamp(x, y);
  }
}

// building block: roof row(s) 'r', walls 'h', door on the bottom row, ground cleared below
function building(g, x, y, w, h, doorCh = "d", doorOff = null) {
  const roofRows = h >= 4 ? 2 : 1;
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) set(g, x + xx, y + yy, yy < roofRows ? "r" : "h");
  if (doorCh) {
    const dx = x + (doorOff ?? Math.floor(w / 2));
    set(g, dx, y + h - 1, doorCh);
    if (get(g, dx, y + h) !== ",") set(g, dx, y + h, ".");
    return { x: dx, y: y + h - 1 };
  }
  return null;
}

function fenceRect(g, x0, y0, x1, y1, gaps = []) {
  for (let x = x0; x <= x1; x++) { if (g[y0][x] === ".") g[y0][x] = "="; if (g[y1][x] === ".") g[y1][x] = "="; }
  for (let y = y0; y <= y1; y++) { if (g[y][x0] === ".") g[y][x0] = "="; if (g[y][x1] === ".") g[y][x1] = "="; }
  for (const [gx, gy] of gaps) set(g, gx, gy, ".");
}

function scatter(g, rng, ch, n, x0 = 1, y0 = 1, x1 = null, y1 = null) {
  x1 = x1 ?? W_(g) - 2; y1 = y1 ?? H_(g) - 2;
  let placed = 0, tries = 0;
  while (placed < n && tries++ < n * 60) {
    const x = x0 + Math.floor(rng() * (x1 - x0 + 1)), y = y0 + Math.floor(rng() * (y1 - y0 + 1));
    if (g[y][x] === ".") { g[y][x] = ch; placed++; }
  }
}

function gravRows(g, x0, x1, y0, y1, stepX = 3, stepY = 2) {
  for (let y = y0; y <= y1; y += stepY) for (let x = x0; x <= x1; x += stepX) if (get(g, x, y) === ".") set(g, x, y, "G");
}

// place the north-gate 'X' across an opening (exit tiles double as gate tiles)
function gateAt(g, x) { set(g, x, 0, "X"); set(g, x + 1, 0, "X"); }

// ---------- connection alignment (single source of truth) ----------
const AL = {
  town_oldroad_x: 18, town_oldroadE_y: 13,
  oldroad_ashgrove_x: 12,
  ashgrove_woods1_x: 24,
  woods1_woods2_x: 14, woods1_orchard_y: 12, woods1_oldroadE_y: 8,
  woods2_fenmoor_x: 20,
  fenmoor_mire1_x: 16,
  mire1_mire2_x: 22, mire1_hamlet_y: 12, mire1E_y: 7, mire2W_y: 18,
  hamlet_gravemarch_x: 18,
  mire2_vesper_x: 12,
  vesper_chapel_x: 24,
  chapel_palegate_x: 14, chapel_shallows_y: 8,
  palegate_underveil_x: 20,
  underveil_lantern_x: 16, veilpass_y: 13,
  lantern_threshold_x: 12,
  threshold_court_x: 18,
  court_veil_x: 18,
};

// helpers to build exit records (landing one tile inside the far edge)
const exN = (x, to, tx, H2) => [{ x, y: 0, to, tx, ty: H2 - 2 }, { x: x + 1, y: 0, to, tx: tx + 1, ty: H2 - 2 }];
const exS = (x, H, to, tx) => [{ x, y: H - 1, to, tx, ty: 1 }, { x: x + 1, y: H - 1, to, tx: tx + 1, ty: 1 }];
const exW = (y, to, ty, W2) => [{ x: 0, y, to, tx: W2 - 2, ty }, { x: 0, y: y + 1, to, tx: W2 - 2, ty: ty + 1 }];
const exE = (y, W, to, ty) => [{ x: W - 1, y, to, tx: 1, ty }, { x: W - 1, y: y + 1, to, tx: 1, ty: ty + 1 }];

// sizes (needed for cross-references before building)
const SZ = {
  town: [38, 26], oldroad: [38, 26], ashgrove: [38, 26], woods1: [38, 26], woods2: [38, 26],
  fenmoor: [38, 26], mire1: [38, 26], mire2: [38, 26], vesperrest: [38, 26], chapel: [38, 26],
  palegate: [38, 26], underveil: [34, 24], lastlantern: [38, 26], threshold: [38, 26],
  court: [32, 26], behindveil: [34, 24], orchard: [32, 22], hamlet: [32, 22], gravemarch: [34, 24], shallows: [34, 24],
};
const w = (k) => SZ[k][0], h = (k) => SZ[k][1];

const RESULT = {};   // key -> {grid, exits, doors, npcs, signs, items, amb, extra}
const DOORPOS = {};  // interiorKey -> outdoor landing {x,y} (tile below the door)
const START = { x: 19, y: 15 };

function finish(key, g, spec) {
  const old = OLD[key];
  const npcs = (old.npcs || []).map((n, i) => ({ ...n, x: spec.npcs[i][0], y: spec.npcs[i][1] }));
  const signs = (old.signs || []).map((s, i) => ({ ...s, x: spec.signs[i][0], y: spec.signs[i][1] }));
  const items = (old.items || []).map((it, i) => ({ ...it, x: spec.items[i][0], y: spec.items[i][1] }));
  const amb = (old.amb || []).map((a, i) => ({ ...a, x: spec.amb[i][0], y: spec.amb[i][1] }));
  for (const s of signs) set(g, s.x, s.y, "s");
  RESULT[key] = { key, g, exits: spec.exits, doors: spec.doors || [], npcs, signs, items, amb };
}

// ===== HOLLOW VALE (start town) =====
function buildTown() {
  const key = "town", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 6, 22, 4, 2.5, "#");        // SW copse
  blob(g, rng, 33, 4, 4, 2.5, "#");        // NE copse
  blob(g, rng, 31, 21, 2.6, 1.6, "w");     // village pond SE
  // roads: north road down to the green, east road out, plaza in the middle
  road(g, [[AL.town_oldroad_x, 0], [AL.town_oldroad_x, 14], [14, 14], [14, 16], [24, 16]]);
  road(g, [[24, 14], [W - 1, 14]]);
  road(g, [[24, 14], [24, 16]]);
  opening(g, "n", AL.town_oldroad_x); opening(g, "e", AL.town_oldroadE_y);
  // buildings: elder NW, shop NE (both above the plaza, doors facing south)
  const dElder = building(g, 8, 8, 5, 3, "d");
  const dShop = building(g, 24, 7, 5, 3, "d");
  const dHall = building(g, 8, 17, 6, 4, "d");    // hall SW — approached from around the side
  const dHome = building(g, 24, 18, 4, 3, "d");   // home SE
  DOORPOS.elder_house = { x: dElder.x, y: dElder.y + 1 };
  DOORPOS.town_shop = { x: dShop.x, y: dShop.y + 1 };
  DOORPOS.vigil_hall = { x: dHall.x, y: dHall.y + 1 };
  DOORPOS.town_home = { x: dHome.x, y: dHome.y + 1 };
  road(g, [[dElder.x, dElder.y + 1], [dElder.x, 14]], 1);
  road(g, [[dShop.x, dShop.y + 1], [dShop.x, 14]], 1);
  road(g, [[15, 17], [15, 21], [dHall.x, 21]], 1);           // lane around the hall's east side
  road(g, [[23, 17], [23, 21], [dHome.x, 21]], 1);           // lane down to the home's door
  fenceRect(g, 3, 11, 8, 14, [[8, 13]]);                     // fenced garden west of the plaza
  blob(g, rng, 5, 12, 2, 1.2, "t", ["."]);
  scatter(g, rng, "b", 7); scatter(g, rng, "m", 4);
  set(g, 16, 13, "l"); set(g, 21, 13, "l"); set(g, 17, 5, "l"); set(g, 28, 19, "l");
  set(g, 16, 17, "c"); set(g, 13, 16, "b"); set(g, 26, 15, "b"); set(g, 26, 16, "m");
  finish(key, g, {
    exits: [...exN(AL.town_oldroad_x, "oldroad", AL.town_oldroad_x, h("oldroad")),
            ...exE(AL.town_oldroadE_y, W, "oldroad", AL.town_oldroadE_y)],
    doors: [ { ...dElder, to: "elder_house", tx: 11, ty: 14 }, { ...dShop, to: "town_shop", tx: 11, ty: 14 },
             { ...dHall, to: "vigil_hall", tx: 11, ty: 14 }, { ...dHome, to: "town_home", tx: 11, ty: 14 } ],
    npcs: [[22, 18], [13, 15], [20, 12]],   // grimalkin on the home lane, villager, pale child
    signs: [[17, 4]],
    items: [[34, 20]],                      // embers tucked behind the pond
    amb: [],
  });
  RESULT[key].extra = { guard: true };
}

// ===== THE OLD ROAD =====
function buildOldroad() {
  const key = "oldroad", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 8, 6, 4, 3, "#"); blob(g, rng, 30, 18, 4, 2.5, "#");
  blob(g, rng, 5, 16, 3, 4, "t"); blob(g, rng, 27, 6, 4, 2.5, "t"); blob(g, rng, 17, 20, 4, 2, "t");
  road(g, [[AL.town_oldroad_x, H - 1], [AL.town_oldroad_x, 18], [22, 18], [22, 8], [AL.oldroad_ashgrove_x, 8], [AL.oldroad_ashgrove_x, 0]]);
  road(g, [[0, AL.town_oldroadE_y], [10, AL.town_oldroadE_y], [10, 18], [AL.town_oldroad_x, 18]]);
  opening(g, "s", AL.town_oldroad_x); opening(g, "n", AL.oldroad_ashgrove_x); opening(g, "w", AL.town_oldroadE_y);
  building(g, 26, 12, 4, 3, null);          // ruined watchpost (sealed, scenery)
  fenceRect(g, 14, 15, 20, 16, [[17, 15]]);
  gravRows(g, 4, 8, 20, 22, 2, 2);
  scatter(g, rng, "b", 6); scatter(g, rng, "n", 5); scatter(g, rng, "m", 3);
  set(g, 23, 17, "l"); set(g, 14, 8, "c");
  finish(key, g, {
    exits: [...exS(AL.town_oldroad_x, H, "town", AL.town_oldroad_x),
            ...exN(AL.oldroad_ashgrove_x, "ashgrove", AL.oldroad_ashgrove_x, h("ashgrove")),
            ...exW(AL.town_oldroadE_y, "town", AL.town_oldroadE_y, w("town"))],
    npcs: [[21, 12]],                        // wandering peddler mid-road
    signs: [[20, 20]],
    items: [[6, 21], [28, 5]],
    amb: [[6, 19]],
  });
}

// ===== ASHGROVE =====
function buildAshgrove() {
  const key = "ashgrove", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 6, 5, 3.4, 2.4, "#"); blob(g, rng, 33, 21, 3.4, 2, "#");
  road(g, [[AL.oldroad_ashgrove_x, H - 1], [AL.oldroad_ashgrove_x, 13], [AL.ashgrove_woods1_x, 13], [AL.ashgrove_woods1_x, 0]]);
  road(g, [[25, 13], [30, 13]]);
  opening(g, "s", AL.oldroad_ashgrove_x); opening(g, "n", AL.ashgrove_woods1_x);
  gateAt(g, AL.ashgrove_woods1_x);
  const dHall = building(g, 15, 6, 6, 4, "d");    // guard hall north of the crossroad
  const dHome = building(g, 27, 8, 4, 3, "d");
  DOORPOS.ash_hall = { x: dHall.x, y: dHall.y + 1 };
  DOORPOS.ash_home = { x: dHome.x, y: dHome.y + 1 };
  road(g, [[dHall.x, dHall.y + 1], [dHall.x, 13]], 1);
  road(g, [[dHome.x, dHome.y + 1], [dHome.x, 13]], 1);
  // the burned grove: stumps and a fenced memorial
  scatter(g, rng, "b", 14, 3, 15, 11, 23);
  scatter(g, rng, "b", 6, 27, 3, 35, 6);
  fenceRect(g, 5, 18, 10, 21, [[7, 18]]);
  set(g, 7, 20, "G"); set(g, 8, 20, "G");
  set(g, 14, 12, "l"); set(g, 22, 12, "l"); set(g, 6, 12, "c");
  finish(key, g, {
    exits: [...exS(AL.oldroad_ashgrove_x, H, "oldroad", AL.oldroad_ashgrove_x),
            ...exN(AL.ashgrove_woods1_x, "woods1", AL.ashgrove_woods1_x, h("woods1"))],
    doors: [ { ...dHall, to: "ash_hall", tx: 11, ty: 14 }, { ...dHome, to: "ash_home", tx: 11, ty: 14 } ],
    npcs: [[9, 13], [22, 15]],
    signs: [[14, 16]],
    items: [],
    amb: [],
  });
}

// ===== ASHEN WOODS =====
function buildWoods1() {
  const key = "woods1", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 9, 7, 4.5, 2.8, "#"); blob(g, rng, 28, 4, 4, 2.2, "#"); blob(g, rng, 20, 19, 5, 2.6, "#"); blob(g, rng, 33, 17, 3, 2.4, "#");
  blob(g, rng, 6, 18, 4, 3.2, "t"); blob(g, rng, 17, 5, 4, 2.6, "t"); blob(g, rng, 28, 16, 4, 2.4, "t"); blob(g, rng, 12, 23, 5, 1.8, "t");
  road(g, [[AL.ashgrove_woods1_x, H - 1], [AL.ashgrove_woods1_x, 12], [AL.woods1_woods2_x, 12], [AL.woods1_woods2_x, 0]]);
  road(g, [[0, AL.woods1_orchard_y], [7, AL.woods1_orchard_y], [7, 12], [14, 12]]);
  road(g, [[25, 12], [30, 12], [30, AL.woods1_oldroadE_y], [W - 1, AL.woods1_oldroadE_y]]);
  opening(g, "s", AL.ashgrove_woods1_x); opening(g, "n", AL.woods1_woods2_x);
  opening(g, "w", AL.woods1_orchard_y); opening(g, "e", AL.woods1_oldroadE_y);
  scatter(g, rng, "b", 6); scatter(g, rng, "m", 6);
  set(g, 15, 11, "c");
  finish(key, g, {
    exits: [...exS(AL.ashgrove_woods1_x, H, "ashgrove", AL.ashgrove_woods1_x),
            ...exN(AL.woods1_woods2_x, "woods2", AL.woods1_woods2_x, h("woods2")),
            ...exW(AL.woods1_orchard_y, "orchard", AL.woods1_orchard_y, w("orchard")),
            // the eastern trail drops down onto the Old Road's northern stretch
            { x: W - 1, y: AL.woods1_oldroadE_y, to: "oldroad", tx: AL.oldroad_ashgrove_x, ty: 2 },
            { x: W - 1, y: AL.woods1_oldroadE_y + 1, to: "oldroad", tx: AL.oldroad_ashgrove_x + 1, ty: 2 }],
    npcs: [[10, 12]],                        // the widow waits on the west fork
    signs: [[22, 14]],
    items: [[4, 21]],
    amb: [[8, 4], [31, 18]],
  });
}

// ===== ASHEN WOODS — DEEP =====
function buildWoods2() {
  const key = "woods2", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 8, 6, 5, 3.4, "#"); blob(g, rng, 27, 8, 4.4, 3, "#"); blob(g, rng, 12, 15, 4.2, 2.6, "#"); blob(g, rng, 30, 19, 4, 2.6, "#");
  blob(g, rng, 20, 7, 3.6, 2.4, "t"); blob(g, rng, 4, 14, 2.6, 3, "t"); blob(g, rng, 24, 15, 4, 2.4, "t"); blob(g, rng, 17, 22, 6, 1.8, "t");
  road(g, [[AL.woods1_woods2_x, H - 1], [AL.woods1_woods2_x, 19], [6, 19], [6, 10], [16, 10], [16, 4], [AL.woods2_fenmoor_x, 4], [AL.woods2_fenmoor_x, 0]]);
  opening(g, "s", AL.woods1_woods2_x); opening(g, "n", AL.woods2_fenmoor_x);
  gateAt(g, AL.woods2_fenmoor_x);
  scatter(g, rng, "b", 5); scatter(g, rng, "m", 8);
  set(g, 9, 10, "c");
  finish(key, g, {
    exits: [...exS(AL.woods1_woods2_x, H, "woods1", AL.woods1_woods2_x),
            ...exN(AL.woods2_fenmoor_x, "fenmoor", AL.woods2_fenmoor_x, h("fenmoor"))],
    npcs: [[10, 19], [21, 4]],               // burner mid-route, Wren before the gate
    signs: [],
    items: [[31, 4]],
    amb: [[6, 5], [28, 16]],
  });
}

// ===== FENMOOR (stilt town) =====
function buildFenmoor() {
  const key = "fenmoor", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 7, 8, 5, 3.6, "w"); blob(g, rng, 30, 5, 5, 2.8, "w"); blob(g, rng, 7, 20, 5, 3, "w"); blob(g, rng, 31, 20, 4.6, 2.8, "w");
  blob(g, rng, 20, 21, 3.4, 1.8, "t");
  // causeway roads over the fen
  road(g, [[AL.woods2_fenmoor_x, H - 1], [AL.woods2_fenmoor_x, 14], [AL.fenmoor_mire1_x, 14], [AL.fenmoor_mire1_x, 0]]);
  road(g, [[16, 14], [16, 17], [25, 17], [25, 10], [22, 10]]);
  opening(g, "s", AL.woods2_fenmoor_x); opening(g, "n", AL.fenmoor_mire1_x);
  gateAt(g, AL.fenmoor_mire1_x);
  const dHall = building(g, 9, 4, 6, 4, "d");
  const dHome = building(g, 24, 6, 4, 3, "d");
  const dShop = building(g, 27, 14, 4, 3, "g");
  DOORPOS.fen_hall = { x: dHall.x, y: dHall.y + 1 };
  DOORPOS.fen_home = { x: dHome.x, y: dHome.y + 1 };
  road(g, [[dHall.x, dHall.y + 1], [15, 8]], 1);
  road(g, [[dHome.x, dHome.y + 1], [dHome.x, 10]], 1);
  road(g, [[dShop.x, dShop.y + 1], [27, 17]], 1);
  scatter(g, rng, "n", 4); scatter(g, rng, "b", 4);
  set(g, 14, 13, "l"); set(g, 21, 9, "l"); set(g, 20, 13, "c");
  finish(key, g, {
    exits: [...exS(AL.woods2_fenmoor_x, H, "woods2", AL.woods2_fenmoor_x),
            ...exN(AL.fenmoor_mire1_x, "mire1", AL.fenmoor_mire1_x, h("mire1"))],
    doors: [ { ...dHall, to: "fen_hall", tx: 11, ty: 14 }, { ...dHome, to: "fen_home", tx: 11, ty: 14 } ],
    npcs: [[18, 16], [22, 12]],
    signs: [[19, 15]],
    items: [],
    amb: [],
  });
}

// ===== THE WEEPING MIRE =====
function buildMire1() {
  const key = "mire1", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 8, 5, 5, 2.8, "w"); blob(g, rng, 28, 13, 5.4, 3.6, "w"); blob(g, rng, 8, 20, 5, 3, "w"); blob(g, rng, 19, 4, 3, 1.8, "w");
  blob(g, rng, 17, 13, 3.4, 2.4, "t"); blob(g, rng, 30, 21, 4, 2, "t"); blob(g, rng, 3, 12, 2, 2, "t");
  road(g, [[AL.fenmoor_mire1_x, H - 1], [AL.fenmoor_mire1_x, 16], [12, 16], [12, 9], [AL.mire1_mire2_x, 9], [AL.mire1_mire2_x, 0]]);
  road(g, [[0, AL.mire1_hamlet_y], [6, AL.mire1_hamlet_y], [6, 16], [12, 16]]);
  road(g, [[23, 9], [33, 9], [33, AL.mire1E_y], [W - 1, AL.mire1E_y]]);
  opening(g, "s", AL.fenmoor_mire1_x); opening(g, "n", AL.mire1_mire2_x);
  opening(g, "w", AL.mire1_hamlet_y); opening(g, "e", AL.mire1E_y);
  scatter(g, rng, "n", 6); scatter(g, rng, "b", 4); scatter(g, rng, "m", 4);
  set(g, 13, 15, "c");
  finish(key, g, {
    exits: [...exS(AL.fenmoor_mire1_x, H, "fenmoor", AL.fenmoor_mire1_x),
            ...exN(AL.mire1_mire2_x, "mire2", AL.mire1_mire2_x, h("mire2")),
            ...exW(AL.mire1_hamlet_y, "hamlet", AL.mire1_hamlet_y, w("hamlet")),
            ...exE(AL.mire1E_y, W, "mire2", AL.mire2W_y)],
    npcs: [[14, 10]],
    signs: [],
    items: [[17, 13], [4, 16]],
    amb: [[8, 4], [29, 17]],
  });
}

// ===== THE SUNKEN YARD =====
function buildMire2() {
  const key = "mire2", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 8, 9, 5, 3.4, "w"); blob(g, rng, 29, 5, 4.6, 2.6, "w"); blob(g, rng, 30, 22, 4.6, 2.2, "w"); blob(g, rng, 5, 22, 3.4, 1.8, "w");
  blob(g, rng, 20, 15, 4, 2.4, "t"); blob(g, rng, 6, 15, 3, 2, "t");
  road(g, [[AL.mire1_mire2_x, H - 1], [AL.mire1_mire2_x, 18], [15, 18], [15, 6], [AL.mire2_vesper_x, 6], [AL.mire2_vesper_x, 0]]);
  road(g, [[0, AL.mire2W_y], [15, AL.mire2W_y]]);
  opening(g, "s", AL.mire1_mire2_x); opening(g, "n", AL.mire2_vesper_x);
  opening(g, "w", AL.mire2W_y);
  gateAt(g, AL.mire2_vesper_x);
  gravRows(g, 18, 32, 10, 14, 3, 2);        // the sunken graveyard
  gravRows(g, 24, 34, 16, 18, 3, 2);
  scatter(g, rng, "n", 6); scatter(g, rng, "m", 3);
  set(g, 17, 16, "c");
  finish(key, g, {
    exits: [...exS(AL.mire1_mire2_x, H, "mire1", AL.mire1_mire2_x),
            ...exN(AL.mire2_vesper_x, "vesperrest", AL.mire2_vesper_x, h("vesperrest")),
            ...exW(AL.mire2W_y, "mire1", AL.mire1E_y, w("mire1"))],
    npcs: [[19, 17], [16, 7]],               // leech farmer among graves, Sol before the gate
    signs: [],
    items: [[33, 15]],
    amb: [[5, 20], [29, 8]],
  });
}

// ===== VESPER REST =====
function buildVesper() {
  const key = "vesperrest", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 5, 5, 3, 2.2, "#"); blob(g, rng, 33, 21, 3, 2, "#");
  blob(g, rng, 6, 20, 3, 2, "w");
  road(g, [[AL.mire2_vesper_x, H - 1], [AL.mire2_vesper_x, 12], [30, 12], [AL.vesper_chapel_x, 12], [AL.vesper_chapel_x, 0]]);
  opening(g, "s", AL.mire2_vesper_x); opening(g, "n", AL.vesper_chapel_x);
  gateAt(g, AL.vesper_chapel_x);
  const dHall = building(g, 16, 5, 6, 4, "d");     // the bell hall
  const dHome = building(g, 27, 8, 4, 3, "d");
  const dShop = building(g, 6, 8, 4, 3, "g");
  DOORPOS.vesper_hall = { x: dHall.x, y: dHall.y + 1 };
  DOORPOS.vesper_home = { x: dHome.x, y: dHome.y + 1 };
  road(g, [[dHall.x, dHall.y + 1], [dHall.x, 12]], 1);
  road(g, [[dHome.x, dHome.y + 1], [dHome.x, 12]], 1);
  road(g, [[dShop.x, dShop.y + 1], [dShop.x, 12], [11, 12]], 1);
  fenceRect(g, 25, 19, 31, 22, [[28, 19]]);
  gravRows(g, 27, 30, 20, 21, 2, 1);               // small yard of quiet bells
  scatter(g, rng, "b", 6);
  set(g, 14, 11, "l"); set(g, 23, 11, "l"); set(g, 19, 14, "c");
  finish(key, g, {
    exits: [...exS(AL.mire2_vesper_x, H, "mire2", AL.mire2_vesper_x),
            ...exN(AL.vesper_chapel_x, "chapel", AL.vesper_chapel_x, h("chapel"))],
    doors: [ { ...dHall, to: "vesper_hall", tx: 11, ty: 14 }, { ...dHome, to: "vesper_home", tx: 11, ty: 14 } ],
    npcs: [[13, 14], [26, 14]],
    signs: [[10, 14]],
    items: [],
    amb: [],
  });
}

// ===== THE BONE CHAPEL =====
function buildChapel() {
  const key = "chapel", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 6, 19, 3.4, 2.4, "#"); blob(g, rng, 32, 4, 3.2, 2, "#");
  blob(g, rng, 5, 5, 3, 2.6, "t"); blob(g, rng, 29, 21, 4, 2, "t"); blob(g, rng, 28, 5, 3, 1.8, "t");
  road(g, [[AL.vesper_chapel_x, H - 1], [AL.vesper_chapel_x, 21], [12, 21], [12, 8], [AL.chapel_palegate_x, 8], [AL.chapel_palegate_x, 0]]);
  road(g, [[15, 8], [W - 1, AL.chapel_shallows_y]]);
  opening(g, "s", AL.vesper_chapel_x); opening(g, "n", AL.chapel_palegate_x);
  opening(g, "e", AL.chapel_shallows_y);
  gateAt(g, AL.chapel_palegate_x);
  // the roofless nave: walls forming a chapel you can walk through
  for (let x = 16; x <= 24; x++) { set(g, x, 12, "h"); set(g, x, 18, "h"); }
  for (let y = 12; y <= 18; y++) { set(g, 16, y, "h"); set(g, 24, y, "h"); }
  set(g, 20, 18, "."); set(g, 21, 18, ".");           // the fallen doorway
  for (const [gx, gy] of [[18, 14], [22, 14], [18, 16], [22, 16]]) set(g, gx, gy, "G");
  set(g, 20, 13, "c");                                 // the altar-shrine
  gravRows(g, 4, 9, 11, 15, 2, 2);
  scatter(g, rng, "n", 7); scatter(g, rng, "m", 3);
  finish(key, g, {
    exits: [...exS(AL.vesper_chapel_x, H, "vesperrest", AL.vesper_chapel_x),
            ...exN(AL.chapel_palegate_x, "palegate", AL.chapel_palegate_x, h("palegate")),
            ...exE(AL.chapel_shallows_y, W, "shallows", AL.chapel_shallows_y)],
    npcs: [[14, 19], [20, 15]],              // acolyte on the path, Choirmaster in the nave
    signs: [[22, 20]],
    items: [[9, 21]],
    amb: [[7, 7], [28, 15]],
  });
}

// ===== PALEGATE =====
function buildPalegate() {
  const key = "palegate", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 33, 21, 3.4, 2.2, "#");
  // the great chalk wall spans the town's north, pierced by the road
  for (let x = 1; x < W - 1; x++) if (x !== AL.palegate_underveil_x && x !== AL.palegate_underveil_x + 1) { set(g, x, 6, "h"); set(g, x, 7, "h"); }
  for (let x = 4; x < W - 4; x += 6) set(g, x, 5, "r");   // battlement caps
  road(g, [[AL.chapel_palegate_x, H - 1], [AL.chapel_palegate_x, 14], [AL.palegate_underveil_x, 14], [AL.palegate_underveil_x, 0]]);
  road(g, [[21, 14], [30, 14]]);
  opening(g, "s", AL.chapel_palegate_x); opening(g, "n", AL.palegate_underveil_x);
  gateAt(g, AL.palegate_underveil_x);
  const dHall = building(g, 8, 9, 6, 4, "d");
  const dHome = building(g, 27, 10, 4, 3, "d");
  const dShop = building(g, 22, 8, 4, 3, "g");
  DOORPOS.pale_hall = { x: dHall.x, y: dHall.y + 1 };
  DOORPOS.pale_home = { x: dHome.x, y: dHome.y + 1 };
  road(g, [[dHall.x, dHall.y + 1], [dHall.x, 14], [13, 14]], 1);
  road(g, [[dHome.x, dHome.y + 1], [dHome.x, 14]], 1);
  road(g, [[dShop.x, dShop.y + 1], [dShop.x, 14]], 1);
  fenceRect(g, 4, 17, 10, 21, [[7, 17]]);
  blob(g, rng, 7, 19, 2, 1.4, "t", ["."]);
  scatter(g, rng, "b", 5); scatter(g, rng, "n", 3);
  set(g, 16, 13, "l"); set(g, 23, 13, "l"); set(g, 18, 17, "c");
  finish(key, g, {
    exits: [...exS(AL.chapel_palegate_x, H, "chapel", AL.chapel_palegate_x),
            ...exN(AL.palegate_underveil_x, "underveil", AL.palegate_underveil_x, h("underveil"))],
    doors: [ { ...dHall, to: "pale_hall", tx: 11, ty: 14 }, { ...dHome, to: "pale_home", tx: 11, ty: 14 } ],
    npcs: [[16, 15], [26, 15]],
    signs: [[12, 16]],
    items: [],
    amb: [],
  });
}

// ===== UNDERVEIL PASSAGE (cave) =====
function buildUnderveil() {
  const key = "underveil", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H, "#");
  const carve = (cx, cy, rx, ry) => blob(g, rng, cx, cy, rx, ry, ".", ["#"]);
  carve(20, 19, 6, 3.4); carve(8, 16, 5, 3); carve(6, 7, 4.4, 3); carve(17, 6, 5, 3); carve(27, 10, 4.6, 3.4); carve(16, 12, 10, 2);
  road(g, [[AL.palegate_underveil_x, H - 1], [AL.palegate_underveil_x, 19], [8, 19], [8, 12], [6, 12], [6, 6], [16, 6], [AL.underveil_lantern_x, 6], [AL.underveil_lantern_x, 0]]);
  road(g, [[0, AL.veilpass_y], [8, AL.veilpass_y]]);
  road(g, [[17, 6], [27, 6], [27, 12], [22, 12], [22, 19]], 1);
  opening(g, "s", AL.palegate_underveil_x); opening(g, "n", AL.underveil_lantern_x);
  opening(g, "w", AL.veilpass_y);
  blob(g, rng, 12, 16, 3, 2, "t", ["."]);   // pale fungus fields
  blob(g, rng, 25, 8, 2.6, 1.8, "t", ["."]);
  scatter(g, rng, "m", 10); scatter(g, rng, "n", 4);
  set(g, 10, 15, "c");
  finish(key, g, {
    exits: [...exS(AL.palegate_underveil_x, H, "palegate", AL.palegate_underveil_x),
            ...exN(AL.underveil_lantern_x, "lastlantern", AL.underveil_lantern_x, h("lastlantern")),
            ...exW(AL.veilpass_y, "threshold", AL.veilpass_y, w("threshold"))],
    npcs: [[19, 18], [27, 9]],
    signs: [],
    items: [[11, 16], [28, 11]],
    amb: [[10, 6], [24, 14]],
  });
}

// ===== LAST LANTERN =====
function buildLantern() {
  const key = "lastlantern", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 6, 5, 3.4, 2.2, "#"); blob(g, rng, 32, 20, 3.4, 2.2, "#");
  road(g, [[AL.underveil_lantern_x, H - 1], [AL.underveil_lantern_x, 13], [AL.lantern_threshold_x, 13], [AL.lantern_threshold_x, 0]]);
  road(g, [[17, 13], [30, 13]]);
  opening(g, "s", AL.underveil_lantern_x); opening(g, "n", AL.lantern_threshold_x);
  gateAt(g, AL.lantern_threshold_x);
  const dHall = building(g, 18, 6, 6, 4, "d");
  const dHome = building(g, 27, 8, 4, 3, "d");
  const dShop = building(g, 6, 8, 4, 3, "g");
  DOORPOS.lantern_hall = { x: dHall.x, y: dHall.y + 1 };
  DOORPOS.lantern_home = { x: dHome.x, y: dHome.y + 1 };
  road(g, [[dHall.x, dHall.y + 1], [dHall.x, 13]], 1);
  road(g, [[dHome.x, dHome.y + 1], [dHome.x, 13]], 1);
  road(g, [[dShop.x, dShop.y + 1], [8, 13], [11, 13]], 1);
  // the town of lamps — light against the dark
  for (const [lx, ly] of [[10, 12], [14, 12], [18, 12], [22, 12], [26, 12], [30, 12], [6, 14], [13, 5], [25, 5], [17, 19], [24, 19]]) set(g, lx, ly, "l");
  scatter(g, rng, "b", 4);
  set(g, 20, 17, "c");
  finish(key, g, {
    exits: [...exS(AL.underveil_lantern_x, H, "underveil", AL.underveil_lantern_x),
            ...exN(AL.lantern_threshold_x, "threshold", AL.lantern_threshold_x, h("threshold"))],
    doors: [ { ...dHall, to: "lantern_hall", tx: 11, ty: 14 }, { ...dHome, to: "lantern_home", tx: 11, ty: 14 } ],
    npcs: [[15, 15], [25, 16]],
    signs: [[9, 14]],
    items: [],
    amb: [],
  });
}

// ===== THE THRESHOLD =====
function buildThreshold() {
  const key = "threshold", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 6, 7, 3.6, 2.6, "#"); blob(g, rng, 31, 19, 3.4, 2.2, "#");
  blob(g, rng, 8, 17, 4, 2.8, "t"); blob(g, rng, 27, 7, 4, 2.4, "t"); blob(g, rng, 18, 21, 4, 1.8, "t");
  road(g, [[AL.lantern_threshold_x, H - 1], [AL.lantern_threshold_x, 12], [AL.threshold_court_x, 12], [AL.threshold_court_x, 0]]);
  road(g, [[19, 12], [33, 12], [33, AL.veilpass_y], [W - 1, AL.veilpass_y]]);
  opening(g, "s", AL.lantern_threshold_x); opening(g, "n", AL.threshold_court_x);
  opening(g, "e", AL.veilpass_y);
  gateAt(g, AL.threshold_court_x);
  // shattered pillar rows flanking the last road
  for (let y = 4; y <= 10; y += 3) { set(g, AL.threshold_court_x - 3, y, "b"); set(g, AL.threshold_court_x + 4, y, "b"); }
  gravRows(g, 4, 8, 20, 22, 2, 2);
  scatter(g, rng, "n", 6); scatter(g, rng, "m", 4);
  set(g, 15, 11, "c");
  finish(key, g, {
    exits: [...exS(AL.lantern_threshold_x, H, "lastlantern", AL.lantern_threshold_x),
            ...exN(AL.threshold_court_x, "court", AL.threshold_court_x, h("court")),
            ...exE(AL.veilpass_y, W, "underveil", AL.veilpass_y)],
    npcs: [[18, 4]],                          // the Hollow King bars the road
    signs: [[14, 14]],
    items: [[6, 21]],
    amb: [[7, 15], [28, 5]],
  });
}

// ===== THE HOLLOW COURT =====
function buildCourt() {
  const key = "court", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  road(g, [[AL.threshold_court_x, H - 1], [AL.threshold_court_x, 0]]);
  opening(g, "s", AL.threshold_court_x); opening(g, "n", AL.court_veil_x);
  gateAt(g, AL.court_veil_x);
  // the processional: rug column flanked by pillars and old stones
  for (let y = 6; y <= 20; y++) { set(g, AL.threshold_court_x, y, "u"); set(g, AL.threshold_court_x + 1, y, "u"); }
  for (let y = 6; y <= 20; y += 3) { set(g, AL.threshold_court_x - 3, y, "b"); set(g, AL.threshold_court_x + 4, y, "b"); }
  for (let y = 7; y <= 19; y += 3) { set(g, AL.threshold_court_x - 6, y, "G"); set(g, AL.threshold_court_x + 7, y, "G"); }
  // throne dais pierced by the rug
  for (let x = AL.threshold_court_x - 2; x <= AL.threshold_court_x + 3; x++) set(g, x, 5, "h");
  set(g, AL.threshold_court_x, 5, "u"); set(g, AL.threshold_court_x + 1, 5, "u");
  scatter(g, rng, "n", 5, 3, 8, W - 4, H - 4);
  finish(key, g, {
    exits: [...exS(AL.threshold_court_x, H, "threshold", AL.threshold_court_x),
            ...exN(AL.court_veil_x, "behindveil", AL.court_veil_x, h("behindveil"))],
    npcs: [[AL.threshold_court_x, 6]],        // the King upon his dais
    signs: [],
    items: [],
    amb: [],
  });
}

// ===== BEHIND THE VEIL =====
function buildBehindveil() {
  const key = "behindveil", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H, "w");                    // pale nothing, islands of ground
  for (let x = 0; x < W; x++) { g[0][x] = "#"; g[H - 1][x] = "#"; }
  for (let y = 0; y < H; y++) { g[y][0] = "#"; g[y][W - 1] = "#"; }
  const isle = (cx, cy, rx, ry) => blob(g, rng, cx, cy, rx, ry, ".", ["w"]);
  isle(AL.court_veil_x, 20, 5, 3); isle(9, 16, 4.4, 3); isle(7, 6, 4, 2.8); isle(17, 9, 4.6, 3); isle(26, 6, 4, 2.6); isle(27, 16, 4.4, 3);
  road(g, [[AL.court_veil_x, H - 1], [AL.court_veil_x, 20], [10, 20], [10, 16], [8, 16], [8, 7], [16, 7], [16, 10], [25, 10], [25, 6]]);
  road(g, [[25, 10], [27, 10], [27, 16]], 1);
  opening(g, "s", AL.court_veil_x);
  blob(g, rng, 17, 8, 3, 2, "t", ["."]); blob(g, rng, 27, 15, 3, 2, "t", ["."]);
  scatter(g, rng, "m", 6); scatter(g, rng, "G", 3);
  set(g, 9, 15, "c");
  finish(key, g, {
    exits: [...exS(AL.court_veil_x, H, "court", AL.court_veil_x)],
    npcs: [[26, 5]],                          // the First Warden at the far shore
    signs: [],
    items: [[6, 5], [29, 16]],
    amb: [[8, 8], [20, 14], [16, 6]],
  });
}

// ===== WITHERED ORCHARD =====
function buildOrchard() {
  const key = "orchard", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  // dead fruit rows
  for (let y = 5; y <= 17; y += 4) for (let x = 5; x <= 26; x += 3) { set(g, x, y, "#"); if (rng() < 0.5) set(g, x, y + 1, "b"); }
  blob(g, rng, 9, 8, 2.6, 1.6, "t"); blob(g, rng, 22, 14, 3, 1.8, "t"); blob(g, rng, 15, 3, 2.4, 1.2, "t");
  road(g, [[W - 1, AL.woods1_orchard_y], [17, AL.woods1_orchard_y], [17, 11], [7, 11], [7, 15]]);
  opening(g, "e", AL.woods1_orchard_y);
  scatter(g, rng, "b", 5); scatter(g, rng, "m", 4);
  set(g, 6, 16, "c");
  finish(key, g, {
    exits: [...exE(AL.woods1_orchard_y, W, "woods1", AL.woods1_orchard_y)],
    npcs: [[9, 12]],
    signs: [],
    items: [[5, 18], [27, 4]],
    amb: [[10, 3], [24, 16]],
  });
}

// ===== EMBERFALL HAMLET =====
function buildHamlet() {
  const key = "hamlet", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 5, 17, 3, 2.2, "#"); blob(g, rng, 28, 4, 2.6, 1.6, "#");
  road(g, [[W - 1, AL.mire1_hamlet_y], [16, AL.mire1_hamlet_y], [16, 8], [AL.hamlet_gravemarch_x, 8], [AL.hamlet_gravemarch_x, 0]]);
  opening(g, "e", AL.mire1_hamlet_y); opening(g, "n", AL.hamlet_gravemarch_x);
  const dH1 = building(g, 6, 6, 4, 3, "d");
  const dShop = building(g, 12, 6, 4, 3, "g");
  const dH2 = building(g, 24, 6, 4, 3, "d");
  DOORPOS.hamlet_home1 = { x: dH1.x, y: dH1.y + 1 };
  DOORPOS.hamlet_home2 = { x: dH2.x, y: dH2.y + 1 };
  road(g, [[dH1.x, dH1.y + 1], [8, 13], [15, 13]], 1);
  road(g, [[dShop.x, dShop.y + 1], [16, 9]], 1);
  road(g, [[dH2.x, dH2.y + 1], [dH2.x, 12]], 1);
  for (const [lx, ly] of [[14, 11], [20, 10], [9, 11]]) set(g, lx, ly, "l");
  scatter(g, rng, "b", 5); scatter(g, rng, "n", 3);
  set(g, 19, 9, "c");
  finish(key, g, {
    exits: [...exE(AL.mire1_hamlet_y, W, "mire1", AL.mire1_hamlet_y),
            ...exN(AL.hamlet_gravemarch_x, "gravemarch", AL.hamlet_gravemarch_x, h("gravemarch"))],
    doors: [ { ...dH1, to: "hamlet_home1", tx: 11, ty: 14 }, { ...dH2, to: "hamlet_home2", tx: 11, ty: 14 } ],
    npcs: [[13, 13], [20, 11]],
    signs: [[18, 14]],
    items: [[27, 17]],
    amb: [],
  });
}

// ===== GRAVEMARCH FIELDS =====
function buildGravemarch() {
  const key = "gravemarch", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H);
  border(g, rng);
  blob(g, rng, 29, 20, 3, 1.8, "#");
  blob(g, rng, 6, 5, 3, 2, "t"); blob(g, rng, 27, 8, 3.6, 2.2, "t"); blob(g, rng, 12, 19, 4, 2, "t");
  road(g, [[AL.hamlet_gravemarch_x, H - 1], [AL.hamlet_gravemarch_x, 12], [10, 12], [10, 5]]);
  opening(g, "s", AL.hamlet_gravemarch_x);
  gravRows(g, 13, 30, 4, 8, 3, 2);          // the war fields — rank on rank
  gravRows(g, 4, 15, 14, 17, 3, 2);
  gravRows(g, 21, 31, 13, 16, 2, 3);
  scatter(g, rng, "n", 8); scatter(g, rng, "m", 3);
  set(g, 9, 4, "c");
  finish(key, g, {
    exits: [...exS(AL.hamlet_gravemarch_x, H, "hamlet", AL.hamlet_gravemarch_x)],
    npcs: [[12, 6], [24, 12], [12, 4]],       // bonepicker, mourner, gravepup among the stones
    signs: [],
    items: [[5, 19], [30, 5]],
    amb: [[8, 3], [22, 18]],
  });
}

// ===== THE DROWNED SHALLOWS =====
function buildShallows() {
  const key = "shallows", [W, H] = SZ[key];
  const rng = mulberry32(hash(key));
  const g = mk(W, H, "w");
  for (let x = 0; x < W; x++) { g[0][x] = "#"; g[H - 1][x] = "#"; }
  for (let y = 0; y < H; y++) { g[y][0] = "#"; g[y][W - 1] = "#"; }
  const bar = (cx, cy, rx, ry) => blob(g, rng, cx, cy, rx, ry, ".", ["w"]);
  bar(4, 9, 3.4, 3); bar(11, 9, 4.4, 3); bar(20, 13, 5, 3.4); bar(28, 7, 4, 3); bar(27, 18, 4, 2.6);
  road(g, [[0, AL.chapel_shallows_y], [4, AL.chapel_shallows_y], [4, 9], [11, 9], [11, 12], [19, 12], [19, 14], [26, 14], [26, 8]]);
  road(g, [[26, 14], [26, 18], [29, 18]], 1);
  opening(g, "w", AL.chapel_shallows_y);
  blob(g, rng, 20, 12, 3, 2, "t", ["."]);   // reed beds
  blob(g, rng, 11, 8, 2.4, 1.6, "t", ["."]);
  scatter(g, rng, "n", 5); scatter(g, rng, "b", 3);
  set(g, 4, 7, "c");
  finish(key, g, {
    exits: [...exW(AL.chapel_shallows_y, "chapel", AL.chapel_shallows_y, w("chapel"))],
    npcs: [[28, 7]],                          // the Drowned Sister on the far bar
    signs: [],
    items: [[21, 15], [29, 19]],
    amb: [[7, 5], [24, 19], [15, 15]],
  });
}

// ---------- build all ----------
buildTown(); buildOldroad(); buildAshgrove(); buildWoods1(); buildWoods2();
buildFenmoor(); buildMire1(); buildMire2(); buildVesper(); buildChapel();
buildPalegate(); buildUnderveil(); buildLantern(); buildThreshold(); buildCourt();
buildBehindveil(); buildOrchard(); buildHamlet(); buildGravemarch(); buildShallows();

// ---------- guarantee walkable exit tiles, landings, npc/item tiles ----------
const WALK = ".,tumn";
for (const r of Object.values(RESULT)) {
  for (const e of r.exits) {
    const ch = r.g[e.y]?.[e.x];
    if (ch !== "X" && !WALK.includes(ch)) set(r.g, e.x, e.y, ",");
    const dst = RESULT[e.to];
    if (dst) {
      const dch = dst.g[e.ty]?.[e.tx];
      if (dch !== undefined && !WALK.includes(dch)) set(dst.g, e.tx, e.ty, ",");
    }
  }
  for (const n of r.npcs) if (!WALK.includes(get(r.g, n.x, n.y))) set(r.g, n.x, n.y, ".");
  for (const it of r.items) if (!WALK.includes(get(r.g, it.x, it.y))) set(r.g, it.x, it.y, ".");
}

// ---------- serialize ----------
function lit(r) {
  const old = OLD[r.key];
  const L = [];
  L.push(`  ${r.key}: {`);
  const head = [`name: ${JSON.stringify(old.name)}`, `theme: ${JSON.stringify(old.theme)}`, `enc: ${old.enc ? JSON.stringify(old.enc) : "null"}`];
  if (old.gateFlag) head.push(`gateFlag: ${JSON.stringify(old.gateFlag)}`);
  if (r.extra?.guard) head.push("guard: true");
  L.push(`    ${head.join(", ")},`);
  L.push("    grid: [");
  for (const row of r.g) L.push(`      ${JSON.stringify(row.join(""))},`);
  L.push("    ],");
  L.push(`    exits: ${JSON.stringify(r.exits)},`);
  if (r.doors.length) L.push(`    doors: ${JSON.stringify(r.doors.map(({ x, y, to, tx, ty }) => ({ x, y, to, tx, ty })))},`);
  if (r.signs.length) L.push(`    signs: ${JSON.stringify(r.signs)},`);
  if (r.npcs.length) L.push(`    npcs: ${JSON.stringify(r.npcs)},`);
  if (r.items.length) L.push(`    items: ${JSON.stringify(r.items)},`);
  if (r.amb.length) L.push(`    amb: ${JSON.stringify(r.amb)},`);
  L.push("  },");
  return L.join("\n");
}

const outMaps = {};
for (const [k, r] of Object.entries(RESULT)) outMaps[k] = lit(r);
fs.writeFileSync("scripts/.newmaps.json", JSON.stringify({ maps: outMaps, doorpos: DOORPOS, start: START }, null, 1));

// ---------- preview ----------
const pv = process.argv.indexOf("--preview");
if (pv > -1) {
  const which = process.argv[pv + 1] ? [process.argv[pv + 1]] : Object.keys(RESULT);
  for (const k of which) {
    const r = RESULT[k];
    console.log(`\n===== ${k} (${W_(r.g)}x${H_(r.g)}) =====`);
    const mark = mk(W_(r.g), H_(r.g), " ");
    r.npcs.forEach((n) => set(mark, n.x, n.y, "@"));
    r.items.forEach((i) => set(mark, i.x, i.y, "$"));
    console.log(r.g.map((row, y) => row.map((c, x) => (mark[y][x] !== " " ? mark[y][x] : c)).join("")).join("\n"));
  }
}
console.log("generated", Object.keys(RESULT).length, "maps → scripts/.newmaps.json");

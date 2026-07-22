// Pale Vigil data validator — extracts the DATA region from src/PaleVigil.jsx
// and asserts every invariant that a JSX syntax check cannot see.
// Run: node scripts/validate.mjs
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "src", "PaleVigil.jsx");
const OUT = path.join(ROOT, "scripts", ".data-extract.mjs");

const text = fs.readFileSync(SRC, "utf8");
const start = text.indexOf("// DATA-START");
const end = text.indexOf("// DATA-END");
if (start < 0 || end < 0) { console.error("DATA markers not found"); process.exit(1); }
fs.writeFileSync(OUT, text.slice(start, end));

const D = await import(url.pathToFileURL(OUT).href);
const { TYPES, CHART, MOVES, SPR, ABILITIES, DEX, ITEMS, CHARM_IDS, TRAINERS, MAPS, THEMES, STARTERS, SHOP_STOCK,
        H_D0, H_D1, H_U0, H_U1, H_S0, H_S1, HUMAN_PALS } = D;

const WALK = ".,tumn"; // keep in sync with the component
let errors = [], warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ---------- sprites ----------
for (const [id, s] of Object.entries(SPR)) {
  if (!s.g || !s.pal) { err(`SPR.${id}: missing grid or palette`); continue; }
  if (s.g.length !== 24) err(`SPR.${id}: ${s.g.length} rows (want 24)`);
  s.g.forEach((row, i) => { if (row.length !== 24) err(`SPR.${id} row ${i}: ${row.length} chars (want 24)`); });
  const chars = new Set(s.g.join("").replace(/\./g, ""));
  for (const ch of chars) if (!(ch in s.pal)) err(`SPR.${id}: char '${ch}' not in palette`);
}
for (const [name, grid] of [["H_D0",H_D0],["H_D1",H_D1],["H_U0",H_U0],["H_U1",H_U1],["H_S0",H_S0],["H_S1",H_S1]]) {
  if (grid.length !== 16) err(`${name}: ${grid.length} rows (want 16)`);
  grid.forEach((row, i) => { if (row.length !== 16) err(`${name} row ${i}: ${row.length} chars (want 16)`); });
  const chars = new Set(grid.join("").replace(/\./g, ""));
  for (const pal of Object.values(HUMAN_PALS)) for (const ch of chars) if (!(ch in pal)) err(`${name}: char '${ch}' missing from a human palette`);
}

// ---------- species / moves / abilities ----------
for (const [id, d] of Object.entries(DEX)) {
  if (!SPR[id]) err(`DEX.${id}: no sprite`);
  if (!ABILITIES[d.ab]) err(`DEX.${id}: unknown ability '${d.ab}'`);
  d.ty.forEach((t) => { if (!TYPES[t]) err(`DEX.${id}: unknown type '${t}'`); });
  (d.ls || []).forEach(([lv, mv]) => { if (!MOVES[mv]) err(`DEX.${id}: learnset move '${mv}' missing`); });
  if (d.evo && !DEX[d.evo[0]]) err(`DEX.${id}: evolves into unknown '${d.evo[0]}'`);
}
for (const [id, mv] of Object.entries(MOVES)) if (!TYPES[mv.t]) err(`MOVES.${id}: unknown type '${mv.t}'`);
STARTERS.forEach((s) => { if (!DEX[s]) err(`STARTERS: unknown '${s}'`); });
SHOP_STOCK.forEach((s) => { if (!ITEMS[s]) err(`SHOP_STOCK: unknown '${s}'`); });
CHARM_IDS.forEach((s) => { if (!ITEMS[s]) err(`CHARM_IDS: unknown '${s}'`); });

// ---------- trainers ----------
for (const [id, t] of Object.entries(TRAINERS)) {
  (t.team || []).forEach(([sp]) => { if (!DEX[sp]) err(`TRAINERS.${id}: unknown species '${sp}'`); });
  if (t.pal && !HUMAN_PALS[t.pal]) err(`TRAINERS.${id}: unknown pal '${t.pal}'`);
}

// ---------- maps ----------
const isWalk = (m, x, y) => {
  const row = m.grid[y];
  if (!row) return false;
  const ch = row[x];
  if (ch === undefined) return false;
  return WALK.includes(ch) || ch === "X"; // gates open later; doors handled separately
};
const dims = (m) => [m.grid[0].length, m.grid.length];

for (const [key, m] of Object.entries(MAPS)) {
  if (!m.grid) { err(`MAPS.${key}: no grid`); continue; }
  const [W, H] = dims(m);
  m.grid.forEach((row, i) => { if (row.length !== W) err(`MAPS.${key} row ${i}: ${row.length} chars (want ${W})`); });
  if (!THEMES[m.theme]) err(`MAPS.${key}: unknown theme '${m.theme}'`);

  // exits: on-map position walkable-adjacent & destination walkable
  for (const e of m.exits || []) {
    if (!MAPS[e.to]) { err(`MAPS.${key} exit → unknown map '${e.to}'`); continue; }
    if (e.x < 0 || e.x >= W || e.y < 0 || e.y >= H) err(`MAPS.${key} exit at ${e.x},${e.y} outside ${W}x${H}`);
    else if (!isWalk(m, e.x, e.y)) err(`MAPS.${key} exit tile ${e.x},${e.y} ('${m.grid[e.y][e.x]}') not walkable`);
    const dst = MAPS[e.to];
    const [DW, DH] = dims(dst);
    if (e.tx < 0 || e.tx >= DW || e.ty < 0 || e.ty >= DH) err(`MAPS.${key} exit → ${e.to} lands at ${e.tx},${e.ty} outside ${DW}x${DH}`);
    else if (!isWalk(dst, e.tx, e.ty)) err(`MAPS.${key} exit → ${e.to} lands on '${dst.grid[e.ty][e.tx]}' at ${e.tx},${e.ty} (not walkable)`);
  }
  // doors: tile must be 'd' or 'g'; destination walkable
  for (const dr of m.doors || []) {
    const ch = (m.grid[dr.y] || "")[dr.x];
    if (ch !== "d" && ch !== "g") err(`MAPS.${key} door at ${dr.x},${dr.y} sits on '${ch}' (want d/g)`);
    if (!MAPS[dr.to]) { err(`MAPS.${key} door → unknown map '${dr.to}'`); continue; }
    const dst = MAPS[dr.to];
    if (!isWalk(dst, dr.tx, dr.ty)) err(`MAPS.${key} door → ${dr.to} lands on '${(dst.grid[dr.ty]||"")[dr.tx]}' at ${dr.tx},${dr.ty}`);
  }
  // npcs stand on walkable tiles (player must walk INTO them)
  for (const n of m.npcs || []) {
    const ch = (m.grid[n.y] || "")[n.x];
    if (ch === undefined) err(`MAPS.${key} npc '${n.name || n.trainer}' at ${n.x},${n.y} off-grid`);
    else if (!WALK.includes(ch)) err(`MAPS.${key} npc '${n.name || n.trainer}' at ${n.x},${n.y} on '${ch}' (not walkable)`);
    if (n.pal && !HUMAN_PALS[n.pal]) err(`MAPS.${key} npc '${n.name}': unknown pal '${n.pal}'`);
    if (n.trainer && !TRAINERS[n.trainer]) err(`MAPS.${key} npc: unknown trainer '${n.trainer}'`);
  }
  // items on walkable tiles
  for (const it of m.items || []) {
    const ch = (m.grid[it.y] || "")[it.x];
    if (ch === undefined || !WALK.includes(ch)) err(`MAPS.${key} item '${it.id}' at ${it.x},${it.y} on '${ch}' (not walkable)`);
    if (!ITEMS[it.id] && it.id !== "embers") err(`MAPS.${key} item: unknown id '${it.id}'`);
  }
  // signs must sit on 's' tiles
  for (const s of m.signs || []) {
    const ch = (m.grid[s.y] || "")[s.x];
    if (ch !== "s") err(`MAPS.${key} sign at ${s.x},${s.y} sits on '${ch}' (want 's')`);
  }
  // every 's' tile has sign lines (else falls back to worn-away text — warn only)
  m.grid.forEach((row, y) => { [...row].forEach((ch, x) => {
    if (ch === "s" && !(m.signs || []).some((s) => s.x === x && s.y === y)) warn(`MAPS.${key}: sign tile ${x},${y} has no lines`);
    if (ch === "d" || ch === "g") {
      const hasDoor = (m.doors || []).some((d2) => d2.x === x && d2.y === y);
      if (ch === "g" && !hasDoor && !m.shopHere) warn(`MAPS.${key}: shop tile ${x},${y} opens generic shop`);
      if (ch === "d" && !hasDoor && !["elder_house","town_shop","vigil_hall"].length) warn(`MAPS.${key}: heal door ${x},${y}`);
    }
    if (ch === "X" && !m.gateFlag) err(`MAPS.${key}: gate tile ${x},${y} but no gateFlag`);
  }); });
  // encounters
  if (m.enc) {
    const sum = m.enc.table.reduce((a, [, w]) => a + w, 0);
    if (sum !== 100) err(`MAPS.${key}: encounter weights sum ${sum} (want 100)`);
    m.enc.table.forEach(([sp]) => { if (!DEX[sp]) err(`MAPS.${key}: encounter species '${sp}' missing`); });
    const hasTall = m.grid.some((row) => row.includes("t"));
    if (!hasTall) warn(`MAPS.${key}: has encounters but no tall grass`);
  } else if (m.grid.some((row) => row.includes("t"))) {
    warn(`MAPS.${key}: decorative tall grass (no encounter table)`);
  }
  if (m.gateFlag && !Object.values(TRAINERS).some((t) => t.flag === m.gateFlag) && !["king"].includes(m.gateFlag)) {
    err(`MAPS.${key}: gateFlag '${m.gateFlag}' matches no trainer flag`);
  }
}

// ---------- reachability (flood fill from town across exits/doors, gates assumed openable) ----------
{
  const seen = new Set(["town"]);
  const queue = ["town"];
  while (queue.length) {
    const k = queue.shift();
    const m = MAPS[k];
    if (!m) continue;
    for (const e of [...(m.exits || []), ...(m.doors || [])]) {
      if (MAPS[e.to] && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
    }
  }
  for (const k of Object.keys(MAPS)) if (!seen.has(k)) err(`MAPS.${k}: unreachable from town`);

  // within-map connectivity: every walkable POI (exits, doors as targets, npcs, items)
  // must be reachable from the map's first entry point
  for (const [key, m] of Object.entries(MAPS)) {
    const [W, H] = dims(m);
    const pass = (x, y) => {
      const ch = (m.grid[y] || "")[x];
      return ch !== undefined && (WALK.includes(ch) || ch === "X" || ch === "d" || ch === "g" || ch === "c" || ch === "s");
    };
    // seeds: all landing points into this map
    const seeds = [];
    for (const [ok, om] of Object.entries(MAPS)) for (const e of [...(om.exits || []), ...(om.doors || [])]) {
      if (e.to === key) seeds.push([e.tx, e.ty]);
    }
    if (key === "town") seeds.push([19, 15]);
    if (!seeds.length) continue;
    const vis = new Set();
    const q = seeds.filter(([x, y]) => pass(x, y));
    q.forEach(([x, y]) => vis.add(x + "," + y));
    while (q.length) {
      const [x, y] = q.pop();
      for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const kk = nx + "," + ny;
        if (!vis.has(kk) && pass(nx, ny)) { vis.add(kk); q.push([nx, ny]); }
      }
    }
    const need = [];
    (m.exits || []).forEach((e) => need.push(["exit", e.x, e.y]));
    (m.npcs || []).forEach((n) => need.push(["npc " + (n.name || n.trainer), n.x, n.y]));
    (m.items || []).forEach((it) => need.push(["item " + it.id, it.x, it.y]));
    (m.doors || []).forEach((d2) => need.push(["door", d2.x, d2.y]));
    for (const [what, x, y] of need) {
      const adj = [[x,y],[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
      if (!adj.some(([ax, ay]) => vis.has(ax + "," + ay))) err(`MAPS.${key}: ${what} at ${x},${y} not reachable within map`);
    }
  }
}

// ---------- report ----------
if (warns.length) { console.log(`-- ${warns.length} warnings --`); warns.slice(0, 40).forEach((w) => console.log("  warn:", w)); }
if (errors.length) {
  console.log(`\n== ${errors.length} ERRORS ==`);
  errors.forEach((e) => console.log("  ERR:", e));
  process.exit(1);
} else {
  console.log(`\nOK — ${Object.keys(MAPS).length} maps, ${Object.keys(DEX).length} species, ${Object.keys(TRAINERS).length} trainers validated clean.`);
}

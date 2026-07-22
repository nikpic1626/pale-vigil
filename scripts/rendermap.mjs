// Renders the whole outdoor world as one stitched PNG (roads align across map
// edges by construction, so adjacent placement yields a continuous region map).
// Run: node scripts/validate.mjs && node scripts/rendermap.mjs → scripts/world.png
import fs from "node:fs";
import zlib from "node:zlib";
import url from "node:url";

const D = await import(url.pathToFileURL("scripts/.data-extract.mjs").href);
const { MAPS, THEMES } = D;

// ---- layout: spine stacked bottom-up, side maps edge-adjacent ----
const SPINE = ["town","oldroad","ashgrove","woods1","woods2","fenmoor","mire1","mire2","vesperrest","chapel","palegate","underveil","lastlantern","threshold","court","behindveil"];
const dims = (k) => [MAPS[k].grid[0].length, MAPS[k].grid.length];
const totalH = SPINE.reduce((a, k) => a + dims(k)[1], 0);
const WESTW = 34, SPINEX = WESTW, EASTX = SPINEX + 38;
const LAYOUT = {}; // key -> [tileX, tileY]
{
  let y = totalH;
  for (const k of SPINE) { const [, h] = dims(k); y -= h; LAYOUT[k] = [SPINEX, y]; }
  LAYOUT.orchard = [SPINEX - dims("orchard")[0], LAYOUT.woods1[1]];
  LAYOUT.hamlet = [SPINEX - dims("hamlet")[0], LAYOUT.mire1[1]];
  LAYOUT.gravemarch = [LAYOUT.hamlet[0] + (18 - 18), LAYOUT.hamlet[1] - dims("gravemarch")[1]];
  LAYOUT.shallows = [EASTX, LAYOUT.chapel[1]];
}
const WT = EASTX + 34, HT = totalH;

// ---- tile colors (same mapping the in-game minimap uses) ----
const tileColor = (th, ch) =>
  ch === "#" ? th.treeTop : ch === "w" ? th.water : ch === "," ? th.path : ch === "t" ? th.tall :
  (ch === "h" || ch === "r") ? th.roof : ch === "X" ? th.gateG : ch === "=" ? th.fence :
  (ch === "d" || ch === "g" || ch === "c") ? th.door : ch === "G" ? th.wall :
  ch === "u" ? th.path : ch === "b" ? th.treeTop : (ch === "l" || ch === "s") ? th.door : th.ground;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---- draw ----
const S = 4;
const W = WT * S, H = HT * S;
const px = Buffer.alloc(W * H * 4);
const put = (x, y, [r, g, b]) => { const i = (y * W + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; };
for (let i = 0; i < W * H; i++) { px[i * 4 + 3] = 255; px[i * 4] = 6; px[i * 4 + 1] = 5; px[i * 4 + 2] = 9; }

for (const [key, [tx0, ty0]] of Object.entries(LAYOUT)) {
  const m = MAPS[key], th = THEMES[m.theme];
  const [w, h] = dims(key);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = hex(tileColor(th, m.grid[y][x]));
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put((tx0 + x) * S + dx, (ty0 + y) * S + dy, c);
  }
  // npc markers (white), items (gold)
  for (const n of m.npcs || []) for (let d = 0; d < S; d++) for (let e = 0; e < S; e++) put((tx0 + n.x) * S + e, (ty0 + n.y) * S + d, [240, 240, 240]);
  for (const it of m.items || []) for (let d = 0; d < S; d++) for (let e = 0; e < S; e++) put((tx0 + it.x) * S + e, (ty0 + it.y) * S + d, [255, 217, 199]);
}

// ---- png encode ----
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const body = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(body)); return Buffer.concat([l, body, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) px.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
fs.writeFileSync("scripts/world.png", Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
console.log(`world.png ${W}x${H} (${WT}x${HT} tiles)`);

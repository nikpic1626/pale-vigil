// Splices the generated outdoor maps into src/PaleVigil.jsx:
//  1. replaces each outdoor map entry inside the MAPS literal
//  2. deletes the post-hoc MAPS.<key>.items/signs/amb mutation lines (now baked in)
//  3. repoints interior return-exits at the new outdoor door positions
//  4. updates the start position + unarmed-guard pushback coordinate
// Run: node scripts/splice.mjs
import fs from "node:fs";

const SRC = "src/PaleVigil.jsx";
const { maps, doorpos, start } = JSON.parse(fs.readFileSync("scripts/.newmaps.json", "utf8"));
let text = fs.readFileSync(SRC, "utf8");

// ---- locate the MAPS literal span ----
const mapsStart = text.indexOf("export const MAPS = {");
if (mapsStart < 0) throw new Error("MAPS not found");
let depth = 0, i = text.indexOf("{", mapsStart), mapsEnd = -1;
for (; i < text.length; i++) {
  if (text[i] === "{") depth++;
  else if (text[i] === "}") { depth--; if (depth === 0) { mapsEnd = i; break; } }
}
if (mapsEnd < 0) throw new Error("MAPS end not found");

// ---- replace each outdoor map block within the span ----
let span = text.slice(mapsStart, mapsEnd);
for (const [key, lit] of Object.entries(maps)) {
  const re = new RegExp(`^  ${key}: \\{`, "m");
  const m = span.match(re);
  if (!m) throw new Error(`map ${key} not found in MAPS`);
  const s = m.index;
  // scan to the matching close of this entry
  let d = 0, j = span.indexOf("{", s), e = -1;
  for (; j < span.length; j++) {
    if (span[j] === "{") d++;
    else if (span[j] === "}") { d--; if (d === 0) { e = j; break; } }
  }
  // consume the trailing comma
  let end = e + 1;
  if (span[end] === ",") end++;
  span = span.slice(0, s) + lit + span.slice(end);
}
text = text.slice(0, mapsStart) + span + text.slice(mapsEnd);

// ---- delete the post-hoc mutation lines ----
text = text.replace(/^MAPS\.[a-z_0-9]+\.(items|signs|amb) = .*$\n/gm, "");
text = text.replace(/^\/\/ ---------- ambient life, treasures, and signs ----------\n/m, "");

// ---- repoint interior return exits ----
for (const [interior, pos] of Object.entries(doorpos)) {
  const re = new RegExp(`(  ${interior}: \\{[\\s\\S]*?exits: \\[[^\\]]*?\\])`, "m");
  const m = text.match(re);
  if (!m) throw new Error(`interior ${interior} exits not found`);
  const patched = m[1].replace(/tx:\s*\d+,\s*ty:\s*\d+/g, `tx:${pos.x}, ty:${pos.y}`);
  text = text.replace(m[1], patched);
}

// ---- start position + guard pushback ----
text = text.replace(/map: "town", x: \d+, y: \d+, face: "down"/, `map: "town", x: ${start.x}, y: ${start.y}, face: "down"`);
text = text.replace(/g\.x = \d+; g\.y = \d+;\s*\n(\s*)startDialog\(g, \["You shouldn't leave unarmed\./,
  `g.x = ${start.x}; g.y = ${start.y};\n$1startDialog(g, ["You shouldn't leave unarmed.`);

fs.writeFileSync(SRC, text);
console.log("spliced", Object.keys(maps).length, "maps,", Object.keys(doorpos).length, "interior exits repointed, start =", JSON.stringify(start));

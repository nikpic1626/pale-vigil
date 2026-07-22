import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

// DEV MODE: start with a max-level test party, full bag, 9999 embers, full map.
// Set to false for a real playthrough.
const DEV_MODE = false;

// ============================================================
// PALE VIGIL — a horror monster-binding RPG
// Explore Hollow Vale, bind Dreads, defeat the three Pale
// Wardens, and face the Hollow King at the Threshold.
// ============================================================

// DATA-START (pure data — validated by build script)

// ---------- type chart ----------
// cycle: flame > shade > spirit > blood > bone > hex > flame
export const TYPES = {
  flame:  { n: "Flame",  c: "#e08840" },
  shade:  { n: "Shade",  c: "#7a6aa0" },
  spirit: { n: "Spirit", c: "#7ec8b4" },
  blood:  { n: "Blood",  c: "#c04848" },
  bone:   { n: "Bone",   c: "#cfc39a" },
  hex:    { n: "Hex",    c: "#a85ac0" },
};
export const CHART = {
  flame:  { shade: 2, hex: 0.5, flame: 0.5 },
  shade:  { spirit: 2, flame: 0.5, shade: 0.5 },
  spirit: { blood: 2, shade: 0.5, spirit: 0.5 },
  blood:  { bone: 2, spirit: 0.5, blood: 0.5 },
  bone:   { hex: 2, blood: 0.5, bone: 0.5 },
  hex:    { flame: 2, bone: 0.5, hex: 0.5 },
};

// ---------- moves ----------
export const MOVES = {
  sputter:    { n: "Sputter",       t: "flame",  p: 40, a: 100 },
  kindle:     { n: "Kindle",        t: "flame",  p: 0,  a: 100, fx: { self: { atk: 1 } }, d: "Raises own Attack" },
  scorch:     { n: "Scorch",        t: "flame",  p: 65, a: 95,  fx: { blight: 0.2 }, d: "20% Blight" },
  pyre:       { n: "Pyre Burst",    t: "flame",  p: 90, a: 85 },
  wisptouch:  { n: "Wisp Touch",    t: "spirit", p: 35, a: 100 },
  terrify:    { n: "Terrify",       t: "spirit", p: 0,  a: 90,  fx: { foe: { atk: -1 } }, d: "Lowers foe Attack" },
  wail:       { n: "Mourning Wail", t: "spirit", p: 50, a: 100, fx: { fear: 0.2 }, d: "20% Fear" },
  haunt:      { n: "Haunting",      t: "spirit", p: 75, a: 90 },
  possess:    { n: "Possess",       t: "spirit", p: 95, a: 80 },
  shadowrake: { n: "Shadow Rake",   t: "shade",  p: 45, a: 100 },
  gloom:      { n: "Gloom Veil",    t: "shade",  p: 0,  a: 100, fx: { self: { def: 1 } }, d: "Raises own Defense" },
  nightfall:  { n: "Nightfall",     t: "shade",  p: 80, a: 90 },
  dreadhowl:  { n: "Dread Howl",    t: "shade",  p: 0,  a: 90,  fx: { foe: { def: -1 } }, d: "Lowers foe Defense" },
  drain:      { n: "Life Drain",    t: "blood",  p: 40, a: 100, fx: { drain: 0.5 }, d: "Heals half damage dealt" },
  gash:       { n: "Gash",          t: "blood",  p: 60, a: 95,  fx: { blight: 0.2 }, d: "20% Blight" },
  hemorrhage: { n: "Hemorrhage",    t: "blood",  p: 85, a: 85 },
  bonespur:   { n: "Bone Spur",     t: "bone",   p: 45, a: 100 },
  marrow:     { n: "Marrow Bite",   t: "bone",   p: 60, a: 95 },
  boneward:   { n: "Bone Ward",     t: "bone",   p: 0,  a: 100, fx: { self: { def: 1 } }, d: "Raises own Defense" },
  gravecrush: { n: "Grave Crush",   t: "bone",   p: 80, a: 90 },
  hexbolt:    { n: "Hex Bolt",      t: "hex",    p: 50, a: 100 },
  curse:      { n: "Curse",         t: "hex",    p: 0,  a: 90,  fx: { blightSure: 1 }, d: "Inflicts Blight" },
  ruin:       { n: "Word of Ruin",  t: "hex",    p: 85, a: 85 },
};

export const SPR = {
wickling: { pal: { o:"#241a10", y:"#ffe9a0", f:"#f5a545", r:"#d8622e", w:"#f2ead6", m:"#ddd0b4", s:"#b8a98a", e:"#35283f", k:"#8a2a2a" }, g: [
"..........yy............",
".........yffy...........",
".........yffy...........",
"........yffffy..........",
"........yfrrfy..........",
".........frrf...........",
"..........ff............",
".........oooo...........",
"......oooooooo..........",
".....owwwwwwwwo.........",
"....owwwwwwwwwwo........",
"....owweewweewwo........",
"....owweewweewwo........",
"....owwwwwwwwwwo........",
"....owwwkkwwwwwo........",
"....omwwwwwwwwmo........",
"...owmwwwwwwwwmwo.......",
"...owmwwwwwwwwmwo.......",
"...osmwwwwwwwwmso.......",
"..osmmwwwwwwwwmmso......",
"..osmmmwwwwwwmmmso......",
"..ossmmmmmmmmmmsso......",
"...oossssssssssoo.......",
"....oooooooooo..........",
]},
pyrewraith: { pal: { o:"#241208", y:"#ffe9a0", f:"#f59b3c", r:"#d8542a", R:"#a83420", w:"#f6ecd2", m:"#d9c9a8", s:"#ab9878", e:"#2a1533", g:"#ffdf70" }, g: [
"....y....yy....y........",
"....yy..yffy..yy........",
".....yfyffffyfy.........",
".....offffffffo.........",
"....offrffffrffo........",
"....ofrffffffrfo........",
"...offffffffffffo.......",
"...ofwwwwwwwwwwfo.......",
"...ofwggwwwwggwfo.......",
"...ofwggwwwwggwfo.......",
"...ofwwwwwwwwwwfo.......",
"...offwwweewwwffo.......",
"...oRffffffffffRo.......",
"....offffffffffo........",
"....owwwwwwwwwwo........",
"...owwmwwwwwwmwwo.......",
"...owmwwwwwwwwmwo.......",
"...owwwwmwwmwwwwo.......",
"...oswwwwwwwwwwso.......",
"....osww.ww.wwso........",
"....osw..ww..wso........",
".....o...ww...o.........",
".........ww.............",
".........w..............",
]},
gravepup: { pal: { o:"#191410", b:"#eee4c8", m:"#d6c9a4", s:"#a99878", d:"#46392c", e:"#e8542e", n:"#2a2118" }, g: [
"........................",
"...oo...................",
"..obbo..............oo..",
"..obmbo............obbo.",
"..obbmbo...........obo..",
"..obbbbo..........obbo..",
"..obeebbo........obmo...",
"..obeebbboooooooobbo....",
"..obbbbbbbbbbbbbbbbo....",
"..onbbmbbmbbmbbmbbso....",
"...obbbbbbbbbbbbbbo.....",
"...obdbdbdbdbdbdbo......",
"...obdbdbdbdbdbdbo......",
"...obbbbbbbbbbbbbo......",
"...osbbsbbbbsbbso.......",
"....obbo....obbo........",
"....obbo....obbo........",
"....obo......obo........",
"....obo......obo........",
"....osbo....osbo........",
"....ooo......ooo........",
"........................",
"........................",
"........................",
]},
mausohound: { pal: { o:"#140f0c", b:"#ece2c4", m:"#d2c5a0", s:"#a08e6c", d:"#322a3c", D:"#241e2e", e:"#e04040", g:"#6a5a80", n:"#1c1714" }, g: [
"...oo...................",
"..obbo..................",
"..obmbo.............gg..",
"..obbmbo...........gddg.",
"..obbbbboo.........oddo.",
"..obeebbbbo.......oddgo.",
"..obeebbbbboooooooddo...",
"..obbbbbbdddddddddddo...",
"...obboddddddddddddo....",
"...onboddbmbbmbbddo.....",
"....odddbbbbbbdddo......",
"....oddbdbbdbbddDo......",
"....oddbdbbdbbddDo......",
"....odddddddddddDo......",
"....oDdddddddddDDo......",
"....obbo.oddo.obbo......",
"....obbo.oddo.obbo......",
"....obo...odo..obo......",
"....obo...odo..obo......",
"...osbo...oso..osbo.....",
"...ooo.....o....ooo.....",
"........................",
"........................",
"........................",
]},
sorrowmoth: { pal: { o:"#1c1826", w:"#cfeadd", v:"#9cc4b4", V:"#6e9486", t:"#e2aec4", d:"#574f6e", D:"#3c3652", e:"#f4f4f8" }, g: [
"......o..........o......",
".....o.o........o.o.....",
"......o..o....o..o......",
".......o..o..o..o.......",
"..ooo......dd......ooo..",
".owwwoo...oddo...oowwwo.",
".owwwwwoo.oeeo.oowwwwwo.",
"owwtwwwwo.oeeo.owwwwtwwo",
"owwttwwwooddddoowwwttwwo",
"owwwwvwwooddddoowwvwwwwo",
"ovwwwwvwo.oddo.owvwwwwvo",
".ovwwwvo..oddo..ovwwwvo.",
".ovvwvoo..oddo..oovwvvo.",
"..ovo...ovvddvvo...ovo..",
"...o...ovvvddvvvo...o...",
".......ovVvddvVvo.......",
"........oVvddvVo........",
".........oVddVo.........",
"..........oddo..........",
"..........oDDo..........",
"...........oo..........."+"",
"........................",
"........................",
"........................",
]},
duskveil: { pal: { o:"#171322", w:"#a7dcc9", v:"#79ab9a", V:"#527a6c", p:"#c07ae0", P:"#8a4aaa", d:"#2f2842", D:"#201b30", e:"#f2ecff" }, g: [
"o......................o",
"oo....................oo",
"owoo................oowo",
"owwwoo............oowwwo",
"owwwwwoo...oo...oowwwwwo",
"owpwwwwo..oddo..owwwwpwo",
"owwwwwwo.oddddo.owwwwwwo",
"owwvwwwooddddddoowwwvwwo",
"owwwwwwoodeddedoowwwwwwo",
"ovwwwwwooddddddoowwwwvwo",
"ovwwvwwo.odppdo.owwvwwvo",
".ovwwwwo.odppdo.owwwwvo.",
".ovwvwvo..oddo..ovwvwvo.",
"..ovwvo...oddo...ovwvo..",
"..oV.vo...oddo...ov.Vo..",
"...o..o...oddo...o..o...",
"..........oddo..........",
"..........odDo..........",
"...........odo..........",
"...........oDo..........",
"............o...........",
"........................",
"........................",
"........................",
]},
shadeling: { pal: { o:"#0d0a14", d:"#2e2740", m:"#3f3758", s:"#211c30", e:"#ffd84a", E:"#b08a20", t:"#f2f2f2" }, g: [
"........................",
".....oo........oo.......",
"....omdo......odmo......",
"....omddooooooddmo......",
"...omdddddddddddmo......",
"..omddddddddddddmo......",
"..oddeeddddddeeddo......",
"..oddeeddddddeeddo......",
"..oddEEddddddEEddo......",
"..oddddddddddddddo......",
"..odttdttdttdttddo......",
"..osdddddddddddso.......",
"..osddddddddddso........",
"...osddddddddso.........",
"...odd.dddd.ddo.........",
"....od..dd..do..........",
"....o...dd...o..........",
"........dd..............",
"........d...............",
"........................",
"........................",
"........................",
"........................",
"........................",
]},
willowisp: { pal: { o:"#221708", y:"#fff0b0", Y:"#ffe070", f:"#f5a03c", r:"#d8622e", R:"#a83e1c", e:"#3c2a52" }, g: [
"...........o............",
"..........oyo...........",
".........oyYyo..........",
".........oyYYyo.........",
"........oyYffYyo........",
"........oyYffYyo........",
".......oyYffffYyo.......",
".......oyffffffyo.......",
"......oyfeeffeefyo......",
"......oyfeeffeefyo......",
"......ofyffffffyfo......",
"......offfrffrfffo......",
"......orffffffffro......",
".......orffffffro.......",
".......oRrffffrRo.......",
"........orrffrro........",
".........orrrro.........",
"..........orro..........",
"...........rr...........",
".........r..r..r........",
"........r.......r.......",
"........................",
"........................",
"........................",
]},
marrowmouse: { pal: { o:"#191410", b:"#efe5c8", m:"#d6c9a4", s:"#a59472", d:"#58493c", D:"#40342a", e:"#1f1b16", p:"#e598aa" }, g: [
"........................",
"...oo........oo.........",
"..obbo......obbo........",
"..obpbo....obpbo........",
"...obbboooobbbo.........",
"..obbbbbbbbbbbbo........",
"..obbbbbbbbbbbbo........",
"..obeebbbbbbeebo........",
"..obeebbbbbbeebo........",
"..obbbbbDDbbbbbo........",
"...obbbbbbbbbbo.........",
"...odddddddddddo........",
"..odddddddddddddo.......",
"..oddDdddddddDddo.......",
"..odddddddddddddo..pp...",
"..oddddddddddddo..p.....",
"...oddddddddddo.pp......",
"...osdddddddddso........",
"....osdddddddso.........",
"....odo.oo.odo..........",
"....oo......oo..........",
"........................",
"........................",
"........................",
]},
bloodfly: { pal: { o:"#1c0d0d", r:"#c04040", R:"#8a2a2a", p:"#e08585", w:"#cfc3d6", W:"#a596b0", e:"#f2e2a8", E:"#c8a860", n:"#6e2424" }, g: [
"..ww..............ww....",
".wwww............wwww...",
".wWwww..........wwwWw...",
"..wwwww........wwwww....",
"..wWwwwo......owwwWw....",
"...wwwwwo....owwwww.....",
"....wwwooooooowwww......",
"......orrrrrrro.........",
".....orreerreero........",
".....orreerreero........",
".....orrrrrrrrro........",
"......orrpprrro.........",
"......orrpprrro.........",
".....oRrrrrrrRo.........",
".....oRrrrrrrRo.........",
"......oRrrrRo...........",
".......oRRRo............",
"........ono.............",
".........n..............",
".........n..............",
".........n..............",
"........................",
"........................",
"........................",
]},
hexen: { pal: { o:"#150c1c", p:"#a864c4", P:"#c88ae0", v:"#7a3f9a", V:"#552a70", e:"#ffd84a", t:"#f0f0f0", g:"#e070ff" }, g: [
"...o..............o.....",
"..oo..............oo....",
"..opo............opo....",
"..oppo..........oppo....",
"...oppoooooooooooppo....",
"...oPpppppppppppppo.....",
"..oPppppppgppppppppo....",
"..oppeepppgpppeeppo.....",
"..oppeeppppppppeeppo....",
"..oppppppppppppppppo....",
"..opptptptptptptppo.....",
"..ovpttttttttttppvo.....",
"...ovpppppppppppvo......",
"...ovppppppppppvo.......",
"....ovpppppppvvo........",
"....oVvpppvvVo..........",
".....oVv.pp.vVo....ov...",
"......o..pp..o....ovo...",
".........pp......ovvo...",
".........opo....ovvo....",
"..........o.....ovo.....",
"................oo......",
"........................",
"........................",
]},
choirling: { pal: { o:"#1a1820", h:"#e2dcc9", m:"#c2bba6", s:"#968f7a", d:"#12121e", e:"#eef0ff", u:"#8a92cc", n:"#cfd4f2" }, g: [
"..............n.........",
"......oooo...nn.........",
".....ohhhho.............",
"....ohhhhhho....n.......",
"...ohhhhhhhho...........",
"...ohhoddohho...........",
"..ohhoddddohho..........",
"..ohoddddddoho..........",
"..ohodeddedoho..........",
"..ohoddddddoho..........",
"..ohoddeeddoho..........",
"..ohhoddddohho..........",
"..ohhhoooohhhho.........",
"..ohhhhhhhhhhho.........",
".ohhhuhhhhuhhhho........",
".ohhhhhhhhhhhhho........",
".ohmhhhhhhhhmhho........",
".ohmhhhhhhhhmhho........",
".osmhhhhhhhhmso.........",
".ossmhhhhhhmsso.........",
"..ossmmmmmmsso..........",
"...oossssssoo...........",
"....oooooooo............",
"........................",
]},
ossari: { pal: { o:"#171310", b:"#ece2c4", m:"#d2c5a0", s:"#a08e6c", d:"#2c2620", e:"#e0512e", h:"#a565d0", H:"#7a3fa8" }, g: [
"........................",
"......oooooooo..........",
".....obbbbbbbbo.........",
"....obbbbbbbbbbo........",
"....obeebbbbeebo........",
"....obeebbbbeebo........",
"....obbbbddbbbbo........",
"....obbbbbbbbbbo........",
".....obsbsbsbso.........",
"....oobbbbbbbboo........",
"..oobmbboddobbmboo......",
".obbo.odbdbdbdo.obbo....",
".obmo.odbdhdbdo.obmo....",
".obbo.odbdbdbdo.obbo....",
".osbo.odbdbdbdo.osbo....",
"..oo..oddddddo...oo.....",
"......obbssbbo..........",
".....obbbbbbbbo.........",
".....obbo..obbo.........",
".....obbo..obbo.........",
".....osbo..osbo.........",
"....ooboo..ooboo........",
"........................",
"........................",
]},
nihilim: { pal: { o:"#070510", d:"#14101f", D:"#0d0a17", v:"#241c38", p:"#b06ad0", P:"#d898f0", e:"#ffd84a", w:"#e8e2f8", g:"#6a5090" }, g: [
"....p...p....p...p......",
"....pP..pP..Pp..Pp......",
"....pppppppppppppp......",
"...oddddddddddddddo.....",
"..odddddddddddddddo.....",
"..oddddddddddddddddo....",
"..odeeddddddddeeddo.....",
"..odeeddddddddeeddo.....",
"..oddddddddddddddddo....",
"..odvvddddddddvvdddo....",
"..oddddpppppppdddddo....",
"..oddddddddddddddddo....",
"...odddddddddddddddo....",
"...ogdddddddddddddgo....",
"...ogddvddddddvddgo.....",
"....ogdvddddddvdgo......",
"....ogv.dddddd.vgo......",
".....og.oddddo.go.......",
".....o...dddd...o.......",
"..........ddd...........",
"..........dd............",
"...........d............",
"........................",
"........................",
]},
};

// ---------- new creature sprites ----------
SPR.vespire = { pal: { o:"#1a0d10", r:"#b03848", R:"#7e2432", p:"#d87888", w:"#5c3a48", W:"#3f2833", e:"#f2e2a8", t:"#f0f0f0" }, g: [
"..o..................o..",
".oWo................oWo.",
".oWwo..............owWo.",
".oWwwo............owwWo.",
".oWwwwoo........oowwwWo.",
"..oWwwwwo.oooo.owwwwWo..",
"..oWwwwooorrrrooowwwWo..",
"...oWwoorrrrrrrroowWo...",
"...oWoorreerreerroWo....",
"....oorreerreerroo......",
"....orrrrrrrrrrrro......",
"....orrttrrrrttrro......",
"....oRrrrpprrrrRo.......",
".....oRrrppprrRo........",
".....oRRrrrrRRo.........",
"......oRRRRRRo..........",
".......oRRRRo...........",
"........oRRo............",
".........oo.............",
"........................",
"........................",
"........................",
"........................",
"........................",
]};
SPR.hemolich = { pal: { o:"#160a10", r:"#8e2438", R:"#611722", p:"#c85a70", w:"#efe2d2", m:"#cfbfae", e:"#ffd84a", d:"#2a1018", g:"#ff7088" }, g: [
"..........oooo..........",
".........owwwwo.........",
".........owwwwo.........",
".........oweewo.........",
".........oweewo.........",
".........owmmwo.........",
"..........owwo..........",
"......oo..oddo..oo......",
".....oppo.oddo.oppo.....",
"....opprooddddoorppo....",
"....oprrrrddddrrrrpo....",
"...oprrrrrggrrrrrrpo....",
"...orrrrrrggrrrrrro.....",
"...orrrrrrrrrrrrro......",
"...oRrrrrrrrrrrRo.......",
"...oRrrrrrrrrrrRo.......",
"....oRrrrrrrrrRo........",
"....oRrrrrrrrrRo........",
"....oRRrrrrrrRRo........",
".....oRRRRRRRRo.........",
".....oooooooooo.........",
"........................",
"........................",
"........................",
]};
SPR.cindermaw = { pal: { o:"#1c0f08", b:"#ece0c0", m:"#cfc19c", s:"#9c8c68", y:"#ffe58a", f:"#f59b3c", r:"#d8542a", e:"#ff5a2e", d:"#3a2a1c" }, g: [
"........................",
"....ooooooooo...........",
"...obbbbbbbbbo..........",
"..obbbbbbbbbbbo.........",
"..obeebbbbbeebo.........",
"..obeebbbbbeebo.........",
"..obbbbbddbbbbo.........",
"..obbbbbbbbbbbo.........",
"..obsbsbsbsbsbo.........",
"..oyfyfyfyfyfyo.........",
"..offrfrfrfrffo.........",
"..obbbbbbbbbbbo.........",
"..obbdddddddbbo.........",
"...obbo...obbo..........",
"...osbo...osbo..........",
"...ooo.....ooo..........",
"........................",
"........................",
"........................",
"........................",
"........................",
"........................",
"........................",
"........................",
]};
SPR.mirelurch = { pal: { o:"#10140e", d:"#3c4634", D:"#2b3325", m:"#4e5c42", s:"#232a1e", e:"#e8d44f", r:"#8e2438", w:"#24352a" }, g: [
"........................",
"......ooooooooo.........",
"....oommmmmmmmoo........",
"...ommmdddddddmmo.......",
"..ommddddddddddmmo......",
"..omdddddddddddddo......",
".omddeeddddddeeddmo.....",
".omddeeddddddeeddmo.....",
".omdddddddddddddddo.....",
".odddrrrrrrrrrrdddo.....",
".oddDrrrrrrrrrrDddo.....",
".odddddddddddddddDo.....",
".odddDDDddddDDDdddo.....",
"oddoddddddddddddoddo....",
"odwoodddddddddddoowdo...".slice(0,24),
"odwo.oDdddddddDo.owdo...",
".oo..oDDddddDDo...oo....",
".w...oDDDDDDDDo....w....",
".....osssssssso.........",
"....oooooooooooo........",
"........................",
"........................",
"........................",
"........................",
]};
SPR.grimalkin = { pal: { o:"#100c16", d:"#29223a", m:"#372e4e", M:"#453a60", e:"#ffd84a", p:"#b06ad0", w:"#f0f0f0" }, g: [
"........................",
"...o......o.............",
"..omo....omo............",
"..ommo..ommo............",
"..ommmoommmo............",
"..ommmmmmmmo............",
".omeemmmeemo............",
".ommmmmmmmmo............",
".omwmmmmmwmo............",
"..ommmpmmmo.............",
"..oddmmmmddoo...........",
"..odddmmmddddoo.....oo..",
"..oddddddddddddo...odo..",
"...odddddddddddo..odo...",
"...oddddddddddddoodo....",
"....oddddddddddddoo.....",
"....odo.odo.odo.........",
"....odo.odo.odo.........",
"....oo..oo..oo..........",
"........................",
"........................",
"........................",
"........................",
"........................",
]};
SPR.paleling = { pal: { o:"#8a8494", d:"#efeaf4", m:"#ffffff", s:"#cfc8dc", e:"#5a3a7a", E:"#3a2454", t:"#2a2338" }, g: SPR.shadeling.g };

// ---------- human sprites: 16x16, 3 facings x 2 frames ----------
export const H_D0 = [
"................",
".....oooooo.....",
"....oCccccCo....",
"...oCccccccCo...",
"...ohoffffoho...",
"...ohofeefoho...",
"...ohoffffoho...",
"....occcccco....",
"...oCccccccCo...",
"...occcccccco...",
"...ocbbbbbbco...",
"...osccccccso...",
"....osccccso....",
"....occ..cco....",
"....oso..oso....",
"....oo....oo....",
];
export const H_D1 = [
"................",
".....oooooo.....",
"....oCccccCo....",
"...oCccccccCo...",
"...ohoffffoho...",
"...ohofeefoho...",
"...ohoffffoho...",
"....occcccco....",
"...oCccccccCo...",
"...occcccccco...",
"...ocbbbbbbco...",
"...osccccccso...",
"....osccccso....",
"....occ..cco....",
"....oso...o.....",
"....oo..........",
];
export const H_U0 = [
"................",
".....oooooo.....",
"....oCccccCo....",
"...oCccccccCo...",
"...ohccccccho...",
"...ohccccccho...",
"...occcccccco...",
"....occcccco....",
"...oCccccccCo...",
"...occcccccco...",
"...osccccccso...",
"...osccccccso...",
"....osccccso....",
"....occ..cco....",
"....oso..oso....",
"....oo....oo....",
];
export const H_U1 = [
"................",
".....oooooo.....",
"....oCccccCo....",
"...oCccccccCo...",
"...ohccccccho...",
"...ohccccccho...",
"...occcccccco...",
"....occcccco....",
"...oCccccccCo...",
"...occcccccco...",
"...osccccccso...",
"...osccccccso...",
"....osccccso....",
"....occ..cco....",
"....oso...o.....",
"....oo..........",
];
export const H_S0 = [
"................",
".....ooooo......",
"....oCcccco.....",
"...oCcccccco....",
"...ochhoffo.....",
"...ochhofeo.....",
"...ochhoffo.....",
"....occccoo.....",
"....oscccco.hh..",
"....oscccco.ll..",
"....oscbbco.ll..",
"....oscccco.....",
"....occcco......",
"....oc.oco......",
"....oo..oo......",
"................",
];
export const H_S1 = [
"................",
".....ooooo......",
"....oCcccco.....",
"...oCcccccco....",
"...ochhoffo.....",
"...ochhofeo.....",
"...ochhoffo.....",
"....occccoo.....",
"....oscccco.hh..",
"....oscccco.ll..",
"....oscbbco.ll..",
"....oscccco.....",
"....occcco......",
"...oco..oco.....",
"...oo....oo.....",
"................",
];
export const HUMAN_PALS = {
  player:  { o:"#14121c", c:"#3a4458", C:"#4e5a72", s:"#2a3140", f:"#e8c8a0", e:"#20202c", b:"#c9a55c", h:"#242c3c", l:"#ffd977" },
  player_f:{ o:"#160f18", c:"#5c3a58", C:"#754a70", s:"#432940", f:"#eccfae", e:"#20202c", b:"#c9a55c", h:"#7a4a30", l:"#ffd977" },
  elder:   { o:"#14121c", c:"#6a6458", C:"#7e7768", s:"#524d42", f:"#e0c09a", e:"#20202c", b:"#8a8070", h:"#4a463c", l:"#8a8070" },
  villager:{ o:"#14121c", c:"#5a4a3a", C:"#6e5c48", s:"#463a2e", f:"#e8c8a0", e:"#20202c", b:"#7a6a52", h:"#443628", l:"#7a6a52" },
  widow:   { o:"#0e0c12", c:"#26222e", C:"#322c3c", s:"#1c1924", f:"#d8c0a0", e:"#20202c", b:"#3a3348", h:"#1a1722", l:"#3a3348" },
  wren:    { o:"#180c0c", c:"#8a3030", C:"#a44040", s:"#642424", f:"#e8c8a0", e:"#20202c", b:"#c9a55c", h:"#521e1e", l:"#c9a55c" },
  bog:     { o:"#0e120c", c:"#4a5a3a", C:"#5c7048", s:"#38462c", f:"#d0c0a0", e:"#20202c", b:"#6a5a3a", h:"#36422c", l:"#6a5a3a" },
  sol:     { o:"#0e120e", c:"#3e5a4a", C:"#4e7060", s:"#2e463a", f:"#dcc4a0", e:"#20202c", b:"#8aa08a", h:"#2c4238", l:"#8aa08a" },
  acolyte: { o:"#16141a", c:"#b8b0a0", C:"#ccc4b4", s:"#948c7c", f:"#e8c8a0", e:"#20202c", b:"#8890c8", h:"#948c7c", l:"#8890c8" },
  choir:   { o:"#16141a", c:"#e0dac8", C:"#f0ead8", s:"#b8b2a0", f:"#e8c8a0", e:"#20202c", b:"#8890c8", h:"#c8c2b0", l:"#8890c8" },
  king:    { o:"#0a0812", c:"#1c1428", C:"#2a1e3c", s:"#140e1e", f:"#c8b8d0", e:"#e8d44f", b:"#b06ad0", h:"#100a18", l:"#b06ad0" },
};

// ---------- abilities (one passive per species) ----------
export const ABILITIES = {
  lastlight:   { n: "Last Light",    d: "Survives a fatal blow at 1 HP, once per battle" },
  flareup:     { n: "Flare Up",      d: "Attack rises the first time HP falls below half" },
  graveloyal:  { n: "Grave Loyal",   d: "Cannot be struck by vicious (critical) hits" },
  boneplate:   { n: "Bone Plate",    d: "Takes 12% less damage from all attacks" },
  sorrowdust:  { n: "Sorrow Dust",   d: "Attackers that strike it may lose Attack" },
  veilborn:    { n: "Veilborn",      d: "Immune to Fear" },
  skulk:       { n: "Skulk",         d: "Shade moves deal 15% more damage" },
  kindled:     { n: "Kindled",       d: "Flame moves deal 15% more damage" },
  tidybones:   { n: "Tidy Bones",    d: "Immune to Blight" },
  leech:       { n: "Leech",         d: "Draining moves heal twice as much" },
  hexweaver:   { n: "Hexweaver",     d: "Its attacks may inflict Blight" },
  hymnward:    { n: "Hymnal Ward",   d: "Immune to Fear" },
  calcify:     { n: "Calcify",       d: "Defense rises when struck by a vicious hit" },
  voidcrown:   { n: "Void Crown",    d: "Its stats cannot be lowered" },
  nightthirst: { n: "Night Thirst",  d: "Blood moves deal 15% more damage" },
  crimsonrite: { n: "Crimson Rite",  d: "Draining moves heal twice as much" },
  ashenjaw:    { n: "Ashen Jaw",     d: "Flame moves deal 15% more damage" },
  palegrace:   { n: "Pale Grace",    d: "Speed rises upon entering battle" },
  ambusher:    { n: "Ambusher",      d: "Attack rises upon entering battle" },
  blackcross:  { n: "Black Cross",   d: "Lowers the foe's Speed upon entering battle" },
};

// ---------- species ----------
export const DEX = {
  wickling:   { n: "Wickling",    ty: ["flame"],          b: { hp:45, atk:52, def:40, spd:58 }, cr: 0.55, evo: ["pyrewraith", 16], ab: "lastlight",
    learn: [[1,"sputter"],[4,"kindle"],[8,"scorch"],[13,"wail"]], dx: "A candle lit at a deathbed. It refuses to go out." },
  pyrewraith: { n: "Pyrewraith",  ty: ["flame","spirit"], b: { hp:62, atk:74, def:56, spd:76 }, cr: 0.2, ab: "flareup",
    learn: [[1,"sputter"],[1,"kindle"],[1,"scorch"],[13,"wail"],[18,"pyre"],[22,"haunt"]], dx: "The grief of a hundred vigils, burning upright." },
  gravepup:   { n: "Gravepup",    ty: ["bone"],           b: { hp:55, atk:56, def:54, spd:40 }, cr: 0.55, evo: ["mausohound", 16], ab: "graveloyal",
    learn: [[1,"bonespur"],[4,"dreadhowl"],[8,"marrow"],[13,"boneward"]], dx: "It still waits at its keeper's grave. It will wait for you too." },
  mausohound: { n: "Mausohound",  ty: ["bone","shade"],   b: { hp:78, atk:78, def:72, spd:48 }, cr: 0.2, ab: "boneplate",
    learn: [[1,"bonespur"],[1,"dreadhowl"],[1,"marrow"],[13,"boneward"],[18,"gravecrush"],[22,"nightfall"]], dx: "Guards the doors of mausoleums. And opens them." },
  sorrowmoth: { n: "Sorrowmoth",  ty: ["spirit"],         b: { hp:48, atk:50, def:42, spd:64 }, cr: 0.55, evo: ["duskveil", 16], ab: "sorrowdust",
    learn: [[1,"wisptouch"],[4,"terrify"],[8,"wail"],[13,"gloom"]], dx: "Drawn to weeping the way other moths are drawn to light." },
  duskveil:   { n: "Duskveil",    ty: ["spirit","hex"],   b: { hp:62, atk:70, def:58, spd:80 }, cr: 0.2, ab: "veilborn",
    learn: [[1,"wisptouch"],[1,"terrify"],[1,"wail"],[13,"gloom"],[18,"haunt"],[22,"possess"]], dx: "Its wings are cut from the Veil itself." },
  shadeling:  { n: "Shadeling",   ty: ["shade"],          b: { hp:40, atk:46, def:36, spd:56 }, cr: 0.7, ab: "skulk",
    learn: [[1,"shadowrake"],[6,"gloom"],[12,"nightfall"]], dx: "Your shadow, three seconds after you stop moving." },
  paleling:   { n: "Paleling",    ty: ["shade","spirit"], b: { hp:55, atk:66, def:50, spd:80 }, cr: 0.2, ab: "palegrace",
    learn: [[1,"shadowrake"],[1,"wisptouch"],[10,"gloom"],[16,"nightfall"],[18,"haunt"]], dx: "A shadow cast by nothing. It is very proud of this." },
  willowisp:  { n: "Willowisp",   ty: ["flame"],          b: { hp:38, atk:50, def:34, spd:60 }, cr: 0.65, ab: "kindled",
    learn: [[1,"sputter"],[7,"scorch"],[14,"wail"]], dx: "Leads travelers off the path, gently, apologetically." },
  marrowmouse:{ n: "Marrowmouse", ty: ["bone"],           b: { hp:44, atk:48, def:44, spd:48 }, cr: 0.7, ab: "tidybones",
    learn: [[1,"bonespur"],[7,"marrow"],[13,"boneward"]], dx: "Nests inside old coffins. Tidies them, even." },
  bloodfly:   { n: "Bloodfly",    ty: ["blood"],          b: { hp:42, atk:54, def:36, spd:58 }, cr: 0.6, ab: "leech",
    learn: [[1,"drain"],[9,"gash"],[16,"hemorrhage"]], dx: "The mire hums with them at dusk. Then the mire goes quiet." },
  vespire:    { n: "Vespire",     ty: ["blood"],          b: { hp:46, atk:58, def:40, spd:62 }, cr: 0.55, evo: ["hemolich", 20], ab: "nightthirst",
    learn: [[1,"drain"],[8,"gash"],[15,"hemorrhage"]], dx: "It drinks regret first. Blood is dessert." },
  hemolich:   { n: "Hemolich",    ty: ["blood","hex"],    b: { hp:64, atk:76, def:56, spd:70 }, cr: 0.15, ab: "crimsonrite",
    learn: [[1,"drain"],[1,"gash"],[1,"hemorrhage"],[20,"curse"],[24,"ruin"]], dx: "A noble that refused to stop. Several times." },
  mirelurch:  { n: "Mirelurch",   ty: ["blood","shade"],  b: { hp:62, atk:58, def:64, spd:30 }, cr: 0.5, ab: "ambusher",
    learn: [[1,"gash"],[12,"gloom"],[17,"hemorrhage"]], dx: "The mire's slowest thing, and its most certain." },
  hexen:      { n: "Hexen",       ty: ["hex"],            b: { hp:46, atk:56, def:42, spd:52 }, cr: 0.55, ab: "hexweaver",
    learn: [[1,"hexbolt"],[8,"curse"],[15,"ruin"]], dx: "Born from a curse spoken and immediately regretted." },
  grimalkin:  { n: "Grimalkin",   ty: ["shade","hex"],    b: { hp:50, atk:64, def:44, spd:74 }, cr: 0.45, ab: "blackcross",
    learn: [[1,"shadowrake"],[1,"hexbolt"],[16,"nightfall"],[20,"ruin"]], dx: "Crossing its path is not the mistake. Noticing is." },
  choirling:  { n: "Choirling",   ty: ["spirit"],         b: { hp:50, atk:56, def:46, spd:58 }, cr: 0.5, ab: "hymnward",
    learn: [[1,"wisptouch"],[10,"wail"],[17,"haunt"]], dx: "It knows one hymn. It has been singing it for 200 years." },
  ossari:     { n: "Ossari",      ty: ["bone","hex"],     b: { hp:58, atk:62, def:60, spd:36 }, cr: 0.45, ab: "calcify",
    learn: [[1,"bonespur"],[12,"curse"],[18,"gravecrush"]], dx: "A congregation's worth of bones that voted to stand up." },
  cindermaw:  { n: "Cindermaw",   ty: ["flame","bone"],   b: { hp:60, atk:70, def:58, spd:50 }, cr: 0.4, ab: "ashenjaw",
    learn: [[1,"scorch"],[1,"bonespur"],[19,"pyre"],[23,"gravecrush"]], dx: "A furnace with a skull's patience." },
  nihilim:    { n: "Nihilim",     ty: ["hex","shade"],    b: { hp:72, atk:78, def:66, spd:82 }, cr: 0, ab: "voidcrown",
    learn: [[1,"hexbolt"],[1,"nightfall"],[1,"ruin"],[1,"possess"]], dx: "What waits behind the Veil when the last flame dies." },
};
export const STARTERS = ["wickling", "gravepup", "sorrowmoth"];

// ---------- items ----------
export const ITEMS = {
  salve:    { n: "Salve",          price: 15,  heal: 30,  d: "Restores 30 HP" },
  gsalve:   { n: "Greater Salve",  price: 40,  heal: 70,  d: "Restores 70 HP" },
  incense:  { n: "Incense",        price: 20,  cure: 1,   d: "Cures Blight and Fear" },
  sigil:    { n: "Binding Sigil",  price: 25,  bind: 1,   d: "Binds a wounded wild Dread" },
  gsigil:   { n: "Greater Sigil",  price: 60,  bind: 1.6, d: "A far stronger binding" },
  kindred:  { n: "Kindred Charm",  price: 150, charm: 1,  d: "Held: moves matching its type hit harder" },
  bonering: { n: "Bone Ring",      price: 250, charm: 1,  d: "Held: survives one fatal blow per battle" },
  leechfang:{ n: "Leech Fang",     price: 200, charm: 1,  d: "Held: heals 12% of damage it deals" },
  ironvigil:{ n: "Iron Vigil",     price: 220, charm: 1,  d: "Held: takes 10% less damage" },
  swift:    { n: "Swift Talisman", price: 180, charm: 1,  d: "Held: moves 15% faster" },
  cursedeye:{ n: "Cursed Eye",     price: 260, charm: 1,  d: "Held: vicious strikes far more often" },
};
export const CHARM_IDS = ["kindred", "bonering", "leechfang", "ironvigil", "swift", "cursedeye"];

// ---------- trainers ----------
export const TRAINERS = {
  widow:  { name: "The Grieving Widow", pal: "widow", flag: "widow", reward: 60,
    team: [["shadeling", 6]],
    pre: ["He follows me still. My shadow and his.", "Show me yours is stronger."],
    post: ["Yes... perhaps the dead can be carried gently."] },
  ash:    { name: "Sister Ash of the Guard", pal: "wren", flag: "ash", reward: 180, seal: "Cinder Seal", boss: true,
    team: [["willowisp", 9], ["cindermaw", 11]],
    pre: ["First of the Guard. Keeper of the Cinder Seal.", "I burned my own grove so the King could not have it.", "Show me you are worth a second fire."],
    post: ["The Cinder Seal is yours. The north gate is open.", "Five Guard remain. Each crueler than the last. Go and be cruel first."] },
  paleknight: { name: "The Pale Knight of the Guard", pal: "acolyte", flag: "paleknight", reward: 640, seal: "Pale Seal", boss: true,
    team: [["grimalkin", 26], ["mirelurch", 27], ["paleling", 28]],
    pre: ["(The visor does not lift.)", "(A voice like snow settling:)", "The Pale Seal is beneath this armor.", "Come and take it off me."],
    post: ["(The visor tilts, very slightly. It might be respect.)", "(You receive the Pale Seal. You do not see a face. You are glad.)"] },
  hand:   { name: "The Hand of the King", pal: "king", flag: "hand", reward: 800, seal: "Sovereign Seal", boss: true,
    team: [["hemolich", 29], ["cindermaw", 29], ["ossari", 30], ["duskveil", 31]],
    pre: ["Ah. The vigil-keeper. He has spoken of you at length.", "Fondly, even. He is looking forward to this enormously.", "I am the last courtesy you will be shown.", "Please — after you."],
    post: ["Splendid. Truly. He will be DELIGHTED.", "Take the Sovereign Seal. The Threshold opens for you.", "Do give him my regards. He does so love regards."] },
  wren:   { name: "Mother Wren of the Guard", pal: "wren", flag: "wren", reward: 380, seal: "Blood Seal", boss: true,
    team: [["bloodfly", 18], ["vespire", 19], ["pyrewraith", 20]],
    pre: ["The first seal is fire, child.", "The Vigil Flame did not die. It was SNUFFED.", "Prove your flame won't be."],
    post: ["Take the Ember Seal. The mire will try to drown it.", "The gate is open. Do not forgive the dark just because it is familiar."] },
  bog:    { name: "The Bogwalker", pal: "bog", flag: "bog", reward: 140,
    team: [["bloodfly", 12], ["hexen", 13]],
    pre: ["The mire drinks what it's given.", "It's thirsty tonight."],
    post: ["Hm. Walk where the water is black. It's shallower than it looks."] },
  sol:    { name: "Gravekeeper Sol of the Guard", pal: "sol", flag: "sol", reward: 280, seal: "Marrow Seal", boss: true,
    team: [["marrowmouse", 13], ["gravepup", 14], ["mausohound", 16]],
    pre: ["Second seal. Bone and blood.", "I have buried every Warden before you.", "I keep the shovels sharp. Begin."],
    post: ["The Marrow Seal is yours. I'll dig no grave for you today.", "The Chapel sings. Don't listen too closely."] },
  acolyte:{ name: "The Acolyte", pal: "acolyte", flag: "acolyte", reward: 220,
    team: [["choirling", 21], ["ossari", 21]],
    pre: ["Shh. The choir is rehearsing.", "You are OFF-KEY."],
    post: ["...you may pass. Softly."] },
  choir:  { name: "The Choirmaster of the Guard", pal: "choir", flag: "choir", reward: 500, seal: "Hymn Seal", boss: true,
    team: [["choirling", 22], ["hexen", 23], ["duskveil", 25]],
    pre: ["The third seal is a song.", "Every voice in this chapel died mid-note.", "Finish the hymn for them — or join it."],
    post: ["The Hymn Seal. The final door will open for you now.", "Beyond the Threshold waits the one who snuffed the Flame.", "Sing loudly, Warden. It hates that."] },
  keeper: { name: "The Orchard Keeper", pal: "villager", flag: "keeper", reward: 90,
    team: [["willowisp", 8], ["marrowmouse", 9]],
    pre: ["The trees stopped bearing fruit the night the Flame died.", "Now they bear... other things. Care to see?"],
    post: ["Take what you can from the tall grass. The orchard has plenty to spare."] },
  sister: { name: "The Drowned Sister", pal: "widow", flag: "sister", reward: 260,
    team: [["mirelurch", 20], ["hemolich", 21]],
    pre: ["I walked into the shallows nine years ago.", "The water was kind enough to keep me.", "Will you be as kind?"],
    post: ["...the water says you may stay. High praise, from the water."] },
  burner: { name: "The Charcoal Burner", pal: "villager", flag: "burner", reward: 110,
    team: [["willowisp", 9], ["shadeling", 10]],
    pre: ["The deep woods make good charcoal.", "The charcoal makes good... hm. Where was I."],
    post: ["Ah. Right. Losing. That is where I was."] },
  leechfarmer: { name: "The Leech Farmer", pal: "bog", flag: "leechfarmer", reward: 170,
    team: [["bloodfly", 14], ["vespire", 15]],
    pre: ["Honest work, leeches. They only take what you have.", "Let us see what YOU have."],
    post: ["Plenty, apparently. Off you go."] },
  bonepicker: { name: "The Bone Picker", pal: "widow", flag: "bonepicker", reward: 240,
    team: [["marrowmouse", 18], ["ossari", 19]],
    pre: ["The fields provide. Femurs, mostly.", "Contribute or step around."],
    post: ["Step around, then. Mind the femurs."] },
  reject: { name: "Kingsguard Reject", pal: "acolyte", flag: "reject", reward: 420,
    team: [["cindermaw", 28], ["grimalkin", 28]],
    pre: ["Seven of us tried out for the Guard. Six made it.", "I have OPINIONS about that.", "You will do for practice."],
    post: ["...seventh. Again. Fine. FINE."] },
  mourner: { name: "The Gravemarch Mourner", pal: "widow", flag: "mourner", reward: 230,
    team: [["gravepup", 17], ["marrowmouse", 18]],
    pre: ["Every stone here hums a name.", "Do you know what your stone will say?"],
    post: ["Hm. Perhaps the stones will wait a while for you."] },
  hollowacolyte: { name: "The Hollow Acolyte", pal: "acolyte", flag: "hollowacolyte", reward: 320,
    team: [["cindermaw", 24], ["ossari", 24]],
    pre: ["This passage runs beneath the Threshold.", "The King hears every footstep through the stone.", "He asked me to make yours the last."],
    post: ["...he heard that too. He is not pleased. Go quickly."] },
  king:   { name: "The Hollow King", pal: "king", flag: "king", reward: 666, boss: true, healer: true,
    team: [["ossari", 32], ["hemolich", 32], ["duskveil", 33], ["cindermaw", 33], ["nihilim", 35]],
    pre: ["Ah. The little vigil-keeper.", "I put out your Flame the way you pinch a candle. Politely.", "The Veil was always going to tear. I merely... helped.", "Come. Let us see what your grief has taught you."],
    post: ["...impossible. The dark does not... kneel..."] },
};

// ---------- maps ----------
// legend: # tree/wall  . ground  , path  t tall grass  w water  = fence
//         h building   r roof    d vigil door(heal)    g shop door   X sealed gate
export const MAPS = {
  town: {
    name: "Hollow Vale", theme: "town", enc: null, guard: true,
    grid: [
      "##################,,##################",
      "##...............b,,..........#....###",
      "##..........m.....,,......b.....###..#",
      "##.........m......,,..........########",
      "##...............s,,b.......b.########",
      "##..............bl,,......m...########",
      "##................,,............###.##",
      "##................,,....rrrrr.......##",
      "##......rrrrr.....,,....hhhhh.......##",
      "##.b....hhhhh.....,,....hhdhh......###",
      "##......hhdhh.....,,......,........###",
      "###======.,.......,,......,.........##",
      "##m=ttt.=.,.......,,......,..........#",
      "###=......,.....l.,,.l....,.......,,,,",
      "###======.,...,,,,,,....,,,,,,,,,,,,,,",
      "###...........,,,,,,....,,,,,,,,,,,,,#",
      "###...........,,,,,,,,,,,,........b..#",
      "###.....rrrrrr,,c,,,,,,,,,...........#",
      "###.....rrrrrr.,.......,rrrr.........#",
      "###.....hhhhhh.,.......,hhhhl.......##",
      "###.####hhhdhh.,.......,hhdh..www..###",
      "###.######.,,,,,.......,,,,..wwwww.###",
      "##########....................www..###",
      "#########.....#...............########",
      "###########..###........####.#########",
      "######################################",
    ],
    exits: [{"x":18,"y":0,"to":"oldroad","tx":18,"ty":24},{"x":19,"y":0,"to":"oldroad","tx":19,"ty":24},{"x":37,"y":13,"to":"oldroad","tx":1,"ty":13},{"x":37,"y":14,"to":"oldroad","tx":1,"ty":14}],
    doors: [{"x":10,"y":10,"to":"elder_house","tx":11,"ty":14},{"x":26,"y":9,"to":"town_shop","tx":11,"ty":14},{"x":11,"y":20,"to":"vigil_hall","tx":11,"ty":14},{"x":26,"y":20,"to":"town_home","tx":11,"ty":14}],
    signs: [{"x":17,"y":4,"lines":["HOLLOW VALE — pop. 312","(the 312 is crossed out: 311)","(the 311 is crossed out: 309)"]}],
    npcs: [{"id":"cat","x":22,"y":18,"creature":"grimalkin","name":"The Vale Cat","lines":["...","It regards you with luminous patience.","It knows something. It is not telling."]},{"id":"vill1","x":13,"y":15,"pal":"villager","name":"Frightened Villager","lines":["Three Pale Wardens keep the old seals — woods, mire, chapel.","Beat all three and the Threshold gate will open.","Not that anyone's ever... you know. Come back."]},{"id":"vill2","x":20,"y":12,"pal":"villager","name":"Pale Child","lines":["The tall shadows whisper at night.","They know your name. Isn't that nice?"]}],
    items: [{"x":34,"y":20,"id":"embers","qty":60}],
  },
  woods1: {
    name: "Ashen Woods", theme: "woods", enc: {"rate":0.14,"lv":[4,7],"table":[["shadeling",54],["willowisp",28],["marrowmouse",16],["paleling",2]]},
    grid: [
      "##############,,######################",
      "##.....b######,,#######.......########",
      "#.............,,#....#..b......##.####",
      "##............,,tttt...m..#####.....##",
      "###...........,,ttttt....#######....##",
      "###....#####..,,ttttt.....#####.....##",
      "###....######.,,ttttt..............###",
      "###..#########,,tttt...............###",
      "##....#######.,,..............,,,,,,,,",
      "##......####..,,..............,,,,,,,,",
      "##............,,.............m,,...###",
      "##.m..........,c..............,,...###",
      ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,...b##",
      ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,....##",
      "###...................s.,,..t........#",
      "##............b.........,,ttttt..b...#",
      "##..ttttt...............,,ttttt####..#",
      "###.tttttt.........####.,,ttttt#######",
      "##.ttttttt......########,,.ttt..###.##",
      "##..ttttt.......########,,......##..##",
      "##..ttttt...m....#######,,..........##",
      "##.....m...........#.##.,,......m...##",
      "###......ttttttt........,,......b...##",
      "###...########ttt.......,,..........##",
      "###..#################..,,...##.....##",
      "########################,,############",
    ],
    exits: [{"x":24,"y":25,"to":"ashgrove","tx":24,"ty":1},{"x":25,"y":25,"to":"ashgrove","tx":25,"ty":1},{"x":14,"y":0,"to":"woods2","tx":14,"ty":24},{"x":15,"y":0,"to":"woods2","tx":15,"ty":24},{"x":0,"y":12,"to":"orchard","tx":30,"ty":12},{"x":0,"y":13,"to":"orchard","tx":30,"ty":13},{"x":37,"y":8,"to":"oldroad","tx":12,"ty":2},{"x":37,"y":9,"to":"oldroad","tx":13,"ty":2}],
    signs: [{"x":22,"y":14,"lines":["ASHEN WOODS","The grass watches back."]}],
    npcs: [{"id":"widow","x":10,"y":12,"pal":"widow","name":"The Grieving Widow","trainer":"widow","lines":["..."]}],
    items: [{"x":4,"y":21,"id":"salve","qty":2}],
    amb: [{"k":"crow","x":8,"y":4},{"k":"crow","x":31,"y":18}],
  },
  woods2: {
    name: "Ashen Woods — Deep", theme: "woods", enc: {"rate":0.14,"lv":[5,8],"table":[["shadeling",44],["willowisp",34],["marrowmouse",20],["paleling",2]]}, gateFlag: "wren",
    grid: [
      "####################XX################",
      "#....##...##.....#..,,.........#######",
      "#...................,,......b...######",
      "##....#..#..........,,..............##",
      "##....######....,,,,,,...m.........###",
      "###.#########...,,,,,,.............###",
      "##.m########....,,tttttt.#####.....###",
      "##...########...,,ttttt########.....##",
      "#....#######....,,ttttt#########....##",
      "#......###......,,.t.....#####.#....##",
      "#.....,,,c,,,,,,,,.......######.....##",
      "#....m,,,,,,,,,,,,...................#",
      "#..ttt,,.........m...................#",
      "#mtttt,,..##b##........t.............#",
      "#.tttt,,.#######......ttttt.........##",
      "##tttt,,.#######.....ttttttt........##",
      "##.ttt,,..######.....ttttttt........##",
      "###...,,.....##..............#.##...##",
      "###...,,................m..#######m..#",
      "###.m.,,,,,,,,,,...........#######..##",
      "###...,,,,,,,,,,...........#######.###",
      "###...........,,tttttt..b....###.b..##",
      "###.........tt,,ttttttt............###",
      "###.........bt,,ttttt...............##",
      "####..........,,.....##..##.......##.#",
      "##############,,######################",
    ],
    exits: [{"x":14,"y":25,"to":"woods1","tx":14,"ty":1},{"x":15,"y":25,"to":"woods1","tx":15,"ty":1},{"x":20,"y":0,"to":"fenmoor","tx":20,"ty":24},{"x":21,"y":0,"to":"fenmoor","tx":21,"ty":24}],
    npcs: [{"id":"burner","x":10,"y":19,"pal":"villager","name":"The Charcoal Burner","trainer":"burner","lines":["..."]},{"id":"wren","x":21,"y":4,"pal":"wren","name":"Mother Wren","trainer":"wren","lines":["..."]}],
    items: [{"x":31,"y":4,"id":"sigil","qty":3}],
    amb: [{"k":"crow","x":6,"y":5},{"k":"crow","x":28,"y":16}],
  },
  mire1: {
    name: "The Weeping Mire", theme: "mire", enc: {"rate":0.15,"lv":[11,15],"table":[["bloodfly",34],["hexen",24],["vespire",24],["marrowmouse",16],["paleling",2]]},
    grid: [
      "######################,,##############",
      "#######........#####..,,#########....#",
      "#..b...........b......,,.##...#....m##",
      "#....wwwwwww.....wwwww,,............##",
      "#...wwwwwwwww....wwwww,,............##",
      "##..wwwwwwwww.....www.,,.........b.###",
      "##...wwwwwww..........,,...........###",
      "###..w.wwww...........,,.........,,,,,",
      "###...........b.......,,.........,,,,,",
      "###.........,,,,,,,,,,,,,,,,,,,,,,,.##",
      "###.........,,,,,,,,,,,,,,,,,,,,,,,###",
      "###tt.......,,....t......wwwwwww....##",
      ",,,,,,,,....,,.ttttt....wwwwwwwww...##",
      ",,,,,,,,....,,tttttt....wwwwwwwwww.###",
      "###...,,..m.,,tttttt....wwwwwwwww...##",
      "###...,,....,c.m.tt.......wwwwwww....#",
      "###...,,,,,,,,,,,,..........w.w.....n#",
      "###...,,,,,,,,,,,,............n......#",
      "###..wwwwwww....,,..........n........#",
      "##...wwwwwwww...,,.n...n.............#",
      "##..wwwwwwwww...,,.........tttttt....#",
      "##...wwwwwwww...,,........nttttttt...#",
      "##....wwwwww....,,.........tttttt...##",
      "#..............m,,...................#",
      "#...............,,...#..###..#.......#",
      "################,,####################",
    ],
    exits: [{"x":16,"y":25,"to":"fenmoor","tx":16,"ty":1},{"x":17,"y":25,"to":"fenmoor","tx":17,"ty":1},{"x":22,"y":0,"to":"mire2","tx":22,"ty":24},{"x":23,"y":0,"to":"mire2","tx":23,"ty":24},{"x":0,"y":12,"to":"hamlet","tx":30,"ty":12},{"x":0,"y":13,"to":"hamlet","tx":30,"ty":13},{"x":37,"y":7,"to":"mire2","tx":1,"ty":18},{"x":37,"y":8,"to":"mire2","tx":1,"ty":19}],
    npcs: [{"id":"bog","x":14,"y":10,"pal":"bog","name":"The Bogwalker","trainer":"bog","lines":["..."]}],
    items: [{"x":17,"y":13,"id":"gsalve","qty":1},{"x":4,"y":16,"id":"embers","qty":150}],
    amb: [{"k":"wisp","x":8,"y":4},{"k":"wisp","x":29,"y":17}],
  },
  mire2: {
    name: "The Weeping Mire — Sunken Yard", theme: "mire", enc: {"rate":0.15,"lv":[12,16],"table":[["bloodfly",30],["hexen",28],["vespire",26],["mirelurch",14],["paleling",2]]}, gateFlag: "sol",
    grid: [
      "############XX########################",
      "#.........##,,..............######..##",
      "#...........,,..............n####....#",
      "##..........,,.............w.ww.....##",
      "###.........,,............wwwwwww...##",
      "###........m,,...........wwwwwwwww...#",
      "###...ww....,,,,,.........wwwwwww....#",
      "###..wwwwww.,,,,,..........wwwww.....#",
      "###..wwwwwww...,,..n.................#",
      "###.wwwwwwwww..,,....................#",
      "###.wwwwwwwww..,,.G..G..G..G..G.....##",
      "###.m.wwwwww...,,...................##",
      "###....www.....,,.G..G..G..G..G......#",
      "###n...........,,...tt.n.............#",
      "###.ttttt......,,tttttttG..G..G......#",
      "##..ttttt......,,ttttttt.............#",
      "#....tttt..m...,,cttttt.G..G..G..G..##",
      "##.............,,..tt...............##",
      ",,,,,,,,,,,,,,,,,,,,,,,,G..G..G..G..##",
      ",,,,,,,,,,,,,,,,,,,,,,,,............##",
      "###.....n.............,,.....w.w....##",
      "###wwww........n......,,...wwwwww....#",
      "###wwwww..............,,..wwwwwwww...#",
      "###wwww......####.....,,...wwwwwww...#",
      "###....###########....,,......####...#",
      "######################,,##############",
    ],
    exits: [{"x":22,"y":25,"to":"mire1","tx":22,"ty":1},{"x":23,"y":25,"to":"mire1","tx":23,"ty":1},{"x":12,"y":0,"to":"vesperrest","tx":12,"ty":24},{"x":13,"y":0,"to":"vesperrest","tx":13,"ty":24},{"x":0,"y":18,"to":"mire1","tx":36,"ty":7},{"x":0,"y":19,"to":"mire1","tx":36,"ty":8}],
    npcs: [{"id":"leechfarmer","x":19,"y":17,"pal":"bog","name":"The Leech Farmer","trainer":"leechfarmer","lines":["..."]},{"id":"sol","x":16,"y":7,"pal":"sol","name":"Gravekeeper Sol","trainer":"sol","lines":["..."]}],
    items: [{"x":33,"y":15,"id":"incense","qty":2}],
    amb: [{"k":"wisp","x":5,"y":20},{"k":"wisp","x":29,"y":8}],
  },
  chapel: {
    name: "The Bone Chapel", theme: "chapel", enc: {"rate":0.15,"lv":[17,21],"table":[["choirling",32],["hexen",22],["ossari",22],["grimalkin",22],["paleling",2]]}, gateFlag: "choir",
    grid: [
      "##############XX######################",
      "####.......#..,,.#.........##..#######",
      "#.#...........,,..............n......#",
      "##..tt........,,..............####...#",
      "##..ttt.n.....,,..........ttt######..#",
      "#..ttttt......,,.m........tttt####..##",
      "##.ttttt......,,..........tttt......##",
      "#....tt.......,,..........m.........##",
      "##..........,,,,,,,,,,,,,,,,,,,,,,,,,,",
      "###.........,,,,,,,,,,,,,,,,,,,,,,,,,,",
      "###.........,,..........n............#",
      "###.G.G.G...,,.......................#",
      "###.........,,..hhhhhhhhh............#",
      "###.G.G.G...,,..h...c...h...........##",
      "###......n..,,..h.G...G.h...........##",
      "###.G.G.G...,,..h.......h...........##",
      "###.........,,..h.G...G.h...........##",
      "###..m##....,,..h.....n.h..........###",
      "###.#####...,,..hhhh..hhh......n....##",
      "###.######..,,..............n.......##",
      "###.#####...,,........s....ttttt...###",
      "##...##.....,,,,,,,,,,,,,,ttttttt..###",
      "##..........,,,,,,,,,,,,,,.tttttt..###",
      "##......................,,.........###",
      "##...######.....##......,,.........###",
      "########################,,############",
    ],
    exits: [{"x":24,"y":25,"to":"vesperrest","tx":24,"ty":1},{"x":25,"y":25,"to":"vesperrest","tx":25,"ty":1},{"x":14,"y":0,"to":"palegate","tx":14,"ty":24},{"x":15,"y":0,"to":"palegate","tx":15,"ty":24},{"x":37,"y":8,"to":"shallows","tx":1,"ty":8},{"x":37,"y":9,"to":"shallows","tx":1,"ty":9}],
    signs: [{"x":22,"y":20,"lines":["THE BONE CHAPEL","Services: eternal. Attendance: mandatory, eventually."]}],
    npcs: [{"id":"acolyte","x":14,"y":19,"pal":"acolyte","name":"The Acolyte","trainer":"acolyte","lines":["..."]},{"id":"choir","x":20,"y":15,"pal":"choir","name":"The Choirmaster","trainer":"choir","lines":["..."]}],
    items: [{"x":9,"y":21,"id":"gsalve","qty":2}],
    amb: [{"k":"mote","x":7,"y":7},{"k":"mote","x":28,"y":15}],
  },
  threshold: {
    name: "The Threshold", theme: "threshold", enc: {"rate":0.13,"lv":[22,25],"table":[["ossari",28],["choirling",18],["hexen",16],["cindermaw",22],["grimalkin",14],["paleling",2]]}, gateFlag: "king",
    grid: [
      "##################XX##################",
      "#.##########......,,..........#.....##",
      "#..#..............,,n................#",
      "##................,,.................#",
      "##.............b..,,..b..............#",
      "##...#.##.........,,....m.tt.........#",
      "##..#####.........,,....ttttttt....m.#",
      "##.######......b..,,..b.ttttttt.....##",
      "#...#####..n....n.,,....ttttttt......#",
      "#....###..........,,......t.t.......##",
      "#..............b..,,..b.............##",
      "#..............c..,,................##",
      "#...........,,,,,,,,,,,,,,,,,,,,,,,..#",
      "#....n.....m,,,,,,,,,,,,,,,,,,,,,,,,,,",
      "#...........,,s..................,,,,,",
      "#......ttt..,,.......................#",
      "#.....tttttt,,.......................#",
      "##...ttttttt,,...........nn....##...##",
      "#m....tttttt,,...............######.##",
      "#.......ttt.,,...............#########",
      "#...G.G.G...,,..ttttt........#####.###",
      "#...........,,.ttttttt.........#...###",
      "#...G.G.G...,,..ttttt...............##",
      "##....######,,...##.####.....######.##",
      "############,,########################",
      "############,,########################",
    ],
    exits: [{"x":12,"y":25,"to":"lastlantern","tx":12,"ty":1},{"x":13,"y":25,"to":"lastlantern","tx":13,"ty":1},{"x":18,"y":0,"to":"court","tx":18,"ty":24},{"x":19,"y":0,"to":"court","tx":19,"ty":24},{"x":37,"y":13,"to":"underveil","tx":1,"ty":13},{"x":37,"y":14,"to":"underveil","tx":1,"ty":14}],
    signs: [{"x":14,"y":14,"lines":["THE THRESHOLD","TURN BACK","(carved beneath, smaller): please"]}],
    npcs: [{"id":"king","x":18,"y":4,"pal":"king","name":"The Hollow King","trainer":"king","lines":["..."]}],
    items: [{"x":6,"y":21,"id":"gsigil","qty":3}],
    amb: [{"k":"mote","x":7,"y":15},{"k":"mote","x":28,"y":5}],
  },
  orchard: {
    name: "Withered Orchard", theme: "woods", enc: {"rate":0.15,"lv":[5,9],"table":[["willowisp",40],["marrowmouse",30],["shadeling",28],["paleling",2]]},
    grid: [
      "################################",
      "#.....##########################",
      "#.......############..######...#",
      "#.......b.....tttt.........b...#",
      "#..............t..............##",
      "##...#..#..#..#..#..#..#..#....#",
      "##......b..b.....b..bm.b.......#",
      "##......ttt....................#",
      "##.....ttttt..................##",
      "#....#..#tt#.b#..#..#..#..#b..##",
      "#....b...........m..b..b..b...##",
      "##.....,,,,,,,,,,,,...........##",
      "##.....,,,,,,,,,,,,,,,,,,,,,,,,,",
      "#....#.,,..#..#..,,,,,,,,,,,,,,,",
      "#......,,..b........ttttt.b....#",
      "#..b...,,...........tttt....m..#",
      "##....c,,......................#",
      "##...#..#..#..#..#..#..#..#...##",
      "##.........b.....b..b.....b...##",
      "##.................##.........##",
      "####...######....##########.m.##",
      "################################",
    ],
    exits: [{"x":31,"y":12,"to":"woods1","tx":1,"ty":12},{"x":31,"y":13,"to":"woods1","tx":1,"ty":13}],
    npcs: [{"id":"keeper","x":9,"y":12,"pal":"villager","name":"The Orchard Keeper","trainer":"keeper","lines":["..."]}],
    items: [{"x":5,"y":18,"id":"gsalve","qty":1},{"x":27,"y":4,"id":"embers","qty":120}],
    amb: [{"k":"crow","x":10,"y":3},{"k":"crow","x":24,"y":16}],
  },
  shallows: {
    name: "The Drowned Shallows", theme: "mire", enc: {"rate":0.15,"lv":[18,22],"table":[["vespire",30],["mirelurch",28],["hexen",20],["grimalkin",20],["paleling",2]]},
    grid: [
      "##################################",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwn....ww#",
      "#wwwwwwwwwwwwwwwwwwwwwwww.......w#",
      "#ww.c..ww.ttt.wwwwwwwwwww......bw#",
      ",,,,,,.w.tttt..wwwwwwwwww.,,....w#",
      ",,,,,,,,,,,,,...wwwwwwwwww,,..www#",
      "#...,,,,,,,,,..wwwwwwwwwww,,wwwww#",
      "#ww....w...,,wwwwwtttt..ww,,wwwww#",
      "#wwwwwwwwww,,,,,,,,,,tt.bw,,wwwww#",
      "#wwwwwwwwww,,,,,,,,,,tt..w,,wwwww#",
      "#wwwwwwwwwwwwwww..n,,,,,,,,,wwwww#",
      "#wwwwwwwwwwwwwwwwn.,,,,,,,,,wwwww#",
      "#wwwwwwwwwwwwwwwwwww.bwwww,..wwww#",
      "#wwwwwwwwwwwwwwwwwwwwwww..,n...ww#",
      "#wwwwwwwwwwwwwwwwwwwwwww..,,,,.ww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwn.....ww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwww...wwww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "##################################",
    ],
    exits: [{"x":0,"y":8,"to":"chapel","tx":36,"ty":8},{"x":0,"y":9,"to":"chapel","tx":36,"ty":9}],
    npcs: [{"id":"sister","x":28,"y":7,"pal":"widow","name":"The Drowned Sister","trainer":"sister","lines":["..."]}],
    items: [{"x":21,"y":15,"id":"leechfang","qty":1},{"x":29,"y":19,"id":"embers","qty":250}],
    amb: [{"k":"wisp","x":7,"y":5},{"k":"wisp","x":24,"y":19},{"k":"wisp","x":15,"y":15}],
  },
  oldroad: {
    name: "The Old Road", theme: "town", enc: {"rate":0.13,"lv":[3,6],"table":[["shadeling",50],["willowisp",24],["marrowmouse",24],["paleling",2]]},
    grid: [
      "############,,########################",
      "#......#####,,######......#.......####",
      "#.........##,,................m......#",
      "#........b..,,.......................#",
      "##....####..,,.............t........##",
      "###..#######,,..........tttttt.....b.#",
      "###..#######,,.......m..ttttttt......#",
      "###..#######,,..........tttttt......##",
      "###...####..,,c,,,,,,,,,..tt........##",
      "##.n.....n..,,,,,,,,,,,,.....b......##",
      "###...................,,............##",
      "###............n......,,............##",
      "###...................,,..rrrr......##",
      ",,,,,,,,,,,,.b........,,..hhhh......##",
      ",,,,,,,,,,,,..........,,..hhhh.......#",
      "#.mttttt..,,..===.===.,,.............#",
      "##.ttttt..,,..=======.,,.....##.#....#",
      "##.ttttt..,,..........,l....######...#",
      "##.ttttt..,,,,,,,,,,,,,,..b#######...#",
      "##..ttt...,,,,,,,,,,,,,,..n.######...#",
      "###.G.G.G.....tttt,,s.......###.....##",
      "###............ttt,,................##",
      "###.G.G.G.........,,..........n....###",
      "###...b...........,,..........########",
      "###.##...#........,,######...#########",
      "##################,,##################",
    ],
    exits: [{"x":18,"y":25,"to":"town","tx":18,"ty":1},{"x":19,"y":25,"to":"town","tx":19,"ty":1},{"x":12,"y":0,"to":"ashgrove","tx":12,"ty":24},{"x":13,"y":0,"to":"ashgrove","tx":13,"ty":24},{"x":0,"y":13,"to":"town","tx":36,"ty":13},{"x":0,"y":14,"to":"town","tx":36,"ty":14}],
    signs: [{"x":20,"y":20,"lines":["THE OLD ROAD","Travel in pairs. Or not at all."]}],
    npcs: [{"id":"peddler","x":21,"y":12,"pal":"villager","name":"The Wandering Peddler","lines":["Charms, friend. The shop in the Vale sells charms now — rings, fangs, talismans.","A Dread holding the right charm fights like two Dreads.","I'd sell you one myself, but something ate my cart."]}],
    items: [{"x":6,"y":21,"id":"salve","qty":2},{"x":28,"y":5,"id":"sigil","qty":2}],
    amb: [{"k":"crow","x":6,"y":19}],
  },
  hamlet: {
    name: "Emberfall Hamlet", theme: "town", enc: null,
    grid: [
      "##################,,############",
      "#.################,,######.#####",
      "#..###########...#,,###.......##",
      "#.................,,....b..#####",
      "#.................,,......######",
      "##................,,.......###.#",
      "#.....rrrr..rrrr..,,....rrrr..##",
      "#.n...hhhh..hhhh..,,b...hhhh..##",
      "#....nhhdh..hhgh,,,,....hhdh..##",
      "#.......,.....,,,,,c......,...##",
      "#.......,.......,,..l.....,..###",
      "##......,l....l.,,........,..###",
      "#.......,.......,,,,,,,,,,,,,,,,",
      "#.......,,,,,,,,,,,,,,,,,,,,,,,,",
      "#.................s...........##",
      "#.....#......................###",
      "#..#####...............n.....###",
      "##.#####..........b.b........###",
      "########......................##",
      "###..#.......#.##b.####.......##",
      "###......#..################..##",
      "################################",
    ],
    exits: [{"x":31,"y":12,"to":"mire1","tx":1,"ty":12},{"x":31,"y":13,"to":"mire1","tx":1,"ty":13},{"x":18,"y":0,"to":"gravemarch","tx":18,"ty":22},{"x":19,"y":0,"to":"gravemarch","tx":19,"ty":22}],
    doors: [{"x":8,"y":8,"to":"hamlet_home1","tx":11,"ty":14},{"x":26,"y":8,"to":"hamlet_home2","tx":11,"ty":14}],
    signs: [{"x":18,"y":14,"lines":["EMBERFALL HAMLET","Lamps out since the Falling. We light them anyway."]}],
    npcs: [{"id":"hamlet_elder","x":13,"y":13,"pal":"elder","name":"Hamlet Elder","lines":["Emberfall, we're called. We lit our lamps from the Vigil Flame itself, once.","The night it died, every lamp in the hamlet went out at the same breath.","Old Marn saw something that night. Ask him. First house, west side."]},{"id":"muddy_kid","x":20,"y":11,"pal":"villager","name":"Muddy Child","lines":["The graves north of here hum when you put your ear on them.","Mama says don't. So obviously I did.","They hum a NAME."]}],
    items: [{"x":27,"y":17,"id":"embers","qty":90}],
  },
  gravemarch: {
    name: "Gravemarch Fields", theme: "woods", enc: {"rate":0.15,"lv":[10,14],"table":[["marrowmouse",38],["gravepup",22],["shadeling",20],["hexen",18],["paleling",2]]},
    grid: [
      "##################################",
      "#...################.........n..##",
      "#................#..............##",
      "##.....................n.......###",
      "##..tttt.c...G..G..G..G..G..G..###",
      "##..tttttm,,...................###",
      "##..ttttt.,,.G..G..G..G..G..t..###",
      "###.......,,............tttttt.###",
      "###.......,,.G..G..G..G..tttttt.##",
      "###.......,,.............ttttt..##",
      "###.......,,....................n#",
      "###.....n.,,n..m........n.......##",
      "###.......,,,,,,,,,,............##",
      "###m......,,,,,,,,,,.G.G.G.G.G.###",
      "###.G..G..G..G....,,...........###",
      "###...............,,...........###",
      "###.G..G..G..G....,,.GnG.G.G.G.G##",
      "###...............,,............##",
      "###......tttttt...,,............##",
      "###......ttttttt..,,.......#####.#",
      "###......tttttt...,,.......#####.#",
      "###...............,,.n......###..#",
      "####....##........,,#######......#",
      "##################,,##############",
    ],
    exits: [{"x":18,"y":23,"to":"hamlet","tx":18,"ty":1},{"x":19,"y":23,"to":"hamlet","tx":19,"ty":1}],
    npcs: [{"id":"bonepicker","x":12,"y":6,"pal":"widow","name":"The Bone Picker","trainer":"bonepicker","lines":["..."]},{"id":"mourner","x":24,"y":12,"pal":"widow","name":"The Gravemarch Mourner","trainer":"mourner","lines":["..."]},{"id":"dozer","x":12,"y":4,"creature":"gravepup","name":"Dozing Gravepup","lines":["It sleeps atop an old grave, tail thumping.","It is dreaming of someone.","The someone under the stone."]}],
    items: [{"x":5,"y":19,"id":"gsigil","qty":2},{"x":30,"y":5,"id":"embers","qty":200}],
    amb: [{"k":"crow","x":8,"y":3},{"k":"crow","x":22,"y":18}],
  },
  underveil: {
    name: "Underveil Passage", theme: "cave", enc: {"rate":0.15,"lv":[23,26],"table":[["cindermaw",30],["ossari",26],["grimalkin",22],["hexen",20],["paleling",2]]},
    grid: [
      "################,,################",
      "################,,################",
      "################,,################",
      "################,,################",
      "###############.,,...#############",
      "####.....####...,,...#############",
      "##m...,,,,,,,,,,,,,,,,,,,,,,######",
      "##....,,,,,,,,,,,,....#####,######",
      "###..n,,..m###......#####tt,..####",
      "####.m,,.##############.ttt,..m###",
      "######,,###############....,....##",
      "######,,##....m..........m.,...###",
      "######,,,,.m....n...n.,,,,,,...###",
      ",,,,,,,,,,..n.........,m##...#####",
      ",,,,,,,,,,.m##########,###########",
      "#####...,,ctt#########,###########",
      "####....,,tt#######.m#,###########",
      "####....,,.tt###......,.##########",
      "######..,,.#####......,...########",
      "########,,,,,,,,,,,,,,,...########",
      "########,,,,,,,,,,,,,,...#########",
      "################....,,..##########",
      "####################,,############",
      "####################,,############",
    ],
    exits: [{"x":20,"y":23,"to":"palegate","tx":20,"ty":1},{"x":21,"y":23,"to":"palegate","tx":21,"ty":1},{"x":16,"y":0,"to":"lastlantern","tx":16,"ty":24},{"x":17,"y":0,"to":"lastlantern","tx":17,"ty":24},{"x":0,"y":13,"to":"threshold","tx":36,"ty":13},{"x":0,"y":14,"to":"threshold","tx":36,"ty":14}],
    npcs: [{"id":"reject","x":19,"y":18,"pal":"acolyte","name":"Kingsguard Reject","trainer":"reject","lines":["..."]},{"id":"hollowacolyte","x":27,"y":9,"pal":"acolyte","name":"The Hollow Acolyte","trainer":"hollowacolyte","lines":["..."]}],
    items: [{"x":11,"y":16,"id":"ironvigil","qty":1},{"x":28,"y":11,"id":"gsalve","qty":2}],
    amb: [{"k":"bat","x":10,"y":6},{"k":"bat","x":24,"y":14}],
  },
  behindveil: {
    name: "Behind the Veil", theme: "veil", enc: {"rate":0.16,"lv":[26,30],"table":[["paleling",10],["grimalkin",20],["hemolich",15],["duskveil",10],["cindermaw",15],["ossari",15],["hexen",15]]},
    grid: [
      "##################################",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#",
      "#wwwww....wwwwwwwwwwwwwww..Gwwwww#",
      "#www.......wwwwwwwwwwwww......www#",
      "#wwwG......wwwwwwwwwwww..,,.G.www#",
      "#www....,,,,,,,,,,t.wwww.,,...www#",
      "#wwwwwm.,,,,,,,,,,tt.wwww,,..wwww#",
      "#wwwwwww,,www..t,,tt.mwww,,wwwwww#",
      "#wwwwwww,,wwww..,,,,,,,,,,,,wwwww#",
      "#wwwwwww,,wwwwwm,,,,,,,,,,,,wwwww#",
      "#wwwwwww,,wwwwwwwwwwwwwwwww,wwwww#",
      "#wwwwwww,,wwwwwwwwwwwwwwwww,wwwww#",
      "#wwwwww.,,.wwwwwwwwwwwwww.t,t.www#",
      "#wwwww..,c...wwwwwwwwwww.tt,tt.ww#",
      "#wwwww..,,,,.mwwwwwwwwww..t,tt.ww#",
      "#wwww...,,,,.wwwwwwwwwwww......ww#",
      "#wwwwwwm..,,www.....w.www....wwww#",
      "#wwwwwwwww,,ww.m.......wwwwwwwwww#",
      "#wwwwwwwww,,,,,,,,,,...wwwwwwwwww#",
      "#wwwwwwwww,,,,,,,,,,...wwwwwwwwww#",
      "#wwwwwwwwwwwwww...,,..wwwwwwwwwww#",
      "##################,,##############",
    ],
    exits: [{"x":18,"y":23,"to":"court","tx":18,"ty":1},{"x":19,"y":23,"to":"court","tx":19,"ty":1}],
    npcs: [{"id":"firstwarden","x":26,"y":5,"pal":"choir","name":"The First Warden","lines":["You can see me. Good. Then the Flame truly chose you.","I kept the first Vigil, four hundred years ago. And I am the one who failed it.","The Hollow King... wore my face, once. I opened the gate from the inside — just a crack. Just to see.","The dark does not break in, Warden. It is INVITED. Remember that, when you light the lamps.","The Dreads that drift here are the oldest and the strangest. Bind what you can.","And the pale ones — they gather thick on this side. They were people, once. Be gentle."]}],
    items: [{"x":6,"y":5,"id":"cursedeye","qty":1},{"x":29,"y":16,"id":"embers","qty":666}],
    amb: [{"k":"mote","x":8,"y":8},{"k":"mote","x":20,"y":14},{"k":"wisp","x":16,"y":6}],
  },
  elder_house: {
    name: "Elder Maren's House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#KKKK..........KKKKKKK.#",
      "#......................#",
      "#..TT..........BB......#",
      "#..TT..........BB......#",
      "#......................#",
      "#.........uu...........#",
      "#.........uu...........#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"town", tx:10, ty:11 }, { x:12, y:15, to:"town", tx:10, ty:11 } ],
    npcs: [ { id:"elder", x:13, y:6, pal:"elder", name:"Elder Maren", starter: true,
        lines: ["The Vigil Flame is out, child. For the first time in 400 years.",
                "The Veil thins. The Dreads grow bold. And our Wardens... are gone.",
                "You are young. But the Flame chose your family once before.",
                "Take a companion. Bind it well. And bring me back a dawn."] } ],
  },
  town_shop: {
    name: "The Ember Exchange", theme: "interior", enc: null,
    grid: [
      "########################",
      "#KKKKKK........KKKKKKK.#",
      "#......................#",
      "#..CCCCCCCC............#",
      "#......................#",
      "#..............TT......#",
      "#..............TT......#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"town", tx:26, ty:10 }, { x:12, y:15, to:"town", tx:26, ty:10 } ],
    npcs: [
      { id:"shopmouse", x:18, y:5, creature:"marrowmouse", name:"Shop Mouse",
        lines: ["It is organizing crumbs by size.", "The merchant pretends not to see it."] },
      { id:"shopkeep", x:5, y:2, pal:"villager", name:"The Ember Merchant", shopkeeper: true,
        lines: ["Welcome, welcome. Everything's cheap — nobody expects to need change.",
                "New stock of charms in from the Old Road peddler. Before his cart was, ah. Eaten."] } ],
  },
  vigil_hall: {
    name: "The Vigil Hall", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..........c...........#",
      "#......................#",
      "#..TT....TT....TT......#",
      "#......................#",
      "#..TT....TT....TT......#",
      "#......................#",
      "#..TT....TT....TT......#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"town", tx:11, ty:21 }, { x:12, y:15, to:"town", tx:11, ty:21 } ],
    npcs: [ { id:"keeper1", x:13, y:2, pal:"acolyte", name:"Vigil Keeper", healer: true,
        lines: ["Rest, Warden. Your Dreads are tended — the little flame we've kept asks nothing in return.",
                "The great Flame stood where the altar candle burns. Four hundred years, and it never once flickered.",
                "Until it did."] } ],
  },
  town_home: {
    name: "A Quiet House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..BB..........KKKK....#",
      "#..BB..................#",
      "#......................#",
      "#......TT..............#",
      "#......TT..............#",
      "#......................#",
      "#.........uu...........#",
      "#.........uu...........#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"town", tx:26, ty:21 }, { x:12, y:15, to:"town", tx:26, ty:21 } ],
    npcs: [ { id:"mother", x:13, y:5, pal:"villager", name:"Tired Mother",
        lines: ["My boy went to the Bone Chapel two winters ago. To sing, he said.",
                "The Choirmaster keeps them. Keeps their voices, anyway.",
                "If you pass through... don't hurt him. He's the one standing guard by the pews.",
                "He always did stand too straight."] } ],
  },
  hamlet_home1: {
    name: "Old Marn's House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..KKKK........BB......#",
      "#..............BB......#",
      "#......................#",
      "#....TT................#",
      "#....TT................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"hamlet", tx:8, ty:9 }, { x:12, y:15, to:"hamlet", tx:8, ty:9 } ],
    npcs: [ { id:"lamplighter", x:13, y:4, pal:"elder", name:"Old Marn, Lamplighter",
        lines: ["I was on the ridge the night the Flame died. Lighting the high lamps.",
                "It didn't gutter. It didn't fade. Something LEANED over it.",
                "A shadow with a crown, tall as the chapel spire. It pinched the Flame out like a candle. Politely.",
                "Then it looked at me. And it BOWED.",
                "I haven't lit a lamp since. Forgive me."] } ],
  },
  hamlet_home2: {
    name: "The Sister's House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..BB..........KKKK....#",
      "#..BB..................#",
      "#......................#",
      "#..........TT..........#",
      "#..........TT..........#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"hamlet", tx:26, ty:9 }, { x:12, y:15, to:"hamlet", tx:26, ty:9 } ],
    npcs: [ { id:"kin", x:13, y:6, pal:"villager", name:"The Sister's Kin",
        lines: ["My sister walked into the Drowned Shallows nine years ago and never walked out.",
                "Except she did. She stands in the water east of the Chapel, and she is not cold, and she is not sad.",
                "If you meet her... tell her the roof stopped leaking. She always worried about the roof.",
                "And Warden — the drowned whisper of a white shadow that walks all the grasses. One in a hundred, they say.",
                "The pale ones were people once. Bind one gently, if you can."] } ],
  },

  ashgrove: {
    name: "Ashgrove", theme: "ashgrove", enc: null, gateFlag: "ash",
    grid: [
      "########################XX############",
      "#.........##############,,..##########",
      "#..............######.##,,...####.##.#",
      "#......#................,,......b..b.#",
      "#...#####...............,,...........#",
      "##.#######..............,,..b........#",
      "##..#####......rrrrrr...,,..b...b.b..#",
      "##...#.........rrrrrr...,,...........#",
      "##.............hhhhhh...,,.rrrr......#",
      "###............hhhdhh...,,.hhhh......#",
      "###...............,.....,,.hhdh......#",
      "##................,.....,,...,......##",
      "#.....c.......l...,...l.,,...,.......#",
      "#...........,,,,,,,,,,,,,,,,,,,,....##",
      "##..........,,,,,,,,,,,,,,,,,,,,...###",
      "##.......b..,,.....................###",
      "##........b.,,s.....................##",
      "##.......b..,,.......................#",
      "##...b=.=b=.,,.......................#",
      "###..=....=b,,.......................#",
      "###..b.GG.=.,,..................####.#",
      "###.b=b==b=.,,................######.#",
      "###...b....b,,.................#######",
      "###..bb.....,,###......#............##",
      "##.#.......#,,############...#.#######",
      "############,,########################",
    ],
    exits: [{"x":12,"y":25,"to":"oldroad","tx":12,"ty":1},{"x":13,"y":25,"to":"oldroad","tx":13,"ty":1},{"x":24,"y":0,"to":"woods1","tx":24,"ty":24},{"x":25,"y":0,"to":"woods1","tx":25,"ty":24}],
    doors: [{"x":18,"y":9,"to":"ash_hall","tx":11,"ty":14},{"x":29,"y":10,"to":"ash_home","tx":11,"ty":14}],
    signs: [{"x":14,"y":16,"lines":["ASHGROVE","First town of the north road.","The Guard watches. The Guard burns."]}],
    npcs: [{"id":"ag1","x":9,"y":13,"pal":"villager","name":"Charred Farmer","lines":["The grove burned the night the King took the road.","Sister Ash lit the fire herself. To deny him the timber, she says.","She holds the Cinder Seal in the great hall. She will not hand it over kindly."]},{"id":"ag2","x":22,"y":15,"pal":"villager","name":"Ashgrove Child","lines":["Sister Ash never blinks.","I counted. A whole hour. Zero blinks."]}],
  },
  ash_hall: {
    name: "Guard Hall", theme: "interior", enc: null,
    grid: [
      "########################",
      "#......................#",
      "#......................#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"ashgrove", tx:18, ty:10 }, { x:12, y:15, to:"ashgrove", tx:18, ty:10 } ],
    npcs: [ { id:"ash", x:11, y:2, pal:"wren", name:"Sister Ash", trainer:"ash", lines: ["..."] } ],
  },
  ash_home: {
    name: "A Quiet House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..BB..........KKKK....#",
      "#..BB..................#",
      "#......................#",
      "#......TT..............#",
      "#......TT..............#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"ashgrove", tx:29, ty:11 }, { x:12, y:15, to:"ashgrove", tx:29, ty:11 } ],
    npcs: [ { id:"agh", x:13, y:5, pal:"elder", name:"Grove Widow",
        lines: ["Six Guard between here and the Hollow Court. Each holds a Seal.", "Ash, Sol, Wren, the Choirmaster, the Pale Knight... and the Hand.", "The Hand is the worst. The Hand is POLITE."] } ],
  },
  fenmoor: {
    name: "Fenmoor", theme: "fenmoor", enc: null, gateFlag: "sol",
    grid: [
      "################XX####################",
      "################,,#########......#.###",
      "#.......####..#.,,###.####..........##",
      "#...............,,.........wwwwww..###",
      "#........rrrrrr.,,.......b.wwwwwwww###",
      "#......wwrrrrrr.,,....n....wwwwwww.###",
      "#..wwwwwwhhhhhh.,,......rrrrwwwwww..##",
      "##..wwwwwhhhdhh.,,......hhhhwwww.w.###",
      "##..wwwwwwww,,,,,,......hhdh........##",
      "###.wwwwwwww....,,b..l....,...n....###",
      "###..wwwww.....b,,....,,,,,........###",
      "###...w.w.......,,....,,,,,........###",
      "###.............,,.......,,........###",
      "###...........l.,,..c....,,........###",
      "###...b.........,,,,,,...,,rrrr....###",
      "##..............,,,s,,...,,hhhhn...###",
      "###.............,,..,,...,,hhgh.n..###",
      "##..............,,,,,,,,,,,,,,.....###",
      "##...wwwwww.....,,,,,,,,,,,...wwww.###",
      "##.wwwwwwww.........,,......wwwwwww###",
      "##..wwwwwwww......tt,,t.....wwwwwww###",
      "##.wwwwwwwww......tt,,tt....wwwwwww.##",
      "##..wwwwwww........t,,t......wwwww.###",
      "##...............#.#,,#####.....##.###",
      "##......#..#########,,######...#######",
      "####################,,################",
    ],
    exits: [{"x":20,"y":25,"to":"woods2","tx":20,"ty":1},{"x":21,"y":25,"to":"woods2","tx":21,"ty":1},{"x":16,"y":0,"to":"mire1","tx":16,"ty":24},{"x":17,"y":0,"to":"mire1","tx":17,"ty":24}],
    doors: [{"x":12,"y":7,"to":"fen_hall","tx":11,"ty":14},{"x":26,"y":8,"to":"fen_home","tx":11,"ty":14}],
    signs: [{"x":19,"y":15,"lines":["FENMOOR","Stilt-town at the mire edge.","Do not feed the water."]}],
    npcs: [{"id":"fm1","x":18,"y":16,"pal":"bog","name":"Stilt Carpenter","lines":["Gravekeeper Sol keeps Fenmoor now. Buried half the town, dug up the other half.","He says the King promised the dead would keep. Sol checks. Nightly."]},{"id":"fm2","x":22,"y":12,"pal":"villager","name":"Fenmoor Girl","lines":["The mire past the north gate drinks whatever it is given.","It is thirsty. It is ALWAYS thirsty."]}],
  },
  fen_hall: {
    name: "Guard Hall", theme: "interior", enc: null,
    grid: [
      "########################",
      "#......................#",
      "#......................#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"fenmoor", tx:12, ty:8 }, { x:12, y:15, to:"fenmoor", tx:12, ty:8 } ],
    npcs: [ { id:"sol", x:11, y:2, pal:"sol", name:"Gravekeeper Sol", trainer:"sol", lines: ["..."] } ],
  },
  fen_home: {
    name: "A Quiet House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..BB..........KKKK....#",
      "#..BB..................#",
      "#......................#",
      "#......TT..............#",
      "#......TT..............#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"fenmoor", tx:26, ty:9 }, { x:12, y:15, to:"fenmoor", tx:26, ty:9 } ],
    npcs: [ { id:"fmh", x:13, y:5, pal:"villager", name:"Sleepless Fisher",
        lines: ["I fish the black pools. Lately the fish fish back.", "Take a Vespire if you can bind one. Blood answers bone, out here."] } ],
  },
  vesperrest: {
    name: "Vesper Rest", theme: "vesper", enc: null, gateFlag: "choir",
    grid: [
      "########################XX############",
      "#....########.....#....#,,##..####..##",
      "##.......##.............,,#..........#",
      "#....##.................,,...........#",
      "#..#####................,,...........#",
      "#..#####........rrrrrr..,,...........#",
      "#..#####........rrrrrr..,,...........#",
      "#....#..........hhhhhh..,,...........#",
      "#.....rrrr......hhhdhh..,,.rrrr......#",
      "#.....hhhh.........,....,,.hhhh.....##",
      "#.....hhgh.........,....,,.hhdh......#",
      "#.......,.....l....,...l,,...,.......#",
      "#.......,,,,,,,,,,,,,,,,,,,,,,,,....##",
      "#...........,,,,,,,,,,,,,,,,,,,,...###",
      "#.........s.,,.....c...............###",
      "#...........,,.....................###",
      "##..........,,.......b.............###",
      "###.........,,.....................###",
      "###.........,,.....................###",
      "###.wwwww...,,...........===.===....##",
      "###.wwwww...,,...........=bG.G.#######",
      "###.wwww....,,......b....=.G.G.#######",
      "##....b.....,,...........======#######",
      "##..........,,#.###.........#......b##",
      "####.....#..,,############.####..##.##",
      "############,,########################",
    ],
    exits: [{"x":12,"y":25,"to":"mire2","tx":12,"ty":1},{"x":13,"y":25,"to":"mire2","tx":13,"ty":1},{"x":24,"y":0,"to":"chapel","tx":24,"ty":24},{"x":25,"y":0,"to":"chapel","tx":25,"ty":24}],
    doors: [{"x":19,"y":8,"to":"vesper_hall","tx":11,"ty":14},{"x":29,"y":10,"to":"vesper_home","tx":11,"ty":14}],
    signs: [{"x":10,"y":14,"lines":["VESPER REST","The bells ring themselves.","Attendance is noted."]}],
    npcs: [{"id":"vr1","x":13,"y":14,"pal":"acolyte","name":"Deaf Bellringer","lines":["I rang the vespers forty years. Then the Choirmaster came and the bells learned to ring alone.","He holds the Hymn Seal in the hall. He will want you to sing for it.","You will not like the song."]},{"id":"vr2","x":26,"y":14,"pal":"villager","name":"Humming Child","lines":["Hmm hmm hmmm... hm hm...","(You do not recognize the tune. Your Dreads do. They are very still.)"]}],
  },
  vesper_hall: {
    name: "Guard Hall", theme: "interior", enc: null,
    grid: [
      "########################",
      "#......................#",
      "#......................#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"vesperrest", tx:19, ty:9 }, { x:12, y:15, to:"vesperrest", tx:19, ty:9 } ],
    npcs: [ { id:"choir", x:11, y:2, pal:"choir", name:"The Choirmaster", trainer:"choir", lines: ["..."] } ],
  },
  vesper_home: {
    name: "A Quiet House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..BB..........KKKK....#",
      "#..BB..................#",
      "#......................#",
      "#......TT..............#",
      "#......TT..............#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"vesperrest", tx:29, ty:11 }, { x:12, y:15, to:"vesperrest", tx:29, ty:11 } ],
    npcs: [ { id:"vrh", x:13, y:5, pal:"villager", name:"Retired Chorister",
        lines: ["I sang for him once. He keeps the voices that please him.", "Mine did not. I count that as the luck of my life."] } ],
  },
  palegate: {
    name: "Palegate", theme: "palegate", enc: null, gateFlag: "paleknight",
    grid: [
      "####################XX################",
      "####################,,##.#....########",
      "#.#######.n####.....,,.........#######",
      "#...................,,..............##",
      "##n.................,,..............##",
      "##..r.....r.....r...,,r.....r.......##",
      "#hhhhhhhhhhhhhhhhhhh,,hhhhhhhhhhhhhhh#",
      "#hhhhhhhhhhhhhhhhhhh,,hhhhhhhhhhhhhhh#",
      "##..................,,rrrr.........###",
      "##......rrrrrr....b.,,hhhh.........###",
      "##......rrrrrr......,,hhgh.rrrr....###",
      "###.....hhhhhh......,,..,..hhhh....###",
      "###.....hhhdhh..b.b.,,..,..hhdh....###",
      "##.........,....l...,,.l,....,......##",
      "#..........,,,,,,,,,,,,,,,,,,,,,....##",
      "#.............,,,,,,,,,,,,,,,,,,....##",
      "#...........s.,,n....................#",
      "##..===.===...,,..c.................##",
      "#...=.ttt.=...,,...........b........##",
      "#...=.ttt.=...,,.................##.##",
      "#...=.ttt.=...,,...............#######",
      "#...=======...,,...............#######",
      "##............,,...............#######",
      "###....b..#.##,,######.#########...###",
      "###....#######,,######################",
      "##############,,######################",
    ],
    exits: [{"x":14,"y":25,"to":"chapel","tx":14,"ty":1},{"x":15,"y":25,"to":"chapel","tx":15,"ty":1},{"x":20,"y":0,"to":"underveil","tx":20,"ty":22},{"x":21,"y":0,"to":"underveil","tx":21,"ty":22}],
    doors: [{"x":11,"y":12,"to":"pale_hall","tx":11,"ty":14},{"x":29,"y":12,"to":"pale_home","tx":11,"ty":14}],
    signs: [{"x":12,"y":16,"lines":["PALEGATE","The chalk gate of the high country.","The Knight does not lift the visor."]}],
    npcs: [{"id":"pg1","x":16,"y":15,"pal":"villager","name":"Chalk Miner","lines":["The Pale Knight took the gate without a single battle. Folk just... stepped aside.","Nobody has seen the face. There are wagers. There are theories.","My theory: there is no face."]},{"id":"pg2","x":26,"y":15,"pal":"widow","name":"Palegate Seamstress","lines":["I mended the cloak of the Knight once. The cold coming off it put frost on my needle.","Paid in old coins, though. Older than the town. Older than the KING."]}],
  },
  pale_hall: {
    name: "Guard Hall", theme: "interior", enc: null,
    grid: [
      "########################",
      "#......................#",
      "#......................#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"palegate", tx:11, ty:13 }, { x:12, y:15, to:"palegate", tx:11, ty:13 } ],
    npcs: [ { id:"paleknight", x:11, y:2, pal:"acolyte", name:"The Pale Knight", trainer:"paleknight", lines: ["..."] } ],
  },
  pale_home: {
    name: "A Quiet House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..BB..........KKKK....#",
      "#..BB..................#",
      "#......................#",
      "#......TT..............#",
      "#......TT..............#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"palegate", tx:29, ty:13 }, { x:12, y:15, to:"palegate", tx:29, ty:13 } ],
    npcs: [ { id:"pgh", x:13, y:5, pal:"villager", name:"Gate Scholar",
        lines: ["Past the north gate the road runs UNDER the earth. The Underveil.", "Bring light. Bring bone. Bring anything that hits Hex hard.", "Bring a will, mostly."] } ],
  },
  lastlantern: {
    name: "Last Lantern", theme: "lantern", enc: null, gateFlag: "hand",
    grid: [
      "############XX########################",
      "#..#........,,#########...b#........##",
      "#...........,,...####................#",
      "#...........,,.......................#",
      "##..#####...,,.......................#",
      "##########..,l...........l...........#",
      "##..#####...,,....rrrrrr.............#",
      "##..........,,....rrrrrr.............#",
      "##....rrrr..,,....hhhhhh..brrrr......#",
      "###...hhhh..,,....hhhdhh...hhhh.....##",
      "###...hhgh..,,.......,.....hhdh.....##",
      "##......,...,,.......,.......,......##",
      "###.b...,.l.,,l...l..,l...l..,l....###",
      "##......,,,,,,,,,,,,,,,,,,,,,,,,...###",
      "#.....l..s..,,,,,,,,,,,,,,,,,,,,...###",
      "#...............,,...b.............###",
      "#...............,,.................###",
      "#...............,,..c..............###",
      "#...............,,.................###",
      "#...............,l......l.....########",
      "#...............,,...........#########",
      "#...............,,............########",
      "#...............,,.............#.#..##",
      "#....#.........#,,######.###.......###",
      "#...###.#.##.###,,###########......###",
      "################,,####################",
    ],
    exits: [{"x":16,"y":25,"to":"underveil","tx":16,"ty":1},{"x":17,"y":25,"to":"underveil","tx":17,"ty":1},{"x":12,"y":0,"to":"threshold","tx":12,"ty":24},{"x":13,"y":0,"to":"threshold","tx":13,"ty":24}],
    doors: [{"x":21,"y":9,"to":"lantern_hall","tx":11,"ty":14},{"x":29,"y":10,"to":"lantern_home","tx":11,"ty":14}],
    signs: [{"x":9,"y":14,"lines":["LAST LANTERN","One lamp still lit.","Guard it with your teeth."]}],
    npcs: [{"id":"ll1","x":15,"y":15,"pal":"elder","name":"Lantern Keeper","lines":["Every lamp in the kingdom went out. Ours did not. We do not know why.","The Hand of the King lives in our hall and watches our lantern burn, and smiles, and does NOTHING.","That is somehow the most frightening thing it does."]},{"id":"ll2","x":25,"y":16,"pal":"villager","name":"Last Villager","lines":["Beyond the north gate is the Threshold. Beyond the Threshold, the Court.","Nobody comes back down the road. You look like you might.","Come back down the road."]}],
  },
  lantern_hall: {
    name: "Guard Hall", theme: "interior", enc: null,
    grid: [
      "########################",
      "#......................#",
      "#......................#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..#.......uu.......#..#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........uu..........#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"lastlantern", tx:21, ty:10 }, { x:12, y:15, to:"lastlantern", tx:21, ty:10 } ],
    npcs: [ { id:"hand", x:11, y:2, pal:"king", name:"The Hand of the King", trainer:"hand", lines: ["..."] } ],
  },
  lantern_home: {
    name: "A Quiet House", theme: "interior", enc: null,
    grid: [
      "########################",
      "#..BB..........KKKK....#",
      "#..BB..................#",
      "#......................#",
      "#......TT..............#",
      "#......TT..............#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..........,,..........#",
      "###########,,###########",
    ],
    exits: [ { x:11, y:15, to:"lastlantern", tx:29, ty:11 }, { x:12, y:15, to:"lastlantern", tx:29, ty:11 } ],
    npcs: [ { id:"llh", x:13, y:5, pal:"widow", name:"Neighbor of the Hand",
        lines: ["It borrowed a cup of salt once. Returned the cup washed. Returned MORE salt.", "I have not slept properly since."] } ],
  },
  court: {
    name: "The Hollow Court", theme: "veil", enc: null, gateFlag: "king",
    grid: [
      "##################XX############",
      "##......#.####...#,,...#########",
      "##..........#.....,,.......#####",
      "##................,,.........###",
      "##................,,..........##",
      "##..............hhuuhh.......###",
      "#..............b..uu..b......###",
      "##..........G.....uu.....G...###",
      "##................uun.........##",
      "##.............b..uu..b......###",
      "##..........G.....uu.....G...###",
      "#.................uu.........###",
      "##.............b..uu..b......###",
      "##..........G.....uu.....G...###",
      "##................uu.........###",
      "##.............b..uu.nb.......##",
      "###.........G.....uu.....G....##",
      "###..n............uu..........##",
      "###............b..uu..b........#",
      "##.........nG.....uu.....G.....#",
      "##................uu...........#",
      "##................,,...........#",
      "###..n............,,...........#",
      "###..#######.....#,,#..........#",
      "###.##############,,##.........#",
      "##################,,############",
    ],
    exits: [{"x":18,"y":25,"to":"threshold","tx":18,"ty":1},{"x":19,"y":25,"to":"threshold","tx":19,"ty":1},{"x":18,"y":0,"to":"behindveil","tx":18,"ty":22},{"x":19,"y":0,"to":"behindveil","tx":19,"ty":22}],
    npcs: [{"id":"king","x":18,"y":6,"pal":"king","name":"The Hollow King","trainer":"king","lines":["..."]}],
  },
};




export const THEMES = {
  town:      { ground:"#43483a", dot:"#3a4030", path:"#6a5a42", tree:"#28331f", treeTop:"#35452a", tall:"#54683e", tall2:"#425432", water:"#255066", wave:"#3a7590", wall:"#5a5040", roof:"#8a4040", roofD:"#623030", door:"#ffcf5c", fence:"#645a48", gate:"#2e2440", gateG:"#b06ad0" },
  woods:     { ground:"#33402a", dot:"#2a3622", path:"#5a5038", tree:"#1e2c1a", treeTop:"#2c4022", tall:"#4a6636", tall2:"#3a5228", water:"#255066", wave:"#3a7590", wall:"#3e3a30", roof:"#5a4040", roofD:"#3a2a2a", door:"#ffcf5c", fence:"#4a463a", gate:"#2e2440", gateG:"#b06ad0" },
  mire:      { ground:"#2e3826", dot:"#26301f", path:"#4d4a2f", tree:"#1c2818", treeTop:"#243820", tall:"#3e5a2e", tall2:"#324c26", water:"#1e3d2c", wave:"#2f6048", wall:"#383428", roof:"#544040", roofD:"#3a2a2a", door:"#ffcf5c", fence:"#44402f", gate:"#2e2440", gateG:"#b06ad0" },
  chapel:    { ground:"#3a3630", dot:"#302c26", path:"#5e5848", tree:"#2a2620", treeTop:"#3a342a", tall:"#544d64", tall2:"#443c54", water:"#255066", wave:"#3a7590", wall:"#504a3c", roof:"#5e5858", roofD:"#403a3a", door:"#ffcf5c", fence:"#665e4d", gate:"#2e2440", gateG:"#b06ad0" },
  threshold: { ground:"#2c2440", dot:"#241c34", path:"#463868", tree:"#160f26", treeTop:"#241833", tall:"#5a4488", tall2:"#442f6a", water:"#1e1638", wave:"#382a5a", wall:"#3a2e5a", roof:"#3a2e5a", roofD:"#2c2246", door:"#ffcf5c", fence:"#463a68", gate:"#2e2440", gateG:"#e070ff" },
  interior:  { solid: true, ground:"#7a5c3e", dot:"#6a4e34", path:"#8a6c48", tree:"#3a342c", treeTop:"#3a342c", tall:"#7a5c3e", tall2:"#6a4e34", water:"#255066", wave:"#3a7590", wall:"#4e463c", roof:"#4e463c", roofD:"#3c352c", door:"#ffcf5c", fence:"#54503f", gate:"#2e2440", gateG:"#b06ad0" },
  cave:      { solid: true, ground:"#2e2a38", dot:"#26222c", path:"#3e384c", tree:"#171420", treeTop:"#171420", tall:"#463c5e", tall2:"#382e50", water:"#1a3040", wave:"#2a5a70", wall:"#201b2c", roof:"#201b2c", roofD:"#171420", door:"#ffcf5c", fence:"#3a3444", gate:"#2e2440", gateG:"#8a5ab0" },
  veil:      { ground:"#2c1f44", dot:"#241834", path:"#46326a", tree:"#140c22", treeTop:"#1f1330", tall:"#5c3f88", tall2:"#48306c", water:"#1a1030", wave:"#301e50", wall:"#382860", roof:"#382860", roofD:"#2a1c48", door:"#ffcf5c", fence:"#43326a", gate:"#2e2440", gateG:"#ff70ff" },
  ashgrove:  { solid: false, ground:"#4a3f34", dot:"#3e342a", path:"#6a5642", tree:"#3a1f14", treeTop:"#5a3420", tall:"#8a6a3a", tall2:"#6e5230", water:"#255066", wave:"#3a7590", wall:"#6a4a3a", roof:"#a85838", roofD:"#7a3e28", door:"#ffcf5c", fence:"#6a5240", gate:"#2e2440", gateG:"#b06ad0" },
  fenmoor:   { ground:"#33402f", dot:"#2a3626", path:"#5c5236", tree:"#1c2818", treeTop:"#243820", tall:"#446636", tall2:"#365428", water:"#1f4a52", wave:"#357a86", wall:"#4a4636", roof:"#5a5548", roofD:"#3e3a2e", door:"#ffcf5c", fence:"#544d3a", gate:"#2e2440", gateG:"#b06ad0" },
  vesper:    { ground:"#3c3844", dot:"#322e3a", path:"#605868", tree:"#28242e", treeTop:"#38343e", tall:"#5c5470", tall2:"#4a4460", water:"#255066", wave:"#3a7590", wall:"#565060", roof:"#7a7488", roofD:"#565064", door:"#ffcf5c", fence:"#666074", gate:"#2e2440", gateG:"#b06ad0" },
  palegate:  { solid: false, ground:"#5a5850", dot:"#4e4c44", path:"#7c7868", tree:"#3a382e", treeTop:"#4a4636", tall:"#6a6656", tall2:"#565244", water:"#255066", wave:"#3a7590", wall:"#8a8578", roof:"#9e988a", roofD:"#7a7468", door:"#ffcf5c", fence:"#787264", gate:"#2e2440", gateG:"#b06ad0" },
  lantern:   { ground:"#282634", dot:"#20202c", path:"#3a3648", tree:"#161422", treeTop:"#20202c", tall:"#3a3450", tall2:"#2e2844", water:"#1c2c40", wave:"#2a4a66", wall:"#34303e", roof:"#4a4058", roofD:"#342c44", door:"#ffdf7c", fence:"#3e384c", gate:"#2e2440", gateG:"#b06ad0" },
};

export const SHOP_STOCK = ["salve", "gsalve", "incense", "sigil", "gsigil", "kindred", "bonering", "leechfang", "ironvigil", "swift", "cursedeye"];

// DATA-END


// ============================================================
// sprite smoothing: Scale2x (EPX) applied twice = 4x resolution
// ============================================================
function scale2xGrid(g) {
  const H = g.length, W = g[0].length;
  const out = [];
  for (let y = 0; y < H; y++) {
    let r1 = "", r2 = "";
    for (let x = 0; x < W; x++) {
      const P = g[y][x];
      const A = y > 0 ? g[y - 1][x] : P;
      const D = y < H - 1 ? g[y + 1][x] : P;
      const C = x > 0 ? g[y][x - 1] : P;
      const B = x < W - 1 ? g[y][x + 1] : P;
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if (C === A && C !== D && A !== B) p1 = A;
      if (A === B && A !== C && B !== D) p2 = B;
      if (D === C && D !== B && C !== A) p3 = C;
      if (B === D && B !== A && D !== C) p4 = D;
      r1 += p1 + p2; r2 += p3 + p4;
    }
    out.push(r1, r2);
  }
  return out;
}
const SPRITE_CACHE = {};
function spriteCanvas(key, grid, pal, flip) {
  const k = key + (flip ? "|f" : "");
  if (SPRITE_CACHE[k]) return SPRITE_CACHE[k];
  const g4 = scale2xGrid(scale2xGrid(grid));
  const W = g4[0].length, H = g4.length;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = g4[y][flip ? W - 1 - x : x];
    if (ch === ".") continue;
    const c = pal[ch];
    if (!c) continue;
    ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
  }
  SPRITE_CACHE[k] = cv;
  return cv;
}
const HUMAN_GRIDS = null; // assigned below after grids are defined

// ============================================================
// sound engine (Tone.js, synthesized live)
// ============================================================
let AU = null;
async function auInit() {
  if (AU) return AU;
  await Tone.start();
  const filter = new Tone.Filter(300, "lowpass").toDestination();
  const drone = new Tone.Oscillator(55, "sine").connect(filter); drone.volume.value = -28;
  const drone2 = new Tone.Oscillator(55.7, "sine").connect(filter); drone2.volume.value = -32;
  const pluck = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.08 } }).toDestination(); pluck.volume.value = -16;
  const noise = new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.003, decay: 0.14, sustain: 0 } }).toDestination(); noise.volume.value = -16;
  const bass = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.6, sustain: 0, release: 0.4 } }).toDestination(); bass.volume.value = -12;
  AU = { filter, drone, drone2, pluck, noise, bass };
  return AU;
}
function sfxRaw(n) {
  if (!AU) return;
  try {
    const t = Tone.now();
    if (n === "hit") AU.noise.triggerAttackRelease(0.08, t);
    if (n === "hitbig") { AU.noise.triggerAttackRelease(0.16, t); AU.bass.triggerAttackRelease(70, 0.15, t); }
    if (n === "blip") AU.pluck.triggerAttackRelease(340, 0.05, t);
    if (n === "heal") { AU.pluck.triggerAttackRelease(392, 0.08, t); AU.pluck.triggerAttackRelease(523, 0.12, t + 0.1); }
    if (n === "level") { AU.pluck.triggerAttackRelease(330, 0.07, t); AU.pluck.triggerAttackRelease(415, 0.07, t + 0.08); AU.pluck.triggerAttackRelease(494, 0.12, t + 0.16); }
    if (n === "bind") { AU.pluck.triggerAttackRelease(262, 0.1, t); AU.pluck.triggerAttackRelease(392, 0.16, t + 0.12); }
    if (n === "faint") { AU.bass.triggerAttackRelease(110, 0.3, t); AU.bass.triggerAttackRelease(65, 0.5, t + 0.18); }
    if (n === "sting") { AU.bass.triggerAttackRelease(58, 0.9, t); AU.bass.triggerAttackRelease(61.5, 0.9, t + 0.05); }
  } catch (e) {}
}
const DRONE_FREQ = { town: 62, woods: 55, mire: 49, chapel: 45, threshold: 38 };

// ============================================================
// helpers
// ============================================================

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function statsFor(spId, lvl) {
  const b = DEX[spId].b;
  return {
    maxHp: Math.floor((b.hp * lvl) / 35) + lvl + 12,
    atk: Math.floor((b.atk * lvl) / 45) + 5,
    def: Math.floor((b.def * lvl) / 45) + 5,
    spd: Math.floor((b.spd * lvl) / 45) + 5,
  };
}
function movesAt(spId, lvl) {
  return DEX[spId].learn.filter(([l]) => l <= lvl).map(([, m]) => m).slice(-4);
}
function makeMon(spId, lvl) {
  const st = statsFor(spId, lvl);
  return { sp: spId, lvl, xp: 0, hp: st.maxHp, ...st, moves: movesAt(spId, lvl), status: null, charm: null };
}
function xpNeed(lvl) { return lvl * lvl * 4; }
function eff(moveType, defSpId) {
  const row = CHART[moveType] || {};
  return DEX[defSpId].ty.reduce((m, t) => m * (row[t] ?? 1), 1);
}
function stageMult(s) { return s >= 0 ? (2 + s) / 2 : 2 / (2 - s); }
function typeTag(t) { return TYPES[t].n; }

// fresh game state
function initG() {
  const g = {
    screen: "title",
    map: "town", x: 19, y: 15, face: "down",
    party: [], bag: { salve: 3, gsalve: 0, incense: 0, sigil: 5, gsigil: 0 },
    embers: 120, flags: {}, seals: [],
    bound: {}, steps: 0, visited: { town: true }, learnQueue: [], sound: false, sfx: null, name: "", sprite: "m", picked: {},
    dialog: null, shop: false, menu: null, starterPick: false,
    battle: null, ending: false,
    saveIO: null, // 'export' | 'import'
  };
  if (DEV_MODE) {
    g.party = ["pyrewraith", "mausohound", "duskveil", "hemolich", "ossari", "paleling"].map((s) => makeMon(s, 30));
    g.party.forEach((m) => { g.bound[m.sp] = true; });
    g.bag = { salve: 20, gsalve: 20, incense: 10, sigil: 25, gsigil: 25, kindred: 1, bonering: 1, leechfang: 1, ironvigil: 1, swift: 1, cursedeye: 1 };
    g.embers = 9999;
    g.flags.starter = true;
    Object.keys(MAPS).forEach((k) => { g.visited[k] = true; });
  }
  return g;
}

// ============================================================
// component
// ============================================================

export default function PaleVigil() {
  const [G, setG] = useState(() => {
    try {
      const raw = localStorage.getItem("pale-vigil-save");
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.party && data.bag && MAPS[data.map]) {
          const g = initG();
          Object.assign(g, data, { screen: "world", dialog: null, battle: null, menu: null, shop: false, starterPick: false, saveIO: null });
          if (!g.visited) g.visited = {};
          if (!g.learnQueue) g.learnQueue = [];
          return g;
        }
      }
    } catch (e) {}
    return initG();
  });
  const [nameIn, setNameIn] = useState("");
  const [genderIn, setGenderIn] = useState("m");
  const canvasRef = useRef(null);
  const importRef = useRef(null);

  // ---------- world helpers ----------

  const tileAt = (g, x, y) => {
    const m = MAPS[g.map];
    if (y < 0 || y >= m.grid.length || x < 0 || x >= m.grid[0].length) return "#";
    let ch = m.grid[y][x];
    if (ch === "X" && (DEV_MODE || (m.gateFlag && g.flags[m.gateFlag]))) ch = ","; // opened gate
    return ch;
  };
  const npcAt = (g, x, y) => (MAPS[g.map].npcs || []).find((n) => n.x === x && n.y === y && !(n.trainer === "king" && g.flags.king));
  const WALK = ".,tumn";

  function startDialog(g, lines, after, speaker) {
    g.dialog = { lines, i: 0, after: after || null, speaker: speaker || null };
  }

  function interactNpc(g, npc) {
    if (npc.shopkeeper) { startDialog(g, npc.lines, { type: "shop" }, npc.name); return; }
    if (npc.healer) {
      g.party.forEach((p) => { const s = statsFor(p.sp, p.lvl); p.hp = s.maxHp; p.status = null; });
      g.sfx = { n: "heal", k: (g.sfx ? g.sfx.k : 0) + 1 };
      startDialog(g, npc.lines, null, npc.name);
      return;
    }
    if (npc.starter) {
      if (!g.flags.starter) startDialog(g, npc.lines, { type: "starter" }, npc.name);
      else if (!g.flags.wren) startDialog(g, ["The first Warden waits in the Ashen Woods, north of here.", "Mind the tall shadows. Or better — hunt in them. Your companion must grow."], null, npc.name);
      else if (!g.flags.king) startDialog(g, ["The seals fall, one by one. I can feel it.", "Keep going, child. Bring me back a dawn."], null, npc.name);
      else startDialog(g, ["...dawn. You brought back a dawn.", "The Vigil burns again because of you, Warden."], null, npc.name);
      return;
    }
    if (npc.trainer) {
      const t = TRAINERS[npc.trainer];
      if (g.flags[t.flag]) {
        startDialog(g, t.post, null, t.name);
      } else if (g.party.length === 0) {
        startDialog(g, ["You carry no Dread. I do not fight the unarmed."], null, t.name);
      } else {
        startDialog(g, t.pre, { type: "battle", trainer: npc.trainer }, t.name);
      }
      return;
    }
    startDialog(g, npc.lines, null, npc.name);
  }

  function afterStep(g) {
    const m = MAPS[g.map];
    // exits
    const ex = (m.exits || []).find((e) => e.x === g.x && e.y === g.y);
    if (ex) {
      if (m.guard && g.party.length === 0) {
        g.x = 19; g.y = 15;
        startDialog(g, ["You shouldn't leave unarmed. Enter the upper-west house — Elder Maren is waiting inside."]);
        return;
      }
      g.map = ex.to; g.x = ex.tx; g.y = ex.ty;
      g.visited[ex.to] = true;
      return;
    }
    // treasure
    const it = (m.items || []).find((i) => i.x === g.x && i.y === g.y && !g.picked[g.map + ":" + i.x + "," + i.y]);
    if (it) {
      g.picked[g.map + ":" + it.x + "," + it.y] = true;
      g.sfx = { n: "bind", k: (g.sfx ? g.sfx.k : 0) + 1 };
      if (it.id === "embers") { g.embers += it.qty; startDialog(g, [`You found ${it.qty} embers, tucked out of sight!`]); }
      else { g.bag[it.id] = (g.bag[it.id] || 0) + it.qty; startDialog(g, [`You found ${ITEMS[it.id].n}${it.qty > 1 ? " ×" + it.qty : ""}!`]); }
      return;
    }
    // encounters
    const enc = m.enc;
    if (enc && tileAt(g, g.x, g.y) === "t" && Math.random() < enc.rate && g.party.some((p) => p.hp > 0)) {
      startWild(g);
    }
  }

  function moveP(g, dx, dy) {
    if (g.dialog || g.battle || g.menu || g.shop || g.starterPick || g.saveIO || g.ending || g.screen !== "world") return;
    g.face = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
    const nx = g.x + dx, ny = g.y + dy;
    const npc = npcAt(g, nx, ny);
    if (npc) { interactNpc(g, npc); return; }
    const ch = tileAt(g, nx, ny);
    if (ch === "d" || ch === "g") {
      const m2 = MAPS[g.map];
      const dr = (m2.doors || []).find((d) => d.x === nx && d.y === ny);
      if (dr) { g.map = dr.to; g.x = dr.tx; g.y = dr.ty; g.visited[dr.to] = true; return; }
      if (ch === "d") {
        g.party.forEach((p) => { const s = statsFor(p.sp, p.lvl); p.hp = s.maxHp; p.status = null; });
        g.sfx = { n: "heal", k: (g.sfx ? g.sfx.k : 0) + 1 };
        startDialog(g, ["The keepers tend your Dreads by what little flame remains.", "Your party is fully rested."]);
      }
      if (ch === "g") g.shop = true;
      return;
    }
    if (ch === "c") {
      g.party.forEach((p) => { const s = statsFor(p.sp, p.lvl); p.hp = s.maxHp; p.status = null; });
      g.sfx = { n: "heal", k: (g.sfx ? g.sfx.k : 0) + 1 };
      startDialog(g, ["A wayshrine candle sputters... then steadies.", "Your Dreads are fully rested."]);
      return;
    }
    if (ch === "s") {
      const sg = (MAPS[g.map].signs || []).find((s2) => s2.x === nx && s2.y === ny);
      startDialog(g, sg ? sg.lines : ["The letters have worn away."]);
      return;
    }
    if (ch === "X") {
      const gf = MAPS[g.map].gateFlag;
      const gn = { ash:"Sister Ash", sol:"Gravekeeper Sol", wren:"Mother Wren", choir:"the Choirmaster", paleknight:"the Pale Knight", hand:"the Hand of the King", king:"the Hollow King" }[gf] || "the Guard";
      startDialog(g, ["The road north is sealed with violet sigils.", `Defeat ${gn} — this town's Guard — to break the seal.`]);
      return;
    }
    if (!WALK.includes(ch)) return;
    g.x = nx; g.y = ny; g.steps++;
    afterStep(g);
  }

  function advanceDialog(g) {
    const d = g.dialog;
    if (!d) return;
    if (d.i < d.lines.length - 1) { d.i++; return; }
    const after = d.after;
    g.dialog = null;
    if (!after) return;
    if (after.type === "starter") g.starterPick = true;
    if (after.type === "shop") g.shop = true;
    if (after.type === "battle") startTrainer(g, after.trainer);
    if (after.type === "ending") g.ending = true;
  }

  function pickStarter(g, spId) {
    g.party = [makeMon(spId, 5)];
    g.bound[spId] = true;
    g.flags.starter = true;
    g.starterPick = false;
    startDialog(g, [
      `${DEX[spId].n} stirs, and settles beside you like it always belonged there.`,
      "Elder Maren presses 5 Binding Sigils and 3 Salves into your hands.",
      "\"The woods first, child. Grow strong in the tall shadows. Then face Mother Wren.\"",
    ]);
  }

  // ---------- items in world ----------
  function useItemWorld(g, itemId, monIdx) {
    const it = ITEMS[itemId];
    const mon = g.party[monIdx];
    if (!mon || g.bag[itemId] <= 0) return;
    if (it.heal) {
      if (mon.hp <= 0 || mon.hp >= mon.maxHp) return;
      mon.hp = Math.min(mon.maxHp, mon.hp + it.heal);
      g.bag[itemId]--;
    } else if (it.cure) {
      if (!mon.status) return;
      mon.status = null;
      g.bag[itemId]--;
    }
  }

  function buyItem(g, itemId) {
    const it = ITEMS[itemId];
    if (g.embers >= it.price) { g.embers -= it.price; g.bag[itemId] = (g.bag[itemId] || 0) + 1; g.sfx = { n: "blip", k: (g.sfx ? g.sfx.k : 0) + 1 }; }
  }

  // ---------- save / load ----------
  function exportSave(g) {
    const { screen, dialog, battle, menu, shop, starterPick, saveIO, ...rest } = g;
    return btoa(unescape(encodeURIComponent(JSON.stringify(rest))));
  }
  function importSave(g, str) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      if (!data.party || !data.bag || !MAPS[data.map]) throw new Error("bad");
      Object.assign(g, initG(), data, { screen: "world" });
      if (!g.visited) g.visited = {};
      g.visited[g.map] = true;
      startDialog(g, ["The Veil remembers you. Welcome back, Warden."]);
    } catch (e) {
      startDialog(g, ["That sigil is corrupted. The save could not be read."]);
    }
  }

  // ---------- input ----------
  const act = useCallback((fn) => setG((g) => { const d = structuredClone(g); fn(d); return d; }), []);
  const keysRef = useRef(new Set());

  // ---------- touch joystick ----------
  // Direction is derived from the touch position RELATIVE TO THE STICK'S OWN
  // CENTRE (never absolute screen coordinates), so it works wherever it sits.
  const joyRef = useRef({ dx: 0, dy: 0 });
  const joyElRef = useRef(null);
  const joyActiveRef = useRef(false);
  const [joyKnob, setJoyKnob] = useState(null);

  // ---------- mobile entry gate ----------
  // On touch devices the whole game stays hidden behind a tap-to-enter prompt so
  // it never shows (especially in portrait) until the player enters — and so the
  // landscape lock can fire on that real user gesture.
  const [isTouch] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const [entered, setEntered] = useState(false);
  const enterMobile = () => {
    try { const el = document.documentElement; if (el.requestFullscreen) { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } } catch (e) {}
    try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape"); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    setEntered(true);
  };

  const joySample = (clientX, clientY) => {
    const el = joyElRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; // the stick's own centre
    const dx = clientX - cx, dy = clientY - cy;                 // touch relative to that centre
    const rad = r.width / 2;
    const dist = Math.hypot(dx, dy);
    const kd = Math.min(dist, rad);                             // clamp knob inside the base (never spills)
    setJoyKnob(dist > 0 ? { x: (dx / dist) * kd, y: (dy / dist) * kd } : { x: 0, y: 0 });
    if (dist < rad * 0.34) { joyRef.current = { dx: 0, dy: 0 }; return; } // dead zone
    let ndx = 0, ndy = 0;
    if (Math.abs(dx) > Math.abs(dy)) ndx = dx > 0 ? 1 : -1; else ndy = dy > 0 ? 1 : -1;
    const prev = joyRef.current;
    joyRef.current = { dx: ndx, dy: ndy };
    if (prev.dx !== ndx || prev.dy !== ndy) act((g) => moveP(g, ndx, ndy)); // instant step on a new direction
  };
  const joyStart = (e) => { joyActiveRef.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} joySample(e.clientX, e.clientY); };
  const joyMove = (e) => { if (joyActiveRef.current) joySample(e.clientX, e.clientY); };
  const joyEnd = () => { joyActiveRef.current = false; joyRef.current = { dx: 0, dy: 0 }; setJoyKnob(null); };

  useEffect(() => {
    const DIRS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const k = e.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
      if (DIRS[k]) {
        if (!e.repeat && !keysRef.current.has(k)) {
          keysRef.current.add(k);
          act((g) => moveP(g, DIRS[k][0], DIRS[k][1]));
        }
        return;
      }
      act((g) => {
        if (g.screen === "title" && (k === "Enter" || k === " ")) { beginGame(g); return; }
        if (g.battle) { if (k === "Enter" || k === " ") advanceBattle(g); return; }
        if (g.dialog) { if (k === "Enter" || k === " ") advanceDialog(g); return; }
        if (g.menu || g.shop || g.saveIO) { if (k === "Escape") { g.menu = null; g.shop = false; g.saveIO = null; } }
      });
    };
    const onKeyUp = (e) => { keysRef.current.delete(e.key); };
    const onBlur = () => keysRef.current.clear();
    const walker = setInterval(() => {
      let dir = null;
      for (const k of keysRef.current) { if (DIRS[k]) { dir = DIRS[k]; break; } }
      if (!dir) { const j = joyRef.current; if (j.dx || j.dy) dir = [j.dx, j.dy]; } // held joystick repeats too
      if (dir) act((g) => moveP(g, dir[0], dir[1]));
    }, 135);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => { clearInterval(walker); window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur); };
  }, [act]);

  // Track orientation so the gate shows the right message and dismisses itself
  // once the device is actually landscape.
  const [portrait, setPortrait] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(orientation: portrait)").matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(orientation: portrait)");
    const on = () => setPortrait(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, []);

  function beginGame(g) { g.screen = "setup"; }

  function startAdventure(g, name, sprite) {
    g.name = (name.trim() || "Warden").slice(0, 12);
    g.sprite = sprite;
    g.screen = "world";
    startDialog(g, [
      `${g.name}. Hollow Vale has been waiting for you.`,
      "For 400 years the Vigil Flame held the Veil shut, and the Dreads were only stories. Three nights ago, the Flame went out.",
      "— HOW TO SURVIVE —",
      "Move with WASD, the arrow keys, or the on-screen stick. Hold to walk. Walk INTO people to speak with them; tap to advance text.",
      "Tall, dark grass hides wild Dreads. Weaken one in battle, then cast a Binding Sigil from your BAG to bind it to your party.",
      "Glowing doors and wayshrine candles — small flames on stone — fully heal your party. Always free.",
      "Open the MENU for your party, bag, world map, and save sigils. Check each Dread's Ability, and equip Charms from the shop.",
      "The type wheel: Flame > Shade > Spirit > Blood > Bone > Hex > Flame. Strike what fears you; avoid what hunts you.",
      "Elder Maren waits INSIDE the upper-west house — walk into its door to enter. Bring her back a dawn.",
    ]);
  }

  useEffect(() => {
    if (G.screen !== "world") return;
    try {
      const { screen, dialog, battle, menu, shop, starterPick, saveIO, sfx, ...save } = G;
      localStorage.setItem("pale-vigil-save", JSON.stringify(save));
    } catch (e) {}
  }, [G.map, G.x, G.y, G.party, G.bag, G.embers, G.flags, G.seals, G.bound, G.picked, G.name, G.sprite]);

  // ---------- sound hooks ----------
  const toggleSound = async () => {
    if (!G.sound) {
      try { await auInit(); AU.drone.start(); AU.drone2.start(); } catch (e) {}
      act((g) => { g.sound = true; });
    } else {
      try { AU.drone.stop(); AU.drone2.stop(); } catch (e) {}
      act((g) => { g.sound = false; });
    }
  };
  const themeNow = MAPS[G.map].theme;
  useEffect(() => {
    if (G.sound && AU) {
      try {
        const f = DRONE_FREQ[themeNow] || 55;
        AU.drone.frequency.rampTo(f, 1.5);
        AU.drone2.frequency.rampTo(f + 0.7, 1.5);
      } catch (e) {}
    }
  }, [themeNow, G.sound]);
  useEffect(() => {
    if (!G.sound) return;
    const bb = G.battle;
    const e = bb && bb.phase === "msg" ? bb.log[bb.li] : null;
    if (e && e.fx) sfxRaw(e.fx);
  }, [G.battle?.li, G.battle?.log, G.sound]);
  useEffect(() => { if (G.sound && G.sfx) sfxRaw(G.sfx.n); }, [G.sfx?.k, G.sound]);
  useEffect(() => () => { if (AU) { try { AU.drone.stop(); AU.drone2.stop(); } catch (e) {} } }, []);

  // ---------- canvas rendering (60fps animated) ----------
  const gRef = useRef(G); gRef.current = G;
  const animRef = useRef({ x: G.x, y: G.y, map: G.map });

  useEffect(() => {
    let raf, last = performance.now();
    const T = 16;
    const GRID_NAMES = [["D0", H_D0], ["D1", H_D1], ["U0", H_U0], ["U1", H_U1], ["S0", H_S0], ["S1", H_S1]];
    const nameOf = (grid) => { for (const [n, gr] of GRID_NAMES) if (gr === grid) return n; return "D0"; };
    const drawHuman = (ctx, grid, palName, px, py, flip) => {
      const s = spriteCanvas("h:" + palName + ":" + nameOf(grid), grid, HUMAN_PALS[palName] || HUMAN_PALS.villager, flip);
      ctx.drawImage(s, Math.round(px * 4) / 4, Math.round(py * 4) / 4, 16, 16);
    };
    const render = (now) => {
      raf = requestAnimationFrame(render);
      const g = gRef.current;
      const cv = canvasRef.current;
      if (!cv || g.screen !== "world") { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const A = animRef.current;
      if (A.map !== g.map) { A.map = g.map; A.x = g.x; A.y = g.y; }
      const dx = g.x - A.x, dy = g.y - A.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.0001) {
        const step = Math.min(dist, 8.5 * dt);
        A.x += (dx / dist) * step; A.y += (dy / dist) * step;
      }
      const moving = dist > 0.03;

      const ctx = cv.getContext("2d");
      const VW = 192, VH = 128;
      const m = MAPS[g.map]; const th = THEMES[m.theme];
      const MW = m.grid[0].length * 16, MH = m.grid.length * 16; // maps can be any size
      const camX = clamp(A.x * 16 + 8 - VW / 2, 0, Math.max(0, MW - VW));
      const camY = clamp(A.y * 16 + 8 - VH / 2, 0, Math.max(0, MH - VH));
      ctx.setTransform(8, 0, 0, 8, 0, 0);
      ctx.translate(-camX, -camY);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#060509"; ctx.fillRect(camX - 8, camY - 8, VW + 16, VH + 16); // void beyond small maps
      const lamps = [];
      const wave = Math.floor(now / 480) % 2;
      const sway = Math.floor(now / 640) % 2;
      // only draw the tiles the camera can see (maps can be much larger than the view)
      const x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(m.grid[0].length, Math.ceil((camX + VW) / T) + 1);
      const y0 = Math.max(0, Math.floor(camY / T)), y1 = Math.min(m.grid.length, Math.ceil((camY + VH) / T) + 1);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        let ch = m.grid[y][x];
        if (ch === "X" && (DEV_MODE || (m.gateFlag && g.flags[m.gateFlag]))) ch = ",";
        const px = x * T, py = y * T;
        const seed = (x * 7 + y * 13) % 5;
        ctx.fillStyle = th.ground; ctx.fillRect(px, py, T, T);
        if (seed === 0) { ctx.fillStyle = th.dot; ctx.fillRect(px + 4, py + 9, 2, 2); }
        if (seed === 3) { ctx.fillStyle = th.dot; ctx.fillRect(px + 11, py + 4, 2, 2); }
        if (ch === ",") { ctx.fillStyle = th.path; ctx.fillRect(px, py, T, T); ctx.fillStyle = th.dot; if (seed === 1) ctx.fillRect(px + 6, py + 6, 2, 2); }
        else if (ch === "t") {
          ctx.fillStyle = th.tall; ctx.fillRect(px, py + 3, T, T - 3);
          ctx.fillStyle = th.tall2;
          const s2 = (seed + sway) % 2;
          for (let i = 0; i < 4; i++) ctx.fillRect(px + 1 + i * 4 + ((i + s2) % 2), py + 1 + ((i + seed + s2) % 2) * 2, 2, T - 3);
        }
        else if (ch === "#") {
          if (th.solid) {
            ctx.fillStyle = th.wall; ctx.fillRect(px, py, T, T);
            ctx.fillStyle = th.roofD; ctx.fillRect(px, py + 7, T, 1); ctx.fillRect(px + 5 + (seed % 2) * 4, py, 1, 7); ctx.fillRect(px + 3 + seed, py + 8, 1, 8);
          } else {
            ctx.fillStyle = th.tree; ctx.fillRect(px + 6, py + 8, 4, 8);
            ctx.fillStyle = th.treeTop; ctx.fillRect(px + 1, py, 14, 10);
            ctx.fillStyle = th.tree; ctx.fillRect(px + 3, py + 2, 3, 3); ctx.fillRect(px + 9, py + 4, 3, 3);
          }
        }
        else if (ch === "G") {
          ctx.fillStyle = "#8a8578"; ctx.fillRect(px + 5, py + 4, 6, 9);
          ctx.fillStyle = "#a09a8a"; ctx.fillRect(px + 6, py + 3, 4, 2);
          ctx.fillStyle = "#6e6a5e"; ctx.fillRect(px + 7, py + 6, 2, 1); ctx.fillRect(px + 6, py + 8, 4, 1);
          ctx.fillStyle = "#5a564c"; ctx.fillRect(px + 4, py + 13, 8, 2);
        }
        else if (ch === "u") { ctx.fillStyle = "#7a3040"; ctx.fillRect(px, py, T, T); ctx.fillStyle = "#5a2430"; ctx.fillRect(px + 1, py + 1, T - 2, 1); ctx.fillRect(px + 1, py + 14, T - 2, 1); }
        else if (ch === "B") {
          ctx.fillStyle = "#5a4530"; ctx.fillRect(px + 1, py + 2, 14, 13);
          ctx.fillStyle = "#7a3040"; ctx.fillRect(px + 2, py + 6, 12, 8);
          ctx.fillStyle = "#e8e0d0"; ctx.fillRect(px + 2, py + 3, 12, 3);
        }
        else if (ch === "T") {
          ctx.fillStyle = "#8a6a48"; ctx.fillRect(px + 2, py + 4, 12, 7);
          ctx.fillStyle = "#6a5138"; ctx.fillRect(px + 3, py + 11, 2, 4); ctx.fillRect(px + 11, py + 11, 2, 4);
        }
        else if (ch === "K") {
          ctx.fillStyle = "#4a3828"; ctx.fillRect(px + 1, py + 1, 14, 14);
          const bk = ["#8a3030", "#3a5a4a", "#8890c8", "#c9a55c"];
          for (let i = 0; i < 4; i++) { ctx.fillStyle = bk[(i + seed) % 4]; ctx.fillRect(px + 2 + i * 3, py + 3, 2, 4); ctx.fillStyle = bk[(i + seed + 2) % 4]; ctx.fillRect(px + 2 + i * 3, py + 9, 2, 4); }
        }
        else if (ch === "C") {
          ctx.fillStyle = "#6a5540"; ctx.fillRect(px, py + 4, T, 12);
          ctx.fillStyle = "#8a7050"; ctx.fillRect(px, py + 2, T, 4);
        }
        else if (ch === "b") {
          ctx.fillStyle = th.treeTop; ctx.fillRect(px + 2, py + 6, 12, 8); ctx.fillRect(px + 4, py + 4, 8, 3);
          ctx.fillStyle = th.tree; ctx.fillRect(px + 4, py + 8, 2, 2); ctx.fillRect(px + 10, py + 7, 2, 2); ctx.fillRect(px + 7, py + 11, 2, 2);
        }
        else if (ch === "m") {
          const glow = m.theme === "cave" || m.theme === "veil";
          ctx.fillStyle = glow ? "#6ad0c8" : "#a86a5a"; ctx.fillRect(px + 3, py + 9, 4, 3);
          ctx.fillStyle = glow ? "#b06ad0" : "#c4907a"; ctx.fillRect(px + 9, py + 7, 5, 3);
          ctx.fillStyle = "#d8d0b8"; ctx.fillRect(px + 4, py + 12, 2, 3); ctx.fillRect(px + 10, py + 10, 2, 4);
          if (glow) { ctx.fillStyle = "rgba(106,208,200,0.15)"; ctx.fillRect(px + 1, py + 6, 14, 9); }
        }
        else if (ch === "n") {
          ctx.fillStyle = "#ded6bc"; ctx.fillRect(px + 3, py + 10, 5, 2); ctx.fillRect(px + 10, py + 8, 4, 2); ctx.fillRect(px + 7, py + 12, 3, 2);
          ctx.fillStyle = "#b0a88c"; ctx.fillRect(px + 4, py + 11, 2, 1); ctx.fillRect(px + 11, py + 9, 2, 1);
        }
        else if (ch === "l") {
          ctx.fillStyle = "#2a2620"; ctx.fillRect(px + 7, py + 4, 2, 12);
          ctx.fillStyle = "#3a352c"; ctx.fillRect(px + 5, py + 14, 6, 2);
          ctx.fillStyle = "#ffd977"; ctx.fillRect(px + 6, py + 1 + (Math.floor(now / 260) % 2), 4, 4);
          lamps.push([px + 8, py + 3]);
        }
        else if (ch === "s") {
          ctx.fillStyle = "#5a4530"; ctx.fillRect(px + 7, py + 8, 2, 8);
          ctx.fillStyle = "#8a6a48"; ctx.fillRect(px + 2, py + 3, 12, 6);
          ctx.fillStyle = "#5a4530"; ctx.fillRect(px + 4, py + 5, 8, 1); ctx.fillRect(px + 4, py + 7, 6, 1);
        }
        else if (ch === "w") {
          ctx.fillStyle = th.water; ctx.fillRect(px, py, T, T);
          ctx.fillStyle = th.wave;
          ctx.fillRect(px + 2 + seed + wave * 2, py + 5, 6, 1);
          ctx.fillRect(px + 6 - wave * 2, py + 11, 5, 1);
        }
        else if (ch === "=") { ctx.fillStyle = th.fence; ctx.fillRect(px, py + 6, T, 3); ctx.fillRect(px + 2, py + 4, 2, 8); ctx.fillRect(px + 11, py + 4, 2, 8); }
        else if (ch === "h") { ctx.fillStyle = th.wall; ctx.fillRect(px, py, T, T); ctx.fillStyle = th.dot; ctx.fillRect(px + 1, py + 3, 6, 1); ctx.fillRect(px + 8, py + 9, 6, 1); }
        else if (ch === "r") { ctx.fillStyle = th.roof; ctx.fillRect(px, py, T, T); ctx.fillStyle = th.roofD; ctx.fillRect(px, py + 12, T, 4); ctx.fillRect(px + 7, py, 2, T); }
        else if (ch === "d" || ch === "g") {
          ctx.fillStyle = th.wall; ctx.fillRect(px, py, T, T);
          ctx.fillStyle = "#1c150e"; ctx.fillRect(px + 3, py + 3, 10, 13);
          ctx.fillStyle = th.door; ctx.fillRect(px + 4, py + 4, 8, 11);
          ctx.fillStyle = "#1c150e"; ctx.fillRect(px + 10, py + 9, 2, 2);
          if (ch === "g") { ctx.fillStyle = "#e8d44f"; ctx.fillRect(px + 5, py + 1, 6, 2); }
        }
        else if (ch === "c") {
          ctx.fillStyle = th.wall; ctx.fillRect(px + 3, py + 9, 10, 7);
          ctx.fillStyle = th.dot; ctx.fillRect(px + 4, py + 12, 8, 1);
          ctx.fillStyle = "#efe6d0"; ctx.fillRect(px + 7, py + 5, 2, 4);
          ctx.fillStyle = "#ffd977"; ctx.fillRect(px + 7, py + 2 + (Math.floor(now / 300) % 2), 2, 3);
        }
        else if (ch === "X") {
          ctx.fillStyle = th.gate; ctx.fillRect(px, py, T, T);
          ctx.fillStyle = th.gateG; ctx.fillRect(px + 7, py + 2, 2, 12); ctx.fillRect(px + 3, py + 7, 10, 2);
          ctx.fillRect(px + 2, py + 2, 2, 2); ctx.fillRect(px + 12, py + 2, 2, 2);
        }
      }
      // npcs (standing, facing the player's side of the world: down)
      (m.npcs || []).forEach((n, ni) => {
        if (n.trainer === "king" && g.flags.king) return;
        if (n.creature) {
          const s = spriteCanvas("c:" + n.creature, SPR[n.creature].g, SPR[n.creature].pal, false);
          const bob = Math.floor(now / 800 + ni) % 2;
          ctx.drawImage(s, n.x * T, n.y * T + bob * 0.5, 16, 16);
          return;
        }
        const ph = Math.floor(now / 1400 + ni * 3) % 7;
        const grid2 = ph === 5 ? H_S0 : H_D0;
        drawHuman(ctx, grid2, n.pal, n.x * T, n.y * T, ph === 5 && ni % 2 === 0);
      });
      // treasure sparkles
      (m.items || []).forEach((i2) => {
        if (g.picked[g.map + ":" + i2.x + "," + i2.y]) return;
        const cx2 = i2.x * T + 8, cy2 = i2.y * T + 7;
        const p2 = 1.4 + Math.sin(now / 260 + i2.x) * 0.9;
        ctx.fillStyle = "rgba(255,225,140,0.9)";
        ctx.fillRect(cx2 - p2, cy2 - 0.5, p2 * 2, 1); ctx.fillRect(cx2 - 0.5, cy2 - p2, 1, p2 * 2);
        ctx.fillStyle = "#fff6dc"; ctx.fillRect(cx2 - 0.7, cy2 - 0.7, 1.4, 1.4);
      });
      // ambient critters
      (m.amb || []).forEach((a2, ai) => {
        const bx = a2.x * T + 8, by = a2.y * T + 8;
        if (a2.k === "crow") {
          const peck = Math.floor(now / 1600 + ai * 2) % 3 === 0 ? 1.5 : 0;
          ctx.fillStyle = "#16141a";
          ctx.fillRect(bx - 3, by - 1, 5, 3);
          ctx.fillRect(bx + 2, by - 2 + peck, 2, 2);
          ctx.fillRect(bx - 5, by - 2, 2, 2);
          ctx.fillStyle = "#3a3644"; ctx.fillRect(bx - 2, by - 2, 3, 1);
        } else if (a2.k === "wisp") {
          const wx = bx + Math.sin(now / 2600 + ai * 2) * 9;
          const wy = by + Math.sin(now / 700 + ai) * 3;
          const gr2 = ctx.createRadialGradient(wx, wy, 0.5, wx, wy, 6);
          gr2.addColorStop(0, "rgba(180,225,255,0.7)"); gr2.addColorStop(1, "rgba(180,225,255,0)");
          ctx.fillStyle = gr2; ctx.fillRect(wx - 6, wy - 6, 12, 12);
          ctx.fillStyle = "rgba(230,245,255,0.9)"; ctx.fillRect(wx - 1, wy - 1, 2, 2);
        } else if (a2.k === "mote") {
          for (let mi2 = 0; mi2 < 3; mi2++) {
            const my2 = by + 10 - (((now / 40 + mi2 * 33 + ai * 17) % 26));
            const mx2 = bx + Math.sin(now / 500 + mi2 * 2) * 5;
            ctx.fillStyle = `rgba(200,150,230,${0.5 - mi2 * 0.12})`;
            ctx.fillRect(mx2, my2, 1.4, 1.4);
          }
        } else if (a2.k === "bat") {
          const bxx = bx + Math.sin(now / 900 + ai * 3) * 14;
          const byy = by + Math.cos(now / 1200 + ai) * 5;
          const flap = Math.floor(now / 160) % 2 ? 3 : 5;
          ctx.fillStyle = "#100c16";
          ctx.fillRect(bxx - flap, byy, flap, 1.5); ctx.fillRect(bxx + 1, byy, flap, 1.5);
          ctx.fillRect(bxx - 0.5, byy - 0.5, 2, 2);
        }
      });
      // player with directional walk animation
      const fr = Math.floor(now / 140) % 4;
      let grid = H_D0, flip = false;
      if (g.face === "left" || g.face === "right") {
        grid = moving && fr % 2 === 1 ? H_S1 : H_S0;
        flip = g.face === "left";
      } else {
        const stand = g.face === "up" ? H_U0 : H_D0;
        const walk = g.face === "up" ? H_U1 : H_D1;
        grid = moving && fr % 2 === 1 ? walk : stand;
        flip = moving && fr === 3; // alternate stepping foot
      }
      drawHuman(ctx, grid, g.sprite === "f" ? "player_f" : "player", A.x * T, A.y * T, flip);
      // lamp glows
      lamps.forEach(([lx, ly]) => {
        const gl = ctx.createRadialGradient(lx, ly, 2, lx, ly, 30 + Math.sin(now / 300 + lx) * 2);
        gl.addColorStop(0, "rgba(255,217,119,0.16)"); gl.addColorStop(1, "rgba(255,217,119,0)");
        ctx.fillStyle = gl; ctx.fillRect(lx - 34, ly - 34, 68, 68);
      });
      // ---- screen-space overlays from here down ----
      ctx.setTransform(8, 0, 0, 8, 0, 0);
      // weather
      const W_PART = {
        woods: { n: 10, c: "rgba(150,140,110,0.4)", vx: 6, vy: 12 },
        ashgrove: { n: 12, c: "rgba(220,120,60,0.45)", vx: 5, vy: 9 },
        fenmoor: { n: 6, c: "rgba(150,160,120,0.3)", vx: 4, vy: 7, fog: true },
        vesper: { n: 8, c: "rgba(210,205,225,0.3)", vx: 3, vy: 5 },
        palegate: { n: 9, c: "rgba(230,225,215,0.4)", vx: 4, vy: 6 },
        lantern: { n: 6, c: "firefly", vx: 4, vy: 2 },
        town: { n: 6, c: "firefly", vx: 5, vy: 2 },
        mire: { n: 6, c: "rgba(150,140,110,0.3)", vx: 4, vy: 8, fog: true },
        chapel: { n: 8, c: "rgba(200,195,220,0.28)", vx: 3, vy: 5 },
        threshold: { n: 10, c: "rgba(176,106,208,0.5)", vx: 4, vy: -10 },
        veil: { n: 12, c: "rgba(216,152,240,0.5)", vx: 5, vy: -12 },
        cave: { n: 5, c: "rgba(140,160,200,0.2)", vx: 2, vy: 6 },
      };
      const wp = W_PART[m.theme];
      if (wp) {
        if (wp.fog) {
          for (let fi = 0; fi < 3; fi++) {
            const fx = ((fi * 110 + now / 90) % 300) - 55;
            const fy = 28 + fi * 40 + Math.sin(now / 3000 + fi) * 6;
            const fg = ctx.createRadialGradient(fx, fy, 6, fx, fy, 46);
            fg.addColorStop(0, "rgba(180,200,190,0.07)"); fg.addColorStop(1, "rgba(180,200,190,0)");
            ctx.fillStyle = fg; ctx.fillRect(fx - 50, fy - 50, 100, 100);
          }
        }
        for (let pi2 = 0; pi2 < wp.n; pi2++) {
          const t2 = now / 1000;
          const pxx = (((pi2 * 97.3 + t2 * wp.vx * (1 + (pi2 % 3))) % 192) + 192) % 192;
          const pyy = (((pi2 * 53.7 + t2 * wp.vy * (1 + (pi2 % 2))) % 128) + 128) % 128;
          if (wp.c === "firefly") {
            const tw = 0.25 + 0.55 * Math.abs(Math.sin(now / 600 + pi2 * 1.7));
            ctx.fillStyle = `rgba(255,220,130,${tw})`;
            ctx.fillRect(pxx, 64 + Math.sin(now / 1400 + pi2 * 2.4) * 45, 1.6, 1.6);
          } else {
            ctx.fillStyle = wp.c; ctx.fillRect(pxx, pyy, 1.6, 1.6);
          }
        }
      }
      // lantern glow follows the animated position
      const cxp = A.x * T + 8 - camX, cyp = A.y * T + 8 - camY;
      const grd = ctx.createRadialGradient(cxp, cyp, 4, cxp, cyp, 52);
      grd.addColorStop(0, "rgba(255,217,119,0.11)");
      grd.addColorStop(1, "rgba(255,217,119,0)");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, VW, VH);
      const dark = { town: 0.1, woods: 0.18, mire: 0.26, chapel: 0.28, threshold: 0.4, cave: 0.34, veil: 0.3, interior: 0.05, ashgrove: 0.16, fenmoor: 0.24, vesper: 0.24, palegate: 0.12, lantern: 0.44 }[m.theme] || 0.2;
      ctx.fillStyle = `rgba(4,3,8,${dark})`; ctx.fillRect(0, 0, VW, VH);
      const vg = ctx.createRadialGradient(VW / 2, VH / 2, 42, VW / 2, VH / 2, 120);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(2,1,6,0.5)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ============================================================
  // battle engine
  // ============================================================

  const monAb = (mon) => DEX[mon.sp].ab;
  const hasCharm = (mon, id) => mon.charm === id;
  const effSpd = (mon, st) => mon.spd * stageMult(st.spd) * (hasCharm(mon, "swift") ? 1.15 : 1);

  function snap(g, b) {
    const p = g.party[b.pi];
    return {
      ph: Math.max(0, p.hp), pm: p.maxHp, pn: DEX[p.sp].n, plvl: p.lvl, psp: p.sp, pst: p.status, pxp: p.xp, pneed: xpNeed(p.lvl),
      eh: Math.max(0, b.foe.hp), em: b.foe.maxHp, en: DEX[b.foe.sp].n, elvl: b.foe.lvl, esp: b.foe.sp, est: b.eBlight ? "blight" : (b.eFear > 0 ? "fear" : null),
    };
  }
  function say(g, b, t, x) { b.log.push({ t, s: snap(g, b), fx: x?.fx, a: x?.a }); }
  function sayAb(g, b, mon, abId) { say(g, b, `${DEX[mon.sp].n}'s ${ABILITIES[abId].n}!`, { fx: "blip" }); }

  function entryFx(g, b, side) {
    const mon = side === "p" ? g.party[b.pi] : b.foe;
    const ab = monAb(mon);
    if (ab === "palegrace") { sayAb(g, b, mon, ab); applyStages(g, b, side, "self", { spd: 1 }); }
    if (ab === "ambusher")  { sayAb(g, b, mon, ab); applyStages(g, b, side, "self", { atk: 1 }); }
    if (ab === "blackcross"){ sayAb(g, b, mon, ab); applyStages(g, b, side, "foe", { spd: -1 }); }
  }

  function freshBattleSide() { return { atk: 0, def: 0, spd: 0 }; }

  function startWild(g) {
    const enc = MAPS[g.map].enc;
    let roll = Math.random() * 100, sp = enc.table[0][0];
    for (const [id, w] of enc.table) { if (roll < w) { sp = id; break; } roll -= w; }
    const foe = makeMon(sp, rnd(enc.lv[0], enc.lv[1]));
    const pi = g.party.findIndex((p) => p.hp > 0);
    g.battle = {
      kind: "wild", foe, pi, ps: freshBattleSide(), es: freshBattleSide(),
      eBlight: false, eFear: 0, pFear: 0, log: [], li: 0, phase: "msg", over: null, healUsed: false, turn: 0, forced: false,
      pRing: false, eRing: false, pLast: false, eLast: false, pLow: false, eLow: false,
    };
    const rare = sp === "paleling";
    say(g, g.battle, `A wild ${DEX[sp].n} emerges from the dark! (Lv ${foe.lvl})`, { fx: rare ? "bind" : "blip" });
    if (rare) say(g, g.battle, "...something about it is wrong. It is far too pale.");
    entryFx(g, g.battle, "e");
    entryFx(g, g.battle, "p");
  }

  function startTrainer(g, tid) {
    const t = TRAINERS[tid];
    const [sp, lv] = t.team[0];
    const pi = g.party.findIndex((p) => p.hp > 0);
    g.battle = {
      kind: "trainer", trainer: tid, ti: 0, foe: makeMon(sp, lv), pi,
      ps: freshBattleSide(), es: freshBattleSide(),
      eBlight: false, eFear: 0, pFear: 0, log: [], li: 0, phase: "msg", over: null, healUsed: false, turn: 0, forced: false,
      pRing: false, eRing: false, pLast: false, eLast: false, pLow: false, eLow: false,
    };
    say(g, g.battle, `${t.name} calls forth ${DEX[sp].n}! (Lv ${lv})`, { fx: t.boss ? "sting" : "blip" });
    entryFx(g, g.battle, "e");
    entryFx(g, g.battle, "p");
  }

  function calcDmg(mvId, atk, def, atkSt, defSt) {
    const m = MOVES[mvId];
    const A = atk.atk * stageMult(atkSt.atk);
    const D = Math.max(1, def.def * stageMult(defSt.def));
    const base = Math.floor(((2 * atk.lvl / 5 + 2) * m.p * A / D) / 28) + 2;
    const stab = DEX[atk.sp].ty.includes(m.t) ? (hasCharm(atk, "kindred") ? 1.65 : 1.5) : 1;
    const ab = monAb(atk);
    let typeBoost = 1;
    if ((ab === "skulk" && m.t === "shade") || ((ab === "kindled" || ab === "ashenjaw") && m.t === "flame") || (ab === "nightthirst" && m.t === "blood")) typeBoost = 1.15;
    const e = eff(m.t, def.sp);
    let crit = Math.random() < 0.06 + (hasCharm(atk, "cursedeye") ? 0.1 : 0) ? 1.5 : 1;
    if (monAb(def) === "graveloyal") crit = 1;
    let red = 1;
    if (monAb(def) === "boneplate") red *= 0.88;
    if (hasCharm(def, "ironvigil")) red *= 0.9;
    const r = 0.85 + Math.random() * 0.15;
    return { dmg: Math.max(1, Math.floor(base * stab * typeBoost * e * crit * red * r)), e, crit: crit > 1 };
  }

  function applyStages(g, b, who, tgt, deltas) {
    const targetSide = tgt === "self" ? who : (who === "p" ? "e" : "p");
    const stages = targetSide === "p" ? b.ps : b.es;
    const mon = targetSide === "p" ? g.party[b.pi] : b.foe;
    const owner = DEX[mon.sp].n;
    for (const [stat, d] of Object.entries(deltas)) {
      if (d < 0 && monAb(mon) === "voidcrown") { say(g, b, `${owner}'s Void Crown scorns the attempt.`); continue; }
      const before = stages[stat];
      stages[stat] = clamp(stages[stat] + d, -3, 3);
      const word = stat === "atk" ? "Attack" : stat === "def" ? "Defense" : "Speed";
      if (stages[stat] === before) say(g, b, `${owner}'s ${word} can shift no further.`);
      else say(g, b, `${owner}'s ${word} ${d > 0 ? "rises" : "falls"}!`, { fx: "blip" });
    }
  }

  function surviveCheck(g, b, defSide, def) {
    if (def.hp > 0) return;
    const ringKey = defSide === "p" ? "pRing" : "eRing";
    const lastKey = defSide === "p" ? "pLast" : "eLast";
    if (hasCharm(def, "bonering") && !b[ringKey]) {
      b[ringKey] = true; def.hp = 1;
      say(g, b, `${DEX[def.sp].n}'s Bone Ring cracks — it clings to 1 HP!`, { fx: "blip" });
    } else if (monAb(def) === "lastlight" && !b[lastKey]) {
      b[lastKey] = true; def.hp = 1;
      say(g, b, `${DEX[def.sp].n}'s Last Light gutters... but does not go out! 1 HP!`, { fx: "blip" });
    } else {
      def.hp = 0;
    }
  }

  function doMove(g, b, who, mvId) {
    const m = MOVES[mvId];
    const pmon = g.party[b.pi];
    const atk = who === "p" ? pmon : b.foe;
    const def = who === "p" ? b.foe : pmon;
    const defSide = who === "p" ? "e" : "p";
    const name = DEX[atk.sp].n;
    const fearKey = who === "p" ? "pFear" : "eFear";
    if (b[fearKey] > 0) {
      b[fearKey]--;
      if (Math.random() < 0.33) { say(g, b, `${name} is frozen by Fear!`); return; }
      if (b[fearKey] === 0) say(g, b, `${name} shakes off its Fear.`);
    }
    say(g, b, `${name} uses ${m.n}!`, { a: who === "p" ? { p: "lunge" } : { e: "lunge" } });
    if (Math.random() * 100 > m.a) { say(g, b, "...but it slips through the dark and misses!"); return; }
    if (m.p > 0) {
      const res = who === "p"
        ? calcDmg(mvId, atk, def, b.ps, b.es)
        : calcDmg(mvId, atk, def, b.es, b.ps);
      def.hp -= res.dmg;
      surviveCheck(g, b, defSide, def);
      let fx = "";
      if (res.e >= 2) fx = " It's devastating!";
      else if (res.e > 0 && res.e < 1) fx = " It barely bites...";
      if (res.crit) fx = " A vicious strike!" + fx;
      const big = res.crit || res.e >= 2;
      say(g, b, `${DEX[def.sp].n} takes ${res.dmg} damage.${fx}`, { fx: big ? "hitbig" : "hit", a: { [defSide === "p" ? "p" : "e"]: "hit", shake: big } });
      // ability & charm follow-ups
      if (res.crit && def.hp > 0 && monAb(def) === "calcify") { sayAb(g, b, def, "calcify"); applyStages(g, b, defSide, "self", { def: 1 }); }
      if (def.hp > 0 && monAb(def) === "flareup") {
        const lowKey = defSide === "p" ? "pLow" : "eLow";
        if (!b[lowKey] && def.hp < def.maxHp / 2) { b[lowKey] = true; sayAb(g, b, def, "flareup"); applyStages(g, b, defSide, "self", { atk: 1 }); }
      }
      if (def.hp > 0 && monAb(def) === "sorrowdust" && Math.random() < 0.3) { sayAb(g, b, def, "sorrowdust"); applyStages(g, b, defSide, "foe", { atk: -1 }); }
      if (m.fx?.drain && res.dmg > 0) {
        const mult = (monAb(atk) === "leech" || monAb(atk) === "crimsonrite") ? 2 : 1;
        const heal = Math.max(1, Math.floor(res.dmg * m.fx.drain * mult));
        atk.hp = Math.min(atk.maxHp, atk.hp + heal);
        say(g, b, `${name} drinks deep, restoring ${heal} HP.`, { fx: "heal" });
      }
      if (hasCharm(atk, "leechfang") && res.dmg > 0 && atk.hp > 0 && atk.hp < atk.maxHp) {
        const heal = Math.max(1, Math.floor(res.dmg * 0.12));
        atk.hp = Math.min(atk.maxHp, atk.hp + heal);
        say(g, b, `The Leech Fang sips ${heal} HP.`, { fx: "heal" });
      }
      if (def.hp > 0 && m.fx?.blight && Math.random() < m.fx.blight) inflictBlight(g, b, defSide);
      if (def.hp > 0 && monAb(atk) === "hexweaver" && Math.random() < 0.15) { sayAb(g, b, atk, "hexweaver"); inflictBlight(g, b, defSide); }
      if (def.hp > 0 && m.fx?.fear && Math.random() < m.fx.fear) inflictFear(g, b, defSide);
    } else if (m.fx) {
      if (m.fx.self) applyStages(g, b, who, "self", m.fx.self);
      if (m.fx.foe) applyStages(g, b, who, "foe", m.fx.foe);
      if (m.fx.blightSure) inflictBlight(g, b, defSide);
    }
  }

  function inflictBlight(g, b, side) {
    const mon = side === "p" ? g.party[b.pi] : b.foe;
    if (monAb(mon) === "tidybones") { say(g, b, `${DEX[mon.sp].n}'s Tidy Bones shrug off the Blight.`); return; }
    if (side === "e") { if (!b.eBlight) { b.eBlight = true; say(g, b, `${DEX[mon.sp].n} is seized by Blight!`, { fx: "blip" }); } }
    else { if (mon.status !== "blight") { mon.status = "blight"; say(g, b, `${DEX[mon.sp].n} is seized by Blight!`, { fx: "blip" }); } }
  }
  function inflictFear(g, b, side) {
    const mon = side === "p" ? g.party[b.pi] : b.foe;
    const ab = monAb(mon);
    if (ab === "veilborn" || ab === "hymnward") { say(g, b, `${DEX[mon.sp].n} does not know how to be afraid.`); return; }
    const key = side === "p" ? "pFear" : "eFear";
    if (b[key] <= 0) { b[key] = 3; say(g, b, `${DEX[mon.sp].n} trembles with Fear!`, { fx: "blip" }); }
  }

  function endOfTurn(g, b) {
    const p = g.party[b.pi];
    if (p.hp > 0 && p.status === "blight") {
      p.hp -= Math.max(1, Math.floor(p.maxHp / 8));
      surviveCheck(g, b, "p", p);
      say(g, b, `${DEX[p.sp].n} is wracked by Blight.`, { a: { p: "hit" } });
    }
    if (b.foe.hp > 0 && b.eBlight) {
      b.foe.hp -= Math.max(1, Math.floor(b.foe.maxHp / 8));
      surviveCheck(g, b, "e", b.foe);
      say(g, b, `${DEX[b.foe.sp].n} is wracked by Blight.`, { a: { e: "hit" } });
    }
  }

  function pickFoeMove(g, b) {
    const t = b.kind === "trainer" ? TRAINERS[b.trainer] : null;
    const moves = b.foe.moves;
    if (t?.healer && b.foe.sp === "nihilim" && b.foe.hp < b.foe.maxHp * 0.4 && !b.healUsed) return "__heal";
    if (!t) return moves[rnd(0, moves.length - 1)];
    const statusMoves = moves.filter((m) => MOVES[m].p === 0);
    if (b.turn <= 2 && statusMoves.length && Math.random() < 0.35) return statusMoves[rnd(0, statusMoves.length - 1)];
    let best = moves[0], bestScore = -1;
    for (const m of moves) {
      const mv = MOVES[m];
      if (mv.p === 0) continue;
      const score = mv.p * eff(mv.t, g.party[b.pi].sp) * (DEX[b.foe.sp].ty.includes(mv.t) ? 1.5 : 1) * (0.9 + Math.random() * 0.2);
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  function foeAct(g, b) {
    if (b.foe.hp <= 0 || g.party[b.pi].hp <= 0) return;
    const mv = pickFoeMove(g, b);
    if (mv === "__heal") {
      b.healUsed = true;
      b.foe.hp = Math.min(b.foe.maxHp, b.foe.hp + Math.floor(b.foe.maxHp * 0.5));
      say(g, b, "The Hollow King murmurs a hymn of un-making...", { fx: "sting" });
      say(g, b, `${DEX[b.foe.sp].n} knits itself back together!`, { fx: "heal" });
      return;
    }
    doMove(g, b, "e", mv);
  }

  function tryLearn(g, b, p, mv) {
    if (p.moves.includes(mv)) return;
    if (p.moves.length < 4) {
      p.moves.push(mv);
      say(g, b, `${DEX[p.sp].n} learned ${MOVES[mv].n}!`, { fx: "level" });
    } else {
      say(g, b, `${DEX[p.sp].n} yearns to learn ${MOVES[mv].n}... (choose after battle)`);
      g.learnQueue.push({ pi: g.party.indexOf(p), mv });
    }
  }

  function awardXpAndCheckFoe(g, b) {
    if (b.foe.hp > 0) return false;
    const isTrainer = b.kind === "trainer";
    say(g, b, `${DEX[b.foe.sp].n} dissolves back through the Veil!`, { fx: "faint" });
    const p = g.party[b.pi];
    const gain = Math.floor(b.foe.lvl * 14 * (isTrainer ? 1.6 : 1));
    say(g, b, `${DEX[p.sp].n} gains ${gain} experience.`);
    p.xp += gain;
    while (p.xp >= xpNeed(p.lvl)) {
      p.xp -= xpNeed(p.lvl);
      p.lvl++;
      const ns = statsFor(p.sp, p.lvl);
      p.hp = Math.min(ns.maxHp, p.hp + (ns.maxHp - p.maxHp));
      Object.assign(p, { maxHp: ns.maxHp, atk: ns.atk, def: ns.def, spd: ns.spd });
      say(g, b, `${DEX[p.sp].n} grew to Lv ${p.lvl}!`, { fx: "level" });
      DEX[p.sp].learn.filter(([l]) => l === p.lvl).forEach(([, mv]) => tryLearn(g, b, p, mv));
      const evo = DEX[p.sp].evo;
      if (evo && p.lvl >= evo[1]) {
        const oldName = DEX[p.sp].n;
        p.sp = evo[0];
        g.bound[p.sp] = true;
        const es = statsFor(p.sp, p.lvl);
        p.hp = Math.min(es.maxHp, p.hp + (es.maxHp - p.maxHp));
        Object.assign(p, { maxHp: es.maxHp, atk: es.atk, def: es.def, spd: es.spd });
        say(g, b, `The Veil shudders... ${oldName} has become ${DEX[p.sp].n}!`, { fx: "bind" });
        DEX[p.sp].learn.filter(([l]) => l === p.lvl).forEach(([, mv]) => tryLearn(g, b, p, mv));
      }
    }
    if (isTrainer) {
      const t = TRAINERS[b.trainer];
      if (b.ti < t.team.length - 1) {
        b.ti++;
        const [sp, lv] = t.team[b.ti];
        b.foe = makeMon(sp, lv);
        b.es = freshBattleSide(); b.eBlight = false; b.eFear = 0; b.eRing = false; b.eLast = false; b.eLow = false;
        say(g, b, `${t.name} calls forth ${DEX[sp].n}! (Lv ${lv})`, { fx: t.boss ? "sting" : "blip" });
        entryFx(g, b, "e");
        return false;
      }
      g.flags[t.flag] = true;
      g.embers += t.reward;
      say(g, b, `${t.name} is defeated!`, { fx: "level" });
      say(g, b, `You are paid ${t.reward} embers.`);
      if (t.seal) { g.seals.push(t.seal); say(g, b, `You received the ${t.seal}! A gate somewhere unseals.`, { fx: "bind" }); }
      b.over = b.trainer === "king" ? "ending" : "win";
      return true;
    }
    g.embers += b.foe.lvl * 4;
    say(g, b, `You gather ${b.foe.lvl * 4} embers from the residue.`);
    b.over = "win";
    return true;
  }

  function checkPlayerFaint(g, b) {
    const p = g.party[b.pi];
    if (p.hp > 0) return false;
    p.status = null;
    say(g, b, `${DEX[p.sp].n} collapses!`, { fx: "faint" });
    if (g.party.some((x) => x.hp > 0)) { b.forced = true; }
    else { say(g, b, "Darkness closes in around you..."); b.over = "lose"; }
    return true;
  }

  function doForcedSwitch(g, i) {
    const b = g.battle;
    b.pi = i; b.ps = freshBattleSide(); b.pFear = 0; b.pRing = false; b.pLast = false; b.pLow = false; b.forced = false;
    b.log = []; b.li = 0;
    say(g, b, `${DEX[g.party[i].sp].n}, into the dark!`, { fx: "blip" });
    entryFx(g, b, "p");
    b.phase = "msg";
  }

  function doAction(g, action) {
    const b = g.battle;
    if (!b || b.phase === "msg") return;
    b.log = []; b.li = 0; b.forced = false; b.turn++;
    const p = g.party[b.pi];

    if (action.type === "flee") {
      const chance = clamp(0.55 + (effSpd(p, b.ps) - effSpd(b.foe, b.es)) / 200, 0.2, 0.95);
      if (Math.random() < chance) { say(g, b, "You slip away into the dark."); b.over = "fled"; }
      else { say(g, b, "The dark refuses to let you go!"); foeAct(g, b); if (!checkPlayerFaint(g, b)) { endOfTurn(g, b); awardXpAndCheckFoe(g, b); checkPlayerFaint(g, b); } }
      b.phase = "msg"; return;
    }
    if (action.type === "switch") {
      say(g, b, `${DEX[p.sp].n}, fall back!`);
      b.pi = action.i; b.ps = freshBattleSide(); b.pFear = 0; b.pRing = false; b.pLast = false; b.pLow = false;
      say(g, b, `${DEX[g.party[b.pi].sp].n}, into the dark!`, { fx: "blip" });
      entryFx(g, b, "p");
      foeAct(g, b); checkPlayerFaint(g, b);
      if (!b.over && !b.forced) { endOfTurn(g, b); awardXpAndCheckFoe(g, b); checkPlayerFaint(g, b); }
      b.phase = "msg"; return;
    }
    if (action.type === "item") {
      const it = ITEMS[action.id];
      if (it.bind) {
        g.bag[action.id]--;
        say(g, b, `You cast the ${it.n}!`);
        const hpFrac = b.foe.hp / b.foe.maxHp;
        const chance = clamp(DEX[b.foe.sp].cr * (1 - 0.72 * hpFrac) * it.bind + ((b.eBlight || b.eFear > 0) ? 0.12 : 0), 0.03, 0.95);
        if (Math.random() < chance) {
          say(g, b, `The sigil flares... and holds. ${DEX[b.foe.sp].n} is bound!`, { fx: "bind" });
          g.bound[b.foe.sp] = true;
          b.foe.status = b.eBlight ? "blight" : null;
          g.party.push(b.foe);
          b.over = "caught";
        } else {
          say(g, b, "The sigil shatters! It refuses the binding!");
          foeAct(g, b);
          if (!checkPlayerFaint(g, b)) { endOfTurn(g, b); awardXpAndCheckFoe(g, b); checkPlayerFaint(g, b); }
        }
      } else {
        g.bag[action.id]--;
        if (it.heal) { p.hp = Math.min(p.maxHp, p.hp + it.heal); say(g, b, `${DEX[p.sp].n} is soothed by the ${it.n}. (+${it.heal} HP)`, { fx: "heal" }); }
        if (it.cure) { p.status = null; b.pFear = 0; say(g, b, `The ${it.n} burns away every affliction.`, { fx: "heal" }); }
        foeAct(g, b); checkPlayerFaint(g, b);
        if (!b.over && !b.forced) { endOfTurn(g, b); awardXpAndCheckFoe(g, b); checkPlayerFaint(g, b); }
      }
      b.phase = "msg"; return;
    }
    const mv = action.mv;
    const pFirst = effSpd(p, b.ps) >= effSpd(b.foe, b.es);
    const seq = pFirst ? ["p", "e"] : ["e", "p"];
    for (const who of seq) {
      if (b.over || b.forced) break;
      if (who === "p") {
        if (p.hp <= 0) continue;
        doMove(g, b, "p", mv);
        if (awardXpAndCheckFoe(g, b)) break;
      } else {
        if (b.foe.hp <= 0) continue;
        foeAct(g, b);
        if (checkPlayerFaint(g, b)) break;
      }
    }
    if (!b.over && !b.forced) {
      endOfTurn(g, b);
      awardXpAndCheckFoe(g, b);
      checkPlayerFaint(g, b);
    }
    b.phase = "msg";
  }

  function advanceBattle(g) {
    const b = g.battle;
    if (!b) return;
    if (b.phase !== "msg") return;
    if (b.li < b.log.length - 1) { b.li++; return; }
    if (b.over) {
      if (b.over === "lose") {
        g.battle = null;
        g.map = "town"; g.x = 11; g.y = 13;
        g.party.forEach((m) => { const s = statsFor(m.sp, m.lvl); m.hp = s.maxHp; m.status = null; });
        g.embers = Math.floor(g.embers / 2);
        startDialog(g, ["You wake on the cold floor of the Vigil Hall.", "Half your embers are gone. The keepers say you were carried back by something with too many hands.", "It was, they insist, very gentle."]);
      } else if (b.over === "ending") {
        const t = TRAINERS.king;
        g.battle = null;
        startDialog(g, t.post.concat(["The crown clatters on stone. The dark behind the Veil recoils —", "— and somewhere far south, in Hollow Vale, a flame relights itself."]), { type: "ending" }, t.name);
      } else {
        g.battle = null;
      }
      return;
    }
    if (b.forced) { b.phase = "party"; return; }
    b.phase = "menu";
  }

  // ============================================================
  // small render components
  // ============================================================

  function Px({ spId, size = 96, flip = false }) {
    const ref = useRef(null);
    useEffect(() => {
      const cv = ref.current; if (!cv) return;
      const s = spriteCanvas("c:" + spId, SPR[spId].g, SPR[spId].pal, flip);
      cv.width = s.width; cv.height = s.height;
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, s.width, s.height);
      ctx.drawImage(s, 0, 0);
    }, [spId, flip]);
    return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated" }} />;
  }

  function HumanPx({ pal, palKey, size = 64 }) {
    const ref = useRef(null);
    useEffect(() => {
      const cv = ref.current; if (!cv) return;
      const s = spriteCanvas("hp:" + palKey, H_D0, pal, false);
      cv.width = s.width; cv.height = s.height;
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, s.width, s.height);
      ctx.drawImage(s, 0, 0);
    }, [pal, palKey]);
    return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated" }} />;
  }

  function MenuMap() {
    const ref = useRef(null);
    useEffect(() => {
      const cv = ref.current; if (!cv) return;
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#0d0b14"; ctx.fillRect(0, 0, 380, 420);
      const SPINE = ["town","oldroad","ashgrove","woods1","woods2","fenmoor","mire1","mire2","vesperrest","chapel","palegate","underveil","lastlantern","threshold","court","behindveil"];
      const POS = {}; SPINE.forEach((k, i) => { POS[k] = [70, 372 - i * 23]; });
      const DETOUR = { orchard: ["woods1", -1], hamlet: ["mire1", 1], gravemarch: ["hamlet", 1], shallows: ["chapel", 1] };
      Object.entries(DETOUR).forEach(([k, [anchor, dir]]) => { const a = POS[anchor] || POS.town; POS[k] = [a[0] + dir * 150, a[1]]; });
      const LINKS = []; for (let i = 0; i < SPINE.length - 1; i++) LINKS.push([SPINE[i], SPINE[i+1]]); Object.entries(DETOUR).forEach(([k, [a]]) => LINKS.push([a, k]));
      const BOSS = { ashgrove: "ash", fenmoor: "sol", vesperrest: "choir", palegate: "paleknight", lastlantern: "hand", court: "king" };
      ctx.strokeStyle = "#3a3448"; ctx.lineWidth = 2;
      LINKS.forEach(([a, b]) => {
        if (!G.visited[a] || !G.visited[b]) return;
        const A = POS[a], B = POS[b];
        ctx.beginPath(); ctx.moveTo(A[0] + 30, A[1] + 10); ctx.lineTo(B[0] + 30, B[1] + 10); ctx.stroke();
      });
      const tileColor = (th, ch) =>
        ch === "#" ? th.treeTop : ch === "w" ? th.water : ch === "," ? th.path : ch === "t" ? th.tall :
        (ch === "h" || ch === "r") ? th.roof : ch === "X" ? th.gateG : ch === "=" ? th.fence :
        (ch === "d" || ch === "g" || ch === "c") ? th.door : ch === "G" ? th.wall : (ch === "B" || ch === "T" || ch === "K" || ch === "C") ? th.roof : ch === "u" ? th.path : ch === "b" ? th.treeTop : (ch === "l" || ch === "s") ? th.door : th.ground;
      for (const [id, [px, py]] of Object.entries(POS)) {
        const m = MAPS[id];
        if (!G.visited[id]) {
          ctx.fillStyle = "#14111c"; ctx.fillRect(px, py, 60, 20);
          ctx.strokeStyle = "#2a2536"; ctx.strokeRect(px + 0.5, py + 0.5, 59, 19);
          ctx.fillStyle = "#4a4458"; ctx.font = "7px monospace"; ctx.fillText("???", px + 24, py + 13);
          continue;
        }
        const th = THEMES[m.theme];
        const MW2 = m.grid[0].length, MH2 = m.grid.length, tw = 60 / MW2, th2 = 20 / MH2;
        for (let y = 0; y < MH2; y++) for (let x = 0; x < MW2; x++) {
          ctx.fillStyle = tileColor(th, m.grid[y][x]); ctx.fillRect(px + x * tw, py + y * th2, tw, th2);
        }
        ctx.strokeStyle = "#6a6050"; ctx.strokeRect(px + 0.5, py + 0.5, 59, 19);
        ctx.fillStyle = "#b0a894"; ctx.font = "7px monospace";
        ctx.fillText(m.name.split(" — ")[0].slice(0, 16), px, py + 28);
        if (BOSS[id]) {
          ctx.fillStyle = G.flags[TRAINERS[BOSS[id]].flag] ? "#c9a55c" : "#e04545";
          ctx.fillRect(px + 53, py + 2, 5, 5);
        }
        if (G.map === id) {
          ctx.fillStyle = "#ffd977";
          ctx.fillRect(px + G.x * 2.5 - 1, py + G.y * 1.25 - 1, 4, 4);
        }
      }
      ctx.font = "7px monospace";
      ctx.fillStyle = "#ffd977"; ctx.fillRect(250, 388, 4, 4);
      ctx.fillStyle = "#8a8070"; ctx.fillText("you", 258, 394);
      ctx.fillStyle = "#e04545"; ctx.fillRect(250, 400, 4, 4);
      ctx.fillStyle = "#8a8070"; ctx.fillText("guard waits", 258, 406);
      ctx.fillStyle = "#c9a55c"; ctx.fillRect(250, 412, 4, 4);
      ctx.fillStyle = "#8a8070"; ctx.fillText("guard beaten", 258, 418);
    }, [G.map, G.x, G.y, G.visited, G.flags, G.menu]);
    return <canvas ref={ref} width={380} height={420} style={{ width: "100%", maxWidth: 380, imageRendering: "pixelated", display: "block", margin: "0 auto" }} />;
  }

  function HpBar({ hp, max }) {
    const f = clamp(hp / max, 0, 1);
    return (
      <div className="pv-hpbar"><div style={{ width: f * 100 + "%", background: f > 0.5 ? "#7ec87e" : f > 0.2 ? "#d8c85a" : "#d85a5a" }} /></div>
    );
  }
  function TypeChips({ spId }) {
    return <span>{DEX[spId].ty.map((t) => <span key={t} className="pv-type" style={{ background: TYPES[t].c }}>{TYPES[t].n}</span>)}</span>;
  }

  // ============================================================
  // render
  // ============================================================

  const b = G.battle;
  const cur = b && b.phase === "msg" ? b.log[b.li] : null;
  const bs = cur ? cur.s : b ? snap(G, b) : null;
  const themeKey = MAPS[G.map].theme;
  const battleBg = {
    town: "linear-gradient(#20242c,#161a20)", woods: "linear-gradient(#1c2418,#10160e)",
    mire: "linear-gradient(#182016,#0c120c)", chapel: "linear-gradient(#201e26,#131118)",
    threshold: "linear-gradient(#1a1226,#0c0814)",
  }[themeKey];

  const showGate = isTouch && (!entered || portrait);

  return (
    <div className="pv-root">
      <style>{PV_CSS}</style>

      {showGate ? (
        /* On touch devices the game is fully hidden until the player taps to enter. */
        <div className="pv-gate" onClick={enterMobile}>
          <div className="pv-gate-icon">{portrait ? "↻" : "✦"}</div>
          <div className="pv-gate-title">{portrait ? "ROTATE TO LANDSCAPE" : "PALE VIGIL"}</div>
          <div className="pv-gate-sub">{portrait ? "Pale Vigil is played sideways — turn your device, then tap." : "Best played in landscape. Tap to begin."}</div>
          <button className="pv-btn pv-gate-btn">ENTER</button>
        </div>
      ) : (
      <>
      {/* ---------- TITLE ---------- */}
      {G.screen === "title" && (
        <div className="pv-title">
          <div className="pv-title-sigil">✦</div>
          <h1>PALE VIGIL</h1>
          <p className="pv-sub">The Flame is out. The Veil is thin.<br />Bind what comes through.</p>
          <button className="pv-btn pv-begin" onClick={() => act((g) => beginGame(g))}>BEGIN THE VIGIL</button>
          <p className="pv-controls">move: WASD / arrow keys / the on-screen stick (hold to walk) · advance: Space, Enter, or tap<br />walk into people to speak with them</p>
        </div>
      )}

      {/* ---------- SETUP ---------- */}
      {G.screen === "setup" && (
        <div className="pv-title">
          <h1 style={{ fontSize: 26 }}>THE VIGIL CALLS</h1>
          <p className="pv-sub">What do they call you, Warden?</p>
          <input className="pv-name" maxLength={12} value={nameIn} placeholder="your name"
            onChange={(e) => setNameIn(e.target.value)} />
          <p className="pv-sub" style={{ marginTop: 22 }}>And who walks into the dark?</p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <button className={"pv-starter" + (genderIn === "m" ? " pv-picked" : "")} style={{ width: 120 }} onClick={() => setGenderIn("m")}>
              <HumanPx pal={HUMAN_PALS.player} palKey="player" size={64} />
              <div className="pv-starter-name">BOY</div>
            </button>
            <button className={"pv-starter" + (genderIn === "f" ? " pv-picked" : "")} style={{ width: 120 }} onClick={() => setGenderIn("f")}>
              <HumanPx pal={HUMAN_PALS.player_f} palKey="player_f" size={64} />
              <div className="pv-starter-name">GIRL</div>
            </button>
          </div>
          <button className="pv-btn pv-begin" onClick={() => act((g) => startAdventure(g, nameIn, genderIn))}>STEP INTO HOLLOW VALE</button>
        </div>
      )}

      {/* ---------- ENDING ---------- */}
      {G.ending && (
        <div className="pv-ending">
          <h1>THE VIGIL BURNS</h1>
          <p>The Hollow King is undone. The Threshold stands empty.</p>
          <p>In Hollow Vale the flame climbs high and gold, and for the first time in three nights, nobody dreams.</p>
          <p>Elder Maren does not say thank you. She says something better:</p>
          <p className="pv-quote">"Get some sleep, {G.name || "Warden"}."</p>
          <div className="pv-end-party">
            {G.party.map((m, i) => <div key={i} className="pv-end-mon"><Px spId={m.sp} size={64} /><div>{DEX[m.sp].n}<br />Lv {m.lvl}</div></div>)}
          </div>
          <p className="pv-dim">Species bound: {Object.keys(G.bound).length} / {Object.keys(DEX).length - 1}</p>
          <button className="pv-btn" onClick={() => act((g) => { g.ending = false; })}>KEEP WANDERING</button>
        </div>
      )}

      {/* ---------- WORLD ---------- */}
      {G.screen === "world" && !b && !G.ending && (
        <div className="pv-world">
          <div className="pv-hud">
            <span>{MAPS[G.map].name}</span>
            <span className="pv-hud-right">
              <span className="pv-embers">✦ {G.embers}</span>
              <button className="pv-btn pv-small" onClick={toggleSound}>{G.sound ? "♪ ON" : "♪ OFF"}</button>
              <button className="pv-btn pv-small" onClick={() => act((g) => { g.menu = "party"; })}>MENU</button>
            </span>
          </div>
          <canvas ref={canvasRef} width={1536} height={1024} className="pv-canvas"
            onClick={() => act((g) => { if (g.dialog) advanceDialog(g); })} />

          {/* touch joystick — only while the overworld is interactive */}
          {!G.dialog && !G.menu && !G.shop && !G.starterPick && !G.saveIO && !(G.learnQueue && G.learnQueue.length) && (
            <div className="pv-joy" ref={joyElRef}
              onPointerDown={joyStart} onPointerMove={joyMove}
              onPointerUp={joyEnd} onPointerCancel={joyEnd}
              onContextMenu={(e) => e.preventDefault()}>
              <span className="pv-joy-ring" />
              <span className="pv-joy-knob" style={joyKnob ? { transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` } : undefined} />
            </div>
          )}

          {/* dialog box */}
          {G.dialog && (
            <div className="pv-dialog" onClick={() => act((g) => advanceDialog(g))}>
              {G.dialog.speaker && <div className="pv-speaker">{G.dialog.speaker}</div>}
              <div>{G.dialog.lines[G.dialog.i]}</div>
              <div className="pv-more">▼</div>
            </div>
          )}

          {/* starter pick */}
          {G.starterPick && (
            <div className="pv-overlay">
              <h2>Choose your companion</h2>
              <div className="pv-starter-row">
                {STARTERS.map((sp) => (
                  <button key={sp} className="pv-starter" onClick={() => act((g) => pickStarter(g, sp))}>
                    <Px spId={sp} size={80} />
                    <div className="pv-starter-name">{DEX[sp].n}</div>
                    <TypeChips spId={sp} />
                    <div className="pv-dex">{DEX[sp].dx}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* move learning */}
          {G.learnQueue && G.learnQueue.length > 0 && (() => {
            const q = G.learnQueue[0];
            const mon = G.party[q.pi];
            if (!mon) return null;
            const nm = MOVES[q.mv];
            return (
              <div className="pv-overlay">
                <h2>{DEX[mon.sp].n} yearns to learn {nm.n}</h2>
                <p className="pv-dim"><span className="pv-type" style={{ background: TYPES[nm.t].c }}>{TYPES[nm.t].n}</span> {nm.p > 0 ? `PWR ${nm.p} · ACC ${nm.a}` : nm.d} — but it already knows four moves. Forget one?</p>
                {mon.moves.map((mv, mi) => (
                  <button key={mv} className="pv-row" onClick={() => act((g) => {
                    const qq = g.learnQueue.shift();
                    g.party[qq.pi].moves[mi] = qq.mv;
                  })}>
                    <span>Forget {MOVES[mv].n}</span>
                    <span className="pv-dim"><span className="pv-type" style={{ background: TYPES[MOVES[mv].t].c }}>{TYPES[MOVES[mv].t].n}</span> {MOVES[mv].p > 0 ? `PWR ${MOVES[mv].p}` : MOVES[mv].d}</span>
                  </button>
                ))}
                <button className="pv-btn" onClick={() => act((g) => { g.learnQueue.shift(); })}>KEEP OLD MOVES (skip {nm.n})</button>
              </div>
            );
          })()}

          {/* shop */}
          {G.shop && (
            <div className="pv-overlay">
              <h2>The Ember Exchange</h2>
              <p className="pv-dim">"Everything's cheap. Nobody expects to need change."</p>
              <p className="pv-embers">Your embers: ✦ {G.embers}</p>
              {SHOP_STOCK.map((id) => (
                <button key={id} className="pv-row" disabled={G.embers < ITEMS[id].price} onClick={() => act((g) => buyItem(g, id))}>
                  <span>{ITEMS[id].n} <span className="pv-dim">— {ITEMS[id].d} (have {G.bag[id] || 0})</span></span>
                  <span className="pv-embers">✦ {ITEMS[id].price}</span>
                </button>
              ))}
              <button className="pv-btn" onClick={() => act((g) => { g.shop = false; })}>LEAVE</button>
            </div>
          )}

          {/* menu */}
          {G.menu && (
            <div className="pv-overlay">
              <div className="pv-tabs">
                {["party", "bag", "map", "save"].map((t) => (
                  <button key={t} className={"pv-tab" + (G.menu === t ? " on" : "")} onClick={() => act((g) => { g.menu = t; })}>{t.toUpperCase()}</button>
                ))}
                <button className="pv-tab" onClick={() => act((g) => { g.menu = null; g.saveIO = null; })}>CLOSE</button>
              </div>
              {G.menu === "party" && (
                <div>
                  {G.party.length === 0 && <p className="pv-dim">You carry no Dreads yet.</p>}
                  {G.party.map((m, i) => (
                    <div key={i} className="pv-row pv-mon-row">
                      <Px spId={m.sp} size={48} />
                      <div className="pv-mon-info">
                        <div>{DEX[m.sp].n} <span className="pv-dim">Lv {m.lvl}</span> <TypeChips spId={m.sp} /> {m.status && <span className="pv-status">BLIGHT</span>}</div>
                        <HpBar hp={m.hp} max={m.maxHp} />
                        <div className="pv-dim">{Math.max(0, m.hp)}/{m.maxHp} HP · XP {m.xp}/{xpNeed(m.lvl)} · {m.moves.map((mv) => MOVES[mv].n).join(", ")}</div>
                        <div className="pv-dim">Ability: {ABILITIES[DEX[m.sp].ab].n} — {ABILITIES[DEX[m.sp].ab].d}</div>
                        <div className="pv-dim">Charm: {m.charm ? ITEMS[m.charm].n : "none"}
                          {m.charm && <button className="pv-btn pv-small" onClick={() => act((g) => { g.bag[g.party[i].charm] = (g.bag[g.party[i].charm] || 0) + 1; g.party[i].charm = null; })}>REMOVE</button>}
                          {CHARM_IDS.filter((c) => (G.bag[c] || 0) > 0).map((c) => (
                            <button key={c} className="pv-btn pv-small" onClick={() => act((g) => {
                              const mon = g.party[i];
                              if (mon.charm) g.bag[mon.charm] = (g.bag[mon.charm] || 0) + 1;
                              g.bag[c]--; mon.charm = c;
                            })}>{ITEMS[c].n}</button>
                          ))}
                        </div>
                        <div className="pv-heal-row">
                          {["salve", "gsalve", "incense"].map((it) => (
                            (G.bag[it] || 0) > 0 && <button key={it} className="pv-btn pv-small" onClick={() => act((g) => useItemWorld(g, it, i))}>{ITEMS[it].n} ({G.bag[it]})</button>
                          ))}
                          {i > 0 && <button className="pv-btn pv-small" onClick={() => act((g) => { const t = g.party[i]; g.party[i] = g.party[0]; g.party[0] = t; })}>LEAD</button>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="pv-dim">Warden {G.name || "?"} · Species bound: {Object.keys(G.bound).length}/{Object.keys(DEX).length - 1} · Seals: {G.seals.length ? G.seals.join(", ") : "none"}</p>
                </div>
              )}
              {G.menu === "bag" && (
                <div>
                  {Object.entries(G.bag).filter(([, n]) => n > 0).map(([id, n]) => (
                    <div key={id} className="pv-row"><span>{ITEMS[id].n} ×{n}</span><span className="pv-dim">{ITEMS[id].d}</span></div>
                  ))}
                  <p className="pv-dim">Healing items are used from the PARTY tab. Sigils are cast in battle.</p>
                </div>
              )}
              {G.menu === "map" && (
                <div>
                  <MenuMap />
                  <p className="pv-dim" style={{ textAlign: "center" }}>Unvisited regions appear as ??? until you set foot in them.</p>
                </div>
              )}
              {G.menu === "save" && (
                <div>
                  <p className="pv-dim">This world can't keep saves between visits — copy this sigil somewhere safe, and paste it back to resume.</p>
                  <button className="pv-btn" onClick={() => act((g) => { g.saveIO = "export"; })}>EXPORT SAVE SIGIL</button>
                  <button className="pv-btn" onClick={() => act((g) => { g.saveIO = "import"; })}>IMPORT SAVE SIGIL</button>
                  {G.saveIO === "export" && <textarea className="pv-ta" readOnly value={exportSave(G)} onFocus={(e) => e.target.select()} />}
                  {G.saveIO === "import" && (
                    <div>
                      <textarea className="pv-ta" ref={importRef} placeholder="paste your save sigil here" />
                      <button className="pv-btn" onClick={() => { const v = importRef.current?.value || ""; act((g) => { importSave(g, v); g.menu = null; g.saveIO = null; }); }}>RESTORE</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- BATTLE ---------- */}
      {b && bs && (
        <div className="pv-battle" style={{ background: battleBg }}>
          <button className="pv-btn pv-small pv-sndfloat" onClick={toggleSound}>{G.sound ? "♪ ON" : "♪ OFF"}</button>
          <div className={"pv-arena" + (cur && cur.a && cur.a.shake ? " pv-shakeA" : "")} key={cur && cur.a && cur.a.shake ? "sh" + b.li : "arena"}>
            <div className="pv-foe-panel pv-panel">
              <div>{bs.en} <span className="pv-dim">Lv {bs.elvl}</span> {bs.est && <span className="pv-status">{bs.est.toUpperCase()}</span>}</div>
              <HpBar hp={bs.eh} max={bs.em} />
              <TypeChips spId={bs.esp} />
            </div>
            <div className="pv-foe-spr" style={{ opacity: bs.eh > 0 ? 1 : 0, transition: "opacity 0.7s ease" }}>
              <div key={"es" + b.li} className={cur && cur.a && cur.a.e ? "pv-anim-" + cur.a.e + "-e" : ""}>
                <div className="pv-idle"><Px spId={bs.esp} size={126} /></div>
                {cur && cur.a && cur.a.e === "hit" && <div key={"ef" + b.li} className="pv-hitflash" />}
              </div>
            </div>
            <div className="pv-me-spr" style={{ opacity: bs.ph > 0 ? 1 : 0, transition: "opacity 0.7s ease" }}>
              <div key={"ps" + b.li} className={cur && cur.a && cur.a.p ? "pv-anim-" + cur.a.p + "-p" : ""}>
                <div className="pv-idle pv-idle2"><Px spId={bs.psp} size={126} flip /></div>
                {cur && cur.a && cur.a.p === "hit" && <div key={"pf" + b.li} className="pv-hitflash" />}
              </div>
            </div>
            <div className="pv-me-panel pv-panel">
              <div>{bs.pn} <span className="pv-dim">Lv {bs.plvl}</span> {bs.pst && <span className="pv-status">{String(bs.pst).toUpperCase()}</span>}</div>
              <HpBar hp={bs.ph} max={bs.pm} />
              <div className="pv-dim">{bs.ph}/{bs.pm} HP</div>
              <div className="pv-xpbar"><div style={{ width: clamp((bs.pxp / bs.pneed) * 100, 0, 100) + "%" }} /></div>
            </div>
          </div>

          <div className="pv-msgbox" onClick={() => act((g) => advanceBattle(g))}>
            {b.phase === "msg" && cur && <div>{cur.t}<span className="pv-more">▼</span></div>}

            {b.phase === "menu" && (
              <div className="pv-actions">
                <button className="pv-btn" onClick={() => act((g) => { g.battle.phase = "moves"; })}>FIGHT</button>
                <button className="pv-btn" onClick={() => act((g) => { g.battle.phase = "party"; })}>DREADS</button>
                <button className="pv-btn" onClick={() => act((g) => { g.battle.phase = "bag"; })}>BAG</button>
                <button className="pv-btn" disabled={b.kind === "trainer"} onClick={() => act((g) => doAction(g, { type: "flee" }))}>FLEE</button>
              </div>
            )}

            {b.phase === "moves" && (
              <div className="pv-moves">
                {G.party[b.pi].moves.map((mv) => (
                  <button key={mv} className="pv-move" style={{ borderColor: TYPES[MOVES[mv].t].c }} onClick={() => act((g) => doAction(g, { type: "move", mv }))}>
                    <span>{MOVES[mv].n}</span>
                    <span className="pv-move-meta"><span className="pv-type" style={{ background: TYPES[MOVES[mv].t].c }}>{typeTag(MOVES[mv].t)}</span> {MOVES[mv].p > 0 ? `PWR ${MOVES[mv].p}` : MOVES[mv].d}</span>
                  </button>
                ))}
                <button className="pv-btn pv-small" onClick={() => act((g) => { g.battle.phase = "menu"; })}>BACK</button>
              </div>
            )}

            {b.phase === "bag" && (
              <div>
                {Object.entries(G.bag).filter(([id, n]) => n > 0 && !ITEMS[id].charm).map(([id, n]) => {
                  const it = ITEMS[id];
                  const disabled = it.bind ? (b.kind === "trainer" || G.party.length >= 6) : false;
                  return (
                    <button key={id} className="pv-row" disabled={disabled} onClick={() => act((g) => doAction(g, { type: "item", id }))}>
                      <span>{it.n} ×{n}</span>
                      <span className="pv-dim">{it.bind && b.kind === "trainer" ? "A Warden's Dread refuses binding" : it.bind && G.party.length >= 6 ? "You carry six already" : it.d}</span>
                    </button>
                  );
                })}
                <button className="pv-btn pv-small" onClick={() => act((g) => { g.battle.phase = "menu"; })}>BACK</button>
              </div>
            )}

            {b.phase === "party" && (
              <div>
                {b.forced && <p className="pv-dim">Choose who steps into the dark next:</p>}
                {G.party.map((m, i) => (
                  <button key={i} className="pv-row" disabled={i === b.pi || m.hp <= 0}
                    onClick={() => act((g) => {
                      if (g.battle.forced) doForcedSwitch(g, i);
                      else doAction(g, { type: "switch", i });
                    })}>
                    <span>{DEX[m.sp].n} <span className="pv-dim">Lv {m.lvl}</span></span>
                    <span className="pv-dim">{Math.max(0, m.hp)}/{m.maxHp} HP {m.hp <= 0 ? "— fainted" : i === b.pi ? "— fighting" : ""}</span>
                  </button>
                ))}
                {!b.forced && <button className="pv-btn pv-small" onClick={() => act((g) => { g.battle.phase = "menu"; })}>BACK</button>}
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}


// ============================================================
// styles
// ============================================================

const PV_CSS = `
  .pv-root { min-height: 100vh; background: #0b0a10; color: #d8d2c4; font-family: 'Courier New', monospace; display: flex; flex-direction: column; align-items: center; user-select: none; }
  .pv-root h1, .pv-root h2 { font-weight: normal; letter-spacing: 0.35em; }
  .pv-btn { background: #1e1a26; border: 1px solid #6a6050; color: #e6dfcd; font-family: inherit; font-size: 14px; letter-spacing: 0.15em; padding: 10px 18px; cursor: pointer; margin: 4px; }
  .pv-btn:hover:not(:disabled) { background: #2c2636; border-color: #c9a55c; }
  .pv-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .pv-small { font-size: 11px; padding: 5px 10px; }
  .pv-dim { color: #8a8070; font-size: 12px; }
  .pv-embers { color: #e8b84f; }
  .pv-status { color: #c86ad0; font-size: 11px; border: 1px solid #c86ad0; padding: 0 4px; margin-left: 4px; }
  .pv-type { display: inline-block; font-size: 10px; color: #0d0b12; padding: 1px 6px; margin-right: 4px; border-radius: 2px; letter-spacing: 0.1em; }

  .pv-title { text-align: center; padding-top: 12vh; max-width: 480px; }
  .pv-title h1 { font-size: 42px; color: #e6dfcd; text-shadow: 0 0 24px rgba(200,165,92,0.4); margin: 8px 0; }
  .pv-title-sigil { font-size: 30px; color: #c9a55c; animation: pv-breathe 3s ease-in-out infinite; }
  .pv-sub { color: #8a8070; font-style: italic; line-height: 1.7; }
  .pv-begin { margin-top: 24px; font-size: 16px; }
  .pv-controls { color: #6a6055; font-size: 11px; margin-top: 40px; line-height: 1.8; }
  @keyframes pv-breathe { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }

  /* the overworld scales to fill most of the window (both axes), keeping its
     3:2 pixel ratio, with a little breathing room. width:fit-content keeps the
     HUD and dialog aligned to the canvas rather than the whole window. */
  .pv-world { position: relative; width: fit-content; max-width: 100%; margin: auto; }
  .pv-hud { display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; font-size: 13px; letter-spacing: 0.2em; }
  .pv-hud-right { display: flex; align-items: center; gap: 10px; }
  .pv-canvas { display: block; margin: 0 auto; width: min(96vw, calc((100dvh - 64px) * 1.5)); height: auto;
    image-rendering: pixelated; border: 1px solid #2c2636; }
  .pv-dialog { position: absolute; left: 8px; right: 8px; bottom: 8px; background: rgba(10,8,14,0.94); border: 1px solid #6a6050; padding: 12px 16px 18px; font-size: 14px; line-height: 1.6; cursor: pointer; min-height: 58px; }
  .pv-speaker { color: #c9a55c; font-size: 11px; letter-spacing: 0.2em; margin-bottom: 4px; }
  .pv-more { position: absolute; right: 10px; bottom: 4px; color: #c9a55c; animation: pv-breathe 1s ease-in-out infinite; font-size: 11px; }

  .pv-overlay { position: absolute; inset: 0; background: rgba(8,6,12,0.97); padding: 16px; overflow-y: auto; z-index: 20; }
  .pv-overlay h2 { font-size: 16px; color: #c9a55c; }
  .pv-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; text-align: left; background: #16121e; border: 1px solid #3a3448; color: inherit; font-family: inherit; font-size: 13px; padding: 9px 12px; margin-bottom: 6px; cursor: pointer; }
  .pv-row:hover:not(:disabled) { border-color: #c9a55c; }
  .pv-row:disabled { opacity: 0.45; cursor: not-allowed; }
  .pv-mon-row { align-items: flex-start; cursor: default; }
  .pv-mon-info { flex: 1; }
  .pv-heal-row { margin-top: 4px; }
  .pv-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
  .pv-tab { background: none; border: 1px solid #4a4438; color: #8a8070; font-family: inherit; font-size: 12px; letter-spacing: 0.2em; padding: 6px 12px; cursor: pointer; }
  .pv-tab.on { color: #e6dfcd; border-color: #c9a55c; }
  .pv-ta { width: 100%; height: 90px; background: #100d18; color: #b0a894; border: 1px solid #3a3448; font-family: inherit; font-size: 11px; padding: 8px; margin: 8px 0; box-sizing: border-box; }

  .pv-starter-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 16px; }
  .pv-starter { background: #16121e; border: 1px solid #4a4438; color: inherit; font-family: inherit; padding: 14px; cursor: pointer; width: 170px; text-align: center; }
  .pv-starter:hover { border-color: #c9a55c; background: #201a2c; }
  .pv-starter-name { font-size: 15px; margin: 8px 0 4px; letter-spacing: 0.15em; }
  .pv-dex { color: #8a8070; font-size: 11px; font-style: italic; margin-top: 8px; line-height: 1.5; }

  .pv-hpbar { height: 8px; background: #221e2c; border: 1px solid #4a4438; margin: 4px 0; }
  .pv-hpbar > div { height: 100%; transition: width 0.25s ease; }
  .pv-xpbar { height: 4px; background: #221e2c; border: 1px solid #3a3448; margin-top: 4px; }
  .pv-xpbar > div { height: 100%; background: #7a8ac8; transition: width 0.25s ease; }

  .pv-battle { width: 100%; max-width: min(96vw, 1000px); min-height: 100dvh; margin: 0 auto; display: flex; flex-direction: column; }
  .pv-arena { position: relative; flex: 1; min-height: 300px; }
  .pv-panel { background: rgba(10,8,14,0.85); border: 1px solid #6a6050; padding: 8px 12px; font-size: 13px; width: 230px; }
  .pv-foe-panel { position: absolute; top: 16px; left: 16px; }
  .pv-foe-spr { position: absolute; top: 30px; right: 40px; } .pv-foe-spr > div, .pv-me-spr > div { position: relative; } .pv-foe-spr { filter: drop-shadow(0 6px 10px rgba(0,0,0,0.6)); }
  .pv-me-spr { position: absolute; bottom: 16px; left: 44px; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.6)); }
  .pv-me-panel { position: absolute; bottom: 16px; right: 16px; }
  .pv-msgbox { background: rgba(10,8,14,0.96); border-top: 2px solid #6a6050; padding: 14px 16px 20px; min-height: 120px; font-size: 14px; line-height: 1.6; cursor: pointer; position: relative; }
  .pv-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-width: 380px; }
  .pv-moves { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .pv-move { background: #16121e; border: 1px solid; color: inherit; font-family: inherit; font-size: 13px; padding: 9px 10px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; text-align: left; }
  .pv-move:hover { background: #221c30; }
  .pv-move-meta { font-size: 11px; color: #8a8070; }

  .pv-ending { text-align: center; max-width: 520px; padding-top: 8vh; line-height: 1.8; }
  .pv-ending h1 { color: #e8b84f; text-shadow: 0 0 30px rgba(232,184,79,0.5); }
  .pv-quote { color: #c9a55c; font-style: italic; font-size: 17px; }
  .pv-end-party { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin: 20px 0; font-size: 11px; }
  .pv-end-mon { text-align: center; }

  .pv-name { background: #16121e; border: 1px solid #6a6050; color: #e6dfcd; font-family: inherit; font-size: 16px; letter-spacing: 0.15em; padding: 10px 14px; text-align: center; width: 220px; }
  .pv-name:focus { outline: none; border-color: #c9a55c; }
  .pv-picked { border-color: #c9a55c !important; background: #201a2c !important; }
  .pv-idle { animation: pvBob 2.6s ease-in-out infinite; }
  .pv-idle2 { animation-delay: 1.3s; }
  @keyframes pvBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
  .pv-anim-lunge-e { animation: pvLungeE 0.45s cubic-bezier(.3,1.4,.5,1); }
  @keyframes pvLungeE { 0% { transform: translate(0,0); } 35% { transform: translate(-52px, 36px) scale(1.07); } 100% { transform: translate(0,0); } }
  .pv-anim-lunge-p { animation: pvLungeP 0.45s cubic-bezier(.3,1.4,.5,1); }
  @keyframes pvLungeP { 0% { transform: translate(0,0); } 35% { transform: translate(52px, -36px) scale(1.07); } 100% { transform: translate(0,0); } }
  .pv-anim-hit-e { animation: pvHitE 0.5s ease; }
  @keyframes pvHitE { 10% { transform: translateX(10px); filter: brightness(2.6) saturate(0.3); } 30% { transform: translateX(-8px); filter: brightness(1.9); } 50% { transform: translateX(6px); filter: brightness(1.4); } 70% { transform: translateX(-3px); } }
  .pv-anim-hit-p { animation: pvHitP 0.5s ease; }
  @keyframes pvHitP { 10% { transform: translateX(-10px); filter: brightness(2.6) saturate(0.3); } 30% { transform: translateX(8px); filter: brightness(1.9); } 50% { transform: translateX(-6px); filter: brightness(1.4); } 70% { transform: translateX(3px); } }
  .pv-hitflash { position: absolute; inset: -8px; border-radius: 50%; background: radial-gradient(circle, rgba(255,240,220,0.85), rgba(255,240,220,0) 70%); animation: pvFlash 0.35s ease-out forwards; pointer-events: none; }
  @keyframes pvFlash { 0% { opacity: 1; transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.4); } }
  .pv-shakeA { animation: pvShake 0.3s ease; }
  @keyframes pvShake { 20% { transform: translate(-5px, 3px); } 40% { transform: translate(4px, -4px); } 60% { transform: translate(-3px, -2px); } 80% { transform: translate(2px, 2px); } }
  .pv-sndfloat { position: absolute; top: 8px; right: 8px; z-index: 5; }
  @media (prefers-reduced-motion: reduce) {
    .pv-idle, .pv-idle2 { animation: none; }
  }

  @media (max-width: 600px) {
    .pv-panel { width: 170px; font-size: 11px; }
    .pv-foe-spr { right: 12px; top: 90px; }
    .pv-me-spr { left: 12px; }
  }

  /* ----- touch / mobile / safe areas ----- */
  /* pad the whole app by the device safe-area insets so no edge control is unreachable */
  .pv-root { min-height: 100dvh; box-sizing: border-box;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }

  .pv-joy { display: none; position: absolute; left: 14px; bottom: 14px; z-index: 15;
    width: min(30vw, 30dvh, 148px); height: min(30vw, 30dvh, 148px);
    border-radius: 50%; touch-action: none; user-select: none; -webkit-user-select: none;
    background: radial-gradient(circle at 50% 42%, rgba(40,34,52,0.55), rgba(10,8,14,0.42));
    border: 1px solid rgba(201,165,92,0.35); box-shadow: inset 0 0 18px rgba(0,0,0,0.5); }
  .pv-joy-ring { position: absolute; inset: 22%; border-radius: 50%; border: 1px dashed rgba(201,165,92,0.28); pointer-events: none; }
  .pv-joy-knob { position: absolute; left: 50%; top: 50%; width: 42%; height: 42%; margin: -21% 0 0 -21%;
    border-radius: 50%; background: radial-gradient(circle at 40% 35%, #6a6050, #2c2636);
    border: 1px solid #c9a55c; box-shadow: 0 2px 8px rgba(0,0,0,0.6); pointer-events: none; transition: transform 0.06s linear; }
  @media (pointer: coarse) { .pv-joy { display: block; } }

  /* mobile entry gate — JS-controlled; the game is not rendered behind it */
  .pv-gate { position: fixed; inset: 0; z-index: 10000; background: #0b0a10; color: #d8d2c4;
    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
    padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
    cursor: pointer; user-select: none; -webkit-user-select: none; }
  .pv-gate-icon { font-size: 60px; color: #c9a55c; animation: pv-breathe 2s ease-in-out infinite; }
  .pv-gate-title { margin-top: 16px; letter-spacing: 0.3em; color: #e6dfcd; font-size: 18px; }
  .pv-gate-sub { margin-top: 10px; color: #8a8070; font-size: 13px; font-style: italic; line-height: 1.6; max-width: 320px; }
  .pv-gate-btn { margin-top: 26px; font-size: 15px; }
`;

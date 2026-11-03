# Plan: mobs, their placement, and the credits ending

Status update: the **ender dragon is cut** (per decision). All other mobs are BUILT (see `src/mobkit.js`, `src/mobdefs.js`,
`src/mobs.js`, `src/placement.js`) and the terrain spacing / slide-card work is done. The credits ending is still design only.
Spacing, slide cards and mobs: see README.md. Remaining open: the credits ending (sections 2-4 below, dragon parts excluded).

## 0. What the repo gives us (checked)
- Entity **textures** for almost every mob (`textures/entity/...`). Entity **geometry is NOT in the repo** (only block/item
  models), so every mob model has to be authored by hand as boxes + vanilla UV layout, like the minecart and Steve already are.
- The full **End poem** (`texts/end.txt`, colour codes `§2` / `§3` alternating speakers, `§k` obfuscated text, `PLAYERNAME`
  placeholder), the **credits data** (`texts/credits.json`, section > discipline > title > names), `texts/postcredits.txt`.
- **Sounds exist** (~4,400 .ogg): `music/game/end/alpha.ogg` (the credits track), `boss.ogg`, `the_end.ogg`, dragon growls / wings /
  death, enderman idle / stare / portal sounds. The PRD kept sound for a later phase; this plan uses it for the ending only.
- Textures for the ending set: `enderdragon/dragon.png` (+ eyes, exploding, fireball), `end_crystal/*`, `block/bedrock.png`,
  `block/dragon_egg.png`, `entity/end_portal.png`, `environment/end_sky.png`, `entity/experience_orb.png`, `block/end_rod.png`.

## 1. Mobs

### 1.1 Principles
- **Ambient dressing, not gameplay.** No combat, no damage, no pathing around the player. Hostile mobs are fine as scenery:
  they idle, wander on a short leash and turn their heads to watch the cart go by.
- **Deterministic**: spawned from the same seeded hashes as the terrain, so every run is identical (important for rehearsing).
- **Readable at presentation distance**: big, recognisable silhouettes near the track, nothing tiny that flickers.
- **Safe**: spawn only on valid floor, at least 3 blocks from every rail cell, never inside the camera's orbit clearance, and never
  where the checkpoint card would cover them.
- **Cheap**: ~60 mobs in total, animated only within ~50 blocks of the cart, frustum culled, fog hides the rest. Budget: at most
  ~25 mobs visible at once, a few hundred triangles each.

### 1.2 Technical approach (`src/mobs.js`, `src/mobdefs.js`)
1. **Mob kit**: a small data format `{ bones: [{ name, pivot, parent, boxes: [{ origin, size, uv, inflate }] }] }` built on the
   existing `mcBox` UV function. Each mob is a few data lines plus an animation function.
2. **Animation**: procedural, driven by time and cart distance. Idle bob / sway, walk cycle for humanoids and quadrupeds, wing flap
   (bat, dragon), hover (blaze rods orbit, ghast tentacles wave), hop (slime / magma cube / rabbit), swim wiggle (fish, axolotl).
   Head-look: the head bone yaws toward the cart when it is within ~12 blocks.
3. **Rendering**: same path as Steve and the cart (`rt.patch` with an object light), so mobs receive the ray-traced sun shadows,
   lantern light and fire / lava glow. **Emissive overlay layers** for glowing parts (enderman eyes, dragon eyes, blaze, glow squid,
   magma cube) drawn full-bright.
4. **Placement**: `placeMobs(world, track)` returns a seeded list `{ type, x, y, z, yaw, leash }`; rules per biome below. A debug
   key dumps a top-down placement map so it can be reviewed without riding.
5. **Effects shared with the ending**: particles (portal swirl, explosion, XP orbs) get one small particle system.

Model confidence (authoring from memory of the vanilla cubes, each checked by eye against its texture):
- High: zombie, skeleton, stray, wither skeleton, piglin, enderman (all biped-based), creeper, pig, cow, sheep, chicken.
- Medium: blaze, ghast, slime / magma cube, bat, strider, fox, wolf, rabbit, goat, bee, axolotl, glow squid, fish, snow golem.
- Hard: **ender dragon** (many parts, wings with membranes), shulker, hoglin, polar bear. These come last and may ship simplified first.

### 1.3 Placement by biome (one row = one design decision, adjustable)
| # | Biome | Mobs (count) | Where / behaviour |
|---|---|---|---|
| 1 | Alpine meadow | goats (3-4) on mountain ledges, sheep (4), 1 fox, bees (3) near flowers | Goats on high rock, visible from the downhill; sheep graze (head dip) |
| 2 | Cherry canyon | bees (4-5) in the blossom canopies, rabbits (3), pigs (2), **fish (6)** in the river under the trestle | Fish visible through the water as the cart crosses; bees circle trees |
| 3 | Taiga | wolves (3, a pack), 1 fox asleep (`fox_sleep.png`), rabbits (2), 1 iron golem near the hall | Wolves sit / look at the cart; a sleeping fox as a small easter egg |
| 4 | Lush cave | axolotls (5, mixed colours) in the pools, glow squid (3) in deep water, tropical fish | Glow squid light up the water (emissive); axolotls swim near the surface |
| 5 | Ice cave | strays (3) on ledges, 1 snow golem, 1 polar bear, bats (3) | Strays idle with bows lowered; bats flutter near the ceiling |
| 6 | Nether | ghasts (2-3) far out over the lava lake, blazes (3) near the hall, striders (4) on the lava, magma cubes (3) hopping on the shore, piglins (2) at the hall | Ghasts float and sometimes "shoot" (mouth texture + a fireball arc that misses); blazes' rods orbit; striders cross the lava |
| 7 | The End | endermen (7-8) scattered on islands, shulkers (2-3) on obsidian, end crystals on the obsidian pillars with beams, **the ender dragon** circling | Endermen stand still, an occasional teleport blink with purple particles; dragon sets up the ending (section 2) |

Hall mascots: each checkpoint hall gets one signature mob standing on the platform, in frame but clear of the card (the card is on
the left, the cart is on the right, so the mascot goes on the far side behind the cart): goat, pig, wolf, axolotl, polar bear,
piglin, enderman. This also makes every checkpoint visually distinct.

### 1.4 Risks
- Entity models from memory can be subtly wrong; mitigated by checking each against its texture, and by building in order of confidence.
- Ray-traced shader cost goes up with more lit objects; mitigated by the existing quality governor and by culling.
- The dragon is the biggest single piece of work. A simplified dragon (body, neck, head, wings, tail) comes first; the full model is optional.

## 2. The ending (credits like the vanilla End credits)

### 2.1 The vanilla sequence we are echoing
Dragon dies (floats up, light beams, explosion, XP orbs) > exit portal activates (bedrock fountain, beam of light) > the player steps
in > the screen cuts to the **End poem scrolling slowly over a dark tiled background with the credits music** > the **credits roll**
(logo, then sections / disciplines / titles / names) > a few blank screens > respawn back in the overworld.

### 2.2 Proposed version for this ride
This **replaces the current finale** (the climb out of the End into the alpine meadow). The meadow does not disappear: it becomes the
respawn at the very end, which also closes the loop back to state 0.

1. **State 7 (End hall)**: the dragon circles the central island; end crystals beam from the obsidian pillars (set dressing).
2. **Space: finale ride (transient, first person)**: the track runs over the central island toward the exit portal. As the cart
   leaves the hall the **dragon dies**: it hovers, rotates and dissolves using `dragon_exploding.png`, light beams shoot upward,
   explosion particles, **XP orbs** (`experience_orb.png`) rain down and fly toward the cart, the dragon sounds play.
3. **The portal**: a bedrock fountain (ring, 4 pillars with torches, central column with the **dragon egg**) with an animated
   end-portal surface (layered star field, as in vanilla). The cart rides **into it**; a white-purple flash fills the screen.
4. **State N+1 = Credits (resting state)**:
   - Dark tiled background (vanilla uses the dimmed menu background texture), centred text in the Minecraft bitmap font.
   - **Poem first** (`end.txt`): alternating `§3` / `§2` colours, `§k` obfuscated words flickering through random glyphs, and
     `PLAYERNAME` replaced by the presenter's name from `config.json`.
   - **Then the credits** in the vanilla structure (logo, section, discipline, title, names) and the post-credits blank space.
   - Music: `alpha.ogg` fades in at the portal flash and fades out at the end (Web Audio, starts after the first click).
   - Speed configurable (default tuned to roughly 2.5 minutes in total, because a full vanilla run is far too long for a
     presentation). A "poem only" mode is a config switch.
5. **End of credits**: fade to white, then **respawn** in the alpine meadow at state 0 (start card showing). This is the same as `R`.

### 2.3 State-machine integration (keeps the controls you set)
- States stay `0..N` checkpoints, then **N+1 = credits** (resting). The finale ride is the only new transient state.
- **Space** in the credits state **skips to the end of the credits and respawns** (continues from the current state). Holding Space
  to speed up is the vanilla behaviour, but a skip matches "Space continues"; please confirm (question 3).
- **Number keys** still jump instantly from any state, including out of the credits. Jumping to N+1 goes straight to the credits start.
- `R` restarts at state 0 as now.

### 2.4 What has to be built
| Piece | Notes |
|---|---|
| Central island + exit portal fountain | New terrain / structure code; `bedrock.png`, end stone, obsidian, dragon egg |
| End portal surface shader | Layered scrolling star textures (`end_portal.png`, `end_sky.png`) with parallax, tinted |
| Dragon model + flight path | Closed-form circle around the island, wings flap, head tracks the cart; death animation shader |
| Particles | Portal swirl, explosion, XP orbs (one shared system) |
| Credits renderer | Canvas text with the existing bitmap font code: colour codes, obfuscation, scroll, fade; reads poem + credits JSON |
| Audio (ending only) | Web Audio: `alpha.ogg`, dragon death / growl, portal; modest volumes; M mutes |
| New finale track | Replaces the climb: a short run over the island into the portal (validated with the existing track / collision tools) |

## 3. Suggested build order (each step ends with screenshots, a ride simulation and a collision check)
1. **Mob kit + 3 easy mobs** (pig, zombie, enderman) proving model, animation, lighting and head-look. Small.
2. **Surface biome mobs** (alpine, cherry, taiga) and hall mascots. Medium.
3. **Cave mobs** (lush, ice) with emissive layers (glow squid). Medium.
4. **Nether mobs** (blaze, ghast with fireball arcs, strider, magma cube, piglin). Medium.
5. **End mobs** (endermen, shulkers, crystals with beams). Medium.
6. **Ending, part 1**: central island, exit portal, portal shader, new finale track. Large.
7. **Ending, part 2**: dragon (circling, then death), particles, XP orbs. Large.
8. **Ending, part 3**: credits renderer, poem + credits data, respawn loop, audio. Medium.

## 4. Open questions for you
1. **Credits content**: the vanilla `credits.json` lists real Mojang staff by name. Use that (it matches the real credits exactly),
   or your own credits (presenter / team / thank-yous) in the same layout? I recommend **your own**, with the poem kept as is.
2. **Finale change**: OK to replace the climb back into the meadow with the ride into the exit portal, and bring the meadow back as the respawn?
3. **Space during credits**: skip to the end and respawn (my suggestion), or hold to speed up like vanilla?
4. **Length of the credits**: about 2.5 minutes, poem only, or the full vanilla length?
5. **Mobs**: are hostile mobs (zombie-type, strays, ghasts, blazes) acceptable as non-aggressive scenery, and is the ender dragon simplified-first acceptable?
6. **Audio**: ending music and effects only (as planned), or also biome ambience and mob sounds?
7. **Licence**: Minecraft's poem text, music and credits are Mojang's; fine for private use, but please check before publishing the presentation.

## 5. Done already: animated Nether fire
- Fire is its own mesh: four planes leaning outward as in vanilla, 22.4 px tall, animated from the 32-frame strip at 20 frames/s.
- Four phase-offset groups so the fires don't flicker in sync; a second texture (`fire_1`) on the crossing planes.
- **Soul fire** (blue) added on soul sand, with its own cyan light.
- Warm lights (fire, lava, lanterns) now flicker slightly; cool lights (soul lanterns, soul fire) stay steady.
- Verified with screenshots at different moments: the flame shapes change and the corner fires are at different phases.

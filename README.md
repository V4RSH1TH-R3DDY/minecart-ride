# Minecart Ride (3D presentation animation)

Run (needs a local server because the browser blocks module loading from file://):

    cd ~/Projects/minecart-ride
    python3 tools/serve.py 8000      # then open http://localhost:8000   (same as `python3 -m http.server`, but sends no-cache headers so edits always show up)

Controls
- **Space** (also click / Enter): continue the animation from the current state, riding to the next checkpoint. At the very end, Space goes back to slide 0.
- **Slide number keys** (0-9, numpad too): jump instantly to that state, from anywhere, even mid-ride. No ride animation.
  `0`..`N-1` = the slides (slide 0 is the first one and the app opens parked there), `N` = the end (black screen). Numbers past the last state are ignored. With 10+ slides,
  type the digits quickly (e.g. `1` `2`) and the jump happens after a short pause.
- **R** goes back to slide 0, **F** toggles full-screen.

State machine (internal state = slide number + 1): resting states are slide popups and finished; `riding` and `portal` are transient.

## The ride
Nine checkpoints (slides 0-8), then a finale climbing back into daylight:
0 desert (E-Cell Departments Breakdown), 1 alpine meadow, 2 cherry/autumn river canyon, 3 taiga valley, 4 lush cave, 5 ice cave, 6 deep dark ancient city (IT), 7 nether lava cavern (Upstarters), 8 the End (Our Startups),
finale: powered-rail climb out of the End into the alpine meadow (first person).

## Lighting
Real-time voxel ray tracing in the fragment shader (`src/lighting.js`): sun shadows, shadowed lantern / lava / glow-berry
lights, and water reflections, marched through the block grid with a DDA. Lanterns hang on chains; the lava-cavern bridge
hangs from chains too. A quality governor lowers resolution and ray budget automatically if the frame rate drops.
URL options: `?quality=auto|low|med` (default auto) and `?scale=0.75` (render scale).

## Editing
- Slide text: `config.json` (start card, checkpoints, finale). Checkpoint count follows the entries (biomes repeat after 7).
- Track layout: `src/track.js`. Physics: `src/physics.js`. Camera: `src/camera.js`.
- Biome terrain: `src/terrain.js` (shapes, caves), `src/decor.js` (trees, plants, End islands), `src/structures.js` (halls, lanterns).
- Textures: Minecraft 1.21.11 assets copied into `assets/` (Mojang's; check licence for your use).

Dev tools (`tools/`, need the server running): `validate.mjs` (track collisions), `states.mjs` (state-machine test), `gen.mjs` (world generation in Node),
`playthrough.mjs` (simulated ride + timings), `collide.mjs` (cart / camera vs blocks), `shot.mjs` (headless screenshots).

## Mobs (ambient scenery, no combat)
83 mobs: alpine goats / sheep / fox / bees; cherry canyon bees / rabbits / pigs / fish; taiga wolves / sleeping fox / rabbits / iron golem;
lush cave axolotls; ice cave strays / snow golem / polar bear / bats; nether ghasts (throwing fireballs that miss), blazes, striders on lava,
magma cubes, piglins; the End endermen, shulkers, crystals; deep dark wardens (2 roaming plus the hall mascot) and bats. One mascot stands in each checkpoint hall.
Models are hand-built from vanilla box layouts (`src/mobdefs.js`); placement rules per biome are in `src/placement.js`.
Tools: `tools/gallery.mjs` (line-up shots), `tools/mobreport.mjs` (what was placed), `tools/mobview.mjs`.

## Slides
Each checkpoint in `config.json` accepts `title`, `body`, `bullets` (list), `image` or `images` (paths, e.g. `slides/chart.png`),
and `layout: "image"` for a full-card graphic. Layouts adapt automatically; samples are in `slides/`.

## The ending
After checkpoint 7 the finale ride (first person) does not stop: the cart drives straight through a nether portal (obsidian and crying obsidian
frame on the rails, animated vanilla portal texture, purple light). The view fills with portal haze and fades to black; Space then respawns at the
start. There are no credits. Test script: `tools/ending.mjs`.

## Performance
- The cart is drawn interpolated between 120 Hz physics steps, so uneven frame times no longer cause stutter.
- The ray-traced shading is the main cost. Shadow rays shrink with distance (and stop past ~100 blocks), point-light rays are skipped where
  there is no light, and every rail piece is one merged mesh (1 draw call). Clouds are merged too.
- The quality governor caps shaded pixels (~1080p worth), steps resolution + ray budget together, drops quality after ~0.6 s of slow frames and
  recovers cautiously. URL options: `?quality=auto|high|med|low`, `?scale=0.75`.
- `tools/perf.mjs [quality] [scale]` benchmarks update vs render time and cart-motion smoothness per scene (software-rendered, so only relative).

## Particles and sound
**Particles** (`src/particles.js`): GPU point sprites that spawn in a fan in front of the camera and scale with the biome the cart is in:
cherry petals (canyon, a few in the meadow), autumn leaves (taiga), pollen (meadow), snow + ice sparkles (ice cave), spores + fireflies + drips (lush cave),
ash + rising embers + smoke over the lava (nether), glowing motes (the End), dust (tunnels). Particles stop at blocks.
**Sound** (`src/audio.js`, Web Audio, real vanilla files from `assets/sounds/manifest.json`):
- cart rumble that follows speed, procedural wind that follows speed and biome, biome beds (nether ambience / lava / fire, water, End hum),
  random cave moods, drips, ice chimes, lava pops;
- positional mob sounds (each mob type calls out every so often, panned and attenuated by distance);
- rail effects: firework whoosh on powered rails, pressure-plate click on detector rails, bell on arrival, note on the activator rail,
  nether-portal trigger and travel sounds, and the portal hum as you approach it.
**M** mutes (remembered). Browsers keep audio off until the first key press or click, so the first Space unlocks it.
Rebuild the sound/particle asset copies with `python3 tools/build_assets_fx.py`; checks: `tools/fxcheck.mjs`, `tools/audiocheck.mjs`.

## Night
The world is set at night (`"timeOfDay": "night"` in `config.json`; use `"day"` for the daytime look). Night means a deep-blue sky with stars,
the vanilla moon with a halo, cool moonlight and moonlit shadows from the moon's direction, darker clouds and fog, fireflies in the surface biomes,
and procedural crickets. Caves, the Nether and the End look as before; their light never depended on the sun.

## Slides (current titles)
0 E-Cell Departments Breakdown, 1 Event Management & Documentation, 2 Logistics, PR & SP, 3 Operations, 4 Publicity & Social Media, 5 Design, 6 IT, 7 Upstarters, 8 Our Startups.
Bodies are placeholders (`[Content to come]`) until the team's content arrives; edit `checkpoints` in `config.json`.

## Track and camera notes
- The track now starts with a short lead-in behind slide 1's hall (no start station, no intro ride). Slide i stands in hall i-1; the ride from slide i is `track.legs[i-1]`.
- Peaks follow the vanilla rule: a slope's high end only connects to a rail one block higher, so an up-slope is never followed straight by a
  down-slope. The track builder inserts one flat rail on top of every peak (valleys need nothing).
- Chase camera: the original orbiting oblique camera (it slowly swings around the cart and avoids walls).

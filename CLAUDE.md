# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based 3D presentation: a Minecraft-style minecart ride through 9 biomes, stopping at a checkpoint per slide (text/images from `config.json`). Plain ES modules + three.js (vendored in `vendor/`, resolved via the importmap in `index.html`). No bundler, no build step, no linter, and no real test suite (`npm test` is a placeholder).

## Running

Needs an HTTP server (module loading fails on `file://`):

    python3 tools/serve.py 8000     # open http://localhost:8000  (like http.server but sends no-cache headers, so edits always show up)

URL options: `?quality=auto|high|med|low`, `?scale=0.75` (render scale). Controls: Space/click/Enter advance, digits `0`-`8` jump to that slide (`9` = black end screen), R restart (slide 0), F fullscreen, M mute. The dev server must send no-cache headers (`tools/serve.py` does); with plain `http.server` the browser keeps stale modules and asset lists, which shows up as odd errors like `uv is undefined` or `missing mob texture` after edits (fix: hard reload).

## Dev tools (`tools/`)

Standalone scripts, run with `node tools/<name>.mjs`. Pure-Node ones import `src/` directly (no browser): `validate.mjs` (track collisions), `gen.mjs` (world generation + light bake timings), `floating.mjs` (rails with no solid block underneath; should report 0), `lushwater.mjs` (water in the lush cave, which axolotls need).

Browser-driven ones use `playwright-core` with `/usr/bin/google-chrome-stable` (software GL via SwiftShader) and **expect a server on port 8137** (not the 8000 from the README): `python3 tools/serve.py 8137` (it stops when the shell session ends; restart it if a tool reports `ERR_CONNECTION_REFUSED`). These include `shotslide.mjs <state> <out.png>` (jump to a slide and screenshot its card; note the argument is the internal state, slide number + 1), `states.mjs` (state-machine test, the closest thing to a test), `playthrough.mjs`, `ending.mjs`, `shot.mjs` (headless screenshots; `QS` env sets the query string, args are a step script like `tick:2 shot`), `perf.mjs`, `collide.mjs`, `fxcheck.mjs`, `audiocheck.mjs`, `gallery.mjs`, `mobreport.mjs`.

They drive the app through the `window.__game` hook exposed at the end of `src/main.js` (`tick(...)`, `key(...)`, `game`, `physics`) and `window.__paused = true`, which stops the real rAF loop so the tools can step time manually. Keep that hook working when refactoring `main.js`.

`python3 tools/build_assets_fx.py` regenerates the sound/particle asset copies in `assets/`.

## Architecture

`src/main.js` is the orchestrator (state machine, render loop, input, wiring). The pipeline at startup:

1. `track.js` `buildTrack(layoutFor(N))` — the rail path as a list of cells and legs (one per checkpoint). The layout is built for exactly 9 stops, one biome each (slide 0 desert, 1 alpine, 2 cherry, 3 taiga, 4 lush, 5 ice, 6 deep dark, 7 nether, 8 end; see `BIOME_OF_LEG`), then the finale, whose climb length is computed from the last stop's height. Changing the slide count means changing the layout and biome list too. Cart speed lives in `P` in `physics.js`.
2. `terrain.js` `generateWorld(track)` — builds a voxel grid (a final pass guarantees a solid block under every rail; `tools/floating.mjs` checks it) (`nx,ny,nz`, `data` array of block ids from `blocks.js`) carved around the track; `decor.js` (trees, plants, End islands) and `structures.js` (halls, lanterns, chains) add to it. Everything is deterministic (seeded hashes in `noise.js`) so every run is identical.
3. `lighting.js` `bakeLight(world)` + `createRT` — bakes light data, then the **fragment shader ray-marches the voxel grid (DDA)** in real time for sun/moon shadows, lantern/lava/glow-berry lights and water reflections. This is the main performance cost; a quality governor in `main.js` adjusts resolution and ray budget based on frame time.
4. `mesher.js` `buildMeshes` — turns voxels into meshes using the texture atlas from `assets.js`; `rails.js` merges all rails into one mesh.
5. Runtime: `physics.js` (`CartPhysics`, fixed 120 Hz steps, render is interpolated), `camera.js` (`CameraRig`, orbit camera plus first-person finale), `sky.js` (night/day sky, moon, stars), `particles.js` (GPU point sprites per biome), `audio.js` (Web Audio, vanilla sounds listed in `assets/sounds/manifest.json`), `panel.js` (slide cards rendered to a canvas, shown as DOM in `#card`; also draws the team photo boxes, picture frames and startup boxes), `netherportal.js` (ending).
6. Mobs (ambient scenery only): `mobkit.js` (bone/box model format with vanilla UV layouts), `mobdefs.js` (per-mob models, hand-built), `placement.js` (per-biome placement rules, seeded), `mobs.js` (runtime/animation).

State machine: internal states are slide number + 1 (slide 0 is state 1, the desert hall); resting states are slide popups `1..N` and finished `N+1`; `riding` and `portal` are transient. The finale is a first-person powered-rail climb out of the End that drives into a nether portal, fades to black, and Space then restarts. `docs/PLAN-mobs-and-ending.md` is a historical design doc (it says the credits ending is unbuilt; the actual ending is the portal, with no credits, and the ender dragon was cut).

## Content editing

- Slide content: `config.json` only. Each of `checkpoints[]` has a `title` (may be omitted) and any of: `body` (paragraphs separated by `\n`; an ALL-CAPS paragraph is drawn as an amber heading), `bullets`, `after`, `columns: [{w, body, bullets, after, body2, bullets2}, ...]` (side-by-side text columns, `w` = relative width, one common font size), `tagline` (large amber closing line left of the team photos), `photos: [{image, caption, role}]` (square team photos in the bottom right, `role` = small department caption; images in `slides/team/`), `gallery: [{image}]` (frames for pictures from past events, a column on the right, `galleryW` sets its width), `logos: [path, ...]` (department logos, drawn top right of the card, same height; transparent PNGs in `slides/logos/`), `startups: [{label, items: [{name, ceo, image}]}]` (centred square startup boxes; no `ceo` = no CEO line), `image`/`images`, `layout: "image"`, `footer`. `timeOfDay: "night"|"day"`. Cards are drawn by `src/panel.js`; text shrinks to fit the free space, so long text on a busy slide ends up small.
- Slide order and biomes: 0 Departments Breakdown (desert), 1 Event Management & Documentation, 2 Logistics, PR & SP, 3 Operations, 4 Publicity & Social Media, 5 Design, 6 IT (deep dark), 7 Upstarters (nether), 8 Our Startups (the End).
- Textures/sounds are Mojang's Minecraft 1.21.11 assets copied into `assets/`; licensing is the user's concern.

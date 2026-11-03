#!/usr/bin/env python3
"""Copies the particle sprites and the sound files the game uses from the minecraft-assets checkout, and writes the manifests.
Usage: python3 tools/build_assets_fx.py"""
import json, os, shutil
SRC = os.path.expanduser('~/Downloads/minecraft-assets/assets/minecraft')
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')

# ---------------- particles ----------------
PARTS = ['cherry_%d' % i for i in range(12)] + ['leaf_%d' % i for i in range(12)] + ['glitter_4', 'glitter_0', 'glow', 'generic_0', 'lava', 'drip_fall', 'big_smoke_0', 'flame', 'firefly']
os.makedirs(OUT + '/particles', exist_ok=True)
for n in PARTS:
    shutil.copy(f'{SRC}/textures/particle/{n}.png', f'{OUT}/particles/{n}.png')
json.dump(PARTS, open(OUT + '/particles/_list.json', 'w'))

# ---------------- sounds ----------------
EVENTS = [
  # cart + rail effects
  'entity.minecart.riding', 'entity.minecart.inside', 'block.stone_pressure_plate.click_on', 'block.bell.use', 'entity.firework_rocket.launch',
  'ui.button.click', 'entity.experience_orb.pickup', 'block.note_block.chime',
  # portal
  'block.portal.ambient', 'block.portal.trigger', 'block.portal.travel',
  # biome ambience
  'ambient.cave', 'ambient.nether_wastes.loop', 'ambient.nether_wastes.mood', 'ambient.nether_wastes.additions', 'block.lava.ambient', 'block.lava.pop',
  'block.fire.ambient', 'block.water.ambient', 'ambient.underwater.loop', 'block.pointed_dripstone.drip_water', 'block.pointed_dripstone.drip_lava',
  'block.amethyst_block.chime', 'block.beacon.ambient', 'block.glass.break',
  # mobs
  'entity.pig.ambient', 'entity.sheep.ambient', 'entity.wolf.ambient', 'entity.fox.ambient', 'entity.goat.ambient', 'entity.bee.loop', 'entity.rabbit.ambient',
  'entity.iron_golem.hurt', 'entity.axolotl.idle_air', 'entity.axolotl.idle_water', 'entity.glow_squid.ambient', 'entity.stray.ambient', 'entity.polar_bear.ambient',
  'entity.bat.ambient', 'entity.blaze.ambient', 'entity.wither_skeleton.ambient', 'entity.strider.ambient', 'entity.magma_cube.squish', 'entity.piglin.ambient',
  'entity.warden.heartbeat', 'entity.warden.ambient', 'block.sculk_sensor.clicking', 'entity.enderman.ambient', 'entity.enderman.stare', 'entity.shulker.ambient', 'entity.cod.flop',
]
d = json.load(open(SRC + '/sounds.json'))
manifest, copied, missing, total = {}, set(), [], 0
for ev in EVENTS:
    e = d.get(ev)
    if not e: missing.append(ev); continue
    files = []
    for s in e['sounds']:
        name, vol, pitch = (s, 1.0, 1.0) if isinstance(s, str) else (s.get('name'), s.get('volume', 1.0), s.get('pitch', 1.0))
        src = f'{SRC}/sounds/{name}.ogg'
        if not os.path.exists(src): continue
        dst = f'{OUT}/sounds/{name}.ogg'
        if name not in copied:
            os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy(src, dst); copied.add(name); total += os.path.getsize(src)
        if not any(f['file'] == name for f in files): files.append({'file': name, 'vol': vol, 'pitch': pitch})
    if files: manifest[ev] = files
    else: missing.append(ev + ' (no files)')
os.makedirs(OUT + '/sounds', exist_ok=True)
json.dump(manifest, open(OUT + '/sounds/manifest.json', 'w'), indent=1)
print('particles', len(PARTS), '| events', len(manifest), '| files', len(copied), '| %.1f MB' % (total / 1e6), '| missing:', missing or 'none')

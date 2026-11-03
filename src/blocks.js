// Block registry. kind: cube | leaves | liquid | cross | lily | chorus | lantern | chain | icicle | lowbox (full-width box h/16 tall)
// opaque: occludes neighbouring faces and casts full shadows. leaves cast partial shadows.
export const LIST = [];
export const B = {};

function add(name, o = {}) {
  const id = LIST.length;
  const def = { id, name, kind: 'cube', opaque: true, emit: 0, tint: null, tiles: [name], ...o };
  if (typeof def.tiles === 'string') def.tiles = [def.tiles];
  LIST.push(def); B[name] = id;
  return def;
}
const same = (t) => [t, t, t];

add('air', { kind: 'air', opaque: false, tiles: [] });
for (const n of ['stone', 'cobblestone', 'cobbled_deepslate', 'deepslate_bricks', 'dirt', 'coarse_dirt', 'rooted_dirt', 'mud', 'clay', 'sand',
  'gravel', 'calcite', 'andesite', 'tuff', 'moss_block', 'mossy_cobblestone', 'snow', 'packed_ice', 'blue_ice', 'netherrack',
  'smooth_basalt', 'blackstone', 'bedrock', 'crying_obsidian', 'nether_bricks', 'soul_sand', 'end_stone', 'obsidian', 'stone_bricks', 'bricks', 'oak_planks',
  'sculk', 'deepslate_tiles', 'polished_deepslate', 'cut_sandstone', 'terracotta', 'orange_terracotta', 'spruce_planks', 'dark_oak_planks', 'cherry_planks', 'amethyst_block', 'dripstone_block', 'red_wool', 'white_wool',
  'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'redstone_ore', 'lapis_ore',
  'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_gold_ore', 'deepslate_diamond_ore', 'deepslate_redstone_ore', 'deepslate_lapis_ore'])
  add(n, { tiles: [n] });
add('deepslate', { tiles: ['deepslate_top', 'deepslate', 'deepslate_top'] });
add('sandstone', { tiles: ['sandstone_top', 'sandstone', 'sandstone_top'] });
add('reinforced_deepslate', { tiles: ['reinforced_deepslate_top', 'reinforced_deepslate_side', 'reinforced_deepslate_bottom'] });
add('sculk_catalyst', { tiles: ['sculk_catalyst_top', 'sculk_catalyst_side', 'sculk_catalyst_bottom'] });
add('sculk_sensor', { kind: 'lowbox', h: 8, opaque: false, emit: 0.3, tiles: ['sculk_sensor_top', 'sculk_sensor_side', 'sculk_sensor_bottom'], light: [0.3, 0.8, 0.95, 0.35] });
add('cactus', { tiles: ['cactus_top', 'cactus_side', 'cactus_bottom'] });
add('podzol', { tiles: ['podzol_top', 'podzol_side', 'dirt'] });
add('grass', { tiles: ['grass_block_top', 'GRASS_SIDE', 'dirt'], tint: 'grassTop' });
add('basalt', { tiles: ['basalt_top', 'basalt_side', 'basalt_top'] });
add('red_mushroom_block', { tiles: ['red_mushroom_block'] });
for (const w of ['oak', 'spruce', 'birch', 'cherry', 'dark_oak']) add(w + '_log', { tiles: [w + '_log_top', w + '_log', w + '_log_top'] });
add('magma', { emit: 0.85, light: [1.0, 0.45, 0.15, 0.55] });
add('glowstone', { emit: 1, light: [1.0, 0.78, 0.45, 1.0] });
add('shroomlight', { emit: 1, light: [1.0, 0.62, 0.3, 1.0] });
// leaves: cut-out cubes, partial shadow
add('oak_leaves', { kind: 'leaves', tint: 'foliage' });
add('spruce_leaves', { kind: 'leaves', tint: 'spruce' });
add('birch_leaves', { kind: 'leaves', tint: 'birch' });
add('cherry_leaves', { kind: 'leaves' });
add('azalea_leaves', { kind: 'leaves' });
add('flowering_azalea_leaves', { kind: 'leaves' });
add('red_leaves', { kind: 'leaves', tiles: ['dark_oak_leaves'], tint: 'red' });
add('gold_leaves', { kind: 'leaves', tiles: ['oak_leaves'], tint: 'gold' });
// liquids
add('water', { kind: 'liquid', opaque: false, tiles: ['water_still'] });
add('lava', { kind: 'liquid', opaque: true, emit: 1, tiles: ['lava_still'], light: [1.0, 0.5, 0.16, 1.0] });
// plants / decorations (do not occlude)
add('short_grass', { kind: 'cross', opaque: false, tint: 'foliage' });
add('fern', { kind: 'cross', opaque: false, tint: 'foliage' });
add('tall_grass_bottom', { kind: 'cross', opaque: false, tint: 'foliage' });
add('tall_grass_top', { kind: 'cross', opaque: false, tint: 'foliage' });
for (const n of ['dandelion', 'poppy', 'azure_bluet', 'cornflower']) add(n, { kind: 'cross', opaque: false });
add('dead_bush', { kind: 'cross', opaque: false });
add('seagrass', { kind: 'cross', opaque: false, tint: 'water' });
add('lily_pad', { kind: 'lily', opaque: false, tint: 'lily' });
add('hanging_roots', { kind: 'cross', opaque: false });
add('cave_vines', { kind: 'cross', opaque: false });
add('cave_vines_plant', { kind: 'cross', opaque: false });
add('cave_vines_lit', { kind: 'cross', opaque: false, emit: 0.7, light: [1.0, 0.7, 0.25, 0.28] });
add('cave_vines_plant_lit', { kind: 'cross', opaque: false, emit: 0.7, light: [1.0, 0.7, 0.25, 0.28] });
add('fire', { kind: 'cross', opaque: false, emit: 1, tiles: ['fire_0'], light: [1.0, 0.55, 0.2, 0.7] });
add('soul_fire', { kind: 'cross', opaque: false, emit: 1, tiles: ['soul_fire_0'], light: [0.3, 0.75, 1.0, 0.6] });
add('chorus_plant', { kind: 'chorus', opaque: false });
add('chorus_flower', { kind: 'chorus', opaque: false });
add('chorus_flower_dead', { kind: 'chorus', opaque: false });
add('lantern', { kind: 'lantern', opaque: false, emit: 0.9, light: [1.0, 0.72, 0.38, 1.0] });
add('soul_lantern', { kind: 'lantern', opaque: false, emit: 0.9, light: [0.35, 0.75, 1.0, 1.0] });
add('iron_chain', { kind: 'chain', opaque: false });
add('nether_portal', { kind: 'portal', opaque: false, emit: 0.8, tiles: ['nether_portal'], light: [0.62, 0.22, 1.0, 0.5] });
add('icicle', { kind: 'icicle', opaque: false, tiles: ['packed_ice'] });

export const isSolidForCamera = (id) => id !== 0 && LIST[id].kind !== 'cross' && LIST[id].kind !== 'liquid' && LIST[id].kind !== 'lily' &&
  LIST[id].kind !== 'chain' && LIST[id].kind !== 'lantern' && LIST[id].kind !== 'icicle' && LIST[id].kind !== 'chorus';

// biome palettes (linear colours are made in the mesher)
export const PALETTE = {
  alpine: { grass: '#7fc23c', foliage: '#6fb82f', red: '#b3401c', gold: '#d9a521', water: '#3a8fb0' },
  cherry: { grass: '#8fc460', foliage: '#7fbf50', red: '#a8321a', gold: '#d4a020', water: '#2e9fb4' },
  taiga: { grass: '#6f9a4c', foliage: '#5f8a3e', red: '#9c3a1c', gold: '#c99a24', water: '#2c8aa0' },
  lush: { grass: '#60b030', foliage: '#58a82a', red: '#a8321a', gold: '#d4a020', water: '#2f9aaa' },
  ice: { grass: '#8fb8a0', foliage: '#8fb8a0', red: '#a8321a', gold: '#d4a020', water: '#4aa0d0' },
  nether: { grass: '#8a6a3a', foliage: '#8a6a3a', red: '#a8321a', gold: '#d4a020', water: '#3a6a90' },
  end: { grass: '#6a5a8a', foliage: '#6a5a8a', red: '#6a2a8a', gold: '#8a5ab0', water: '#4a3a8a' },
  desert: { grass: '#bfb755', foliage: '#aea42a', red: '#b3401c', gold: '#d9a521', water: '#32a598' },
  deep: { grass: '#2f4f48', foliage: '#2f4f48', red: '#a8321a', gold: '#d4a020', water: '#1f6f80' },
  tunnel: { grass: '#7fc23c', foliage: '#6fb82f', red: '#b3401c', gold: '#d9a521', water: '#3a8fb0' },
};
export const BIOME_IDS = ['alpine', 'cherry', 'taiga', 'lush', 'ice', 'nether', 'end', 'tunnel', 'desert', 'deep'];

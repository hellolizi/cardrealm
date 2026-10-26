// 用真实模块验证开放世界的解锁链、航路与地图形态。
process.env.NODE_ENV = 'test';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };

const lore = await import('../../js/lore.js');
const ws = await import('../../js/world-state.js');
const eng = await import('../../js/engine.js');

console.log('=== 1. 航路图 ===');
const SF = lore.SEA_ROUTES;
console.log('航路条数:', SF.length);
console.log('每座岛的相邻岛:');
for (const r of lore.REGIONS) {
  console.log('  ', r.name.padEnd(6), '→', lore.seaNeighbours(r.id).map((id) => lore.REGION_MAP[id]?.name || id).join('、'));
}

console.log('\n=== 2. 解锁链（从开局一路打下去） ===');
const world = ws.defaultWorld();
function report(tag) {
  const open = lore.REGIONS.filter((r) => ws.isRegionUnlocked(world, r.id)).map((r) => r.name);
  console.log(tag.padEnd(22), '可去:', open.join('、'));
}
report('开局');
console.log('  折廊可去?', ws.isRegionUnlocked(world, 'corridor'));

// 踏平折廊
world.clearedRegions.push('corridor');
world.regionClears.corridor = 1;
world.stats.clears = 1;
ws.refreshWorld(world);
report('踏平折廊后');

// 应该一次亮 4 座（雾隐/骨庭/镜潮/潮钟），心岛还不能去
const shouldOpen = ['mist', 'bone', 'mirror', 'tide'];
for (const id of shouldOpen) {
  const ok = ws.isRegionUnlocked(world, id);
  console.log(`  ${id} 通航: ${ok ? 'OK' : '*** 失败 ***'}`);
}
console.log('  心岛（应仍锁）:', ws.isRegionUnlocked(world, 'heart') ? '*** 失败：提前开了 ***' : 'OK');

// 踏平雾隐 → 灰烬应该开
world.regionClears.mist = 1;
world.clearedRegions.push('mist');
ws.refreshWorld(world);
console.log('  踏平雾隐 → 灰烬通航:', ws.isRegionUnlocked(world, 'ash') ? 'OK' : '*** 失败 ***');

// 踏平骨庭 → 纸月
world.regionClears.bone = 1;
world.clearedRegions.push('bone');
ws.refreshWorld(world);
console.log('  踏平骨庭 → 纸月通航:', ws.isRegionUnlocked(world, 'moon') ? 'OK' : '*** 失败 ***');

// 补齐三条支流 → 心岛
world.regionClears.ash = 1; world.clearedRegions.push('ash');
world.regionClears.tide = 1; world.clearedRegions.push('tide');
world.regionClears.moon = 1; world.clearedRegions.push('moon');
ws.refreshWorld(world);
console.log('  灰烬+潮钟+纸月 → 心岛:', ws.isRegionUnlocked(world, 'heart') ? 'OK' : '*** 失败 ***');

console.log('\n=== 3. 八岛地图形态 ===');
for (const r of lore.REGIONS) {
  const map = eng.makeMap(r.id);
  const flat = map.flat();
  const boss = flat.find((n) => n.type === 'boss');
  const reach = new Set([map[0][0]?.id]);
  let guard = 0;
  while (guard++ < 60) {
    const before = reach.size;
    for (const id of [...reach]) {
      const node = flat.find((n) => n.id === id);
      for (const nid of node?.next || []) reach.add(nid);
    }
    if (reach.size === before) break;
  }
  const widths = map.map((l) => l.length).join('-');
  console.log(
    `  ${r.name.padEnd(6)} shape=${String(r.shape).padEnd(6)} 层=${String(map.length).padEnd(2)} 宽=${widths.padEnd(22)} boss可达=${reach.has(boss?.id) ? 'YES' : '*** NO ***'}`,
  );
}

console.log('\n=== 4. 五角色资源（当前状态） ===');
for (const o of (await import('../../js/data.js')).ORIGINS) {
  console.log(`  ${o.name.padEnd(6)} hp=${String(o.hp).padEnd(3)} resources=${JSON.stringify(o.resources || null)}`);
}
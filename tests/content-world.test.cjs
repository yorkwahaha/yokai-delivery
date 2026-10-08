const test = require("node:test");
const assert = require("node:assert/strict");

const CONTENT = require("../js/words.js");
const WORLD = require("../js/world.js");

test('octopus belongs to the sea pack while the turtle stays by the pond',()=>{
  assert.ok(CONTENT.getPack('beach').words.some(w=>w.jp==='たこ'));
  assert.ok(CONTENT.getPack('pond').words.some(w=>w.jp==='かめ'));
  assert.equal(CONTENT.getAllWords().find(w=>w.jp==='かみなり').zh,'雷');
});

test('answer-only decoys stay out of cargo vocabulary but are available to quiz choices',()=>{
  const cargo = CONTENT.getAllWords();
  const answers = CONTENT.getAnswerCandidates();
  for (const jp of ['クーラー','アパート']) {
    assert.equal(cargo.some(w=>w.jp===jp), false, jp);
    assert.equal(answers.some(w=>w.jp===jp), true, jp);
  }
});

test('house identities stay unique throughout distant positive and negative chunks',()=>{
  const world=WORLD.createStageWorld(CONTENT.getStage('night-town'),CONTENT),ids=new Set();
  for(let x=-30;x<=30;x++)for(let y=-30;y<=30;y++)for(const h of world.getChunk(x,y).houses){assert.ok(!ids.has(h.id),`${x},${y}: ${h.id}`);ids.add(h.id);assert.ok(Number.isFinite(h.phase));}
});

test("night-town keeps the original 9 word packs and 27 unique words", () => {
  const stage = CONTENT.getStage("night-town");
  assert.equal(stage.wordPacks.length, 9);
  const words = CONTENT.getStageWords(stage);
  assert.equal(words.length, 27);
  assert.equal(new Set(words.map(w => w.jp)).size, 27);
  assert.deepEqual(stage.pacing.bossTimes, [180, 360, 540, 590]);
  assert.equal(stage.pacing.runSeconds, 600);
  assert.equal(stage.pacing.goalDeliveries, 6);
});

test("rain-port is a separate playable stage with its own packs and weather tuning", () => {
  const stage = CONTENT.getStage("rain-port");
  assert.equal(stage.implemented, true);
  assert.equal(stage.unlockedByDefault, false);
  assert.deepEqual(stage.wordPacks, ["rain-weather", "port-directions", "port"]);
  const words = CONTENT.getStageWords(stage);
  assert.equal(words.length, 15);
  assert.ok(words.some(w => w.jp === "あめ"));
  assert.ok(words.some(w => w.jp === "みぎ"));
  assert.ok(words.some(w => w.jp === "ふね"));
  assert.equal(stage.visual.weather, "rain");
  assert.equal(stage.visual.ground, "ground");
  assert.equal(stage.visual.petals, 0);
  assert.equal(stage.visual.fireflies, 0);
  assert.equal(stage.enemy.bossTheme, "harbor");
  assert.equal(stage.pacing.goalDeliveries, 6);
  assert.deepEqual(stage.pacing.bossTimes, [210, 420, 590]);
  const world = WORLD.createStageWorld(stage, CONTENT);
  assert.equal(world.update(stage.start.x, stage.start.y).chunks.length, 25);
});

test("initial 3x3 chunks preserve the original district order", () => {
  const stage = CONTENT.getStage("night-town");
  const world = WORLD.createStageWorld(stage, CONTENT);
  const expected = [
    ["animals", "beach", "nightsky"],
    ["sweets", "station", "port"],
    ["sakura", "tavern", "pond"]
  ];

  expected.forEach((row, cy) => {
    row.forEach((packId, cx) => {
      const chunk = world.getChunk(cx, cy);
      assert.equal(chunk.packId, packId);
      assert.equal(chunk.houses.length, 3);
    });
  });
});

test("world streams chunks at arbitrarily distant and negative coordinates", () => {
  const stage = CONTENT.getStage("night-town");
  const world = WORLD.createStageWorld(stage, CONTENT);
  const snapshot = world.update(1_000_000, -800_000);

  assert.equal(snapshot.chunks.length, 25);
  assert.equal(snapshot.houses.length, 75);
  assert.equal(snapshot.solids.length, 75);

  const centerKey = world.keyAt(1_000_000, -800_000);
  assert.ok(snapshot.chunks.some(chunk => chunk.key === centerKey));
  assert.ok(snapshot.houses.some(house => Math.abs(house.x) > 100_000));
  assert.ok(snapshot.houses.some(house => house.y < 0));
});

test("chunk cache stays bounded and only pinned delivery chunks survive travel", () => {
  const stage = CONTENT.getStage("night-town");
  const world = WORLD.createStageWorld(stage, CONTENT);

  world.update(stage.start.x, stage.start.y);
  const pinned = world.keyAt(stage.start.x, stage.start.y);
  assert.ok(world.getCachedKeys().includes(pinned));

  world.update(1_000_000, 1_000_000, [pinned]);
  assert.ok(world.getCachedKeys().includes(pinned));
  assert.ok(world.getCacheSize() <= 26);

  world.update(2_000_000, 2_000_000);
  assert.ok(!world.getCachedKeys().includes(pinned));
  assert.equal(world.getCacheSize(), 25);
});

test("regenerated chunks are deterministic", () => {
  const stage = CONTENT.getStage("night-town");
  const world = WORLD.createStageWorld(stage, CONTENT);

  const first = world.getChunk(-12, 37);
  const signature = first.houses.map(h => [h.id, h.x, h.y, h.word.jp]);
  world.reset();
  const second = world.getChunk(-12, 37);

  assert.deepEqual(second.houses.map(h => [h.id, h.x, h.y, h.word.jp]), signature);
});

test("staggered houses leave room for all answer pads, even across chunk boundaries", () => {
  for (const stageId of ["night-town", "rain-port"]) {
    const world = WORLD.createStageWorld(CONTENT.getStage(stageId), CONTENT);
    const chunks = [];
    for (let cy = -2; cy <= 2; cy++) for (let cx = -2; cx <= 2; cx++) {
      chunks.push(world.getChunk(cx, cy));
    }
    const houses = chunks.flatMap(c => c.houses);
    assert.ok(chunks.every(c => c.houses.length === 3));
    for (const h of houses) {
      const pads = WORLD.answerPositions(h).map(p => [p.x,p.y]);
      for (const other of houses) {
        if (other === h) continue;
        // 保守包住最大 175px 寬的酒館、屋頂、以及下方招牌。
        const left=other.x-94,right=other.x+94,top=other.y-140,bottom=other.y+70;
        for(const [x,y] of pads) {
          const dx=Math.max(left-x,0,x-right),dy=Math.max(top-y,0,y-bottom);
          assert.ok(Math.hypot(dx,dy)>=48,
            `${stageId}: answer of ${h.id} too close to ${other.id} at ${x},${y}`);
        }
      }
    }
  }
});

test("each deterministic scene layout preserves breathing room across all neighboring combinations", () => {
  const layouts = WORLD.HOUSE_LAYOUTS;
  assert.equal(layouts.length, 3);
  const nearest = {houses: Infinity, answers: Infinity, side: Infinity, visuals: Infinity};
  const houseBox = h => ({x0:h.x-96,x1:h.x+96,y0:h.y-150,y1:h.y+70});
  const pointGap = (p, box) => Math.hypot(
    Math.max(box.x0-p.x,0,p.x-box.x1),
    Math.max(box.y0-p.y,0,p.y-box.y1));
  const rectGap = (a,b) => Math.hypot(
    Math.max(a.x0-b.x1,b.x0-a.x1,0),
    Math.max(a.y0-b.y1,b.y0-a.y1,0));
  for(const [layoutAIndex,layoutA] of layouts.entries())
  for(const [layoutBIndex,layoutB] of layouts.entries())
  for(let cy=-1;cy<=1;cy++)for(let cx=-1;cx<=1;cx++) {
    if(cx===0&&cy===0&&layoutAIndex!==layoutBIndex)continue;
    for(const [i,posA] of layoutA.entries())
    for(const [j,posB] of layoutB.entries()) {
      if(cx===0&&cy===0&&i===j)continue;
      const a={x:posA[0],y:posA[1]},
            b={x:posB[0]+cx*900,y:posB[1]+cy*600};
      nearest.houses=Math.min(nearest.houses,Math.hypot(a.x-b.x,a.y-b.y));
      nearest.visuals=Math.min(nearest.visuals,rectGap(houseBox(a),houseBox(b)));
      if(Math.abs(a.y-b.y)<220)nearest.side=Math.min(nearest.side,Math.abs(a.x-b.x));
      for(const p of WORLD.answerPositions(a))
        nearest.answers=Math.min(nearest.answers,pointGap(p,houseBox(b)));
      for(const p of WORLD.answerPositions(b))
        nearest.answers=Math.min(nearest.answers,pointGap(p,houseBox(a)));
    }
  }
  assert.ok(nearest.houses>=380,`too close buildings: ${nearest.houses}`);
  assert.ok(nearest.side>=380,`side-to-side houses: ${nearest.side}`);
  assert.ok(nearest.visuals>=94,`building silhouettes: ${nearest.visuals}`);
  assert.ok(nearest.answers>=48,`answers near neighboring buildings: ${nearest.answers}`);

  const stage=CONTENT.getStage("night-town");
  const world=WORLD.createStageWorld(stage,CONTENT);
  const variants=new Set();
  for(let cy=-5;cy<=5;cy++)for(let cx=-5;cx<=5;cx++){
    const chunk=world.getChunk(cx,cy);
    const coords=chunk.houses.map(h=>[h.x-cx*900,h.y-cy*600]);
    const variant=layouts.findIndex(layout=>layout.every((position,i)=>position[0]===coords[i][0]&&position[1]===coords[i][1]));
    assert.ok(variant>=0,`unknown layout: ${cx},${cy}`);
    variants.add(variant);
  }
  assert.equal(variants.size,3);
});

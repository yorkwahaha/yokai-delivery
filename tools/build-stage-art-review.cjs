'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
async function build() {
  const requested = new Set();
  class Image { set src(value) { requested.add(value); } }
  const window = { Image };
  const context = vm.createContext({ window, Image });
  for (const name of ['kyoto-scene-art', 'snow-temple-art', 'late-stage-art'])
    vm.runInContext(fs.readFileSync(path.join(root, 'js', `${name}.js`), 'utf8'), context);
  const stages = {
    'hyakki-kyoto': window.KYOTO_SCENE_ART,
    'snow-temple': window.SNOW_TEMPLE_ART,
    'spirit-ferry': window.LATE_STAGE_ART.forStage('spirit-ferry'),
    yomi: window.LATE_STAGE_ART.forStage('yomi')
  };
  const index = {};
  for (const [stage, art] of Object.entries(stages)) {
    requested.clear();
    art.load();
    const bossIds = [0, 1, 2, 3].map(i => art.bossWave(i).id);
    index[stage] = await Promise.all([...requested].sort().map(async file => {
      const { width, height } = await sharp(path.join(root, file)).metadata();
      let group = 'mobs';
      if (file.includes('/tiles/')) group = 'ground';
      else if (file.includes('/scene/')) group = 'scene';
      else if (file.includes('/vfx/')) group = 'vfx';
      else if (bossIds.some(id => file.includes(`/${id}__`))) group = 'bosses';
      return {path:file, group, width, height};
    }));
    console.log(stage, index[stage].length);
  }
  fs.writeFileSync(path.join(root, 'docs/stage-art-review/assets.json'), JSON.stringify(index, null, 2) + '\n');
}

build().catch(error => { console.error(error); process.exitCode = 1; });

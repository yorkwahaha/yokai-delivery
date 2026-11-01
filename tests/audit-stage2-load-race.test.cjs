'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('cancelled rain-port manifest cannot revive the old stage cache', async () => {
  let finishFetch;
  class Image {}
  class Audio { addEventListener() {} }
  const fetch = () => new Promise(resolve => { finishFetch = resolve; });
  const env = { Image, Audio, fetch, console };
  env.window = env;
  vm.runInNewContext(fs.readFileSync('js/assets.js', 'utf8'), env);
  env.STAGE_ART_RESOLVER.setActiveStage('rain-port');
  const oldTask = env.loadS2ArtProdAssets();
  env.STAGE_ART_RESOLVER.setActiveStage('night-town');
  env.resetS2ArtProdCache();
  finishFetch({ ok: true, json: async () => ({
    stages: { 'rain-port': { tiles: { stoneVariants: [{id:'stone'}], woodVariants: [{id:'wood'}] },
      buildings: [], props: [], environment: [] } }
  }) });
  await oldTask;
  assert.equal(env.getS2StoneTiles(), null);
  assert.equal(env.getS2Buildings(), null);
  assert.equal(env.S2_ART_PROD_CACHE?.loaded ?? false, false);
});

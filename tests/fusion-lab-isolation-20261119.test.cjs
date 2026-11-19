"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const code=fs.readFileSync("js/fusion.js","utf8");
const DEV_MODE=require("../js/dev-mode.js");
const {loadGame}=require("./helpers/game-runtime.cjs");
function fusion(hostname,search){
  const window={location:{hostname,search},
    DEV_MODE};
  vm.runInNewContext(code,{window,document:{},URLSearchParams});
  return window.FUSION;
}
test("一般公開局與未授權 dev query 都不啟動融合核心",()=>{
  assert.equal(fusion("example.com",""),undefined);
  assert.equal(fusion("example.com","?dev=1&fusionlab=1"),undefined);
  assert.equal(fusion("localhost","?dev=1&stage=sakura-pass"),undefined);
  assert.equal(fusion("localhost","?fusionlab=1"),undefined);
  assert.equal(fusion("192.168.1.20","?s3play=1&dev=1&fusionlab=1"),undefined);
  assert.equal(fusion("localhost","?dev=1&fusionlab=1&nofusion=1"),undefined);
});
test("本機 DEV Fusion Lab 仍保留所有配方與測試橋接",()=>{
  const f=fusion("localhost","?dev=1&fusionlab=1");
  assert.equal(typeof f.bindGame,"function");
  assert.equal(typeof f.executeFusion,"function");
  assert.ok(f.RECIPES.fusion_inkblade);
  assert.ok(f.RECIPES.fusion_thundercircle);
});
test("正式 index 不再無條件下載融合模組，Lab 在 game.js 之前同步載入",()=>{
  const html=fs.readFileSync("index.html","utf8");
  assert.doesNotMatch(html,/^\s*<script\s+src="js\/fusion\.js/m);
  const loader=html.indexOf('document.write(\'<script src="js/fusion.js');
  assert.ok(loader>0);
  assert.ok(loader<html.indexOf('src="js/game.js'));
  const gate=html.slice(html.lastIndexOf("<script>",loader),loader);
  assert.match(gate,/isFusionLab/);
});

test("本機 Lab 交易後能重開與換關；一般局不建立 Lab 橋接",()=>{
  const local={hostname:"localhost",search:"?dev=1&fusionlab=1"};
  const game=loadGame({location:local,fusionLab:true});
  const lab=game.env.DEV_FUSION_LAB;
  assert.equal(Object.keys(game.env.FUSION.RECIPES).length,10);
  assert.equal(lab.equip("fusion_inkblade").ok,true);
  assert.equal(game.weaponLevels().fusion_inkblade,1);
  assert.equal(game.weaponLevels().katana,0);
  assert.equal(game.weaponLevels().fire,0);
  game.start("night-town");
  assert.equal(game.weaponLevels().fusion_inkblade,0);
  assert.equal(lab.equip("fusion_inkblade").ok,true);
  const normal=loadGame({location:{...local,search:"?dev=1"},fusionLab:true});
  assert.equal(normal.env.DEV_FUSION_LAB,undefined);
  assert.equal(normal.env.FUSION,undefined);
});

'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const vm = require('node:vm');
const {loadGame} = require('../tests/helpers/game-runtime.cjs');

const stages = ['night-town','rain-port','sakura-pass','bamboo-maze'];
function random(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let n = Math.imul(seed ^ (seed >>> 15),seed | 1);
    n ^= n + Math.imul(n ^ (n >>> 7),n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
const mark = {
  long: jp => /ー/u.test(jp),
  small: jp => /[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ]/u.test(jp),
  voiced: jp => /[\u3099\u309a]/u.test(jp.normalize('NFD'))
};
const round = n => +n.toFixed(4);

function quiz(reference) {
  const game = loadGame();
  if (reference) for (const file of ['words','game-quiz-logic']) {
    vm.runInContext(execFileSync('git',['show',`${reference}:js/${file}.js`],{encoding:'utf8'}),game.env);
  }
  const {CONTENT,GAME_QUIZ_LOGIC:rules} = game.env;
  const features = {script:rules.kanaScript,length:rules.writtenLength,...mark};
  return stages.map(stage => {
    game.startRun(stage);
    const words = CONTENT.getStageWords(stage);
    const guesses = Object.fromEntries(Object.keys(features).map(key=>[key,{majority:0,minority:0}]));
    const slots = [0,0,0], perWord = new Map();
    let incomplete = 0, differentScript = 0, differentLength = 0, differentMarks = 0;
    let collisions = 0, consecutive = 0;
    for (let seed=1;seed<=64;seed++) {
      game.env.Math.random = random(seed);
      for (const word of words) {
        const choices = Array.from(game.answerChoices(word));
        if (choices.length !== 3 || !choices.includes(word) ||
            new Set(choices.map(w=>w.jp.normalize('NFC'))).size !== 3 || choices.some(w=>!w.zh)) {
          incomplete++;
          continue;
        }
        const index = choices.indexOf(word);
        slots[index]++;
        const key = choices.filter(w=>w!==word).map(w=>w.jp).sort().join('/');
        if (!perWord.has(word.jp)) perWord.set(word.jp,{seen:new Map()});
        const entry = perWord.get(word.jp), count = entry.seen.get(key) || 0;
        collisions += count;
        if (entry.last === key) consecutive++;
        entry.seen.set(key,count+1);
        entry.last = key;
        differentScript += choices.some(w=>rules.kanaScript(w.jp)!==rules.kanaScript(word.jp));
        differentLength += choices.some(w=>rules.writtenLength(w.jp)!==rules.writtenLength(word.jp));
        differentMarks += choices.some(w=>Object.values(mark).some(f=>f(w.jp)!==f(word.jp)));
        for (const [name,feature] of Object.entries(features)) {
          const values = choices.map(w=>feature(w.jp));
          if (new Set(values).size!==2) {
            guesses[name].majority+=1/3;
            guesses[name].minority+=1/3;
            continue;
          }
          const matching = values.filter(value=>value===values[index]).length;
          guesses[name].majority += matching===2 ? .5 : 0;
          guesses[name].minority += matching===1 ? 1 : 0;
        }
      }
    }
    const trials = words.length*64;
    return {stage,trials,incomplete,differentScript,differentLength,differentMarks,slots,
      collisions,possiblePairs:words.length*64*63/2,consecutive,consecutivePairs:words.length*63,
      minDistinct:Math.min(...Array.from(perWord.values(),entry=>entry.seen.size)),
      mostRepeated:[...perWord].map(([jp,entry]) => [jp,[...entry.seen.values()]
        .reduce((total,n)=>total+n*(n-1)/2,0)]).sort((a,b)=>b[1]-a[1]).slice(0,6),
      guessPct:Object.fromEntries(Object.entries(guesses).map(([key,methods])=>
        [key,Object.fromEntries(Object.entries(methods).map(([method,total])=>[method,round(total*100/trials)]))]))};
  });
}

const layouts = [
  {id:'boss-100',distances:[100],type:'boss'},
  {id:'boss-220',distances:[220],type:'boss'},
  {id:'boss-390',distances:[390],type:'boss'},
  {id:'boss-100-side',distances:[100],type:'boss',angle:Math.PI/4},
  {id:'mob-100',distances:[100]},
  {id:'line-3',distances:[100,160,220]},
  {id:'moving-12',distances:Array.from({length:12},(_,i)=>50+i*16),moving:true}
];
function damageMatrix() {
  const game = loadGame();
  const seconds = 12, dt = .05, hp = 10000;
  const rows = [];
  for (const skill of ['needle','boom']) for (let rank=1;rank<=5;rank++) for (const layout of layouts) {
    game.startRun('bamboo-maze');
    const initial = game.snapshot();
    let x = initial.x;
    game.env.RENDERER.getCam = () => ({x:x-450,y:initial.y-300});
    game.combatScene(skill,layout.distances.map((distance,index)=>({
      dx:distance*Math.cos(layout.angle ?? 0),
      dy:layout.moving ? (index%4-1)*37 : distance*Math.sin(layout.angle ?? 0),
      hp,max:hp,type:layout.type || 'ghost',speed:0
    })),[],rank);
    game.face(0);
    game.armWeapons();
    game.env.Math.random = random(117);
    const actors = game.snapshot().enemies;
    for (let frame=1;frame<=seconds/dt;frame++) {
      const start = {x,y:initial.y};
      x = initial.x + (layout.moving ? frame*225*dt : 0);
      game.placeAt(x,initial.y);
      game.setElapsed(frame*dt);
      game.weapons(dt,{start,end:{x,y:initial.y}});
    }
    const damage = actors.map(actor=>hp-actor.hp);
    rows.push({skill,rank,layout:layout.id,targets:damage.length,hit:damage.filter(d=>d>0).length,
      dps:round(damage.reduce((total,d)=>total+d,0)/seconds),maxTargetDps:round(Math.max(...damage)/seconds)});
  }
  return rows;
}

const mode = process.argv[2];
if (mode === 'quiz') {
  const reference = process.argv[3] || 'bc34c01';
  const before = quiz(reference), after = quiz();
  console.log(JSON.stringify({reference,before,after},null,2));
  for (const row of after) {
    assert.equal(row.incomplete+row.differentScript+row.differentLength+row.differentMarks,0,row.stage);
    const old = before.find(previous=>previous.stage===row.stage);
    assert.ok(row.collisions<=old.collisions,`${row.stage}: repeated option-pair rate increased`);
  }
} else if (mode === 'dps') console.log(JSON.stringify(damageMatrix(),null,2));
else throw new Error('Usage: node tools/measure-first-four-phase-a.cjs quiz [reference] | dps');

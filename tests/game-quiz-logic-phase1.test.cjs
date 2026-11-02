'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('js/game-quiz-logic.js','utf8');
function logic(){
 const env={window:{}};
 vm.runInNewContext(source,env);
 return env.window.GAME_QUIZ_LOGIC;
}
test('quiz module: NFC written length and hiragana/katakana classification remain stable',()=>{
 const q=logic();
 assert.equal(q.writtenLength('が'),1);
 assert.equal(q.writtenLength('か\u3099'),1);
 assert.equal(q.kanaScript('おにぎり'),'hiragana');
 assert.equal(q.kanaScript('ラーメン'),'katakana');
 assert.equal(q.kanaScript('お茶'),'mixed');
});
test('quiz module: three unique answers, preference for same-script and cross-script',()=>{
 const q=logic(),word={jp:'はこ'};
 const district=[{jp:'いぬ'},{jp:'カニ'}];
 const allWords=[{jp:'ねこ'},{jp:'タコ'},{jp:'ねこ'},{jp:'ふね'}];
 const extra=[{jp:'なべ'},{jp:'サメ'}];
 const reverse=list=>[...list].reverse();
 const picks=q.answerChoices(word,{districtWords:district,allWords,extraWords:extra,shuffle:reverse});
 const text=Array.from(picks,w=>w.jp);
 assert.equal(picks.length,3);
 assert.equal(new Set(text).size,3);
 assert.ok(picks.includes(word));
 assert.ok(picks.some(w=>q.kanaScript(w.jp)==='hiragana'&&w!==word));
 assert.ok(picks.some(w=>q.kanaScript(w.jp)==='katakana'));
 assert.ok(picks.every(w=>q.writtenLength(w.jp)===2));
});
test('quiz module: fallback still builds three unique choices if exact-length pool is sparse',()=>{
 const q=logic();
 const word={jp:'とてもながいことば'};
 const pool=[{jp:'りんご'},{jp:'りんご'},{jp:'おちゃ'},{jp:'タコ'},{jp:'くま'}];
 const picks=q.answerChoices(word,{
  districtWords:[],allWords:pool,extraWords:[],shuffle:list=>[...list]
 });
 assert.equal(picks.length,3);
 assert.equal(new Set(picks.map(w=>w.jp)).size,3);
 assert.ok(picks.includes(word));
});
test('quiz phase one page loads pure module before game.js',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('js/game-quiz-logic.js')>0);
 assert.ok(html.indexOf('js/game-quiz-logic.js')<html.indexOf('js/game.js'));
 assert.match(fs.readFileSync('js/game.js','utf8'),/window\.GAME_QUIZ_LOGIC\.answerChoices/);
});

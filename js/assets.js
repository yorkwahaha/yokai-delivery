// 素材載入：放了就用，沒放就自動退回程式繪製。
// 圖：assets/img/player.png、ghost.png（一般妖怪）、mis.png（誤配妖怪）；音樂：assets/audio/bgm.mp3
window.ART = {};
["player", "ghost", "mis"].forEach(n => { const i = new Image(); i.onload = () => { ART[n] = i; }; i.src = "assets/img/" + n + ".png"; });
window.BGM = null;
{ const a = new Audio("assets/audio/bgm.mp3"); a.loop = true; a.volume = .5; a.addEventListener("canplaythrough", () => { BGM = a; }, { once: true }); }

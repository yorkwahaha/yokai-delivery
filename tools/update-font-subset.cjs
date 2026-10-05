// Run from the repository root after changing visible copy.
const fs = require('node:fs');
const htmlPath = 'index.html';
let html = fs.readFileSync(htmlPath, 'utf8');
const links = html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"\s]+/g);
const chars = new Set(links.flatMap(link => [...new URL(link).searchParams.get('text')]));
const sources = fs.readdirSync('js').filter(name => name.endsWith('.js')).map(name => fs.readFileSync(`js/${name}`, 'utf8'));
sources.push(html.replace(/https:\/\/fonts\.googleapis\.com\/css2\?[^"\s]+/g, ''));
for (const source of sources) {
  const copy = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const char of copy.match(/[\u2190-\u2bff\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/gu) || []) chars.add(char);
}
const all = [...chars].sort(), split = Math.ceil(all.length / 2);
links.forEach((link, i) => {
  const base = link.slice(0, link.indexOf('&text='));
  html = html.replace(link, `${base}&text=${encodeURIComponent(all.slice(i * split, (i + 1) * split).join(''))}`);
});
fs.writeFileSync(htmlPath, html);
console.log(`Font subset updated: ${all.length} characters`);

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');

test('font subset updater preserves the full answer font and adds new copy only to decorative subsets',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'yokai-font-test-'));
  try {
    fs.mkdirSync(path.join(root,'js'));
    fs.writeFileSync(path.join(root,'js/ui.js'),"const label='覺醒印免費';");
    const full='https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap';
    fs.writeFileSync(path.join(root,'index.html'),[full,
      'https://fonts.googleapis.com/css2?family=Kaisei+Decol&text=字',
      'https://fonts.googleapis.com/css2?family=Yuji+Syuku&text=詞'].map(s=>`<link href="${s}">`).join('\n'));
    execFileSync(process.execPath,[path.resolve('tools/update-font-subset.cjs')],{cwd:root});
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert.ok(html.includes(`href="${full}"`));
    const links=html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"\s]+/g).map(s=>new URL(s));
    assert.equal(links.filter(u=>u.searchParams.has('text')).length,2);
    const chars=links.map(u=>u.searchParams.get('text')||'').join('');
    for(const char of '覺醒印免費字詞')assert.ok(chars.includes(char),char);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

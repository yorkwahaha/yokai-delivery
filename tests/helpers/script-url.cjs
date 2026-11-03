'use strict';
// Resolve a deployed script's unique, versioned HTML URL. Tests of module
// load ordering should not depend on the calendar date of an unrelated build.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');

function scriptUrl(moduleName) {
  assert.match(moduleName,/^[a-z0-9-]+$/,'validated script module name');
  const matches=[...html.matchAll(new RegExp('\\bsrc="(js/'+moduleName+'\\.js\\?v=([^"]+))"','g'))];
  assert.equal(matches.length,1,moduleName+' must load once with a cache-busting revision');
  assert.match(matches[0][2],/^20\d{6}-[a-z0-9-]+$/,
    moduleName+' must have a dated, nonempty release revision');
  return matches[0][1];
}

module.exports={scriptUrl};
